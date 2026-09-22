import type { WorkspaceItem } from "./types";

/** Folders before files, then case-insensitive alphabetical by name. */
export function compareWorkspaceItems(
  a: WorkspaceItem,
  b: WorkspaceItem
): number {
  if (a.type !== b.type) {
    return a.type === "folder" ? -1 : 1;
  }
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}
