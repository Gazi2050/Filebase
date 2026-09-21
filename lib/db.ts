import Dexie, { type Table } from "dexie";
import type { WorkspaceItem, FileContent, ItemType } from "./types";

export class FilebaseDB extends Dexie {
  items!: Table<WorkspaceItem, string>;
  contents!: Table<FileContent, string>;

  constructor() {
    super("filebase_db");
    this.version(1).stores({
      items: "id, parentId, type, name, createdAt",
      contents: "fileId, updatedAt",
    });
  }
}

export const db = new FilebaseDB();

export const ROOT_ITEM_ID = "root";

export const INITIAL_ITEMS: WorkspaceItem[] = [
  {
    id: ROOT_ITEM_ID,
    name: "Workspace",
    type: "folder",
    parentId: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "folder-projects",
    name: "Projects",
    type: "folder",
    parentId: ROOT_ITEM_ID,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "folder-webbly",
    name: "Webbly",
    type: "folder",
    parentId: "folder-projects",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "file-notes",
    name: "notes.txt",
    type: "file",
    parentId: "folder-webbly",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "file-tasks",
    name: "tasks.txt",
    type: "file",
    parentId: "folder-webbly",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "folder-personal",
    name: "Personal",
    type: "folder",
    parentId: "folder-projects",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "folder-docs",
    name: "Documents",
    type: "folder",
    parentId: ROOT_ITEM_ID,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "file-web-notes",
    name: "web-notes.txt",
    type: "file",
    parentId: "folder-docs",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "file-readme",
    name: "README.txt",
    type: "file",
    parentId: ROOT_ITEM_ID,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

export const INITIAL_CONTENTS: Record<string, string> = {
  "file-notes": `Webbly kickoff notes\n\n- Goal: Ship the Mini Workspace Explorer\n- Stack: Next.js, React, TypeScript, Zustand, Headless Tree, Dexie.js\n- Status: Real Headless Tree and Dexie persistence active\n`,
  "file-tasks": `Upcoming tasks:\n\n[x] Initialize clean layout\n[x] Connect Dexie.js local database\n[x] Implement Headless Tree explorer\n[ ] Add drag and drop support\n[ ] Connect search indexing\n`,
  "file-web-notes": `Reference Documentation:\n\n- Headless Tree: useTree with syncDataLoaderFeature\n- Tailwind CSS v4\n- Shadcn UI components\n`,
  "file-readme": `Welcome to Filebase Workspace Explorer!\n\nThis application stores all your files and folders locally in your browser using IndexedDB.\nUse the sidebar to navigate, create files and folders, and edit text seamlessly.\n`,
};

export function formatFileName(name: string, type: ItemType): string {
  const trimmed = name.trim();
  if (type === "file" && !trimmed.includes(".")) {
    return `${trimmed}.txt`;
  }
  return trimmed;
}

export async function initDatabase(): Promise<void> {
  const count = await db.items.count();
  if (count === 0) {
    await db.transaction("rw", db.items, db.contents, async () => {
      await db.items.bulkAdd(INITIAL_ITEMS);
      const contentsToSeed: FileContent[] = Object.entries(INITIAL_CONTENTS).map(
        ([fileId, content]) => ({
          fileId,
          content,
          updatedAt: Date.now(),
        })
      );
      await db.contents.bulkAdd(contentsToSeed);
    });
  }
}

export async function fetchAllItems(): Promise<WorkspaceItem[]> {
  return await db.items.toArray();
}

export async function fetchFileContent(fileId: string): Promise<string> {
  const record = await db.contents.get(fileId);
  return record?.content ?? "";
}

export async function saveFileContent(fileId: string, content: string): Promise<void> {
  await db.contents.put({
    fileId,
    content,
    updatedAt: Date.now(),
  });
  await db.items.update(fileId, { updatedAt: Date.now() });
}

export async function addItem(
  name: string,
  type: ItemType,
  parentId: string
): Promise<WorkspaceItem> {
  const finalName = formatFileName(name, type);
  const now = Date.now();
  const id = `${type}-${now}-${Math.random().toString(36).substring(2, 7)}`;
  const newItem: WorkspaceItem = {
    id,
    name: finalName,
    type,
    parentId,
    createdAt: now,
    updatedAt: now,
  };

  await db.transaction("rw", db.items, db.contents, async () => {
    await db.items.add(newItem);
    if (type === "file") {
      await db.contents.add({
        fileId: id,
        content: "",
        updatedAt: now,
      });
    }
  });

  return newItem;
}

export async function renameItem(id: string, newName: string): Promise<void> {
  const item = await db.items.get(id);
  if (!item) return;
  const finalName = formatFileName(newName, item.type);
  await db.items.update(id, { name: finalName, updatedAt: Date.now() });
}

export async function deleteItem(id: string): Promise<void> {
  await db.transaction("rw", db.items, db.contents, async () => {
    const toDelete: string[] = [id];
    let i = 0;
    while (i < toDelete.length) {
      const children = await db.items
        .where("parentId")
        .equals(toDelete[i])
        .toArray();
      for (const child of children) {
        toDelete.push(child.id);
      }
      i++;
    }
    await db.contents.where("fileId").anyOf(toDelete).delete();
    await db.items.where("id").anyOf(toDelete).delete();
  });
}
