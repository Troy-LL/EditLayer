/** Shared containing block for a multi-select, or the page if parents differ. */
export function groupMoveableRoot(nodes, moveableRoot) {
  if (!nodes?.length) return null;
  const roots = nodes.map((node) => moveableRoot?.(node) ?? node?.parentElement ?? null);
  const first = roots[0];
  if (first && roots.every((root) => root === first)) return first;
  return nodes[0]?.closest?.(".page") ?? first ?? null;
}
