import assert from "node:assert/strict";
import { parseDocContent } from "../lib/doc-content.ts";

// 1. Stored Tiptap JSON passes through untouched.
const doc = { type: "doc", content: [{ type: "paragraph" }] };
assert.deepEqual(parseDocContent(JSON.stringify(doc)), doc);

// 2. Legacy plain-text files open as a single paragraph, text intact.
const legacy = parseDocContent("hello\nworld");
assert.equal(legacy.type, "doc");
assert.equal(legacy.content?.[0]?.type, "paragraph");
assert.equal(legacy.content?.[0]?.content?.[0]?.text, "hello\nworld");

// 3. Empty file → empty paragraph doc (Tiptap's canonical empty state).
assert.deepEqual(parseDocContent(""), {
  type: "doc",
  content: [{ type: "paragraph" }],
});

// 4. Non-doc JSON (corrupt/foreign) falls back to text instead of crashing.
assert.equal(parseDocContent('{"a":1}').content?.[0]?.content?.[0]?.text, '{"a":1}');

// 5. Oversized tables are scaled to the 768px content column, ratios kept.
const cell = (colwidth?: number[]) => ({
  type: "tableCell",
  attrs: colwidth ? { colwidth } : {},
  content: [{ type: "paragraph" }],
});
const wideDoc = {
  type: "doc",
  content: [
    {
      type: "table",
      content: [
        { type: "tableRow", content: [cell([300]), cell([300]), cell([300]), cell([300]), cell([300])] },
      ],
    },
  ],
};
const normalized = parseDocContent(JSON.stringify(wideDoc));
const widths = normalized.content?.[0]?.content?.[0]?.content?.map(
  (c) => c.attrs?.colwidth?.[0]
);
assert.deepEqual(widths, [154, 154, 154, 153, 153]); // 1500px → exactly 768px
assert.equal(
  (widths as number[]).reduce((a, b) => a + b, 0) <= 768,
  true
);

// 6. Fitting tables pass through untouched (no colwidths stamped).
const fitDoc = {
  type: "doc",
  content: [
    {
      type: "table",
      content: [{ type: "tableRow", content: [cell(), cell()] }],
    },
  ],
};
const fitted = parseDocContent(JSON.stringify(fitDoc));
assert.deepEqual(
  fitted.content?.[0]?.content?.[0]?.content?.map((c) => c.attrs),
  [{}, {}]
);

// 7. Mixed explicit + default widths normalize together.
const mixedDoc = {
  type: "doc",
  content: [
    {
      type: "table",
      content: [{ type: "tableRow", content: [cell([400]), cell([400]), cell()] }],
    },
  ],
};
const mixed = parseDocContent(JSON.stringify(mixedDoc));
const mixedWidths = mixed.content?.[0]?.content?.[0]?.content?.map(
  (c) => c.attrs?.colwidth?.[0]
);
assert.equal(
  (mixedWidths as number[]).reduce((a: number, b: number) => a + b, 0) <= 768,
  true
);

// 8. Multi-row tables scale by the widest row, not the grand total.
const twoRowDoc = {
  type: "doc",
  content: [
    {
      type: "table",
      content: [
        { type: "tableRow", content: [cell([400]), cell([400]), cell([400]), cell([400])] },
        { type: "tableRow", content: [cell([400]), cell([400]), cell([400]), cell([400])] },
      ],
    },
  ],
};
const twoRow = parseDocContent(JSON.stringify(twoRowDoc));
const rowWidths = [0, 1].map((r) =>
  (
    twoRow.content?.[0]?.content?.[r]?.content as
      | { attrs?: { colwidth?: number[] } }[]
      | undefined
  )?.map((c) => c.attrs?.colwidth?.[0])
);
assert.deepEqual(rowWidths[0], [192, 192, 192, 192]);
assert.deepEqual(rowWidths[1], [192, 192, 192, 192]);

console.log("doc-content checks passed");
