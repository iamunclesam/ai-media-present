"use client";

import {
  useState,
  useEffect,
  useRef,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from "react";
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
  onEnter?: (value?: string) => void;
}

export const ScriptureInput = forwardRef<HTMLInputElement, ScriptureInputProps>(
  function ScriptureInput(
    {
      onRefChange,
      availableBooks,
      availableVersions,
      className,
      placeholder = "Search Bible... (John 3:16)",
      onEnter,
    },
    ref,
  ) {
    const [value, setValue] = useState("");
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [showDropdown, setShowDropdown] = useState(false);

    // Use the forwarded ref if provided, or fallback to internal ref
    const internalInputRef = useRef<HTMLInputElement>(null);
    // We need to combine them if we want to use it internally too, or just expect parent to handle focus
    // Simplest is to just use standard imperative handle or just assign to the input if simple.
    // Actually, standard pattern:
    const dropdownRef = useRef<HTMLDivElement>(null);

    const parsed = useMemo(
      () => parseReference(value, availableBooks),
      [value, availableBooks],
    );

    // Use a ref to track the last emitted value to prevent infinite loops
    // caused by availableBooks array reference changes
    const lastParsedJson = useRef("");

    useEffect(() => {
      // Basic circular reference handling not needed for POJOs from Dexie
      const json = JSON.stringify(parsed);
      if (json !== lastParsedJson.current) {
        lastParsedJson.current = json;
        onRefChange(parsed);
      }
    }, [parsed, onRefChange]);

    const updateSuggestions = async (val: string) => {
      const suggs = await getSuggestions(
        val,
        availableBooks,
        availableVersions,
      );
      setSuggestions(suggs);
      setSelectedIndex(0);
      setShowDropdown(suggs.length > 0);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          if (showDropdown) {
            e.preventDefault();
            setSelectedIndex((prev) => (prev + 1) % suggestions.length);
          }
          break;
        case "ArrowUp":
          if (showDropdown) {
            e.preventDefault();
            setSelectedIndex(
              (prev) => (prev - 1 + suggestions.length) % suggestions.length,
            );
          }
          break;
        case "Enter":
          e.preventDefault();
          if (showDropdown && suggestions[selectedIndex]) {
            const selectedText = suggestions[selectedIndex].text;
            // Always submit on Enter, applying suggestion if needed
            if (selectedText.toLowerCase() !== value.trim().toLowerCase()) {
              applySuggestion(suggestions[selectedIndex]);
            }
            onEnter?.(selectedText);
            internalInputRef.current?.blur();
            setShowDropdown(false);
          } else {
            // Submit current value if no dropdown or no selection
            onEnter?.(value);
            internalInputRef.current?.blur();
          }
          break;
        case "Tab":
          if (showDropdown && suggestions[selectedIndex]) {
            e.preventDefault();
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
      // Focus logic needs to handle the ref. Assuming parent manages focus or user is typing.
      // If we need to force focus back:
      if (internalInputRef.current) {
        internalInputRef.current.focus();
      }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawNewVal = e.target.value;
      const oldVal = value;

      // Allow deletion without strict checks (always safe to delete)
      if (rawNewVal.length < oldVal.length) {
        setValue(rawNewVal);
        updateSuggestions(rawNewVal);
        return;
      }

      // 1. Smart Transform (e.g. "1jn" -> "1 John")
      const transformedVal = getSmartTransform(rawNewVal);

      // 2. Strict Validation - REMOVED BLOCKING
      // We still parse to check for basic sanity, but we DO NOT return early
      // unless it's a completely invalid character for the regex.

      // D. Last Character Check (General safety)
      // Allow letters, numbers, space, colon, dash.
      if (!/^[A-Za-z0-9\s:.-]*$/.test(transformedVal)) return;

      // Logic from Step 637 preserved (Inline Autocomplete)
      // We can still attempt autocomplete if we have matches, but we won't block if we don't.
      const parts = transformedVal.trimStart().split(/\s+/);
      const isIntroNum = /^[1-3]$/.test(parts[0]);

      let bookPart = parts[0];
      if (isIntroNum && parts.length > 1) {
        bookPart = `${parts[0]} ${parts[1]}`;
      } else if (isIntroNum && parts.length === 1) {
        bookPart = parts[0];
      }

      const cleanBookSearch = bookPart.toLowerCase();
      const matchingBooks = availableBooks.filter(
        (b) =>
          b.name.toLowerCase().startsWith(cleanBookSearch) ||
          b.id.toLowerCase().startsWith(cleanBookSearch) ||
          b.abbreviation?.toLowerCase().startsWith(cleanBookSearch),
      );

      if (transformedVal.length > oldVal.length) {
        const isBookTypingDone =
          (isIntroNum && parts.length > 2) || (!isIntroNum && parts.length > 1);
        if (!isBookTypingDone) {
          if (matchingBooks.length > 0) {
            const uniqueNames = new Set(matchingBooks.map((b) => b.name));
            if (uniqueNames.size === 1) {
              const matchedBookName = matchingBooks[0].name;
              const completedValue =
                matchedBookName + (transformedVal.endsWith(" ") ? " " : " ");
              if (completedValue.length > transformedVal.length) {
                setValue(completedValue);
                updateSuggestions(completedValue);
                return;
              }
            }
          }
        }
      }

      setValue(transformedVal);
      updateSuggestions(transformedVal);
    };

    // Expose the input ref to the parent
    useImperativeHandle(
      ref,
      () => internalInputRef.current as HTMLInputElement,
    );

    return (
      <div className={cn("relative", className)}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
          <Input
            ref={internalInputRef}
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
  },
);
