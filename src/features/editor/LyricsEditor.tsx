"use client";

import { memo, useState, useCallback } from "react";
import type { Song } from "@/types";
import { FontToolbar } from "./FontToolbar";

interface LyricsEditorProps {
  song: Song;
  fontFamily: string;
  fontSize: number;
  fontBold: boolean;
  fontItalic: boolean;
  fontUnderline: boolean;
  onSave: (title: string, lyrics: string) => Promise<void>;
  onFixLyrics: (lyrics: string) => Promise<string>;
  onFontStyleChange: (styles: {
    fontFamily?: string;
    fontSize?: number;
    fontBold?: boolean;
    fontItalic?: boolean;
    fontUnderline?: boolean;
  }) => void;
}

export const LyricsEditor = memo(function LyricsEditor({
  song,
  fontFamily,
  fontSize,
  fontBold,
  fontItalic,
  fontUnderline,
  onSave,
  onFixLyrics,
  onFontStyleChange,
}: LyricsEditorProps) {
  const [editTitle, setEditTitle] = useState(song.title);
  const [editLyrics, setEditLyrics] = useState(song.lyrics);
  const [isSaving, setIsSaving] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Reset state when song changes
  useState(() => {
    setEditTitle(song.title);
    setEditLyrics(song.lyrics);
    setError(null);
    setMessage(null);
  });

  const handleSave = useCallback(async () => {
    if (!editTitle.trim()) {
      setError("Title is required");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await onSave(editTitle.trim(), editLyrics);
      setMessage("Saved successfully");
      setTimeout(() => setMessage(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  }, [editTitle, editLyrics, onSave]);

  const handleFix = useCallback(async () => {
    if (!editLyrics.trim()) return;
    setIsFixing(true);
    setError(null);
    try {
      const fixed = await onFixLyrics(editLyrics);
      setEditLyrics(fixed);
      setMessage("Lyrics cleaned up");
      setTimeout(() => setMessage(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fix lyrics");
    } finally {
      setIsFixing(false);
    }
  }, [editLyrics, onFixLyrics]);

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Title and actions */}
      <div className="flex items-center gap-3">
        <input
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          className="flex-1 rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="Song title"
        />
        <button
          type="button"
          onClick={handleFix}
          disabled={isFixing}
          className="rounded-md border border-input px-4 py-2 text-xs font-medium text-foreground transition hover:bg-secondary disabled:opacity-50"
        >
          {isFixing ? "Fixing..." : "Fix lyrics"}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Save"}{" "}
          <span className="text-[10px] opacity-60">⌘S</span>
        </button>
      </div>

      {/* Font toolbar */}
      <FontToolbar
        fontFamily={fontFamily}
        fontSize={fontSize}
        fontBold={fontBold}
        fontItalic={fontItalic}
        fontUnderline={fontUnderline}
        onFontFamilyChange={(f) => onFontStyleChange({ fontFamily: f })}
        onFontSizeChange={(s) => onFontStyleChange({ fontSize: s })}
        onBoldToggle={() => onFontStyleChange({ fontBold: !fontBold })}
        onItalicToggle={() => onFontStyleChange({ fontItalic: !fontItalic })}
        onUnderlineToggle={() => onFontStyleChange({ fontUnderline: !fontUnderline })}
      />

      {/* Error/success messages */}
      {error && <p className="text-xs text-destructive">{error}</p>}
      {message && <p className="text-xs text-green-400">{message}</p>}

      {/* Lyrics textarea */}
      <textarea
        value={editLyrics}
        onChange={(e) => setEditLyrics(e.target.value)}
        className="flex-1 resize-none rounded-md border border-input bg-card p-4 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        placeholder="[Verse 1]&#10;Line 1&#10;Line 2&#10;&#10;[Chorus]&#10;Line 1"
      />
    </div>
  );
});
