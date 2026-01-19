"use client";

import { memo, useRef, useEffect, useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

interface AutoFitTextProps {
  text: string;
  className?: string;
  style?: CSSProperties;
  minScale?: number;
}

/**
 * Auto-fit text component that scales text down to fit container
 * without changing the actual font size setting.
 */
export const AutoFitText = memo(function AutoFitText({
  text,
  className,
  style,
  minScale = 0.4,
}: AutoFitTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const container = containerRef.current;
    const textEl = textRef.current;
    if (!container || !textEl) return;

    // Reset scale to measure natural size
    setScale(1);

    // Use requestAnimationFrame to ensure DOM has updated
    const frameId = requestAnimationFrame(() => {
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      const textWidth = textEl.scrollWidth;
      const textHeight = textEl.scrollHeight;

      if (textWidth === 0 || textHeight === 0) return;

      // Calculate scale needed to fit
      const scaleX = containerWidth / textWidth;
      const scaleY = containerHeight / textHeight;
      const newScale = Math.min(scaleX, scaleY, 1); // Never scale up, only down

      // Clamp to reasonable minimum
      setScale(Math.max(newScale, minScale));
    });

    return () => cancelAnimationFrame(frameId);
  }, [text, minScale, style]);

  return (
    <div
      ref={containerRef}
      className="flex h-full w-full items-center justify-center overflow-hidden"
    >
      <p
        ref={textRef}
        className={cn("whitespace-pre-line text-center", className)}
        style={{
          ...style,
          transform: `scale(${scale})`,
          transformOrigin: "center",
        }}
      >
        {text}
      </p>
    </div>
  );
});
