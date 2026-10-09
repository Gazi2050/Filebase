import { auth, ensureServer } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { incomingShouldWin } from "@/lib/sync-rules";
import type { Deletion, FileContent, WorkspaceItem } from "@/lib/types";

interface SyncRequestBody {
  lastSyncedAt: number;
  items: WorkspaceItem[];
  contents: FileContent[];
  deletions: Deletion[];
}

const toItem = (r: Record<string, unknown>): WorkspaceItem => ({
  id: r.id as string,
  name: r.name as string,
  type: r.type as WorkspaceItem["type"],
  parentId: (r.parent_id as string | null) ?? null,
  createdAt: r.created_at as number,
  updatedAt: r.updated_at as number,
});

export async function POST(req: Request) {
  await ensureServer();

  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const body = (await req.json()) as SyncRequestBody;
  const lastSyncedAt = Number(body.lastSyncedAt) || 0;
  const db = getDb();

  // --- Push: deletions first, then LWW merge of items and contents. ---
  for (const d of body.deletions ?? []) {
    await db.execute({
      sql: `INSERT INTO deletions (id, user_id, deleted_at) VALUES (?, ?, ?)
            ON CONFLICT (id, user_id) DO UPDATE SET deleted_at = MAX(deletions.deleted_at, excluded.deleted_at)`,
      args: [d.id, userId, d.deletedAt],
    });
  }

  const tombstoneRows = await db.execute({
    sql: "SELECT id, deleted_at FROM deletions WHERE user_id = ?",
    args: [userId],
  });
  const tombstones = new Map(
    tombstoneRows.rows.map((r) => [r.id as string, r.deleted_at as number])
  );

  for (const item of body.items ?? []) {
    if (!item?.id || item.id === "root") continue;
    const existing = await db.execute({
      sql: "SELECT updated_at FROM files WHERE id = ? AND user_id = ?",
      args: [item.id, userId],
    });
    const existingUpdatedAt = existing.rows[0]?.updated_at as
      | number
      | undefined;
    if (!incomingShouldWin(existingUpdatedAt, item.updatedAt, tombstones.get(item.id))) {
      continue;
    }
    await db.execute({
      sql: `INSERT INTO files (id, user_id, name, type, parent_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (id, user_id) DO UPDATE SET
              name = excluded.name, type = excluded.type,
              parent_id = excluded.parent_id, updated_at = excluded.updated_at`,
      args: [item.id, userId, item.name, item.type, item.parentId, item.createdAt, item.updatedAt],
    });
  }

  for (const content of body.contents ?? []) {
    if (!content?.fileId) continue;
    const existing = await db.execute({
      sql: "SELECT updated_at FROM file_contents WHERE file_id = ? AND user_id = ?",
      args: [content.fileId, userId],
    });
    const existingUpdatedAt = existing.rows[0]?.updated_at as
      | number
      | undefined;
    if (!incomingShouldWin(existingUpdatedAt, content.updatedAt, tombstones.get(content.fileId))) {
      continue;
    }
    await db.execute({
      sql: `INSERT INTO file_contents (file_id, user_id, content, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT (file_id, user_id) DO UPDATE SET
              content = excluded.content, updated_at = excluded.updated_at`,
      args: [content.fileId, userId, content.content, content.updatedAt],
    });
  }

  // --- Pull: everything newer than the client's last sync point. ---
  const [fileRows, contentRows, deletionRows] = await Promise.all([
    db.execute({
      sql: "SELECT id, name, type, parent_id, created_at, updated_at FROM files WHERE user_id = ? AND updated_at > ?",
      args: [userId, lastSyncedAt],
    }),
    db.execute({
      sql: "SELECT file_id, content, updated_at FROM file_contents WHERE user_id = ? AND updated_at > ?",
      args: [userId, lastSyncedAt],
    }),
    db.execute({
      sql: "SELECT id, deleted_at FROM deletions WHERE user_id = ? AND deleted_at > ?",
      args: [userId, lastSyncedAt],
    }),
  ]);

  const items: WorkspaceItem[] = fileRows.rows.map((r) => toItem(r));
  const contents: FileContent[] = contentRows.rows.map((r) => ({
    fileId: r.file_id as string,
    content: r.content as string,
    updatedAt: r.updated_at as number,
  }));
  const deletions: Deletion[] = deletionRows.rows.map((r) => ({
    id: r.id as string,
    deletedAt: r.deleted_at as number,
  }));

  return Response.json({ now: Date.now(), items, contents, deletions });
}
