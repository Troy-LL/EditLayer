import { test } from "node:test";
import assert from "node:assert/strict";
import { stampSource } from "./stamp.js";

test("stamps host elements with source and component", () => {
  const code = `function ProductCard() {
  return <div><span>Hi</span></div>;
}`;
  const out = stampSource(code, { file: "src/Card.jsx" });
  assert.ok(out);
  assert.match(out, /data-editlayer-source="src\/Card\.jsx:\d+:\d+"/);
  assert.match(out, /data-editlayer-component="ProductCard"/);
  assert.match(out, /<span data-editlayer-source/);
});

test("skips components, fragments, member expressions, existing stamp", () => {
  const code = `export default function App() {
  return (
    <>
      <MyCard />
      <obj.icon />
      <p data-editlayer-source="keep:1:1">x</p>
      <footer />
    </>
  );
}`;
  const out = stampSource(code, { file: "src/App.jsx" });
  assert.ok(out);
  assert.doesNotMatch(out, /<MyCard data-editlayer/);
  assert.doesNotMatch(out, /<obj\.icon data-editlayer/);
  assert.match(out, /data-editlayer-source="keep:1:1"/);
  assert.match(out, /<footer data-editlayer-source/);
});

test("component name from const arrow and export default function", () => {
  const arrow = `const Hero = () => <section />;`;
  const outA = stampSource(arrow, { file: "a.jsx" });
  assert.match(outA, /data-editlayer-component="Hero"/);

  const def = `export default function Layout() { return <main />; }`;
  const outD = stampSource(def, { file: "b.jsx" });
  assert.match(outD, /data-editlayer-component="Layout"/);
});

test("nested map callback inside component uses outer component name", () => {
  const code = `function List() {
  return items.map((x) => <li key={x}>{x}</li>);
}`;
  const out = stampSource(code, { file: "src/List.jsx" });
  assert.match(out, /data-editlayer-component="List"/);
  assert.match(out, /<li data-editlayer-source/);
});

test("TSX with generics stamps after type parameters", () => {
  const code = `function Box<T>() { return <div<T> />; }`;
  const out = stampSource(code, { file: "src/Box.tsx" });
  assert.ok(out);
  assert.match(out, /<div<T> data-editlayer-source/);
});

test("returns null when unchanged or parse fails", () => {
  assert.equal(stampSource(`const x = 1;`, { file: "x.js" }), null);
  const stamped = `<div data-editlayer-source="x.jsx:1:1" />`;
  assert.equal(stampSource(stamped, { file: "x.jsx" }), null);
});
