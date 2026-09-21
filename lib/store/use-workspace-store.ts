import { create } from "zustand";
import type { WorkspaceItem, ItemType } from "@/lib/types";
import {
  initDatabase,
  fetchAllItems,
  fetchFileContent,
  saveFileContent,
  addItem,
  ROOT_ITEM_ID,
} from "@/lib/db";

interface WorkspaceState {
  items: WorkspaceItem[];
  isInitialized: boolean;
  selectedItemId: string | null;
  activeFileId: string | null;
  activeFileContent: string;
  expandedItemIds: string[];
  isSaving: boolean;

  // Dialog state
  createDialogOpen: boolean;
  createDialogType: ItemType;
  createDialogParentId: string;

  // Actions
  init: () => Promise<void>;
  selectItem: (id: string) => Promise<void>;
  setExpandedItemIds: (ids: string[]) => void;
  toggleExpandItem: (id: string) => void;
  openCreateDialog: (type: ItemType, targetParentId?: string) => void;
  closeCreateDialog: () => void;
  createNewItem: (name: string) => Promise<WorkspaceItem | null>;
  updateActiveContent: (content: string) => void;
  saveActiveFile: () => Promise<void>;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  items: [],
  isInitialized: false,
  selectedItemId: "file-notes",
  activeFileId: "file-notes",
  activeFileContent: "",
  expandedItemIds: [ROOT_ITEM_ID, "folder-projects", "folder-webbly"],
  isSaving: false,

  createDialogOpen: false,
  createDialogType: "file",
  createDialogParentId: ROOT_ITEM_ID,

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
      // Auto-save previous file if active
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

  openCreateDialog: (type: ItemType, targetParentId?: string) => {
    const { items, selectedItemId } = get();
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

    set({
      createDialogOpen: true,
      createDialogType: type,
      createDialogParentId: parentId,
    });
  },

  closeCreateDialog: () => {
    set({ createDialogOpen: false });
  },

  createNewItem: async (name: string) => {
    const { createDialogType, createDialogParentId, expandedItemIds } = get();
    const trimmedName = name.trim();
    if (!trimmedName) return null;

    const newItem = await addItem(trimmedName, createDialogType, createDialogParentId);
    const items = await fetchAllItems();

    // Ensure parent is expanded so new item is immediately visible
    const newExpanded = expandedItemIds.includes(createDialogParentId)
      ? expandedItemIds
      : [...expandedItemIds, createDialogParentId];

    if (newItem.type === "file") {
      set({
        items,
        expandedItemIds: newExpanded,
        selectedItemId: newItem.id,
        activeFileId: newItem.id,
        activeFileContent: "",
        createDialogOpen: false,
      });
    } else {
      set({
        items,
        expandedItemIds: [...newExpanded, newItem.id],
        selectedItemId: newItem.id,
        createDialogOpen: false,
      });
    }

    return newItem;
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
