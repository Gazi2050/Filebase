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
import type { WorkspaceItem } from "@/lib/types";
import { cn } from "@/lib/utils";

function MainContent() {
  const [openCommand, setOpenCommand] = useState(false);
  const { toggleSidebar, isMobile, setOpenMobile: openSidebarOverlay } = useSidebar();
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

  // Keyboard shortcuts: Ctrl+K (Search), Ctrl+S (Save), Ctrl+B (Toggle Sidebar)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpenCommand((prev) => !prev);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        if (activeFileId) {
          e.preventDefault();
          saveActiveFile();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [saveActiveFile, activeFileId, toggleSidebar]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => {
        setErrorMessage(null);
      }, 4500);
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

  const currentFolder = useMemo(() => {
    return itemsMap.get(selectedFolderId) || itemsMap.get(ROOT_ITEM_ID) || {
      id: ROOT_ITEM_ID,
      name: "Workspace",
      type: "folder" as const,
      parentId: null,
      createdAt: 0,
      updatedAt: 0,
    };
  }, [itemsMap, selectedFolderId]);

  const activeFile = useMemo(() => {
    return activeFileId ? itemsMap.get(activeFileId) : null;
  }, [itemsMap, activeFileId]);

  const fileItems = useMemo(
    () => items.filter((i) => i.type === "file"),
    [items]
  );
  const folderItems = useMemo(
    () => items.filter((i) => i.type === "folder" && i.id !== ROOT_ITEM_ID),
    [items]
  );

  // On mobile the inline create input lives in the sidebar overlay — open it
  // so the input is actually visible when creating from the header/palette.
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

      {/* Top Header: Exact same height (h-11) and border-b as Sidebar Header */}
      <header className="relative flex h-11 shrink-0 items-center justify-between border-b px-3.5 select-none bg-background">
        <div className="flex items-center gap-2.5 min-w-0">
          <SidebarTrigger className="h-7 w-7 text-muted-foreground hover:text-foreground cursor-pointer" />

          <Breadcrumb
            className="hidden lg:block flex-nowrap overflow-hidden whitespace-nowrap"
            style={{ maxWidth: "min(32vw, 360px)" }}
          >
            <BreadcrumbList>
              <BreadcrumbItem>
                {activeFileId || (selectedFolderId && selectedFolderId !== ROOT_ITEM_ID) ? (
                  <BreadcrumbLink
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      openFolder(ROOT_ITEM_ID);
                    }}
                  >
                    Workspace
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage>Workspace</BreadcrumbPage>
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
                              openFolder(crumb.id);
                            } else {
                              selectItem(crumb.id);
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
          onClick={() => setOpenCommand(true)}
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
              onClick={() => saveActiveFile()}
              disabled={isSaving}
              className={cn(
                "h-7 gap-1.5 cursor-pointer transition-colors",
                isDirty && "shadow-sm"
              )}
            >
              <Save className="size-3.5" />
              <span>
                {isSaving ? "Saving..." : isDirty ? "Save *" : "Save"}
              </span>
            </Button>
          )}
        </div>
      </header>

      {/* Main Panel Canvas: Dual-Mode (Editor vs Folder View) */}
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

      <CommandDialog open={openCommand} onOpenChange={setOpenCommand}>
        <CommandInput placeholder="Type a file name or command..." />
        <CommandList>
          <CommandEmpty>No matching files or commands found.</CommandEmpty>

          <CommandGroup heading="Files">
            {fileItems.map((file) => (
              <CommandItem
                key={file.id}
                onSelect={() => {
                  selectItem(file.id);
                  setOpenCommand(false);
                }}
                className="cursor-pointer"
              >
                <FileText
                  className="size-4 text-muted-foreground mr-2"
                />
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
                  openFolder(folder.id);
                  setOpenCommand(false);
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
                setOpenCommand(false);
                startCreate("file");
              }}
              className="cursor-pointer"
            >
              <FilePlus className="size-4 text-muted-foreground mr-2" />
              <span>Create New File</span>
            </CommandItem>

            <CommandItem
              onSelect={() => {
                setOpenCommand(false);
                startCreate("folder");
              }}
              className="cursor-pointer"
            >
              <FolderPlus className="size-4 text-muted-foreground mr-2" />
              <span>Create New Folder</span>
            </CommandItem>

            <CommandItem
              onSelect={() => {
                setOpenCommand(false);
                toggleSidebar();
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
