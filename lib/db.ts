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
export const WELCOME_FILE_ID = "file-welcome";

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
    id: WELCOME_FILE_ID,
    name: "welcome.txt",
    type: "file",
    parentId: ROOT_ITEM_ID,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

export const INITIAL_CONTENTS: Record<string, string> = {
  [WELCOME_FILE_ID]: `Welcome to Filebase! 👋\n\nThink of this as your own personal notebook that lives right inside your browser.\nCreate folders and files in the sidebar, click any file to start writing — everything saves automatically on your device.\nNo sign-up, no accounts, nothing leaves your computer. Close the tab, come back anytime — your notes will be right here waiting.\n`,
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
