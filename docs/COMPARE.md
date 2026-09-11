# Overlay prototypes — compare, do not merge

Sprint goal: exhaust the design space for selection handles on real HTML.
**No winner is merged.** Switch with `?overlay=A|B|C` or the toolbar A/B/C chips.

This is **not** “real HTML overlay done.” Flex/grid auto-layout is Phase 14 and
is out of scope. Seeds have no flex/grid nest; if handles miss there, that is a
known limitation, not a pass.

## The three prototypes (distinct mechanisms)

| | A — Transform-only gesture | B — Select-time pin | C — Positioned-trees-only |
|---|---|---|---|
| **When the box becomes stable** | Never changes containing block. First pixel writes `transform` + `positioning:"flow"`. | **On select**, before any drag: measure a spacer (`pin`) and wrap. Inner is already absolute inside the pin. | Never. Flow text is not free-dragged. |
| **First-pixel reflow** | No — siblings stay in flow; visual translate only. | No — spacer holds the original box. | N/A for flow text (no drag). Absolute cards already out of flow. |
| **Commit / JSON** | `{ offsetX, offsetY, positioning: "flow" }` | `{ offsetX, offsetY, positioning: "pinned", pin: { width, height, marginBottom } }` | No offset write on flow nodes. Legacy `offset≠0` stays `absolute`. |
| **Write-back HTML** | `position:relative; transform:translate(...)` | `<div data-overlay-pin>` spacer + absolute inner | Unchanged for flow; absolute for existing marketplace cards |
| **Who gets handles** | Every unlocked element | Every unlocked element | Only nodes already out of flow (marketplace cards, pinned, legacy offset) |
| **Honest claim** | Drag is a visual nudge; the flow slot stays. | Drag is out-of-flow inside a reserved hole. | Editor does not pretend flow text is a free canvas. |
| **Code** | `shared/overlay/prototypeA.js` | `shared/overlay/prototypeB.js` | `shared/overlay/prototypeC.js` |

Shared persist **reader** (`resolvePlacement`) is the same so switching prototypes
does not invent a fourth layout engine. The prototypes differ in **what they write
and when**, not in three copies of `configToHtml`.

Legacy marketplace cards (`offset≠0`, no `positioning`) still render
`position:absolute` in all three so `#/marketplace` does not collapse.

## Data flow

```
?overlay=A|B|C
    → getOverlay(mode)
    → select / drag / inspector X/Y
    → prototype.patchOffset | measureSelectPin | canClaimHandles
    → JSON (offset / positioning / pin)
    → buildBoxStyle + configToHtml  (pure function of JSON)
    → demo.html / marketplace.html
```

## UX (what changes for the person)

```
User clicks A/B/C (or loads ?overlay=)
    → same page, different handle contract
A: select heading → handles → drag → text slides; paragraph does not jump up
B: select heading → spacer appears (same size) → drag → heading leaves the hole
C: select heading → outline only, no handles; inspector X/Y disabled
   select a marketplace card → handles work
```

## QA results (ran locally)

`npm test` — 18/18 pass (policy + demo/marketplace goldens + three distinct HTML shapes).

Live: server `:3001`, Vite `:5173`, `node scripts/overlay-qa.mjs` (Playwright + system Chrome).

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

C on flow heading: outline only, inspector X/Y disabled. C on marketplace card (layers / container): handles work.

Seed write-back: `configToHtml(demoPageConfig)` matches `client/public/pages/demo.html`. Marketplace seed still emits parent-origin `absolute` cards.

Evidence: `/opt/cursor/artifacts/overlay-qa/` (per-mode screenshots + `results.md`).

See [QA.md](QA.md).

## Limitations (do not call this “real HTML done”)

- No flex/grid nest in `demo.html` / `marketplace.html`. Transform-only and pin
  both **lie** if a parent is `display:flex` / `grid` and you later promote to
  absolute. C is the only prototype that refuses that lie on flow text.
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
