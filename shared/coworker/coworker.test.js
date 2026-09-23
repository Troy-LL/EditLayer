import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { applyOps, summarizeOp } from "./ops.js";
import { validateConfig } from "./schema.js";
import { contrastRatio, fixOpsFor, parseColor, reviewConfig } from "./review.js";
import { PRESETS } from "../../seeds/index.js";
import { findElementById, findParentId } from "../../client/src/elementTree.js";
import { createElement } from "../../client/src/elementFactory.js";
import { mergeElement } from "../elementDefaults.js";

const base = () => ({
  pageBackground: "#ffffff",
  elements: [
    { id: "h", type: "heading", text: "Hello", fontSize: 32 },
    { id: "p", type: "paragraph", text: "Body", color: "#333333" },
    {
      id: "frame",
      type: "container",
      children: [{ id: "cta", type: "button", label: "Go", href: "/go" }],
    },
  ],
});

describe("applyOps", () => {
  it("inserts with generated id, type seeds, and minimal stored fields", () => {
    const res = applyOps(base(), [{ op: "insert", element: { type: "heading", text: "New" }, afterId: "h" }]);
    assert.equal(res.ok, true);
    const id = res.results[0].id;
    assert.match(id, /^heading-/);
    assert.equal(res.config.elements[1].id, id);
    assert.equal(res.config.elements[1].fontSize, 32);
    assert.equal(res.config.elements[1].children, undefined);
    assert.equal(res.resolvedOps[0].element.id, id, "resolved op carries id for replay");
  });

  it("inserted elements keep type defaults (button fill, link ink, frame border)", () => {
    for (const [type, key, value] of [
      ["button", "backgroundColor", "#2563eb"],
      ["button", "color", "#ffffff"],
      ["link", "color", "#2563eb"],
      ["container", "borderWidth", 1],
    ]) {
      assert.equal(mergeElement(createElement(type))[key], value, `${type}.${key}`);
    }
    const res = applyOps(base(), [{ op: "insert", element: { type: "button", label: "Buy", href: "/b" } }]);
    assert.equal(reviewConfig(res.config).counts.error, 0);
  });

  it("replaying resolved ops on the same base yields the same config", () => {
    const first = applyOps(base(), [
      { op: "insert", element: { type: "container", children: [{ type: "paragraph", text: "x" }] } },
    ]);
    const replay = applyOps(base(), first.resolvedOps);
    assert.deepEqual(replay.config, first.config);
  });

  it("inserts into a container", () => {
    const res = applyOps(base(), [{ op: "insert", parentId: "frame", element: { type: "link", text: "Docs" } }]);
    assert.equal(findParentId(res.config.elements, res.results[0].id), "frame");
  });

  it("updates, rejecting unknown fields, bad values, and protected keys", () => {
    assert.equal(applyOps(base(), [{ op: "update", id: "h", set: { fontSize: 48 } }]).config.elements[0].fontSize, 48);
    assert.match(applyOps(base(), [{ op: "update", id: "h", set: { fontsize: 48 } }]).error, /unknown field "fontsize"/);
    assert.match(applyOps(base(), [{ op: "update", id: "h", set: { color: "blue-ish" } }]).error, /color must be/);
    assert.match(applyOps(base(), [{ op: "update", id: "h", set: { type: "paragraph" } }]).error, /cannot set type/);
    assert.match(applyOps(base(), [{ op: "update", id: "nope", set: { text: "x" } }]).error, /not found/);
  });

  it("is atomic: a failing op leaves nothing applied and names the index", () => {
    const cfg = base();
    const res = applyOps(cfg, [
      { op: "update", id: "h", set: { text: "Changed" } },
      { op: "delete", ids: ["ghost"] },
    ]);
    assert.equal(res.ok, false);
    assert.equal(res.index, 1);
    assert.match(res.error, /^op 1 \(delete\)/);
    assert.equal(cfg.elements[0].text, "Hello");
  });

  it("moves between parents and refuses cycles", () => {
    const moved = applyOps(base(), [{ op: "move", id: "p", parentId: "frame" }]);
    assert.equal(findParentId(moved.config.elements, "p"), "frame");
    const back = applyOps(moved.config, [{ op: "move", id: "p", parentId: null, afterId: "h" }]);
    assert.deepEqual(back.config.elements.map((e) => e.id), ["h", "p", "frame"]);
    assert.match(applyOps(base(), [{ op: "move", id: "frame", parentId: "frame" }]).error, /into itself/);
  });

  it("groups siblings, names the frame, and ungroups", () => {
    const grouped = applyOps(base(), [{ op: "group", ids: ["h", "p"], name: "Hero" }]);
    const frameId = grouped.results[0].id;
    assert.equal(findElementById(grouped.config.elements, frameId).name, "Hero");
    assert.equal(findParentId(grouped.config.elements, "h"), frameId);
    const ungrouped = applyOps(grouped.config, [{ op: "ungroup", id: frameId }]);
    assert.equal(findParentId(ungrouped.config.elements, "h"), null);
    assert.match(applyOps(base(), [{ op: "group", ids: ["h", "cta"] }]).error, /share a parent/);
  });

  it("deletes recursively and sets page fields", () => {
    const res = applyOps(base(), [
      { op: "delete", ids: ["frame"] },
      { op: "setPage", set: { pageBackground: "#101010" } },
    ]);
    assert.equal(findElementById(res.config.elements, "cta"), null);
    assert.equal(res.config.pageBackground, "#101010");
    assert.deepEqual(res.touchedIds, []);
  });

  it("summarizes ops for the activity feed", () => {
    assert.equal(summarizeOp({ op: "update", id: "h", set: { color: "#000" } }), "update h (color)");
  });
});

