"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  ClientSideSuspense,
  LiveblocksProvider,
  RoomProvider,
  useOthers,
  useRoom,
  useSelf,
} from "@liveblocks/react";
import { getYjsProviderForRoom } from "@liveblocks/yjs";
import type { JSONContent } from "@tiptap/core";
import * as Y from "yjs";

import { SimpleDocumentEditor } from "@/components/templates/simple-document-editor";
import { parseDocContent } from "@/lib/doc-content";
import {
  getOrCreateGuestProfile,
  type GuestProfile,
} from "@/lib/guest-identity";
import { roomIdForFile } from "@/lib/share-links";
import type { SharedDocumentSnapshot } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface SharedPlatformUser {
  name: string;
  avatar?: string;
}

interface SharedEditorClientProps {
  token: string;
  snapshot: SharedDocumentSnapshot;
  platformUser: SharedPlatformUser | null;
}

const AVATAR_COLORS = [
  "#7c3aed",
  "#2563eb",
  "#059669",
  "#ea580c",
  "#db2777",
  "#0891b2",
  "#65a30d",
  "#b45309",
];

function colorFromString(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "?";

function PresenceAvatars() {
  const others = useOthers();
  const self = useSelf();
  const people = [
    ...(self
      ? [{ name: (self.presence.name as string) ?? "You", color: (self.presence.color as string) ?? "#666", avatar: self.presence.avatar as string | undefined, you: true }]
      : []),
    ...others.map((o) => ({
      name: (o.presence.name as string) ?? "Guest",
      color: (o.presence.color as string) ?? "#666",
      avatar: o.presence.avatar as string | undefined,
      you: false,
    })),
  ];
  if (people.length === 0) return null;
  return (
    <div className="flex items-center">
      {people.slice(0, 8).map((p, i) => (
        <span
          key={`${p.name}-${i}`}
          title={p.you ? `${p.name} (you)` : p.name}
          style={{ backgroundColor: p.avatar ? undefined : p.color, zIndex: 10 - i }}
          className="-ml-1.5 flex size-7 items-center justify-center overflow-hidden rounded-full text-[10px] font-semibold text-white ring-2 ring-background first:ml-0"
        >
          {p.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.avatar} alt={p.name} className="size-full object-cover" />
          ) : (
            initials(p.name)
          )}
        </span>
      ))}
      {people.length > 8 && (
        <span className="-ml-1.5 flex size-7 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground ring-2 ring-background">
          +{people.length - 8}
        </span>
      )}
    </div>
  );
}

type SaveState = "saved" | "saving" | "conflict" | "error";

