# Overlay sprint QA

## Automated

```bash
npm test
```

`npm test` runs `shared/overlay/overlay.test.js` plus `client/src/*.test.js` and `lockMount.test.jsx` (jsdom/React mount goldens for group/ungroup/align/toggleLock, inspector X/Y, layers rename/hide). Overlay goldens:

- A/B/C policy (handles, first-pixel, pin measure, refuse flow drag)
- demo heading first-pixel write-back is **not** `position:absolute`
- marketplace card nudge stays legacy absolute
- `groupMoveableRoot` shared parent vs `.page`
- demo + marketplace `configToHtml` goldens
- same drag writes three different HTML shapes
- default overlay is A; A is not C relabeled
- flex/grid nest is not emit-able (explicit FAIL vs real-HTML-done)
- B pin frame has no paint; C flow nodes refuse handles (style-only chrome)

## Co-worker quality gate

With the server on `:3001` and Vite on `:5173`:

```bash
npm run check     # every preset: review score, HTML sync, real-browser layout; exit 1 on fail
for f in scenarios/*.json; do node scripts/coworker.mjs scenario "$f"; done
```

Last run: demo **100**, marketplace **100**, and all three scenarios **PASS**. `npm test` 78/78.
The first runs found problems that are now fixed:

- Inserted elements lost their type defaults (button fill, link ink, frame border)
- Marketplace contrast (badge, footer) failed WCAG
- Install buttons had no href
- Cards covered the "Featured tools" label by 21px and ignored the 24px page padding
- Link buttons rendered underlined

Known debt (not gated): every heading renders as `<h1>`, and there's no heading level field.

## Live editor (script)

With server on `:3001` and Vite on `:5173`:

```bash
node scripts/overlay-qa.mjs
```

Exercises `?overlay=A|B|C` on Demo and MCP Marketplace with asserted counts:
copy/cut/paste/duplicate, move, resize (demo + marketplace cards), inspector
color in JSON, save → reload JSON === written HTML. Also first-pixel, B spacer,
hug after nudge, first-drag persist model. Flex/grid nest is FAIL in COMPARE.

Last run: copy/cut/paste/duplicate **PASS** (DOM counts). Inspector `#112233`
**PASS**. Dual-persist JSON===HTML **PASS** all six cells. Marketplace card
resize **PASS** (300→336). B select pop **FAIL** (h1 width −128px — recorded).
C demo: style-only ring, 0 Moveable. Flex/grid nest **FAIL**.
Log: `/opt/cursor/artifacts/overlay-qa/results.md`.

## Manual

1. Open each URL in [COMPARE.md](COMPARE.md).
2. Edit → select the demo heading (A/B: handles; C: outline only).
3. Drag 20px: paragraph must not jump (A/B). C: no drag.
4. Marketplace: select a card — handles stay on the card through drag/scroll.
5. Save, reload, confirm boxes match the written `client/public/pages/*.html`.
