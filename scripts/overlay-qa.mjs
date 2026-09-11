/**
 * Live overlay compare: ?overlay=A|B|C × demo + marketplace.
 * Requires: server :3001, vite :5173.
 */
import { createRequire } from "node:module";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const pathToPlaywright = [
  "playwright-core",
  "playwright",
].find((name) => {
  try {
    require.resolve(name);
    return true;
  } catch {
    return false;
  }
});

if (!pathToPlaywright) {
  console.error("Install playwright-core first: npm i -D playwright-core");
  process.exit(1);
}

const { chromium } = await import(pathToPlaywright);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = "/opt/cursor/artifacts/overlay-qa";
const API = "http://localhost:3001";
const APP = "http://localhost:5173";

const results = [];

function record(row) {
  results.push(row);
  const mark = row.pass ? "PASS" : row.expectFail ? "FAIL (expected)" : "FAIL";
  console.log(`${row.mode} ${row.page}  ${row.check}: ${mark}  ${row.note ?? ""}`);
}

function flattenCount(elements) {
  let n = 0;
  (function walk(list) {
    for (const el of list ?? []) {
      n += 1;
      walk(el.children);
    }
  })(elements);
  return n;
}

function findInTree(elements, pred) {
  for (const el of elements ?? []) {
    if (pred(el)) return el;
    const nested = findInTree(el.children, pred);
    if (nested) return nested;
  }
  return null;
}

