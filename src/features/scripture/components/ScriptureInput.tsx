"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { 
  getSuggestions, 
  getSmartTransform, 
  type Suggestion 
} from "../lib/autocomplete";
import { parseReference, isValidCharacter } from "../lib/parser";
import { cn } from "@/lib/utils";
import { AlertCircle, Search } from "lucide-react";

import { db, type BibleBookRecord, type BibleVersion } from "../lib/db";

interface ScriptureInputProps {
  onRefChange: (ref: ReturnType<typeof parseReference>) => void;
  availableBooks: BibleBookRecord[];
  availableVersions: BibleVersion[];
  className?: string;
  placeholder?: string;
}

export function ScriptureInput({ 
  onRefChange, 
  availableBooks, 
  availableVersions, 
  className,
  placeholder = "Search Bible... (John 3:16)"
}: ScriptureInputProps) {
  const [value, setValue] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const parsed = useMemo(() => parseReference(value, availableBooks), [value, availableBooks]);

  useEffect(() => {
    onRefChange(parsed);
  }, [parsed, onRefChange]);

  const updateSuggestions = async (val: string) => {
    const suggs = await getSuggestions(val, availableBooks, availableVersions);
    setSuggestions(suggs);
    setSelectedIndex(0);
    setShowDropdown(suggs.length > 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % suggestions.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
        break;
      case "Enter":
      case "Tab":
        e.preventDefault();
        if (suggestions[selectedIndex]) {
          applySuggestion(suggestions[selectedIndex]);
        }
        break;
      case "Escape":
        setShowDropdown(false);
        break;
    }
  };

  const applySuggestion = (s: Suggestion) => {
    setValue(s.text);
    setShowDropdown(false);
    updateSuggestions(s.text);
    inputRef.current?.focus();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    const trim = newVal.trimStart();
    const oldVal = value;

    if (trim && newVal.length > oldVal.length) {
      const parts = trim.split(/\s+/);
      const isIntroNum = /^[1-3]$/.test(parts[0]);
      const bookPart = (isIntroNum && parts[1]) ? `${parts[0]} ${parts[1]}` : parts[0];
      
      const isBookTypingDone = (isIntroNum && parts.length > 2) || (!isIntroNum && parts.length > 1);

      if (!isBookTypingDone) {
        // Find ALL matching books (no limit)
        const matches = availableBooks.filter(b => 
          b.name.toLowerCase().startsWith(bookPart.toLowerCase()) || 
          b.id.toLowerCase().startsWith(bookPart.toLowerCase()) ||
          b.abbreviation?.toLowerCase().startsWith(bookPart.toLowerCase())
        );

        if (matches.length > 0) {
          // If exactly one match, and it's a unique book name, inline auto-complete
          // We filter for unique names because multiple versions might return "Matthew" multiple times
          const uniqueNames = new Set(matches.map((b) => b.name));

          if (uniqueNames.size === 1) {
            const matchedBookName = matches[0].name;
            const completedValue =
              matchedBookName + (newVal.endsWith(" ") ? " " : " ");

            // Only auto-complete if the new value is actually longer (prevent loops)
            // and if we are not already at the full name
            if (completedValue.length > newVal.length) {
              setValue(completedValue);
              updateSuggestions(completedValue);
              return;
            }
          }

          updateSuggestions(newVal);
        }
      } else {
        const lastChar = newVal.slice(-1);
        if (!/^[0-9:\-\sA-Za-z]$/.test(lastChar)) return;
      }
    }

    const transformed = getSmartTransform(newVal);
    setValue(transformed);
    updateSuggestions(transformed);
  };

  return (
    <div className={cn("relative", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
        <Input
          ref={inputRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => updateSuggestions(value)}
          placeholder={placeholder}
          className={cn(
            "pl-9 h-8 text-xs bg-background/50 border-muted-foreground/20 focus-visible:ring-1 focus-visible:ring-primary/40",
            parsed.errors.length > 0 &&
              value.includes(" ") &&
              "border-destructive/50 focus-visible:ring-destructive/30",
          )}
        />
        {/* Dropdown removed as per user request */}
      </div>
    </div>
  );
}
