export const PAGE_PRESETS = [
  { id: "demo", label: "Demo", hash: "#/demo" },
  { id: "marketplace", label: "MCP Marketplace", hash: "#/marketplace" },
];

export function presetFromHash(hash = window.location.hash) {
  if (hash === "#/marketplace") return "marketplace";
  return "demo";
}

export function hashForPreset(presetId) {
  return presetId === "marketplace" ? "#/marketplace" : "#/demo";
}
