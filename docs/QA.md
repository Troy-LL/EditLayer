# Overlay sprint QA

## Automated

```bash
npm test
```

`shared/overlay/overlay.test.js` — policy + goldens:

- A/B/C policy (handles, first-pixel, pin measure, refuse flow drag)
- demo heading first-pixel write-back is **not** `position:absolute`
- marketplace card nudge stays legacy absolute
- `groupMoveableRoot` shared parent vs `.page`
- demo + marketplace `configToHtml` goldens
- same drag writes three different HTML shapes

## Live editor (script)

With server on `:3001` and Vite on `:5173`:

```bash
node scripts/overlay-qa.mjs
```

Exercises `?overlay=A|B|C` on Demo and MCP Marketplace: select, drag, resize
(E/W + corner), inspector, clipboard (Ctrl+C/V/D), group select, first-pixel
sibling check, select → nudge → save → reload hug, and JSON → HTML write-back.

Last run: **all recorded checks PASS**, including `hug-after-reload` (≤1px on
demo heading A/B and marketplace cards A/B/C). C flow-text cells are n/a by design.
Log: `/opt/cursor/artifacts/overlay-qa/results.md`.

## Manual

1. Open each URL in [COMPARE.md](COMPARE.md).
2. Edit → select the demo heading (A/B: handles; C: outline only).
3. Drag 20px: paragraph must not jump (A/B). C: no drag.
4. Marketplace: select a card — handles stay on the card through drag/scroll.
5. Save, reload, confirm boxes match the written `client/public/pages/*.html`.
