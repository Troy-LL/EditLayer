import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveRemoteChange } from "./boardSync.js";
import { applyOps } from "../../shared/coworker/ops.js";
import { mergeConfig } from "./elementDefaults.js";

const base = mergeConfig({
  elements: [
    { id: "h", type: "heading", text: "Hi" },
    { id: "p", type: "paragraph", text: "Body" },
  ],
});

describe("resolveRemoteChange", () => {
  it("clean tab adopts the server config", () => {
    const remote = applyOps(base, [{ op: "update", id: "h", set: { fontSize: 50 } }]);
    const out = resolveRemoteChange({ local: base, saved: base, event: { config: remote.config, ops: remote.resolvedOps } });
    assert.equal(out.replayed, false);
    assert.equal(out.config.elements[0].fontSize, 50);
  });

  it("dirty tab keeps its unsaved edit and gains the AI change", () => {
    const local = applyOps(base, [{ op: "update", id: "p", set: { text: "My draft" } }]).config;
    const remote = applyOps(base, [{ op: "insert", element: { type: "button", label: "Buy", href: "/b" } }]);
    const out = resolveRemoteChange({ local, saved: base, event: { config: remote.config, ops: remote.resolvedOps } });
    assert.equal(out.replayed, true);
    assert.equal(out.config.elements[1].text, "My draft");
    assert.equal(out.config.elements[2].label, "Buy");
    assert.equal(out.config.elements[2].id, remote.results[0].id, "same id as the server");
  });

  it("dirty tab falls back to server when replay conflicts (element deleted locally)", () => {
    const local = applyOps(base, [{ op: "delete", ids: ["h"] }]).config;
    const remote = applyOps(base, [{ op: "update", id: "h", set: { text: "AI" } }]);
    const out = resolveRemoteChange({ local, saved: base, event: { config: remote.config, ops: remote.resolvedOps } });
    assert.equal(out.replayed, false);
    assert.equal(out.config.elements[0].text, "AI");
  });
});
