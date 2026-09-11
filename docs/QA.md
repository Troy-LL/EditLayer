# Overlay sprint QA

## Automated

```bash
npm test
```

`npm test` runs `shared/overlay/overlay.test.js` plus `client/src/*.test.js` (clone, lock inherit, paste parent, atomic offsets). Overlay goldens:

- A/B/C policy (handles, first-pixel, pin measure, refuse flow drag)
- demo heading first-pixel write-back is **not** `position:absolute`
- marketplace card nudge stays legacy absolute
- `groupMoveableRoot` shared parent vs `.page`
- demo + marketplace `configToHtml` goldens
- same drag writes three different HTML shapes
- default overlay is A; A is not C relabeled
- flex/grid nest is not emit-able (explicit FAIL vs real-HTML-done)
- B pin frame has no paint; C flow nodes refuse handles (style-only chrome)

## Live editor (script)

With server on `:3001` and Vite on `:5173`:

```bash
node scripts/overlay-qa.mjs
```

Exercises `?overlay=A|B|C` on Demo and MCP Marketplace with asserted counts:
copy/cut/paste/duplicate, move, resize (demo + marketplace cards), inspector
color in JSON, save → reload JSON === written HTML. Also first-pixel, B spacer,
hug after nudge, first-drag persist model. Flex/grid nest is FAIL in COMPARE.

Last run: A mouseup neighbor shove **PASS** (0px). B pin paint **PASS**; B select
pop **FAIL** (flow h1 width shrinks ~128px when the spacer wraps — recorded, not
fixed). C demo flow heading: style-only ring, **0** Moveable handles.
Flex/grid nest stays **FAIL**. Log: `/opt/cursor/artifacts/overlay-qa/results.md`.

## Manual

1. Open each URL in [COMPARE.md](COMPARE.md).
2. Edit → select the demo heading (A/B: handles; C: outline only).
3. Drag 20px: paragraph must not jump (A/B). C: no drag.
4. Marketplace: select a card — handles stay on the card through drag/scroll.
5. Save, reload, confirm boxes match the written `client/public/pages/*.html`.
