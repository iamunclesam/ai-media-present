import type { BibleVerse } from "./db";

export interface SlideConfig {
  maxLines: number;
  maxCharsPerLine: number;
  verseNumberMode: "inline" | "superscript" | "none";
}

export function generateBibleSlides(verses: BibleVerse[], config: SlideConfig): string[] {
  return verses.map(verse => {
    const versePrefix = config.verseNumberMode === "none" 
      ? "" 
      : `${verse.verse}. `;
    
    const versionSuffix = verse.version
      ? ` (${verse.version.toUpperCase()})`
      : "";

    return `${versePrefix}${verse.text}\n\n[${verse.bookName} ${verse.chapter}:${verse.verse}${versionSuffix}]`;
  });
}
