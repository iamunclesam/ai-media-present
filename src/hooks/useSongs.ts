"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { parseLyricsToSlides } from "@/lib/lyrics";

export function useSongs(orgId: Id<"organizations"> | null) {
  const songs = useQuery(
    api.songs.listByOrg,
    orgId ? { orgId } : "skip"
  );
  const createSong = useMutation(api.songs.create);
  const updateSong = useMutation(api.songs.update);
  const removeSong = useMutation(api.songs.remove);

  const [selectedSongId, setSelectedSongId] = useState<Id<"songs"> | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<Id<"categories"> | null>(null);

  const selectedSong = useMemo(() => {
    if (!selectedSongId || !songs) return null;
    return songs.find((s) => s._id === selectedSongId) ?? null;
  }, [selectedSongId, songs]);

  const filteredSongs = useMemo(() => {
    if (!songs) return [];
    if (!selectedCategoryId) return songs;
    return songs.filter((s) => s.categoryId === selectedCategoryId);
  }, [songs, selectedCategoryId]);

  const createNewSong = async (
    title: string,
    lyrics: string,
    categoryId?: Id<"categories">
  ) => {
    if (!orgId || !title.trim()) return null;
    const slides = parseLyricsToSlides(lyrics);
    const id = await createSong({
      orgId,
      title: title.trim(),
      lyrics,
      slides,
      categoryId,
    });
    return id;
  };

  const updateExistingSong = async (
    songId: Id<"songs">,
    title: string,
    lyrics: string
  ) => {
    const slides = parseLyricsToSlides(lyrics);
    await updateSong({ songId, title, lyrics, slides });
  };

  const deleteSong = async (songId: Id<"songs">) => {
    await removeSong({ songId });
    if (selectedSongId === songId) {
      setSelectedSongId(null);
    }
  };

  return {
    songs: songs ?? [],
    filteredSongs,
    selectedSong,
    selectedSongId,
    selectedCategoryId,
    setSelectedSongId,
    setSelectedCategoryId,
    createNewSong,
    updateExistingSong,
    deleteSong,
  };
}
