#!/usr/bin/env node
// End-to-end check of EditLayer on top of a real app (examples/storefront):
// select → preview → Apply writes JSX → HMR → Undo restores bytes; instances; Ask agent → look_request → reply pin.
// Needs: EditLayer server on :3001 and `cd examples/storefront && npm run dev` on :5180.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { ROOT, getDesignBrief, listRequests, lookRequest, replyRequest } from "./coworker/lib.mjs";

const APP_URL = process.env.STOREFRONT_URL || "http://127.0.0.1:5180/";
const OUT = process.env.E2E_OUT || "/tmp/editlayer-overlay-e2e";
const STORE = join(ROOT, "examples/storefront");
const HERO = join(STORE, "src/components/Hero.jsx");
const CARD = join(STORE, "src/components/ProductCard.jsx");
const CSS = join(STORE, "src/styles.css");
const BRIEF = join(STORE, "editlayer.brief.md");

const read = (p) => readFileSync(p, "utf8");
const panel = (sel) => `editlayer-root ${sel}`;
let step = 0;
const log = (msg) => console.log(`${String(++step).padStart(2)}. ${msg}`);

async function waitFor(fn, what, timeout = 8000) {
  const end = Date.now() + timeout;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 100));
  }
}

async function select(page, locator, position) {
  await locator.scrollIntoViewIfNeeded();
  await locator.click({ position });
  await page.waitForSelector(panel(".el-design-fields [data-prop]"));
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const heroBefore = read(HERO);
  const cardBefore = read(CARD);
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || (existsSync("/usr/local/bin/google-chrome") ? "/usr/local/bin/google-chrome" : undefined),
    headless: true,
    args: ["--no-sandbox", "--disable-gpu"],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  try {
    await page.goto(APP_URL, { waitUntil: "load" });
    await page.waitForSelector("[data-editlayer-source]");
    await page.waitForSelector(panel(".el-pill"));
    const closedDisplay = await page.locator(panel(".el-panel")).evaluate((el) => getComputedStyle(el).display);
    assert.equal(closedDisplay, "none", "closed inspector must not cover the page or the pill");
    log("storefront loaded with source stamps and the overlay pill");

    await page.keyboard.press("e");
    await page.waitForSelector(panel(".el-panel:not([hidden])"));
    log("E opens the inspector panel");

    // --- Apply → file write → HMR → Undo byte-exact ---
    const hero = page.locator("section.hero");
    await select(page, hero, { x: 24, y: 12 });
    const header = await page.locator(panel(".el-panel-header")).innerText();
    assert.match(header, /Hero\.jsx:3/, `header shows source, got: ${header}`);
    log(`selected Hero section → header "${header.replace(/\n/g, " | ")}"`);

    await page.locator(panel('input[data-prop="paddingTop"]')).fill("120px");
    assert.equal(await hero.evaluate((el) => getComputedStyle(el).paddingTop), "120px");
    const changes = await page.locator(panel(".el-changes-list")).innerText();
    assert.match(changes, /paddingTop: 72px → 120px/);
    log(`live preview: ${changes.trim()}`);
    await page.screenshot({ path: join(OUT, "01-preview.png") });

    await page.locator(panel(".el-btn-apply")).click();
    await waitFor(() => read(HERO).includes('paddingTop: "120px"'), "Hero.jsx write");
    await waitFor(async () => /No preview changes/.test(await page.locator(panel(".el-changes-list")).innerText()), "changes cleared");
    await page.waitForTimeout(600);
    assert.equal(await hero.evaluate((el) => el.style.paddingTop), "120px", "HMR keeps the applied value");
    assert.ok(await page.locator(panel(".el-btn-apply")).isDisabled(), "Apply disabled with no pending changes");
    log("Apply wrote Hero.jsx (paddingTop: \"120px\"), HMR kept it, change list cleared");

    await page.locator(panel(".el-toast button"), { hasText: "Undo" }).first().click();
    await waitFor(() => read(HERO) === heroBefore, "Hero.jsx restored");
    await waitFor(async () => (await hero.evaluate((el) => getComputedStyle(el).paddingTop)) === "72px", "HMR restore");
    log("Undo restored Hero.jsx byte-for-byte and the page is back to 72px");

    // --- Class rule and className, then undo from the persisted stack ---
    const cssBefore = read(CSS);
    const title = page.locator("h1.hero__title");
    await select(page, title);
    await page.locator(panel('input[data-prop="letterSpacing"]')).fill("-2px");
    const cssChange = await page.locator(panel(".el-changes-list")).innerText();
    assert.match(cssChange, /styles\.css/, `letter-spacing should target the class rule, got: ${cssChange}`);
    await page.locator(panel(".el-btn-apply")).click();
    await waitFor(() => read(CSS).includes("letter-spacing: -2px"), "styles.css write");
    assert.equal(read(HERO), heroBefore, "class edit does not touch the JSX");
    log("letter-spacing wrote .hero__title in styles.css, Hero.jsx unchanged");
    await page.keyboard.press("Control+z");
    await waitFor(() => read(CSS) === cssBefore, "styles.css restored from disk undo");
    log("Undo restored styles.css after a round trip through .editlayer/undo.json");

    await select(page, title);
    await page.locator(panel('input[data-prop="fontSize"]')).fill("48px");
    const fontChange = await page.locator(panel(".el-changes-list")).innerText();
    assert.match(fontChange, /\.hero__title/);
    assert.doesNotMatch(fontChange, /token --/);
    await page.locator(panel(".el-btn-reset")).click();
    log("font size stays on .hero__title instead of rewriting the shared token");

    await select(page, title);
    await page.locator(panel(".el-class-add")).fill("quiet");
    await page.locator(panel(".el-class-add")).press("Enter");
    await page.locator(panel(".el-btn-apply")).click();
    await waitFor(() => read(HERO).includes('className="hero__title quiet"'), "className write");
    log('added class "quiet" on the headline className');
    await page.keyboard.press("Control+z");
    await waitFor(() => read(HERO) === heroBefore, "className undo");

    // --- Instances: one edit changes every card ---
    const buttons = page.locator(".product-card__add");
    const n = await buttons.count();
    await select(page, buttons.first());
    const cardHeader = await page.locator(panel(".el-panel-header")).innerText();
    assert.match(cardHeader, new RegExp(`×${n} instances`), `header counts ${n} instances: ${cardHeader}`);
    await waitFor(async () => (await page.locator("editlayer-root .el-outline.inst").count()) === n - 1, "dashed outlines on the other instances");
    log(`"Add to cart" → ProductCard, ×${n} instances outlined`);

    await page.locator(panel('input[data-prop="textContent"]')).fill("Add to bag");
    await page.screenshot({ path: join(OUT, "02-instances.png") });
    await page.locator(panel(".el-btn-apply")).click();
    await waitFor(() => read(CARD).includes("Add to bag"), "ProductCard.jsx write");
    await page.waitForTimeout(600);
    const labels = await buttons.allInnerTexts();
    assert.deepEqual(labels, Array(n).fill("Add to bag"));
    log(`Apply rewrote the static text once in ProductCard.jsx; all ${n} buttons read "Add to bag"`);
    await page.keyboard.press("Control+z");
    await waitFor(() => read(CARD) === cardBefore, "ProductCard.jsx restored");
    log("Ctrl+Z undid it byte-for-byte");

    // --- Dynamic text is refused, not guessed ---
    await select(page, page.locator(".product-card__name").first());
    await page.locator(panel('input[data-prop="textContent"]')).fill("Renamed");
    await page.locator(panel(".el-btn-apply")).click();
    const err = await waitFor(async () => {
      const e = page.locator(panel(".el-inline-error"));
      return (await e.isVisible()) && (await e.innerText());
    }, "inline error");
    assert.match(err, /ask the agent/i);
    assert.equal(read(CARD), cardBefore, "dynamic text leaves the file alone");
    await page.locator(panel(".el-btn-reset")).click();
    log(`dynamic {name} text refused: "${err}"`);

    // --- Ask agent: target + intent → look_request → reply pin ---
    await select(page, title);
    assert.equal(await page.locator(panel(".el-inline-error")).isVisible(), false, "error clears on new selection");
    await page.locator(panel('input[data-prop="letterSpacing"]')).fill("-2px");
    await page.locator(panel(".el-btn-ask-tab")).click();
    const note = `e2e ${Date.now()}: make the headline feel more editorial`;
    await page.locator(panel(".el-ask-text")).fill(note);
    for (const word of ["tighter", "premium"]) await page.locator(panel(`.el-chip[data-feel="${word}"]`)).click();
    await page.screenshot({ path: join(OUT, "03-ask-agent.png") });
    await page.locator(panel(".el-btn-send")).click();

    const req = await waitFor(async () => (await listRequests()).requests.find((r) => r.text === note), "request on :3001");
    assert.equal(req.target.source.file, "src/components/Hero.jsx");
    assert.equal(req.target.component, "Hero");
    assert.deepEqual(req.intent.feel, ["tighter", "premium"]);
    assert.equal(req.intent.changes.letterSpacing.to, "-2px");
    log(`request ${req.id}: ${req.target.component} @ ${req.target.source.file}:${req.target.source.line}, feel [${req.intent.feel}], letterSpacing → -2px`);

    const look = await lookRequest(req.id, { outDir: join(OUT, "look") });
    assert.notDeepEqual(readFileSync(look.now), readFileSync(look.wanted), "now/wanted crops differ");
    log(`look_request: ${look.summary}`);

    await page.locator(panel(".el-btn-reset")).click();
    await replyRequest(req.id, { reply: "Tightened the headline to -0.02em and set it in the display weight.", done: true });
    await waitFor(async () => (await page.locator(panel(".el-toast"), { hasText: "Agent:" }).count()) > 0, "agent toast");
    await page.waitForSelector(panel(".el-pin.done"));
    await page.locator(panel(".el-pin.done")).last().click();
    await page.waitForSelector(panel(".el-popover:not([hidden]) .el-reply"));
    await page.screenshot({ path: join(OUT, "04-agent-reply.png") });
    log("agent reply arrived over SSE: toast + done pin + popover");

    // --- Brief: edited in the overlay, read by the agent ---
    const briefBefore = read(BRIEF);
    try {
      await page.locator(panel('.el-tab[data-tab="brief"]')).click();
      await waitFor(async () => (await page.locator(panel(".el-brief-text")).inputValue()) === briefBefore, "brief loaded");
      const line = `\n- e2e ${Date.now()}: headlines stay calm, never shout.\n`;
      await page.locator(panel(".el-brief-text")).fill(briefBefore + line);
      await page.locator(panel(".el-btn-brief-save")).click();
      await waitFor(() => read(BRIEF).endsWith(line), "brief written");
      process.env.EDITLAYER_PROJECT_ROOT = STORE;
      assert.ok(getDesignBrief().text.endsWith(line), "get_design_brief returns the saved text");
      log("Brief tab loaded editlayer.brief.md, saved an edit, and get_design_brief reads it");
    } finally {
      writeFileSync(BRIEF, briefBefore);
    }

    assert.deepEqual(errors, [], `page errors: ${errors.join("; ")}`);
    assert.equal(read(HERO), heroBefore);
    assert.equal(read(CARD), cardBefore);
    console.log(`\nPASS overlay e2e — screenshots in ${OUT}`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(`\nFAIL overlay e2e: ${err.message}`);
  process.exit(1);
});
