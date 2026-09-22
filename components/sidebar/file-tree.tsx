"use client";

import * as React from "react";
import { useTree } from "@headless-tree/react";
import {
  syncDataLoaderFeature,
  selectionFeature,
  hotkeysCoreFeature,
} from "@headless-tree/core";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Folder01Icon,
  FolderOpenIcon,
  FileTextIcon,
  ArrowRight01Icon,
  ArrowDown01Icon,
  FileAddIcon,
  FolderAddIcon,
  PencilEdit01Icon,
  Delete02Icon,
} from "@hugeicons/core-free-icons";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useWorkspaceStore } from "@/lib/store/use-workspace-store";
import { ROOT_ITEM_ID } from "@/lib/db";
import type { WorkspaceItem, ItemType } from "@/lib/types";
import { cn } from "@/lib/utils";

interface InlineInputProps {
  type: ItemType;
  level: number;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}

function InlineInputRow({ type, level, onConfirm, onCancel }: InlineInputProps) {
  const [val, setVal] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      onConfirm(val);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
    }
  };

  return (
    <div
      style={{ paddingLeft: `${level * 14 + 8}px` }}
      className="flex w-full items-center gap-2 rounded-md py-1 pr-2.5 text-sm"
    >
      <span className="w-3.5 shrink-0" />
      <HugeiconsIcon
        icon={type === "folder" ? Folder01Icon : FileTextIcon}
        className={cn(
          "size-4 shrink-0",
          type === "folder" ? "text-primary" : "text-muted-foreground"
        )}
      />
      <input
        ref={inputRef}
        type="text"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (val.trim()) {
            onConfirm(val);
          } else {
            onCancel();
          }
        }}
        placeholder={type === "file" ? "filename (.txt)" : "folder name"}
        className="h-6 flex-1 min-w-0 rounded border border-primary/60 bg-background px-1.5 text-xs text-foreground outline-none ring-1 ring-primary/40 selection:bg-primary/20"
      />
    </div>
  );
}

interface InlineRenameProps {
  initialValue: string;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}

function InlineRenameInput({ initialValue, onConfirm, onCancel }: InlineRenameProps) {
  const [val, setVal] = React.useState(initialValue);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    inputRef.current?.focus();
    // Select base filename before extension for better UX
    const dotIndex = initialValue.lastIndexOf(".");
    if (dotIndex > 0 && inputRef.current) {
      inputRef.current.setSelectionRange(0, dotIndex);
    } else {
      inputRef.current?.select();
    }
  }, [initialValue]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      onConfirm(val);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      value={val}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setVal(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={() => {
        if (val.trim()) {
          onConfirm(val);
        } else {
          onCancel();
        }
      }}
      className="h-6 flex-1 min-w-0 rounded border border-primary/60 bg-background px-1.5 text-xs text-foreground outline-none ring-1 ring-primary/40 selection:bg-primary/20"
    />
  );
}

