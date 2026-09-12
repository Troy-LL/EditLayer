import "./testDom.js";
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { useRef, useState } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { findElementById } from "./elementTree.js";
import useEditorMutations from "./useEditorMutations.js";
import useConfigHistory from "./hooks/useConfigHistory.js";
import InspectorPanel from "./components/InspectorPanel.jsx";
import LayersPanel from "./components/LayersPanel.jsx";

afterEach(() => cleanup());

const lockMix = [
  {
    id: "frame",
    type: "container",
    locked: true,
    name: "Locked frame",
    children: [
      { id: "child", type: "heading", text: "Kid", offsetX: 50, offsetY: 8, width: 20, height: 20 },
    ],
  },
  { id: "a", type: "heading", text: "A", offsetX: 0, offsetY: 0, width: 20, height: 20 },
  { id: "b", type: "heading", text: "B", offsetX: 40, offsetY: 0, width: 20, height: 20 },
];

function MutationHarness({ initialElements, initialSelected }) {
  const [config, setConfig] = useState({ elements: initialElements });
  const [selectedIds, setSelectedIds] = useState(initialSelected);
  const configRef = useRef(config);
  configRef.current = config;
  const history = useConfigHistory();
  const endContinuousEdit = () => {};
  const actions = useEditorMutations({
    configRef,
    selectedIds,
    selectedId: selectedIds[selectedIds.length - 1] ?? null,
    setSelectedIds,
    setConfig,
    history,
    endContinuousEdit,
  });

  return (
    <div>
      <button type="button" onClick={actions.handleGroup}>
        Group
      </button>
      <button type="button" onClick={actions.handleUngroup}>
        Ungroup
      </button>
      <button type="button" onClick={() => actions.handleAlign("left", null)}>
        Align left
      </button>
      <button type="button" onClick={() => actions.handleToggleLock("frame")}>
        Lock frame
      </button>
      <output data-testid="selected">{selectedIds.join(",")}</output>
      <output data-testid="tree">{JSON.stringify(config.elements)}</output>
    </div>
  );
}

function treeFrom(html) {
  return JSON.parse(html);
}

describe("mounted handlers refuse lock-inherited ids", () => {
  it("group does not lift an inherit-locked child", async () => {
    render(<MutationHarness initialElements={lockMix} initialSelected={["child", "a", "b"]} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Group" }));
    });
    const tree = treeFrom(screen.getByTestId("tree").textContent);
    assert.equal(findElementById(tree, "frame").children[0].id, "child");
    assert.equal(
      JSON.stringify(tree).includes('"id":"child"') &&
        findElementById(tree, "frame").children.some((c) => c.id === "child"),
      true
    );
  });

  it("ungroup is a no-op on a locked container", async () => {
    render(<MutationHarness initialElements={lockMix} initialSelected={["frame"]} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Ungroup" }));
    });
    const tree = treeFrom(screen.getByTestId("tree").textContent);
    assert.equal(tree.find((el) => el.id === "frame").locked, true);
    assert.equal(tree.find((el) => el.id === "frame").children[0].id, "child");
  });

  it("align does not move an inherit-locked child", async () => {
    render(<MutationHarness initialElements={lockMix} initialSelected={["child", "a", "b"]} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Align left" }));
    });
    const tree = treeFrom(screen.getByTestId("tree").textContent);
    assert.equal(findElementById(tree, "child").offsetX, 50);
    assert.equal(findElementById(tree, "b").offsetX, 0);
  });

  it("toggleLock drops lock-inherited descendants from selection", async () => {
    const open = [
      {
        id: "frame",
        type: "container",
        locked: false,
        children: [{ id: "child", type: "heading", text: "Kid" }],
      },
      { id: "loose", type: "heading", text: "Out" },
    ];
    render(<MutationHarness initialElements={open} initialSelected={["frame", "child", "loose"]} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Lock frame" }));
    });
    assert.equal(screen.getByTestId("selected").textContent, "loose");
  });
});

describe("inspector offset uses canMutate", () => {
  it("does not write X/Y for an inherit-locked child", async () => {
    const calls = [];
    const child = lockMix[0].children[0];
    render(
      <InspectorPanel
        element={child}
        elements={lockMix}
        onChange={(id, patch) => calls.push({ id, patch })}
        overlayMode="A"
      />
    );
    const x = screen.getAllByRole("spinbutton")[0];
    assert.equal(x.disabled, true);
    await act(async () => {
      fireEvent.change(x, { target: { value: "99" } });
    });
    assert.deepEqual(calls, []);
  });
});

describe("layers rename/hide refuse inherit-locked rows", () => {
  it("does not rename or hide a child under a locked frame", async () => {
    const renamed = [];
    const hidden = [];
    render(
      <LayersPanel
        config={{ elements: lockMix }}
        selectedIds={["child"]}
        pageSelected={false}
        onSelectPage={() => {}}
        onSelectElement={() => {}}
        onToggleHidden={(id) => hidden.push(id)}
        onToggleLock={() => {}}
        onRename={(id, name) => renamed.push({ id, name })}
        onMoveBefore={() => {}}
      />
    );
    const kidRow = screen.getByText("Kid").closest(".layers-row");
    const hideKid = kidRow.querySelector('[aria-label="Hide element"]');
    const renameKid = kidRow.querySelector('[aria-label="Rename layer"]');
    assert.equal(hideKid.disabled, true);
    assert.equal(renameKid.disabled, true);
    await act(async () => {
      fireEvent.click(hideKid);
      fireEvent.click(renameKid);
    });
    assert.deepEqual(hidden, []);
    assert.equal(screen.queryByDisplayValue("Kid"), null);
    assert.deepEqual(renamed, []);
  });
});
