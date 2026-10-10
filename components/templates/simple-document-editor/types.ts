import type { Content, JSONContent } from "@tiptap/core";
import type { Doc as YDoc } from "yjs";

export interface DocumentCollaborator {
  name: string;
  src?: string;
}

export interface SimpleDocumentEditorProps {
  className?: string;
  collaborators?: DocumentCollaborator[];
  initialContent?: Content;
  initialTitle?: string;
  onChange?: (content: JSONContent) => void;
  onShare?: () => void;
  onTitleChange?: (title: string) => void;
  path?: string[];
  /** Live collaboration: sync content through this Yjs doc instead of local state. */
  collaboration?: { ydoc: YDoc };
  /** Read-only mode: remote updates still render, local edits are disabled. */
  readOnly?: boolean;
}
