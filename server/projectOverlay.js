import fs from "node:fs";
import path from "node:path";
import { resolveSource, applyEdit, readFileUtf8, writeFileUtf8 } from "../packages/vite-plugin-editlayer/apply.js";
import { applyCssDeclaration, applyToken } from "../packages/vite-plugin-editlayer/cssApply.js";
import { applyClassList } from "../packages/vite-plugin-editlayer/className.js";

function makeError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

/**
 * @param {string} root
 * @param {string} filePart
 * @returns {{ file: string, absPath: string }}
 */
export function resolveCssPath(root, filePart) {
  if (typeof filePart !== "string" || !filePart) {
    throw makeError(400, "invalid file");
  }
  if (path.isAbsolute(filePart)) throw makeError(403, "path outside project");
  const normalized = filePart.replace(/\\/g, "/");
  if (normalized.includes("..") || normalized.split("/").includes("..")) {
    throw makeError(403, "path outside project");
  }
  if (normalized.includes("node_modules")) throw makeError(403, "path outside project");
  const ext = path.extname(normalized).toLowerCase();
  if (ext !== ".css") throw makeError(400, "unsupported file type");
  const absPath = path.resolve(root, normalized);
  const relRoot = path.resolve(root);
  if (!absPath.startsWith(relRoot + path.sep) && absPath !== relRoot) {
    throw makeError(403, "path outside project");
  }
  return { file: normalized, absPath };
}

function assertBriefName(briefName) {
  if (
    typeof briefName !== "string" ||
    !briefName ||
    briefName.includes("/") ||
    briefName.includes("\\") ||
    briefName.includes("..")
  ) {
    throw makeError(400, "invalid brief name");
  }
}

function hasStyleEdit(body) {
  return body.style && typeof body.style === "object" && Object.keys(body.style).length > 0;
}

function hasTextEdit(body) {
  return body.text !== undefined;
}

function hasClassNameEdit(body) {
  if (!body.className || typeof body.className !== "object") return false;
  const add = body.className.add;
  const remove = body.className.remove;
  return (Array.isArray(add) && add.length > 0) || (Array.isArray(remove) && remove.length > 0);
}

function hasAnyEdit(body) {
  return (
    hasStyleEdit(body) ||
    hasTextEdit(body) ||
    hasClassNameEdit(body) ||
    (Array.isArray(body.css) && body.css.length > 0) ||
    (Array.isArray(body.tokens) && body.tokens.length > 0)
  );
}

function needsSource(body) {
  return hasStyleEdit(body) || hasTextEdit(body) || hasClassNameEdit(body);
}

/**
 * @param {{ root: string, undo: { push: (e: object) => void, pop: () => object | null, depth?: number }, briefName?: string }} options
 */
export function createProjectOverlay({ root, undo, briefName = "editlayer.brief.md" }) {
  assertBriefName(briefName);
  const relRoot = path.resolve(root);

  function briefPath() {
    return path.join(relRoot, briefName);
  }

  function apply(body) {
    if (!body || typeof body !== "object") {
      throw makeError(400, "nothing to apply");
    }
    if (!hasAnyEdit(body)) {
      throw makeError(400, "nothing to apply");
    }
    if (needsSource(body)) {
      if (typeof body.source !== "string" || !body.source) {
        throw makeError(400, "invalid source");
      }
    }

    /** @type {Map<string, { before: string, code: string, absPath: string, summaries: string[] }>} */
    const pending = new Map();

    const touch = (file, absPath) => {
      let entry = pending.get(file);
      if (!entry) {
        const before = readFileUtf8(absPath);
        entry = { before, code: before, absPath, summaries: [] };
        pending.set(file, entry);
      }
      return entry;
    };

    if (needsSource(body)) {
      const { file, line, column, absPath } = resolveSource(relRoot, body.source);
      const entry = touch(file, absPath);

      if (hasStyleEdit(body) || hasTextEdit(body)) {
        const edits = {};
        if (hasStyleEdit(body)) edits.style = body.style;
        if (hasTextEdit(body)) edits.text = body.text;
        const { code, summary } = applyEdit(entry.code, { line, column }, edits, { file });
        entry.code = code;
        entry.summaries.push(summary);
      }

      if (hasClassNameEdit(body)) {
        const { code, summary } = applyClassList(
          entry.code,
          { line, column },
          {
            add: body.className.add ?? [],
            remove: body.className.remove ?? [],
          },
          { file },
        );
        entry.code = code;
        entry.summaries.push(summary);
      }
    }

    for (const item of body.css ?? []) {
      const { file, absPath } = resolveCssPath(relRoot, item.file);
      const entry = touch(file, absPath);
      const { code, summary } = applyCssDeclaration(entry.code, {
        selector: item.selector,
        property: item.property,
        value: item.value,
      });
      entry.code = code;
      entry.summaries.push(summary);
    }

    for (const item of body.tokens ?? []) {
      const { file, absPath } = resolveCssPath(relRoot, item.file);
      const entry = touch(file, absPath);
      const { code, summary } = applyToken(entry.code, {
        name: item.name,
        value: item.value,
      });
      entry.code = code;
      entry.summaries.push(summary);
    }

    const summaries = [];
    const files = [];
    let pushed = 0;

    for (const [file, entry] of pending) {
      if (entry.code === entry.before) continue;
      writeFileUtf8(entry.absPath, entry.code);
      undo.push({ file, before: entry.before, after: entry.code });
      pushed++;
      files.push(file);
      summaries.push(...entry.summaries);
    }

    if (pushed === 0) {
      throw makeError(400, "nothing to apply");
    }

    const undoDepth =
      typeof undo.depth === "number" ? undo.depth : pushed;

    return {
      ok: true,
      summary: summaries.join("; "),
      files,
      undoDepth,
    };
  }

  function undoApply() {
    const entry = undo.pop();
    if (!entry) {
      throw makeError(409, "nothing to undo");
    }
    const absPath = path.join(relRoot, entry.file);
    const current = readFileUtf8(absPath);
    if (current !== entry.after) {
      undo.push(entry);
      throw makeError(409, "file changed since apply");
    }
    writeFileUtf8(absPath, entry.before);
    const undoDepth = typeof undo.depth === "number" ? undo.depth : 0;
    return { ok: true, file: entry.file, undoDepth };
  }

  function readBrief() {
    const p = briefPath();
    if (!fs.existsSync(p)) return "";
    return fs.readFileSync(p, "utf8");
  }

  function writeBrief(text) {
    if (typeof text !== "string") {
      throw makeError(400, "text must be a string");
    }
    fs.writeFileSync(briefPath(), text, "utf8");
  }

  return { apply, undoApply, readBrief, writeBrief };
}
