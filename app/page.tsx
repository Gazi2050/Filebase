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
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Search01Icon,
  FloppyDiskIcon,
  FileTextIcon,
  Folder01Icon,
  SidebarLeftIcon,
  FileAddIcon,
  FolderAddIcon,
} from "@hugeicons/core-free-icons";
import { useWorkspaceStore } from "@/lib/store/use-workspace-store";
import { ROOT_ITEM_ID } from "@/lib/db";
import type { WorkspaceItem } from "@/lib/types";

function MainContent() {
  const [openCommand, setOpenCommand] = React.useState(false);
  const { toggleSidebar } = useSidebar();
  const {
    items,
    activeFileId,
    activeFileContent,
    updateActiveContent,
    saveActiveFile,
    isSaving,
    selectItem,
    openCreateDialog,
  } = useWorkspaceStore();

  // Keyboard shortcuts: Ctrl+K / Cmd+K (Search), Ctrl+S / Cmd+S (Save)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpenCommand((prev) => !prev);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveActiveFile();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [saveActiveFile]);

  // Compute dynamic breadcrumbs from active file
  const breadcrumbs = React.useMemo(() => {
    if (!activeFileId) return [];
    const crumbs: WorkspaceItem[] = [];
    const itemsMap = new Map(items.map((i) => [i.id, i]));
    let currentId: string | null = activeFileId;

    while (currentId && currentId !== ROOT_ITEM_ID) {
      const item = itemsMap.get(currentId);
      if (!item) break;
      crumbs.unshift(item);
      currentId = item.parentId;
    }
    return crumbs;
  }, [items, activeFileId]);

  const activeFileName = breadcrumbs[breadcrumbs.length - 1]?.name ?? "No file opened";

  const fileItems = React.useMemo(
    () => items.filter((i) => i.type === "file"),
    [items]
  );
  const folderItems = React.useMemo(
    () => items.filter((i) => i.type === "folder" && i.id !== ROOT_ITEM_ID),
    [items]
  );

  return (
    <SidebarInset className="flex h-screen flex-col overflow-hidden bg-background">
      {/* Editor Header: Exact same height (h-11) and border-b as Sidebar Header */}
      <header className="flex h-11 shrink-0 items-center justify-between border-b px-3.5 select-none bg-background">
        {/* Left: Sidebar Toggle & Dynamic Breadcrumbs */}
        <div className="flex items-center gap-2.5 min-w-0">
          <SidebarTrigger className="h-7 w-7 text-muted-foreground hover:text-foreground cursor-pointer" />

          {breadcrumbs.length > 0 ? (
            <Breadcrumb className="hidden sm:block">
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="#">Workspace</BreadcrumbLink>
                </BreadcrumbItem>
                {breadcrumbs.map((crumb, idx) => {
                  const isLast = idx === breadcrumbs.length - 1;
                  return (
                    <React.Fragment key={crumb.id}>
                      <BreadcrumbSeparator />
                      <BreadcrumbItem>
                        {isLast ? (
                          <BreadcrumbPage>{crumb.name}</BreadcrumbPage>
                        ) : (
                          <BreadcrumbLink
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              selectItem(crumb.id);
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
          ) : (
            <span className="text-sm text-muted-foreground hidden sm:inline">Workspace</span>
          )}

          {/* Mobile short title */}
          <span className="text-sm font-medium sm:hidden truncate">
            {activeFileName}
          </span>
        </div>

        {/* Right: Search command trigger & Save button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpenCommand(true)}
            className="flex h-7 items-center gap-2 rounded-md border bg-muted/30 px-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
          >
            <HugeiconsIcon icon={Search01Icon} className="size-3.5" />
            <span className="hidden sm:inline">Search...</span>
            <Kbd className="text-[10px]">Ctrl K</Kbd>
          </button>

          <Button
            variant="outline"
            size="xs"
            onClick={() => saveActiveFile()}
            disabled={!activeFileId || isSaving}
            className="h-7 gap-1.5 cursor-pointer"
          >
            <HugeiconsIcon icon={FloppyDiskIcon} className="size-3.5" />
            <span>{isSaving ? "Saving..." : "Save"}</span>
          </Button>
        </div>
      </header>

      {/* Editor Canvas */}
      <div className="flex flex-1 overflow-auto p-6">
        {activeFileId ? (
          <textarea
            value={activeFileContent}
            onChange={(e) => updateActiveContent(e.target.value)}
            className="h-full w-full resize-none border-none bg-transparent font-mono text-sm leading-relaxed outline-none focus:ring-0 text-foreground/90 placeholder:text-muted-foreground selection:bg-primary/20"
            placeholder="Start typing notes..."
            spellCheck={false}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
            Select a file from the sidebar to start editing
          </div>
        )}
      </div>

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
                <HugeiconsIcon
                  icon={FileTextIcon}
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
                  selectItem(folder.id);
                  setOpenCommand(false);
                }}
                className="cursor-pointer"
              >
                <HugeiconsIcon icon={Folder01Icon} className="size-4 text-primary mr-2" />
                <span>{folder.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Actions">
            <CommandItem
              onSelect={() => {
                setOpenCommand(false);
                openCreateDialog("file");
              }}
              className="cursor-pointer"
            >
              <HugeiconsIcon icon={FileAddIcon} className="size-4 text-muted-foreground mr-2" />
              <span>Create New File</span>
            </CommandItem>

            <CommandItem
              onSelect={() => {
                setOpenCommand(false);
                openCreateDialog("folder");
              }}
              className="cursor-pointer"
            >
              <HugeiconsIcon icon={FolderAddIcon} className="size-4 text-muted-foreground mr-2" />
              <span>Create New Folder</span>
            </CommandItem>

            <CommandItem
              onSelect={() => {
                setOpenCommand(false);
                toggleSidebar();
              }}
              className="cursor-pointer"
            >
              <HugeiconsIcon icon={SidebarLeftIcon} className="size-4 text-muted-foreground mr-2" />
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
