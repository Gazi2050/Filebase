import type { JSONContent } from "@tiptap/core";

/** Content column width in px (48rem) — tables never render wider. */
const MAX_TABLE_WIDTH_PX = 768;

/** Fallback column width when a cell carries no explicit colwidth. */
const DEFAULT_COLUMN_WIDTH_PX = 128;

/** Narrowest a normalized column gets — keeps text readable. */
const MIN_COLUMN_WIDTH_PX = 48;

/**
 * Parse stored file content into Tiptap document JSON.
 *
 * Files saved before the rich-text editor hold plain text; wrap those in a
 * single paragraph so they open in the editor instead of failing to parse.
 * Tables wider than the content column are scaled to fit (heals tables
 * whose widths were stored before width normalization existed).
 */
export function parseDocContent(raw: string): JSONContent {
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as JSONContent;
      if (parsed && parsed.type === "doc") {
        normalizeTableWidths(parsed);
        return parsed;
      }
    } catch {
      // legacy plain-text content — fall through
    }
  }
  return {
    type: "doc",
    content: raw
      ? [{ type: "paragraph", content: [{ type: "text", text: raw }] }]
      : [{ type: "paragraph" }],
  };
}

function tableCells(table: JSONContent): JSONContent[] {
  const cells: JSONContent[] = [];
  for (const row of table.content ?? []) {
    if (row.type !== "tableRow") continue;
    for (const cell of row.content ?? []) {
      if (cell.type === "tableCell" || cell.type === "tableHeader") {
        cells.push(cell);
      }
    }
  }
  return cells;
}

function cellWidth(cell: JSONContent): number {
  const colwidth = cell.attrs?.colwidth;
  if (Array.isArray(colwidth)) {
    const sum = colwidth
      .filter((w): w is number => typeof w === "number" && w > 0)
      .reduce((a, b) => a + b, 0);
    if (sum > 0) return sum;
  }
  return DEFAULT_COLUMN_WIDTH_PX;
}

/**
 * Scale any table wider than the content column to fit, keeping column
 * ratios. Mutates the parsed doc in place; fitting tables are untouched.
 * Uses largest-remainder distribution so the scaled total lands exactly
 * on the cap instead of overshooting by rounding.
 */
export function normalizeTableWidths(doc: JSONContent): void {
  const walk = (node: JSONContent): void => {
    if (node.type === "table") {
      const cells = tableCells(node);
      // Widths repeat per row — scale by the widest row, not the grand
      // total, or multi-row tables shrink too far.
      const rows: JSONContent[][] = [];
      for (const row of node.content ?? []) {
        if (row.type !== "tableRow") continue;
        rows.push(
          (row.content ?? []).filter(
            (cell) => cell.type === "tableCell" || cell.type === "tableHeader"
          )
        );
      }
      const widest = Math.max(
        0,
        ...rows.map((cells) =>
          cells.reduce((sum, cell) => sum + cellWidth(cell), 0)
        )
      );
      if (widest > MAX_TABLE_WIDTH_PX) {
        const ratio = MAX_TABLE_WIDTH_PX / widest;
        const currents = cells.map(cellWidth);
        const exact = currents.map((w) => w * ratio);
        const floored = exact.map((w) =>
          Math.max(MIN_COLUMN_WIDTH_PX, Math.floor(w))
        );
        let remainder = MAX_TABLE_WIDTH_PX - floored.reduce((a, b) => a + b, 0);
        const order = exact
          .map((w, i) => i)
          .sort((a, b) => exact[b] - Math.floor(exact[b]) - (exact[a] - Math.floor(exact[a])));
        for (const i of order) {
          if (remainder <= 0) break;
          floored[i] += 1;
          remainder -= 1;
        }
        cells.forEach((cell, i) => {
          const colwidth = cell.attrs?.colwidth;
          const count =
            Array.isArray(colwidth) && colwidth.length > 0
              ? colwidth.length
              : 1;
          cell.attrs = {
            ...cell.attrs,
            colwidth: Array(count).fill(floored[i]),
          };
        });
      }
    }
    for (const child of node.content ?? []) walk(child);
  };
  for (const child of doc.content ?? []) walk(child);
}
