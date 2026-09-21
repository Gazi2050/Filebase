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
} from "@hugeicons/core-free-icons";
import { useWorkspaceStore } from "@/lib/store/use-workspace-store";
import { ROOT_ITEM_ID } from "@/lib/db";
import type { WorkspaceItem } from "@/lib/types";
import { cn } from "@/lib/utils";

export function FileTree() {
  const {
    items,
    isInitialized,
    init,
    selectedItemId,
    selectItem,
    expandedItemIds,
    setExpandedItemIds,
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
      getItem: (itemId) => itemsMap.get(itemId)!,
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

  if (!isInitialized) {
    return (
      <div className="p-3 text-xs text-muted-foreground animate-pulse">
        Loading workspace...
      </div>
    );
  }

  const visibleItems = tree.getItems();

  if (visibleItems.length === 0) {
    return (
      <div className="p-3 text-xs text-muted-foreground">
        Workspace is empty. Create a file or folder above.
      </div>
    );
  }

  return (
    <div
      {...tree.getContainerProps("Workspace Tree")}
      className="space-y-0.5 outline-none select-none"
    >
      {visibleItems.map((item) => {
        const data = item.getItemData();
        const isFolder = item.isFolder();
        const isExpanded = item.isExpanded();
        const isSelected = selectedItemId === item.getId();
        const level = item.getItemMeta().level;

        const itemProps = item.getProps();

        return (
          <div
            key={item.getId()}
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
            style={{ paddingLeft: `${level * 14 + 8}px` }}
            className={cn(
              "group flex w-full items-center gap-2 rounded-md py-1.5 pr-2.5 text-left text-sm transition-colors cursor-pointer outline-none",
              isSelected
                ? "bg-accent font-medium text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            )}
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

            <span className="truncate text-sm">{data?.name ?? item.getItemName()}</span>
          </div>
        );
      })}
    </div>
  );
}
