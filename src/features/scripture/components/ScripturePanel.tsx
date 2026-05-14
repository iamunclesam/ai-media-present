"use client";

import {
  useState,
  useCallback,
  memo,
  useEffect,
  useMemo,
  forwardRef,
  useRef,
  useImperativeHandle,
} from "react";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle
} from "@/components/ui/resizable";
import { ScriptureDownloader } from "./ScriptureDownloader";
import { ScriptureInput } from "./ScriptureInput";
import { ScriptureResults } from "./ScriptureResults";
import { ScriptureListener } from "./ScriptureListener";
import { findTopicReference } from "../lib/topic-map";
import { parseReference, type ParsedReference } from "../lib/parser";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../lib/db";
import { cn } from "@/lib/utils";
import { Id } from "@/../convex/_generated/dataModel";
import { useServices } from "@/features/services/hooks";
import { useScripture } from "../hooks/useScripture";
import { generateBibleSlides, type ScriptureSlide } from "../lib/slides";

interface ScripturePanelProps {
  onSendToOutput: (slides: ScriptureSlide[]) => void;
  orgId: Id<"organizations"> | null;
}

export interface ScripturePanelRef {
  focusSearch: () => void;
}

export const ScripturePanel = memo(
  forwardRef<ScripturePanelRef, ScripturePanelProps>(function ScripturePanel(
    { onSendToOutput, orgId },
    ref,
  ) {
    const inputRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => ({
      focusSearch: () => {
        inputRef.current?.focus();
      },
    }));

    const availableBooks = useLiveQuery(() => db.books.toArray()) ?? [];
    const availableVersions = useLiveQuery(() => db.versions.toArray()) ?? [];

    const { addScriptureToService, selectedServiceId } = useServices(orgId, []);

    const [selectedVersionCode, setSelectedVersionCode] = useState<
      string | null
    >(null);
    const [parsedRef, setParsedRef] = useState<ParsedReference>({
      book: null,
      chapter: null,
      verseStart: null,
      verseEnd: null,
      versionCode: null,
      errors: [],
    });

    useEffect(() => {
      // Auto-switch version tab if user types a valid version code
      if (parsedRef.versionCode) {
        const matched = availableVersions.find(
          (v) => v.code.toUpperCase() === parsedRef.versionCode?.toUpperCase(),
        );
        if (matched && matched.code !== selectedVersionCode) {
          setSelectedVersionCode(matched.code);
        }
      }
    }, [parsedRef.versionCode, availableVersions, selectedVersionCode]);

    useEffect(() => {
      if (!selectedVersionCode && availableVersions.length > 0) {
        const nkjv = availableVersions.find(
          (v) => v.code.toUpperCase() === "NKJV",
        );
        setSelectedVersionCode(nkjv ? nkjv.code : availableVersions[0].code);
      }
    }, [availableVersions, selectedVersionCode]);

    const handleRefChange = useCallback((ref: ParsedReference) => {
      setParsedRef(ref);
    }, []);

    const mergedRef = useMemo(
      () => ({
        ...parsedRef,
        versionCode: parsedRef.versionCode || selectedVersionCode,
      }),
      [parsedRef, selectedVersionCode],
    );

    const { lookupRef } = useScripture();

    const handleEnter = useCallback(
      async (val?: string) => {
        let activeParsed = parsedRef;
        // If explicit value provided (e.g. from autocomplete submission), parse it immediately
        // to avoid React state sync latency
        if (val) {
          activeParsed = parseReference(val, availableBooks);
        }

        // 1. Validate
        if (!activeParsed.book || !activeParsed.chapter) return;

        // 2. Construct Reference String with Version
        // Determine version: Input > Selected > Default
        const version =
          activeParsed.versionCode || selectedVersionCode || "NKJV";

        let ref = `${activeParsed.book.name} ${activeParsed.chapter}`;
        if (activeParsed.verseStart) {
          ref += `:${activeParsed.verseStart}`;
          if (activeParsed.verseEnd) {
            ref += `-${activeParsed.verseEnd}`;
          }
        }
        ref += ` ${version}`;

        // 3. Add to Service (if service selected)
        if (selectedServiceId) {
          await addScriptureToService(selectedServiceId, ref, ref);
        }

        // 4. Project to Output (Live)
        const verses = await lookupRef({
          ...activeParsed,
          versionCode: version,
        });

        if (verses.length > 0) {
          const slides = generateBibleSlides(verses, {
            verseNumberMode: "inline",
            maxLines: 40,
            maxCharsPerLine: 100,
            versionName: version,
          });
          onSendToOutput(slides);
        }
      },
      [
        parsedRef,
        selectedVersionCode,
        selectedServiceId,
        addScriptureToService,
        lookupRef,
        onSendToOutput,
        availableBooks,
      ],
    );

    return (
      <ResizablePanelGroup
        direction="horizontal"
        className="h-full"
        autoSaveId="present-scripture-layout"
      >
        {/* Downloader Sidebar */}
        <ResizablePanel defaultSize={25} minSize={20} maxSize={40}>
          <div className="h-full border-r border-border p-4 overflow-y-auto">
            <ScriptureDownloader />
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Search and Results */}
        <ResizablePanel defaultSize={75}>
          <div className="h-full flex flex-col overflow-hidden bg-background">
            {/* Top Bar with Search */}
            <div className="flex items-center justify-between border-b border-border/40 bg-card/30 backdrop-blur-sm px-6 py-2.5 shrink-0 gap-4">
              <div className="flex items-center gap-4 flex-1">
                <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/80 shrink-0">
                  Scripture
                </h2>

                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                  <ScriptureListener
                    onTranscript={(text) => {
                      console.log("🎤 Audio Transcript:", text);

                      // 1. Topic/Story Detection (Contextual)
                      const topicRef = findTopicReference(text);
                      if (topicRef) {
                        console.log("🧠 Detected Topic:", topicRef);
                        if (inputRef.current) {
                          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
                          nativeInputValueSetter?.call(inputRef.current, topicRef);
                          inputRef.current.dispatchEvent(new Event('input', { bubbles: true }));

                          // Auto-trigger search for topics as they are high confidence
                          handleEnter(topicRef);
                        }
                        return;
                      }

                      // 2. Direct Reference Detection (Regex)
                      // Matches: "1 John 3:16", "John 3 16", "Genesis 1", "2 Kings 5:10-12"
                      // Also handles "chapter" and "verse" words: "John chapter 3 verse 16"
                      // Handles "First", "Second", "Third" prefixes
                      // Handles "to" or "through" for ranges: "John 3 16 to 20"
                      const referenceRegex = /\b((?:(?:\d|First|Second|Third|1st|2nd|3rd)\s*)?[a-zA-Z]+)(?:\s+(?:chapter\s+)?)(\d+)(?:[:\s](?:verse\s+)?(\d+)(?:[-–\s]+(?:to|through)?\s*(\d+))?)?\b/i;
                      const match = text.match(referenceRegex);

                      if (match) {
                        let extractedRef = match[0];

                        // Normalize word prefixes to numbers
                        extractedRef = extractedRef
                          .replace(/^First\s/i, "1 ")
                          .replace(/^Second\s/i, "2 ")
                          .replace(/^Third\s/i, "3 ")
                          .replace(/^1st\s/i, "1 ")
                          .replace(/^2nd\s/i, "2 ")
                          .replace(/^3rd\s/i, "3 ");

                        // Normalize "to" / "through" to hyphen
                        extractedRef = extractedRef.replace(/\s+(?:to|through)\s+/gi, "-");

                        console.log("📖 Detected Reference:", extractedRef);

                        // Update input
                        if (inputRef.current) {
                          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
                          nativeInputValueSetter?.call(inputRef.current, extractedRef);
                          inputRef.current.dispatchEvent(new Event('input', { bubbles: true }));

                          // Optionally auto-submit if confident?
                          // For now just filling it is safer.
                        }
                      } else {
                        console.log("❌ No scripture reference detected in audio.");
                      }
                    }}
                  />
                  {availableVersions.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVersionCode(v.code)}
                      className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-bold transition-all border shrink-0",
                        selectedVersionCode === v.code
                          ? "bg-primary border-primary text-primary-foreground shadow-sm"
                          : "bg-background/40 border-border/60 text-muted-foreground hover:bg-accent/40",
                      )}
                    >
                      {v.code}
                    </button>
                  ))}
                </div>
              </div>

              <div className="w-72 shrink-0">
                <ScriptureInput
                  ref={inputRef}
                  onRefChange={handleRefChange}
                  availableBooks={availableBooks}
                  availableVersions={availableVersions}
                  placeholder={
                    selectedVersionCode
                      ? `Search ${selectedVersionCode}...`
                      : "Search Bible..."
                  }
                  onEnter={handleEnter}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              <ScriptureResults
                parsedRef={mergedRef}
                onSendToOutput={onSendToOutput}
                onAddToService={
                  selectedServiceId
                    ? (ref, text) =>
                      addScriptureToService(selectedServiceId, ref, text)
                    : undefined
                }
              />
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    );
  }),
);
