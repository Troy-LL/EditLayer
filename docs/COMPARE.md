# Overlay prototypes — compare, do not merge

Satan commit constraint: keep **A / B / C** in this PR. **Do not pick a winner.
Do not merge as done.**

| Role | Prototype |
|---|---|
| **Default / Wednesday candidate** | **A** as a **bugfix**: transform-only + explicit `positioning:"flow"` commit. **FAIL** the flex/grid nested case — do not call A real-HTML-done. |
| **Comparison only** | **B** select-time spacer. Do not lead with it. If the spacer itself shifts layout, that cell is **FAIL**. |
| **Product-shrink only** | **C** positioned-trees-only. C wins **only** if README/SPEC drop “any React page / real HTML” and say positioned-trees-only. **Do not ship A labeled as C.** |

README still says drop-in for a React app. SPEC still says a real project. Therefore **C is not the shipped story.**

Switch with `?overlay=A|B|C` or the toolbar chips (default **A**). Flex/grid auto-layout is Phase 14 and is **out of scope**. Seeds have no flex/grid nest; that absence is a **FAIL**, not a pass.

## Gesture / persist grind

| Grind | A (default / Wed candidate) | B (compare only) | C (product-shrink) |
|---|---|---|---|
| **Gesture** | Transform only (`translate` + size). Containing block does not change. | On **select**, wrap a measured spacer; inner is already absolute inside the pin; then transform. | No free-drag on flow text. Handles only if already out of flow. |
| **Persist / JSON** | `{ offsetX, offsetY, positioning: "flow" }` | `{ offsetX, offsetY, positioning: "pinned", pin }` | No offset write on flow h1/p. Legacy `offset≠0` stays absolute. |
| **Write-back HTML** | `position:relative; transform:translate(...)` | `<div data-overlay-pin>` + absolute inner | Flow unchanged; marketplace cards stay legacy absolute |
| **Select-time layout** | Must not shift siblings | **FAIL** if the spacer moves the next box | n/a (no wrap) |
| **First-pixel siblings** | Must not reflow | Spacer must hold the hole (if select did not already fail) | n/a |
| **Hug after nudge → save → reload** | Handles on the same box; still `flow` | Handles on the same box | Card only |
| **Flex/grid nest** | **FAIL** | **FAIL** | **FAIL** unless the product shrinks (README/SPEC). Not shipped. |
| **Merge as done?** | No | No | No |
| **Code** | `shared/overlay/prototypeA.js` | `shared/overlay/prototypeB.js` | `shared/overlay/prototypeC.js` |

Shared persist **reader** (`resolvePlacement`) is the same so switching prototypes
does not invent a fourth layout engine. The prototypes differ in **what they write
and when**, not in three copies of `configToHtml`.

Legacy marketplace cards (`offset≠0`, no `positioning`) still render
`position:absolute` in all three so `#/marketplace` does not collapse.

## Data flow

```
?overlay=A|B|C   (missing → A)
    → getOverlay(mode)
    → select / drag / inspector X/Y
    → prototype.patchOffset | measureSelectPin | canClaimHandles
    → JSON (offset / positioning / pin)
    → buildBoxStyle + configToHtml  (pure function of JSON)
    → demo.html / marketplace.html
```

## UX (what changes for the person)

```
Default load (no ?overlay=) → A
A: select heading → handles → drag → text slides; paragraph does not jump up
B: select heading → spacer appears → if the paragraph jumps, that is a B FAIL
C: select heading → outline only, no handles; inspector X/Y disabled
   select a marketplace card → handles work
```

## QA results (ran locally)

`npm test` — overlay policy + goldens + default-A + flex/grid nest is not emit-able
(explicit FAIL vs real-HTML-done) + three HTML shapes.

Live: server `:3001`, Vite `:5173`, `node scripts/overlay-qa.mjs`.

| Check | A demo | A market | B demo | B market | C demo | C market |
|---|---|---|---|---|---|---|
| move (single) | PASS | PASS | PASS | PASS | n/a (no handles) | PASS on card |
| move (nested child) | — | PASS | — | PASS | — | PASS (no handles, as designed) |
| resize E/W | PASS | — | PASS | — | n/a | — |
| resize corners | PASS | — | PASS | — | n/a | — |
| copy / cut / paste / duplicate | PASS | PASS | PASS | PASS | PASS | PASS |
| inspector (text, color, type fields) | PASS | PASS | PASS | PASS | PASS | PASS |
| persist: save → reload → JSON/HTML match | PASS | PASS | PASS | PASS | PASS | PASS |
| first-pixel: siblings reflow? | PASS (drift 0px) | — | PASS (drift 0px) | — | n/a | — |
| group select drag | PASS | — | PASS | — | n/a | — |
| hug after nudge → save → reload | PASS (≤1px, `positioning:flow`, offset 20,10) | PASS (≤1px, legacy card) | PASS (≤1px) | PASS (≤1px) | n/a | PASS (≤1px, card) |
| select-time spacer shifts layout? | PASS (0px, no spacer) | — | PASS (0px on demo h1/p) | — | n/a | — |
| flex/grid nest | **FAIL** | **FAIL** | **FAIL** | **FAIL** | **FAIL** | **FAIL** |

C on flow heading: outline only, inspector X/Y disabled. C on marketplace card (layers / container): handles work.

Seed write-back: `configToHtml(demoPageConfig)` matches `client/public/pages/demo.html`. Marketplace seed still emits parent-origin `absolute` cards.

Evidence: `/opt/cursor/artifacts/overlay-qa/` (per-mode screenshots + `results.md`).

See [QA.md](QA.md).

## Controls punch list (same PR, still no winner)

Satan still wins on model: **do not** promote flow nodes to `position:absolute` on select or first drag.

| P0 | Status |
|---|---|
| First-pixel: transform-only (A) or pin/reserve (B); siblings do not reflow | Done — demo h1/p |
| Golden: select → nudge → save → reload → handles hug the same box on demo **and** a marketplace card | Live `hug-after-reload` in `scripts/overlay-qa.mjs` |
| Group + single pass the same containing block as `rootContainer` | `groupMoveableRoot` + both Moveable mounts |

| P1 | Status |
|---|---|
| Control-box z from the Moveable instance | `getControlBoxElement()` |
| One transform writer during gesture | Moveable DOM; React commits on end |
| Handle hit slop (visual 10, hit 14); edit box over in-card buttons | `index.css` |
| Group `resizable={false}` documented as policy | DESIGN + this file + overlay comment |

## Limitations (do not call this “real HTML done”)

- **Flex/grid nest is FAIL** for A (and B). Write-back cannot emit a flex/grid
  containing block. A is a flow-document bugfix, not overlay-complete.
- Edit-mode inspector/layers gutters change canvas width vs the static HTML file.
  Box *identity* (JSON → HTML function) is what we golden; pixel-perfect gutter
  match is not claimed.
- Write-back does not persist leftover `element.style` from moveable — only JSON.

## How to try

```
http://localhost:5173/?overlay=A#/demo
http://localhost:5173/?overlay=B#/demo
http://localhost:5173/?overlay=C#/marketplace
```

Missing `?overlay=` loads **A**.
