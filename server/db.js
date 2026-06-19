import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PRESETS } from "../seeds/index.js";
import { demoPageConfig } from "../seeds/demo.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new DatabaseSync(join(__dirname, "data.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS page (
    id         INTEGER PRIMARY KEY CHECK (id = 1),
    config     TEXT NOT NULL,
    preset     TEXT NOT NULL DEFAULT 'demo',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

try {
  db.exec(`ALTER TABLE page ADD COLUMN preset TEXT NOT NULL DEFAULT 'demo'`);
} catch {
  // Column already exists.
}

const existing = db.prepare("SELECT id FROM page WHERE id = 1").get();
if (!existing) {
  db.prepare("INSERT INTO page (id, config, preset) VALUES (1, ?, ?)").run(
    JSON.stringify(demoPageConfig),
    "demo"
  );
}

export function getPage() {
  const row = db
    .prepare("SELECT config, preset, updated_at FROM page WHERE id = 1")
    .get();
  return {
    config: JSON.parse(row.config),
    preset: row.preset ?? "demo",
    updated_at: row.updated_at,
  };
}

export function savePage(config) {
  const updated_at = new Date().toISOString();
  db.prepare(
    "UPDATE page SET config = ?, updated_at = ? WHERE id = 1"
  ).run(JSON.stringify(config), updated_at);
  return { updated_at };
}

export function loadPreset(presetName) {
  const preset = PRESETS[presetName];
  if (!preset) {
    throw new Error(`Unknown preset: ${presetName}`);
  }

  const updated_at = new Date().toISOString();
  db.prepare(
    "UPDATE page SET config = ?, preset = ?, updated_at = ? WHERE id = 1"
  ).run(JSON.stringify(preset.config), presetName, updated_at);

  return {
    config: preset.config,
    preset: presetName,
    updated_at,
  };
}
