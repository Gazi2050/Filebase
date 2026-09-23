"use client";

import { Fragment, useEffect, useMemo, type KeyboardEvent } from "react";
import { useTree } from "@headless-tree/react";
import {
  syncDataLoaderFeature,
  selectionFeature,
  hotkeysCoreFeature,
  type ItemInstance,
} from "@headless-tree/core";
import {
  Folder,
  FolderOpen,
  FileText,
  ChevronRight,
  ChevronDown,
  FilePlus,
  FolderPlus,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useWorkspaceStore } from "@/lib/store/use-workspace-store";
import { compareWorkspaceItems } from "@/lib/items";
import { InlineNameInput } from "@/components/shared/inline-name-input";
import { ROOT_ITEM_ID } from "@/lib/db";
import type { WorkspaceItem, ItemType } from "@/lib/types";
import { cn } from "@/lib/utils";

interface InlineInputRowProps {
  type: ItemType;
  level: number;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}

function InlineInputRow({ type, level, onConfirm, onCancel }: InlineInputRowProps) {
  return (
    <div
      style={{ paddingLeft: `${level * 14 + 8}px` }}
      className="flex w-full items-center gap-2 rounded-md py-1 pr-2.5 text-sm"
    >
      <span className="w-3.5 shrink-0" />
      {type === "folder" ? (
        <Folder className="size-4 shrink-0 text-primary" />
      ) : (
        <FileText className="size-4 shrink-0 text-muted-foreground" />
      )}
      <InlineNameInput
        initialValue=""
        onConfirm={onConfirm}
        onCancel={onCancel}
        placeholder={type === "file" ? "filename (.txt)" : "folder name"}
        className="flex-1"
      />
    </div>
  );
}

interface FileTreeNodeProps {
  item: ItemInstance<WorkspaceItem>;
  selectedItemId: string | null;
  activeFileId: string | null;
  selectedFolderId: string;
  renamingItemId: string | null;
  inlineCreate: { parentId: string; type: ItemType } | null;
  itemsMap: Map<string, WorkspaceItem>;
  selectItem: (id: string) => Promise<void>;
  startRename: (id: string) => void;
  cancelRename: () => void;
  confirmRename: (id: string, newName: string) => Promise<boolean>;
  promptDeleteItem: (id: string) => void;
  startInlineCreate: (type: ItemType, parentId?: string) => void;
  confirmInlineCreate: (name: string) => Promise<WorkspaceItem | null>;
  cancelInlineCreate: () => void;
}

