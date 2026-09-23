import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createProjectOverlay } from "./projectOverlay.js";
import { createUndoStore } from "../packages/vite-plugin-editlayer/undoStore.js";

function openColumn(code, line, tag) {
  const row = code.split("\n")[line - 1];
  const idx = row.indexOf(`<${tag}`);
  return idx + 1;
}

function withTmpProject(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "editlayer-overlay-"));
  try {
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("style edit + undo restores bytes", () => {
  withTmpProject((root) => {
    const rel = "src/Hero.jsx";
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    const before = `export function Hero() {
  return <button>Go</button>;
}
`;
    fs.writeFileSync(abs, before, "utf8");

    const col = openColumn(before, 2, "button");
    const undo = createUndoStore(root);
    const overlay = createProjectOverlay({ root, undo });

    const result = overlay.apply({
      source: `${rel}:2:${col}`,
      style: { paddingTop: "120px" },
    });
    assert.equal(result.ok, true);
    assert.equal(result.undoDepth, 1);
    const afterApply = fs.readFileSync(abs, "utf8");
    assert.notEqual(afterApply, before);
    assert.match(afterApply, /paddingTop: "120px"/);

    const undone = overlay.undoApply();
    assert.equal(undone.ok, true);
    assert.equal(fs.readFileSync(abs, "utf8"), before);
    assert.equal(undone.undoDepth, 0);
  });
});

test("css declaration edit", () => {
  withTmpProject((root) => {
    const rel = "src/styles.css";
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    const before = `.hero__title {
  font-weight: 400;
}
`;
    fs.writeFileSync(abs, before, "utf8");

    const undo = createUndoStore(root);
    const overlay = createProjectOverlay({ root, undo });
    const result = overlay.apply({
      css: [
        {
          file: rel,
          selector: ".hero__title",
          property: "font-weight",
          value: "700",
        },
      ],
    });
    assert.equal(result.ok, true);
    assert.equal(
      fs.readFileSync(abs, "utf8"),
      `.hero__title {
  font-weight: 700;
}
`,
    );
  });
});

test("failed css edit leaves jsx untouched and undo depth 0", () => {
  withTmpProject((root) => {
    const jsxRel = "src/Hero.jsx";
    const cssRel = "src/styles.css";
    const jsxAbs = path.join(root, jsxRel);
    const cssAbs = path.join(root, cssRel);
    fs.mkdirSync(path.dirname(jsxAbs), { recursive: true });
    const jsxBefore = `export function Hero() {
  return <button>Go</button>;
}
`;
    fs.writeFileSync(jsxAbs, jsxBefore, "utf8");
    fs.writeFileSync(cssAbs, `.known { color: red; }\n`, "utf8");

    const col = openColumn(jsxBefore, 2, "button");
    const undo = createUndoStore(root);
    const overlay = createProjectOverlay({ root, undo });

    assert.throws(
      () =>
        overlay.apply({
          source: `${jsxRel}:2:${col}`,
          style: { paddingTop: "120px" },
          css: [
            {
              file: cssRel,
              selector: ".missing",
              property: "color",
              value: "blue",
            },
          ],
        }),
      (err) => err.status === 422,
    );

    assert.equal(fs.readFileSync(jsxAbs, "utf8"), jsxBefore);
    assert.equal(undo.depth, 0);
  });
});

test("undo after outside write returns 409 then later undo restores", () => {
  withTmpProject((root) => {
    const rel = "src/Hero.jsx";
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    const before = `export function Hero() {
  return <button>Go</button>;
}
`;
    fs.writeFileSync(abs, before, "utf8");
    const col = openColumn(before, 2, "button");
    const undo = createUndoStore(root);
    const overlay = createProjectOverlay({ root, undo });

    overlay.apply({
      source: `${rel}:2:${col}`,
      style: { paddingTop: "120px" },
    });
    const afterApply = fs.readFileSync(abs, "utf8");

    fs.writeFileSync(abs, `${afterApply}// tampered\n`, "utf8");

    assert.throws(() => overlay.undoApply(), (err) => err.status === 409);
    assert.equal(undo.depth, 1);

    fs.writeFileSync(abs, afterApply, "utf8");
    overlay.undoApply();
    assert.equal(fs.readFileSync(abs, "utf8"), before);
  });
});

test("rejects path outside project for css file", () => {
  withTmpProject((root) => {
    const undo = createUndoStore(root);
    const overlay = createProjectOverlay({ root, undo });
    assert.throws(
      () =>
        overlay.apply({
          css: [
            {
              file: "../secret.css",
              selector: ".x",
              property: "color",
              value: "red",
            },
          ],
        }),
      (err) => err.status === 403 && err.message === "path outside project",
    );
  });
});

test("brief write then read", () => {
  withTmpProject((root) => {
    const undo = createUndoStore(root);
    const overlay = createProjectOverlay({ root, undo, briefName: "editlayer.brief.md" });
    assert.equal(overlay.readBrief(), "");
    overlay.writeBrief("hello brief");
    assert.equal(overlay.readBrief(), "hello brief");
  });
});