describe("validateConfig", () => {
  it("accepts every shipped preset", () => {
    for (const [name, { config }] of Object.entries(PRESETS)) {
      assert.deepEqual(validateConfig(config).errors, [], name);
    }
  });

  it("flags duplicate ids, bad types, and non-empty children on leaves", () => {
    const { errors } = validateConfig({
      elements: [
        { id: "a", type: "heading" },
        { id: "a", type: "banner" },
        { id: "b", type: "paragraph", children: [{ id: "c", type: "heading" }] },
      ],
    });
    assert.ok(errors.some((e) => /duplicate id/.test(e)));
    assert.ok(errors.some((e) => /type must be one of/.test(e)));
    assert.ok(errors.some((e) => /only containers can have children/.test(e)));
  });

  it("tolerates editor-shaped elements (children: [] on leaves, unknown keys as warnings)", () => {
    const { errors, warnings } = validateConfig({
      elements: [{ id: "a", type: "heading", children: [], legacyFlag: true }],
    });
    assert.deepEqual(errors, []);
    assert.equal(warnings.length, 1);
  });
});

describe("reviewConfig", () => {
  it("computes WCAG contrast", () => {
    assert.equal(contrastRatio(parseColor("#000"), parseColor("#fff")).toFixed(0), "21");
    assert.equal(contrastRatio(parseColor("#9ca3af"), parseColor("#ffffff")).toFixed(2), "2.54");
  });

  it("flags low contrast and its auto-fix passes review", () => {
    const cfg = { elements: [{ id: "tip", type: "paragraph", text: "Tip", color: "#9ca3af" }] };
    const review = reviewConfig(cfg);
    const f = review.findings.find((x) => x.rule === "contrast");
    assert.equal(f.severity, "error");
    const fixed = applyOps(cfg, fixOpsFor(review.findings));
    assert.equal(reviewConfig(fixed.config).findings.filter((x) => x.rule === "contrast").length, 0);
  });

  it("uses the parent frame fill as the text backdrop", () => {
    const cfg = {
      elements: [
        {
          id: "dark",
          type: "container",
          backgroundColor: "#111827",
          children: [{ id: "t", type: "paragraph", text: "x", color: "#1a1a1a" }],
        },
      ],
    };
    const f = reviewConfig(cfg).findings.find((x) => x.rule === "contrast");
    assert.equal(f.elementId, "t");
    assert.equal(f.fix[0].set.color.toLowerCase() > "#8", true, "fix lightens ink on dark fill");
  });

  it("flags empty content, missing alt, tiny buttons, and scores", () => {
    const review = reviewConfig({
      elements: [
        { id: "e", type: "heading", text: " " },
        { id: "img", type: "image", src: "/a.png", alt: "" },
        { id: "b", type: "button", label: "x", href: "/", fontSize: 10, padding: 0 },
      ],
    });
    const rules = review.findings.map((f) => `${f.rule}:${f.elementId}`).sort();
    assert.deepEqual(rules, ["empty-content:e", "image-alt:img", "min-font-size:b", "tap-target:b"]);
    assert.equal(review.score, 80);
  });

  it("skips hidden elements", () => {
    const review = reviewConfig({ elements: [{ id: "x", type: "paragraph", text: "", hidden: true }] });
    assert.equal(review.findings.length, 0);
  });
});

const scenariosDir = join(dirname(fileURLToPath(import.meta.url)), "../../scenarios");

describe("scenarios (same files the live `coworker scenario` runs)", () => {
  for (const file of readdirSync(scenariosDir).filter((f) => f.endsWith(".json"))) {
    it(file, () => {
      const scenario = JSON.parse(readFileSync(join(scenariosDir, file), "utf8"));
      let config = structuredClone(PRESETS[scenario.preset].config);
      for (const step of scenario.steps) {
        const res = applyOps(config, step.ops);
        if (step.expectError) {
          assert.equal(res.ok, false, `${step.note}: expected failure`);
          assert.match(res.error, new RegExp(step.expectError));
          continue;
        }
        assert.equal(res.ok, true, `${step.note}: ${res.error}`);
        config = res.config;
      }
      const review = reviewConfig(config);
      const { expect } = scenario;
      if (expect.minScore != null) assert.ok(review.score >= expect.minScore, `score ${review.score}`);
      if (expect.maxErrors != null) assert.ok(review.counts.error <= expect.maxErrors, JSON.stringify(review.findings));
      for (const id of expect.present ?? []) assert.ok(findElementById(config.elements, id), `missing ${id}`);
      for (const id of expect.absent ?? []) assert.equal(findElementById(config.elements, id), null, `still has ${id}`);
    });
  }
});
