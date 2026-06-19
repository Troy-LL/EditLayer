import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = resolve(join(__dirname, ".."));

export const PRESET_SOURCE_PATHS = {
  demo: "client/public/pages/demo.html",
  marketplace: "client/public/pages/marketplace.html",
};

export function resolveSourcePath(relativePath) {
  if (!relativePath || typeof relativePath !== "string") {
    throw new Error("sourcePath is required");
  }
  const resolved = resolve(PROJECT_ROOT, relativePath);
  const root = resolve(PROJECT_ROOT);
  if (resolved !== root && !resolved.startsWith(root + sep)) {
    throw new Error("Path outside project root");
  }
  return resolved;
}

export function writeHtmlToSourcePath(relativePath, html) {
  const absolutePath = resolveSourcePath(relativePath);
  const dir = dirname(absolutePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(absolutePath, html, "utf8");
  return absolutePath;
}
