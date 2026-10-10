"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Link2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { authClient } from "@/lib/auth-client";
import type { ShareLink } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface ShareTarget {
  id: string;
  name: string;
}

interface ShareDialogProps {
  file: ShareTarget | null;
  onOpenChange: (open: boolean) => void;
}

const shareUrl = (token: string) =>
  `${window.location.origin}/s/${token}`;

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function ShareDialog({ file, onOpenChange }: ShareDialogProps) {
  const { data: session } = authClient.useSession();
  const [shares, setShares] = useState<ShareLink[]>([]);
  const [permission, setPermission] = useState<"read" | "write">("read");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/shares?fileId=${encodeURIComponent(file.id)}`);
      const data = (await res.json()) as { shares?: ShareLink[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not load share links.");
      setShares(data.shares ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load share links.");
    } finally {
      setLoading(false);
    }
  }, [file]);

  useEffect(() => {
    if (file && session?.user) {
      // Fetch-on-open inside an effect: the dialog has no open-event with a
      // settled session, and load() only touches request state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void load();
    }
  }, [file, session, load]);

  const create = async () => {
    if (!file) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/shares", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fileId: file.id, permission }),
      });
      const data = (await res.json()) as { share?: ShareLink; error?: string };
      if (!res.ok || !data.share) throw new Error(data.error ?? "Could not create link.");
      setShares((prev) => [data.share!, ...prev]);
      if (await copyText(shareUrl(data.share.token))) {
        setCopiedId(data.share.id);
        setTimeout(() => setCopiedId(null), 2000);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create link.");
    } finally {
      setCreating(false);
    }
  };

  const setPerm = async (share: ShareLink, next: "read" | "write") => {
    if (share.permission === next || share.revokedAt) return;
    setError(null);
    try {
      const res = await fetch(`/api/shares/${share.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ permission: next }),
      });
      const data = (await res.json()) as { share?: ShareLink; error?: string };
      if (!res.ok || !data.share) throw new Error(data.error ?? "Could not update link.");
      setShares((prev) => prev.map((s) => (s.id === share.id ? data.share! : s)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update link.");
    }
  };

  const revoke = async (share: ShareLink) => {
    setError(null);
    try {
      const res = await fetch(`/api/shares/${share.id}`, { method: "DELETE" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not revoke link.");
      setShares((prev) =>
        prev.map((s) => (s.id === share.id ? { ...s, revokedAt: Date.now() } : s))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not revoke link.");
    }
  };

  const copy = async (share: ShareLink) => {
    if (await copyText(shareUrl(share.token))) {
      setCopiedId(share.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  return (
    <Dialog open={file !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="size-4" />
            Share{file ? ` “${file.name}”` : ""}
          </DialogTitle>
          <DialogDescription>
            Anyone with the link can open this file. Links work for signed-in
            and anonymous visitors; you can revoke them anytime.
          </DialogDescription>
        </DialogHeader>

        {!session?.user ? (
          <p className="text-sm text-muted-foreground">
            Sign in to create share links for your files.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <div className="flex rounded-md border p-0.5 text-xs font-medium">
                {(["read", "write"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPermission(p)}
                    className={cn(
                      "rounded px-2.5 py-1 cursor-pointer",
                      permission === p
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {p === "read" ? "Can view" : "Can edit"}
                  </button>
                ))}
              </div>
              <Button
                size="sm"
                onClick={create}
                disabled={creating}
                className="ml-auto cursor-pointer"
              >
                {creating && <Loader2 className="size-3.5 animate-spin" />}
                New link
              </Button>
            </div>

            {error && (
              <p className="text-destructive text-xs font-medium">{error}</p>
            )}

            {loading ? (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" /> Loading links…
              </p>
            ) : shares.length === 0 && !error ? (
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground">
                  No links yet. Create one above — it copies to your clipboard.
                </p>
                <Button
                  variant="ghost"
                  size="xs"
                  className="ml-auto h-6 cursor-pointer px-1.5 text-[11px]"
                  onClick={() => load()}
                >
                  Refresh
                </Button>
              </div>
            ) : shares.length === 0 ? null : (
              <ul className="flex max-h-64 flex-col gap-2 overflow-y-auto">
                {shares.map((share) => (
                  <li
                    key={share.id}
                    className={cn(
                      "flex flex-col gap-2 rounded-md border px-3 py-2",
                      share.revokedAt && "opacity-50"
                    )}
                  >
                    <div className="flex items-center gap-2 text-xs">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 font-medium",
                          share.revokedAt
                            ? "bg-muted text-muted-foreground"
                            : share.permission === "write"
                              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                              : "bg-sky-500/15 text-sky-600 dark:text-sky-400"
                        )}
                      >
                        {share.revokedAt
                          ? "Revoked"
                          : share.permission === "write"
                            ? "Can edit"
                            : "Can view"}
                      </span>
                      <span className="text-muted-foreground">
                        {new Date(share.createdAt).toLocaleDateString()}
                      </span>
                      {!share.revokedAt && (
                        <div className="ml-auto flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="xs"
                            className="h-6 cursor-pointer px-1.5 text-[11px]"
                            onClick={() =>
                              setPerm(share, share.permission === "read" ? "write" : "read")
                            }
                            title="Switch permission"
                          >
                            {share.permission === "read" ? "Allow editing" : "Make view-only"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="xs"
                            className="h-6 cursor-pointer px-1.5 text-[11px] text-destructive hover:text-destructive"
                            onClick={() => revoke(share)}
                          >
                            Revoke
                          </Button>
                          <Button
                            variant="ghost"
                            size="xs"
                            className="h-6 w-6 cursor-pointer p-0"
                            onClick={() => copy(share)}
                            title="Copy link"
                          >
                            {copiedId === share.id ? (
                              <Check className="size-3.5" />
                            ) : (
                              <Copy className="size-3.5" />
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                    {!share.revokedAt && (
                      <code className="truncate rounded bg-muted/60 px-2 py-1 text-[11px] text-muted-foreground">
                        /s/{share.token.slice(0, 12)}…
                      </code>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
