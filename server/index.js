import express from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { PRESETS } from "../seeds/index.js";
import { configToHtml } from "./configToHtml.js";
import {
  createSnapshot,
  deleteSnapshot,
  getPage,
  getSnapshot,
  getSourcePath,
  listSnapshots,
  loadPreset,
  restoreSnapshot,
  savePage,
} from "./db.js";
import { writeHtmlToSourcePath } from "./pathUtils.js";
import { broadcastChange, registerCoworkerRoutes, validationError } from "./coworker.js";
import { createProjectOverlay } from "./projectOverlay.js";
import { createUndoStore } from "../packages/vite-plugin-editlayer/undoStore.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const assetsDir = join(__dirname, "assets");
if (!existsSync(assetsDir)) mkdirSync(assetsDir);

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"]);

function syncHtmlWrite(config) {
  const sourcePath = getSourcePath();
  if (!sourcePath) return { htmlWriteError: null };
  try {
    const { preset } = getPage();
    const html = configToHtml(config, { preset });
    writeHtmlToSourcePath(sourcePath, html);
    return { htmlWriteError: null };
  } catch (err) {
    return { htmlWriteError: err.message ?? "HTML write failed" };
  }
}

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/page", (req, res) => {
  res.json(getPage());
});

app.put("/page", (req, res) => {
  const { config, origin, actor } = req.body;
  if (!config || typeof config !== "object" || !Array.isArray(config.elements)) {
    return res
      .status(400)
      .json({ error: "config is required and must be an object with elements[]" });
  }
  const invalid = validationError(config);
  if (invalid) {
    return res.status(400).json({ error: `invalid config: ${invalid.join("; ")}`, errors: invalid });
  }
  const result = savePage(config);
  const { htmlWriteError } = syncHtmlWrite(config);
  broadcastChange({ config, version: result.version, actor, origin, preset: getPage().preset });
  res.json({ ...result, htmlWriteError });
});

registerCoworkerRoutes(app, { syncHtmlWrite });

const repoRoot = join(__dirname, "..");
app.get("/onboarding.js", (_req, res) => {
  const onboardingPath = join(repoRoot, "packages/overlay/onboarding.js");
  if (!existsSync(onboardingPath)) {
    return res.status(404).json({ error: "onboarding.js not found" });
  }
  res.type("text/javascript").send(readFileSync(onboardingPath, "utf8"));
});

app.get("/overlay.js", (_req, res) => {
  const overlayPath = join(repoRoot, "packages/overlay/overlay.js");
  if (!existsSync(overlayPath)) {
    return res.status(404).json({ error: "overlay.js not found" });
  }
  res.type("text/javascript").send(readFileSync(overlayPath, "utf8"));
});

const LOOPBACK_HOST = /^(localhost|[\w-]+\.localhost|127(\.\d{1,3}){3}|\[::1\])(:\d+)?$/;
const projectRoot = process.env.EDITLAYER_PROJECT_ROOT || join(repoRoot, "examples/storefront");
const projectFiles = createProjectOverlay({
  root: projectRoot,
  undo: createUndoStore(projectRoot),
});

function loopbackOrigin(origin) {
  if (!origin) return true;
  try {
    const host = new URL(origin).hostname;
    return /^(localhost|[\w-]+\.localhost|127(\.\d{1,3}){3}|::1)$/.test(host);
  } catch {
    return false;
  }
}

function projectFileRoute(handler) {
  return (req, res) => {
    if (!LOOPBACK_HOST.test(req.headers.host ?? "")) {
      return res.status(403).json({ error: "EditLayer endpoints only answer on localhost" });
    }
    if (!loopbackOrigin(req.headers.origin)) {
      return res.status(403).json({ error: "forbidden origin" });
    }
    try {
      handler(req, res);
    } catch (err) {
      res.status(err.status ?? 500).json({ error: err.message ?? "error" });
    }
  };
}

