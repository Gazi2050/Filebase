import { createTable, Table as TiptapTable } from "@tiptap/extension-table";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableRow } from "@tiptap/extension-table-row";
import { Gapcursor } from "@tiptap/extension-gapcursor";
import { TextSelection } from "@tiptap/pm/state";
import {
  addColumnAfter as pmAddColumnAfter,
  addColumnBefore as pmAddColumnBefore,
} from "@tiptap/pm/tables";
import type { Command } from "@tiptap/core";

/** Tables cap at six columns — the extend buttons stop at the cap. Rows are unlimited. */
export const MAX_COLUMNS = 6;

/** 8rem per column — six of them exactly fill the 48rem content width. */
const CELL_WIDTH = 128;

function columnsInCurrentTable(state: Parameters<Command>[0]["state"]): number | null {
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (node.type.name === "table") {
      const firstRow = node.firstChild;
      return firstRow ? firstRow.childCount : null;
    }
  }
  return null;
}

export const DocumentTable = TiptapTable.extend({
  addExtensions() {
    // Same sub-extensions stock Tiptap tables need (the custom editorcn
    // table bundled these too); Gapcursor is off in StarterKit config.
    return [TableRow, TableCell, TableHeader, Gapcursor];
  },
  addCommands() {
    return {
      ...this.parent?.(),
      /** Inserts with the colwidth attrs stamped, so the table renders at
          exactly cols × 8rem instead of collapsing to content width. */
      insertTable:
        (options: { rows?: number; cols?: number; withHeaderRow?: boolean } = {}): Command =>
        ({ tr, dispatch, editor }) => {
          const { rows = 3, cols = MAX_COLUMNS, withHeaderRow = true } = options;
          const node = createTable(editor.schema, rows, cols, withHeaderRow);
          if (!dispatch) return true;
          const tablePos = tr.selection.from;
          tr.replaceSelectionWith(node).scrollIntoView();
          node.descendants((cell, pos) => {
            if (cell.type.name === "tableCell" || cell.type.name === "tableHeader") {
              tr.setNodeMarkup(tablePos + 1 + pos, undefined, {
                ...cell.attrs,
                colwidth: [CELL_WIDTH],
              });
            }
          });
          tr.setSelection(TextSelection.near(tr.doc.resolve(tablePos + 1)));
          return true;
        },
      addColumnBefore: () => ({ state, dispatch }) => {
        const columnCount = columnsInCurrentTable(state);
        if (columnCount !== null && columnCount >= MAX_COLUMNS) return false;
        return pmAddColumnBefore(state, dispatch ?? undefined);
      },
      addColumnAfter: () => ({ state, dispatch }) => {
        const columnCount = columnsInCurrentTable(state);
        if (columnCount !== null && columnCount >= MAX_COLUMNS) return false;
        return pmAddColumnAfter(state, dispatch ?? undefined);
      },
    };
  },
});
