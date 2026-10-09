"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Search,
  FileText,
  Folder,
  PanelLeft,
  FilePlus,
  FolderPlus,
  CircleAlert,
  LogOut,
} from "lucide-react";
import { useWorkspaceStore } from "@/lib/store/use-workspace-store";
import { FolderView } from "@/components/folder/folder-view";
import { SimpleDocumentEditor } from "@/components/templates/simple-document-editor";
import { parseDocContent } from "@/lib/doc-content";
import { AuthDialog } from "@/components/modals/auth-dialog";
import { authClient } from "@/lib/auth-client";
import { useSyncStore, syncNow, scheduleSync, type SyncStatus } from "@/lib/sync";
import { ROOT_ITEM_ID } from "@/lib/db";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useBeforeUnloadGuard } from "@/hooks/use-before-unload-guard";
import type { WorkspaceItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const SYNC_STATUS: Record<SyncStatus, { label: string; dot: string }> = {
  local: { label: "Local only", dot: "bg-muted-foreground/40" },
  syncing: { label: "Syncing…", dot: "bg-amber-500 animate-pulse" },
  synced: { label: "Synced", dot: "bg-emerald-500" },
  offline: { label: "Offline — retrying", dot: "bg-destructive" },
};

interface EditorHeaderProps {
  activeFileId: string | null;
  activeFile: WorkspaceItem | undefined | null;
  currentFolder: WorkspaceItem;
  breadcrumbs: WorkspaceItem[];
  isDirty: boolean;
  isSaving: boolean;
  selectedFolderId: string;
  signedIn: boolean;
  userEmail: string;
  syncStatus: SyncStatus;
  onOpenCommand: () => void;
  onOpenAuth: () => void;
  onSignOut: () => void;
  onOpenFolder: (id: string) => void;
  onSelectItem: (id: string) => void;
}

function EditorHeader({
  activeFileId,
  activeFile,
  currentFolder,
  breadcrumbs,
  isDirty,
  isSaving,
  selectedFolderId,
  signedIn,
  userEmail,
  syncStatus,
  onOpenCommand,
  onOpenAuth,
  onSignOut,
  onOpenFolder,
  onSelectItem,
}: EditorHeaderProps) {
  const isAtRoot =
    !activeFileId && (!selectedFolderId || selectedFolderId === ROOT_ITEM_ID);

  return (
    <header className="relative flex h-11 shrink-0 items-center justify-between border-b px-3.5 select-none bg-background">
      <div className="flex items-center gap-2.5 min-w-0">
        <SidebarTrigger className="h-7 w-7 text-muted-foreground hover:text-foreground cursor-pointer" />

        <Breadcrumb
          className="hidden lg:block flex-nowrap overflow-hidden whitespace-nowrap"
          style={{ maxWidth: "min(32vw, 360px)" }}
        >
          <BreadcrumbList>
            <BreadcrumbItem>
              {isAtRoot ? (
                <BreadcrumbPage>Workspace</BreadcrumbPage>
              ) : (
                <BreadcrumbLink
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    onOpenFolder(ROOT_ITEM_ID);
                  }}
                >
                  Workspace
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>

            {breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              return (
                <Fragment key={crumb.id}>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    {isLast ? (
                      <BreadcrumbPage className="flex items-center gap-1.5 font-medium">
                        <span>{crumb.name}</span>
                        {crumb.type === "file" && isDirty && (
                          <span
                            className="size-2 rounded-full bg-primary animate-pulse"
                            title="Unsaved changes"
                          />
                        )}
                      </BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          if (crumb.type === "folder") {
                            onOpenFolder(crumb.id);
                          } else {
                            onSelectItem(crumb.id);
                          }
                        }}
                      >
                        {crumb.name}
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </Fragment>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>

        <span className="text-sm font-medium lg:hidden truncate max-w-[20vw] flex items-center gap-1.5">
          <span>{activeFile ? activeFile.name : currentFolder.name}</span>
          {isDirty && <span className="size-2 rounded-full bg-primary" />}
        </span>
      </div>

      <button
        type="button"
        onClick={onOpenCommand}
        className="absolute left-1/2 top-1/2 z-10 flex h-8 sm:h-7 w-[30vw] max-w-[150px] sm:max-w-none sm:w-48 xl:w-64 -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-2 rounded-md border bg-muted/30 px-3 sm:px-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
      >
        <Search className="size-3.5 shrink-0" />
        <span className="sm:hidden">Search</span>
        <span className="hidden sm:inline">Search...</span>
        <Kbd className="hidden sm:inline-flex text-[10px]">Ctrl K</Kbd>
      </button>

      <div className="flex items-center gap-2">
        {isSaving && (
          <span className="text-xs text-muted-foreground">Saving…</span>
        )}
        {signedIn && (
          <span
            className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground"
            title="Cloud sync status"
          >
            <span className={cn("size-1.5 rounded-full", SYNC_STATUS[syncStatus].dot)} />
            {SYNC_STATUS[syncStatus].label}
          </span>
        )}
        {signedIn ? (
          <>
            <span className="hidden md:inline text-xs text-muted-foreground max-w-[160px] truncate">
              {userEmail}
            </span>
            <Button
              variant="ghost"
              size="xs"
              onClick={onSignOut}
              title="Sign out"
              className="h-7 w-7 cursor-pointer p-0"
            >
              <LogOut className="size-3.5" />
            </Button>
          </>
        ) : (
          <Button
            variant="outline"
            size="xs"
            onClick={onOpenAuth}
            className="h-7 cursor-pointer"
          >
            Sign in
          </Button>
        )}
        {activeFileId && isDirty && !isSaving && (
          <span
            className="hidden sm:inline text-xs text-muted-foreground"
            title="Auto-saves after you stop typing"
          >
            Unsaved
          </span>
        )}
      </div>
    </header>
  );
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileItems: WorkspaceItem[];
  folderItems: WorkspaceItem[];
  onSelectFile: (id: string) => void;
  onOpenFolder: (id: string) => void;
  onCreateFile: () => void;
  onCreateFolder: () => void;
  onToggleSidebar: () => void;
}

function CommandPalette({
  open,
  onOpenChange,
  fileItems,
  folderItems,
  onSelectFile,
  onOpenFolder,
  onCreateFile,
  onCreateFolder,
  onToggleSidebar,
}: CommandPaletteProps) {
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a file name or command..." />
      <CommandList>
        <CommandEmpty>No matching files or commands found.</CommandEmpty>

        <CommandGroup heading="Files">
          {fileItems.map((file) => (
            <CommandItem
              key={file.id}
              onSelect={() => {
                onSelectFile(file.id);
                onOpenChange(false);
              }}
              className="cursor-pointer"
            >
              <FileText className="size-4 text-muted-foreground mr-2" />
              <span>{file.name}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Folders">
          {folderItems.map((folder) => (
            <CommandItem
              key={folder.id}
              onSelect={() => {
                onOpenFolder(folder.id);
                onOpenChange(false);
              }}
              className="cursor-pointer"
            >
              <Folder className="size-4 text-primary mr-2" />
              <span>{folder.name}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Actions">
          <CommandItem
            onSelect={() => {
              onOpenChange(false);
              onCreateFile();
            }}
            className="cursor-pointer"
          >
            <FilePlus className="size-4 text-muted-foreground mr-2" />
            <span>Create New File</span>
          </CommandItem>

          <CommandItem
            onSelect={() => {
              onOpenChange(false);
              onCreateFolder();
            }}
            className="cursor-pointer"
          >
            <FolderPlus className="size-4 text-muted-foreground mr-2" />
            <span>Create New Folder</span>
          </CommandItem>

          <CommandItem
            onSelect={() => {
              onOpenChange(false);
              onToggleSidebar();
            }}
            className="cursor-pointer"
          >
            <PanelLeft className="size-4 text-muted-foreground mr-2" />
            <span>Toggle Sidebar</span>
            <Kbd className="ml-auto text-[10px]">Ctrl B</Kbd>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

function MainContent() {
  const [openCommand, setOpenCommand] = useState(false);
  const [openAuth, setOpenAuth] = useState(false);
  const { data: session } = authClient.useSession();
  const signedIn = !!session?.user;
  const syncStatus = useSyncStore((s) => s.status);
  const {
    toggleSidebar,
    isMobile,
    setOpenMobile: openSidebarOverlay,
  } = useSidebar();
  const {
    items,
    isInitialized,
    activeFileId,
    activeFileContent,
    isDirty,
    selectedFolderId,
    updateActiveContent,
    saveActiveFile,
    isSaving,
    selectItem,
    openFolder,
    startInlineCreate,
    errorMessage,
    setErrorMessage,
  } = useWorkspaceStore();

  useKeyboardShortcuts({
    onSearch: () => setOpenCommand((prev) => !prev),
    onSave: saveActiveFile,
    onToggleSidebar: toggleSidebar,
    canSave: !!activeFileId,
  });

  useBeforeUnloadGuard(isDirty);

  // Sync lifecycle: sync on session change, window focus, reconnect, interval.
  useEffect(() => {
    useSyncStore.setState({ signedIn });
    if (signedIn) void syncNow();
  }, [signedIn]);

  // Auto-save: persist 1s after the last edit (timer resets on each change).
  useEffect(() => {
    if (!isDirty || !activeFileId) return;
    const t = setTimeout(() => {
      void saveActiveFile().then(() => scheduleSync(400));
    }, 1000);
    return () => clearTimeout(t);
  }, [activeFileContent, isDirty, activeFileId, saveActiveFile]);

  useEffect(() => {
    if (!signedIn) return;
    const ping = () => void syncNow();
    window.addEventListener("focus", ping);
    window.addEventListener("online", ping);
    const interval = setInterval(ping, 30_000);
    return () => {
      window.removeEventListener("focus", ping);
      window.removeEventListener("online", ping);
      clearInterval(interval);
    };
  }, [signedIn]);

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(null), 4500);
      return () => clearTimeout(timer);
    }
  }, [errorMessage, setErrorMessage]);

  const itemsMap = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const breadcrumbs = useMemo(() => {
    const targetId = activeFileId || selectedFolderId || ROOT_ITEM_ID;
    const crumbs: WorkspaceItem[] = [];
    let currentId: string | null = targetId;

    while (currentId && currentId !== ROOT_ITEM_ID) {
      const item = itemsMap.get(currentId);
      if (!item) break;
      crumbs.unshift(item);
      currentId = item.parentId;
    }
    return crumbs;
  }, [itemsMap, activeFileId, selectedFolderId]);

  const currentFolder = useMemo(
    () =>
      itemsMap.get(selectedFolderId) ||
      itemsMap.get(ROOT_ITEM_ID) || {
        id: ROOT_ITEM_ID,
        name: "Workspace",
        type: "folder" as const,
        parentId: null,
        createdAt: 0,
        updatedAt: 0,
      },
    [itemsMap, selectedFolderId]
  );

  const activeFile = useMemo(
    () => (activeFileId ? itemsMap.get(activeFileId) : null),
    [itemsMap, activeFileId]
  );

  const fileItems = useMemo(
    () => items.filter((i) => i.type === "file"),
    [items]
  );
  const folderItems = useMemo(
    () => items.filter((i) => i.type === "folder" && i.id !== ROOT_ITEM_ID),
    [items]
  );

  const startCreate = (type: "file" | "folder") => {
    if (isMobile) openSidebarOverlay(true);
    startInlineCreate(type, currentFolder.id);
  };

  return (
    <SidebarInset className="flex h-screen flex-col overflow-hidden bg-background">
      {errorMessage && (
        <div className="fixed top-4 right-4 left-4 sm:left-auto z-50 max-w-[calc(100vw-2rem)] sm:max-w-sm flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-xs font-medium text-destructive shadow-lg backdrop-blur-xs animate-in fade-in-0 slide-in-from-top-2">
          <CircleAlert className="size-4 shrink-0" />
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="ml-2 rounded p-0.5 hover:bg-destructive/20 text-destructive cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      <EditorHeader
        activeFileId={activeFileId}
        activeFile={activeFile}
        currentFolder={currentFolder}
        breadcrumbs={breadcrumbs}
        isDirty={isDirty}
        isSaving={isSaving}
        selectedFolderId={selectedFolderId}
        signedIn={signedIn}
        userEmail={session?.user?.email ?? ""}
        syncStatus={syncStatus}
        onOpenCommand={() => setOpenCommand(true)}
        onOpenAuth={() => setOpenAuth(true)}
        onSignOut={() => {
          void authClient.signOut().then(() => {
            useSyncStore.setState({ signedIn: false, status: "local" });
          });
        }}
        onOpenFolder={openFolder}
        onSelectItem={selectItem}
      />

      {activeFileId && isInitialized ? (
        <div className="flex min-h-0 flex-1 overflow-hidden p-3 sm:p-6">
          <SimpleDocumentEditor
            key={activeFileId}
            className="min-h-0 w-full flex-1"
            initialContent={parseDocContent(activeFileContent)}
            onChange={(content) => {
              // ponytail: JSON.stringify per keystroke — fine at personal-doc
              // scale; swap for incremental serialization if profiling says so.
              updateActiveContent(JSON.stringify(content));
            }}
          />
        </div>
      ) : (
        <FolderView folder={currentFolder} />
      )}

      <AuthDialog open={openAuth} onOpenChange={setOpenAuth} />

      <CommandPalette
        open={openCommand}
        onOpenChange={setOpenCommand}
        fileItems={fileItems}
        folderItems={folderItems}
        onSelectFile={selectItem}
        onOpenFolder={openFolder}
        onCreateFile={() => startCreate("file")}
        onCreateFolder={() => startCreate("folder")}
        onToggleSidebar={toggleSidebar}
      />
    </SidebarInset>
  );
}

export default function Home() {
  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebar />
      <MainContent />
    </SidebarProvider>
  );
}
