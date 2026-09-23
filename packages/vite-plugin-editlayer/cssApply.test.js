import { test } from "node:test";
import assert from "node:assert/strict";
import { applyCssDeclaration, applyToken } from "./cssApply.js";

test("replace existing declaration value", () => {
  const code = `.hero__title {
  font-weight: 400;
  color: black;
}
.other { margin: 0; }
`;
  const { code: out, summary } = applyCssDeclaration(code, {
    selector: ".hero__title",
    property: "font-weight",
    value: "700",
  });
  assert.equal(
    out,
    `.hero__title {
  font-weight: 700;
  color: black;
}
.other { margin: 0; }
`,
  );
  assert.equal(summary, ".hero__title: font-weight 700");
});

test("insert missing property before closing brace", () => {
  const code = `.btn {
  color: white;
}
`;
  const { code: out, summary } = applyCssDeclaration(code, {
    selector: ".btn",
    property: "padding-top",
    value: "8px",
  });
  assert.equal(
    out,
    `.btn {
  color: white;
  padding-top: 8px;
}
`,
  );
  assert.equal(summary, ".btn: padding-top 8px");
});

test("selector inside @media", () => {
  const code = `@media (min-width: 768px) {
  .panel {
    width: 100%;
  }
}
`;
  const { code: out } = applyCssDeclaration(code, {
    selector: ".panel",
    property: "width",
    value: "50%",
  });
  assert.equal(
    out,
    `@media (min-width: 768px) {
  .panel {
    width: 50%;
  }
}
`,
  );
});

test("selector list matches one part", () => {
  const code = `.a, .b.primary {
  opacity: 1;
}
`;
  const { code: out } = applyCssDeclaration(code, {
    selector: ".b.primary",
    property: "opacity",
    value: "0.5",
  });
  assert.equal(
    out,
    `.a, .b.primary {
  opacity: 0.5;
}
`,
  );
});

test("unknown selector throws 422", () => {
  const code = `.known { color: red; }`;
  assert.throws(
    () =>
      applyCssDeclaration(code, {
        selector: ".missing",
        property: "color",
        value: "blue",
      }),
    (err) => err.status === 422 && err.message === "selector not found: .missing",
  );
});

test("applyToken replaces in :root", () => {
  const code = `:root {
  --space-3: 12px;
  --space-4: 16px;
}
.card { padding: var(--space-3); }
`;
  const { code: out, summary } = applyToken(code, {
    name: "--space-3",
    value: "24px",
  });
  assert.equal(
    out,
    `:root {
  --space-3: 24px;
  --space-4: 16px;
}
.card { padding: var(--space-3); }
`,
  );
  assert.equal(summary, "--space-3 24px");
});

test("applyToken replaces every occurrence of the name", () => {
  const code = `:root { --accent: red; }
.theme { --accent: blue; }
`;
  const { code: out } = applyToken(code, { name: "--accent", value: "green" });
  assert.equal(
    out,
    `:root { --accent: green; }
.theme { --accent: green; }
`,
  );
});

test("missing token throws 422", () => {
  assert.throws(
    () => applyToken(".x { color: red; }", { name: "--nope", value: "1px" }),
    (err) => err.status === 422 && err.message === "token not found: --nope",
  );
});

test("unrelated rule stays byte-identical when editing another", () => {
  const code = `.first {
  /* keep comment */
  margin: 0;
}

.second {
  line-height: 1.2;
}
`;
  const { code: out } = applyCssDeclaration(code, {
    selector: ".first",
    property: "margin",
    value: "4px",
  });
  const firstBlock = out.slice(0, out.indexOf(".second"));
  assert.equal(
    firstBlock,
    `.first {
  /* keep comment */
  margin: 4px;
}

`,
  );
  assert.equal(out.slice(out.indexOf(".second")), code.slice(code.indexOf(".second")));
});

test("preserves !important when replacing value", () => {
  const code = `.loud {
  color: red !important;
}
`;
  const { code: out } = applyCssDeclaration(code, {
    selector: ".loud",
    property: "color",
    value: "blue",
  });
  assert.equal(
    out,
    `.loud {
  color: blue !important;
}
`,
  );
});

test("edits a rule nested in @layer", () => {
  const code = `@layer components {
  .card { color: red; }
}
`;
  const { code: out } = applyCssDeclaration(code, {
    selector: ".card",
    property: "color",
    value: "blue",
  });
  assert.equal(out, `@layer components {
  .card { color: blue; }
}
`);
});

test("invalid property rejects 400", () => {
  assert.throws(
    () =>
      applyCssDeclaration(".x{}", {
        selector: ".x",
        property: "--bad",
        value: "1",
      }),
    (err) => err.status === 400,
  );
});

test("invalid value rejects 400", () => {
  assert.throws(
    () =>
      applyCssDeclaration(".x { a: b; }", {
        selector: ".x",
        property: "color",
        value: "red;",
      }),
    (err) => err.status === 400,
  );
});
