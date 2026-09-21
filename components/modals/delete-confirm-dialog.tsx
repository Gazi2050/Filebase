"use client";

import * as React from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { useWorkspaceStore } from "@/lib/store/use-workspace-store";

export function DeleteConfirmDialog() {
  const { itemToDelete, cancelDeleteItem, confirmDeleteItem } = useWorkspaceStore();

  const isOpen = itemToDelete !== null;
  const isFolder = itemToDelete?.type === "folder";

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && cancelDeleteItem()}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete {isFolder ? "Folder" : "File"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete{" "}
            <span className="font-semibold text-foreground">{itemToDelete?.name}</span>?
            {isFolder && " This will permanently delete all files and subfolders inside it."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={cancelDeleteItem}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={confirmDeleteItem}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
