export type ItemType = "file" | "folder";

export interface WorkspaceItem {
  id: string;
  name: string;
  type: ItemType;
  parentId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface FileContent {
  fileId: string;
  content: string;
  updatedAt: number;
}
