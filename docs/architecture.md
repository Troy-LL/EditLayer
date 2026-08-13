# Architecture

See [spec.md](spec.md) for scope and phase status.

## Vision (architecture)

The editor is an **overlay shell** on the host app — not a separate route or iframe.
Toggle Edit Mode → canvas enters edit chrome → inspector mounts when an element is selected → changes apply in real time
→ auto-save persists to DB → toggle off → normal app.

Figma analogy: our `PageRenderer` is the canvas; `PropertyPanel` (becoming `InspectorPanel`)
is the right Design panel; future `LayersPanel` is the left layers tree.

## System Overview (current)

```
Browser (React)
  ├── EditorShell           # toolbar + canvas + inspector layout
  ├── Toolbar               # top bar: Edit; Undo/Redo/status/Revert/Done in edit mode
  ├── PageRenderer          # canvas: renders elements from config JSON; mounts SelectionOverlay
  ├── SelectionOverlay      # react-moveable wrapper for drag + 8-handle resize
  ├── ContextMenu           # right-click Copy / Duplicate / Paste
  ├── InspectorPanel        # right sidebar: collapsible property sections
  ├── useConfigHistory      # undo/redo stack (client-side)
  └── styles/tokens.css     # design tokens, system theme

Express API (Node.js)
  ├── GET  /page              # fetch page config + preset + source_path
  ├── PUT  /page              # save config; HTML write-back when source_path set
  ├── GET  /page/snapshots    # list named snapshots
  ├── POST /page/snapshots    # save current config as snapshot
  ├── DELETE /page/snapshots/:id
  ├── POST /page/snapshots/:id/restore
  ├── GET  /assets            # list uploaded images (metadata)
  ├── POST /assets            # upload image (base64 JSON) → { url }
  ├── DELETE /assets/:filename
  └── GET  /assets/:file      # serve uploaded images (static)

SQLite (local file: data.db)
  ├── page table
  │     ├── id, config, preset, source_path, updated_at
  └── snapshots table
        ├── id, name, preset, config, created_at
```

Single page only — no slug, no registry. `GET /page` / `PUT /page`.

## Data Flow

```
App load
  → GET /page
  → PageRenderer merges each element with ELEMENT_DEFAULTS, builds styles

User clicks "Edit"
  → history cleared; click element → InspectorPanel opens
  → change property → live preview + push undo stack

Drag / resize (edit mode, selected element)
  → SelectionOverlay (react-moveable) → updateElement offsetX/offsetY/width/height
  → beginContinuousEdit on gesture start → one history.push
  → endContinuousEdit on gesture end
  → PageRenderer buildStyle applies transform + width/height
  → auto-save persists

Copy / paste / duplicate (edit mode)
  → Ctrl+C / Ctrl+X / context menu → clipboardRef { elements[], anchor }
  → Ctrl+X removes selected element(s) in same undo entry as copy
  → Ctrl+V / Paste → insert clones at offset 0 → `computePlacementOffsets` after DOM measure → one `history.push` with pre-paste snapshot
  → Copy/cut stores `visualRelatives` (page-local layout captured from DOM)
  → Edit mode reserves fixed left/right canvas gutters (layers + inspector) so selection changes don't reflow the page
  → Ctrl+V uses last canvas mouse position; context menu uses click coordinates
  → one history.push per paste/duplicate → auto-select new element → auto-save

Multi-select (edit mode)
  → Shift+click toggles selectedIds
  → SelectionOverlay group mode (react-moveable targets[]) → updateElements batch on drag
  → one continuous-edit undo entry per group drag

Auto-save (600ms debounce, edit mode only)
  → if config !== savedConfig → PUT /page { config }
  → SQLite updated; toolbar shows Saving… / Saved / Save failed
  → (Phase 13) server runs configToHtml(config) → write page.sourcePath under PROJECT_ROOT

Undo / Redo
  → pop/push config history stack (no new history entry)

Revert
  → reset config to sessionBaseline (snapshot when Edit was clicked)
  → auto-save persists reverted state to DB

User clicks "Done"
  → exit edit mode (changes already persisted)

User refreshes
  → GET /page returns saved config → change persists
```

## Components

