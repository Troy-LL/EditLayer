#!/usr/bin/env node
/**
 * stop: if a freshly queued EditLayer request is still open, auto-submit a
 * follow-up so the agent picks it up without another human prompt.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const PENDING = join(ROOT, ".editlayer", "auto-dispatch.json");
const API = process.env.EDITLAYER_API || "http://localhost:3001";
const MAX_LOOPS = 2;

function readStdin() {
  return new Promise((resolve) => {
    const chunks = [];
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => chunks.push(c));
    process.stdin.on("end", () => {
      try {
        resolve(JSON.parse(chunks.join("") || "{}"));
      } catch {
        resolve({});
      }
    });
  });
}

function readPending() {
  if (!existsSync(PENDING)) return null;
  try {
    return JSON.parse(readFileSync(PENDING, "utf8"));
  } catch {
    return null;
  }
}

async function stillOpen(id) {
  try {
    const res = await fetch(`${API}/page/requests?status=open`);
    if (!res.ok) return false;
    const data = await res.json();
    return (data.requests ?? []).some((r) => r.id === id);
  } catch {
    return false;
  }
}

const input = await readStdin();
const out = {};

if (input.status === "completed") {
  const pending = readPending();
  const loopCount = Number(input.loop_count) || 0;
  if (pending?.needsPickup && pending.requestId && loopCount < MAX_LOOPS) {
    if (await stillOpen(pending.requestId)) {
      const feel = pending.intent?.feel?.length ? ` Feel: ${pending.intent.feel.join(", ")}.` : "";
      const source = pending.target?.source
        ? ` Source: ${pending.target.source.file}:${pending.target.source.line}.`
        : pending.elementId
          ? ` Element: ${pending.elementId}.`
          : "";
      out.followup_message = [
        `EditLayer co-worker request ${pending.requestId} is waiting: "${String(pending.text).slice(0, 200)}".${source}${feel}`,
        "Use the editlayer MCP now: list_requests → look_request if target.source → edit that source file → comment → reply_request. If resolution is revert, undo the file change first.",
        "Stay specific to the request; do not broaden scope.",
      ].join(" ");
    }
  }
}

process.stdout.write(`${JSON.stringify(out)}\n`);
