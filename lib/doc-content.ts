import type { JSONContent } from "@tiptap/core";

/**
 * Parse stored file content into Tiptap document JSON.
 *
 * Files saved before the rich-text editor hold plain text; wrap those in a
 * single paragraph so they open in the editor instead of failing to parse.
 */
export function parseDocContent(raw: string): JSONContent {
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as JSONContent;
      if (parsed && parsed.type === "doc") {
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
