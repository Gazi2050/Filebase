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
