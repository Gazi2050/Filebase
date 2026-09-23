# Filebase

A local-first workspace explorer and notebook built with Next.js 16, React 19, TypeScript, Tailwind CSS v4, Dexie (IndexedDB), and Zustand. All data is stored locally in the browser with zero backend dependencies.

## Getting Started (Local Development)

1. **Clone the repository**

   ```bash
   git clone https://github.com/Gazi2050/Filebase.git

   cd Filebase
   ```

2. **Install dependencies**

   Make sure you have [pnpm](https://pnpm.io/) installed (recommended, though `npm` and `yarn` also work). Then run:

   ```bash
   pnpm install
   ```

3. **Start the development server**

   ```bash
   pnpm run dev
   ```

✅ The app will be running at `http://localhost:3000`

---

## Project Structure

```text
app/
  globals.css                 # Theme tokens & Tailwind styles
  layout.tsx                  # Root layout & providers
  page.tsx                    # Main layout: header, breadcrumbs, editor, palette
components/
  folder/folder-view.tsx      # Folder grid cards & actions
  layout/app-sidebar.tsx      # Explorer sidebar shell
  modals/delete-confirm-dialog.tsx # Cascading delete confirmation modal
  shared/inline-name-input.tsx     # Reusable inline rename & create input
  sidebar/file-tree.tsx       # Headless tree view & item renderer
  ui/                         # Active UI primitives (button, dialog, kbd, etc.)
hooks/
  use-before-unload-guard.ts  # Browser prompt on unsaved edits
  use-inline-name.ts          # Autofocus, Enter/Escape & blur handling
  use-keyboard-shortcuts.ts   # Global shortcuts (Ctrl+K, Ctrl+S, Ctrl+B)
  use-mobile.ts               # Responsive viewport breakpoint detection
lib/
  db.ts                       # Dexie IndexedDB schema, seeding, and CRUD
  items.ts                    # Item sort comparator (folders first)
  types.ts                    # Core interfaces (WorkspaceItem, FileContent)
  utils.ts                    # Class merging helper
  store/use-workspace-store.ts # Zustand store for workspace state
```

---

## State Management Approach

A single [Zustand](https://github.com/pmndrs/zustand) store (`use-workspace-store.ts`) manages all workspace state:

- Hierarchy, items, and expanded folder IDs
- Active file, content buffer, and dirty-tracking (`activeFileContent` vs `lastSavedContent`)
- Selected item and current folder
- Transient UI state (inline creation, renaming, delete modals, errors)

**IndexedDB as source of truth:** Store actions persist mutations to IndexedDB (via Dexie) first, then update in-memory state. When switching between files, the store automatically flushes pending edits so changes are never lost.

---

## File-System Data Structure

The workspace uses an **adjacency list** model stored as flat records with parent pointers rather than a nested tree:

```ts
interface WorkspaceItem {
  id: string;
  name: string;
  type: "file" | "folder";
  parentId: string | null;
  createdAt: number;
  updatedAt: number;
}
```

Stored across two IndexedDB tables:

- `items`: Metadata (`id`, `name`, `type`, `parentId`, timestamps)
- `contents`: File body text (`fileId`, `content`, `updatedAt`)

Separating metadata from file bodies keeps tree rendering fast, only fetching content when a file is opened.

---

## Important Implementation Decisions

- **Single Inline Input:** The sidebar tree and folder cards share one `InlineNameInput` component, eliminating focus-blur race conditions and keeping naming validation consistent (non-empty, case-insensitive collision check).
- **Navigation Auto-Save & Dirty State:** Keystrokes immediately flag dirty state (`Save *`, pulsing breadcrumb indicator). Navigating away flushes pending changes, while `beforeunload` prevents accidental tab closure.
- **Cascading Atomic Deletes:** Deleting a folder recursively collects all descendant records and removes both metadata and content within a single Dexie transaction.
- **Single-Flight Initialization:** A module-level promise singleton ensures React StrictMode's double-mount does not trigger duplicate database seeding.
