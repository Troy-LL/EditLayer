import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { configToHtml } from "../../server/configToHtml.js";
import { demoPageConfig } from "../../seeds/demo.js";
import { mcpMarketplaceConfig } from "../../seeds/mcpMarketplace.js";
import { getOverlay, groupMoveableRoot } from "./index.js";
import { resolvePlacement, applyPlacementToStyle, isAlreadyOutOfFlow, pinFrameStyle } from "./placement.js";
import { overlayFromSearch, parseOverlayMode, writeOverlaySearch } from "./modes.js";
import { pageChromeStyle } from "./pageChrome.js";

function styleFor(el) {
  const style = {};
  applyPlacementToStyle(style, el);
  return style;
}

describe("overlay mode parsing", () => {
  it("reads ?overlay=A|B|C and defaults to A", () => {
    assert.equal(overlayFromSearch("?overlay=B"), "B");
    assert.equal(overlayFromSearch("overlay=c"), "C");
    assert.equal(parseOverlayMode("z"), "A");
    assert.equal(parseOverlayMode(undefined), "A");
    assert.equal(overlayFromSearch(""), "A");
    assert.match(writeOverlaySearch("C", new URL("http://x.test/#/demo")), /\?overlay=C/);
  });
});

describe("Satan constraint — A is a bugfix, not real-HTML-done", () => {
  it("A write-back cannot represent a flex/grid nest (explicit FAIL case)", () => {
    const html = configToHtml({
      elements: [
        {
          id: "row",
          type: "container",
          display: "flex",
          children: [
            {
              id: "left",
              type: "heading",
              text: "Left",
              offsetX: 12,
              offsetY: 0,
              positioning: "flow",
            },
            { id: "right", type: "heading", text: "Right", offsetX: 0, offsetY: 0 },
          ],
        },
      ],
    });
    assert.doesNotMatch(html, /display:\s*(flex|grid)/);
    assert.match(html, /translate\(12px, 0px\)/);
    assert.equal(getOverlay("A").canClaimHandles({ type: "heading", offsetX: 0, offsetY: 0 }), true);
  });

  it("C is not the default and is not A relabeled", () => {
    assert.equal(getOverlay("A").id, "A");
    assert.equal(getOverlay("C").id, "C");
    assert.equal(getOverlay("A").canClaimHandles({ type: "heading", offsetX: 0, offsetY: 0 }), true);
    assert.equal(getOverlay("C").canClaimHandles({ type: "heading", offsetX: 0, offsetY: 0 }), false);
  });
});

describe("placement resolver (shared persist read)", () => {
  it("keeps legacy offset≠0 as absolute so marketplace cards stay put", () => {
    assert.equal(resolvePlacement({ offsetX: 330, offsetY: 268 }), "absolute");
    const style = styleFor({ offsetX: 330, offsetY: 268 });
    assert.equal(style.position, "absolute");
    assert.equal(style.transform, "translate(330px, 268px)");
  });

  it("flow + offset does not promote to absolute", () => {
    const style = styleFor({ offsetX: 40, offsetY: 10, positioning: "flow" });
    assert.equal(style.position, "relative");
    assert.equal(style.transform, "translate(40px, 10px)");
    assert.notEqual(style.left, 0);
  });

  it("pinned inner is absolute inside a reserved slot", () => {
    const style = styleFor({
      offsetX: 12,
      offsetY: 8,
      positioning: "pinned",
      pin: { width: 200, height: 40, marginBottom: 20 },
    });
    assert.equal(style.position, "absolute");
    assert.equal(style.left, 0);
    assert.equal(style.top, 0);
  });
});

describe("prototype A — transform-only", () => {
  const A = getOverlay("A");

  it("commits in-flow drag as positioning:flow (no absolute flip)", () => {
    const el = { type: "heading", offsetX: 0, offsetY: 0 };
    const patch = A.patchOffset(el, { offsetX: 1, offsetY: 0 });
    assert.equal(patch.positioning, "flow");
    assert.equal(resolvePlacement({ ...el, ...patch }), "flow");
    const style = styleFor({ ...el, ...patch });
    assert.equal(style.position, "relative");
    assert.equal(style.transform, "translate(1px, 0px)");
  });

  it("does not rewrite marketplace cards to flow", () => {
    const card = { type: "container", offsetX: 330, offsetY: 268 };
    const patch = A.patchOffset(card, { offsetX: 340, offsetY: 268 });
    assert.equal(patch.positioning, undefined);
    assert.equal(resolvePlacement({ ...card, ...patch }), "absolute");
  });

  it("claims handles on flow text", () => {
    assert.equal(A.canClaimHandles({ type: "heading", offsetX: 0, offsetY: 0 }), true);
  });

  it("does not pin on select", () => {
    assert.equal(A.measureSelectPin({ type: "heading" }, {}), null);
  });
});

