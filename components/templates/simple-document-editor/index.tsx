"use client";

import { Link, RichTextEditor } from "@/components/editor";
import {
  ImagePlaceholder,
  ResizableImage,
} from "@/components/extensions/image-placeholder";
import { Table } from "@/components/extensions/table";
import { TableHoverOverlay } from "@/components/extensions/table/table-hover-overlay";
import { Color } from "@tiptap/extension-color";
import { Extension } from "@tiptap/core";
import { AllSelection, TextSelection } from "@tiptap/pm/state";
import { Highlight } from "@tiptap/extension-highlight";
import { Placeholder } from "@tiptap/extension-placeholder";
import { Subscript } from "@tiptap/extension-subscript";
import { Superscript } from "@tiptap/extension-superscript";
import { TaskItem } from "@tiptap/extension-task-item";
import { TaskList } from "@tiptap/extension-task-list";
import { TextAlign } from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import { useEditor, useEditorState } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";

import { cn } from "@/lib/utils";

import { SAMPLE_CONTENT, SCROLLBAR } from "./constants";
import { ShortcutsPopover } from "./shortcuts";
import { Toolbar } from "./toolbar";
import { DocumentCodeBlock } from "./code-block";
import {
  BlockEditor,
  BlockEditorProvider,
  SlashCommand,
  getSlashCommandSuggestion,
} from "@/components/block-editor";
import type { SimpleDocumentEditorProps } from "./types";
import { readState } from "./utils";
import { PasteSanitize } from "./paste-sanitize";

import "@/components/editor/style.css";
import "@/components/extensions/image-placeholder/style.css";
import "@/components/extensions/table/style.css";
import "@/components/extensions/ui/style.css";
import "@/components/block-editor/style.css";
import "./style.css";

/**
 * The drag-handle plugin hides the grip on every keystroke and cursor move
 * (`visibility: hidden` + `pointer-events: none` inline). We want it visible
 * while the editor is in use, so reset exactly what its own `showHandle`
 * would set — leaving its `position/left/top` inline styles untouched.
 */
const revealGrip = () => {
  const grip = document.querySelector<HTMLElement>(
    ".doc-drag-scope .drag-handle"
  );
  if (grip) {
    grip.style.visibility = "";
    grip.style.pointerEvents = "auto";
  }
};

/**
 * Select-all, Notion-style: inside a code block it selects just that block's
 * content; anywhere else it selects the whole document. Binds ahead of core
 * (priority 1000 beats the default 100).
 */
const FullSelectAll = Extension.create({
  name: "fullSelectAll",
  priority: 1000,
  addKeyboardShortcuts() {
    return {
      "Mod-a": ({ editor }) => {
        const { state, view } = editor;
        const { $from } = state.selection;

        let depth = $from.depth;
        while (depth > 0) {
          if ($from.node(depth).type.name === "codeBlock") {
            const tr = state.tr.setSelection(
              TextSelection.create(
                state.doc,
                $from.before(depth) + 1,
                $from.after(depth) - 1
              )
            );
            view.dispatch(tr);
            return true;
          }
          depth--;
        }

        const tr = state.tr.setSelection(new AllSelection(state.doc));
        view.dispatch(tr);
        return true;
      },
    };
  },
});

export const SimpleDocumentEditor = ({
  className,
  initialContent = SAMPLE_CONTENT,
  onChange,
}: SimpleDocumentEditorProps) => {
  const editor = useEditor({
    content: initialContent,
    extensions: [
      StarterKit.configure({
        gapcursor: false,
        heading: { levels: [1, 2, 3] },
        link: false,
        codeBlock: false,
      }),
      DocumentCodeBlock,
      FullSelectAll,
      PasteSanitize,
      SlashCommand.configure({
        suggestion: getSlashCommandSuggestion(),
      }),
      Link,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Subscript,
      Superscript,
      Table.configure({ resizable: true }),
      ResizableImage,
      ImagePlaceholder,
      TaskList.configure({ HTMLAttributes: { class: "rte-task-list" } }),
      TaskItem.configure({ nested: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder: "Start writing…" }),
    ],
    immediatelyRender: false,
    onUpdate: ({ editor: updated }) => {
      onChange?.(updated.getJSON());
      revealGrip();
    },
    onSelectionUpdate: () => revealGrip(),
    shouldRerenderOnTransaction: false,
  });

  const state =
    useEditorState({
      editor,
      selector: ({ editor: e }) => (e && !e.isDestroyed ? readState(e) : null),
    }) ?? (editor ? readState(editor) : null);

  const words = state?.words ?? 0;

  return (
    <div
      className={cn(
        "bg-background text-foreground flex flex-col overflow-hidden rounded-xl border shadow-sm",
        className
      )}
    >
      <RichTextEditor
        editor={editor}
        variant="subtle"
        className={cn(
          "bg-background doc-drag-scope relative flex min-h-0 flex-1 flex-col overflow-y-auto rounded-none! border-0! shadow-none!",
          SCROLLBAR
        )}
      >
        <BlockEditorProvider editor={editor}>
          <BlockEditor.DragHandle />
        </BlockEditorProvider>
        <Toolbar editor={editor} state={state} />
        <article className="flex w-full flex-1 flex-col px-5 py-6 sm:px-14 sm:py-12">
          <RichTextEditor.Content className="min-h-0 flex-1 [&_.ProseMirror]:min-h-64! [&_.ProseMirror]:h-full! [&_.ProseMirror]:p-0! [&_mark]:rounded-sm [&_mark]:px-0.5 [&_mark]:text-inherit [&_mark:not([style])]:bg-yellow-400/40" />
        </article>
      </RichTextEditor>
      <TableHoverOverlay editor={editor} />

      <footer className="text-muted-foreground flex h-9 shrink-0 items-center gap-3 border-t px-3 text-xs tabular-nums">
        <span>{words.toLocaleString()} words</span>
        <span>{(state?.characters ?? 0).toLocaleString()} characters</span>
        <div className="ml-auto">
          <ShortcutsPopover />
        </div>
      </footer>
    </div>
  );
};

export type { DocumentCollaborator, SimpleDocumentEditorProps } from "./types";
