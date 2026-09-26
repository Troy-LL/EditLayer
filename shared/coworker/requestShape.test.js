import test from "node:test";
import assert from "node:assert/strict";
import { FEEL_WORDS, validateRequestInput } from "./requestShape.js";

const validTarget = {
  url: "http://localhost:5180/",
  selector: "h3",
  source: { file: "src/App.jsx", line: 12, column: 5 },
  component: "ProductCard",
  tag: "h3",
};

test("accepts minimal text-only request", () => {
  const r = validateRequestInput({ text: "Hello" });
  assert.equal(r.ok, true);
  assert.deepEqual(r.value, { text: "Hello", elementId: null, target: null, intent: null, author: "human" });
});

test("accepts elementId without target", () => {
  const r = validateRequestInput({ text: "Fix hero", elementId: "hero-title" });
  assert.equal(r.ok, true);
  assert.equal(r.value.elementId, "hero-title");
  assert.equal(r.value.target, null);
});

test("accepts full target and intent", () => {
  const r = validateRequestInput({
    text: "Make premium",
    target: validTarget,
    intent: {
      changes: { fontSize: { from: "18px", to: "20px" }, letterSpacing: { from: "normal", to: "-0.01em" } },
      feel: ["bolder", "premium"],
    },
  });
  assert.equal(r.ok, true);
  assert.equal(r.value.target.url, "http://localhost:5180/");
  assert.equal(r.value.target.source.file, "src/App.jsx");
  assert.deepEqual(r.value.intent.feel, ["bolder", "premium"]);
});

test("rejects missing text", () => {
  assert.equal(validateRequestInput({ text: "  " }).ok, false);
  assert.match(validateRequestInput({}).error, /text is required/);
});

test("rejects elementId and target together", () => {
  const r = validateRequestInput({ text: "x", elementId: "a", target: { url: "http://x/" } });
  assert.equal(r.ok, false);
  assert.match(r.error, /mutually exclusive/);
});

test("rejects target without url", () => {
  const r = validateRequestInput({ text: "x", target: { selector: "h1" } });
  assert.equal(r.ok, false);
  assert.match(r.error, /target\.url/);
});

test("rejects bad source paths and coordinates", () => {
  assert.match(
    validateRequestInput({ text: "x", target: { url: "http://x/", source: { file: "../evil.jsx", line: 1, column: 1 } } }).error,
    /file/
  );
  assert.match(
    validateRequestInput({ text: "x", target: { url: "http://x/", source: { file: "a.jsx", line: 0, column: 1 } } }).error,
    /line/
  );
  assert.match(
    validateRequestInput({ text: "x", target: { url: "http://x/", source: { file: "a.jsx", line: 1, column: -1 } } }).error,
    /column/
  );
});

test("rejects too many intent.changes and bad keys", () => {
  const many = {};
  for (let i = 0; i < 31; i += 1) many[`prop${i}`] = { from: "a", to: "b" };
  assert.match(validateRequestInput({ text: "x", intent: { changes: many } }).error, /at most 30/);
  assert.match(
    validateRequestInput({ text: "x", intent: { changes: { "font-size": { from: "a", to: "b" } } } }).error,
    /camelCase/
  );
  assert.match(
    validateRequestInput({ text: "x", intent: { changes: { fontSize: { from: 1, to: "b" } } } }).error,
    /strings/
  );
});

test("rejects invalid feel words", () => {
  assert.match(
    validateRequestInput({ text: "x", intent: { feel: ["not-a-real-feel-word-that-is-way-too-long"] } }).error,
    /FEEL_WORD/
  );
  const manyFeel = Array.from(FEEL_WORDS).slice(0, 9);
  assert.match(validateRequestInput({ text: "x", intent: { feel: manyFeel } }).error, /at most 8/);
});

test("accepts scope, frame, and agent author", () => {
  const r = validateRequestInput({
    text: "Tighter on phone",
    target: validTarget,
    author: "agent",
    intent: { scope: "instances", frame: "phone", feel: ["tighter"] },
  });
  assert.equal(r.ok, true);
  assert.equal(r.value.author, "agent");
  assert.equal(r.value.intent.scope, "instances");
  assert.equal(r.value.intent.frame, "phone");
});

test("rejects unknown scope, frame, and author", () => {
  assert.match(validateRequestInput({ text: "x", intent: { scope: "page" } }).error, /intent\.scope/);
  assert.match(validateRequestInput({ text: "x", intent: { frame: "watch" } }).error, /intent\.frame/);
  assert.match(validateRequestInput({ text: "x", author: "bot" }).error, /author/);
});

test("drops unknown target keys and trims text", () => {
  const r = validateRequestInput({
    text: "  hello  ",
    target: { url: "http://x/", extra: true, styles: { color: "red", bad: 1 } },
  });
  assert.equal(r.ok, true);
  assert.equal(r.value.text, "hello");
  assert.equal(r.value.target.extra, undefined);
  assert.deepEqual(r.value.target.styles, { color: "red" });
});
