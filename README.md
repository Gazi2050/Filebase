# Filebase

Local-first workspace explorer and notebook. Files and folders are stored in the browser using Dexie and IndexedDB, with no backend or account required.

## How to run the project

Clone the repository and install dependencies. pnpm is the primary package manager for this repo, but npm and yarn work as well.

```bash
git clone https://github.com/Gazi2050/Filebase.git
cd Filebase
pnpm install
pnpm run dev
```

If you are using npm or yarn:

```bash
npm install && npm run dev
# or
yarn install && yarn dev
```

The app runs locally at http://localhost:3000.

To run a production build:

```bash
pnpm run build
pnpm run start
```

## Project structure

```text
app/
  favicon.ico                 # App favicon
  globals.css                 # CSS variables, dark theme tokens, Tailwind v4 setup
  layout.tsx                  # Root layout, fonts, and TooltipProvider / Toaster wrappers
  page.tsx                    # Main workspace layout, header breadcrumbs, editor, command palette
components/
  folder/
    folder-view.tsx           # Folder card grid, folder title rename, and child item list
  layout/
    app-sidebar.tsx           # Sidebar container, explorer header, and new file/folder buttons
  modals/
    delete-confirm-dialog.tsx # Modal dialog confirming cascading deletions
  shared/
    inline-name-input.tsx     # Reusable text input for inline file and folder naming
  sidebar/
    file-tree.tsx             # Headless tree view, context menu, and FileTreeNode row renderer
  ui/
    alert-dialog.tsx          # Base alert dialog primitive
    breadcrumb.tsx            # Header breadcrumb navigation primitive
    button.tsx                # Button component with size and variant variants
    command.tsx               # Command palette dialog and search input
    context-menu.tsx          # Right-click context menu primitive
    dialog.tsx                # Modal dialog primitives
    kbd.tsx                   # Keyboard shortcut badge primitive
    sheet.tsx                 # Mobile sidebar sheet overlay primitive
    sidebar.tsx               # Collapsible desktop and mobile sidebar primitives
    toast.tsx                 # Toast notifications wrapper
    tooltip.tsx               # Tooltip primitive
hooks/
  use-before-unload-guard.ts  # Browser beforeunload prompt when editor has unsaved changes
  use-inline-name.ts          # Input focus, text range selection, and Enter/Escape key handlers
  use-keyboard-shortcuts.ts   # Window keydown listeners for Ctrl+K, Ctrl+S, and Ctrl+B
  use-mobile.ts               # matchMedia hook for switching mobile sidebar state
lib/
  db.ts                       # Dexie database setup, items/contents tables, and CRUD helpers
  items.ts                    # Comparator sorting folders before files, then alphabetically
  store/
    use-workspace-store.ts    # Single Zustand store holding workspace state and actions
  types.ts                    # WorkspaceItem, FileContent, and ItemType type definitions
  utils.ts                    # cn helper merging clsx and tailwind-merge
```

## State management approach

All client-side state lives in a single Zustand store in `lib/store/use-workspace-store.ts`.

The store holds:

- The full list of workspace items (`items: WorkspaceItem[]`)
- The active file ID, active file text content, last saved content, and `isDirty` flag
- The selected item ID and selected folder ID
- Expanded folder IDs for the sidebar tree (`expandedItemIds: string[]`)
- Transient UI state: `inlineCreate` target, `renamingItemId`, `itemToDelete`, `errorMessage`, and `isSaving`

IndexedDB is the primary source of truth. Mutations do not optimistically invent state; store actions write to IndexedDB first (`addItem`, `dbRenameItem`, `dbDeleteItem`, `saveFileContent`), and once the write succeeds, the store calls `fetchAllItems()` from Dexie to refresh in-memory state.

Typing in the note editor updates `activeFileContent` and sets `isDirty: true` in memory. This text buffer is flushed to IndexedDB in two situations:

1. Explicit save: User presses Ctrl+S or clicks the Save button, calling `saveActiveFile()`.
2. Navigation flush: When the user selects another file (`selectItem`) or folder (`openFolder`), `flushDirtySave()` writes the dirty buffer of the previous file to IndexedDB before switching targets.

## File-system data structure

The file system uses a flat adjacency list rather than a deeply nested tree. Every folder and file is an individual record pointing to its parent via `parentId`.

The core interface in `lib/types.ts`:

```ts
export type ItemType = "folder" | "file";

export interface WorkspaceItem {
  id: string;
  name: string;
  type: ItemType;
  parentId: string | null;
  createdAt: number;
  updatedAt: number;
}
```

The workspace root is a folder with `id: "root"` and `parentId: null`. Child files and folders point to their direct container's ID in `parentId`.

Data is split across two IndexedDB tables in `lib/db.ts`:

- `items`: Stores item metadata (`id, parentId, type, name, createdAt`).
- `contents`: Stores file body text (`fileId, updatedAt`), keyed by `fileId`.

This separation keeps metadata queries lightweight. Rendering the tree, navigating folders, and showing breadcrumbs only reads the `items` table. Text content is only fetched from the `contents` table when a specific file is opened into the editor.

## Important implementation decisions

- Shared inline input: The sidebar tree and folder card views share the exact same `InlineNameInput` component. Reusing a single input prevents blur-event race conditions between the tree and the main panel, while keeping validation (empty string checks and case-insensitive sibling name collisions) in one place.
- Navigation autosave and dirty tracking: Edits set `isDirty` instantly. Instead of discarding unsaved edits when a user clicks around the tree, `flushDirtySave` runs before changing the active file. A `beforeunload` window listener blocks accidental tab closure while `isDirty` is true.
- Cascading delete transactions: Deleting a folder gathers all descendant folder and file IDs using a breadth-first queue over `parentId`. It then deletes all matching rows from both `items` and `contents` inside a single Dexie read-write transaction. If the active file was inside the deleted branch, the editor resets cleanly and navigates to the nearest surviving parent.
- Single-flight initialization: React 19 StrictMode runs mount effects twice during development. A module-level `initPromise` variable in `use-workspace-store.ts` caches the initial database seed, preventing duplicate `bulkAdd` calls from throwing errors on initial load.
