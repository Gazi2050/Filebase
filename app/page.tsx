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
  Save,
  FileText,
  Folder,
  PanelLeft,
  FilePlus,
  FolderPlus,
  CircleAlert,
} from "lucide-react";
import { useWorkspaceStore } from "@/lib/store/use-workspace-store";
import { FolderView } from "@/components/folder/folder-view";
import { ROOT_ITEM_ID } from "@/lib/db";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useBeforeUnloadGuard } from "@/hooks/use-before-unload-guard";
import type { WorkspaceItem } from "@/lib/types";
import { cn } from "@/lib/utils";

interface EditorHeaderProps {
  activeFileId: string | null;
  activeFile: WorkspaceItem | undefined | null;
  currentFolder: WorkspaceItem;
  breadcrumbs: WorkspaceItem[];
  isDirty: boolean;
  isSaving: boolean;
  selectedFolderId: string;
  onOpenCommand: () => void;
  onSave: () => void;
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
  onOpenCommand,
  onSave,
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
        {activeFileId && (
          <Button
            variant={isDirty ? "default" : "outline"}
            size="xs"
            onClick={onSave}
            disabled={isSaving}
            className={cn(
              "h-7 gap-1.5 cursor-pointer transition-colors",
              isDirty && "shadow-sm"
            )}
          >
            <Save className="size-3.5" />
            <span>{isSaving ? "Saving..." : isDirty ? "Save *" : "Save"}</span>
          </Button>
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
  const {
    toggleSidebar,
    isMobile,
    setOpenMobile: openSidebarOverlay,
  } = useSidebar();
  const {
    items,
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
        onOpenCommand={() => setOpenCommand(true)}
        onSave={saveActiveFile}
        onOpenFolder={openFolder}
        onSelectItem={selectItem}
      />

      {activeFileId ? (
        <div className="flex flex-1 overflow-auto p-3 sm:p-6">
          <textarea
            value={activeFileContent}
            onChange={(e) => updateActiveContent(e.target.value)}
            className="h-full w-full resize-none border-none bg-transparent font-mono text-sm leading-relaxed outline-none focus:ring-0 text-foreground/90 placeholder:text-muted-foreground selection:bg-primary/20"
            placeholder="Start typing notes..."
            spellCheck={false}
          />
        </div>
      ) : (
        <FolderView folder={currentFolder} />
      )}

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
