/**
 * Cleanup for HTML pasted from other editors (Notion-like templates, etc.):
 *
 * 1. Emoji often arrives as tiny CDN `<img>` tags (twemoji-style). Convert
 *    them back to their text character — from `alt`, or by decoding the
 *    codepoints in a twemoji URL (…/72x72/1f389.png → 🎉).
 * 2. Non-standard `colwidth="240"` attributes on table cells → Tiptap's
 *    `data-colwidth`, so pasted tables keep their column widths and the
 *    resize handles work.
 */

/** True when `alt` is a short emoji character (not a URL or description). */
export function isEmojiAlt(alt: string): boolean {
  const trimmed = alt.trim();
  if (!trimmed || /^https?:/i.test(trimmed)) return false;
  return [...trimmed].length <= 4 && /\p{Extended_Pictographic}/u.test(trimmed);
}

/** Decode a twemoji image URL into its emoji character, e.g. …/1f389.png → 🎉 */
export function emojiFromSrc(src: string): string | null {
  const m = /assets\/(?:img\/)?(?:72x72|svg|png)\/([0-9a-f-]+)\.(?:png|svg)$/i.exec(
    src
  );
  if (!m) return null;
  try {
    return String.fromCodePoint(
      ...m[1].split("-").map((h) => parseInt(h, 16))
    );
  } catch {
    return null;
  }
}

import { Extension } from "@tiptap/core";

export function sanitizePastedHTML(html: string): string {
  if (typeof DOMParser === "undefined") return html;
  const doc = new DOMParser().parseFromString(html, "text/html");

  doc.querySelectorAll("img").forEach((img) => {
    const alt = (img.getAttribute("alt") ?? "").trim();
    const src = img.getAttribute("src") ?? "";
    const emoji = isEmojiAlt(alt) ? alt : emojiFromSrc(src);
    if (emoji) img.replaceWith(document.createTextNode(emoji));
  });

  doc.querySelectorAll("[colwidth]").forEach((el) => {
    const width = el.getAttribute("colwidth");
    if (width) el.setAttribute("data-colwidth", width);
    el.removeAttribute("colwidth");
  });

  return doc.body.innerHTML;
}

export const PasteSanitize = Extension.create({
  name: "pasteSanitize",
  priority: 1000,
  transformPastedHTML(html) {
    return sanitizePastedHTML(html);
  },
});
