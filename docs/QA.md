# Overlay sprint QA

## Automated

```bash
npm test
```

`shared/overlay/overlay.test.js` — 18 tests:

- A/B/C policy (handles, first-pixel, pin measure, refuse flow drag)
- demo + marketplace `configToHtml` goldens
- same drag writes three different HTML shapes

## Live editor (script)

With server on `:3001` and Vite on `:5173`:

```bash
node scripts/overlay-qa.mjs
```

Exercises `?overlay=A|B|C` on Demo and MCP Marketplace: select, drag, resize,
inspector text, clipboard, group select, first-pixel sibling check, and
JSON → HTML write-back equality.

## Manual

1. Open each URL in [COMPARE.md](COMPARE.md).
2. Edit → select the demo heading (A/B: handles; C: outline only).
3. Drag 20px: paragraph must not jump (A/B). C: no drag.
4. Marketplace: select a card — handles stay on the card through drag/scroll.
5. Save, reload, confirm boxes match the written `client/public/pages/*.html`.
