import type { WorkspaceItem } from "./types";

export function compareWorkspaceItems(
  a: WorkspaceItem,
  b: WorkspaceItem
): number {
  if (a.type !== b.type) {
    return a.type === "folder" ? -1 : 1;
  }
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

/**
 * Migration helper: files no longer carry extensions. Returns the name with
 * a trailing extension stripped, or null when the name should stay as-is
 * (no extension-like suffix, or the base name is already taken by a
 * sibling). An extension is a 1–5 char alphanumeric suffix — "notes.txt"
 * strips, ".hidden" and "v1.2 notes" don't.
 */
export function stripExtension(name: string, takenLower: Set<string>): string | null {
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return null;
  const base = name.slice(0, dot);
  const ext = name.slice(dot + 1);
  if (!base.trim() || !/^[a-z0-9]{1,5}$/i.test(ext)) return null;
  if (takenLower.has(base.toLowerCase())) return null;
  return base;
}
