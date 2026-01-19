"use client";

import { ResizablePanel } from "@/components";
import { OutputPreview } from "@/features/slides";
import type { ComponentProps } from "react";

type Props = {
  outputPreviewProps: ComponentProps<typeof OutputPreview>;
};

export function PresentOutputSidebar({ outputPreviewProps }: Props) {
  return (
    <ResizablePanel defaultSize={20} minSize={12} maxSize={35}>
      <div className="h-full border-l border-border bg-card">
        <OutputPreview {...outputPreviewProps} />
      </div>
    </ResizablePanel>
  );
}
