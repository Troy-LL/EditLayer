import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cloneForPaste } from "./elementClipboard.js";
import {
  alignMutableSelection,
  canCanvasGesture,
  canMutate,
  distributeMutableSelection,
  filterCanvasSelection,
  findElementById,
  findParentId,
  groupMutableSelection,
  insertIntoTree,
  insertIntoTreeMany,
  isElementLocked,
  moveElementBefore,
  resolvePasteParent,
  selectionAfterToggleLock,
  ungroupMutableSelection,
} from "./elementTree.js";

const tree = [
  {
    id: "frame",
    type: "container",
    locked: true,
    children: [
      { id: "child", type: "heading", text: "In", locked: false },
      {
        id: "inner",
        type: "container",
        locked: false,
        children: [{ id: "grand", type: "paragraph", text: "G" }],
      },
    ],
  },
  { id: "loose", type: "heading", text: "Out", locked: false },
];

describe("canMutate", () => {
  it("inherits ancestor lock", () => {
    assert.equal(canMutate(tree, "frame"), false);
    assert.equal(canMutate(tree, "child"), false);
    assert.equal(canMutate(tree, "grand"), false);
    assert.equal(canMutate(tree, "loose"), true);
  });
});

describe("canvas gestures inherit ancestor lock", () => {
  it("blocks drag and select on a child when an ancestor is locked", () => {
    assert.equal(isElementLocked(tree, "child"), false);
    assert.equal(isElementLocked(tree, "grand"), false);
    assert.equal(canCanvasGesture(tree, "child"), false);
    assert.equal(canCanvasGesture(tree, "grand"), false);
    assert.equal(canCanvasGesture(tree, "loose"), true);
    assert.deepEqual(filterCanvasSelection(tree, ["child", "grand", "loose"]), ["loose"]);
  });
});

describe("resolvePasteParent", () => {
  it("pastes into the selected unlocked frame", () => {
    const open = [{ id: "box", type: "container", children: [] }, { id: "h", type: "heading" }];
    assert.deepEqual(resolvePasteParent(open, ["box"]), { parentId: "box", afterId: null });
    assert.deepEqual(resolvePasteParent(open, ["h"]), { parentId: null, afterId: "h" });
  });

  it("does not paste into a locked frame", () => {
    assert.deepEqual(resolvePasteParent(tree, ["frame"]), { parentId: null, afterId: "frame" });
  });
});

describe("insertIntoTree", () => {
  it("inserts after a nested sibling, not at root", () => {
    const next = insertIntoTree(tree, { id: "n", type: "heading", text: "N" }, { afterId: "child" });
    const frame = next.find((el) => el.id === "frame");
    assert.equal(frame.children[1].id, "n");
    assert.equal(next.some((el) => el.id === "n"), false);
  });

  it("inserts many into a frame", () => {
    const open = [{ id: "box", type: "container", children: [] }];
    const next = insertIntoTreeMany(
      open,
      [
        { id: "a", type: "heading" },
        { id: "b", type: "heading" },
      ],
      { parentId: "box" }
    );
    assert.deepEqual(
      next[0].children.map((c) => c.id),
      ["a", "b"]
    );
  });
});

describe("moveElementBefore", () => {
  it("refuses to reorder a locked or lock-inherited node", () => {
    const same = moveElementBefore(tree, "child", "inner");
    assert.equal(same, tree);
    const unlocked = [
      { id: "a", type: "heading", zIndex: 0 },
      { id: "b", type: "heading", zIndex: 1 },
    ];
    const moved = moveElementBefore(unlocked, "b", "a");
    assert.notEqual(moved[0].zIndex, unlocked[0].zIndex);
  });
});

describe("findParentId", () => {
  it("returns the container id or null at root", () => {
    assert.equal(findParentId(tree, "child"), "frame");
    assert.equal(findParentId(tree, "grand"), "inner");
    assert.equal(findParentId(tree, "loose"), null);
  });
});

