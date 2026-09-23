"use client";

import { FilePlus, FolderPlus } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { FileTree } from "@/components/sidebar/file-tree";
import { DeleteConfirmDialog } from "@/components/modals/delete-confirm-dialog";
import { useWorkspaceStore } from "@/lib/store/use-workspace-store";

export function AppSidebar() {
  const { startInlineCreate, clearSelection } = useWorkspaceStore();

  return (
    <>
      <Sidebar className="border-r select-none">
        <SidebarHeader className="h-11 border-b px-3.5 py-0 flex flex-row items-center justify-between">
          <span className="text-xs font-semibold tracking-wider text-muted-foreground">
            EXPLORER
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => startInlineCreate("file")}
              className="h-7 w-7 text-muted-foreground hover:text-foreground cursor-pointer"
              title="New File"
            >
              <FilePlus className="size-4" />
              <span className="sr-only">New File</span>
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => startInlineCreate("folder")}
              className="h-7 w-7 text-muted-foreground hover:text-foreground cursor-pointer"
              title="New Folder"
            >
              <FolderPlus className="size-4" />
              <span className="sr-only">New Folder</span>
            </Button>
          </div>
        </SidebarHeader>

        <SidebarContent
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              clearSelection();
            }
          }}
          className="px-2 py-2 text-sm overflow-x-hidden flex-1 cursor-default"
        >
          <FileTree />
        </SidebarContent>

        <SidebarRail />
      </Sidebar>

      <DeleteConfirmDialog />
    </>
  );
}