describe("prototype B — select-time pin", () => {
  const B = getOverlay("B");

  it("measures a spacer on select for in-flow nodes", () => {
    const node = {
      getBoundingClientRect: () => ({ width: 180.4, height: 41.2 }),
    };
    const pin = B.measureSelectPin({ type: "heading", marginBottom: 20, offsetX: 0, offsetY: 0 }, node);
    assert.deepEqual(pin, { width: 180, height: 41, marginBottom: 20 });
  });

  it("does not re-pin already out-of-flow nodes", () => {
    const node = { getBoundingClientRect: () => ({ width: 300, height: 220 }) };
    assert.equal(
      B.measureSelectPin({ type: "container", offsetX: 330, offsetY: 268 }, node),
      null
    );
  });

  it("commit writes pin + pinned so siblings keep a box", () => {
    const el = { type: "heading", offsetX: 0, offsetY: 0 };
    const livePin = { width: 200, height: 48, marginBottom: 20 };
    const withPin = { ...el, ...B.commitSelectPin(el, livePin) };
    const committed = { ...withPin, ...B.patchOffset(withPin, { offsetX: 16, offsetY: 4 }) };
    assert.equal(committed.positioning, "pinned");
    assert.deepEqual(committed.pin, livePin);
    assert.equal(resolvePlacement(committed), "pinned");
  });

  it("nudge without a pin stays flow (no pinned-without-spacer)", () => {
    const el = { type: "heading", offsetX: 0, offsetY: 0 };
    const patch = B.patchOffset(el, { offsetX: 8, offsetY: 0 });
    assert.equal(patch.positioning, "flow");
    assert.equal(resolvePlacement({ ...el, ...patch }), "flow");
  });
});

describe("prototype C — positioned-trees-only", () => {
  const C = getOverlay("C");

  it("refuses handles and offset patches on flow heading/paragraph", () => {
    const heading = { type: "heading", offsetX: 0, offsetY: 0 };
    assert.equal(C.canClaimHandles(heading), false);
    assert.equal(C.canEditOffset(heading), false);
    assert.equal(C.patchOffset(heading, { offsetX: 10, offsetY: 0 }), null);
  });

  it("claims handles on legacy absolute marketplace cards", () => {
    const card = { type: "container", offsetX: 0, offsetY: 268 };
    assert.equal(isAlreadyOutOfFlow(card), true);
    assert.equal(C.canClaimHandles(card), true);
    const patch = C.patchOffset(card, { offsetX: 10, offsetY: 268 });
    assert.deepEqual(patch, { offsetX: 10, offsetY: 268 });
  });

  it("flow-locked nodes are style-only — no handle claim (dead Moveable is a chrome fail)", () => {
    assert.equal(C.canClaimHandles({ type: "heading", offsetX: 0, offsetY: 0 }), false);
    assert.equal(C.canClaimHandles({ type: "paragraph", offsetX: 0, offsetY: 0 }), false);
    assert.equal(C.canEditOffset({ type: "heading", offsetX: 0, offsetY: 0 }), false);
  });
});

describe("Bode chrome contracts", () => {
  it("B pin frame has no paint (spacer must be invisible)", () => {
    const style = pinFrameStyle({ width: 200, height: 40, marginBottom: 20 });
    assert.equal(style.background, "transparent");
    assert.equal(style.border, "none");
    assert.equal(style.outline, "none");
    assert.equal(style.boxShadow, "none");
  });
});

describe("page chrome (editor + write-back share one style)", () => {
  it("demo and marketplace chrome differ; both include pad + max-width", () => {
    const demo = pageChromeStyle("demo");
    const market = pageChromeStyle("marketplace");
    assert.equal(demo.padding, "48px 24px");
    assert.equal(demo.maxWidth, "1280px");
    assert.equal(market.maxWidth, "1040px");
    assert.match(market.backgroundImage, /linear-gradient/);
    assert.notEqual(demo.maxWidth, market.maxWidth);
  });

  it("phone and tablet override max-width for both presets", () => {
    assert.equal(pageChromeStyle("demo", "#fff", "phone").maxWidth, "390px");
    assert.equal(pageChromeStyle("marketplace", "#fff", "tablet").maxWidth, "768px");
    assert.equal(pageChromeStyle("demo", "#fff", "phone").padding, "32px 16px");
  });

  it("configToHtml emits the shared chrome", () => {
    const demoHtml = configToHtml(demoPageConfig, { preset: "demo" });
    const marketHtml = configToHtml(mcpMarketplaceConfig, { preset: "marketplace" });
    assert.match(demoHtml, /padding:48px 24px/);
    assert.match(demoHtml, /max-width:1280px/);
    assert.match(marketHtml, /max-width:1040px/);
    assert.match(marketHtml, /linear-gradient/);
    const phoneHtml = configToHtml({ ...demoPageConfig, viewport: "phone" }, { preset: "demo" });
    assert.match(phoneHtml, /max-width:390px/);
  });
});