describe("paste-into-frame tree", () => {
  it("lands the clone under the selected container, not at root", () => {
    const open = [
      { id: "box", type: "container", children: [{ id: "old", type: "heading", text: "Old" }] },
      { id: "src", type: "heading", text: "Copy me", offsetX: 8 },
    ];
    const parent = resolvePasteParent(open, ["box"]);
    const copy = cloneForPaste(open[1]);
    const next = insertIntoTreeMany(open, [copy], parent);
    assert.deepEqual(parent, { parentId: "box", afterId: null });
    assert.equal(next[0].children.length, 2);
    assert.equal(next[0].children[1].text, "Copy me");
    assert.notEqual(next[0].children[1].id, "src");
    assert.equal(
      next.some((el) => el.id === copy.id),
      false
    );
  });
});

describe("multi-select duplicate", () => {
  it("clones every selected root into the tree", () => {
    const open = [
      { id: "a", type: "heading", text: "A" },
      { id: "b", type: "heading", text: "B" },
    ];
    const copies = ["a", "b"].map((id) => cloneForPaste(open.find((el) => el.id === id)));
    const next = insertIntoTreeMany(open, copies, { parentId: null, afterId: "b" });
    assert.equal(next.length, 4);
    assert.deepEqual(
      next.map((el) => el.text),
      ["A", "B", "A", "B"]
    );
    assert.notEqual(next[2].id, "a");
    assert.notEqual(next[3].id, "b");
  });
});

const lockMix = [
  {
    id: "frame",
    type: "container",
    locked: true,
    children: [{ id: "child", type: "heading", text: "In", offsetX: 50, offsetY: 0, width: 20, height: 20 }],
  },
  { id: "a", type: "heading", text: "A", offsetX: 0, offsetY: 0, width: 20, height: 20 },
  { id: "b", type: "heading", text: "B", offsetX: 40, offsetY: 0, width: 20, height: 20 },
  { id: "c", type: "heading", text: "C", offsetX: 200, offsetY: 0, width: 20, height: 20 },
];

describe("group/ungroup refuse lock-inherited ids", () => {
  it("groupMutableSelection drops inherit-locked children and does not lift them", () => {
    const { elements, containerId } = groupMutableSelection(lockMix, ["child", "a", "b"]);
    assert.ok(containerId);
    const frame = elements.find((el) => el.id === "frame");
    assert.equal(frame.children[0].id, "child");
    const group = findElementById(elements, containerId);
    const groupedIds = (group.children ?? []).map((el) => el.id).toSorted();
    assert.deepEqual(groupedIds, ["a", "b"]);
    assert.equal(
      groupedIds.includes("child"),
      false
    );
  });

  it("ungroupMutableSelection is a no-op on a locked or lock-inherited container", () => {
    const locked = ungroupMutableSelection(tree, ["frame"]);
    assert.equal(locked.elements, tree);
    assert.deepEqual(locked.childIds, []);
    const inherited = ungroupMutableSelection(tree, ["inner"]);
    assert.equal(inherited.elements, tree);
    assert.deepEqual(inherited.childIds, []);
  });
});

describe("align/distribute refuse lock-inherited ids", () => {
  it("alignMutableSelection does not move a lock-inherited child", () => {
    const next = alignMutableSelection(lockMix, ["child", "a", "b"], { horizontal: "left" });
    assert.equal(findElementById(next, "child").offsetX, 50);
    assert.equal(findElementById(next, "a").offsetX, 0);
    assert.equal(findElementById(next, "b").offsetX, 0);
  });

  it("distributeMutableSelection does not move a lock-inherited child", () => {
    const next = distributeMutableSelection(lockMix, ["child", "a", "b", "c"], "horizontal");
    assert.equal(findElementById(next, "child").offsetX, 50);
    assert.notEqual(findElementById(next, "b").offsetX, 40);
  });
});

describe("toggle lock drops lock-inherited descendants from selection", () => {
  it("selectionAfterToggleLock drops the locked id and its descendants", () => {
    const open = [
      {
        id: "frame",
        type: "container",
        locked: false,
        children: [
          { id: "child", type: "heading" },
          { id: "inner", type: "container", children: [{ id: "grand", type: "paragraph" }] },
        ],
      },
      { id: "loose", type: "heading" },
    ];
    assert.deepEqual(
      selectionAfterToggleLock(open, ["frame", "child", "grand", "loose"], "frame"),
      ["loose"]
    );
  });
});
