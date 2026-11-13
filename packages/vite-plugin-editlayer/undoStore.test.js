import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createUndoStore } from "./undoStore.js";

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "editlayer-undo-"));
}

const entry = {
  file: "src/App.jsx",
  before: "<div>old</div>",
  after: "<div>new</div>",
};

test("push survives restart via reload", () => {
  const root = tempRoot();
  const store = createUndoStore(root);
  store.push(entry);
  assert.equal(store.depth, 1);

  const reloaded = createUndoStore(root);
  assert.equal(reloaded.depth, 1);
  assert.deepEqual(reloaded.peek(), entry);
});

test("pop persists empty stack after restart", () => {
  const root = tempRoot();
  const store = createUndoStore(root);
  store.push(entry);

  const popped = store.pop();
  assert.deepEqual(popped, entry);
  assert.equal(store.depth, 0);

  const reloaded = createUndoStore(root);
  assert.equal(reloaded.depth, 0);
  assert.equal(reloaded.peek(), null);
});

test("limit drops oldest entry", () => {
  const root = tempRoot();
  const store = createUndoStore(root, { limit: 2 });

  store.push({ file: "a.txt", before: "1", after: "2" });
  store.push({ file: "b.txt", before: "3", after: "4" });
  store.push({ file: "c.txt", before: "5", after: "6" });

  assert.equal(store.depth, 2);
  assert.deepEqual(store.peek(), {
    file: "c.txt",
    before: "5",
    after: "6",
  });

  const reloaded = createUndoStore(root, { limit: 2 });
  assert.equal(reloaded.depth, 2);
  assert.deepEqual(reloaded.pop(), {
    file: "c.txt",
    before: "5",
    after: "6",
  });
  assert.deepEqual(reloaded.pop(), {
    file: "b.txt",
    before: "3",
    after: "4",
  });
  assert.equal(reloaded.pop(), null);
});

test("invalid file paths throw 400 and do not write", () => {
  const root = tempRoot();
  const store = createUndoStore(root);
  const jsonPath = store.filePath;

  const invalid = [
    "/absolute/path.txt",
    "src\\bad\\path.txt",
    "",
    "src/../escape.txt",
    "../top.txt",
  ];

  for (const file of invalid) {
    assert.throws(
      () => store.push({ file, before: "a", after: "b" }),
      (err) => {
        assert.equal(err.status, 400);
        return true;
      },
    );
    assert.equal(store.depth, 0);
    assert.equal(fs.existsSync(jsonPath), false);
  }

  store.push(entry);
  assert.equal(store.depth, 1);
  assert.equal(fs.existsSync(jsonPath), true);
});

test("corrupt json is ignored then push overwrites", () => {
  const root = tempRoot();
  const dir = path.join(root, ".editlayer");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "undo.json"), "not-json{{{", "utf8");

  const store = createUndoStore(root);
  assert.equal(store.depth, 0);

  store.push(entry);
  assert.equal(store.depth, 1);

  const raw = fs.readFileSync(store.filePath, "utf8");
  const parsed = JSON.parse(raw);
  assert.deepEqual(parsed, [entry]);
});
