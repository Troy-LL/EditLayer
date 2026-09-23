import { test } from "node:test";
import assert from "node:assert/strict";
import { applyEdit, resolveSource } from "./apply.js";

const FILE = "src/App.jsx";

function openColumn(code, line, tag) {
  const row = code.split("\n")[line - 1];
  const idx = row.indexOf(`<${tag}`);
  return idx + 1;
}

function onlyDiff(before, after) {
  if (before === after) return "";
  let start = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) {
    start++;
  }
  let endB = before.length;
  let endA = after.length;
  while (endB > start && endA > start && before[endB - 1] === after[endA - 1]) {
    endB--;
    endA--;
  }
  return { start, removed: before.slice(start, endB), added: after.slice(start, endA) };
}

test("add style when none", () => {
  const code = `export function App() {
  return <button>Go</button>;
}`;
  const col = openColumn(code, 2, "button");
  const { code: out, summary } = applyEdit(
    code,
    { line: 2, column: col },
    { style: { paddingTop: "20px" } },
    { file: FILE },
  );
  assert.match(out, /style=\{\{ paddingTop: "20px" \}\}/);
  assert.match(summary, /paddingTop/);
  assert.equal(out.split("\n").length, code.split("\n").length);
});

test("merge into literal style replace and append", () => {
  const code = `function X() {
  return (
    <div style={{ color: "red", margin: "4px" /* keep */ }}>
      Hi
    </div>
  );
}`;
  const col = openColumn(code, 3, "div");
  const { code: out } = applyEdit(
    code,
    { line: 3, column: col },
    { style: { color: "#111", paddingTop: "8px" } },
    { file: FILE },
  );
  assert.match(out, /color: "#111"/);
  assert.match(out, /margin: "4px"/);
  assert.match(out, /keep/);
  assert.match(out, /paddingTop: "8px"/);
});

test("replace + append in one literal produces exact, parseable output", () => {
  const code = `const A = () => <p style={{ paddingTop: "8px" }}>x</p>;`;
  const { code: out } = applyEdit(
    code,
    { line: 1, column: code.indexOf("<p") + 1 },
    { style: { paddingTop: "120px", marginTop: "4px" } },
    { file: FILE },
  );
  assert.equal(out, `const A = () => <p style={{ paddingTop: "120px", marginTop: "4px" }}>x</p>;`);
});

test("spread for non-literal style expression", () => {
  const code = `const s = { color: "blue" };
export function App() {
  return <p style={s}>T</p>;
}`;
  const col = openColumn(code, 3, "p");
  const { code: out } = applyEdit(
    code,
    { line: 3, column: col },
    { style: { fontSize: "14px" } },
    { file: FILE },
  );
  assert.match(out, /style=\{\{ \.\.\.s, fontSize: "14px" \}\}/);
});

test("text replace preserves whitespace", () => {
  const code = `function App() {
  return <p>  Old label  </p>;
}`;
  const col = openColumn(code, 2, "p");
  const { code: out } = applyEdit(
    code,
    { line: 2, column: col },
    { text: "New label" },
    { file: FILE },
  );
  assert.match(out, />  New label  </);
});

test("422 on dynamic text and mixed children", () => {
  const dyn = `function App() { return <p>{name}</p>; }`;
  assert.throws(
    () =>
      applyEdit(
        dyn,
        { line: 1, column: openColumn(dyn, 1, "p") },
        { text: "x" },
        { file: FILE },
      ),
    (e) => e.status === 422,
  );
  const mixed = `function App() { return <p>Hi <b>x</b></p>; }`;
  assert.throws(
    () =>
      applyEdit(
        mixed,
        { line: 1, column: openColumn(mixed, 1, "p") },
        { text: "x" },
        { file: FILE },
      ),
    (e) => e.status === 422,
  );
});

test("409 when no element at position", () => {
  const code = `<div />`;
  assert.throws(
    () => applyEdit(code, { line: 1, column: 99 }, { style: { color: "red" } }, { file: FILE }),
    (e) => e.status === 409,
  );
});

test("escaping special chars in text uses expression", () => {
  const code = `function App() { return <span>plain</span>; }`;
  const col = openColumn(code, 1, "span");
  const { code: out } = applyEdit(
    code,
    { line: 1, column: col },
    { text: "a{b}<c>" },
    { file: FILE },
  );
  assert.match(out, /\{"a\{b\}<c>"\}/);
});

test("invalid style key throws 400", () => {
  const code = `<div />`;
  assert.throws(
    () => applyEdit(code, { line: 1, column: 1 }, { style: { "padding-top": "1px" } }, { file: FILE }),
    (e) => e.status === 400,
  );
});

test("limited diff for style update", () => {
  const code = `// header
function App() {
  return <div style={{ color: "red" }}>A</div>;
}
// footer`;
  const col = openColumn(code, 3, "div");
  const { code: out } = applyEdit(
    code,
    { line: 3, column: col },
    { style: { color: "blue" } },
    { file: FILE },
  );
  assert.equal(out.slice(0, code.indexOf("color")), code.slice(0, code.indexOf("color")));
  assert.match(out, /color: "blue"/);
  assert.ok(out.includes("// footer"));
});

test("resolveSource sandboxing", () => {
  const root = "/proj";
  assert.throws(() => resolveSource(root, "/etc/passwd:1:1"), (e) => e.status === 403);
  assert.throws(() => resolveSource(root, "../secret.jsx:1:1"), (e) => e.status === 403);
  assert.throws(() => resolveSource(root, "node_modules/x.jsx:1:1"), (e) => e.status === 403);
  assert.throws(() => resolveSource(root, "a.md:1:1"), (e) => e.status === 400);
  const r = resolveSource(root, "src/App.jsx:12:5");
  assert.equal(r.file, "src/App.jsx");
  assert.equal(r.line, 12);
  assert.equal(r.column, 5);
});