export function FileTree() {
  const {
    items,
    isInitialized,
    init,
    selectedItemId,
    selectItem,
    activeFileId,
    selectedFolderId,
    expandedItemIds,
    setExpandedItemIds,
    inlineCreate,
    cancelInlineCreate,
    confirmInlineCreate,
    renamingItemId,
    startRename,
    cancelRename,
    confirmRename,
    promptDeleteItem,
    startInlineCreate,
    clearSelection,
  } = useWorkspaceStore();

  React.useEffect(() => {
    init();
  }, [init]);

  const itemsMap = React.useMemo(() => {
    const map = new Map<string, WorkspaceItem>();
    for (const item of items) {
      map.set(item.id, item);
    }
    return map;
  }, [items]);

  const childrenMap = React.useMemo(() => {
    const map = new Map<string, string[]>();
    for (const item of items) {
      if (item.parentId) {
        const arr = map.get(item.parentId) || [];
        arr.push(item.id);
        map.set(item.parentId, arr);
      }
    }

    // Sort: folders first, then alphabetical by name
    for (const [, childIds] of map.entries()) {
      childIds.sort((a, b) => {
        const itemA = itemsMap.get(a);
        const itemB = itemsMap.get(b);
        if (!itemA || !itemB) return 0;
        if (itemA.type !== itemB.type) {
          return itemA.type === "folder" ? -1 : 1;
        }
        return itemA.name.localeCompare(itemB.name, undefined, { sensitivity: "base" });
      });
    }
    return map;
  }, [items, itemsMap]);

  const tree = useTree<WorkspaceItem>({
    rootItemId: ROOT_ITEM_ID,
    getItemName: (item) => item.getItemData()?.name ?? "",
    isItemFolder: (item) => item.getItemData()?.type === "folder",
    dataLoader: {
      getItem: (itemId) => {
        const found = itemsMap.get(itemId);
        if (found) return found;
        if (itemId === ROOT_ITEM_ID) {
          return {
            id: ROOT_ITEM_ID,
            name: "Workspace",
            type: "folder",
            parentId: null,
            createdAt: 0,
            updatedAt: 0,
          };
        }
        return {
          id: itemId,
          name: "Untitled",
          type: "file",
          parentId: ROOT_ITEM_ID,
          createdAt: 0,
          updatedAt: 0,
        };
      },
      getChildren: (itemId) => childrenMap.get(itemId) || [],
    },
    features: [syncDataLoaderFeature, selectionFeature, hotkeysCoreFeature],
    state: {
      expandedItems: expandedItemIds,
      selectedItems: selectedItemId ? [selectedItemId] : [],
    },
    setExpandedItems: (updater) => {
      const next = typeof updater === "function" ? updater(expandedItemIds) : updater;
      setExpandedItemIds(next);
    },
    setSelectedItems: (updater) => {
      const next =
        typeof updater === "function"
          ? updater(selectedItemId ? [selectedItemId] : [])
          : updater;
      if (next[0]) {
        selectItem(next[0]);
      }
    },
    onPrimaryAction: (item) => {
      if (item.isFolder()) {
        if (item.isExpanded()) {
          item.collapse();
        } else {
          item.expand();
        }
      } else {
        selectItem(item.getId());
      }
    },
  });

  // Keep tree synchronized when items or expanded items change
  React.useEffect(() => {
    if (isInitialized) {
      tree.rebuildTree();
    }
  }, [items, expandedItemIds, isInitialized, tree]);

  // Handle tree-level keyboard shortcuts (F2 rename, Delete key)
  const handleTreeKeyDown = (e: React.KeyboardEvent) => {
    if (renamingItemId || inlineCreate) return;

    if (e.key === "F2" && selectedItemId) {
      e.preventDefault();
      startRename(selectedItemId);
    } else if (e.key === "Delete" && selectedItemId) {
      e.preventDefault();
      promptDeleteItem(selectedItemId);
    }
  };

  if (!isInitialized) {
    return (
      <div className="p-3 text-xs text-muted-foreground animate-pulse">
        Loading workspace...
      </div>
    );
  }

  const visibleItems = tree.getItems();



  const containerProps = tree.getContainerProps("Workspace Tree");

  return (
    <div
      {...containerProps}
      onKeyDown={handleTreeKeyDown}
      onClick={(e) => {
        containerProps.onClick?.(e);
        if (e.target === e.currentTarget) {
          clearSelection();
        }
      }}
      className="space-y-0.5 outline-none select-none min-h-full flex-1"
    >
      {/* If creating at root level, render inline row at top */}
      {inlineCreate && inlineCreate.parentId === ROOT_ITEM_ID && (
        <InlineInputRow
          type={inlineCreate.type}
          level={0}
          onConfirm={(name) => confirmInlineCreate(name)}
          onCancel={cancelInlineCreate}
        />
      )}

      {visibleItems.map((item) => {
        const data = item.getItemData();
        const isFolder = item.isFolder();
        const isExpanded = item.isExpanded();
        const isSelected = selectedItemId === item.getId();
        // ponytail: only ONE rename input may exist at a time. The tree suppresses
        // its input when the main panel renders one for this item (folder view),
        // because the focus handoff made the loser's blur cancel the rename.
        const mainPanelRendersRename =
          activeFileId === null &&
          (item.getId() === selectedFolderId ||
            itemsMap.get(item.getId())?.parentId === selectedFolderId);
        const isRenaming =
          renamingItemId === item.getId() && !mainPanelRendersRename;
        const level = item.getItemMeta().level;
        const itemProps = item.getProps();

        // Check if inline creation is targeting inside this folder
        const isTargetParent =
          inlineCreate !== null && inlineCreate.parentId === item.getId();

        return (
          <React.Fragment key={item.getId()}>
            <ContextMenu>
              <ContextMenuTrigger
                render={
                  <div
                    {...itemProps}
                    onClick={(e) => {
                      itemProps.onClick?.(e);
                      if (isFolder) {
                        if (isExpanded) {
                          item.collapse();
                        } else {
                          item.expand();
                        }
                      }
                      selectItem(item.getId());
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      startRename(item.getId());
                    }}
                    style={{ paddingLeft: `${level * 14 + 8}px` }}
                    className={cn(
                      "group flex w-full items-center gap-2 rounded-md py-1.5 pr-2.5 text-left text-sm transition-colors cursor-pointer outline-none",
                      isSelected
                        ? "bg-accent font-medium text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                    )}
                  />
                }
              >
                {isFolder ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isExpanded) {
                        item.collapse();
                      } else {
                        item.expand();
                      }
                    }}
                    className="flex items-center justify-center p-0.5 rounded hover:bg-accent/80 text-muted-foreground hover:text-foreground"
                  >
                    <HugeiconsIcon
                      icon={isExpanded ? ArrowDown01Icon : ArrowRight01Icon}
                      className="size-3.5 shrink-0"
                    />
                  </button>
                ) : (
                  <span className="w-3.5 shrink-0" />
                )}

                <HugeiconsIcon
                  icon={isFolder ? (isExpanded ? FolderOpenIcon : Folder01Icon) : FileTextIcon}
                  className={cn(
                    "size-4 shrink-0",
                    isFolder ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                  )}
                />

                {isRenaming ? (
                  <InlineRenameInput
                    initialValue={data?.name ?? item.getItemName()}
                    onConfirm={(newName) => confirmRename(item.getId(), newName)}
                    onCancel={cancelRename}
                  />
                ) : (
                  <span className="truncate text-sm">{data?.name ?? item.getItemName()}</span>
                )}
              </ContextMenuTrigger>

              <ContextMenuContent>
                {isFolder && (
                  <>
                    <ContextMenuItem
                      onClick={() => startInlineCreate("file", item.getId())}
                      className="cursor-pointer"
                    >
                      <HugeiconsIcon icon={FileAddIcon} className="size-4 mr-2" />
                      <span>New File</span>
                    </ContextMenuItem>
                    <ContextMenuItem
                      onClick={() => startInlineCreate("folder", item.getId())}
                      className="cursor-pointer"
                    >
                      <HugeiconsIcon icon={FolderAddIcon} className="size-4 mr-2" />
                      <span>New Folder</span>
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                  </>
                )}

                <ContextMenuItem
                  onClick={() => startRename(item.getId())}
                  className="cursor-pointer"
                >
                  <HugeiconsIcon icon={PencilEdit01Icon} className="size-4 mr-2" />
                  <span>Rename</span>
                  <ContextMenuShortcut>F2</ContextMenuShortcut>
                </ContextMenuItem>

                <ContextMenuSeparator />

                <ContextMenuItem
                  variant="destructive"
                  onClick={() => promptDeleteItem(item.getId())}
                  className="cursor-pointer"
                >
                  <HugeiconsIcon icon={Delete02Icon} className="size-4 mr-2" />
                  <span>Delete</span>
                  <ContextMenuShortcut>Del</ContextMenuShortcut>
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>

            {/* If folder is target of inline creation and is expanded, render inline row right after folder */}
            {isTargetParent && (
              <InlineInputRow
                type={inlineCreate.type}
                level={level + 1}
                onConfirm={(name) => confirmInlineCreate(name)}
                onCancel={cancelInlineCreate}
              />
            )}
          </React.Fragment>
        );
      })}

      {visibleItems.length === 0 && !inlineCreate && (
        <div className="p-3 text-xs text-muted-foreground">
          Workspace is empty. Click + above to create a file or folder.
        </div>
      )}
    </div>
  );
}
