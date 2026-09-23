import { create } from "zustand";
import type { WorkspaceItem, ItemType } from "@/lib/types";
import {
  initDatabase,
  fetchAllItems,
  fetchFileContent,
  saveFileContent,
  addItem,
  renameItem as dbRenameItem,
  deleteItem as dbDeleteItem,
  formatFileName,
  ROOT_ITEM_ID,
  INITIAL_ITEMS,
  WELCOME_FILE_ID,
} from "@/lib/db";

export interface InlineCreateState {
  parentId: string;
  type: ItemType;
}

function nameIsTaken(
  items: WorkspaceItem[],
  parentId: string | null,
  name: string,
  exceptId?: string
): boolean {
  return items.some(
    (i) =>
      i.id !== exceptId &&
      i.parentId === parentId &&
      i.name.toLowerCase() === name.toLowerCase()
  );
}

function ensureExpanded(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids : [...ids, id];
}

interface WorkspaceState {
  items: WorkspaceItem[];
  isInitialized: boolean;
  selectedItemId: string | null;
  selectedFolderId: string;
  activeFileId: string | null;
  activeFileContent: string;
  lastSavedContent: string;
  isDirty: boolean;
  expandedItemIds: string[];
  isSaving: boolean;

  inlineCreate: InlineCreateState | null;
  renamingItemId: string | null;
  itemToDelete: WorkspaceItem | null;
  errorMessage: string | null;

  init: () => Promise<void>;
  setErrorMessage: (msg: string | null) => void;
  selectItem: (id: string) => Promise<void>;
  openFolder: (folderId: string) => Promise<void>;
  revealItemInTree: (itemId: string) => void;
  clearSelection: () => void;
  setExpandedItemIds: (ids: string[]) => void;

  startInlineCreate: (type: ItemType, targetParentId?: string) => void;
  cancelInlineCreate: () => void;
  confirmInlineCreate: (name: string) => Promise<WorkspaceItem | null>;

  startRename: (id: string) => void;
  cancelRename: () => void;
  confirmRename: (id: string, newName: string) => Promise<boolean>;

  promptDeleteItem: (id: string) => void;
  cancelDeleteItem: () => void;
  confirmDeleteItem: () => Promise<void>;

  updateActiveContent: (content: string) => void;
  saveActiveFile: () => Promise<void>;
}

let initPromise: Promise<void> | null = null;

