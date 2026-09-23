import { readFileSync } from "node:fs";
import { applyOps, summarizeOp } from "../shared/coworker/ops.js";
import { reviewConfig, scoreFindings } from "../shared/coworker/review.js";
import { validateConfig } from "../shared/coworker/schema.js";
import { configToHtml } from "./configToHtml.js";
import { createRequest, getPage, listRequests, savePage, updateRequest } from "./db.js";
import { resolveSourcePath } from "./pathUtils.js";

const ACTOR_KINDS = new Set(["human", "ai", "test"]);
const ACTIVITY_LIMIT = 100;

const clients = new Set();
const activity = [];

function normalizeActor(actor) {
  const kind = ACTOR_KINDS.has(actor?.kind) ? actor.kind : "human";
  const name = typeof actor?.name === "string" && actor.name.trim() ? actor.name.trim().slice(0, 40) : null;
  return { kind, name: name ?? (kind === "ai" ? "AI co-worker" : kind === "test" ? "Test" : "You") };
}

function send(event) {
  const frame = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of clients) res.write(frame);
}

/** Record + stream a page change. `ops` null means a whole-config write (PUT / preset / restore). */
export function broadcastChange({ config, version, actor, origin = null, note = "", ops = null, touchedIds = [], preset }) {
  const entry = {
    type: "change",
    at: new Date().toISOString(),
    version,
    actor: normalizeActor(actor),
    origin,
    note: typeof note === "string" ? note.slice(0, 280) : "",
    summary: ops ? ops.map(summarizeOp) : ["replaced page"],
    touchedIds,
  };
  activity.unshift(entry);
  activity.length = Math.min(activity.length, ACTIVITY_LIMIT);
  send({ ...entry, ops, config, preset });
}

function htmlSyncFinding(page) {
  if (!page.source_path) return null;
  try {
    const onDisk = readFileSync(resolveSourcePath(page.source_path), "utf8");
    if (onDisk === configToHtml(page.config, { preset: page.preset })) return null;
    return "written HTML is out of date with the saved JSON";
  } catch (err) {
    return `written HTML unreadable: ${err.message}`;
  }
}

export function reviewPage() {
  const page = getPage();
  const review = reviewConfig(page.config);
  const htmlProblem = htmlSyncFinding(page);
  const findings = htmlProblem
    ? [...review.findings, { id: "html-sync:page", rule: "html-sync", severity: "error", elementId: null, message: htmlProblem }]
    : review.findings;
  const counts = { error: 0, warn: 0, info: 0 };
  findings.forEach((f) => {
    counts[f.severity] += 1;
  });
  return {
    version: page.version,
    preset: page.preset,
    htmlInSync: !htmlProblem,
    score: scoreFindings(findings),
    counts,
    findings,
  };
}

export function validationError(config) {
  const { errors } = validateConfig(config);
  return errors.length ? errors : null;
}

export function registerCoworkerRoutes(app, { syncHtmlWrite }) {
  app.get("/page/events", (req, res) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.write(`data: ${JSON.stringify({ type: "hello", version: getPage().version })}\n\n`);
    clients.add(res);
    const ping = setInterval(() => res.write(": ping\n\n"), 25000);
    req.on("close", () => {
      clearInterval(ping);
      clients.delete(res);
    });
  });

  app.get("/page/activity", (_req, res) => {
    res.json({ activity });
  });

  app.get("/page/review", (_req, res) => {
    res.json(reviewPage());
  });

  app.post("/page/ops", (req, res) => {
    const { ops, actor, note, origin, baseVersion } = req.body ?? {};
    const page = getPage();
    if (baseVersion != null && baseVersion !== page.version) {
      return res.status(409).json({
        error: `page changed (version ${page.version}, you had ${baseVersion}); GET /page and retry`,
        version: page.version,
      });
    }
    const result = applyOps(page.config, ops);
    if (!result.ok) return res.status(400).json({ error: result.error, index: result.index });
    const invalid = validationError(result.config);
    if (invalid) return res.status(400).json({ error: `result is invalid: ${invalid.join("; ")}` });

    const { version } = savePage(result.config);
    const { htmlWriteError } = syncHtmlWrite(result.config);
    broadcastChange({
      config: result.config,
      version,
      actor,
      origin,
      note,
      ops: result.resolvedOps,
      touchedIds: result.touchedIds,
      preset: page.preset,
    });
    res.json({
      version,
      results: result.results,
      touchedIds: result.touchedIds,
      htmlWriteError,
      review: reviewPage(),
    });
  });

  app.get("/page/requests", (req, res) => {
    const status = req.query.status === "open" || req.query.status === "done" ? req.query.status : undefined;
    res.json({ requests: listRequests({ status }) });
  });

  app.post("/page/requests", (req, res) => {
    const { text, elementId } = req.body ?? {};
    if (typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "text is required" });
    }
    if (elementId != null && typeof elementId !== "string") {
      return res.status(400).json({ error: "elementId must be a string" });
    }
    const request = createRequest(text.trim().slice(0, 2000), elementId ?? null);
    send({ type: "request", request });
    res.status(201).json({ request });
  });

  app.patch("/page/requests/:id", (req, res) => {
    const { reply, status } = req.body ?? {};
    if (reply != null && typeof reply !== "string") return res.status(400).json({ error: "reply must be a string" });
    if (status != null && status !== "open" && status !== "done") {
      return res.status(400).json({ error: 'status must be "open" or "done"' });
    }
    try {
      const request = updateRequest(req.params.id, { reply: reply?.slice(0, 2000), status });
      send({ type: "request", request });
      res.json({ request });
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  });
}
