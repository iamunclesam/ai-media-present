export type SlideDraft = {
  text: string;
  label?: string; // Section label like "Verse 1", "Praise"
  modifier?: string; // Bottom modifier like "x3", "2x"
};

const labelRegex = /^\[(.+)\]$/;
const modifierRegex = /^\[(x\d+|\d+x)\]$/i; // Matches [x3], [2x], etc.

export function parseLyricsToSlides(raw: string): SlideDraft[] {
  const lines = raw.split(/\r?\n/);
  const slides: SlideDraft[] = [];
  let buffer: string[] = [];
  let currentLabel: string | undefined;
  let pendingModifier: string | undefined;

  const flush = () => {
    // Check if last line in buffer is a modifier
    let modifier: string | undefined;
    if (buffer.length > 0) {
      const lastLine = buffer[buffer.length - 1].trim();
      const modMatch = lastLine.match(modifierRegex);
      if (modMatch) {
        modifier = modMatch[1];
        buffer.pop(); // Remove modifier from buffer
      }
    }

    const trimmed = buffer
      .map((line) => line.trimEnd())
      .join("\n")
      .trim();

    if (trimmed.length > 0) {
      slides.push({
        text: trimmed,
        label: currentLabel,
        modifier: modifier ?? pendingModifier,
      });
      // Clear pending modifier after use (only applies to one slide)
      pendingModifier = undefined;
    }
    buffer = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // Check if it's a modifier on its own line (like [x3])
    const modMatch = trimmed.match(modifierRegex);
    if (modMatch) {
      // Add to buffer so flush() can handle it
      buffer.push(line);
      continue;
    }

    // Check if it's a section label (like [Verse 1])
    const labelMatch = trimmed.match(labelRegex);
    if (labelMatch) {
      flush();
      currentLabel = labelMatch[1]?.trim();
      // Capitalize first letter
      if (currentLabel) {
        currentLabel =
          currentLabel.charAt(0).toUpperCase() + currentLabel.slice(1);
      }
      continue;
    }

    // Empty line = new slide
    if (trimmed.length === 0) {
      flush();
      continue;
    }

    buffer.push(line);
  }

  flush();
  return slides;
}

// Format slide label for display: "1 Praise x3" or "2 Praise"
export function formatSlideLabel(
  index: number,
  label?: string,
  modifier?: string
): string {
  const parts = [(index + 1).toString()];
  if (label) parts.push(label);
  if (modifier) parts.push(modifier);
  return parts.join(" ");
}
