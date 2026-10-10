import assert from "node:assert/strict";
import {
  normalizeSharePermission,
  roomIdForFile,
  sanitizeGuestName,
  isShareTokenFormat,
} from "../lib/share-links.ts";

// 1. Room IDs are namespaced per file and reject bad file IDs.
assert.equal(roomIdForFile("file-123"), "filebase:file:file-123");
assert.throws(() => roomIdForFile(""), /file id/i);
assert.throws(() => roomIdForFile("../../etc"), /file id/i);
assert.throws(() => roomIdForFile("has space"), /file id/i);

// 2. Permissions normalize strictly — anything unknown is rejected.
assert.equal(normalizeSharePermission("read"), "read");
assert.equal(normalizeSharePermission("write"), "write");
assert.throws(() => normalizeSharePermission("admin"), /permission/i);
assert.throws(() => normalizeSharePermission(""), /permission/i);

// 3. Share tokens are 256-bit base64url (43-44 chars, no padding).
assert.equal(isShareTokenFormat("A".repeat(43)), true);
assert.equal(isShareTokenFormat("Bb3-xyz_ABC".padEnd(44, "z")), true);
assert.equal(isShareTokenFormat("short"), false);
assert.equal(isShareTokenFormat("has space".padEnd(44, "x")), false);
assert.equal(isShareTokenFormat("has+plus".padEnd(44, "x")), false);

// 4. Guest display names are sanitized, bounded, and never empty.
assert.equal(sanitizeGuestName("  Ada  "), "Ada");
assert.equal(sanitizeGuestName(""), "Guest");
assert.equal(sanitizeGuestName("   "), "Guest");
assert.equal(sanitizeGuestName("x".repeat(200)).length <= 32, true);
assert.equal(sanitizeGuestName("<script>alert(1)</script>"), "scriptalert(1)/script");

console.log("share-links checks passed");
