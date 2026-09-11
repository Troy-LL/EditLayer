import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cloneForPaste } from "./elementClipboard.js";

describe("cloneForPaste", () => {
  it("re-ids the whole tree, including grandchildren", () => {
    const source = {
      id: "card",
      type: "container",
      offsetX: 10,
      offsetY: 20,
      positioning: "absolute",
      children: [
        {
          id: "child",
          type: "container",
          children: [{ id: "grand", type: "heading", text: "Hi", offsetX: 4, offsetY: 2 }],
        },
      ],
    };

    const copy = cloneForPaste(source);

    assert.notEqual(copy.id, "card");
    assert.notEqual(copy.children[0].id, "child");
    assert.notEqual(copy.children[0].children[0].id, "grand");
    assert.equal(copy.children[0].children[0].text, "Hi");
    assert.equal(copy.offsetX, 0);
    assert.equal(copy.offsetY, 0);
    assert.equal(copy.positioning, undefined);
    assert.equal(copy.children[0].children[0].offsetX, 4);
  });
});
