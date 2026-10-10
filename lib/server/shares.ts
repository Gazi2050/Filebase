import { randomBytes } from "node:crypto";

import { ensureAppSchema, getDb } from "./db";
import {
  isShareTokenFormat,
  normalizeSharePermission,
  type SharePermission,
} from "../share-links";
import type { ShareLink, ShareResolution } from "../types";

/**
 * Owner-managed public share links. The token is a bearer credential:
 * whoever holds the URL gets the link's permission until the owner
 * revokes it or narrows it to read-only. Tokens are never logged.
 */
export class ShareError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** 256-bit random token, base64url (43 chars, URL-safe, unguessable). */
export function generateShareToken(): string {
  return randomBytes(32).toString("base64url");
}

const MAX_SHARED_CONTENT_BYTES = 5 * 1024 * 1024;

const toLink = (r: Record<string, unknown>): ShareLink => ({
  id: r.id as string,
  fileId: r.file_id as string,
  permission: normalizeSharePermission(r.permission),
  token: r.token as string,
  createdAt: r.created_at as number,
  revokedAt: (r.revoked_at as number | null) ?? null,
});

async function assertOwnedFile(ownerId: string, fileId: string): Promise<void> {
  const db = getDb();
  const rows = await db.execute({
    sql: "SELECT id FROM files WHERE id = ? AND user_id = ?",
    args: [fileId, ownerId],
  });
  if (rows.rows.length === 0) {
    throw new ShareError(404, "file not found");
  }
}

export async function createShare(
  ownerId: string,
  fileId: string,
  permission: unknown
): Promise<ShareLink> {
  const perm: SharePermission = normalizeSharePermission(permission);
  await ensureAppSchema();
  await assertOwnedFile(ownerId, fileId);
  const now = Date.now();
  const link: ShareLink = {
    id: `share-${now}-${Math.random().toString(36).slice(2, 8)}`,
    fileId,
    permission: perm,
    token: generateShareToken(),
    createdAt: now,
    revokedAt: null,
  };
  await getDb().execute({
    sql: `INSERT INTO shares (id, file_id, owner_id, token, permission, created_at, revoked_at)
          VALUES (?, ?, ?, ?, ?, ?, NULL)`,
    args: [link.id, link.fileId, ownerId, link.token, link.permission, link.createdAt],
  });
  return link;
}

export async function listShares(
  ownerId: string,
  fileId: string
): Promise<ShareLink[]> {
  await ensureAppSchema();
  await assertOwnedFile(ownerId, fileId);
  const rows = await getDb().execute({
    sql: `SELECT id, file_id, permission, token, created_at, revoked_at
          FROM shares WHERE file_id = ? AND owner_id = ? ORDER BY created_at DESC`,
    args: [fileId, ownerId],
  });
  return rows.rows.map((r) => toLink(r as Record<string, unknown>));
}

export async function setSharePermission(
  ownerId: string,
  shareId: string,
  permission: unknown
): Promise<ShareLink> {
  const perm = normalizeSharePermission(permission);
  await ensureAppSchema();
  const updated = await getDb().execute({
    sql: "UPDATE shares SET permission = ? WHERE id = ? AND owner_id = ? AND revoked_at IS NULL",
    args: [perm, shareId, ownerId],
  });
  if (updated.rowsAffected === 0) {
    throw new ShareError(404, "share not found");
  }
  const rows = await getDb().execute({
    sql: "SELECT id, file_id, permission, token, created_at, revoked_at FROM shares WHERE id = ?",
    args: [shareId],
  });
  return toLink(rows.rows[0] as Record<string, unknown>);
}

export async function revokeShare(
  ownerId: string,
  shareId: string
): Promise<void> {
  await ensureAppSchema();
  const updated = await getDb().execute({
    sql: "UPDATE shares SET revoked_at = ? WHERE id = ? AND owner_id = ? AND revoked_at IS NULL",
    args: [Date.now(), shareId, ownerId],
  });
  if (updated.rowsAffected === 0) {
    throw new ShareError(404, "share not found");
  }
}

