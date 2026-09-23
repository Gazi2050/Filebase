# Filebase — Mini Workspace Explorer

A browser-based file manager where users can create, navigate, search, edit, rename, and delete
folders and text files. All data persists locally in the browser — no backend.

## How to Run

```bash
pnpm install
pnpm dev        # http://localhost:3000
```

Production build: `pnpm build && pnpm start`. Requires Node 20+ and pnpm.

## Project Structure

```
app/
  layout.tsx          # Root layout, fonts, metadata
  page.tsx            # Main panel: header, breadcrumbs, FolderView (cards), editor, command palette
components/
  layout/
    app-sidebar.tsx   # Sidebar shell: EXPLORER header, New File/New Folder buttons
  sidebar/
    file-tree.tsx     # Tree view (Headless Tree): hierarchy, inline create/rename, context menu
  modals/
    delete-confirm-dialog.tsx  # Delete confirmation (warns about nested contents)
lib/
  db.ts               # Dexie (IndexedDB) persistence layer: schema, seeding, CRUD
  store/
    use-workspace-store.ts  # Zustand store: all workspace state and actions
  types.ts            # WorkspaceItem / FileContent / ItemType types
hooks/
  use-mobile.ts       # Sidebar responsive behavior
```

## State Management Approach

A single [Zustand](https://github.com/pmndrs/zustand) store (`use-workspace-store`) holds all
workspace state: the item list, selection (selected item + folder), the active file with its
content, dirty-tracking (`activeFileContent` vs `lastSavedContent`), expanded tree nodes, and
transient UI state (inline create/rename, delete confirmation, validation errors).

Components call store actions; actions perform the Dexie write first, then re-read the affected
data and `set()` the new state — the database is always the source of truth, so UI and persistence
can never drift apart.

## File-System Data Structure

The workspace is a **flat table with parent references** (adjacency list), not nested objects:

```ts
interface WorkspaceItem {
  id: string; // e.g. "file-1726-4f2k1"
  name: string; // "notes.txt"
  type: "folder" | "file";
  parentId: string | null; // null = root ("root")
  createdAt: number;
  updatedAt: number;
}
```

Stored in IndexedDB via [Dexie](https://dexie.org) with two tables: `items` (indexed on `id`,
`parentId`, `type`, `name`) and `contents` (`fileId` → text). Arbitrarily deep nesting works
because hierarchy is derived by walking `parentId` chains — recursion only happens at the edges
(building the child map, recursive delete, breadcrumb traversal).

## Important Implementation Decisions

- **One creation input.** New files/folders are created inline in the sidebar tree (VS Code style).
  Keeping a single inline input avoids duplicate-focus edge cases and keeps one code path for
  validation (empty names are rejected; duplicate names within the same folder are rejected,
  case-insensitive, with an error toast).
- **Saving is explicit, with safety nets.** The editor tracks a dirty state (`Save *`, breadcrumb
  dot, `beforeunload` guard, `Ctrl/Cmd+S`). Navigation auto-saves pending changes so users never
  silently lose edits when moving around.
- **Deletes are confirmed and cascading.** Deleting a folder walks `parentId` transitively and
  removes all descendants plus their contents in one transaction. If the deleted item was selected
  (or an ancestor of the selection), the UI navigates to the nearest surviving parent.
- **Single-flight initialization.** Seeding runs only when the database is empty, guarded by a
  shared init promise so React StrictMode's double-mount (or a second tab) can't seed twice.
  The default open file is validated against real items on startup, so a deleted file can never
  reappear as an empty editor.
- **Search is a filtered index.** The command palette (`Ctrl/Cmd+K`) lists every file and folder
  regardless of depth and filters as you type; selecting a result opens it and reveals/expands it
  in the tree.
