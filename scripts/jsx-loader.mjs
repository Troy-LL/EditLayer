import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(new URL("../client/package.json", import.meta.url));
const { transform } = require("esbuild");

export async function load(url, context, nextLoad) {
  if (!url.endsWith(".jsx")) return nextLoad(url, context);
  const source = await readFile(fileURLToPath(url), "utf8");
  const result = await transform(source, {
    loader: "jsx",
    jsx: "automatic",
    format: "esm",
    sourcefile: url,
  });
  return { format: "module", source: result.code, shortCircuit: true };
}