function CollabRoom({
  token,
  snapshot,
  writable,
}: {
  token: string;
  snapshot: SharedDocumentSnapshot;
  writable: boolean;
}) {
  const room = useRoom();
  const [ydoc] = useState(() => new Y.Doc());
  const [provider] = useState(() => getYjsProviderForRoom(room));
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const baseRef = useRef(snapshot.contentUpdatedAt);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef<string | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      try {
        provider.destroy();
      } catch {
        // room teardown already handled it
      }
      ydoc.destroy();
    },
    [provider, ydoc]
  );

  const initialContent = useMemo(
    () => parseDocContent(snapshot.content),
    [snapshot.content]
  );

  const flush = useCallback(async () => {
    const content = latestRef.current;
    if (!content) return;
    try {
      const res = await fetch(`/api/shared/${token}/save`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content, baseUpdatedAt: baseRef.current }),
      });
      if (res.status === 409) {
        setSaveState("conflict");
        return;
      }
      const data = (await res.json()) as { updatedAt?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? "save failed");
      baseRef.current = data.updatedAt ?? Date.now();
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }, [token]);

  const handleChange = useCallback(
    (content: JSONContent) => {
      if (!writable) return;
      // ponytail: JSON.stringify per keystroke — fine at personal-doc
      // scale; swap for incremental serialization if profiling says so.
      latestRef.current = JSON.stringify(content);
      setSaveState("saving");
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void flush(), 1200);
    },
    [writable, flush]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-11 shrink-0 items-center gap-2.5 border-b px-3.5">
        <Link href="/" className="text-xs font-semibold tracking-wider text-muted-foreground hover:text-foreground">
          FILEBASE
        </Link>
        <span className="max-w-[30vw] truncate text-sm font-medium">{snapshot.fileName}</span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px] font-medium",
            writable
              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              : "bg-sky-500/15 text-sky-600 dark:text-sky-400"
          )}
        >
          {writable ? "Can edit" : "View only"}
        </span>
        {snapshot.ownerName && (
          <span className="hidden text-xs text-muted-foreground sm:inline">
            Shared by {snapshot.ownerName}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2.5">
          {writable && (
            <span className="text-xs text-muted-foreground">
              {saveState === "saving"
                ? "Saving…"
                : saveState === "saved"
                  ? "Saved"
                  : saveState === "conflict"
                    ? "Newer version available"
                    : "Save failed — retrying on next edit"}
            </span>
          )}
          <PresenceAvatars />
        </div>
      </div>

      {saveState === "conflict" && (
        <div className="flex shrink-0 items-center gap-2 border-b bg-amber-500/10 px-3.5 py-2 text-xs text-amber-700 dark:text-amber-300">
          <span>The owner saved a newer version. Reload to see it — your edits stay in this session.</span>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="ml-auto cursor-pointer rounded border px-2 py-0.5 font-medium hover:bg-amber-500/20"
          >
            Reload
          </button>
        </div>
      )}

      {!writable && (
        <div className="flex shrink-0 items-center border-b bg-muted/40 px-3.5 py-1.5 text-xs text-muted-foreground">
          You have view-only access to this document.
        </div>
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden p-3 sm:p-6">
        <SimpleDocumentEditor
          className="min-h-0 w-full flex-1"
          initialContent={initialContent}
          onChange={handleChange}
          collaboration={{ ydoc }}
          readOnly={!writable}
        />
      </div>
    </div>
  );
}

export function SharedEditorClient({
  token,
  snapshot,
  platformUser,
}: SharedEditorClientProps) {
  // Guest identity needs localStorage, so the live room only mounts on the
  // client. useSyncExternalStore keeps server and first client render
  // identical (no hydration mismatch) without setState-in-effect.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const guest: GuestProfile | null = useMemo(() => {
    if (!mounted || platformUser) return null;
    return getOrCreateGuestProfile(token);
  }, [mounted, platformUser, token]);

  const roomId = roomIdForFile(snapshot.fileId);
  const presence = useMemo(
    () =>
      platformUser
        ? {
            name: platformUser.name,
            color: colorFromString(platformUser.name),
            avatar: platformUser.avatar,
          }
        : { name: guest?.name ?? "Guest", color: guest?.color ?? "#666" },
    [platformUser, guest]
  );

  const authEndpoint = useCallback(
    async (room?: string) => {
      const res = await fetch("/api/liveblocks-auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ room: room ?? "", token, guest: guest ?? undefined }),
      });
      if (!res.ok) throw new Error("not authorized for this document");
      return (await res.json()) as { token: string };
    },
    [token, guest]
  );

  if (!mounted) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">
        Loading shared document…
      </div>
    );
  }

  return (
    <LiveblocksProvider authEndpoint={authEndpoint}>
      <RoomProvider id={roomId} initialPresence={presence}>
        <ClientSideSuspense
          fallback={
            <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">
              Connecting to live session…
            </div>
          }
        >
          {() => (
            <div className="flex h-screen flex-col overflow-hidden bg-background">
              <CollabRoom
                token={token}
                snapshot={snapshot}
                writable={snapshot.permission === "write"}
              />
            </div>
          )}
        </ClientSideSuspense>
      </RoomProvider>
    </LiveblocksProvider>
  );
}
