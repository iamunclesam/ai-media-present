"use client";

import { useState, memo } from "react";
import type { Id } from "@/../convex/_generated/dataModel";
import type { Service, Song } from "@/types";
import { Dialog } from "@/components/ui/Dialog";
import { cn } from "@/lib/utils";

interface ServiceItem {
  type: "song" | "media" | "scripture";
  refId: string;
  label?: string;
  addedAt: number;
  song: Song | null | undefined;
  index: number;
}

interface ServicesSidebarProps {
  services: Service[];
  selectedServiceId: Id<"services"> | null;
  isInsideService: boolean;
  selectedService: Service | null;
  serviceItems: ServiceItem[];
  serviceItemIndex: number | null;
  onEnterService: (id: Id<"services">) => void;
  onExitService: () => void;
  onSelectServiceItem: (index: number) => void;
  onRemoveFromService: (index: number) => void;
  onCreateService: (name: string) => Promise<unknown>;
  onRenameService: (id: Id<"services">, name: string) => Promise<void>;
  onDeleteService: (id: Id<"services">) => Promise<void>;
}

export const ServicesSidebar = memo(function ServicesSidebar({
  services,
  selectedServiceId,
  isInsideService,
  selectedService,
  serviceItems,
  serviceItemIndex,
  onEnterService,
  onExitService,
  onSelectServiceItem,
  onRemoveFromService,
  onCreateService,
  onRenameService,
  onDeleteService,
}: ServicesSidebarProps) {
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newName, setNewName] = useState("");
  const [renameTarget, setRenameTarget] = useState<{ id: Id<"services">; name: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: Id<"services">; name: string } | null>(null);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await onCreateService(newName.trim());
    setNewName("");
    setShowNewDialog(false);
  };

  const handleRename = async () => {
    if (!renameTarget || !renameTarget.name.trim()) return;
    await onRenameService(renameTarget.id, renameTarget.name.trim());
    setRenameTarget(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await onDeleteService(deleteTarget.id);
    setDeleteTarget(null);
  };

  return (
    <aside className="flex w-52 shrink-0 flex-col border-r border-border bg-card">
      <div className="border-b border-border px-3 py-2 flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {isInsideService && selectedService ? selectedService.name : "Services"}
        </p>
        {isInsideService && (
          <button
            type="button"
            onClick={onExitService}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            ← Back
          </button>
        )}
      </div>

      <div className="flex-1 overflow-hidden p-2">
        {isInsideService && selectedService ? (
          <ServiceItemsList
            items={serviceItems}
            selectedIndex={serviceItemIndex}
            onSelect={onSelectServiceItem}
            onRemove={onRemoveFromService}
          />
        ) : (
          <ServiceList
            services={services}
            selectedId={selectedServiceId}
            onEnter={onEnterService}
            onRename={(id, name) => setRenameTarget({ id, name })}
            onDelete={(id, name) => setDeleteTarget({ id, name })}
          />
        )}
      </div>

      {!isInsideService && (
        <div className="border-t border-border p-2">
          <button
            type="button"
            onClick={() => setShowNewDialog(true)}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-border py-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground transition hover:border-primary hover:text-primary"
          >
            + New service
          </button>
        </div>
      )}

      {/* New Service Dialog */}
      {showNewDialog && (
        <Dialog title="New service" onClose={() => setShowNewDialog(false)}>
          <div className="space-y-3">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Service name"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowNewDialog(false)}
                className="flex-1 rounded-md border border-input py-2 text-xs font-medium text-foreground hover:bg-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreate}
                className="flex-1 rounded-md bg-primary py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Create
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Rename Dialog */}
      {renameTarget && (
        <Dialog title="Rename service" onClose={() => setRenameTarget(null)}>
          <div className="space-y-3">
            <input
              value={renameTarget.name}
              onChange={(e) => setRenameTarget({ ...renameTarget, name: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleRename()}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRenameTarget(null)}
                className="flex-1 rounded-md border border-input py-2 text-xs font-medium text-foreground hover:bg-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRename}
                className="flex-1 rounded-md bg-primary py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Save
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Delete Dialog */}
      {deleteTarget && (
        <Dialog title="Delete service" onClose={() => setDeleteTarget(null)}>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete "{deleteTarget.name}"?
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="flex-1 rounded-md border border-input py-2 text-xs font-medium text-foreground hover:bg-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="flex-1 rounded-md bg-destructive py-2 text-xs font-semibold text-white hover:bg-destructive/90"
              >
                Delete
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </aside>
  );
});

// Sub-components
const ServiceList = memo(function ServiceList({
  services,
  selectedId,
  onEnter,
  onRename,
  onDelete,
}: {
  services: Service[];
  selectedId: Id<"services"> | null;
  onEnter: (id: Id<"services">) => void;
  onRename: (id: Id<"services">, name: string) => void;
  onDelete: (id: Id<"services">, name: string) => void;
}) {
  return (
    <div className="space-y-1">
      {services.map((service) => (
        <div
          key={service._id}
          className={cn(
            "group flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition",
            selectedId === service._id
              ? "bg-primary/20 text-primary"
              : "text-foreground hover:bg-secondary"
          )}
        >
          <button
            type="button"
            onClick={() => onEnter(service._id)}
            className="flex flex-1 items-center gap-2 text-left"
          >
            <FolderIcon />
            <span className="flex-1 truncate">{service.name}</span>
            <span className="text-[10px] text-muted-foreground">
              {service.items.length}
            </span>
          </button>
          <button
            type="button"
            aria-label="Rename service"
            onClick={() => onRename(service._id, service.name)}
            className="text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100"
          >
            <EditIcon />
          </button>
          <button
            type="button"
            aria-label="Delete service"
            onClick={() => onDelete(service._id, service.name)}
            className="text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
          >
            <TrashIcon />
          </button>
        </div>
      ))}
    </div>
  );
});

const ServiceItemsList = memo(function ServiceItemsList({
  items,
  selectedIndex,
  onSelect,
  onRemove,
}: {
  items: ServiceItem[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  onRemove: (index: number) => void;
}) {
  if (items.length === 0) {
    return (
      <p className="text-[10px] text-muted-foreground px-2">
        No items. Add songs from Shows tab.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {items.map((item) => (
        <div
          key={`${item.refId}-${item.index}`}
          className={cn(
            "group flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition",
            selectedIndex === item.index
              ? "bg-primary/20 text-primary"
              : "text-foreground hover:bg-secondary"
          )}
        >
          <button
            type="button"
            onClick={() => onSelect(item.index)}
            className="flex flex-1 items-center gap-2 text-left"
          >
            <span className="text-[10px] text-muted-foreground w-4">
              {item.index + 1}
            </span>
            <span className="flex-1 truncate">
              {item.song?.title ?? item.refId}
            </span>
          </button>
          <button
            type="button"
            aria-label="Remove from service"
            onClick={() => onRemove(item.index)}
            className="text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
          >
            <CloseIcon />
          </button>
        </div>
      ))}
    </div>
  );
});

// Icons
function FolderIcon() {
  return (
    <svg
      aria-hidden="true"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg
      aria-hidden="true"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M12 20h9M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      aria-hidden="true"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}
