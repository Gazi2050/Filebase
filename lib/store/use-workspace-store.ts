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
  selectedFolderId: string;
  activeFileId: string | null;
  activeFileContent: string;
  lastSavedContent: string;
  isDirty: boolean;
  expandedItemIds: string[];
  isSaving: boolean;

  // Inline creation state
  inlineCreate: InlineCreateState | null;

  // Inline rename state
  renamingItemId: string | null;

  // Delete confirm dialog state
  itemToDelete: WorkspaceItem | null;

  // Validation/Error state
  errorMessage: string | null;

  // Actions
  init: () => Promise<void>;
  setErrorMessage: (msg: string | null) => void;
  selectItem: (id: string) => Promise<void>;
  openFolder: (folderId: string) => Promise<void>;
  revealItemInTree: (itemId: string) => void;
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

let initPromise: Promise<void> | null = null;

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  items: INITIAL_ITEMS,
  isInitialized: false,
  selectedItemId: "file-welcome",
  selectedFolderId: ROOT_ITEM_ID,
  activeFileId: "file-welcome",
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

  // ponytail: single-flight init — StrictMode/double-mount used to run seeding
  // twice, and the second bulkAdd failed with BulkError (empty first visit).
  // Upgrade path: move seeding into a Dexie on("populate") hook.
  init: async () => {
    if (get().isInitialized) return;
    initPromise ??= (async () => {
      await initDatabase();
      const items = await fetchAllItems();
      // Validate persisted default against real items — a deleted file must not
      // come back as a phantom empty editor after refresh.
      const wanted = get().activeFileId;
      const activeFileId = items.some((i) => i.id === wanted)
        ? wanted
        : items.find((i) => i.type === "file")?.id ?? null;
      const content = activeFileId ? await fetchFileContent(activeFileId) : "";
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
    const { items, activeFileId, activeFileContent, isDirty } = get();
    const target = items.find((i) => i.id === id);
    if (!target) return;

    // Auto-save pending file edits if switching to another item
    if (activeFileId && isDirty && activeFileId !== id) {
      await saveFileContent(activeFileId, activeFileContent);
    }

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
    const { activeFileId, activeFileContent, isDirty } = get();
    if (activeFileId && isDirty) {
      await saveFileContent(activeFileId, activeFileContent);
    }

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

  toggleExpandItem: (id: string) => {
    const { expandedItemIds } = get();
    if (expandedItemIds.includes(id)) {
      set({ expandedItemIds: expandedItemIds.filter((item) => item !== id) });
    } else {
      set({ expandedItemIds: [...expandedItemIds, id] });
    }
  },

  startInlineCreate: (type: ItemType, targetParentId?: string) => {
    const { items, selectedItemId, selectedFolderId, expandedItemIds } = get();
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
      set({
        inlineCreate: null,
        errorMessage: `An item named "${finalName}" already exists in this folder.`,
      });
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
    const { itemToDelete, activeFileId, selectedItemId, selectedFolderId, items } = get();
    if (!itemToDelete) return;

    // Determine all IDs that are being deleted (item and descendants)
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

    // Determine parent folder to navigate to
    const fallbackFolderId = itemToDelete.parentId ?? ROOT_ITEM_ID;

    let nextActiveFileId = activeFileId;
    let nextActiveContent = get().activeFileContent;
    let nextLastSaved = get().lastSavedContent;
    let nextIsDirty = get().isDirty;
    let nextSelected = selectedItemId;
    let nextFolderId = selectedFolderId;

    // If active file was deleted (or was inside deleted folder), reset editor
    if (activeFileId && deletedIds.has(activeFileId)) {
      nextActiveFileId = null;
      nextActiveContent = "";
      nextLastSaved = "";
      nextIsDirty = false;
    }

    // If selected item was deleted, navigate to parent folder
    if (selectedItemId && deletedIds.has(selectedItemId)) {
      nextSelected = fallbackFolderId;
    }

    // If selected folder was deleted, navigate to parent folder
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
}));
