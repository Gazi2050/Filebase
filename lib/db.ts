import Dexie, { type Table } from "dexie";
import { stripExtension } from "./items";
import type {
  WorkspaceItem,
  FileContent,
  ItemType,
  Deletion,
  SyncMetaRow,
} from "./types";

export class FilebaseDB extends Dexie {
  items!: Table<WorkspaceItem, string>;
  contents!: Table<FileContent, string>;
  deletions!: Table<Deletion, string>;
  meta!: Table<SyncMetaRow, string>;

  constructor() {
    super("filebase_db");
    this.version(1).stores({
      items: "id, parentId, type, name, createdAt",
      contents: "fileId, updatedAt",
    });
    // v2: sync support (tombstones + sync metadata).
    this.version(2).stores({
      items: "id, parentId, type, name, createdAt",
      contents: "fileId, updatedAt",
      deletions: "id, deletedAt",
      meta: "key",
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
    name: "Welcome",
    type: "file",
    parentId: ROOT_ITEM_ID,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

const WELCOME_DOC = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 1 },
      content: [{ type: "text", text: "Welcome to Filebase 👋" }],
    },
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "Your own personal notebook that lives right inside your browser.",
        },
      ],
    },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Getting started" }],
    },
    {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "Create folders and files in the sidebar" },
              ],
            },
          ],
        },
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", marks: [{ type: "bold" }], text: "Click any file" },
                { type: "text", text: " to start writing" },
              ],
            },
          ],
        },
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "Press " },
                { type: "text", marks: [{ type: "code" }], text: "Ctrl+S" },
                { type: "text", text: " to search — everything saves automatically" },
              ],
            },
          ],
        },
      ],
    },
    {
      type: "blockquote",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "No sign-up, no accounts — nothing leaves your computer.",
            },
          ],
        },
      ],
    },
  ],
};

export const INITIAL_CONTENTS: Record<string, string> = {
  [WELCOME_FILE_ID]: JSON.stringify(WELCOME_DOC),
};

// Files no longer carry extensions — names are free-form.
export function formatFileName(name: string): string {
  return name.trim();
}

export async function initDatabase(): Promise<void> {
  const count = await db.items.count();
  if (count === 0) {
    await db.transaction("rw", db.items, db.contents, async () => {
      await db.items.bulkAdd(INITIAL_ITEMS);
      const contentsToSeed: FileContent[] = Object.entries(
        INITIAL_CONTENTS
      ).map(([fileId, content]) => ({
        fileId,
        content,
        updatedAt: Date.now(),
      }));
      await db.contents.bulkAdd(contentsToSeed);
    });
  }
  await stripLegacyExtensions();
}

/**
 * One-time-per-load cleanup for databases created before extensions were
 * dropped: renames "welcome.txt" → "welcome". Idempotent — after the first
 * run there are no extension-like names left, so it's a no-op scan.
 */
async function stripLegacyExtensions(): Promise<void> {
  const items = await db.items.toArray();
  const namesByParent = new Map<string, Set<string>>();
  for (const item of items) {
    const key = item.parentId ?? ROOT_ITEM_ID;
    if (!namesByParent.has(key)) namesByParent.set(key, new Set());
    namesByParent.get(key)!.add(item.name.toLowerCase());
  }
  for (const item of items) {
    const base = stripExtension(
      item.name,
      namesByParent.get(item.parentId ?? ROOT_ITEM_ID)!
    );
    if (base === null) continue;
    const siblings = namesByParent.get(item.parentId ?? ROOT_ITEM_ID)!;
    siblings.delete(item.name.toLowerCase());
    siblings.add(base.toLowerCase());
    // Bump updatedAt so the rename syncs to the server and other devices.
    await db.items.update(item.id, { name: base, updatedAt: Date.now() });
  }
}

export async function fetchAllItems(): Promise<WorkspaceItem[]> {
  return await db.items.toArray();
}

export async function fetchFileContent(fileId: string): Promise<string> {
  const record = await db.contents.get(fileId);
  return record?.content ?? "";
}

export async function saveFileContent(
  fileId: string,
  content: string
): Promise<void> {
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
  const finalName = formatFileName(name);
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
  if (!(await db.items.get(id))) return;
  const finalName = formatFileName(newName);
  await db.items.update(id, { name: finalName, updatedAt: Date.now() });
}

export async function deleteItem(id: string): Promise<void> {
  await db.transaction("rw", db.items, db.contents, db.deletions, async () => {
    const toDelete: string[] = [id];
    let i = 0;
    while (i < toDelete.length) {
      const kids = await db.items
        .where("parentId")
        .equals(toDelete[i])
        .toArray();
      for (const child of kids) {
        toDelete.push(child.id);
      }
      i++;
    }
    await db.contents.where("fileId").anyOf(toDelete).delete();
    await db.items.where("id").anyOf(toDelete).delete();
    const now = Date.now();
    await db.deletions.bulkPut(
      toDelete.map((id) => ({ id, deletedAt: now }))
    );
  });
}