| Component | Responsibility |
|-----------|---------------|
| `EditorShell` | Layout shell: toolbar, canvas area, inspector slot |
| `Toolbar` | Edit mode toggle, Save, Done with SVG icons |
| `PageRenderer` | Map `elements[]` to React elements; apply merged defaults + styles; element refs; mount `SelectionOverlay` for selected |
| `SelectionOverlay` | Wraps `react-moveable`; drag + 8-handle resize; snappable guides + grid snap |
| `AlignDistributeSection` | Inspector align/distribute chips + grid snap toggle |
| `ContextMenu` | Right-click menu: Copy, Duplicate, Paste; closes on Esc / outside click |
| `InspectorPanel` | Collapsible sections; SwatchInput + ChipGroup controls; Position & Size (X/Y/W/H) |
| `SwatchInput` | Swatch + hex row; popover color wheel |
| `ChipGroup` | Icon chip toggle group (alignment, future chips) |
| `SectionHeader` | Collapsible section title + chevron |
| `elementDefaults.js` | `TYPE_DEFAULTS` + `mergeElement()` (type-aware) |
| `elementTree.js` | Group/ungroup, recursive update/delete/find, align children, align/distribute selection, reparent-and-group |
| `elementPlacement.js` | Flow vs visual coords; `captureVisualRelatives`, `computePlacementOffsets` |
| `elementFactory.js` | `createElement`, `INSERTABLE_TYPES`, viewport center helper |
| `elementClipboard.js` | `makeElementId`, `cloneForPaste` (resets root offsets; children keep layout) |
| `icons/` | Inline SVG icon components |
| `useConfigHistory` | Undo/redo stack; max 50 snapshots |
| `App.jsx` | Edit mode, auto-save effect, revert, config state |
| `SnapshotsPanel` | Named snapshot list, save/restore/delete |
| `AssetManagerPanel` | Uploaded image grid, delete with confirm |
| Express server | Page routes, snapshots, assets, HTML write-back |
| `configToHtml.js` | Serialize element tree → static HTML string |
| `pathUtils.js` | Safe `sourcePath` resolution under `PROJECT_ROOT` |

## Element Schema

Each element in `config.elements[]`:

| Property | Type | Default | Applied as |
|----------|------|---------|------------|
| `id` | string | — | React key |
| `type` | `"heading"` \| `"paragraph"` \| `"image"` \| `"button"` \| `"link"` \| `"divider"` \| `"list"` \| `"container"` | — | tag / component choice |
| `children` | element[] | `[]` | nested elements (container only) |
| `text` | string | `""` | content (heading, paragraph, link) |
| `label` | string | `""` | button label |
| `src` | string | `""` | image URL (`POST /assets` or external) |
| `alt` | string | `""` | image alt text |
| `objectFit` | `"cover"` \| `"contain"` \| `"fill"` \| `"none"` | `"cover"` | CSS `object-fit` |
| `href` | string | `""` | button/link URL |
| `target` | `"_self"` \| `"_blank"` | `"_self"` | link target |
| `dividerThickness` | number (px) | `1` | divider line height |
| `dividerColor` | string (hex) | `#cccccc` | divider line color |
| `items` | string[] | `[]` | list item strings |
| `ordered` | boolean | `false` | `<ol>` vs `<ul>` |
| `color` | string (hex) | `#1a1a1a` | `color` |
| `fontSize` | number (px) | `16` | `font-size` |
| `backgroundColor` | string | `"transparent"` | `background-color` |
| `opacity` | number 0–100 | `100` | `opacity` (÷ 100) |
| `padding` | number (px) | `0` | `padding` (all sides) |
| `marginBottom` | number (px) | `20` | `margin-bottom` |
| `borderRadius` | number (px) | `0` | `border-radius` |
| `borderWidth` | number (px) | `0` | `border-width` (none if 0) |
| `borderColor` | string (hex) | `#000000` | `border-color` |
| `textAlign` | `"left"` \| `"center"` \| `"right"` | `"left"` | `text-align` |
| `offsetX` | number (px) | `0` | `transform: translateX` |
| `offsetY` | number (px) | `0` | `transform: translateY` |
| `width` | number \| null (px) | `null` | `width` (auto when null) |
| `height` | number \| null (px) | `null` | `height` (auto when null) |

Older saved configs missing new fields render correctly via `mergeElement()`.

## Positioning model (Phase 6)

**Hybrid (Phase 6+, refined Phase 11):** Elements with `offsetX`/`offsetY` ≠ 0 use `position: absolute` at the parent origin plus `transform: translate(offsetX, offsetY)` so stack reorder (`zIndex`) and DOM sibling order cannot shift visual placement. Elements at `(0,0)` stay in document flow. Width/height explicit when set by resize; `null` means content-driven auto sizing.

