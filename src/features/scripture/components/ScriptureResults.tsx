"use client";

import { useState, useEffect } from "react";
import { useScripture } from "../hooks/useScripture";
import { generateBibleSlides, type SlideConfig } from "../lib/slides";
import { type ParsedReference } from "../lib/parser";
import { Button } from "@/components/ui/button";
import { Monitor, Plus, Settings2 } from "lucide-react";
import { type BibleVerse } from "../lib/db";

interface ScriptureResultsProps {
  parsedRef: ParsedReference;
  onSendToOutput: (slides: string[]) => void;
}

export function ScriptureResults({ parsedRef, onSendToOutput }: ScriptureResultsProps) {
  const { lookupRef } = useScripture();
  const [verses, setVerses] = useState<BibleVerse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const config: SlideConfig = {
    maxLines: 100, // Effectively ignored now
    maxCharsPerLine: 1000, // Effectively ignored now
    verseNumberMode: "inline",
  };

  useEffect(() => {
    async function fetchVerses() {
      if (parsedRef.book && parsedRef.chapter && parsedRef.errors.length === 0) {
        setIsLoading(true);
        const results = await lookupRef(parsedRef);
        setVerses(results);
        setIsLoading(false);
      } else {
        setVerses([]);
      }
    }
    fetchVerses();
  }, [parsedRef, lookupRef]);

  const handleSendVerse = (v: BibleVerse) => {
    const slides = generateBibleSlides([v], config);
    onSendToOutput(slides);
  };

  if (!parsedRef.book) return null;

  return (
    <div className="space-y-4 border rounded-lg p-4 bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border/40 pb-2">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">
          {parsedRef.book.name} {parsedRef.chapter}
          {parsedRef.verseStart && `:${parsedRef.verseStart}`}
          {parsedRef.verseEnd && `-${parsedRef.verseEnd}`}
          {parsedRef.versionCode && ` (${parsedRef.versionCode})`}
        </h3>
      </div>

      <div className="max-h-[300px] overflow-y-auto space-y-1 pr-2 custom-scrollbar">
        {isLoading ? (
          <p className="text-xs text-muted-foreground animate-pulse">Searching verses...</p>
        ) : verses.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No verses found.</p>
        ) : (
          verses.map((v) => (
            <button
              key={v.pk}
              onClick={() => handleSendVerse(v)}
              className="text-left w-full p-2 rounded hover:bg-accent transition-colors group relative"
            >
              <span className="font-bold text-[10px] mr-2 text-primary/60">
                {v.verse}
              </span>
              <span className="text-sm">{v.text}</span>
            </button>
          ))
        )}
      </div>

      {verses.length > 0 && (
        <div className="text-[10px] text-muted-foreground pt-2 flex justify-between border-t border-border/40">
          <span>{verses.length} verses found</span>
          <span className="italic">Click a verse to show live</span>
        </div>
      )}
    </div>
  );
}
