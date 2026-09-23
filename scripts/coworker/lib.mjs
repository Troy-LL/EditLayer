import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { fixOpsFor } from "../../shared/coworker/review.js";
import { FIELD_SPECS, ELEMENT_TYPES } from "../../shared/coworker/schema.js";
import { OP_TYPES } from "../../shared/coworker/ops.js";

export const ROOT = resolve(join(dirname(fileURLToPath(import.meta.url)), "../.."));
export const API = process.env.EDITLAYER_API || "http://localhost:3001";
export const APP = process.env.EDITLAYER_APP || "http://localhost:5173";
export const DEFAULT_ACTOR = {
  kind: process.env.COWORKER_KIND || "ai",
  name: process.env.COWORKER_NAME || "AI co-worker",
};

async function call(method, path, body) {
  let res;
  try {
    res = await fetch(`${API}${path}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(`EditLayer server not reachable at ${API} (cd server && npm start)`);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error ?? `${method} ${path} failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

function outline(elements, depth = 0) {
  return elements.flatMap((el) => {
    const content = el.text ?? el.label ?? (el.items ? el.items.join(" · ") : el.alt ?? "");
    const line = `${"  ".repeat(depth)}- ${el.id} [${el.type}]${el.name ? ` "${el.name}"` : ""}${
      content ? `: ${String(content).slice(0, 60)}` : ""
    }${el.hidden ? " (hidden)" : ""}${el.locked ? " (locked)" : ""}`;
    return [line, ...outline(el.children ?? [], depth + 1)];
  });
}

export async function getPage({ compact = false } = {}) {
  const page = await call("GET", "/page");
  if (!compact) return page;
  return {
    version: page.version,
    preset: page.preset,
    pageBackground: page.config.pageBackground ?? "#ffffff",
    outline: outline(page.config.elements).join("\n"),
  };
}

export function applyOps(ops, { note = "", actor = DEFAULT_ACTOR, baseVersion } = {}) {
  return call("POST", "/page/ops", { ops, note, actor, baseVersion });
}

export function review() {
  return call("GET", "/page/review");
}

export async function fix({ rules, actor = DEFAULT_ACTOR } = {}) {
  const before = await review();
  const ops = fixOpsFor(before.findings, { rules });
  if (!ops.length) return { applied: 0, before: before.score, after: before.score, review: before };
  const res = await applyOps(ops, { note: `auto-fix: ${[...new Set(before.findings.filter((f) => f.fix).map((f) => f.rule))].join(", ")}`, actor });
  return { applied: ops.length, before: before.score, after: res.review.score, review: res.review };
}

export function listRequests(status) {
  return call("GET", `/page/requests${status ? `?status=${status}` : ""}`);
}

export function createRequest(text, elementId) {
  return call("POST", "/page/requests", { text, elementId });
}

export function replyRequest(id, { reply, done = false }) {
  return call("PATCH", `/page/requests/${encodeURIComponent(id)}`, {
    reply,
    ...(done ? { status: "done" } : {}),
  });
}

export function activity() {
  return call("GET", "/page/activity");
}

/** Contract an agent needs to write valid ops — generated from the same schema the server enforces. */
export function describeContract() {
  return {
    ops: OP_TYPES,
    elementTypes: ELEMENT_TYPES,
    fields: Object.fromEntries(Object.entries(FIELD_SPECS).map(([k, [, desc]]) => [k, desc])),
    examples: [
      { op: "update", id: "heading-1", set: { fontSize: 48, color: "#0f172a" } },
      { op: "insert", afterId: "paragraph-1", element: { type: "button", label: "Get started", href: "#start" } },
      { op: "insert", parentId: "some-frame", element: { type: "paragraph", text: "Nested copy" } },
      { op: "move", id: "paragraph-1", parentId: null, afterId: "heading-1" },
      { op: "group", ids: ["heading-1", "paragraph-1"], name: "Hero" },
      { op: "delete", ids: ["old-id"] },
      { op: "setPage", set: { pageBackground: "#f8fafc" } },
    ],
    rules: [
      "Call get_page first; target existing ids, never invent them for update/delete.",
      "Send related changes as one apply_ops call — it is atomic.",
      "Unknown fields are rejected; use only the listed fields.",
      "After changing, call review_page and fix errors you introduced.",
      "Reply to the request you worked on with what changed.",
    ],
  };
}

async function loadChromium() {
  try {
    return (await import("playwright-core")).chromium;
  } catch {
    throw new Error("playwright-core missing: run npm install at the repo root");
  }
}

/**
 * Open the live board (view mode) in a real browser, screenshot it, and measure layout
 * problems the JSON review can't see: overflow past the page, sibling overlap, clipped text.
 */
export async function look({ out = join(tmpdir(), "editlayer-look.png"), width = 1280 } = {}) {
  const chromium = await loadChromium();
  const { preset } = await call("GET", "/page");
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || "/usr/local/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-gpu"],
  });
  try {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    try {
      await page.goto(`${APP}/#/${preset}`, { waitUntil: "load", timeout: 15000 });
    } catch {
      throw new Error(`EditLayer app not reachable at ${APP} (cd client && npm run dev)`);
    }
    await page.waitForSelector(".page [data-element-id], .page-empty", { timeout: 10000 });
    await page.waitForTimeout(300);
    const findings = await page.evaluate(() => {
      const out = [];
      const pageEl = document.querySelector(".page");
      const pageBox = pageEl.getBoundingClientRect();
      const nodes = [...document.querySelectorAll("[data-element-id]")].filter((n) => n.offsetParent !== null);
      const boxOf = (n) => n.getBoundingClientRect();
      for (const n of nodes) {
        const id = n.getAttribute("data-element-id");
        const b = boxOf(n);
        if (b.right > pageBox.right + 1 || b.left < pageBox.left - 1) {
          out.push({ rule: "layout-overflow", elementId: id, message: `${id}: extends ${Math.round(Math.max(b.right - pageBox.right, pageBox.left - b.left))}px outside the page` });
        }
        const style = getComputedStyle(n);
        if ((style.overflow === "hidden" || style.overflowY === "hidden") && n.scrollHeight > n.clientHeight + 1) {
          out.push({ rule: "layout-clipped", elementId: id, message: `${id}: content clipped (${n.scrollHeight - n.clientHeight}px hidden)` });
        }
      }
      const byParent = new Map();
      for (const n of nodes) {
        const parent = n.parentElement?.closest("[data-element-id]")?.getAttribute("data-element-id") ?? "page";
        if (!byParent.has(parent)) byParent.set(parent, []);
        byParent.get(parent).push(n);
      }
      for (const siblings of byParent.values()) {
        for (let i = 0; i < siblings.length; i += 1) {
          for (let j = i + 1; j < siblings.length; j += 1) {
            const a = boxOf(siblings[i]);
            const b = boxOf(siblings[j]);
            const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
            const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
            if (w > 2 && h > 2) {
              const ids = [siblings[i], siblings[j]].map((n) => n.getAttribute("data-element-id"));
              out.push({ rule: "layout-overlap", elementId: ids[0], message: `${ids[0]} overlaps ${ids[1]} (${Math.round(w)}×${Math.round(h)}px)` });
            }
          }
        }
      }
      return out;
    });
    mkdirSync(dirname(out), { recursive: true });
    await page.screenshot({ path: out, fullPage: true });
    return {
      preset,
      screenshot: out,
      findings: findings.map((f) => ({ ...f, id: `${f.rule}:${f.elementId}`, severity: "warn" })),
    };
  } finally {
    await browser.close();
  }
}