export const useWorkspaceStore = create<WorkspaceState>((set, get) => {
  const flushDirtySave = async (exceptId?: string) => {
    const { activeFileId, activeFileContent, isDirty } = get();
    if (activeFileId && isDirty && activeFileId !== exceptId) {
      await saveFileContent(activeFileId, activeFileContent);
    }
  };

  return {
    items: INITIAL_ITEMS,
    isInitialized: false,
    selectedItemId: WELCOME_FILE_ID,
    selectedFolderId: ROOT_ITEM_ID,
    activeFileId: WELCOME_FILE_ID,
    activeFileContent: "",
    lastSavedContent: "",
    isDirty: false,
    expandedItemIds: [ROOT_ITEM_ID],
    isSaving: false,

    inlineCreate: null,
    renamingItemId: null,
    itemToDelete: null,
    errorMessage: null,

    setErrorMessage: (msg: string | null) => {
      set({ errorMessage: msg });
    },

    init: async () => {
      if (get().isInitialized) return;
      initPromise ??= (async () => {
        await initDatabase();
        const items = await fetchAllItems();
        const wanted = get().activeFileId;
        const activeFileId = items.some((i) => i.id === wanted)
          ? wanted
          : (items.find((i) => i.type === "file")?.id ?? null);
        const content = activeFileId
          ? await fetchFileContent(activeFileId)
          : "";
        const activeItem = items.find((i) => i.id === activeFileId);
        const selectedFolderId = activeItem?.parentId ?? ROOT_ITEM_ID;

        set({
          items,
          isInitialized: true,
          activeFileId,
          selectedItemId: activeFileId,
          selectedFolderId,
          activeFileContent: content,
          lastSavedContent: content,
          isDirty: false,
        });
      })();
      await initPromise;
    },

    revealItemInTree: (itemId: string) => {
      const { items, expandedItemIds } = get();
      const itemsMap = new Map(items.map((i) => [i.id, i]));
      const toExpand: string[] = [];

      let current = itemsMap.get(itemId);
      while (current && current.parentId) {
        toExpand.push(current.parentId);
        current = itemsMap.get(current.parentId);
      }
      if (!toExpand.includes(ROOT_ITEM_ID)) {
        toExpand.push(ROOT_ITEM_ID);
      }

      const merged = Array.from(new Set([...expandedItemIds, ...toExpand]));
      set({ expandedItemIds: merged });
    },

    selectItem: async (id: string) => {
      const { items } = get();
      const target = items.find((i) => i.id === id);
      if (!target) return;

      await flushDirtySave(id);

      get().revealItemInTree(id);

      if (target.type === "file") {
        const content = await fetchFileContent(id);
        set({
          selectedItemId: id,
          selectedFolderId: target.parentId ?? ROOT_ITEM_ID,
          activeFileId: id,
          activeFileContent: content,
          lastSavedContent: content,
          isDirty: false,
        });
      } else {
        set({
          selectedItemId: id,
          selectedFolderId: id,
          activeFileId: null,
          activeFileContent: "",
          lastSavedContent: "",
          isDirty: false,
        });
      }
    },

    openFolder: async (folderId: string) => {
      await flushDirtySave();

      get().revealItemInTree(folderId);

      set({
        selectedItemId: folderId,
        selectedFolderId: folderId,
        activeFileId: null,
        activeFileContent: "",
        lastSavedContent: "",
        isDirty: false,
      });
    },

    clearSelection: () => {
      set({ selectedItemId: null, selectedFolderId: ROOT_ITEM_ID });
    },

    setExpandedItemIds: (ids: string[]) => {
      set({ expandedItemIds: ids });
    },

    startInlineCreate: (type: ItemType, targetParentId?: string) => {
      const { items, selectedItemId, selectedFolderId, expandedItemIds } =
        get();
      let parentId = targetParentId;

      if (!parentId) {
        if (selectedItemId) {
          const selected = items.find((i) => i.id === selectedItemId);
          if (selected?.type === "folder") {
            parentId = selected.id;
          } else if (selected?.parentId) {
            parentId = selected.parentId;
          } else {
            parentId = selectedFolderId || ROOT_ITEM_ID;
          }
        } else {
          parentId = selectedFolderId || ROOT_ITEM_ID;
        }
      }

      const nextExpanded = ensureExpanded(expandedItemIds, parentId);

      set({
        inlineCreate: { parentId, type },
        renamingItemId: null,
        expandedItemIds: nextExpanded,
      });
    },

    cancelInlineCreate: () => {
      set({ inlineCreate: null });
    },

    confirmInlineCreate: async (name: string) => {
      const { inlineCreate, items, expandedItemIds } = get();
      if (!inlineCreate) return null;

      const trimmed = name.trim();
      if (!trimmed) {
        set({ inlineCreate: null });
        return null;
      }

      const finalName = formatFileName(trimmed, inlineCreate.type);

      const exists = nameIsTaken(items, inlineCreate.parentId, finalName);
      if (exists) {
        set({
          inlineCreate: null,
          errorMessage: `An item named "${finalName}" already exists in this folder.`,
        });
        return null;
      }

      const newItem = await addItem(
        finalName,
        inlineCreate.type,
        inlineCreate.parentId
      );
      const updatedItems = await fetchAllItems();

      const nextExpanded = ensureExpanded(
        expandedItemIds,
        inlineCreate.parentId
      );

      if (newItem.type === "file") {
        set({
          items: updatedItems,
          expandedItemIds: nextExpanded,
          selectedItemId: newItem.id,
          selectedFolderId: inlineCreate.parentId,
          activeFileId: newItem.id,
          activeFileContent: "",
          lastSavedContent: "",
          isDirty: false,
          inlineCreate: null,
        });
      } else {
        set({
          items: updatedItems,
          expandedItemIds: [...nextExpanded, newItem.id],
          selectedItemId: newItem.id,
          selectedFolderId: newItem.id,
          inlineCreate: null,
        });
      }

      return newItem;
    },

    startRename: (id: string) => {
      if (id === ROOT_ITEM_ID) return;
      set({ renamingItemId: id, inlineCreate: null });
    },

    cancelRename: () => {
      set({ renamingItemId: null });
    },

    confirmRename: async (id: string, newName: string) => {
      const { items } = get();
      const item = items.find((i) => i.id === id);
      if (!item) {
        set({ renamingItemId: null });
        return false;
      }

      const trimmed = newName.trim();
      if (!trimmed) {
        set({ renamingItemId: null });
        return false;
      }

      const finalName = formatFileName(trimmed, item.type);

      if (finalName === item.name) {
        set({ renamingItemId: null });
        return true;
      }

      const exists = nameIsTaken(items, item.parentId, finalName, id);
      if (exists) {
        set({
          renamingItemId: null,
          errorMessage: `An item named "${finalName}" already exists in this folder.`,
        });
        return false;
      }

      await dbRenameItem(id, finalName);
      const updatedItems = await fetchAllItems();
      set({ items: updatedItems, renamingItemId: null });
      return true;
    },

    promptDeleteItem: (id: string) => {
      if (id === ROOT_ITEM_ID) return;
      const { items } = get();
      const item = items.find((i) => i.id === id);
      if (item) {
        set({ itemToDelete: item });
      }
    },

    cancelDeleteItem: () => {
      set({ itemToDelete: null });
    },

    confirmDeleteItem: async () => {
      const {
        itemToDelete,
        activeFileId,
        selectedItemId,
        selectedFolderId,
        items,
      } = get();
      if (!itemToDelete) return;

      const deletedIds = new Set<string>([itemToDelete.id]);
      const queue = [itemToDelete.id];
      while (queue.length > 0) {
        const parent = queue.shift()!;
        for (const item of items) {
          if (item.parentId === parent) {
            deletedIds.add(item.id);
            queue.push(item.id);
          }
        }
      }

      await dbDeleteItem(itemToDelete.id);
      const updatedItems = await fetchAllItems();

      const fallbackFolderId = itemToDelete.parentId ?? ROOT_ITEM_ID;

      let nextActiveFileId = activeFileId;
      let nextActiveContent = get().activeFileContent;
      let nextLastSaved = get().lastSavedContent;
      let nextIsDirty = get().isDirty;
      let nextSelected = selectedItemId;
      let nextFolderId = selectedFolderId;

      if (activeFileId && deletedIds.has(activeFileId)) {
        nextActiveFileId = null;
        nextActiveContent = "";
        nextLastSaved = "";
        nextIsDirty = false;
      }

      if (selectedItemId && deletedIds.has(selectedItemId)) {
        nextSelected = fallbackFolderId;
      }

      if (deletedIds.has(selectedFolderId)) {
        nextFolderId = fallbackFolderId;
        if (!nextActiveFileId) {
          nextSelected = fallbackFolderId;
        }
      }

      set({
        items: updatedItems,
        itemToDelete: null,
        activeFileId: nextActiveFileId,
        activeFileContent: nextActiveContent,
        lastSavedContent: nextLastSaved,
        isDirty: nextIsDirty,
        selectedItemId: nextSelected,
        selectedFolderId: nextFolderId,
      });
    },

    updateActiveContent: (content: string) => {
      const isDirty = content !== get().lastSavedContent;
      set({ activeFileContent: content, isDirty });
    },

    saveActiveFile: async () => {
      const { activeFileId, activeFileContent } = get();
      if (!activeFileId) return;

      set({ isSaving: true });
      await saveFileContent(activeFileId, activeFileContent);
      const items = await fetchAllItems();
      set({
        items,
        isSaving: false,
        lastSavedContent: activeFileContent,
        isDirty: false,
      });
    },
  };
});
