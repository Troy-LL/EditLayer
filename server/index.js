import express from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PRESETS } from "../seeds/index.js";
import { getPage, loadPreset, savePage } from "./db.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const assetsDir = join(__dirname, "assets");
if (!existsSync(assetsDir)) mkdirSync(assetsDir);

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/page", (req, res) => {
  res.json(getPage());
});

app.put("/page", (req, res) => {
  const { config } = req.body;
  if (!config || typeof config !== "object" || !Array.isArray(config.elements)) {
    return res
      .status(400)
      .json({ error: "config is required and must be an object with elements[]" });
  }
  res.json(savePage(config));
});

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
    res.json(loadPreset(preset));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
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

app.use("/assets", express.static(assetsDir));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
