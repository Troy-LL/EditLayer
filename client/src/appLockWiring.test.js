import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

const app = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");

describe("App lock-inherit wiring", () => {
  it("group/ungroup/align/distribute/toggleLock call mutable gates, not raw selectedIds", () => {
    assert.match(app, /groupMutableSelection\(/);
    assert.match(app, /ungroupMutableSelection\(/);
    assert.match(app, /alignMutableSelection\(/);
    assert.match(app, /distributeMutableSelection\(/);
    assert.match(app, /selectionAfterToggleLock\(/);
    assert.doesNotMatch(app, /reparentAndGroup\(\s*prev\.elements,\s*selectedIds\s*\)/);
    assert.doesNotMatch(app, /alignSelectedElements\(\s*prev\.elements,\s*ids/);
    assert.doesNotMatch(app, /distributeSelectedElements\(\s*prev\.elements,\s*ids/);
    assert.match(app, /setSelectedIds\(\s*\(prev\)\s*=>\s*selectionAfterToggleLock\(/);
  });
});
