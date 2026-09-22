"use client";

import * as React from "react";
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
  Pencil,
  Trash2,
  ChevronRight,
  CircleAlert,
} from "lucide-react";
import { useWorkspaceStore } from "@/lib/store/use-workspace-store";
import { ROOT_ITEM_ID } from "@/lib/db";
import type { WorkspaceItem } from "@/lib/types";
import { cn } from "@/lib/utils";

function InlineCardRenameInput({
  initialValue,
  onConfirm,
  onCancel,
  className,
}: {
  initialValue: string;
  onConfirm: (val: string) => void;
  onCancel: () => void;
  className?: string;
}) {
  const [val, setVal] = React.useState(initialValue);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    inputRef.current?.focus();
    const dot = initialValue.lastIndexOf(".");
    if (dot > 0 && inputRef.current) {
      inputRef.current.setSelectionRange(0, dot);
    } else {
      inputRef.current?.select();
    }
  }, [initialValue]);

  return (
    <input
      ref={inputRef}
      value={val}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setVal(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.stopPropagation();
          onConfirm(val);
        } else if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          onCancel();
        }
      }}
      onBlur={() => {
        if (val.trim()) onConfirm(val);
        else onCancel();
      }}
      className={cn(
        "h-6 w-full rounded border border-primary bg-background px-1.5 text-xs text-foreground outline-none ring-1 ring-primary/40",
        className
      )}
    />
  );
}

