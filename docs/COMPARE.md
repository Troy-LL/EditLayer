# Overlay prototypes — compare, do not merge

Do not pick a winner. Do not merge as done. Not Phase 14.

| Role | Prototype |
|---|---|
| **Default / Wednesday candidate** | **A** — transform-only + `positioning:"flow"`. Flex/grid nest is **FAIL**. Not real-HTML-done. |
| **Comparison only** | **B** — select-time spacer. Do not lead with it. Select pop / spacer shift = **FAIL**. |
| **Product-shrink only** | **C** — positioned-trees-only. Wins only if README/SPEC drop “any React page / real HTML”. They do not. Do not ship A labeled as C. |

Switch: `?overlay=A\|B\|C` or toolbar chips. Missing query → **A**.

| Gesture / persist | A | B | C |
|---|---|---|---|
| Gesture | Transform only | Select wrap + pin, then transform | No free-drag on flow; handles only if already out of flow |
| First drag | `{ positioning:"flow", offsetX, offsetY }` — not Phase 6 “absolute+translate done” | `{ positioning:"pinned", pin, offset }` | No offset write on flow h1/p |
| Write-back HTML | `position:relative; transform` | `<div data-overlay-pin>` + absolute inner | Flow unchanged; cards stay legacy absolute |
| Handles | Every unlocked node | Every unlocked node | Out-of-flow only; flow = style-only ring |
| Flex/grid nest | **FAIL** | **FAIL** | **FAIL** (product has not shrunk) |
| Group resize | `resizable={false}` (policy) | same | n/a on flow pair |
| Container resize ≠ move children | Documented policy | same | same |
| Merge as done? | No | No | No |
| Code | `shared/overlay/prototypeA.js` | `shared/overlay/prototypeB.js` | `shared/overlay/prototypeC.js` |

Shared persist reader: `resolvePlacement`. Legacy `offset≠0` without `positioning` stays absolute (marketplace cards).

| Chrome (editor = write-back) | demo | marketplace |
|---|---|---|
| Source | `shared/overlay/pageChrome.js` | same |
| Pad / max-width | `48px 24px` / `720px` | `48px 24px` / `1040px` |
| Extra | — | gradient + `min-height:640px` |

| Bento grind (all modes) | Status |
|---|---|
| `cloneForPaste` recursive (grandchildren re-id) | Done — `elementClipboard.test.js` |
| Lock inherits ancestor (`canMutate`) — blocks cut/delete/copy/layers reorder | Done — `elementTree.test.js` |
| Paste into selected frame; duplicate multi-select | Done |
| Atomic paste snapshot (no 0,0 then async history race) | Done — `computeAtomicPasteOffsets` |
| Client goldens | `client/src/*.test.js` + overlay goldens |

| Check | A demo | A market | B demo | B market | C demo | C market |
|---|---|---|---|---|---|---|
| move (single) | | | | | n/a flow | card |
| move (nested child) | — | | — | | — | C: no handles |
| resize E/W | | | | | n/a flow | card |
| resize corners | | | | | n/a flow | card |
| copy / cut / paste / duplicate | | | | | | |
| inspector (color #112233 in JSON) | | | | | | |
| persist: save → reload → JSON === HTML file | | | | | | |
| first-pixel siblings | | — | | — | n/a | — |
| first-drag persist model | flow | card not flow | not absolute | card not flow | n/a | card not flow |
| group select drag | | — | | — | n/a | — |
| hug after nudge → save → reload | | | | | n/a | card |
| select-time spacer shift | | — | | — | n/a | — |
| flex/grid nest | **FAIL** | **FAIL** | **FAIL** | **FAIL** | **FAIL** | **FAIL** |
| mouseup neighbor shove | | — | | — | n/a | — |
| B pin invisible | n/a | — | | — | n/a | — |
| B select pop | n/a | — | **FAIL** (recorded) | — | n/a | — |
| C style-only ring | n/a | — | n/a | — | | n/a |

Live: `npm test` then server `:3001`, Vite `:5173`, `node scripts/overlay-qa.mjs`. Empty cells filled from that run.

```
http://localhost:5173/?overlay=A#/demo
http://localhost:5173/?overlay=B#/demo
http://localhost:5173/?overlay=C#/marketplace
```
