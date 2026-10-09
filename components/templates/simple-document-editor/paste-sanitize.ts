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

/**
 * Decode an emoji image URL into its emoji character. Works with any URL
 * whose filename is a hex codepoint run — twemoji (1f389.png), JoyPixels
 * (unicode/2764.png), Notion (emoji_u1f389.png) — plus dash-separated
 * sequences (2764-fe0f.png → ❤️). The decoded character must actually be
 * an emoji, so hashed upload filenames (deadbeef.png) are rejected.
 */
export function emojiFromSrc(src: string): string | null {
  const file = src.split(/[?#]/)[0].split("/").pop() ?? "";
  const name = file
    .replace(/\.(png|svg|gif|webp)$/i, "")
    .replace(/^(?:emoji[_-]*|u)+/i, "");
  if (!/^[0-9a-f]+(?:-[0-9a-f]+)*$/i.test(name)) return null;
  const parts = name.split("-").map((h) => parseInt(h, 16));
  try {
    const char = String.fromCodePoint(...parts);
    if ([...char].length <= 8 && /\p{Extended_Pictographic}/u.test(char)) {
      return char;
    }
  } catch {
    // invalid codepoints
  }
  return null;
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
