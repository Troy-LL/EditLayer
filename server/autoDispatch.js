import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PATH = join(ROOT, ".editlayer", "auto-dispatch.json");

export function markRequestQueued(request) {
  mkdirSync(dirname(PATH), { recursive: true });
  writeFileSync(
    PATH,
    JSON.stringify(
      {
        requestId: request.id,
        text: request.text,
        elementId: request.elementId ?? null,
        target: request.target ?? null,
        intent: request.intent ?? null,
        createdAt: request.created_at,
        needsPickup: true,
      },
      null,
      2
    )
  );
}

export function clearQueuedRequest(id) {
  if (!existsSync(PATH)) return;
  try {
    const data = JSON.parse(readFileSync(PATH, "utf8"));
    if (!id || data.requestId === id) unlinkSync(PATH);
  } catch {
    // leave file if unreadable; next queue overwrite will refresh it
  }
}

export function readQueuedRequest() {
  if (!existsSync(PATH)) return null;
  try {
    return JSON.parse(readFileSync(PATH, "utf8"));
  } catch {
    return null;
  }
}
