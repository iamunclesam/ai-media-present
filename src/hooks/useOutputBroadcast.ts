"use client";

import { useEffect, useRef } from "react";
import { blobUrlToDataUrl } from "@/features/media/hooks";

type MediaItem =
  | {
      id: string;
      name: string;
      type: "image" | "video";
      url: string; // blob url in main app
    }
  | null
  | undefined;

type VideoSettings = {
  loop: boolean;
  muted: boolean;
};

type Params = {
  activeMediaItem: MediaItem;
  showText: boolean;
  showMedia: boolean;

  videoSettings: VideoSettings;
  mediaFilterCSS: string;

  isVideoPlaying: boolean;
  videoCurrentTime: number;
};

export function useOutputBroadcast({
  activeMediaItem,
  showText,
  showMedia,
  videoSettings,
  mediaFilterCSS,
  isVideoPlaying,
  videoCurrentTime,
}: Params) {
  const mediaCacheRef = useRef<{ id: string; dataUrl: string } | null>(null);

  // 1. Handle full media updates (expensive - only when ID changes)
  useEffect(() => {
    const channel = new BroadcastChannel("present-output");
    let isCancelled = false;

    async function sendMediaUpdate() {
      let mediaData: null | {
        id: string;
        name: string;
        type: "image" | "video";
        url: string; // data url
      } = null;

      if (activeMediaItem) {
        // Use cache if it's the same item
        if (mediaCacheRef.current?.id === activeMediaItem.id) {
          mediaData = {
            id: activeMediaItem.id,
            name: activeMediaItem.name,
            type: activeMediaItem.type,
            url: mediaCacheRef.current.dataUrl,
          };
        } else {
          try {
            const dataUrl = await blobUrlToDataUrl(activeMediaItem.url);
            mediaCacheRef.current = { id: activeMediaItem.id, dataUrl };
            mediaData = {
              id: activeMediaItem.id,
              name: activeMediaItem.name,
              type: activeMediaItem.type,
              url: dataUrl,
            };
          } catch (e) {
            console.error("Failed to convert blob to data URL", e);
          }
        }
      } else {
        mediaCacheRef.current = null;
      }

      if (!isCancelled) {
        channel.postMessage({
          type: "media-update",
          mediaItem: mediaData,
          showText,
          showMedia,
          videoSettings,
          mediaFilterCSS,
          isVideoPlaying,
          videoCurrentTime,
        });
      }
    }

    sendMediaUpdate();

    return () => {
      isCancelled = true;
      channel.close();
    };
  }, [activeMediaItem?.id, showText, showMedia, videoSettings, mediaFilterCSS]);

  // 2. Handle lightweight state updates (play/pause/time sync)
  useEffect(() => {
    const channel = new BroadcastChannel("present-output");

    channel.postMessage({
      type: "playback-sync",
      isVideoPlaying,
      videoCurrentTime,
    });

    return () => {
      channel.close();
    };
  }, [isVideoPlaying, videoCurrentTime]);
}
