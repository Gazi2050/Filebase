import assert from "node:assert/strict";
import { incomingShouldWin } from "../lib/sync-rules.ts";

// 1. New remote row applies to a missing local row.
assert.equal(incomingShouldWin(undefined, 100), true);

// 2. Strictly newer remote row wins.
assert.equal(incomingShouldWin(50, 100), true);

// 3. Equal timestamps: keep local (no-op).
assert.equal(incomingShouldWin(100, 100), false);

// 4. Older remote row loses to newer local row.
assert.equal(incomingShouldWin(200, 100), false);

// 5. A tombstone at least as new as the incoming row blocks resurrection.
assert.equal(incomingShouldWin(undefined, 100, 100), false);
assert.equal(incomingShouldWin(50, 100, 150), false);

// 6. A tombstone older than the incoming row does not block it
//    (item was edited again after the delete arrived).
assert.equal(incomingShouldWin(undefined, 200, 100), true);

console.log("sync-rules checks passed");
