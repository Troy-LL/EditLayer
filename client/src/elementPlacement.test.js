import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeAtomicPasteOffsets, STACK_NUDGE } from "./elementPlacement.js";

describe("computeAtomicPasteOffsets", () => {
  it("writes final offsets in one snapshot (no 0,0 then async patch)", () => {
    const updates = computeAtomicPasteOffsets({
      sources: [{ id: "a", offsetX: 40, offsetY: 10 }],
      copies: [{ id: "a-copy" }],
      sourceVisuals: { a: { x: 100, y: 80 } },
      visualRelatives: { a: { x: 0, y: 0 } },
      anchorPage: { x: 160, y: 110 },
    });
    assert.deepEqual(updates, [{ id: "a-copy", offsetX: 100, offsetY: 40 }]);
  });

  it("keeps group relatives in the same write", () => {
    const updates = computeAtomicPasteOffsets({
      sources: [
        { id: "a", offsetX: 0, offsetY: 0 },
        { id: "b", offsetX: 20, offsetY: 8 },
      ],
      copies: [{ id: "a2" }, { id: "b2" }],
      sourceVisuals: { a: { x: 10, y: 10 }, b: { x: 30, y: 18 } },
      visualRelatives: { a: { x: 0, y: 0 }, b: { x: 20, y: 8 } },
      anchorPage: { x: 50, y: 50 },
    });
    assert.deepEqual(updates[0], { id: "a2", offsetX: 40, offsetY: 40 });
    assert.deepEqual(updates[1], { id: "b2", offsetX: 60, offsetY: 48 });
  });

  it("stack nudge is a known step, not a second history entry", () => {
    assert.equal(STACK_NUDGE, 12);
  });
});
