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
const INSTRUCTIONS = `You are a design co-worker on the user's running app. The human pins requests on the live page; you fulfill them in the workspace source.
Call set_design_session only when the human is designing (get_design_session shows whether it is on).
At the start of a design turn, call list_requests. Open requests are pins: fulfill target.source by editing that file in the workspace.
Honor intent.changes literally. Interpret intent.feel via get_design_brief. Honor intent.scope: this = one element, instances = every element from that JSX line, component = the component, token = the design token, frame = only the named frame. Honor intent.frame (desktop|tablet|phone) via look_request.
Prefer the project's existing CSS classes and design tokens over inline styles. Stay specific; do not invent a broader redesign.
If a request's resolution is revert, undo your file edit for that pin, then reply_request done.
After you change the design, call comment to drop a pin on what you touched, then look_request to verify. reply_request with done=true marks a pin done.`;

const obj = (properties, required = []) => ({ type: "object", properties, required });

const TOOLS = [
  {
    name: "get_design_session",
    description: "Whether the design session is on (the human is designing on the live page).",
    inputSchema: obj({}),
    run: () => lib.getDesignSession(),
  },
  {
    name: "set_design_session",
    description: "Turn the design session on or off. Only turn it on when the human is designing.",
    inputSchema: obj({ on: { type: "boolean" } }, ["on"]),
    run: (a) => lib.setDesignSession(Boolean(a.on)),
  },
  {
    name: "list_requests",
    description:
      "Pins on the live page (Figma-style comments). Each carries target (url, source file:line:column, selector) and intent (changes, feel, scope, frame), and may have resolution accept|revert.",
    inputSchema: obj({ status: { type: "string", enum: ["open", "done"] } }),
    run: (a) => lib.listRequests(a.status),
  },
  {
    name: "look_request",
    description:
      "For a request with target.url: open that page in headless Chrome at intent.frame width (desktop 1280, tablet 768, phone 390), locate the element (data-editlayer-source stamp first, else selector), return before/after PNG crops with intent.changes applied as inline preview on all instances.",
    inputSchema: obj({ id: { type: "string" } }, ["id"]),
    run: async (a) => {
      const res = await lib.lookRequest(a.id);
      return {
        content: [
          { type: "text", text: JSON.stringify({ summary: res.summary, frame: res.frame, instances: res.instances, now: res.now, wanted: res.wanted }, null, 2) },
          { type: "image", data: readFileSync(res.now).toString("base64"), mimeType: "image/png" },
          { type: "image", data: readFileSync(res.wanted).toString("base64"), mimeType: "image/png" },
        ],
      };
    },
  },
  {
    name: "get_design_brief",
    description: "Read editlayer.brief.md from EDITLAYER_PROJECT_ROOT (or cwd) — design voice for interpreting intent.feel.",
    inputSchema: obj({}),
    run: () => lib.getDesignBrief(),
  },
  {
    name: "comment",
    description:
      "Open a pin on the live page as the agent. text is the comment. target/intent match a human Ask (url, source, scope, frame, feel).",
    inputSchema: obj(
      {
        text: { type: "string" },
        target: { type: "object", description: "url, source { file, line, column }, selector" },
        intent: { type: "object", description: "scope, frame, feel, changes" },
      },
      ["text"]
    ),
    run: (a) => lib.commentOnPage({ text: a.text, target: a.target, intent: a.intent }),
  },
  {
    name: "reply_request",
    description: "Reply to a pin; done=true resolves it. resolution records whether the human accepted or reverted the change.",
    inputSchema: obj(
      {
        id: { type: "string" },
        reply: { type: "string" },
        done: { type: "boolean" },
        resolution: { type: "string", enum: ["accept", "revert"] },
      },
      ["id", "reply"]
    ),
    run: (a) => lib.replyRequest(a.id, { reply: a.reply, done: Boolean(a.done), resolution: a.resolution }),
  },
  {
    name: "activity",
    description: "Recent changes by humans, AI, and tests.",
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
