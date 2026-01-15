"use client";

import { useCallback, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";

export function usePlayback(orgId: Id<"organizations"> | null) {
  const playback = useQuery(
    api.playback.getByOrg,
    orgId ? { orgId } : "skip"
  );
  const setActiveSlide = useMutation(api.playback.setActiveSlide);
  const setFontStyle = useMutation(api.playback.setFontStyle);
  const broadcastRef = useRef<BroadcastChannel | null>(null);

  // Lazy init broadcast channel
  const getBroadcast = useCallback(() => {
    if (!broadcastRef.current) {
      broadcastRef.current = new BroadcastChannel("present-output");
    }
    return broadcastRef.current;
  }, []);

  const selectSlide = useCallback(
    async (slideId: string, slideText?: string) => {
      if (!orgId) return;

      // Broadcast for instant local update
      getBroadcast().postMessage({
        type: "active-slide",
        orgId,
        slideId,
        slideText,
      });

      // Persist to database
      await setActiveSlide({ orgId, activeSlideId: slideId });
    },
    [orgId, setActiveSlide, getBroadcast]
  );

  const updateFontStyle = useCallback(
    async (styles: {
      fontFamily?: string;
      fontSize?: number;
      fontBold?: boolean;
      fontItalic?: boolean;
      fontUnderline?: boolean;
    }) => {
      if (!orgId) return;
      await setFontStyle({ orgId, ...styles });
    },
    [orgId, setFontStyle]
  );

  return {
    playback,
    activeSlideId: playback?.activeSlideId ?? null,
    fontFamily: playback?.fontFamily ?? "Inter",
    fontSize: playback?.fontSize ?? 72,
    fontBold: playback?.fontBold ?? false,
    fontItalic: playback?.fontItalic ?? false,
    fontUnderline: playback?.fontUnderline ?? false,
    selectSlide,
    updateFontStyle,
  };
}
