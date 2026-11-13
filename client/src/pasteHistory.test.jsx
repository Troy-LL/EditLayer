import "./testDom.js";
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { useState } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { cloneForPaste, commitPasteOrDuplicate } from "./elementClipboard.js";
import { findElementById } from "./elementTree.js";
import useConfigHistory from "./hooks/useConfigHistory.js";

afterEach(() => cleanup());

const baseTree = [
  { id: "h1", type: "heading", text: "Title", offsetX: 0, offsetY: 0, width: 200, height: 40 },
  { id: "p1", type: "paragraph", text: "Body", offsetX: 0, offsetY: 50, width: 200, height: 24 },
];

function HistoryHarness({ initialElements }) {
  const [config, setConfig] = useState({ elements: initialElements });
  const history = useConfigHistory();

  const pasteOrDup = (copies, placement) => {
    setConfig((prev) => commitPasteOrDuplicate(history, prev, copies, placement));
  };

  const undo = () => {
    setConfig((prev) => history.undo(prev) ?? prev);
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          const source = config.elements.find((el) => el.id === "h1");
          pasteOrDup([cloneForPaste(source)], { parentId: null, afterId: "h1" });
        }}
      >
        Paste
      </button>
      <button
        type="button"
        onClick={() => {
          const source = config.elements.find((el) => el.id === "h1");
          pasteOrDup([cloneForPaste(source)], { parentId: null, afterId: "h1" });
        }}
      >
        Duplicate
      </button>
      <button
        type="button"
        onClick={() => {
          const sources = config.elements.filter((el) => el.id === "h1" || el.id === "p1");
          pasteOrDup(
            sources.map((source) => cloneForPaste(source)),
            { parentId: null, afterId: "p1" }
          );
        }}
      >
        Paste many
      </button>
      <button type="button" onClick={undo}>
        Undo
      </button>
      <output data-testid="ids">{config.elements.map((el) => el.id).join(",")}</output>
      <output data-testid="tree">{JSON.stringify(config.elements)}</output>
      <output data-testid="can-undo">{String(history.canUndo)}</output>
    </div>
  );
}

describe("paste/dup history is a single snapshot", () => {
  it("undo once after paste restores the pre-paste tree", async () => {
    render(<HistoryHarness initialElements={baseTree} />);
    const before = screen.getByTestId("tree").textContent;
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Paste" }));
    });
    const afterPaste = screen.getByTestId("ids").textContent.split(",");
    assert.equal(afterPaste.length, 3);
    assert.equal(afterPaste.includes("h1"), true);
    assert.equal(screen.getByTestId("can-undo").textContent, "true");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    });
    assert.equal(screen.getByTestId("tree").textContent, before);
    assert.equal(screen.getByTestId("ids").textContent, "h1,p1");
  });

  it("undo once after duplicate restores the pre-duplicate tree", async () => {
    render(<HistoryHarness initialElements={baseTree} />);
    const before = screen.getByTestId("tree").textContent;
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Duplicate" }));
    });
    assert.equal(screen.getByTestId("ids").textContent.split(",").length, 3);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    });
    assert.equal(screen.getByTestId("tree").textContent, before);
  });

  it("multi-item paste is still one history entry", async () => {
    render(<HistoryHarness initialElements={baseTree} />);
    const before = screen.getByTestId("tree").textContent;
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Paste many" }));
    });
    assert.equal(screen.getByTestId("ids").textContent.split(",").length, 4);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    });
    assert.equal(screen.getByTestId("tree").textContent, before);
    assert.equal(findElementById(JSON.parse(before), "h1").text, "Title");
  });
});
