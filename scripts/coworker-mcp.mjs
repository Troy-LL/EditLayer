#!/usr/bin/env node
/**
 * EditLayer co-worker MCP server (stdio, JSON-RPC 2.0, no SDK dependency).
 * Every tool is a thin call into scripts/coworker/lib.mjs — the same functions the
 * CLI and live QA use — so the AI co-worker and the test harness are interchangeable.
 */
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import * as lib from "./coworker/lib.mjs";

const PROTOCOL_VERSION = "2024-11-05";
const INSTRUCTIONS = `You are a co-worker on a live EditLayer board. A human is watching the page in the editor; every change you make appears for them immediately and is one Ctrl+Z away.
Loop: list_requests → get_page → apply_ops (atomic, with a short note) → review_page → reply_request.
${lib.describeContract().rules.join("\n")}`;

const obj = (properties, required = []) => ({ type: "object", properties, required });

const TOOLS = [
  {
    name: "get_page",
    description: "Current page: version, preset, and element tree. compact=true returns an id/type/text outline (use it first to find ids).",
    inputSchema: obj({ compact: { type: "boolean" } }),
    run: (a) => lib.getPage({ compact: Boolean(a.compact) }),
  },
  {
    name: "get_contract",
    description: "Op vocabulary, element types, every allowed field with its type, and examples. Read before your first apply_ops.",
    inputSchema: obj({}),
    run: () => lib.describeContract(),
  },
  {
    name: "apply_ops",
    description: "Apply ops atomically to the live page (all or nothing). Ops: insert, update, delete, move, group, ungroup, setPage. Returns new version, results (ids created), and the post-change review.",
    inputSchema: obj(
      {
        ops: { type: "array", items: { type: "object" }, description: "e.g. [{\"op\":\"update\",\"id\":\"heading-1\",\"set\":{\"fontSize\":48}}]" },
        note: { type: "string", description: "One line shown to the human in the activity feed" },
        baseVersion: { type: "number", description: "Optional: reject if the page changed since this version" },
      },
      ["ops"]
    ),
    run: (a) => lib.applyOps(a.ops, { note: a.note ?? "", baseVersion: a.baseVersion }),
  },
  {
    name: "review_page",
    description: "Quality review: score 0–100, findings (contrast, empty content, alt text, tap targets, font size, HTML sync). Findings with `fix` can be applied via fix_page.",
    inputSchema: obj({}),
    run: () => lib.review(),
  },
  {
    name: "fix_page",
    description: "Apply every auto-fix the review offers (optionally only some rules).",
    inputSchema: obj({ rules: { type: "array", items: { type: "string" } } }),
    run: (a) => lib.fix({ rules: a.rules }),
  },
  {
    name: "look",
    description: "Screenshot the live board in a real browser and report layout findings (overflow, overlap, clipped text).",
    inputSchema: obj({}),
    run: async () => {
      const res = await lib.look();
      return {
        content: [
          { type: "text", text: JSON.stringify({ preset: res.preset, findings: res.findings }, null, 2) },
          { type: "image", data: readFileSync(res.screenshot).toString("base64"), mimeType: "image/png" },
        ],
      };
    },
  },
  {
    name: "list_requests",
    description: "Requests the human left on the board (like Figma comments), optionally pinned to an elementId.",
    inputSchema: obj({ status: { type: "string", enum: ["open", "done"] } }),
    run: (a) => lib.listRequests(a.status),
  },
  {
    name: "reply_request",
    description: "Reply to a request; done=true resolves it.",
    inputSchema: obj({ id: { type: "string" }, reply: { type: "string" }, done: { type: "boolean" } }, ["id", "reply"]),
    run: (a) => lib.replyRequest(a.id, { reply: a.reply, done: Boolean(a.done) }),
  },
  {
    name: "activity",
    description: "Recent board changes by humans, AI, and tests.",
    inputSchema: obj({}),
    run: () => lib.activity(),
  },
];

function reply(id, result) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result })}\n`);
}

function replyError(id, code, message) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } })}\n`);
}

async function handle(msg) {
  const { id, method, params } = msg;
  switch (method) {
    case "initialize":
      return reply(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: "editlayer-coworker", version: "0.1.0" },
        instructions: INSTRUCTIONS,
      });
    case "ping":
      return reply(id, {});
    case "tools/list":
      return reply(id, { tools: TOOLS.map(({ run: _run, ...tool }) => tool) });
    case "tools/call": {
      const tool = TOOLS.find((t) => t.name === params?.name);
      if (!tool) return replyError(id, -32602, `Unknown tool: ${params?.name}`);
      try {
        const out = await tool.run(params.arguments ?? {});
        return reply(id, out?.content ? out : { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] });
      } catch (err) {
        return reply(id, { isError: true, content: [{ type: "text", text: err.message }] });
      }
    }
    default:
      if (id !== undefined) replyError(id, -32601, `Method not found: ${method}`);
  }
}

const rl = createInterface({ input: process.stdin });
rl.on("line", (line) => {
  if (!line.trim()) return;
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return replyError(null, -32700, "Parse error");
  }
  handle(msg);
});
