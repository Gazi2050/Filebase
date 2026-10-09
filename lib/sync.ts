import { create } from "zustand";

import { db, ROOT_ITEM_ID } from "@/lib/db";
import { incomingShouldWin } from "@/lib/sync-rules";
import { useWorkspaceStore } from "@/lib/store/use-workspace-store";
import type { Deletion, FileContent, WorkspaceItem } from "@/lib/types";

export type SyncStatus = "local" | "syncing" | "synced" | "offline";

interface SyncState {
  status: SyncStatus;
  lastSyncedAt: number | null;
  signedIn: boolean;
}

export const useSyncStore = create<SyncState>(() => ({
  status: "local",
  lastSyncedAt: null,
  signedIn: false,
}));

interface SyncResponse {
  now: number;
  items: WorkspaceItem[];
  contents: FileContent[];
  deletions: Deletion[];
}

let inFlight: Promise<void> | null = null;
let scheduled: ReturnType<typeof setTimeout> | null = null;

/** Debounced sync — safe to call after every save. */
export function scheduleSync(delayMs = 800): void {
  if (scheduled) clearTimeout(scheduled);
  scheduled = setTimeout(() => {
    scheduled = null;
    void syncNow();
  }, delayMs);
}

/** Single-flight sync: pushes local changes, pulls remote changes (LWW). */
export function syncNow(): Promise<void> {
  if (inFlight) return inFlight;
  inFlight = runSync().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function runSync(): Promise<void> {
  const { signedIn } = useSyncStore.getState();
  if (!signedIn) return;

  useSyncStore.setState({ status: "syncing" });
  try {
    const lastSyncedAt = (await db.meta.get("sync"))?.lastSyncedAt ?? 0;
    const [items, contents, deletions] = await Promise.all([
      db.items.toArray(),
      db.contents.where("updatedAt").above(lastSyncedAt).toArray(),
      db.deletions.where("deletedAt").above(lastSyncedAt).toArray(),
    ]);

    const res = await fetch("/api/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        lastSyncedAt,
        items: items.filter(
          (i) => i.id !== ROOT_ITEM_ID && i.updatedAt > lastSyncedAt
        ),
        contents,
        deletions,
      }),
    });

    if (res.status === 401) {
      useSyncStore.setState({ signedIn: false, status: "local" });
      return;
    }
    if (!res.ok) throw new Error(`sync failed: ${res.status}`);

    const data = (await res.json()) as SyncResponse;
    await applyPull(data);
    await db.meta.put({ key: "sync", lastSyncedAt: data.now });
    useSyncStore.setState({ status: "synced", lastSyncedAt: data.now });
    await useWorkspaceStore.getState().refreshFromDb();
  } catch {
    useSyncStore.setState({ status: "offline" });
  }
}

async function applyPull(data: SyncResponse): Promise<void> {
  const { activeFileId } = useWorkspaceStore.getState();

  const tombstones = new Map(
    (await db.deletions.toArray()).map((d) => [d.id, d.deletedAt])
  );

  // Remote deletions first, so later rows can't resurrect deleted items.
  for (const d of data.deletions ?? []) {
    const known = tombstones.get(d.id);
    if (known !== undefined && known >= d.deletedAt) continue;
    await db.transaction("rw", db.items, db.contents, db.deletions, async () => {
      await db.items.delete(d.id);
      await db.contents.delete(d.id);
      await db.deletions.put(d);
    });
    tombstones.set(d.id, d.deletedAt);
  }

  for (const item of data.items ?? []) {
    const local = await db.items.get(item.id);
    if (!incomingShouldWin(local?.updatedAt, item.updatedAt, tombstones.get(item.id))) {
      continue;
    }
    await db.items.put(item);
  }

  for (const content of data.contents ?? []) {
    // ponytail: the actively-open file is skipped — the editor is
    // uncontrolled after mount, so a remote overwrite wouldn't render
    // anyway; the next local save wins the LWW race instead. Upgrade:
    // live-collab (M3) replaces this file's sync path entirely.
    if (content.fileId === activeFileId) continue;
    const local = await db.contents.get(content.fileId);
    if (
      !incomingShouldWin(
        local?.updatedAt,
        content.updatedAt,
        tombstones.get(content.fileId)
      )
    ) {
      continue;
    }
    await db.contents.put(content);
  }

  // Tombstones older than 30 days have propagated everywhere; drop them.
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  await db.deletions.where("deletedAt").below(cutoff).delete();
}