/** Public resolution: valid token → snapshot, revoked/unknown → invalid, deleted file → gone. */
export async function resolveShareToken(token: string): Promise<ShareResolution> {
  await ensureAppSchema();
  if (!isShareTokenFormat(token)) return { kind: "invalid" };
  const db = getDb();
  const shareRows = await db.execute({
    sql: "SELECT id, file_id, owner_id, permission, token, created_at, revoked_at FROM shares WHERE token = ?",
    args: [token],
  });
  const shareRow = shareRows.rows[0] as Record<string, unknown> | undefined;
  if (!shareRow || shareRow.revoked_at != null) return { kind: "invalid" };
  const link = toLink(shareRow);
  const ownerId = shareRow.owner_id as string;

  const fileRows = await db.execute({
    sql: "SELECT name FROM files WHERE id = ? AND user_id = ?",
    args: [link.fileId, ownerId],
  });
  const fileRow = fileRows.rows[0] as Record<string, unknown> | undefined;
  if (!fileRow) return { kind: "gone" };

  const contentRows = await db.execute({
    sql: "SELECT content, updated_at FROM file_contents WHERE file_id = ? AND user_id = ?",
    args: [link.fileId, ownerId],
  });
  const contentRow = contentRows.rows[0] as Record<string, unknown> | undefined;

  let ownerName: string | null = null;
  try {
    const userRows = await db.execute({
      sql: "SELECT name FROM user WHERE id = ?",
      args: [ownerId],
    });
    ownerName = (userRows.rows[0]?.name as string | null) ?? null;
  } catch {
    ownerName = null;
  }

  return {
    kind: "ok",
    snapshot: {
      fileId: link.fileId,
      fileName: fileRow.name as string,
      content: (contentRow?.content as string | undefined) ?? "",
      contentUpdatedAt: (contentRow?.updated_at as number | undefined) ?? 0,
      permission: link.permission,
      ownerName,
    },
  };
}

export async function saveSharedContent(
  token: string,
  content: unknown,
  baseUpdatedAt: unknown
): Promise<{ updatedAt: number } | { conflict: true; currentUpdatedAt: number }> {
  await ensureAppSchema();
  if (typeof content !== "string") throw new ShareError(400, "content must be a string");
  if (content.length > MAX_SHARED_CONTENT_BYTES) {
    throw new ShareError(413, "content too large");
  }
  const base = Number(baseUpdatedAt);
  if (!Number.isFinite(base)) throw new ShareError(400, "baseUpdatedAt is required");
  if (!isShareTokenFormat(token)) throw new ShareError(404, "share not found");

  const db = getDb();
  const shareRows = await db.execute({
    sql: "SELECT file_id, owner_id, permission FROM shares WHERE token = ? AND revoked_at IS NULL",
    args: [token],
  });
  const share = shareRows.rows[0] as Record<string, unknown> | undefined;
  if (!share) throw new ShareError(404, "share not found");
  if (share.permission !== "write") throw new ShareError(403, "this link is read-only");

  const fileId = share.file_id as string;
  const ownerId = share.owner_id as string;
  const current = await db.execute({
    sql: "SELECT updated_at FROM file_contents WHERE file_id = ? AND user_id = ?",
    args: [fileId, ownerId],
  });
  const currentUpdatedAt = current.rows[0]?.updated_at as number | undefined;
  if (currentUpdatedAt !== undefined && currentUpdatedAt > base) {
    return { conflict: true, currentUpdatedAt };
  }
  const fileExists = await db.execute({
    sql: "SELECT id FROM files WHERE id = ? AND user_id = ?",
    args: [fileId, ownerId],
  });
  if (fileExists.rows.length === 0) throw new ShareError(410, "file was deleted");

  const now = Date.now();
  await db.execute({
    sql: `INSERT INTO file_contents (file_id, user_id, content, updated_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT (file_id, user_id) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at`,
    args: [fileId, ownerId, content, now],
  });
  await db.execute({
    sql: "UPDATE files SET updated_at = ? WHERE id = ? AND user_id = ?",
    args: [now, fileId, ownerId],
  });
  return { updatedAt: now };
}
