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
} from "@/lib/db";

export interface InlineCreateState {
  parentId: string;
  type: ItemType;
}

interface WorkspaceState {
  items: WorkspaceItem[];
  isInitialized: boolean;
  selectedItemId: string | null;
  activeFileId: string | null;
  activeFileContent: string;
  expandedItemIds: string[];
  isSaving: boolean;

  // Inline creation state
  inlineCreate: InlineCreateState | null;

  // Inline rename state
  renamingItemId: string | null;

  // Delete confirm dialog state
  itemToDelete: WorkspaceItem | null;

  // Actions
  init: () => Promise<void>;
  selectItem: (id: string) => Promise<void>;
  clearSelection: () => void;
  setExpandedItemIds: (ids: string[]) => void;
  toggleExpandItem: (id: string) => void;

  // VS Code-style Inline Creation
  startInlineCreate: (type: ItemType, targetParentId?: string) => void;
  cancelInlineCreate: () => void;
  confirmInlineCreate: (name: string) => Promise<WorkspaceItem | null>;

  // Inline Rename
  startRename: (id: string) => void;
  cancelRename: () => void;
  confirmRename: (id: string, newName: string) => Promise<boolean>;

  // Delete
  promptDeleteItem: (id: string) => void;
  cancelDeleteItem: () => void;
  confirmDeleteItem: () => Promise<void>;

  // Editor Actions
  updateActiveContent: (content: string) => void;
  saveActiveFile: () => Promise<void>;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  items: INITIAL_ITEMS,
  isInitialized: false,
  selectedItemId: "file-notes",
  activeFileId: "file-notes",
  activeFileContent: "",
  expandedItemIds: [ROOT_ITEM_ID, "folder-projects", "folder-webbly"],
  isSaving: false,

  inlineCreate: null,
  renamingItemId: null,
  itemToDelete: null,

  init: async () => {
    if (get().isInitialized) return;
    await initDatabase();
    const items = await fetchAllItems();
    const activeFileId = get().activeFileId || "file-notes";
    const content = await fetchFileContent(activeFileId);

    set({
      items,
      isInitialized: true,
      activeFileId,
      selectedItemId: activeFileId,
      activeFileContent: content,
    });
  },

  selectItem: async (id: string) => {
    const { items, activeFileId, activeFileContent } = get();
    const target = items.find((i) => i.id === id);
    if (!target) return;

    if (target.type === "file") {
      if (activeFileId && activeFileId !== id) {
        await saveFileContent(activeFileId, activeFileContent);
      }
      const content = await fetchFileContent(id);
      set({
        selectedItemId: id,
        activeFileId: id,
        activeFileContent: content,
      });
    } else {
      set({ selectedItemId: id });
    }
  },

  clearSelection: () => {
    set({ selectedItemId: null });
  },

  setExpandedItemIds: (ids: string[]) => {
    set({ expandedItemIds: ids });
  },

  toggleExpandItem: (id: string) => {
    const { expandedItemIds } = get();
    if (expandedItemIds.includes(id)) {
      set({ expandedItemIds: expandedItemIds.filter((item) => item !== id) });
    } else {
      set({ expandedItemIds: [...expandedItemIds, id] });
    }
  },

  startInlineCreate: (type: ItemType, targetParentId?: string) => {
    const { items, selectedItemId, expandedItemIds } = get();
    let parentId = targetParentId;

    if (!parentId) {
      if (selectedItemId) {
        const selected = items.find((i) => i.id === selectedItemId);
        if (selected?.type === "folder") {
          parentId = selected.id;
        } else if (selected?.parentId) {
          parentId = selected.parentId;
        } else {
          parentId = ROOT_ITEM_ID;
        }
      } else {
        parentId = ROOT_ITEM_ID;
      }
    }

    const nextExpanded = expandedItemIds.includes(parentId)
      ? expandedItemIds
      : [...expandedItemIds, parentId];

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

    // Validation: prevent duplicate name within same parent
    const exists = items.some(
      (item) =>
        item.parentId === inlineCreate.parentId &&
        item.name.toLowerCase() === finalName.toLowerCase()
    );
    if (exists) {
      set({ inlineCreate: null });
      return null;
    }

    const newItem = await addItem(finalName, inlineCreate.type, inlineCreate.parentId);
    const updatedItems = await fetchAllItems();

    const nextExpanded = expandedItemIds.includes(inlineCreate.parentId)
      ? expandedItemIds
      : [...expandedItemIds, inlineCreate.parentId];

    if (newItem.type === "file") {
      set({
        items: updatedItems,
        expandedItemIds: nextExpanded,
        selectedItemId: newItem.id,
        activeFileId: newItem.id,
        activeFileContent: "",
        inlineCreate: null,
      });
    } else {
      set({
        items: updatedItems,
        expandedItemIds: [...nextExpanded, newItem.id],
        selectedItemId: newItem.id,
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

    // If unchanged, simply exit
    if (finalName === item.name) {
      set({ renamingItemId: null });
      return true;
    }

    // Check duplicate in same parent
    const exists = items.some(
      (i) =>
        i.id !== id &&
        i.parentId === item.parentId &&
        i.name.toLowerCase() === finalName.toLowerCase()
    );
    if (exists) {
      set({ renamingItemId: null });
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
    const { itemToDelete, activeFileId, selectedItemId } = get();
    if (!itemToDelete) return;

    await dbDeleteItem(itemToDelete.id);
    const updatedItems = await fetchAllItems();

    let nextActiveFileId = activeFileId;
    let nextActiveContent = get().activeFileContent;
    let nextSelected = selectedItemId;

    // Check if active file was deleted or inside deleted folder
    const activeItemStillExists = updatedItems.some((i) => i.id === activeFileId);
    if (!activeItemStillExists) {
      nextActiveFileId = null;
      nextActiveContent = "";
    }

    if (selectedItemId === itemToDelete.id) {
      nextSelected = null;
    }

    set({
      items: updatedItems,
      itemToDelete: null,
      activeFileId: nextActiveFileId,
      activeFileContent: nextActiveContent,
      selectedItemId: nextSelected,
    });
  },

  updateActiveContent: (content: string) => {
    set({ activeFileContent: content });
  },

  saveActiveFile: async () => {
    const { activeFileId, activeFileContent } = get();
    if (!activeFileId) return;

    set({ isSaving: true });
    await saveFileContent(activeFileId, activeFileContent);
    const items = await fetchAllItems();
    set({ items, isSaving: false });
  },
}));