When `width` is set, the element gets `overflow-wrap/word-break: break-word` so text reflows to the box (Figma-like). Side handles resize width only (height stays auto → box grows with wrapped text); vertical/corner handles set `height` (with `overflow: hidden`).

## Libraries

| Library | Role |
|---------|------|
| `express` | API server |
| `node:sqlite` | Built-in SQLite (Node 22.5+); no native compile needed |
| `react` + `vite` | Frontend |
| `react-colorful` | Color pickers for text, background, border |
| `react-moveable` | Drag + 8-handle resize on selected element |
| `react-selecto` | Marquee box-select on canvas (multi-select) |

> Server runs with `--experimental-sqlite` (wired into `npm start`).

> Deferred: Puck, rc-slider, pg. Added in later phases only.

**Planned (Phase 17 — package):**

| Library | Role | Notes |
|---------|------|-------|
| `react-aria-components` | Accessible form primitives for Slider, ChipGroup, SwatchInput, NumberField | Pattern from [Figma SDS](https://github.com/figma/sds); adds ARIA roles, keyboard nav, focus management without replacing visual design |
| Storybook | Component catalog for `<VisualEditor>` package consumers | Triggered by Phase 17 packaging scope |

## Database Schema

```sql
CREATE TABLE page (
  id          INTEGER PRIMARY KEY CHECK (id = 1),
  config      TEXT NOT NULL,
  preset      TEXT NOT NULL DEFAULT 'demo',
  source_path TEXT,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE snapshots (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  preset     TEXT NOT NULL,
  config     TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

Preset → `source_path` defaults: `demo` → `client/public/pages/demo.html`, `marketplace` → `client/public/pages/marketplace.html`. Paths resolved under project root only.

---

## Future Architecture

Phase drafts and schema impact live in [spec.md](spec.md) Future Scope. Architecture-only notes that belong here:

- **Phase 18 AI path** — see section below (MCP wrapper over the same page/config API).
- **Phase 17 tokens** — two-layer primitives → semantic aliases (also tracked in [design.md](design.md)).
- **Phase 16 multi-page** — `pages` table + slug routes; see [api.md](api.md) Future API.
- **Later** — `node:sqlite` → `pg` / JSONB when multi-user hosting needs it.

---

### Phase 18 AI path design

Reference: [Figma MCP Server](https://github.com/figma/mcp-server-guide) — Figma exposes their canvas to AI agents through a structured MCP server with typed tools. Our Phase 18 goal is the same thing for our editor.

**What Figma's MCP server exposes:**

| Tool | What it does |
|------|-------------|
| `get_design_context` | Structured representation of a selected frame (layout, components, variables) |
| `get_variable_defs` | Design tokens used in the selection |
| `get_screenshot` | Visual reference of the node |
| Write to canvas | Create/modify frames, components, variables via agent |

**Our Phase 18 equivalent (same pattern, our API):**

| Our tool / endpoint | Equivalent |
|--------------------|------------|
| `GET /pages/:slug` | `get_design_context` — returns full element tree as JSON |
| `GET /pages/:slug/elements/:id` | Fetch a single element subtree |
| `PUT /pages/:slug` | Write to canvas — agent creates/modifies elements |
| `GET /pages` | List pages (after Phase 16) |

The JSON element schema is already the contract — no new data format needed. Phase 18's work is:
1. **Server-side schema validation** on `PUT /page` so agents can't corrupt the config
2. **An MCP server wrapper** (or documented REST usage) that exposes these endpoints as MCP tools with proper descriptions for LLMs
3. **A system prompt / rules file** (following Figma's best-practice pattern) that tells agents how to use the editor API correctly

**Figma's best practices that directly translate to our agent instructions:**

```
## Editor MCP rules
- Always GET /page first to get the current element tree before making changes
- Use element `id` fields to target specific elements; never invent IDs
- Use PUT /page with the full config; partial updates are not supported
- Use the element schema in docs/architecture.md as the type contract
- Prefer modifying existing elements over creating new ones when the intent is editing
- After PUT, confirm by checking the response config reflects the expected change
```

**Token architecture (Phase 17):** Migrate `tokens.css` from flat semantic-only to a two-layer model (primitives → semantic aliases), matching the [Figma SDS](https://github.com/figma/sds) approach. Enables consumers of `<VisualEditor>` to remap the semantic layer without touching component code:

```css
/* Layer 1: primitives (no direct component use) */
--color-black-1000: #1a1a1a;
--color-blue-600: #2563eb;

/* Layer 2: semantic (what components reference — same as today) */
--bg-panel: var(--color-white-1000);
--accent:   var(--color-blue-600);
```