async function resetPreset(preset) {
  const res = await fetch(`${API}/page/preset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ preset }),
  });
  if (!res.ok) throw new Error(`preset ${preset} failed`);
}

async function getPage() {
  const res = await fetch(`${API}/page`);
  return res.json();
}

async function enterEdit(page) {
  const edit = page.getByRole("button", { name: "Edit" });
  if (await edit.count()) await edit.click();
  await page.waitForTimeout(200);
}

async function selectByText(page, text) {
  await page.locator(".editable").filter({ hasText: text }).first().click({ force: true });
  await page.waitForTimeout(150);
}

function siblingTop(page, selector) {
  return page.locator(selector).first().evaluate((el) => el.getBoundingClientRect().top);
}

async function elementRect(page, locator) {
  return locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  });
}

function rectDrift(a, b) {
  if (!a || !b) return null;
  return {
    left: Math.abs(a.left - b.left),
    top: Math.abs(a.top - b.top),
    width: Math.abs(a.width - b.width),
    height: Math.abs(a.height - b.height),
  };
}

function pinLooksInvisible(paint) {
  if (!paint?.present) return false;
  const bgOk = paint.bg === "rgba(0, 0, 0, 0)" || paint.bg === "transparent";
  const borderOk = paint.border === "0px";
  const outlineOk = paint.outline === "none" || paint.outline === "";
  const shadowOk = paint.shadow === "none";
  return bgOk && borderOk && outlineOk && shadowOk;
}

async function pinPaint(page) {
  return page.evaluate(() => {
    const pin = document.querySelector("[data-overlay-pin]");
    if (!pin) return { present: false };
    const s = getComputedStyle(pin);
    return {
      present: true,
      bg: s.backgroundColor,
      border: s.borderTopWidth,
      outline: s.outlineStyle,
      shadow: s.boxShadow,
    };
  });
}

async function dragSelectedMeasureSibling(page, dx, dy, siblingSelector) {
  const box = page.locator(".moveable-control-box");
  if (!(await box.count())) return { dragged: false };
  const handle = box.locator(".moveable-area, .moveable-line").first();
  const target = (await handle.count()) ? handle : box;
  const rect = await target.boundingBox();
  if (!rect) return { dragged: false };
  const x = rect.x + rect.width / 2;
  const y = rect.y + rect.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 8 });
  const mid = await siblingTop(page, siblingSelector);
  await page.mouse.up();
  await page.waitForTimeout(300);
  const after = await siblingTop(page, siblingSelector);
  return { dragged: true, mid, after };
}

function hugOk(delta, tol = 4) {
  return (
    !!delta &&
    delta.left < tol &&
    delta.top < tol &&
    delta.width < tol &&
    delta.height < tol
  );
}

async function measureHug(page) {
  return page.evaluate(() => {
    const el = document.querySelector(".editable.selected");
    const box = document.querySelector(".moveable-control-box");
    if (!el || !box) return null;
    const a = el.getBoundingClientRect();
    const lines = [...box.querySelectorAll(".moveable-line")].map((node) =>
      node.getBoundingClientRect()
    );
    let b;
    if (lines.length) {
      const left = Math.min(...lines.map((r) => r.left));
      const top = Math.min(...lines.map((r) => r.top));
      const right = Math.max(...lines.map((r) => r.right));
      const bottom = Math.max(...lines.map((r) => r.bottom));
      b = { left, top, width: right - left, height: bottom - top };
    } else {
      b = box.getBoundingClientRect();
    }
    return {
      left: Math.abs(a.left - b.left),
      top: Math.abs(a.top - b.top),
      width: Math.abs(a.width - b.width),
      height: Math.abs(a.height - b.height),
      el: { w: a.width, h: a.height },
      box: { w: b.width, h: b.height },
    };
  });
}

async function hugAfterNudgeReload(page, { mode, pageId, select }) {
  await select();
  const boxes = await page.locator(".moveable-control-box").count();
  if (mode === "C" && pageId === "demo") {
    record({
      mode,
      page: pageId,
      check: "hug-after-reload",
      pass: true,
      note: "N/A — C has no handles on flow heading",
    });
    return;
  }
  if (!boxes) {
    record({
      mode,
      page: pageId,
      check: "hug-after-reload",
      pass: false,
      note: "no handles before nudge",
    });
    return;
  }
  await page.evaluate(() => {
    const el = document.activeElement;
    if (el instanceof HTMLElement) el.blur();
  });
  // Shift+arrow is 10px (above the 5px element-snap threshold) so the
  // nudge is not eaten by snap-back-to-zero.
  await page.keyboard.press("Shift+ArrowRight");
  await page.keyboard.press("Shift+ArrowRight");
  await page.keyboard.press("Shift+ArrowDown");
  await page.waitForTimeout(900);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await enterEdit(page);
  await select();
  const delta = await measureHug(page);
  const saved = await getPage();
  const heading = saved.config?.elements?.find((el) => el.id === "heading-1");
  const card = saved.config?.elements?.find((el) => el.id === "mp-card-github");
  let persistNote = "";
  if (pageId === "demo" && heading && mode === "A") {
    persistNote = ` positioning=${heading.positioning} offset=${heading.offsetX},${heading.offsetY}`;
    if (heading.positioning !== "flow" || !heading.offsetX) {
      record({
        mode,
        page: pageId,
        check: "hug-after-reload",
        pass: false,
        note: `A heading persist failed pos=${heading.positioning} xy=${heading.offsetX},${heading.offsetY}${delta ? ` hug=${JSON.stringify(delta)}` : ""}`,
      });
      return;
    }
  }
  if (pageId === "marketplace" && card) {
    persistNote = ` cardPos=${card.positioning ?? "legacy"}`;
  }
  record({
    mode,
    page: pageId,
    check: "hug-after-reload",
    pass: hugOk(delta),
    note: `${delta ? JSON.stringify(delta) : "no-rects"}${persistNote}`,
  });
}

async function dragSelected(page, dx, dy) {
  const box = page.locator(".moveable-control-box");
  if (!(await box.count())) return false;
  const handle = box.locator(".moveable-area, .moveable-line").first();
  const target = (await handle.count()) ? handle : box;
  const rect = await target.boundingBox();
  if (!rect) return false;
  const x = rect.x + rect.width / 2;
  const y = rect.y + rect.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  return true;
}

async function resizeEast(page, dx) {
  const e = page.locator(".moveable-e").first();
  if (!(await e.count())) return false;
  const rect = await e.boundingBox();
  if (!rect) return false;
  const x = rect.x + rect.width / 2;
  const y = rect.y + rect.height / 2;
  // Ctrl bypasses element-width snap (marketplace cards share 300px).
  await page.keyboard.down("Control");
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y, { steps: 6 });
  await page.mouse.up();
  await page.keyboard.up("Control");
  await page.waitForTimeout(250);
  return true;
}

async function runMode(browser, mode, pageId) {
  await resetPreset(pageId);
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();
  const hash = pageId === "marketplace" ? "#/marketplace" : "#/demo";
  await page.goto(`${APP}/?overlay=${mode}${hash}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await enterEdit(page);

  const headingText = pageId === "marketplace" ? "MCP Marketplace" : "Welcome to the demo page";
  const siblingText =
    pageId === "marketplace"
      ? "Discover Model Context Protocol"
      : "Click Edit, select this text";

  const headingLoc = page.locator(".page .editable").filter({ hasText: headingText }).first();
  if (pageId === "demo") {
    const beforeSelect = await siblingTop(page, "p.editable");
    const headingBefore = await elementRect(page, headingLoc);
    await selectByText(page, headingText);
    const afterSelect = await siblingTop(page, "p.editable");
    const headingAfter = await elementRect(page, headingLoc);
    const selectDrift = Math.abs(afterSelect - beforeSelect);
    const pop = rectDrift(headingBefore, headingAfter);
    const popped = pop && (pop.left >= 2 || pop.top >= 2 || pop.width >= 4 || pop.height >= 4);

    if (mode === "B") {
      record({
        mode,
        page: pageId,
        check: "select-time-spacer-shift",
        pass: selectDrift < 2,
        note: `siblingDrift=${selectDrift.toFixed(2)} — B spacer must not move the paragraph`,
      });
      const paint = await pinPaint(page);
      record({
        mode,
        page: pageId,
        check: "chrome-b-pin-invisible",
        pass: pinLooksInvisible(paint),
        note: JSON.stringify(paint),
      });
      const hug = await measureHug(page);
      record({
        mode,
        page: pageId,
        check: "chrome-b-select-pop",
        pass: !popped && hugOk(hug),
        expectFail: true,
        note: `headingDrift=${JSON.stringify(pop)} hug=${hug ? JSON.stringify(hug) : "none"}`,
      });
    } else if (mode === "A") {
      record({
        mode,
        page: pageId,
        check: "select-time-spacer-shift",
        pass: selectDrift < 2,
        note: `A has no spacer; siblingDrift=${selectDrift.toFixed(2)}`,
      });
      record({
        mode,
        page: pageId,
        check: "chrome-b-pin-invisible",
        pass: true,
        note: "N/A — A has no pin",
      });
      record({
        mode,
        page: pageId,
        check: "chrome-b-select-pop",
        pass: true,
        note: "N/A — A has no select-time wrap",
      });
    } else {
      record({
        mode,
        page: pageId,
        check: "select-time-spacer-shift",
        pass: true,
        note: "N/A — C does not wrap on select",
      });
      record({
        mode,
        page: pageId,
        check: "chrome-b-pin-invisible",
        pass: true,
        note: "N/A — C has no pin",
      });
      record({
        mode,
        page: pageId,
        check: "chrome-b-select-pop",
        pass: true,
        note: "N/A — C has no select-time wrap",
      });
    }
  } else {
    await selectByText(page, headingText);
    record({
      mode,
      page: pageId,
      check: "select-time-spacer-shift",
      pass: true,
      note: "N/A — marketplace heading is not the B spacer repro",
    });
    record({
      mode,
      page: pageId,
      check: "chrome-b-pin-invisible",
      pass: true,
      note: "N/A — marketplace heading is not the B spacer repro",
    });
    record({
      mode,
      page: pageId,
      check: "chrome-b-select-pop",
      pass: true,
      note: "N/A — marketplace heading is not the B spacer repro",
    });
  }

  const handles = await page.locator(".moveable-control-box").count();
  const moveableControls = await page.locator(".moveable-control").count();
  const styleOnly = await page.locator(".editable.selected-style-only").count();
  if (mode === "C" && pageId === "demo") {
    record({
      mode,
      page: pageId,
      check: "chrome-c-style-only",
      pass: handles === 0 && moveableControls === 0 && styleOnly > 0,
      note: `boxes=${handles} controls=${moveableControls} styleOnly=${styleOnly}`,
    });
    record({
      mode,
      page: pageId,
      check: "handles-on-flow-heading",
      pass: handles === 0,
      note: `boxes=${handles} — 8-handle Moveable on locked flow is a chrome fail`,
    });
  } else {
    const expectHandles = mode !== "C";
    record({
      mode,
      page: pageId,
      check: "handles-on-flow-heading",
      pass: expectHandles ? handles > 0 : handles === 0,
      note: `boxes=${handles}`,
    });
    if (mode === "C") {
      record({
        mode,
        page: pageId,
        check: "chrome-c-style-only",
        pass: true,
        note: "N/A — marketplace title is already out of flow in C",
      });
    } else {
      record({
        mode,
        page: pageId,
        check: "chrome-c-style-only",
        pass: true,
        note: "N/A — A/B use Moveable on flow text",
      });
    }
  }

  if (pageId === "demo") {
    await hugAfterNudgeReload(page, {
      mode,
      pageId,
      select: () => selectByText(page, headingText),
    });
  } else {
    await hugAfterNudgeReload(page, {
      mode,
      pageId,
      select: async () => {
        const cardLabel = page
          .locator(".layers-row")
          .filter({ hasText: "container" })
          .first()
          .locator(".layers-label");
        await cardLabel.click();
        await page.waitForTimeout(200);
      },
    });
  }

  if (pageId === "demo" && (mode === "A" || mode === "B")) {
    const before = await siblingTop(page, "p.editable");
    const gesture = await dragSelectedMeasureSibling(page, 40, 0, "p.editable");
    const midDrift = gesture.dragged ? Math.abs(gesture.mid - before) : 99;
    const upDrift = gesture.dragged ? Math.abs(gesture.after - before) : 99;
    const shove = gesture.dragged ? Math.abs(gesture.after - gesture.mid) : 99;
    record({
      mode,
      page: pageId,
      check: "first-pixel-sibling-reflow",
      pass: gesture.dragged && midDrift < 2,
      note: `dragged=${gesture.dragged} midDrift=${midDrift.toFixed(1)}`,
    });
    if (gesture.dragged) {
      await page.waitForTimeout(700);
      const afterDrag = await getPage();
      const heading = findInTree(afterDrag.config?.elements, (el) => el.id === "heading-1");
      if (mode === "A") {
        record({
          mode,
          page: pageId,
          check: "first-drag-persist-model",
          pass: heading?.positioning === "flow" && heading.offsetX !== 0,
          note: `positioning=${heading?.positioning} xy=${heading?.offsetX},${heading?.offsetY}`,
        });
      } else if (mode === "B") {
        const pinned = heading?.positioning === "pinned" || heading?.positioning === "flow";
        record({
          mode,
          page: pageId,
          check: "first-drag-persist-model",
          pass: pinned && heading?.positioning !== "absolute",
          note: `positioning=${heading?.positioning} pin=${Boolean(heading?.pin)}`,
        });
      }
    }
    record({
      mode,
      page: pageId,
      check: "mouseup-neighbor-shove",
      pass: gesture.dragged && upDrift < 2 && shove < 2,
      note: `afterDrift=${upDrift.toFixed(1)} mouseupDelta=${shove.toFixed(1)}`,
    });
    const resized = await resizeEast(page, 30);
    record({
      mode,
      page: pageId,
      check: "resize-ew",
      pass: resized,
    });
    const se = page.locator(".moveable-se").first();
    let corner = false;
    if (await se.count()) {
      const rect = await se.boundingBox();
      if (rect) {
        await page.mouse.move(rect.x + 4, rect.y + 4);
        await page.mouse.down();
        await page.mouse.move(rect.x + 24, rect.y + 24, { steps: 5 });
        await page.mouse.up();
        await page.waitForTimeout(150);
        corner = true;
      }
    }
    record({ mode, page: pageId, check: "resize-corners", pass: corner });
  } else if (pageId === "demo" && mode === "C") {
    record({
      mode,
      page: pageId,
      check: "first-pixel-sibling-reflow",
      pass: true,
      note: "N/A — C does not free-drag flow text",
    });
    record({
      mode,
      page: pageId,
      check: "mouseup-neighbor-shove",
      pass: true,
      note: "N/A — C does not free-drag flow text",
    });
    record({
      mode,
      page: pageId,
      check: "resize-ew",
      pass: true,
      note: "N/A — no handles on flow text",
    });
    record({
      mode,
      page: pageId,
      check: "resize-corners",
      pass: true,
      note: "N/A — no handles on flow text",
    });
    record({
      mode,
      page: pageId,
      check: "first-drag-persist-model",
      pass: true,
      note: "N/A — C does not write offset on flow text",
    });
  }

  if (pageId === "marketplace") {
    const cardLabel = page.locator(".layers-row").filter({ hasText: "container" }).first().locator(".layers-label");
    await cardLabel.click();
    await page.waitForTimeout(200);
    const cardHandles = await page.locator(".moveable-control-box").count();
    const cardMoved = cardHandles > 0 && (await dragSelected(page, 20, 10));
    record({
      mode,
      page: pageId,
      check: "move-positioned-card",
      pass: cardMoved,
      note: `boxes=${cardHandles}`,
    });
    if (cardMoved) {
      await page.waitForTimeout(700);
      const afterMove = await getPage();
      const card = findInTree(afterMove.config?.elements, (el) => el.type === "container");
      record({
        mode,
        page: pageId,
        check: "first-drag-persist-model",
        pass: card && card.positioning !== "flow",
        note: `card positioning=${card?.positioning ?? "legacy"}`,
      });
    }
    await selectByText(page, "Search repos");
    const nestedHandles = await page.locator(".moveable-control-box").count();
    const nestedOk = mode === "C" ? nestedHandles === 0 : nestedHandles > 0;
    record({
      mode,
      page: pageId,
      check: "move-nested-child",
      pass: nestedOk,
      note: `boxes=${nestedHandles}`,
    });
    await cardLabel.click();
    await page.waitForTimeout(200);
    const selectedCard = page.locator(".editable.selected").first();
    const beforeW = await selectedCard.evaluate((el) => el.getBoundingClientRect().width);
    const resized = await resizeEast(page, 36);
    const afterW = await selectedCard.evaluate((el) => el.getBoundingClientRect().width);
    const se = page.locator(".moveable-se").first();
    let corner = false;
    if (await se.count()) {
      const rect = await se.boundingBox();
      if (rect) {
        await page.mouse.move(rect.x + 4, rect.y + 4);
        await page.mouse.down();
        await page.mouse.move(rect.x + 20, rect.y + 20, { steps: 5 });
        await page.mouse.up();
        await page.waitForTimeout(200);
        corner = true;
      }
    }
    const widthChanged = Math.abs(afterW - beforeW) >= 4;
    record({
      mode,
      page: pageId,
      check: "resize-ew",
      pass: resized && widthChanged,
      note: `resized=${resized} w ${beforeW.toFixed(1)}→${afterW.toFixed(1)}`,
    });
    record({
      mode,
      page: pageId,
      check: "resize-corners",
      pass: corner,
    });
  }

  await selectByText(page, headingText);
  await page.evaluate(() => {
    const el = document.activeElement;
    if (el instanceof HTMLElement) el.blur();
  });
  const colorInput = page.locator(".hex-input").first();
  let inspectorFilled = false;
  if (await colorInput.count()) {
    await colorInput.fill("#112233");
    await colorInput.blur();
    await page.waitForTimeout(200);
    inspectorFilled = true;
  }
  record({
    mode,
    page: pageId,
    check: "inspector-fields",
    pass: (await page.locator(".inspector").count()) > 0 && inspectorFilled,
    note: inspectorFilled ? "color #112233" : "no hex field",
  });

  async function blurUi() {
    await page.evaluate(() => {
      const el = document.activeElement;
      if (el instanceof HTMLElement) el.blur();
    });
  }
  async function liveCount() {
    return page.locator(".page .editable").count();
  }
  async function chord(keys) {
    await blurUi();
    await page.locator(".page").click({ position: { x: 10, y: 10 } });
    await selectByText(page, headingText);
    await blurUi();
    await page.keyboard.down("Control");
    for (const key of keys) await page.keyboard.press(key);
    await page.keyboard.up("Control");
    await page.waitForTimeout(250);
  }
  await blurUi();
  const beforeClip = await liveCount();
  await chord(["KeyD"]);
  const afterDup = await liveCount();
  await chord(["KeyC", "KeyV"]);
  const afterPaste = await liveCount();
  await chord(["KeyX"]);
  const afterCut = await liveCount();
  await chord(["KeyV"]);
  const afterCutPaste = await liveCount();
  const clipOk =
    afterDup === beforeClip + 1 &&
    afterPaste === afterDup + 1 &&
    afterCut === afterPaste - 1 &&
    afterCutPaste === afterCut + 1;
  record({
    mode,
    page: pageId,
    check: "copy-cut-paste-duplicate",
    pass: clipOk,
    note: `dom ${beforeClip}→dup ${afterDup}→paste ${afterPaste}→cut ${afterCut}→paste ${afterCutPaste}`,
  });

  if (pageId === "demo" && mode !== "C") {
    await page.locator(".page").click({ position: { x: 20, y: 20 } });
    await page.waitForTimeout(100);
    await page.locator(".page .editable").filter({ hasText: headingText }).first().click({ force: true });
    await page
      .locator(".page .editable")
      .filter({ hasText: siblingText })
      .first()
      .click({ force: true, modifiers: ["Shift"] });
    await page.waitForTimeout(250);
    const group = await page.locator(".moveable-control-box").count();
    const multi = await page.locator(".inspector-multi, .inspector-title").filter({ hasText: "selected" }).count();
    record({
      mode,
      page: pageId,
      check: "group-select-drag",
      pass: (group > 0 || multi > 0) && (group === 0 || (await dragSelected(page, 12, 8))),
      note: `boxes=${group} multiHint=${multi}`,
    });
  } else if (mode === "C" && pageId === "demo") {
    record({
      mode,
      page: pageId,
      check: "group-select-drag",
      pass: true,
      note: "N/A — C has no handles on flow pair",
    });
  }

  await page.waitForTimeout(900);
  const saved = await getPage();
  const { configToHtml } = await import("../server/configToHtml.js");
  const { resolveSourcePath } = await import("../server/pathUtils.js");
  const html = configToHtml(saved.config, { preset: saved.preset ?? pageId });
  let written = "";
  let htmlMatch = false;
  try {
    written = readFileSync(resolveSourcePath(saved.source_path), "utf8");
    htmlMatch = written === html;
  } catch (err) {
    written = String(err);
  }
  const colored = findInTree(saved.config?.elements, (el) => el.color === "#112233");
  const colorOk = !inspectorFilled || Boolean(colored);
  const json1 = JSON.stringify(saved.config);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  const reloaded = await getPage();
  const jsonMatch = JSON.stringify(reloaded.config) === json1;
  record({
    mode,
    page: pageId,
    check: "persist-json-html",
    pass: htmlMatch && jsonMatch && colorOk && Array.isArray(saved.config?.elements),
    note: `html=${htmlMatch} reload=${jsonMatch} color=${colored?.color ?? "none"} elements=${flattenCount(saved.config?.elements)}`,
  });

  mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: join(OUT, `${mode}-${pageId}.png`), fullPage: true });
  await context.close();
}

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "/usr/local/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu"],
});

try {
  for (const mode of ["A", "B", "C"]) {
    for (const pageId of ["demo", "marketplace"]) {
      await runMode(browser, mode, pageId);
    }
  }
} finally {
  await browser.close();
  await resetPreset("demo").catch(() => {});
}

const md = [
  "# overlay-qa results",
  "",
  "| mode | page | check | result | note |",
  "|---|---|---|---|---|",
  ...results.map(
    (r) => `| ${r.mode} | ${r.page} | ${r.check} | ${r.pass ? "PASS" : "FAIL"} | ${r.note ?? ""} |`
  ),
  "",
].join("\n");

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "results.md"), md);
console.log("\nWrote", join(OUT, "results.md"));
const failed = results.filter((r) => !r.pass && !r.expectFail);
process.exit(failed.length ? 1 : 0);
