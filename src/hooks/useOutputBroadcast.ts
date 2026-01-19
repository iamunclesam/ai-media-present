"use client";

import { useEffect } from "react";
import { blobUrlToDataUrl } from "@/hooks/useMediaFolders";

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
        // Convert blob URL to data URL so it works in another window
        const dataUrl = await blobUrlToDataUrl(activeMediaItem.url);
        mediaData = {
          id: activeMediaItem.id,
          name: activeMediaItem.name,
          type: activeMediaItem.type,
          url: dataUrl,
        };
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
  }, [
    activeMediaItem,
    showText,
    showMedia,
    videoSettings,
    mediaFilterCSS,
    isVideoPlaying,
    videoCurrentTime,
  ]);
}
