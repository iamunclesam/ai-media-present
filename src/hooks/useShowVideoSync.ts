"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type MediaItem =
  | {
      id: string;
      name: string;
      type: "image" | "video";
      url: string;
    }
  | null;

type VideoSettings = {
  loop: boolean;
  muted: boolean;
};

export function useShowVideoSync(params: {
  showViewMedia: MediaItem;
  activeMediaItem: MediaItem;
  videoSettings: VideoSettings;

  // ✅ controlled from Home
  shouldAutoPlay: boolean;
  onAutoPlayConsumed: () => void;
}) {
  const {
    showViewMedia,
    activeMediaItem,
    videoSettings,
    shouldAutoPlay,
    onAutoPlayConsumed,
  } = params;

  const showVideoRef = useRef<HTMLVideoElement>(null);
  const isProgrammaticPlayRef = useRef(false);

  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);

  // Reset video state & handle autoplay when OUTPUT media changes
  const prevMediaIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const currentId = activeMediaItem?.id;

    if (currentId !== prevMediaIdRef.current) {
      setVideoCurrentTime(0);

      // Autoplay if requested and output is video
      if (shouldAutoPlay && activeMediaItem?.type === "video") {
        setIsVideoPlaying(true);
        onAutoPlayConsumed();
      } else if (prevMediaIdRef.current !== undefined) {
        // only reset playing when switching (not first load)
        setIsVideoPlaying(false);
      }

      prevMediaIdRef.current = currentId;
    }
  }, [activeMediaItem?.id, activeMediaItem?.type, shouldAutoPlay, onAutoPlayConsumed]);

  // Sync Show view video element with isVideoPlaying
  useEffect(() => {
    if (showVideoRef.current && showViewMedia?.type === "video") {
      isProgrammaticPlayRef.current = true;

      if (isVideoPlaying) {
        showVideoRef.current.play().catch(() => {
          // autoplay may be blocked
          isProgrammaticPlayRef.current = false;
        });
      } else {
        showVideoRef.current.pause();
      }

      setTimeout(() => {
        isProgrammaticPlayRef.current = false;
      }, 100);
    }
  }, [isVideoPlaying, showViewMedia?.type]);

  const handleVideoPlay = useCallback(() => {
    if (!isProgrammaticPlayRef.current) setIsVideoPlaying(true);
  }, []);

  const handleVideoPause = useCallback(() => {
    if (!isProgrammaticPlayRef.current) setIsVideoPlaying(false);
  }, []);

  const handleVideoEnded = useCallback(() => {
    setIsVideoPlaying(false);
  }, []);

  const handleVideoSeeked = useCallback(
    (e: React.SyntheticEvent<HTMLVideoElement>) => {
      setVideoCurrentTime(e.currentTarget.currentTime);
    },
    []
  );

  return {
    showVideoRef,
    isVideoPlaying,
    videoCurrentTime,

    handleVideoPlay,
    handleVideoPause,
    handleVideoEnded,
    handleVideoSeeked,
  };
}
