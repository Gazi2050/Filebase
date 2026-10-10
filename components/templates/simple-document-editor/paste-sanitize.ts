/**
 * Cleanup for HTML pasted from other editors (Notion-like templates, etc.):
 *
 * 1. Emoji often arrives as tiny CDN `<img>` tags (twemoji-style). Convert
 *    them back to their text character — from `alt`, or by decoding the
 *    codepoints in a twemoji URL (…/72x72/1f389.png → 🎉).
 * 2. Non-standard `colwidth="240"` attributes on table cells → Tiptap's
 *    `data-colwidth`, so pasted tables keep their column widths and the
 *    resize handles work.
 * 3. Oversized pasted tables are scaled to the content column so they
 *    never render cut off.
 */

/** Content column width in px (48rem) — pasted tables scale to fit it. */
const MAX_TABLE_WIDTH_PX = 768;

/** Narrowest a scaled column gets — keeps text readable. */
const MIN_COLUMN_WIDTH_PX = 48;

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

  // Pasted tables can carry widths far wider than our content column
  // (e.g. 4 × 240px = 960px in a 768px column) — they'd render cut off.
  // Tiptap reads the `colwidth` attribute natively, so keep the name and
  // scale each table's columns proportionally to fit, keeping ratios.
  // Scaled by the widest row so columns stay aligned across rows.
  doc.querySelectorAll("table").forEach((table) => {
    const rows = [...table.querySelectorAll("tr")];
    const rowTotals = rows.map((row) =>
      [...row.querySelectorAll("th[colwidth], td[colwidth]")].reduce(
        (sum, cell) =>
          sum +
          ((cell.getAttribute("colwidth") ?? "")
            .split(",")
            .map((n) => parseInt(n.trim(), 10))
            .filter((n) => Number.isFinite(n) && n > 0)
            .reduce((a, b) => a + b, 0) || 0),
        0
      )
    );
    const widest = Math.max(0, ...rowTotals);
    if (widest <= MAX_TABLE_WIDTH_PX) return;
    const ratio = MAX_TABLE_WIDTH_PX / widest;
    table.querySelectorAll("th[colwidth], td[colwidth]").forEach((cell) => {
      cell.setAttribute(
        "colwidth",
        (cell.getAttribute("colwidth") ?? "")
          .split(",")
          .map((n) => {
            const parsed = parseInt(n.trim(), 10);
            if (!Number.isFinite(parsed) || parsed <= 0) return n.trim();
            return String(Math.max(MIN_COLUMN_WIDTH_PX, Math.round(parsed * ratio)));
          })
          .join(",")
      );
    });
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
