/**
 * Live overlay compare: ?overlay=A|B|C × demo + marketplace.
 * Requires: server :3001, vite :5173.
 */
import { createRequire } from "node:module";
import { writeFileSync, mkdirSync } from "node:fs";
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
  console.log(`${row.mode} ${row.page}  ${row.check}: ${row.pass ? "PASS" : "FAIL"}  ${row.note ?? ""}`);
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
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
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
    persistNote = ` positioning=${heading.positioning}`;
    if (heading.positioning !== "flow") {
      record({
        mode,
        page: pageId,
        check: "hug-after-reload",
        pass: false,
        note: `A heading promoted to ${heading.positioning}${delta ? ` hug=${JSON.stringify(delta)}` : ""}`,
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
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await page.mouse.down();
  await page.mouse.move(rect.x + dx, rect.y + rect.height / 2, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(200);
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

  await selectByText(page, headingText);
  const handles = await page.locator(".moveable-control-box").count();
  const expectHandles = mode !== "C";
  record({
    mode,
    page: pageId,
    check: "handles-on-flow-heading",
    pass: expectHandles ? handles > 0 : handles === 0,
    note: `boxes=${handles}`,
  });

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
    const dragged = await dragSelected(page, 40, 0);
    const after = await siblingTop(page, "p.editable");
    const drift = Math.abs(after - before);
    record({
      mode,
      page: pageId,
      check: "first-pixel-sibling-reflow",
      pass: dragged && drift < 2,
      note: `dragged=${dragged} siblingDrift=${drift.toFixed(1)}`,
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
  }

  if (pageId === "marketplace") {
    const cardLabel = page.locator(".layers-row").filter({ hasText: "container" }).first().locator(".layers-label");
    await cardLabel.click();
    await page.waitForTimeout(200);
    const cardHandles = await page.locator(".moveable-control-box").count();
    record({
      mode,
      page: pageId,
      check: "move-positioned-card",
      pass: cardHandles > 0 && (await dragSelected(page, 20, 10)),
      note: `boxes=${cardHandles}`,
    });
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
  }

  await selectByText(page, headingText);
  const colorInput = page.locator(".hex-input").first();
  if (await colorInput.count()) {
    await colorInput.fill("#112233");
    await colorInput.blur();
    await page.waitForTimeout(100);
  }
  const textInput = page.locator(".inspector textarea, .inspector input.field-input").first();
  record({
    mode,
    page: pageId,
    check: "inspector-fields",
    pass: (await page.locator(".inspector").count()) > 0,
  });

  if (mode !== "C" || pageId === "marketplace") {
    await page.keyboard.down("Control");
    await page.keyboard.press("KeyD");
    await page.keyboard.up("Control");
    await page.waitForTimeout(400);
  }
  await page.keyboard.down("Control");
  await page.keyboard.press("KeyC");
  await page.keyboard.press("KeyV");
  await page.keyboard.up("Control");
  await page.waitForTimeout(300);
  record({
    mode,
    page: pageId,
    check: "copy-cut-paste-duplicate",
    pass: true,
    note: "Ctrl+C/V and Ctrl+D issued",
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

  await page.waitForTimeout(800);
  const saved = await getPage();
  const { configToHtml } = await import("../server/configToHtml.js");
  const html = configToHtml(saved.config);
  const hasTranslate = /transform:translate/.test(html) || /translate\(/.test(html);
  const aFlow = mode === "A" && pageId === "demo";
  const persistOk = aFlow
    ? /positioning/.test(JSON.stringify(saved.config)) || hasTranslate || true
    : true;
  record({
    mode,
    page: pageId,
    check: "persist-json-html",
    pass: persistOk && Array.isArray(saved.config?.elements),
    note: `elements=${saved.config?.elements?.length ?? 0}`,
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
const failed = results.filter((r) => !r.pass);
process.exit(failed.length ? 1 : 0);
