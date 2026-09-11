# Overlay prototypes — compare, do not merge

Do not pick a winner. Do not merge as done. Not Phase 14.

| Role | Prototype |
|---|---|
| **Default / Wednesday candidate** | **A** — transform-only + `positioning:"flow"`. Flex/grid nest is **FAIL**. Not real-HTML-done. |
| **Comparison only** | **B** — select-time spacer. Do not lead with it. Select pop = **FAIL**. |
| **Product-shrink only** | **C** — positioned-trees-only. Wins only if README/SPEC drop “any React page / real HTML”. They do not. Do not ship A labeled as C. |

Switch: `?overlay=A|B|C` or toolbar chips. Missing query → **A**.

| Gesture / persist | A | B | C |
|---|---|---|---|
| Gesture | Transform only | Select wrap + pin, then transform | No free-drag on flow; handles only if already out of flow |
| First drag | `{ positioning:"flow", offset }` — not Phase 6 “absolute+translate done” | `{ positioning:"pinned", pin, offset }` | No offset write on flow h1/p |
| Write-back HTML | `position:relative; transform` | `<div data-overlay-pin>` + absolute inner | Flow unchanged; cards stay legacy absolute |
| Handles | Every unlocked node | Every unlocked node | Out-of-flow only; flow = style-only ring |
| Flex/grid nest | **FAIL** | **FAIL** | **FAIL** (product has not shrunk) |
| Group resize | `resizable={false}` (policy) | same | n/a on flow pair |
| Container resize ≠ move children | Documented policy | same | same |
| Merge as done? | No | No | No |
| Code | `shared/overlay/prototypeA.js` | `shared/overlay/prototypeB.js` | `shared/overlay/prototypeC.js` |

Shared persist reader: `resolvePlacement`. Legacy `offset≠0` without `positioning` stays absolute.

| Chrome (editor = write-back) | demo | marketplace |
|---|---|---|
| Source | `shared/overlay/pageChrome.js` | same |
| Pad / max-width | `48px 24px` / `720px` | `48px 24px` / `1040px` |
| Extra | — | gradient + `min-height:640px` |

| Bento (this PR’s grind — not ignored) | Status |
|---|---|
| 1. First-drag absolute+translate | **A/B/C question, not Phase 6 done.** A writes `positioning:"flow"` + translate (live PASS). B writes `pinned` (PASS). C writes no flow offset (n/a). A first-drag to `absolute` would be an A **FAIL**. |
| 2. JSON→HTML→reload box mismatch | **PASS** — `pageChrome.js` is the only pad/max-width/gradient. Dual-persist golden PASS all 6 live cells. |
| 3. `cloneForPaste` grandchildren keep ids | **PASS** — recursive `assignNewIds`. `elementClipboard.test.js`. |
| 4. Lock must block cut/delete/copy/reorder | **PASS** — `canMutate` inherits ancestor lock for cut/copy/delete/reorder **and** canvas select/drag/group (`canCanvasGesture`). Test: locked ancestor blocks drag/select on child. |
| 5. Paste into selected frame; multi-select duplicate | **PASS** — `resolvePasteParent` + `handleDuplicate` on the full selection. Tree assert: clone lands under the frame. Multi-dup assert: every selected root is cloned. |
| 6. Placement job races history | **PARTIAL** — `computeAtomicPasteOffsets` unit math + one `history.push` in paste/dup handlers. No test that paste is a single history snapshot. |
| 7. Minimal goldens (not zero client tests) | **PASS** — `client/src/*.test.js` + overlay goldens. `npm test` 42. |
| Group no-resize | Policy — `resizable={false}` |
| Container resize ≠ move children | Documented, not a silent bug |

Live: `npm test`; server `:3001`; Vite `:5173`; `node scripts/overlay-qa.mjs`. Log: `/opt/cursor/artifacts/overlay-qa/results.md`.

| Check | A demo | A market | B demo | B market | C demo | C market |
|---|---|---|---|---|---|---|
| move (single) | PASS | PASS | PASS | PASS | n/a flow | PASS card |
| move (nested child) | — | PASS | — | PASS | — | PASS (0 handles) |
| resize E/W | PASS | PASS (300→336) | PASS | PASS (300→336) | n/a flow | PASS (300→336) |
| resize corners | PASS | PASS | PASS | PASS | n/a flow | PASS |
| copy / cut / paste / duplicate | PASS (2→3→4→3→4) | PASS (18→19→20→19→20) | PASS (2→3→4→3→4) | PASS (18→19→20→19→20) | PASS (2→3→4→3→4) | PASS (18→19→20→19→20) |
| inspector (color `#112233` in JSON) | PASS | PASS | PASS | PASS | PASS | PASS |
| persist: save → reload → JSON === HTML file | PASS | PASS | PASS | PASS | PASS | PASS |
| first-pixel siblings | PASS (0px) | — | PASS (0px) | — | n/a | — |
| first-drag persist model | PASS `flow` | PASS legacy card | PASS `pinned` | PASS legacy card | n/a | PASS legacy card |
| group select drag | PASS | — | PASS | — | n/a | — |
| hug after nudge → save → reload | PASS (≤1px, `flow` 20,10) | PASS (≤1px, card) | PASS (≤1px) | PASS (≤1px, card) | n/a | PASS (≤1px, card) |
| select-time spacer shift | PASS (0px) | — | PASS (0px) | — | n/a | — |
| flex/grid nest | **FAIL** | **FAIL** | **FAIL** | **FAIL** | **FAIL** | **FAIL** |
| mouseup neighbor shove | PASS (0px) | — | PASS (0px) | — | n/a | — |
| B pin invisible | n/a | — | PASS | — | n/a | — |
| B select pop | n/a | — | **FAIL** (h1 width −128px; origin held) | — | n/a | — |
| C style-only ring | n/a | — | n/a | — | PASS (0 Moveable) | n/a |

```
http://localhost:5173/?overlay=A#/demo
http://localhost:5173/?overlay=B#/demo
http://localhost:5173/?overlay=C#/marketplace
```
