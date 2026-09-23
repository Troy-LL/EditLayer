import { test } from "node:test";
import assert from "node:assert/strict";
import { applyClassList } from "./className.js";

const FILE = "src/App.jsx";

function openColumn(code, line, tag) {
  const row = code.split("\n")[line - 1];
  const idx = row.indexOf(`<${tag}`);
  return idx + 1;
}

test("add tokens to existing className", () => {
  const code = `export function App() {
  return <div className="a b">Hi</div>;
}`;
  const col = openColumn(code, 2, "div");
  const { code: out, summary } = applyClassList(
    code,
    { line: 2, column: col },
    { add: ["quiet"], remove: ["b"] },
    { file: FILE },
  );
  assert.equal(out, `export function App() {
  return <div className="a quiet">Hi</div>;
}`);
  assert.equal(summary, "className +quiet -b");
});

test("remove one token", () => {
  const code = `<span className="one two three">x</span>`;
  const col = openColumn(code, 1, "span");
  const { code: out, summary } = applyClassList(
    code,
    { line: 1, column: col },
    { remove: ["two"] },
    { file: FILE },
  );
  assert.equal(out, `<span className="one three">x</span>`);
  assert.equal(summary, "className -two");
});

test("insert className when missing", () => {
  const code = `function X() {
  return <button>Go</button>;
}`;
  const col = openColumn(code, 2, "button");
  const { code: out, summary } = applyClassList(
    code,
    { line: 2, column: col },
    { add: ["primary"] },
    { file: FILE },
  );
  assert.equal(out, `function X() {
  return <button className="primary">Go</button>;
}`);
  assert.equal(summary, "className +primary");
});

test("dynamic className throws 422", () => {
  const code = `<div className={expr}>T</div>`;
  const col = openColumn(code, 1, "div");
  assert.throws(
    () =>
      applyClassList(code, { line: 1, column: col }, { add: ["x"] }, { file: FILE }),
    (err) => err.status === 422 && err.message === "className is dynamic here; ask the agent",
  );
});

test("unknown element throws 409", () => {
  const code = `<p>ok</p>`;
  assert.throws(
    () => applyClassList(code, { line: 1, column: 99 }, { add: ["x"] }, { file: FILE }),
    (err) => err.status === 409 && err.message === "element moved; reload",
  );
});

test("other attributes and text stay byte-identical", () => {
  const code = `export function App() {
  return (
    <div id="root" data-x="1" className="keep">
      Hello
    </div>
  );
}`;
  const col = openColumn(code, 3, "div");
  const { code: out } = applyClassList(
    code,
    { line: 3, column: col },
    { add: ["extra"] },
    { file: FILE },
  );
  assert.match(out, /id="root"/);
  assert.match(out, /data-x="1"/);
  assert.equal(out, `export function App() {
  return (
    <div id="root" data-x="1" className="keep extra">
      Hello
    </div>
  );
}`);
});

test("remove all classes drops the attribute", () => {
  const code = `<i className="only">x</i>`;
  const col = openColumn(code, 1, "i");
  const { code: out, summary } = applyClassList(
    code,
    { line: 1, column: col },
    { remove: ["only"] },
    { file: FILE },
  );
  assert.equal(out, `<i>x</i>`);
  assert.equal(summary, "className -only");
});

test("uses class attribute for .js file", () => {
  const code = `export function App() {
  return <div>Go</div>;
}`;
  const col = openColumn(code, 2, "div");
  const { code: out } = applyClassList(
    code,
    { line: 2, column: col },
    { add: ["box"] },
    { file: "src/App.js" },
  );
  assert.equal(out, `export function App() {
  return <div class="box">Go</div>;
}`);
});
