import { DragHandle } from "@tiptap/extension-drag-handle-react";
import { EditorContent } from "@tiptap/react";

import { BottomBar } from "./bottom-bar";
import { BubbleMenu } from "./bubble-menu";
import { BlockEditorProvider, useBlockEditorContext } from "./context";
import { cn } from "./lib/utils";
import type { BlockEditorProps } from "./types";

const computePositionConfig = {
  placement: "left-start",
  strategy: "absolute",
} as const;

const BlockEditorDragHandle = () => {
  const { editor, icons } = useBlockEditorContext();

  if (!editor) {
    return null;
  }

  return (
    <DragHandle
      computePositionConfig={computePositionConfig}
      editor={editor}
    >
      {icons.dragHandleIcon}
    </DragHandle>
  );
};

const BlockEditorContent = () => {
  const { editor } = useBlockEditorContext();

  return (
    <div className="block-editor">
      {editor && editor.isEditable && <BlockEditorDragHandle />}
      {editor && editor.isEditable && <BubbleMenu editor={editor} />}
      <EditorContent editor={editor} className="block-editor-content" />
      {editor && editor.isEditable && <BottomBar editor={editor} />}
    </div>
  );
};

const BlockEditorRoot = ({
  editor,
  children,
  className,
  labels,
  icons,
}: BlockEditorProps) => (
  <BlockEditorProvider editor={editor} labels={labels} icons={icons}>
    <div className={cn("block-editor", className)}>
      {children ?? <BlockEditorContent />}
    </div>
  </BlockEditorProvider>
);

export const BlockEditor = Object.assign(BlockEditorRoot, {
  BottomBar,
  BubbleMenu,
  Content: BlockEditorContent,
  DragHandle: BlockEditorDragHandle,
});
