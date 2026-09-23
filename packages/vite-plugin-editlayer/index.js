import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stampSource } from "./stamp.js";
import { applyEdit, resolveSource, readFileUtf8, writeFileUtf8 } from "./apply.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OVERLAY_PATH = path.join(__dirname, "../overlay/overlay.js");

const STAMP_EXTS = new Set([".jsx", ".tsx"]);
const MAYBE_EXTS = new Set([".js", ".ts"]);

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

const LOOPBACK_HOST = /^(localhost|[\w-]+\.localhost|127(\.\d{1,3}){3}|\[::1\])(:\d+)?$/;

/** These endpoints write source files: loopback only (blocks DNS rebinding), same-origin only. */
function checkOrigin(req, res) {
  if (!LOOPBACK_HOST.test(req.headers.host ?? "")) {
    json(res, 403, { error: "EditLayer endpoints only answer on localhost" });
    return false;
  }
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const host = new URL(origin).host;
    const reqHost = req.headers.host;
    if (host !== reqHost) {
      res.statusCode = 403;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "forbidden origin" }));
      return false;
    }
  } catch {
    res.statusCode = 403;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "forbidden origin" }));
    return false;
  }
  return true;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

/** List before `@vitejs/plugin-react` so stamping runs on raw JSX (disk line:column). */
export default function editlayer(options = {}) {
  const api = options.api ?? "http://localhost:3001";
  const briefName = options.brief ?? "editlayer.brief.md";
  let root = process.cwd();
  const undoStack = [];

  return {
    name: "editlayer",
    enforce: "pre",
    apply: "serve",

    configResolved(config) {
      root = config.root;
      const names = config.plugins.map((p) => p.name);
      const react = names.findIndex((n) => n.startsWith("vite:react"));
      if (react !== -1 && react < names.indexOf("editlayer")) {
        config.logger.warn("[editlayer] list editlayer() before react() in plugins, or source locations will be wrong.");
      }
    },

    transform(code, id) {
      const cleanId = id.split("?")[0];
      if (!cleanId.startsWith(root)) return null;
      if (cleanId.includes("node_modules")) return null;

      const ext = path.extname(cleanId).toLowerCase();
      if (!STAMP_EXTS.has(ext) && !MAYBE_EXTS.has(ext)) return null;
      if (MAYBE_EXTS.has(ext) && !code.includes("<")) return null;

      const rel = path.relative(root, cleanId).split(path.sep).join("/");
      const stamped = stampSource(code, { file: rel });
      if (stamped === null) return null;
      return { code: stamped, map: null };
    },

    transformIndexHtml(html) {
      const tag = `<script type="module" src="/__editlayer/overlay.js" data-api="${api}" data-apply="true"></script>`;
      if (html.includes("</body>")) {
        return html.replace("</body>", `  ${tag}\n</body>`);
      }
      return html + tag;
    },

    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/__editlayer/")) return next();
        if (!checkOrigin(req, res)) return;

        const url = new URL(req.url, "http://localhost");

        if (url.pathname === "/__editlayer/overlay.js" && req.method === "GET") {
          if (!fs.existsSync(OVERLAY_PATH)) {
            res.statusCode = 404;
            res.end("overlay not found");
            return;
          }
          res.setHeader("Content-Type", "application/javascript");
          fs.createReadStream(OVERLAY_PATH).pipe(res);
          return;
        }

        if (url.pathname === "/__editlayer/apply" && req.method === "POST") {
          try {
            const raw = await readBody(req);
            const body = JSON.parse(raw || "{}");
            if (!body.source || typeof body.source !== "string") {
              json(res, 400, { error: "invalid source" });
              return;
            }
            const { file, line, column, absPath } = resolveSource(root, body.source);
            const before = readFileUtf8(absPath);
            const { code: after, summary } = applyEdit(
              before,
              { line, column },
              { style: body.style, text: body.text },
              { file },
            );
            writeFileUtf8(absPath, after);
            undoStack.push({ file, absPath, before, after });
            if (undoStack.length > 50) undoStack.shift();
            json(res, 200, {
              ok: true,
              file,
              summary,
              undoDepth: undoStack.length,
            });
          } catch (e) {
            const status = e.status ?? 500;
            json(res, status, { error: e.message ?? "error" });
          }
          return;
        }

        if (url.pathname === "/__editlayer/undo" && req.method === "POST") {
          const entry = undoStack.pop();
          if (!entry) {
            json(res, 409, { error: "nothing to undo" });
            return;
          }
          const current = readFileUtf8(entry.absPath);
          if (current !== entry.after) {
            undoStack.push(entry);
            json(res, 409, { error: "file changed since apply" });
            return;
          }
          writeFileUtf8(entry.absPath, entry.before);
          json(res, 200, { ok: true, file: entry.file, undoDepth: undoStack.length });
          return;
        }

        if (url.pathname === "/__editlayer/brief" && req.method === "GET") {
          const briefPath = path.join(root, briefName);
          let text = "";
          if (fs.existsSync(briefPath)) {
            text = fs.readFileSync(briefPath, "utf8");
          }
          json(res, 200, { path: briefName, text });
          return;
        }

        if (url.pathname === "/__editlayer/brief" && req.method === "PUT") {
          try {
            const raw = await readBody(req);
            const body = JSON.parse(raw || "{}");
            if (typeof body.text !== "string") {
              json(res, 400, { error: "text must be a string" });
              return;
            }
            if (body.text.length > 20000) {
              json(res, 400, { error: "text too long" });
              return;
            }
            const briefPath = path.join(root, briefName);
            fs.writeFileSync(briefPath, body.text, "utf8");
            json(res, 200, { ok: true });
          } catch {
            json(res, 400, { error: "invalid body" });
          }
          return;
        }

        next();
      });
    },
  };
}
