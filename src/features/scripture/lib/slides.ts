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
    
    return `${versePrefix}${verse.text}`;
  });
}