/** Quality gate: JSON review (+ optional browser look) must meet the bar. */
export async function check({ minScore = 90, withLook = false } = {}) {
  const r = await review();
  const seen = withLook ? await look() : null;
  const layout = seen?.findings ?? [];
  const score = Math.max(0, r.score - layout.length * 5);
  const pass = r.counts.error === 0 && score >= minScore;
  return { pass, score, minScore, preset: r.preset, htmlInSync: r.htmlInSync, findings: [...r.findings, ...layout], screenshot: seen?.screenshot ?? null };
}

/**
 * Run a scenario file against the live server as the "test" actor, then restore the
 * page exactly as it was (unless keep). Same files `npm test` runs in-process.
 */
export async function runScenario(file, { keep = false } = {}) {
  const scenario = JSON.parse(readFileSync(resolve(file), "utf8"));
  const original = await call("GET", "/page");
  const actor = { kind: "test", name: "Scenario" };
  const steps = [];
  try {
    await call("POST", "/page/preset", { preset: scenario.preset });
    for (const step of scenario.steps) {
      try {
        const res = await applyOps(step.ops, { note: step.note, actor });
        steps.push({ note: step.note, ok: !step.expectError, detail: step.expectError ? "expected an error but ops applied" : res.results });
      } catch (err) {
        const ok = Boolean(step.expectError) && new RegExp(step.expectError).test(err.message);
        steps.push({ note: step.note, ok, detail: err.message });
      }
    }
    const r = await review();
    const { expect = {} } = scenario;
    const failures = steps.filter((s) => !s.ok).map((s) => `${s.note}: ${JSON.stringify(s.detail)}`);
    if (expect.minScore != null && r.score < expect.minScore) failures.push(`score ${r.score} < ${expect.minScore}`);
    if (expect.maxErrors != null && r.counts.error > expect.maxErrors) failures.push(`${r.counts.error} errors > ${expect.maxErrors}`);
    if (!r.htmlInSync) failures.push("HTML write-back out of sync");
    return { name: scenario.name, pass: failures.length === 0, failures, steps, score: r.score, findings: r.findings };
  } finally {
    if (!keep) {
      await call("POST", "/page/preset", { preset: original.preset });
      await call("PUT", "/page", { config: original.config, actor });
    }
  }
}

export function watch(onEvent) {
  const controller = new AbortController();
  (async () => {
    const res = await fetch(`${API}/page/events`, { signal: controller.signal });
    const decoder = new TextDecoder();
    let buffer = "";
    for await (const chunk of res.body) {
      buffer += decoder.decode(chunk, { stream: true });
      let idx;
      while ((idx = buffer.indexOf("\n\n")) >= 0) {
        const frame = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const line = frame.split("\n").find((l) => l.startsWith("data: "));
        if (line) onEvent(JSON.parse(line.slice(6)));
      }
    }
  })().catch((err) => {
    if (err.name !== "AbortError") onEvent({ type: "error", message: err.message });
  });
  return () => controller.abort();
}
