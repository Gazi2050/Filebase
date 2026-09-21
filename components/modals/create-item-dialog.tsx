"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useWorkspaceStore } from "@/lib/store/use-workspace-store";
import { ROOT_ITEM_ID } from "@/lib/db";

function CreateItemForm() {
  const {
    createDialogType,
    createDialogParentId,
    closeCreateDialog,
    createNewItem,
    items,
  } = useWorkspaceStore();

  const [name, setName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Compute parent folder path for context display
  const parentName = React.useMemo(() => {
    if (!createDialogParentId || createDialogParentId === ROOT_ITEM_ID) {
      return "Workspace";
    }
    const parent = items.find((i) => i.id === createDialogParentId);
    return parent ? parent.name : "Workspace";
  }, [items, createDialogParentId]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = name.trim();

    if (!trimmed) {
      setError("Name cannot be empty.");
      return;
    }

    if (/[\\/:*?"<>|]/.test(trimmed)) {
      setError("Name cannot contain special characters (\\ / : * ? \" < > |)");
      return;
    }

    // Check for duplicate in the same parent folder
    const exists = items.some(
      (item) =>
        item.parentId === createDialogParentId &&
        item.name.toLowerCase() === trimmed.toLowerCase()
    );

    if (exists) {
      setError(`An item named "${trimmed}" already exists in ${parentName}.`);
      return;
    }

    setIsSubmitting(true);
    try {
      await createNewItem(trimmed);
      closeCreateDialog();
    } catch {
      setError("Failed to create item. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          Create New {createDialogType === "file" ? "File" : "Folder"}
        </DialogTitle>
        <DialogDescription>
          Creating inside <span className="font-semibold text-foreground">{parentName}</span>
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4 py-2">
        <div className="space-y-2">
          <Input
            autoFocus
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError(null);
            }}
            placeholder={
              createDialogType === "file" ? "e.g. documentation.txt" : "e.g. components"
            }
            className="w-full text-sm"
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={closeCreateDialog}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={isSubmitting || !name.trim()}>
            {isSubmitting ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

export function CreateItemDialog() {
  const { createDialogOpen, closeCreateDialog, createDialogType, createDialogParentId } =
    useWorkspaceStore();

  return (
    <Dialog open={createDialogOpen} onOpenChange={(open) => !open && closeCreateDialog()}>
      <DialogContent className="sm:max-w-md">
        {createDialogOpen && (
          <CreateItemForm
            key={`${createDialogType}-${createDialogParentId}`}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
