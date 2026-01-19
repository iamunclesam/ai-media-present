"use client";

import { useState, useCallback, memo, useEffect, useMemo } from "react";
import { 
  ResizablePanelGroup, 
  ResizablePanel, 
  ResizableHandle 
} from "@/components/ui/resizable";
import { ScriptureDownloader } from "./ScriptureDownloader";
import { ScriptureInput } from "./ScriptureInput";
import { ScriptureResults } from "./ScriptureResults";
import { type ParsedReference } from "../lib/parser";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../lib/db";
import { cn } from "@/lib/utils";
import { Id } from "@/../convex/_generated/dataModel";
import { useServices } from "@/features/services/hooks";

interface ScripturePanelProps {
  onSendToOutput: (slides: string[]) => void;
  orgId: Id<"organizations"> | null;
}

export const ScripturePanel = memo(function ScripturePanel({
  onSendToOutput,
  orgId,
}: ScripturePanelProps) {
  const availableBooks = useLiveQuery(() => db.books.toArray()) ?? [];
  const availableVersions = useLiveQuery(() => db.versions.toArray()) ?? [];

  const { addScriptureToService, selectedServiceId } = useServices(orgId, []);

  const [selectedVersionCode, setSelectedVersionCode] = useState<string | null>(
    null,
  );
  const [parsedRef, setParsedRef] = useState<ParsedReference>({
    book: null,
    chapter: null,
    verseStart: null,
    verseEnd: null,
    versionCode: null,
    errors: [],
  });

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
                onRefChange={handleRefChange}
                availableBooks={availableBooks}
                availableVersions={availableVersions}
                placeholder={
                  selectedVersionCode
                    ? `Search ${selectedVersionCode}...`
                    : "Search Bible..."
                }
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
});
