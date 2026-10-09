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

console.log("doc-content checks passed");
