"use client";

import { useMemo, type ReactNode } from "react";
import {
  ChevronRight,
  FilePlus,
  FileText,
  Folder,
  FolderPlus,
  Pencil,
  Trash2,
} from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useWorkspaceStore } from "@/lib/store/use-workspace-store";
import { compareWorkspaceItems } from "@/lib/items";
import { useInlineName } from "@/hooks/use-inline-name";
import { ROOT_ITEM_ID } from "@/lib/db";
import type { WorkspaceItem } from "@/lib/types";
import { cn } from "@/lib/utils";

function InlineCardRenameInput({
  initialValue,
  onConfirm,
  onCancel,
  className,
}: {
  initialValue: string;
  onConfirm: (name: string) => void;
  onCancel: () => void;
  className?: string;
}) {
  const { value, setValue, inputRef, handleKeyDown, handleBlur } = useInlineName(
    initialValue,
    onConfirm,
    onCancel
  );

  return (
    <input
      ref={inputRef}
      value={value}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      className={cn(
        "h-6 w-full rounded border border-primary bg-background px-1.5 text-xs text-foreground outline-none ring-1 ring-primary/40",
        className
      )}
    />
  );
}

function WorkspaceCard({
  item,
  isRenaming,
  onOpen,
  icon,
  subtitle,
  trailing,
}: {
  item: WorkspaceItem;
  isRenaming: boolean;
  onOpen: () => void;
  icon: ReactNode;
  subtitle: ReactNode;
  trailing?: ReactNode;
}) {
  const { startRename, cancelRename, confirmRename, promptDeleteItem } =
    useWorkspaceStore();

  return (
    <div
      onClick={() => !isRenaming && onOpen()}
      className="group relative flex items-center justify-between rounded-lg border bg-card/60 p-3.5 cursor-pointer"
    >
      <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
        {icon}
        <div className="min-w-0 flex-1">
          {isRenaming ? (
            <InlineCardRenameInput
              initialValue={item.name}
              onConfirm={(val) => confirmRename(item.id, val)}
              onCancel={cancelRename}
            />
          ) : (
            <>
              <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
              {subtitle}
            </>
          )}
        </div>
      </div>
      {!isRenaming && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              startRename(item.id);
            }}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer transition-colors"
            title="Rename"
          >
            <Pencil className="size-4" />
            <span className="sr-only">Rename</span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              promptDeleteItem(item.id);
            }}
            className="p-1.5 rounded-md text-destructive hover:bg-destructive/10 cursor-pointer transition-colors"
            title="Delete"
          >
            <Trash2 className="size-4" />
            <span className="sr-only">Delete</span>
          </button>
          {trailing}
        </div>
      )}
    </div>
  );
}

export function FolderView({ folder }: { folder: WorkspaceItem }) {
  const {
    items,
    selectItem,
    openFolder,
    startInlineCreate,
    startRename,
    cancelRename,
    confirmRename,
    renamingItemId,
    promptDeleteItem,
  } = useWorkspaceStore();
  const { isMobile, setOpenMobile: openSidebarOverlay } = useSidebar();

  const isRoot = folder.id === ROOT_ITEM_ID;
  const isRenamingThisFolder = renamingItemId === folder.id;
  const childrenItems = useMemo(
    () => items.filter((i) => i.parentId === folder.id).sort(compareWorkspaceItems),
    [items, folder.id]
  );
  const childFolders = childrenItems.filter((i) => i.type === "folder");
  const childFiles = childrenItems.filter((i) => i.type === "file");

  // On mobile the inline create input lives in the sidebar overlay — open it
  // so the input is actually visible when creating from the folder header.
  const startCreate = (type: "file" | "folder") => {
    if (isMobile) openSidebarOverlay(true);
    startInlineCreate(type, folder.id);
  };

  return (
    <div className="flex flex-1 flex-col overflow-y-auto p-4 sm:p-6 md:p-8">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <Folder className="size-6 text-primary shrink-0" />
            {isRenamingThisFolder ? (
              <InlineCardRenameInput
                initialValue={folder.name}
                onConfirm={(newName) => confirmRename(folder.id, newName)}
                onCancel={cancelRename}
                className="text-xl font-semibold h-9 w-auto min-w-48"
              />
            ) : (
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {folder.name}
              </h1>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {childrenItems.length} {childrenItems.length === 1 ? "item" : "items"} in this location
          </p>
        </div>

        {/* Quick actions for current folder — styled to match the editor header */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="xs"
            onClick={() => startCreate("file")}
            className="h-7 gap-1.5 cursor-pointer text-xs"
          >
            <FilePlus className="size-3.5" />
            <span>New File</span>
          </Button>

          <Button
            variant="outline"
            size="xs"
            onClick={() => startCreate("folder")}
            className="h-7 gap-1.5 cursor-pointer text-xs"
          >
            <FolderPlus className="size-3.5" />
            <span>New Folder</span>
          </Button>

          {!isRoot && (
            <>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => startRename(folder.id)}
                className="h-7 gap-1.5 cursor-pointer text-xs text-muted-foreground hover:text-foreground"
                title="Rename folder"
              >
                <Pencil className="size-3.5" />
                <span>Rename</span>
              </Button>

              <Button
                variant="ghost"
                size="xs"
                onClick={() => promptDeleteItem(folder.id)}
                className="h-7 gap-1.5 cursor-pointer text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                title="Delete folder"
              >
                <Trash2 className="size-3.5" />
                <span>Delete</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {childrenItems.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-muted-foreground/25 p-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted/50 mb-4">
            <Folder className="size-6 text-muted-foreground" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">This folder is empty</h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm">
            Create a new file or folder using the <span className="font-medium text-foreground">+ buttons in the sidebar</span>.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {childFolders.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Folders ({childFolders.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {childFolders.map((subfolder) => (
                  <WorkspaceCard
                    key={subfolder.id}
                    item={subfolder}
                    isRenaming={renamingItemId === subfolder.id}
                    onOpen={() => openFolder(subfolder.id)}
                    icon={<Folder className="size-5 shrink-0 text-primary" />}
                    subtitle={<p className="text-[11px] text-muted-foreground">Folder</p>}
                    trailing={<ChevronRight className="size-3.5 text-muted-foreground ml-1" />}
                  />
                ))}
              </div>
            </div>
          )}

          {childFiles.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Files ({childFiles.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {childFiles.map((file) => (
                  <WorkspaceCard
                    key={file.id}
                    item={file}
                    isRenaming={renamingItemId === file.id}
                    onOpen={() => selectItem(file.id)}
                    icon={<FileText className="size-5 shrink-0 text-muted-foreground" />}
                    subtitle={
                      <p className="text-[11px] text-muted-foreground font-mono">
                        {file.name.split(".").pop()?.toUpperCase() || "TXT"} File
                      </p>
                    }
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
