# Sprint paper

Implement whenever (later today / tomorrow). This file is the cut. Do not start Phase 14 from here.

## Status

Phases 1–13 chrome exists: inspector, layers, snapshots, `configToHtml`, write-back to `sourcePath`. That is editor chrome on a React canvas, not a finished overlay on the real HTML pages.

**Not done:** overlay-on-real-HTML. **Not done:** mobile / tablet / desktop. Phase 14 in [SPEC.md](SPEC.md) is a draft, not this sprint.

Last push ~2026-08-22.

## Cause

Not “the overlay fights the document.” The layout rule is the bug.

`(0,0)` = flow. Any offset → `absolute` + `translate`. First drag pulls the node out of flow → siblings reflow → Moveable handles miss. Nested transforms + inspector gutters. `configToHtml` = one static layout, no `@media`. Phase 13 ≠ responsive.

Hybrid model (still true, still the trap): flow + `transform: translate` + optional absolute. Overlay is `react-moveable`. Write-back is static HTML (`configToHtml` → `sourcePath`, e.g. `client/public/pages/demo.html`). Polishing handles will not make that responsive. The first-pixel reflow is why the controls feel buggy.

## Before Phase 14 (acceptance, not optional)

Do not open a breakpoint schema until all of these are true:

- one origin
- no sibling reflow on drag
- nested `rootContainer`
- write-back = f(JSON) only
- `marketplace.html` roundtrip golden

If a handle still lies after save + reload, stop.

## This sprint (stabilize — do not skip, do not start 14)

1. **Reproduce the 6 bugs** on the real write-back pages (`demo.html`, `marketplace.html`).
2. **Kill first-pixel reflow.** First drag must not pull a node out of flow and shove siblings.
3. **Overlay follows nest / scroll / z.** Nested frames, scroll, inspector gutters — if a handle lies, stop.
4. **JSON → HTML → reload = same boxes.** Write-back is a function of JSON only.

**Done this sprint:** handles sit on the box on `demo.html` after save + reload. Overlay does not lie. No breakpoint schema this sprint. Do not claim Phase 14.

## Kill this sprint

- Phase 14 (breakpoint model, canvas width switcher, preview slices)
- Flex / auto-layout
- Scrollbar chrome
- Extra Figma fields (typography chips, per-side padding, fills)
- More inspector chrome, snapshots, asset manager polish
- Packaging (17), AI MCP (18)
- Three separate mobile / tablet / desktop page files
- A coming-soon 02 tile until a live peek exists

## 02

EditLayer is the Creative-Portfolio **02** design object. Desk peek only when the editor actually runs.

## Later — Phase 14 (after the golden, not this sprint)

Only after the acceptance list above. Full draft stays in [SPEC.md](SPEC.md#phase-14--responsive-breakpoints--draft). Do not start 14 as the first work in this paper.

1. **Slice A — preview only.** Breakpoint model in JSON (base + override map). Canvas width switcher. Inspector edits the active breakpoint.
2. **Slice B — HTML write-back that changes at those widths.** Not three separate pages. Not a screenshot. Same file, real `@media` (or equivalent) from the JSON.

Do not claim 14 done until slice B. This sprint does not include A or B.
