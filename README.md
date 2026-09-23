# Filebase

A local-first workspace explorer and notebook running entirely in the browser. Create folders, write notes, and organize your workspace with zero backend dependencies—all data is persisted locally in IndexedDB.

**Repository:** [https://github.com/Gazi2050/Filebase](https://github.com/Gazi2050/Filebase)

---

## How to Run

> **Note:** `pnpm` is recommended for package management, but `npm` or `yarn` also work.

```bash
# Clone the repository
git clone https://github.com/Gazi2050/Filebase.git
cd Filebase

# Install dependencies (pnpm recommended)
pnpm install
# or: npm install / yarn install

# Start development server
pnpm dev
# or: npm run dev / yarn dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

To create a production build:

```bash
pnpm build && pnpm start
```

---

## Project Structure

```text
app/
  globals.css          # Theme tokens & Tailwind styles
  layout.tsx           # Root layout, fonts, TooltipProvider
  page.tsx             # Main view: header, breadcrumbs, editor, command palette
components/
  folder/
    folder-view.tsx    # Card grid view for open folders
  layout/
    app-sidebar.tsx    # Sidebar shell & quick-action triggers
  modals/
    delete-confirm-dialog.tsx # Modal for confirming cascading item deletion
  shared/
    inline-name-input.tsx     # Reusable inline rename & creation input
  sidebar/
    file-tree.tsx      # Headless tree view & FileTreeNode renderer
  ui/                  # Essential UI primitives (button, dialog, kbd, etc.)
hooks/
  use-before-unload-guard.ts  # Browser prompt on unsaved edits
  use-inline-name.ts          # Autofocus, Enter/Escape key & blur handling
  use-keyboard-shortcuts.ts   # Global shortcuts (Ctrl+K, Ctrl+S, Ctrl+B)
  use-mobile.ts               # Responsive viewport breakpoint detection
lib/
  db.ts                # Dexie IndexedDB setup, schema, seeding, and CRUD
  items.ts             # Workspace item sort comparator (folders first)
  types.ts             # Core interfaces (WorkspaceItem, FileContent)
  utils.ts             # Tailwind class merging utility
  store/
    use-workspace-store.ts    # Single Zustand store for workspace state
```

---

## State Management Approach

The workspace uses a single [Zustand](https://github.com/pmndrs/zustand) store (`use-workspace-store.ts`) to manage:

- Tree hierarchy and expanded node IDs
- Active file ID, text buffer, and dirty tracking
- Current selection (item ID and folder ID)
- Transient UI state (inline creation, renaming, deletion prompt, error messages)

### Persistence as Truth

Store actions write directly to IndexedDB (via Dexie) first, then reload the latest records into memory. This eliminates state drift between the database and the UI. When switching between files, the store automatically flushes pending edits to prevent silent data loss.

---

## File-System Data Structure

The file system uses an **adjacency list** model stored as flat records with parent pointers rather than a deeply nested tree:

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

### IndexedDB Tables

IndexedDB manages two tables through Dexie:

1. `items`: Stores metadata (`id`, `name`, `type`, `parentId`, timestamps).
2. `contents`: Stores file bodies (`fileId`, `content`, `updatedAt`).

Separating metadata from file bodies keeps tree queries and folder listings fast, loading text content only when a file is opened.

---

## Important Implementation Decisions

- **Shared Inline Input:** File creation and renaming in both the sidebar tree and the folder view share a single `InlineNameInput` component. This prevents focus-blur race conditions and ensures uniform validation (non-empty strings, case-insensitive collision checks).
- **Navigation Auto-Save & Dirty Tracking:** Changes are marked dirty immediately on keystroke (`Save *`, pulsing breadcrumb indicator). Switching files or folders flushes unsaved edits to disk, and a `beforeunload` listener prevents accidental tab closures while editing.
- **Atomic Cascading Deletions:** Deleting a folder recursively collects all descendant file and folder IDs and deletes both metadata and content records inside a single Dexie transaction.
- **Single-Flight Database Seeding:** Database initialization uses a module-level promise singleton to ensure React StrictMode's double-mount effect does not trigger duplicate initial seed writes.
