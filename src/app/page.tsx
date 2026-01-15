"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
  useAuth,
} from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import type { Id } from "@/../convex/_generated/dataModel";
import { api } from "@/../convex/_generated/api";
import { parseLyricsToSlides, formatSlideLabel } from "@/lib/lyrics";
import { cn } from "@/lib/utils";

type SlideRef = {
  songId: Id<"songs">;
  index: number;
};

type ViewMode = "show" | "edit";
type BottomTab = "shows" | "media" | "scripture";

const LABEL_COLORS: Record<string, string> = {
  verse: "bg-blue-500",
  chorus: "bg-primary",
  bridge: "bg-purple-500",
  intro: "bg-green-500",
  outro: "bg-orange-500",
  tag: "bg-yellow-500",
  "pre-chorus": "bg-cyan-500",
  default: "bg-muted-foreground",
};

function getLabelColor(label?: string) {
  if (!label) return LABEL_COLORS.default;
  const lower = label.toLowerCase();
  for (const key of Object.keys(LABEL_COLORS)) {
    if (lower.includes(key)) return LABEL_COLORS[key];
  }
  return LABEL_COLORS.default;
}

export default function Home() {
  const { isSignedIn } = useAuth();
  const ensureCurrent = useMutation(api.users.ensureCurrent);
  const current = useQuery(api.users.getCurrentWithOrg);
  const [orgId, setOrgId] = useState<Id<"organizations"> | null>(null);

  // Categories
  const categories = useQuery(
    api.categories.listByOrg,
    orgId ?? current?.org ? { orgId: orgId ?? current!.org._id } : "skip"
  );
  const ensureDefaultCategories = useMutation(api.categories.ensureDefaults);
  const createCategory = useMutation(api.categories.create);
  const removeCategory = useMutation(api.categories.remove);
  const renameCategory = useMutation(api.categories.update);

  // Songs
  const songs = useQuery(
    api.songs.listByOrg,
    orgId ?? current?.org ? { orgId: orgId ?? current!.org._id } : "skip"
  );
  const createSong = useMutation(api.songs.create);
  const updateSong = useMutation(api.songs.update);
  const removeSong = useMutation(api.songs.remove);

  // Services
  const services = useQuery(
    api.services.listByOrg,
    orgId ?? current?.org ? { orgId: orgId ?? current!.org._id } : "skip"
  );
  const createService = useMutation(api.services.create);
  const renameService = useMutation(api.services.rename);
  const removeService = useMutation(api.services.remove);
  const addItemToService = useMutation(api.services.addItem);
  const removeItemFromService = useMutation(api.services.removeItem);

  // Playback
  const playback = useQuery(
    api.playback.getByOrg,
    orgId ?? current?.org ? { orgId: orgId ?? current!.org._id } : "skip"
  );
  const setActiveSlide = useMutation(api.playback.setActiveSlide);

  // UI State
  const [title, setTitle] = useState("");
  const [lyrics, setLyrics] = useState("");
  const [selected, setSelected] = useState<SlideRef | null>(null);
  const [selectedSongId, setSelectedSongId] = useState<Id<"songs"> | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<Id<"services"> | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<Id<"categories"> | null>(null);
  const [isInsideService, setIsInsideService] = useState(false);
  const [serviceItemIndex, setServiceItemIndex] = useState<number | null>(null);
  const [isFixing, setIsFixing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("show");
  const [bottomTab, setBottomTab] = useState<BottomTab>("shows");
  const [editLyrics, setEditLyrics] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [newServiceName, setNewServiceName] = useState("");
  const [showNewServiceDialog, setShowNewServiceDialog] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showNewCategoryDialog, setShowNewCategoryDialog] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{ type: "service" | "category" | "song"; id: string; name: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "service" | "category" | "song"; id: string; name: string } | null>(null);
  const onboardingRef = useRef(false);

  // Onboarding
  useEffect(() => {
    if (!isSignedIn || onboardingRef.current) return;
    if (current === null) {
      onboardingRef.current = true;
      void ensureCurrent()
        .then((result) => {
          setAuthError(null);
          setOrgId(result.orgId);
        })
        .catch(() => {
          setAuthError("Convex auth is not configured. Check CLERK_JWT_ISSUER_DOMAIN.");
        })
        .finally(() => {
          onboardingRef.current = false;
        });
    }
  }, [current, ensureCurrent, isSignedIn]);

  useEffect(() => {
    if (current?.org) {
      setOrgId(current.org._id);
    }
  }, [current?.org]);

  // Ensure default categories
  useEffect(() => {
    if (!current?.org || categories === undefined) return;
    if (categories.length === 0) {
      void ensureDefaultCategories({ orgId: current.org._id });
    }
  }, [current?.org, categories, ensureDefaultCategories]);

  const selectedSong = useMemo(() => {
    if (!songs || !selectedSongId) return null;
    return songs.find((s) => s._id === selectedSongId) ?? null;
  }, [songs, selectedSongId]);

  const selectedService = useMemo(() => {
    if (!services || !selectedServiceId) return null;
    return services.find((s) => s._id === selectedServiceId) ?? null;
  }, [services, selectedServiceId]);

  // Sync edit fields when song changes
  useEffect(() => {
    if (selectedSong) {
      setEditLyrics(selectedSong.lyrics);
      setEditTitle(selectedSong.title);
    }
  }, [selectedSong]);

  const activeSlide = useMemo(() => {
    if (!playback?.activeSlideId || !songs) return null;
    const [songId, indexString] = playback.activeSlideId.split(":");
    const song = songs.find((item) => item._id === (songId as Id<"songs">));
    if (!song) return null;
    const index = Number(indexString);
    return { song, slide: song.slides[index], index };
  }, [playback?.activeSlideId, songs]);

  // Filter songs by category
  const filteredSongs = useMemo(() => {
    if (!songs) return [];
    if (!selectedCategoryId) return songs;
    return songs.filter((s) => s.categoryId === selectedCategoryId);
  }, [songs, selectedCategoryId]);

  // Service items with resolved songs
  const serviceItems = useMemo(() => {
    if (!selectedService || !songs) return [];
    return selectedService.items.map((item, index) => {
      if (item.type === "song") {
        const song = songs.find((s) => s._id === item.refId);
        return { ...item, song, index };
      }
      return { ...item, song: null, index };
    });
  }, [selectedService, songs]);

  // Slides for the grid
  const slidesForGrid = useMemo(() => {
    if (!selectedSong) return [];
    return selectedSong.slides.map((slide, index) => ({
      song: selectedSong,
      slide,
      index,
    }));
  }, [selectedSong]);

  // Groups for sidebar
  const slideGroups = useMemo(() => {
    if (!selectedSong) return [];
    const groups: { label: string; count: number }[] = [];
    for (const slide of selectedSong.slides) {
      const label = slide.label ?? "Unlabeled";
      const existing = groups.find((g) => g.label === label);
      if (existing) existing.count++;
      else groups.push({ label, count: 1 });
    }
    return groups;
  }, [selectedSong]);

  // Handlers
  const handleCreateSong = async () => {
    if (!title.trim() || !lyrics.trim()) return;
    let orgIdLocal = current?.org?._id;
    if (!orgIdLocal) {
      if (!isSignedIn) {
        setAuthError("Sign in to create songs.");
        return;
      }
      try {
        const result = await ensureCurrent();
        orgIdLocal = result.orgId;
        setOrgId(orgIdLocal);
        setAuthError(null);
      } catch {
        setAuthError("Convex auth is not configured. Check CLERK_JWT_ISSUER_DOMAIN.");
        return;
      }
    }
    setActionError(null);
    setActionMessage(null);
    try {
      const slides = parseLyricsToSlides(lyrics);
      await createSong({
        orgId: orgIdLocal,
        categoryId: selectedCategoryId ?? undefined,
        title: title.trim(),
        lyrics: lyrics.trim(),
        slides: slides.map((slide) => ({ text: slide.text, label: slide.label, modifier: slide.modifier })),
      });
      setTitle("");
      setLyrics("");
      setActionMessage("Song created.");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to create song.");
    }
  };

  const handleSaveSong = useCallback(async () => {
    if (!selectedSongId || !editLyrics.trim()) return;
    setIsSaving(true);
    setActionError(null);
    try {
      const slides = parseLyricsToSlides(editLyrics);
      await updateSong({
        songId: selectedSongId,
        title: editTitle.trim() || undefined,
        lyrics: editLyrics.trim(),
        slides: slides.map((slide) => ({ text: slide.text, label: slide.label, modifier: slide.modifier })),
      });
      setActionMessage("Song saved.");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to save song.");
    } finally {
      setIsSaving(false);
    }
  }, [selectedSongId, editLyrics, editTitle, updateSong]);

  const handleFixLyrics = async () => {
    if (!lyrics.trim()) return;
    setIsFixing(true);
    setActionError(null);
    setActionMessage(null);
    try {
      const response = await fetch("/api/lyrics/fix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lyrics }),
      });
      const result = (await response.json()) as { cleanedLyrics: string; notes?: string };
      if (!response.ok) {
        setActionError(result.notes ?? "AI Gateway request failed.");
        return;
      }
      setLyrics(result.cleanedLyrics);
      if (result.notes) setActionMessage(result.notes);
    } catch {
      setActionError("Failed to reach AI Gateway.");
    } finally {
      setIsFixing(false);
    }
  };

  const handleFixEditLyrics = async () => {
    if (!editLyrics.trim()) return;
    setIsFixing(true);
    setActionError(null);
    try {
      const response = await fetch("/api/lyrics/fix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lyrics: editLyrics }),
      });
      const result = (await response.json()) as { cleanedLyrics: string; notes?: string };
      if (!response.ok) {
        setActionError(result.notes ?? "AI Gateway request failed.");
        return;
      }
      setEditLyrics(result.cleanedLyrics);
      if (result.notes) setActionMessage(result.notes);
    } catch {
      setActionError("Failed to reach AI Gateway.");
    } finally {
      setIsFixing(false);
    }
  };

  const handleSelectSlide = useCallback(async (songId: Id<"songs">, index: number, slideText: string) => {
    if (!current?.org) return;
    setSelected({ songId, index });
    const payload = `${songId}:${index}`;
    await setActiveSlide({ orgId: current.org._id, activeSlideId: payload });
    if (typeof window !== "undefined") {
      const channel = new BroadcastChannel("present-output");
      channel.postMessage({ type: "active-slide", orgId: current.org._id, slideId: payload, slideText });
      channel.close();
    }
  }, [current?.org, setActiveSlide]);

  const handleCreateService = async () => {
    if (!newServiceName.trim() || !current?.org) return;
    try {
      await createService({ orgId: current.org._id, name: newServiceName.trim() });
      setNewServiceName("");
      setShowNewServiceDialog(false);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to create service.");
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim() || !current?.org) return;
    try {
      await createCategory({ orgId: current.org._id, name: newCategoryName.trim() });
      setNewCategoryName("");
      setShowNewCategoryDialog(false);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to create category.");
    }
  };

  const handleAddToService = async (songId: Id<"songs">) => {
    if (!selectedServiceId) return;
    try {
      await addItemToService({ serviceId: selectedServiceId, type: "song", refId: songId });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to add to service.");
    }
  };

  const handleRemoveFromService = async (index: number) => {
    if (!selectedServiceId) return;
    try {
      await removeItemFromService({ serviceId: selectedServiceId, itemIndex: index });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to remove from service.");
    }
  };

  const handleRename = async () => {
    if (!renameTarget) return;
    try {
      if (renameTarget.type === "service") {
        await renameService({ serviceId: renameTarget.id as Id<"services">, name: renameTarget.name });
      } else if (renameTarget.type === "category") {
        await renameCategory({ categoryId: renameTarget.id as Id<"categories">, name: renameTarget.name });
      } else if (renameTarget.type === "song") {
        await updateSong({ songId: renameTarget.id as Id<"songs">, title: renameTarget.name });
      }
      setRenameTarget(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to rename.");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.type === "service") {
        await removeService({ serviceId: deleteTarget.id as Id<"services"> });
        if (selectedServiceId === deleteTarget.id) {
          setSelectedServiceId(null);
          setIsInsideService(false);
        }
      } else if (deleteTarget.type === "category") {
        await removeCategory({ categoryId: deleteTarget.id as Id<"categories"> });
        if (selectedCategoryId === deleteTarget.id) setSelectedCategoryId(null);
      } else if (deleteTarget.type === "song") {
        await removeSong({ songId: deleteTarget.id as Id<"songs"> });
        if (selectedSongId === deleteTarget.id) setSelectedSongId(null);
      }
      setDeleteTarget(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to delete.");
    }
  };

  // Select service item and show its slides
  const handleSelectServiceItem = (index: number) => {
    const item = serviceItems[index];
    if (item?.song) {
      setServiceItemIndex(index);
      setSelectedSongId(item.song._id);
      setSelected({ songId: item.song._id, index: 0 });
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+S to save in edit mode
      if ((e.metaKey || e.ctrlKey) && e.key === "s" && viewMode === "edit" && selectedSongId) {
        e.preventDefault();
        void handleSaveSong();
        return;
      }

      // Arrow navigation in show mode
      if (viewMode === "show" && selectedSong && slidesForGrid.length > 0) {
        const currentIndex = selected?.index ?? 0;
        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          e.preventDefault();
          const nextIndex = Math.min(currentIndex + 1, slidesForGrid.length - 1);
          void handleSelectSlide(selectedSong._id, nextIndex, slidesForGrid[nextIndex].slide.text);
        } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          e.preventDefault();
          const prevIndex = Math.max(currentIndex - 1, 0);
          void handleSelectSlide(selectedSong._id, prevIndex, slidesForGrid[prevIndex].slide.text);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [viewMode, selectedSongId, selectedSong, slidesForGrid, selected, handleSaveSong, handleSelectSlide]);

  return (
    <div className="dark flex h-screen w-screen flex-col overflow-hidden bg-background font-sans text-foreground">
      {/* Header */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-card px-4">
        <span className="text-lg font-bold tracking-tight text-primary">Present</span>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setViewMode("show")} className={cn("flex items-center gap-2 rounded-md px-4 py-1.5 text-xs font-medium transition", viewMode === "show" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground")}>
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
            Show
          </button>
          <button type="button" onClick={() => setViewMode("edit")} className={cn("flex items-center gap-2 rounded-md px-4 py-1.5 text-xs font-medium transition", viewMode === "edit" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground")}>
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
            Edit
          </button>
          <button type="button" onClick={() => window.open("/stage-display", "present-stage", "width=1280,height=720")} className="flex items-center gap-2 rounded-md px-4 py-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground">
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></svg>
            Stage
          </button>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => window.open("/output", "present-output", "width=1280,height=720")} className="flex items-center gap-2 rounded-md bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90">
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></svg>
            Project
          </button>
          <AuthControls />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Left sidebar - Services */}
        <aside className="flex w-52 shrink-0 flex-col border-r border-border bg-card">
          <div className="border-b border-border px-3 py-2 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {isInsideService && selectedService ? selectedService.name : "Services"}
            </p>
            {isInsideService && (
              <button type="button" onClick={() => { setIsInsideService(false); setServiceItemIndex(null); }} className="text-xs text-muted-foreground hover:text-foreground">
                ← Back
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {isInsideService && selectedService ? (
              // Inside a service - show items
              <div className="space-y-1">
                {serviceItems.length > 0 ? serviceItems.map((item, idx) => (
                  <div key={idx} className={cn("group flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition cursor-pointer", serviceItemIndex === idx ? "bg-primary/20 text-primary" : "text-foreground hover:bg-secondary")} onClick={() => handleSelectServiceItem(idx)}>
                    <span className="text-[10px] text-muted-foreground w-4">{idx + 1}</span>
                    <span className="flex-1 truncate">{item.song?.title ?? item.refId}</span>
                    <button type="button" onClick={(e) => { e.stopPropagation(); handleRemoveFromService(idx); }} className="text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100">
                      <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" /></svg>
                    </button>
                  </div>
                )) : (
                  <p className="text-[10px] text-muted-foreground px-2">No items. Add songs from Shows tab.</p>
                )}
              </div>
            ) : (
              // Service list
              <div className="space-y-1">
                {services?.map((service) => (
                  <div key={service._id} className={cn("group flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition", selectedServiceId === service._id ? "bg-primary/20 text-primary" : "text-foreground hover:bg-secondary")}>
                    <button type="button" onClick={() => { setSelectedServiceId(service._id); setIsInsideService(true); setServiceItemIndex(null); }} className="flex flex-1 items-center gap-2 text-left">
                      <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" /></svg>
                      <span className="flex-1 truncate">{service.name}</span>
                      <span className="text-[10px] text-muted-foreground">{service.items.length}</span>
                    </button>
                    <button type="button" onClick={() => setRenameTarget({ type: "service", id: service._id, name: service.name })} className="text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100">
                      <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
                    </button>
                    <button type="button" onClick={() => setDeleteTarget({ type: "service", id: service._id, name: service.name })} className="text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100">
                      <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {!isInsideService && (
            <div className="border-t border-border p-2">
              <button type="button" onClick={() => setShowNewServiceDialog(true)} className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-border py-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground transition hover:border-primary hover:text-primary">
                + New service
              </button>
            </div>
          )}
        </aside>

        {/* Center content */}
        <main className="flex min-w-0 flex-1 flex-col bg-background">
          <div className="flex-1 overflow-auto p-4">
            {viewMode === "show" ? (
              selectedSong ? (
                <div className="grid grid-cols-6 gap-2">
                  {slidesForGrid.map(({ song, slide, index }) => {
                    const slideId = `${song._id}:${index}`;
                    const isActive = playback?.activeSlideId === slideId;
                    return (
                      <button key={slideId} type="button" onClick={() => handleSelectSlide(song._id, index, slide.text)} className={cn("relative flex aspect-video flex-col overflow-hidden rounded-lg border transition", isActive ? "border-primary ring-2 ring-primary/50" : "border-border hover:border-primary/50")}>
                        <div className="flex flex-1 items-center justify-center bg-card p-2">
                          <p className="line-clamp-4 whitespace-pre-line text-center text-[11px] leading-snug text-foreground">{slide.text}</p>
                        </div>
                        <div className={cn("px-2 py-1 text-[9px] font-semibold text-white text-center", getLabelColor(slide.label))}>
                          {formatSlideLabel(index, slide.label, slide.modifier)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Select a song from below to view slides
                </div>
              )
            ) : selectedSong ? (
              <div className="flex h-full flex-col gap-3">
                <div className="flex items-center gap-3">
                  <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="flex-1 rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" placeholder="Song title" />
                  <button type="button" onClick={handleFixEditLyrics} disabled={isFixing} className="rounded-md border border-input px-4 py-2 text-xs font-medium text-foreground transition hover:bg-secondary disabled:opacity-50">
                    {isFixing ? "Fixing..." : "Fix lyrics"}
                  </button>
                  <button type="button" onClick={handleSaveSong} disabled={isSaving} className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50">
                    {isSaving ? "Saving..." : "Save"} <span className="text-[10px] opacity-60">⌘S</span>
                  </button>
                </div>
                {actionError && <p className="text-xs text-destructive">{actionError}</p>}
                {actionMessage && <p className="text-xs text-green-400">{actionMessage}</p>}
                <textarea value={editLyrics} onChange={(e) => setEditLyrics(e.target.value)} className="flex-1 resize-none rounded-md border border-input bg-card p-4 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" placeholder="[Verse 1]&#10;Line 1&#10;Line 2&#10;&#10;[Chorus]&#10;Line 1" />
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Select a song to edit</div>
            )}
          </div>

          {/* Bottom tabs */}
          <div className="shrink-0 border-t border-border bg-card">
            <div className="flex items-center border-b border-border">
              <div className="flex items-center gap-1 px-2">
                {(["shows", "media", "scripture"] as BottomTab[]).map((tab) => (
                  <button key={tab} type="button" onClick={() => setBottomTab(tab)} className={cn("flex items-center gap-2 px-4 py-2 text-xs font-medium capitalize transition", bottomTab === tab ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground")}>
                    {tab}
                  </button>
                ))}
              </div>
              {bottomTab === "shows" && (
                <div className="ml-auto flex items-center gap-1 px-2 border-l border-border">
                  <p className="text-[10px] text-muted-foreground mr-2">Categories:</p>
                  <button type="button" onClick={() => setSelectedCategoryId(null)} className={cn("px-2 py-1 rounded text-[10px] transition", !selectedCategoryId ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground")}>All</button>
                  {categories?.map((cat) => (
                    <div key={cat._id} className="group relative">
                      <button type="button" onClick={() => setSelectedCategoryId(cat._id)} className={cn("px-2 py-1 rounded text-[10px] transition", selectedCategoryId === cat._id ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground")}>
                        {cat.name}
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={() => setShowNewCategoryDialog(true)} className="px-2 py-1 text-[10px] text-muted-foreground hover:text-primary">+</button>
                </div>
              )}
            </div>
            <div className="h-44 overflow-auto p-2">
              {bottomTab === "shows" && (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2">
                  {filteredSongs.map((song) => (
                    <div key={song._id} className={cn("group rounded-lg border px-3 py-2 text-left text-xs transition", selectedSongId === song._id ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground hover:border-primary/50")}>
                      <div className="flex items-start justify-between">
                        <button type="button" onClick={() => { setSelectedSongId(song._id); setSelected({ songId: song._id, index: 0 }); }} className="flex-1 text-left">
                          <div className="font-medium">{song.title}</div>
                          <div className="mt-1 text-muted-foreground">{song.slides.length} slides</div>
                        </button>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                          <button type="button" onClick={() => setRenameTarget({ type: "song", id: song._id, name: song.title })} className="text-muted-foreground hover:text-foreground p-1">
                            <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
                          </button>
                          <button type="button" onClick={() => setDeleteTarget({ type: "song", id: song._id, name: song.title })} className="text-muted-foreground hover:text-destructive p-1">
                            <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
                          </button>
                        </div>
                      </div>
                      {isInsideService && selectedServiceId && (
                        <button type="button" onClick={() => handleAddToService(song._id)} className="mt-2 flex w-full items-center justify-center gap-1 rounded-md border border-border py-1 text-[10px] text-muted-foreground transition hover:border-primary hover:text-primary">
                          + Add to service
                        </button>
                      )}
                    </div>
                  ))}
                  <NewSongDialog title={title} setTitle={setTitle} lyrics={lyrics} setLyrics={setLyrics} isFixing={isFixing} authError={authError} actionError={actionError} actionMessage={actionMessage} onCreate={handleCreateSong} onFix={handleFixLyrics} />
                </div>
              )}
              {bottomTab === "media" && <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Media library coming soon</div>}
              {bottomTab === "scripture" && <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Scripture search coming soon</div>}
            </div>
        </div>
      </main>

        {/* Right sidebar */}
        <aside className="flex w-56 shrink-0 flex-col border-l border-border bg-card">
          <div className="border-b border-border p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-primary" />
              <span className="text-[10px] font-medium text-muted-foreground">Main Output</span>
            </div>
            <div className="aspect-video rounded-lg border border-primary/50 bg-black flex items-center justify-center p-2">
              {activeSlide?.slide ? (
                <p className="whitespace-pre-line text-center text-[10px] leading-snug text-white font-medium">{activeSlide.slide.text}</p>
              ) : (
                <span className="text-[8px] text-zinc-500">No slide active</span>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-auto p-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Groups</p>
            <div className="space-y-1">
              {slideGroups.map((group) => (
                <div key={group.label} className="flex items-center justify-between rounded-md px-2 py-1 text-xs text-foreground hover:bg-secondary">
                  <span>{group.label}</span>
                  <span className="text-muted-foreground">{group.count}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {/* Dialogs */}
      {showNewServiceDialog && (
        <Dialog title="New Service" onClose={() => setShowNewServiceDialog(false)}>
          <input value={newServiceName} onChange={(e) => setNewServiceName(e.target.value)} placeholder="Service name" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none" onKeyDown={(e) => e.key === "Enter" && handleCreateService()} autoFocus />
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={() => setShowNewServiceDialog(false)} className="flex-1 rounded-md border border-input py-2 text-xs font-medium text-foreground hover:bg-secondary">Cancel</button>
            <button type="button" onClick={handleCreateService} className="flex-1 rounded-md bg-primary py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90">Create</button>
          </div>
        </Dialog>
      )}

      {showNewCategoryDialog && (
        <Dialog title="New Category" onClose={() => setShowNewCategoryDialog(false)}>
          <input value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="Category name" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none" onKeyDown={(e) => e.key === "Enter" && handleCreateCategory()} autoFocus />
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={() => setShowNewCategoryDialog(false)} className="flex-1 rounded-md border border-input py-2 text-xs font-medium text-foreground hover:bg-secondary">Cancel</button>
            <button type="button" onClick={handleCreateCategory} className="flex-1 rounded-md bg-primary py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90">Create</button>
          </div>
        </Dialog>
      )}

      {renameTarget && (
        <Dialog title={`Rename ${renameTarget.type}`} onClose={() => setRenameTarget(null)}>
          <input value={renameTarget.name} onChange={(e) => setRenameTarget({ ...renameTarget, name: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none" onKeyDown={(e) => e.key === "Enter" && handleRename()} autoFocus />
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={() => setRenameTarget(null)} className="flex-1 rounded-md border border-input py-2 text-xs font-medium text-foreground hover:bg-secondary">Cancel</button>
            <button type="button" onClick={handleRename} className="flex-1 rounded-md bg-primary py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90">Save</button>
          </div>
        </Dialog>
      )}

      {deleteTarget && (
        <Dialog title={`Delete ${deleteTarget.type}?`} onClose={() => setDeleteTarget(null)}>
          <p className="text-sm text-muted-foreground">Are you sure you want to delete &quot;{deleteTarget.name}&quot;? This cannot be undone.</p>
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={() => setDeleteTarget(null)} className="flex-1 rounded-md border border-input py-2 text-xs font-medium text-foreground hover:bg-secondary">Cancel</button>
            <button type="button" onClick={handleDelete} className="flex-1 rounded-md bg-destructive py-2 text-xs font-semibold text-white hover:bg-destructive/90">Delete</button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

function Dialog({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function AuthControls() {
  return (
    <>
      <SignedIn><UserButton appearance={{ elements: { userButtonAvatarBox: "h-7 w-7" } }} /></SignedIn>
      <SignedOut>
        <SignInButton mode="modal">
          <button type="button" className="rounded-md border border-input px-3 py-1 text-xs font-medium text-foreground transition hover:bg-secondary">Sign in</button>
        </SignInButton>
      </SignedOut>
    </>
  );
}

function NewSongDialog({ title, setTitle, lyrics, setLyrics, isFixing, authError, actionError, actionMessage, onCreate, onFix }: { title: string; setTitle: (v: string) => void; lyrics: string; setLyrics: (v: string) => void; isFixing: boolean; authError: string | null; actionError: string | null; actionMessage: string | null; onCreate: () => void; onFix: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-4 text-xs text-muted-foreground transition hover:border-primary hover:text-primary">
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
        New show
      </button>
      {open && (
        <Dialog title="New show" onClose={() => setOpen(false)}>
          <div className="space-y-3">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Song title" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none" />
            <textarea value={lyrics} onChange={(e) => setLyrics(e.target.value)} placeholder={"[Verse 1]\nLine 1\nLine 2\n\n[Chorus]\nLine 1"} rows={10} className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none" />
            {authError && <p className="text-xs text-destructive">{authError}</p>}
            {actionError && <p className="text-xs text-destructive">{actionError}</p>}
            {actionMessage && <p className="text-xs text-green-400">{actionMessage}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={onFix} disabled={isFixing} className="flex-1 rounded-md border border-input py-2 text-xs font-medium text-foreground hover:bg-secondary disabled:opacity-50">{isFixing ? "Fixing..." : "Fix lyrics"}</button>
              <button type="button" onClick={() => { onCreate(); if (title && lyrics) setOpen(false); }} className="flex-1 rounded-md bg-primary py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90">Create</button>
            </div>
          </div>
        </Dialog>
      )}
    </>
  );
}