function FolderView({
  folder,
  childrenItems,
  renamingItemId,
  onOpenFolder,
  onOpenFile,
  onNewFile,
  onNewFolder,
  onRename,
  onConfirmRename,
  onCancelRename,
  onDelete,
}: {
  folder: WorkspaceItem;
  childrenItems: WorkspaceItem[];
  renamingItemId: string | null;
  onOpenFolder: (id: string) => void;
  onOpenFile: (id: string) => void;
  onNewFile: () => void;
  onNewFolder: () => void;
  onRename: (id: string) => void;
  onConfirmRename: (id: string, name: string) => void;
  onCancelRename: () => void;
  onDelete: (id: string) => void;
}) {
  const isRoot = folder.id === ROOT_ITEM_ID;
  const isRenamingThisFolder = renamingItemId === folder.id;
  const childFolders = childrenItems.filter((i) => i.type === "folder");
  const childFiles = childrenItems.filter((i) => i.type === "file");

  return (
    <div className="flex flex-1 flex-col overflow-y-auto p-4 sm:p-6 md:p-8">
      {/* Folder Header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <Folder className="size-6 text-primary shrink-0" />
            {isRenamingThisFolder ? (
              <InlineCardRenameInput
                initialValue={folder.name}
                onConfirm={(newName) => onConfirmRename(folder.id, newName)}
                onCancel={onCancelRename}
                className="text-xl font-bold h-9 w-auto min-w-48"
              />
            ) : (
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {folder.name}
              </h1>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {childrenItems.length} {childrenItems.length === 1 ? "item" : "items"} in this location
          </p>
        </div>

        {/* Quick actions for current folder — styled to match the editor header */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="xs"
            onClick={onNewFile}
            className="h-7 gap-1.5 cursor-pointer text-xs"
          >
            <FilePlus className="size-3.5" />
            <span>New File</span>
          </Button>

          <Button
            variant="outline"
            size="xs"
            onClick={onNewFolder}
            className="h-7 gap-1.5 cursor-pointer text-xs"
          >
            <FolderPlus className="size-3.5" />
            <span>New Folder</span>
          </Button>

          {!isRoot && (
            <>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => onRename(folder.id)}
                className="h-7 gap-1.5 cursor-pointer text-xs text-muted-foreground hover:text-foreground"
                title="Rename folder"
              >
                <Pencil className="size-3.5" />
                <span>Rename</span>
              </Button>

              <Button
                variant="ghost"
                size="xs"
                onClick={() => onDelete(folder.id)}
                className="h-7 gap-1.5 cursor-pointer text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                title="Delete folder"
              >
                <Trash2 className="size-3.5" />
                <span>Delete</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Empty Folder State */}
      {childrenItems.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-muted-foreground/25 p-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted/50 mb-4">
            <Folder className="size-6 text-muted-foreground" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">This folder is empty</h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm">
            Create a new file or folder using the <span className="font-medium text-foreground">+ buttons in the sidebar</span>.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Folders Section */}
          {childFolders.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Folders ({childFolders.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {childFolders.map((subfolder) => {
                  const isRenaming = renamingItemId === subfolder.id;
                  return (
                    <div
                      key={subfolder.id}
                      onClick={() => !isRenaming && onOpenFolder(subfolder.id)}
                      className="group relative flex items-center justify-between rounded-lg border bg-card/60 p-3.5 cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
                        <Folder className="size-5 shrink-0 text-primary" />
                        <div className="min-w-0 flex-1">
                          {isRenaming ? (
                            <InlineCardRenameInput
                              initialValue={subfolder.name}
                              onConfirm={(val) => onConfirmRename(subfolder.id, val)}
                              onCancel={onCancelRename}
                            />
                          ) : (
                            <>
                              <p className="truncate text-sm font-medium text-foreground">
                                {subfolder.name}
                              </p>
                              <p className="text-[11px] text-muted-foreground">Folder</p>
                            </>
                          )}
                        </div>
                      </div>
                      {!isRenaming && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRename(subfolder.id);
                            }}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer transition-colors"
                            title="Rename"
                          >
                            <Pencil className="size-4" />
                            <span className="sr-only">Rename</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDelete(subfolder.id);
                            }}
                            className="p-1.5 rounded-md text-destructive hover:bg-destructive/10 cursor-pointer transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="size-4" />
                            <span className="sr-only">Delete</span>
                          </button>
                          <ChevronRight
                            className="size-3.5 text-muted-foreground ml-1"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Files Section */}
          {childFiles.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Files ({childFiles.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {childFiles.map((file) => {
                  const isRenaming = renamingItemId === file.id;
                  return (
                    <div
                      key={file.id}
                      onClick={() => !isRenaming && onOpenFile(file.id)}
                      className="group relative flex items-center justify-between rounded-lg border bg-card/60 p-3.5 cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
                        <FileText
                          className="size-5 shrink-0 text-muted-foreground"
                        />
                        <div className="min-w-0 flex-1">
                          {isRenaming ? (
                            <InlineCardRenameInput
                              initialValue={file.name}
                              onConfirm={(val) => onConfirmRename(file.id, val)}
                              onCancel={onCancelRename}
                            />
                          ) : (
                            <>
                              <p className="truncate text-sm font-medium text-foreground">
                                {file.name}
                              </p>
                              <p className="text-[11px] text-muted-foreground font-mono">
                                {file.name.split(".").pop()?.toUpperCase() || "TXT"} File
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                      {!isRenaming && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRename(file.id);
                            }}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer transition-colors"
                            title="Rename"
                          >
                            <Pencil className="size-4" />
                            <span className="sr-only">Rename</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDelete(file.id);
                            }}
                            className="p-1.5 rounded-md text-destructive hover:bg-destructive/10 cursor-pointer transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="size-4" />
                            <span className="sr-only">Delete</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MainContent() {
  const [openCommand, setOpenCommand] = React.useState(false);
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
    startRename,
    cancelRename,
    confirmRename,
    renamingItemId,
    promptDeleteItem,
    errorMessage,
    setErrorMessage,
  } = useWorkspaceStore();

  // Keyboard shortcuts: Ctrl+K (Search), Ctrl+S (Save), Ctrl+B (Toggle Sidebar)
  React.useEffect(() => {
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

  // Window beforeunload listener for unsaved text-file changes
  React.useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  // Auto-dismiss errorMessage after 4.5 seconds
  React.useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => {
        setErrorMessage(null);
      }, 4500);
      return () => clearTimeout(timer);
    }
  }, [errorMessage, setErrorMessage]);

  // Compute dynamic breadcrumbs based on active file or current folder
  const itemsMap = React.useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const breadcrumbs = React.useMemo(() => {
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

  const currentFolder = React.useMemo(() => {
    return itemsMap.get(selectedFolderId) || itemsMap.get(ROOT_ITEM_ID) || {
      id: ROOT_ITEM_ID,
      name: "Workspace",
      type: "folder" as const,
      parentId: null,
      createdAt: 0,
      updatedAt: 0,
    };
  }, [itemsMap, selectedFolderId]);

  const currentFolderChildren = React.useMemo(() => {
    return items
      .filter((i) => i.parentId === currentFolder.id)
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      });
  }, [items, currentFolder.id]);

  const activeFile = React.useMemo(() => {
    return activeFileId ? itemsMap.get(activeFileId) : null;
  }, [itemsMap, activeFileId]);

  const fileItems = React.useMemo(
    () => items.filter((i) => i.type === "file"),
    [items]
  );
  const folderItems = React.useMemo(
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
      {/* Floating Error Toast Notification */}
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
        {/* Left: Sidebar Toggle & Clickable Dynamic Breadcrumbs */}
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
                  <React.Fragment key={crumb.id}>
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
                  </React.Fragment>
                );
              })}
            </BreadcrumbList>
          </Breadcrumb>

          {/* Mobile short title */}
          <span className="text-sm font-medium lg:hidden truncate max-w-[20vw] flex items-center gap-1.5">
            <span>{activeFile ? activeFile.name : currentFolder.name}</span>
            {isDirty && <span className="size-2 rounded-full bg-primary" />}
          </span>
        </div>

        {/* Center: Search command trigger */}
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

        {/* Right: Save button */}
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
        <FolderView
          folder={currentFolder}
          childrenItems={currentFolderChildren}
          renamingItemId={renamingItemId}
          onOpenFolder={(folderId) => openFolder(folderId)}
          onOpenFile={(fileId) => selectItem(fileId)}
          onNewFile={() => startCreate("file")}
          onNewFolder={() => startCreate("folder")}
          onRename={(id) => startRename(id)}
          onConfirmRename={(id, name) => confirmRename(id, name)}
          onCancelRename={() => cancelRename()}
          onDelete={(id) => promptDeleteItem(id)}
        />
      )}

      {/* Floating Command Palette Dialog */}
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
