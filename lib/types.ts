export type ItemType = "file" | "folder";

export interface WorkspaceItem {
  id: string;
  name: string;
  type: ItemType;
  parentId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface FileContent {
  fileId: string;
  content: string;
  updatedAt: number;
}

/** Tombstone for a deleted item, so deletions propagate across devices. */
export interface Deletion {
  id: string;
  deletedAt: number;
}

/** Single-row metadata table for the sync engine. */
export interface SyncMetaRow {
  key: "sync";
  lastSyncedAt: number;
}

/** Owner-managed public link for a file. Token is a bearer credential. */
export interface ShareLink {
  id: string;
  fileId: string;
  permission: "read" | "write";
  token: string;
  createdAt: number;
  revokedAt: number | null;
}

export interface SharedDocumentSnapshot {
  fileId: string;
  fileName: string;
  content: string;
  contentUpdatedAt: number;
  permission: "read" | "write";
  ownerName: string | null;
}

export type ShareResolution =
  | { kind: "ok"; snapshot: SharedDocumentSnapshot }
  | { kind: "invalid" }
  | { kind: "gone" };
