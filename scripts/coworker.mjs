#!/usr/bin/env node
/**
 * EditLayer co-worker CLI. Same library as the MCP server (scripts/coworker-mcp.mjs),
 * so anything a test does here an AI can do there, and vice versa.
 */
import { readFileSync } from "node:fs";
import * as lib from "./coworker/lib.mjs";

const HELP = `Usage: node scripts/coworker.mjs <command> [args]

  get [--compact]                 Page config (or id/type outline)
  contract                        Op vocabulary + fields the server accepts
  ops '<json>' | -f file [--note "why"] [--base <version>]
                                  Apply ops atomically (array or single op)
  review                          Score + findings (+ HTML sync)
  fix [--rule contrast,...]       Apply every auto-fix the review offers
  look [--out file.png]           Real-browser screenshot + layout findings
  check [--min 90] [--look]       Quality gate; exit 1 when it fails
  scenario <file.json> [--keep]   Run a scenario live, then restore the page
  requests [open|done]            Human requests (comments) on the board
  ask "<text>" [--element id]     Leave a request (as the human would)
  reply <id> "<text>" [--done]    Answer a request
  activity                        Recent changes by humans / AI / tests
  watch                           Stream live board events

Env: EDITLAYER_API (http://localhost:3001), EDITLAYER_APP (http://localhost:5173),
     COWORKER_KIND (ai|test|human), COWORKER_NAME`;

function flag(args, name) {
  const i = args.indexOf(name);
  if (i < 0) return undefined;
  const value = args[i + 1];
  args.splice(i, value === undefined || value.startsWith("--") ? 1 : 2);
  return value === undefined || value.startsWith("--") ? true : value;
}

function print(value) {
  console.log(typeof value === "string" ? value : JSON.stringify(value, null, 2));
}

function printFindings(findings) {
  for (const f of findings) {
    console.log(`  ${f.severity.padEnd(5)} ${f.rule.padEnd(15)} ${f.message}${f.fix ? "  [auto-fix]" : ""}`);
  }
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  switch (command) {
    case "get":
      return print(await lib.getPage({ compact: Boolean(flag(args, "--compact")) }));
    case "contract":
      return print(lib.describeContract());
    case "ops": {
      const file = flag(args, "-f");
      const note = flag(args, "--note");
      const base = flag(args, "--base");
      const raw = file ? readFileSync(file, "utf8") : args[0];
      if (!raw) throw new Error("ops needs a JSON argument or -f file");
      const parsed = JSON.parse(raw);
      const res = await lib.applyOps(Array.isArray(parsed) ? parsed : [parsed], {
        note: typeof note === "string" ? note : "",
        baseVersion: base ? Number(base) : undefined,
      });
      print({ version: res.version, results: res.results, touchedIds: res.touchedIds, score: res.review.score });
      return printFindings(res.review.findings);
    }
    case "review": {
      const r = await lib.review();
      console.log(`${r.preset} v${r.version}: score ${r.score} (${r.counts.error} errors, ${r.counts.warn} warnings, ${r.counts.info} info)${r.htmlInSync ? "" : " — HTML OUT OF SYNC"}`);
      return printFindings(r.findings);
    }
    case "fix": {
      const rules = flag(args, "--rule");
      const res = await lib.fix({ rules: typeof rules === "string" ? rules.split(",") : undefined });
      console.log(`applied ${res.applied} fix op(s): score ${res.before} → ${res.after}`);
      return printFindings(res.review.findings);
    }
    case "look": {
      const out = flag(args, "--out");
      const res = await lib.look(typeof out === "string" ? { out } : {});
      console.log(`${res.preset}: screenshot ${res.screenshot}, ${res.findings.length} layout finding(s)`);
      return printFindings(res.findings);
    }
    case "check": {
      const min = Number(flag(args, "--min") ?? 90);
      const res = await lib.check({ minScore: min, withLook: Boolean(flag(args, "--look")) });
      console.log(`${res.pass ? "PASS" : "FAIL"} ${res.preset}: score ${res.score} (min ${res.minScore})${res.htmlInSync ? "" : ", HTML out of sync"}${res.screenshot ? `, screenshot ${res.screenshot}` : ""}`);
      printFindings(res.findings);
      process.exitCode = res.pass ? 0 : 1;
      return;
    }
    case "scenario": {
      const keep = Boolean(flag(args, "--keep"));
      if (!args[0]) throw new Error("scenario needs a file");
      const res = await lib.runScenario(args[0], { keep });
      console.log(`${res.pass ? "PASS" : "FAIL"} ${res.name} (score ${res.score})`);
      res.steps.forEach((s) => console.log(`  ${s.ok ? "ok  " : "FAIL"} ${s.note}`));
      res.failures.forEach((f) => console.log(`  ! ${f}`));
      process.exitCode = res.pass ? 0 : 1;
      return;
    }
    case "requests": {
      const { requests } = await lib.listRequests(args[0]);
      if (!requests.length) return console.log("no requests");
      for (const r of requests) {
        console.log(`${r.status === "open" ? "●" : "✓"} ${r.id}${r.elementId ? ` @${r.elementId}` : ""}: ${r.text}${r.reply ? `\n    ↳ ${r.reply}` : ""}`);
      }
      return;
    }
    case "ask": {
      const element = flag(args, "--element");
      return print((await lib.createRequest(args[0], typeof element === "string" ? element : undefined)).request);
    }
    case "reply": {
      const done = Boolean(flag(args, "--done"));
      return print((await lib.replyRequest(args[0], { reply: args[1], done })).request);
    }
    case "activity": {
      const { activity } = await lib.activity();
      for (const a of activity) {
        console.log(`${a.at} v${a.version} ${a.actor.name} (${a.actor.kind}): ${a.summary.join("; ")}${a.note ? ` — ${a.note}` : ""}`);
      }
      return;
    }
    case "watch":
      lib.watch((e) => print(e.type === "change" ? { ...e, config: undefined } : e));
      return new Promise(() => {});
    default:
      console.log(HELP);
      process.exitCode = command ? 1 : 0;
  }
}

main().catch((err) => {
  console.error(`error: ${err.message}`);
  process.exitCode = 1;
});
