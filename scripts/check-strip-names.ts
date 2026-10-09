import assert from "node:assert/strict";
import { stripExtension } from "../lib/items.ts";

const taken = new Set<string>(["welcome"]);

// 1. Extension stripped.
assert.equal(stripExtension("notes.txt", taken), "notes");
assert.equal(stripExtension("readme.md", taken), "readme");

// 2. Your exact case: seeded name normalizes to a clean title.
assert.equal(stripExtension("welcome.txt", new Set()), "welcome");

// 3. Already-taken base name → keep original (no silent merge).
assert.equal(stripExtension("welcome.txt", taken), null);

// 4. No extension / dotfile-style → unchanged.
assert.equal(stripExtension("Welcome", taken), null);
assert.equal(stripExtension(".hidden", taken), null);
assert.equal(stripExtension("no-extension", taken), null);

// 5. Not extension-like: multi-dot prose names stay.
assert.equal(stripExtension("v1.2 notes", taken), null);
assert.equal(stripExtension("report.final.docx", taken), "report.final");

console.log("strip-extension checks passed");