describe("JSON → HTML goldens (demo + marketplace)", () => {
  it("demo seed write-back stays in-flow (no leftover absolute)", () => {
    const html = configToHtml(demoPageConfig);
    assert.match(html, /Welcome to the demo page/);
    assert.doesNotMatch(html, /position:absolute/);
    assert.doesNotMatch(html, /data-overlay-pin/);
  });

  it("marketplace cards stack in flow (Desk/Tab/Phone consistent)", () => {
    const html = configToHtml(mcpMarketplaceConfig);
    assert.match(html, /GitHub MCP/);
    assert.match(html, /Slack MCP/);
    assert.match(html, /Linear MCP/);
    assert.doesNotMatch(html, /position:absolute/);
    assert.doesNotMatch(html, /translate\(354px/);
    assert.doesNotMatch(html, /translate\(684px/);
  });

  it("groupMoveableRoot: shared parent, else .page", () => {
    const page = {
      classList: { contains: (c) => c === "page" },
    };
    const parent = { parentElement: page };
    const closestPage = (sel) => (sel === ".page" ? page : null);
    const a = { parentElement: parent, closest: closestPage };
    const b = { parentElement: parent, closest: closestPage };
    const c = { parentElement: page, closest: closestPage };
    const rootOf = (node) => node.parentElement;
    assert.equal(groupMoveableRoot([a, b], rootOf), parent);
    assert.equal(groupMoveableRoot([a, c], rootOf), page);
  });

  it("A first-pixel on demo heading: write-back keeps h1 in flow", () => {
    const page = structuredClone(demoPageConfig);
    const heading = page.elements.find((el) => el.id === "heading-1");
    Object.assign(heading, getOverlay("A").patchOffset(heading, { offsetX: 12, offsetY: 8 }));
    const html = configToHtml(page);
    const h1 = html.match(/<h1\b[^>]*>[\s\S]*?Welcome[\s\S]*?<\/h1>/)[0];
    assert.doesNotMatch(h1, /position:\s*absolute/);
    assert.match(h1, /position:\s*relative/);
    assert.match(h1, /translate\(12px,\s*8px\)/);
    assert.doesNotMatch(html, /position:absolute/);
  });

  it("marketplace card nudge stays in flow", () => {
    const page = structuredClone(mcpMarketplaceConfig);
    const card = page.elements.find((el) => el.id === "mp-card-slack");
    Object.assign(card, getOverlay("A").patchOffset(card, { offsetX: 12, offsetY: 8 }));
    const html = configToHtml(page);
    assert.match(html, /translate\(12px, 8px\)/);
    assert.doesNotMatch(html, /position:absolute/);
    assert.equal(card.positioning, "flow");
  });

  it("A-committed flow heading emits transform without absolute", () => {
    const html = configToHtml({
      elements: [
        {
          id: "heading-1",
          type: "heading",
          text: "Shifted",
          offsetX: 24,
          offsetY: 8,
          positioning: "flow",
        },
      ],
    });
    assert.match(html, /transform:translate\(24px, 8px\)/);
    assert.doesNotMatch(html, /position:absolute/);
    assert.match(html, /position:relative/);
  });

  it("B-committed pin emits spacer + absolute inner", () => {
    const html = configToHtml({
      elements: [
        {
          id: "heading-1",
          type: "heading",
          text: "Pinned",
          offsetX: 16,
          offsetY: 4,
          positioning: "pinned",
          pin: { width: 200, height: 40, marginBottom: 20 },
        },
      ],
    });
    assert.match(html, /data-overlay-pin/);
    assert.match(html, /width:200px/);
    assert.match(html, /height:40px/);
    assert.match(html, /position:absolute/);
    assert.match(html, /transform:translate\(16px, 4px\)/);
  });

  it("three prototypes write three different HTML shapes for the same drag", () => {
    const start = { id: "h", type: "heading", text: "Hi", offsetX: 0, offsetY: 0, marginBottom: 20 };
    const A = { ...start, ...getOverlay("A").patchOffset(start, { offsetX: 10, offsetY: 0 }) };
    const withPin = {
      ...start,
      ...getOverlay("B").commitSelectPin(start, { width: 120, height: 30, marginBottom: 20 }),
    };
    const B = { ...withPin, ...getOverlay("B").patchOffset(withPin, { offsetX: 10, offsetY: 0 }) };
    const Cpatch = getOverlay("C").patchOffset(start, { offsetX: 10, offsetY: 0 });
    const C = Cpatch ? { ...start, ...Cpatch } : start;

    const htmlA = configToHtml({ elements: [A] });
    const htmlB = configToHtml({ elements: [B] });
    const htmlC = configToHtml({ elements: [C] });

    assert.notEqual(htmlA, htmlB);
    assert.notEqual(htmlA, htmlC);
    assert.notEqual(htmlB, htmlC);
    assert.match(htmlA, /transform:translate\(10px, 0px\)/);
    assert.doesNotMatch(htmlA, /position:absolute/);
    assert.match(htmlB, /data-overlay-pin/);
    assert.doesNotMatch(htmlC, /translate\(10px/);
  });
});
