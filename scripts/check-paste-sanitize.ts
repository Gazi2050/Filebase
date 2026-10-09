import assert from "node:assert/strict";
import {
  emojiFromSrc,
  isEmojiAlt,
} from "../components/templates/simple-document-editor/paste-sanitize.ts";

// Emoji alt detection: short pictographic chars pass, URLs/descriptions don't.
assert.equal(isEmojiAlt("🎉"), true);
assert.equal(isEmojiAlt("❤️"), true);
assert.equal(isEmojiAlt("👍🏻"), true);
assert.equal(isEmojiAlt(""), false);
assert.equal(isEmojiAlt("https://example.com/a.png"), false);
assert.equal(isEmojiAlt("a screenshot of my desk"), false);

// Emoji URL decoding — any hex-codepoint filename that decodes to a real emoji.
assert.equal(
  emojiFromSrc(
    "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f389.png"
  ),
  "🎉"
);
assert.equal(
  emojiFromSrc(
    "https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.0.3/assets/svg/2764-fe0f.svg"
  ),
  "❤️"
);
assert.equal(
  emojiFromSrc("https://cdn.joypixels.com/images/ios/png/unicode/2764.png"),
  "❤"
);
assert.equal(
  emojiFromSrc("https://www.notion.so/images/emoji/emoji_u1f389.png"),
  "🎉"
);
assert.equal(emojiFromSrc("https://example.com/photo.png"), null);
assert.equal(emojiFromSrc("https://cdn.example.com/uploads/deadbeef.png"), null);
assert.equal(emojiFromSrc("https://cdn.example.com/uploads/a.png"), null);
assert.equal(emojiFromSrc(""), null);

console.log("paste-sanitize checks passed");