app.post("/overlay/apply", projectFileRoute((_req, res) => {
  res.json(projectFiles.apply(_req.body ?? {}));
}));
app.post("/overlay/undo", projectFileRoute((_req, res) => {
  res.json(projectFiles.undoApply());
}));
app.get("/overlay/brief", projectFileRoute((_req, res) => {
  res.json({ path: "editlayer.brief.md", text: projectFiles.readBrief() });
}));
app.put("/overlay/brief", projectFileRoute((req, res) => {
  if (typeof req.body?.text === "string" && req.body.text.length > 20000) {
    return res.status(400).json({ error: "text too long" });
  }
  projectFiles.writeBrief(req.body?.text);
  res.json({ ok: true });
}));

app.get("/page/presets", (_req, res) => {
  res.json(
    Object.entries(PRESETS).map(([id, { label }]) => ({ id, label }))
  );
});

app.post("/page/preset", (req, res) => {
  const { preset } = req.body;
  if (!preset || typeof preset !== "string" || !PRESETS[preset]) {
    return res.status(400).json({ error: "Unknown or missing preset" });
  }
  try {
    const result = loadPreset(preset);
    const { htmlWriteError } = syncHtmlWrite(result.config);
    broadcastChange({ ...result, origin: req.body.origin, note: `switched to ${preset}` });
    res.json({ ...result, htmlWriteError });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/page/snapshots", (_req, res) => {
  res.json({ snapshots: listSnapshots() });
});

app.post("/page/snapshots", (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== "string") {
    return res.status(400).json({ error: "name is required" });
  }
  try {
    const page = getPage();
    const snapshot = createSnapshot(name, page.config, page.preset);
    res.status(201).json({ snapshot });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete("/page/snapshots/:id", (req, res) => {
  try {
    deleteSnapshot(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.post("/page/snapshots/:id/restore", (req, res) => {
  try {
    getSnapshot(req.params.id);
    const result = restoreSnapshot(req.params.id);
    const { htmlWriteError } = syncHtmlWrite(result.config);
    broadcastChange({ ...result, origin: req.body?.origin, note: "restored snapshot" });
    res.json({ ...result, htmlWriteError });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.get("/assets", (_req, res) => {
  const port = process.env.PORT || 3001;
  const files = readdirSync(assetsDir).filter((name) => {
    const ext = extname(name).toLowerCase();
    return IMAGE_EXTENSIONS.has(ext);
  });
  const assets = files.map((filename) => {
    const filePath = join(assetsDir, filename);
    const stat = statSync(filePath);
    return {
      filename,
      url: `http://localhost:${port}/assets/${filename}`,
      size: stat.size,
      mtime: stat.mtime.toISOString(),
    };
  });
  assets.sort((a, b) => b.mtime.localeCompare(a.mtime));
  res.json({ assets });
});

app.post("/assets", (req, res) => {
  const { data, mimeType } = req.body;
  if (!data || typeof data !== "string") {
    return res.status(400).json({ error: "data (base64) is required" });
  }
  if (!mimeType || !mimeType.startsWith("image/")) {
    return res.status(400).json({ error: "mimeType must be an image type" });
  }

  const extMap = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
  };
  const ext = extMap[mimeType];
  if (!ext) {
    return res.status(400).json({ error: "Unsupported image type" });
  }

  let buffer;
  try {
    buffer = Buffer.from(data, "base64");
  } catch {
    return res.status(400).json({ error: "Invalid base64 data" });
  }

  if (buffer.length > 5 * 1024 * 1024) {
    return res.status(400).json({ error: "File too large (max 5MB)" });
  }

  const filename = `${randomUUID()}.${ext}`;
  writeFileSync(join(assetsDir, filename), buffer);
  res.json({ url: `http://localhost:${process.env.PORT || 3001}/assets/${filename}` });
});

app.delete("/assets/:filename", (req, res) => {
  const { filename } = req.params;
  if (!filename || filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return res.status(400).json({ error: "Invalid filename" });
  }
  const ext = extname(filename).toLowerCase();
  if (!IMAGE_EXTENSIONS.has(ext)) {
    return res.status(400).json({ error: "Not an image file" });
  }
  const filePath = join(assetsDir, filename);
  if (!existsSync(filePath)) {
    return res.status(404).json({ error: "File not found" });
  }
  unlinkSync(filePath);
  res.json({ ok: true });
});

app.use("/assets", express.static(assetsDir));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