function FileTreeNode({
  item,
  selectedItemId,
  activeFileId,
  selectedFolderId,
  renamingItemId,
  inlineCreate,
  itemsMap,
  selectItem,
  startRename,
  cancelRename,
  confirmRename,
  promptDeleteItem,
  startInlineCreate,
  confirmInlineCreate,
  cancelInlineCreate,
}: FileTreeNodeProps) {
  const data = item.getItemData();
  const isFolder = item.isFolder();
  const isExpanded = item.isExpanded();
  const isSelected = selectedItemId === item.getId();
  const level = item.getItemMeta().level;
  const itemProps = item.getProps();
  const isTargetParent = inlineCreate !== null && inlineCreate.parentId === item.getId();

  // Only one rename input can exist at a time. The tree skips rendering
  // its input when the folder view is already showing one for this item —
  // both listening for blur caused the loser to cancel the rename mid-flight.
  const mainPanelRendersRename =
    activeFileId === null &&
    (item.getId() === selectedFolderId ||
      itemsMap.get(item.getId())?.parentId === selectedFolderId);
  const isRenaming = renamingItemId === item.getId() && !mainPanelRendersRename;

  return (
    <Fragment key={item.getId()}>
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
              {isExpanded ? (
                <ChevronDown className="size-3.5 shrink-0" />
              ) : (
                <ChevronRight className="size-3.5 shrink-0" />
              )}
            </button>
          ) : (
            <span className="w-3.5 shrink-0" />
          )}

          {isFolder ? (
            isExpanded ? (
              <FolderOpen className="size-4 shrink-0 text-primary" />
            ) : (
              <Folder className="size-4 shrink-0 text-primary" />
            )
          ) : (
            <FileText className="size-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
          )}

          {isRenaming ? (
            <InlineNameInput
              initialValue={data?.name ?? item.getItemName()}
              onConfirm={(newName) => confirmRename(item.getId(), newName)}
              onCancel={cancelRename}
              stopClickPropagation
              className="flex-1"
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
                <FilePlus className="size-4 mr-2" />
                <span>New File</span>
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => startInlineCreate("folder", item.getId())}
                className="cursor-pointer"
              >
                <FolderPlus className="size-4 mr-2" />
                <span>New Folder</span>
              </ContextMenuItem>
              <ContextMenuSeparator />
            </>
          )}

          <ContextMenuItem
            onClick={() => startRename(item.getId())}
            className="cursor-pointer"
          >
            <Pencil className="size-4 mr-2" />
            <span>Rename</span>
            <ContextMenuShortcut>F2</ContextMenuShortcut>
          </ContextMenuItem>

          <ContextMenuSeparator />

          <ContextMenuItem
            variant="destructive"
            onClick={() => promptDeleteItem(item.getId())}
            className="cursor-pointer"
          >
            <Trash2 className="size-4 mr-2" />
            <span>Delete</span>
            <ContextMenuShortcut>Del</ContextMenuShortcut>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {isTargetParent && (
        <InlineInputRow
          type={inlineCreate.type}
          level={level + 1}
          onConfirm={(name) => confirmInlineCreate(name)}
          onCancel={cancelInlineCreate}
        />
      )}
    </Fragment>
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

  useEffect(() => {
    init();
  }, [init]);

  const itemsMap = useMemo(() => {
    const map = new Map<string, WorkspaceItem>();
    for (const item of items) {
      map.set(item.id, item);
    }
    return map;
  }, [items]);

  const childrenMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const item of items) {
      if (item.parentId) {
        const arr = map.get(item.parentId) || [];
        arr.push(item.id);
        map.set(item.parentId, arr);
      }
    }

    for (const [, childIds] of map.entries()) {
      childIds.sort((a, b) => {
        const itemA = itemsMap.get(a);
        const itemB = itemsMap.get(b);
        if (!itemA || !itemB) return 0;
        return compareWorkspaceItems(itemA, itemB);
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

  useEffect(() => {
    if (isInitialized) {
      tree.rebuildTree();
    }
  }, [items, expandedItemIds, isInitialized, tree]);

  const handleTreeKeyDown = (e: KeyboardEvent) => {
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
      {inlineCreate && inlineCreate.parentId === ROOT_ITEM_ID && (
        <InlineInputRow
          type={inlineCreate.type}
          level={0}
          onConfirm={(name) => confirmInlineCreate(name)}
          onCancel={cancelInlineCreate}
        />
      )}

      {visibleItems.map((item) => (
        <FileTreeNode
          key={item.getId()}
          item={item}
          selectedItemId={selectedItemId}
          activeFileId={activeFileId}
          selectedFolderId={selectedFolderId}
          renamingItemId={renamingItemId}
          inlineCreate={inlineCreate}
          itemsMap={itemsMap}
          selectItem={selectItem}
          startRename={startRename}
          cancelRename={cancelRename}
          confirmRename={confirmRename}
          promptDeleteItem={promptDeleteItem}
          startInlineCreate={startInlineCreate}
          confirmInlineCreate={confirmInlineCreate}
          cancelInlineCreate={cancelInlineCreate}
        />
      ))}

      {visibleItems.length === 0 && !inlineCreate && (
        <div className="p-3 text-xs text-muted-foreground">
          Workspace is empty. Click + above to create a file or folder.
        </div>
      )}
    </div>
  );
}
