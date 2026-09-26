#!/usr/bin/env node
/**
 * sessionStart: if EditLayer has open co-worker requests, inject them so the
 * agent picks them up without the human re-asking in chat.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const PENDING = join(ROOT, ".editlayer", "auto-dispatch.json");
const API = process.env.EDITLAYER_API || "http://localhost:3001";

async function fetchOpen() {
  try {
    const res = await fetch(`${API}/page/requests?status=open`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.requests ?? [];
  } catch {
    return [];
  }
}

function summarize(r) {
  const bits = [`${r.id}: ${String(r.text).slice(0, 160)}`];
  if (r.elementId) bits.push(`element ${r.elementId}`);
  if (r.target?.source) bits.push(`${r.target.source.file}:${r.target.source.line}`);
  if (r.intent?.feel?.length) bits.push(`feel: ${r.intent.feel.join(", ")}`);
  if (r.intent?.scope) bits.push(`scope: ${r.intent.scope}`);
  if (r.intent?.frame) bits.push(`frame: ${r.intent.frame}`);
  if (r.resolution === "revert") bits.push("resolution: revert");
  return `- ${bits.join(" · ")}`;
}

const requests = await fetchOpen();
let pending = null;
if (existsSync(PENDING)) {
  try {
    pending = JSON.parse(readFileSync(PENDING, "utf8"));
  } catch {
    pending = null;
  }
}

const out = {};
if (requests.length > 0 || pending?.needsPickup) {
  const lines = (requests.length ? requests : [pending]).slice(0, 5).map((r) =>
    r.id ? summarize(r) : `- queued: ${String(r.text || "").slice(0, 160)}`
  );
  out.additional_context = [
    "EditLayer has open co-worker request(s). Handle them now — do not wait for the human to re-ask.",
    "Use the editlayer MCP: list_requests → look_request if target.source → edit that source file → comment → reply_request. If resolution is revert, undo the file change first.",
    "Honor intent.changes literally; interpret intent.feel with get_design_brief. Keep specificity; do not invent a broader redesign.",
    lines.join("\n"),
  ].join("\n");
}

process.stdout.write(`${JSON.stringify(out)}\n`);
