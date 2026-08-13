# Spec

## Vision

**A Figma-like editor that lives on top of your real project** — not a separate design file,
not a hosted builder. Toggle Edit Mode, select any element on the actual page, adjust it
in a side panel with Figma-familiar controls, and see changes apply in real time.
Changes auto-save to the database; undo/revert when you need to roll back.

The page config is structured JSON, so an AI can read and write the same data through
the same API — human drag-and-drop and AI generation share one source of truth.

**Dual persistence (Phase 13):** JSON remains the editor's source of truth, but every
save also **serializes config → HTML** and writes/overwrites the mapped file in the
user's project (e.g. `pages/marketplace.html`). Visual edit on the live page; the
codebase gets a real file diff you can commit.

> Think: **fork of Figma's inspector, embedded in your app** — with write-back to disk.

---

## Product Principles

| Principle | Meaning |
|-----------|---------|
| Simplicity is king | Every control earns its place; no decorative UI |
| Real project, real time | Edit the live page, not a mock — preview is instant |
| Figma-familiar | Side panels, collapsible sections, compact inputs — users already know this |
| Technical but minimal | Monospace for values, inline SVG icons, hairline borders — no icon fonts, no bloat |
| AI-compatible | JSON config + REST API; same contract for humans and agents |
| Write-back to project | Saved JSON also emits HTML to a configured path in the repo (Phase 13) |

---

## Completed Phases

### MVP — Complete

Prove the loop **edit → save → refresh → change survived**.

| # | Requirement | Status |
|---|-------------|--------|
| 1 | One page rendered from JSON config | Done |
| 2 | Edit toggle | Done |
| 3 | Click to select | Done |
| 4 | Edit text, color, font size | Done |
| 5 | Save persists to SQLite | Done |
| 6 | Refresh shows persisted values | Done |

### Phase 2 — Full Property Panel — Complete

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Background, opacity, padding, margin, border controls | Done |
| 2 | Backward compatible defaults | Done |
| 3 | Save + refresh persists all properties | Done |

### Phase 3 — Design System + Figma-like Chrome — Complete

| # | Requirement | Status |
|---|-------------|--------|
| 1 | CSS design tokens (`tokens.css`) | Done |
| 2 | System theme via `prefers-color-scheme` | Done |
| 3 | Inline SVG icons (Edit, Save, Done, chevron) | Done |
| 4 | Top toolbar + flush-right inspector sidebar | Done |
| 5 | Collapsible inspector sections | Done |
| 6 | `EditorShell` layout (canvas + inspector) | Done |
| 7 | [development.md](development.md) — dev practices + skill workflow | Done |

### Phase 4 — Figma-style Field Patterns — Complete

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Swatch + hex compact color rows | Done |
| 2 | Color wheel in popover (click swatch; close on outside-click / Esc) | Done |
| 3 | Alignment chip row (left / center / right) | Done |
| 4 | New `textAlign` property with backward-compatible defaults | Done |
| 5 | `SwatchInput` + `ChipGroup` reusable components | Done |

### Phase 5 — Auto-save + Undo / Revert — Complete

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Debounced auto-save (600ms) to SQLite in edit mode | Done |
| 2 | Save status in toolbar (Saving… / Saved / Save failed) | Done |
| 3 | Explicit Save button removed | Done |
| 4 | Undo / redo in-session history stack (max 50) | Done |
| 5 | Revert to session start (when Edit was clicked) | Done |
| 6 | Done exits edit mode without reverting | Done |
| 7 | Ctrl+Z / Ctrl+Y keyboard shortcuts in edit mode | Done |

### Phase 6 — Drag-to-reposition + Resize — Complete

Hybrid model: elements stay in document flow with free X/Y offset via CSS `transform: translate`, plus explicit width/height (null = auto).

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Drag selected element to reposition (offsetX/offsetY) | Done |
| 2 | 8-handle resize on selected element | Done |
| 3 | Inspector Position & Size section (X, Y, W, H) | Done |
| 4 | Drag/resize syncs inspector live; number edits move/resize element | Done |
| 5 | One gesture = one undo entry (continuous-edit batching) | Done |
| 6 | Persist via auto-save; backward compatible defaults | Done |
| 7 | `react-moveable` via `SelectionOverlay` wrapper | Done |

### Phase 7 — Copy / Paste Elements — Complete

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Copy selected element(s) to in-memory clipboard (Ctrl+C) | Done |
| 2 | Cut selected element(s) (Ctrl+X) — copy + remove, one undo | Done |
| 3 | Paste at cursor with new id (Ctrl+V) | Done |
| 4 | Duplicate in one action (Ctrl+D) | Done |
| 5 | Right-click context menu (Copy / Cut / Duplicate / Paste) | Done |
| 6 | One paste/cut/duplicate = one undo entry | Done |
| 7 | Persist via auto-save; no schema change | Done |

### Phase 7b — Multi-select — Complete

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Shift+click to add/remove from selection | Done |
| 2 | Drag moves all selected elements together (one undo entry) | Done |
| 3 | Multi-select inspector shows count + hint | Done |
| 4 | Cut/copy operate on all selected elements | Done |

Formal **groups** (persistent group objects, nest in layers tree) → Phase 10.

### Phase 8 — Element Creation & Deletion — Complete

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Insert control (+ Insert menu: heading / paragraph) | Done |
| 2 | New element gets defaults + unique id; auto-selected | Done |
| 3 | Delete selected via Delete/Backspace + context menu | Done |
| 4 | Arrow keys nudge 1px; Shift+arrow 10px | Done |
| 5 | Each add/delete/nudge = one undo entry; auto-save | Done |
| 6 | Empty-page placeholder in edit mode | Done |

### Phase 9 — Expanded Element Types — Complete

| # | Requirement | Status |
|---|-------------|--------|
| 1 | New types: `image`, `button`, `link`, `divider`, `list` | Done |
| 2 | Each renders in `PageRenderer`; inspector shows type-specific controls | Done |
| 3 | Image: `src` (URL or upload), `alt`, `objectFit` | Done |
| 4 | Button/link: label or text, `href`, `target`; divider: thickness/color; list: `items[]`, ordered/unordered | Done |
| 5 | Insert palette lists all new types | Done |
| 6 | Type-aware defaults via `mergeElement`; old configs unaffected | Done |

Image upload uses `POST /assets` (files stored under `server/assets/`); URL field supports external images.

**Deferred (see [Deferred from Phases 9–10](#deferred-from-phases-910)):** asset manager UI → Phase 13.

### Phase 10 — Containers & Formal Groups — Complete

| # | Requirement | Status |
|---|-------------|--------|
| 1 | New `container` (frame) type with `children[]` | Done |
| 2 | Nesting in config; flat root `elements[]` still valid | Done |
| 3 | Ctrl+G group; Ctrl+Shift+G ungroup | Done |
| 4 | Moving container moves children (DOM nesting + transform) | Done |
| 5 | Align children to parent (3×3 grid in inspector) | Done |
| 6 | Recursive render, merge, delete, clipboard, persist | Done |

Tree helpers live in `elementTree.js`. Insert menu includes **Frame** for empty containers.

**Deferred (see [Deferred from Phases 9–10](#deferred-from-phases-910)):** cross-parent group → Phase 12; auto-layout/flex containers and scroll/overflow + scrollbar styling → Phase 14.

### Phase 11 — Layers Panel — Complete

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Left layers tree (Page + nested elements) | Done |
| 2 | Click row ↔ canvas selection; drag rows to reorder siblings | Done |
| 3 | Z-order via `zIndex` among siblings (document flow unchanged); forward/back and front/back shortcuts | Done |
| 3b | Layer order in inspector + context menu (`LayerOrderControls`) | Done |
| 4 | `hidden` / `locked` toggles on layer rows | Done |
| 5 | Rename via `name` (layers double-click + inspector) | Done |
| 6 | Insert into selected frame when a container is selected | Done |
| 7 | Context menu Group / Ungroup | Done |
| 8 | Root `pageBackground`; Page row + empty canvas → page inspector | Done |

Components: `LayersPanel.jsx`, `PageInspectorPanel.jsx`, `LayerOrderControls.jsx`, `LayerOrderSection.jsx`. Config helpers: `mergeConfig()`, tree ops in `elementTree.js` (`shiftZOrder`, `setZOrderExtreme`, `moveElementBefore`, `insertIntoTree`).

### Phase 12 — Alignment, Distribution, Snapping & Guides — Complete

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Align selected: left/center/right, top/middle/bottom (selection bounds or parent) | Done |
| 2 | Distribute horizontal/vertical spacing across 3+ elements | Done |
| 3 | Snapping on drag/resize to other elements' edges + centers | Done |
| 4 | Smart guide lines render during the gesture | Done |
| 5 | Optional grid snap toggle (8px) | Done |
| 6 | Group selection spanning different parents (reparent to root, wrap in frame) | Done |

Components: `AlignDistributeSection.jsx`. Tree helpers: `alignSelectedElements`, `distributeSelectedElements`, `reparentAndGroup` in `elementTree.js`. Snap via `react-moveable` snappable in `SelectionOverlay.jsx`; toolbar magnet toggle + inspector grid snap chip.

### Phase 13 — Design Snapshots, Export & HTML Write-back — Complete

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Save current page config as a named snapshot/preset | Done |
| 2 | List snapshots; restore/switch; duplicate; delete | Done |
| 3 | Export current config as JSON (download) | Done |
| 4 | Import a JSON config (upload) | Done |
| 5 | `configToHtml(config)` deterministic serializer | Done |
| 6 | HTML write-back on save to `sourcePath` | Done |
| 7 | Per-page `sourcePath` mapping (preset → path under project root) | Done |
| 8 | Restore = one undo entry; snapshots separate from auto-save | Done |
| 9 | Asset manager UI (`GET /assets`, `DELETE /assets/:filename`) | Done |

Components: `configToHtml.js`, `SnapshotsPanel.jsx`, `AssetManagerPanel.jsx`. Server: `snapshots` table, `source_path` on `page` row, path sandbox via `pathUtils.js`.

**Deferred (stretch):** JSX export, `.bak` before overwrite, diff preview in toolbar.

---

## Tech

| Concern | Choice |
|---------|--------|
| Frontend | React + Vite |
| Editor chrome | Figma-inspired side panel (see [design.md](design.md)) |
| Backend | Node.js / Express |
| Database | SQLite via `node:sqlite` (local file) |
| Theme | System preference (light/dark auto) |
| Hosting | Local only |

---

## Persistence Model (decided)

| Behavior | Detail |
|----------|--------|
| Live preview | Every panel change updates the page immediately |
| Auto-save | Debounced write to DB on change (600ms) — **implemented** |
| Undo / revert | Full config action history; Revert resets to **session start** (when Edit was clicked), not last auto-save |
| Explicit Save | Retired — replaced by auto-save + undo/revert |

---

## Page Config JSON (current shape)

Flat `elements[]` at root with optional root `pageBackground` (Phase 11). See [architecture.md](architecture.md) for per-element fields.

---

## Future field controls (backlog)

Swiss-army-knife tooling — recorded for later phases, not built yet (mapped to drafts where relevant):

- **Typography:** bold/italic chips (`fontWeight`, `fontStyle`), `textTransform`, `letterSpacing`, `lineHeight`, font-family picker → **Phase 14** (responsive typography)
- **Rich text:** inline multi-style editing within text elements → **Phase 15** (component instance overrides)
- **Layout:** per-side padding/margin with link/unlink toggle → field-control backlog; display/flex controls → **Phase 14** (auto-layout containers, extends Phase 10); **overflow + scrollbar styling** on containers (`overflowX`/`overflowY`, `scrollbarWidth`, thumb/track colors) → **Phase 14**
- **Fill/Effects:** box-shadow, gradients, multiple fills → field-control backlog (no phase yet)
- **Element:** link/href → **Phase 9** (done); visibility toggle → **Phase 11**; button form validation → **Phase 17** (embed/host)

---

## Deferred from Phases 9–10

Items intentionally left out of Phases 9–10 are scheduled in later phases (not dropped from the product).

| Deferred item | Target phase | Rationale |
|---------------|--------------|-----------|
| Asset manager UI (browse/delete uploads) | **13** | **Done** |
| Context menu Group / Ungroup | **11** | **Done** |
| Insert into selected frame (not root-only) | **11** | **Done** |
| Group across different parent levels | **12** | **Done** |
| Auto-layout / flex containers | **14** | Extends Phase 10 frames with responsive layout |
| Scrollable containers + scrollbar styling | **14** | Overflow modes on frames; inspector edits thumb/track/width (pairs with fixed height) |
| Rich text (multi-style body copy) | **15** | Per-instance text overrides on components |
| Button form validation / submit behavior | **17** | Host-app concern for embeddable editor |

---

## Future Scope (drafts)

Ordered roadmap from where we are (Phase 7b done). Each phase below is a **draft** — goal,
requirements, schema/storage impact, UX, dependencies, and risks — to be locked in Plan mode
before it starts. Numbering and order may shift; dependency notes are the hard constraints.

Grouped into three arcs:

- **Near-term (builder fundamentals)** — 8–13: make it a real builder you can compose with.
- **Advanced editing** — 14–15: responsive + reusable components.
- **Platform & delivery** — 16–19: multi-page, packaging, AI, auth.

> Legend: **Schema impact** flags whether a phase reshapes the config JSON (the riskiest changes).

---

### Phase 9 — Expanded Element Types — Draft

**Goal:** Beyond text — image, button, link, divider, and list elements.

| # | Requirement |
|---|-------------|
| 1 | New types: `image`, `button`, `link`, `divider`, `list` |
| 2 | Each renders in `PageRenderer`; inspector shows type-specific controls |
| 3 | Image: `src` (URL or upload), `alt`, `objectFit` |
| 4 | Button/link: `label`/`text`, `href`, target; divider: thickness/color; list: `items[]`, ordered/unordered |
| 5 | Insert palette (Phase 8) lists the new types |
| 6 | Type-aware defaults via `mergeElement`; old configs unaffected |

- **Schema impact:** moderate. `type` union grows; new per-type fields. Defaults become type-aware.
- **Storage note:** image upload as data URL bloats the config row — decide between data URLs (simple) vs. an asset endpoint/table (scalable). Recommend a small `assets` endpoint if upload is in.
- **UX:** inspector sections adapt to the selected type (image controls vs. text controls).
- **Depends on:** Phase 8 (insert palette).
- **Risks:** config size from inline images; backward-compatible type defaults.
- **Deferred:** asset manager UI → [Phase 13](#phase-13--design-snapshots-presets--export--draft).

> **Shipped.** See Completed Phases → Phase 9. Asset upload via `POST /assets`; no asset manager UI.

### Phase 10 — Containers & Formal Groups — Draft

**Goal:** Nesting model — frame/div elements that contain children; persistent group/ungroup (beyond Phase 7b multi-select).

| # | Requirement |
|---|-------------|
| 1 | New `container` (frame) element type that holds children |
| 2 | Config supports nesting (children tree) |
| 3 | Group selected (Ctrl+G) wraps them in a container; Ungroup (Ctrl+Shift+G) flattens |
| 4 | Moving/resizing a container moves its children |
| 5 | Align children to parent (left/center/right, top/middle/bottom) |
| 6 | Recursive render; nested configs persist + undo cleanly |

- **Schema impact:** **MAJOR.** Introduce nesting — recommend `children: []` on containers (tree) over flat `parentId` refs. Flat `elements[]` stays valid (treated as root children) for backward compatibility.
- **UX:** containers show as frames; group/ungroup via keyboard (shipped); context menu entries → Phase 11.
- **Depends on:** multi-select (7b), insert (8). The Phase 6 hybrid model (flow + transform) was chosen to make this possible.
- **Risks:** biggest reshape so far — `mergeElement` recursion, undo/auto-save over nested trees, `react-moveable` nested transforms, render performance.
- **Deferred:** context menu Group/Ungroup, insert-into-frame → [Phase 11](#phase-11--layers-panel-z-order-visibility-lock--draft); cross-parent group → [Phase 12](#phase-12--alignment-distribution-snapping--guides--draft); auto-layout/flex and scroll/overflow + scrollbar styling → [Phase 14](#phase-14--responsive-breakpoints--draft).

> **Shipped.** See Completed Phases → Phase 10.

### Phase 11 — Layers Panel (z-order, visibility, lock) — Draft

**Goal:** Left sidebar element tree; manage stacking order, visibility, and locking.

| # | Requirement |
|---|-------------|
| 1 | Left panel lists elements as a tree (reflects Phase 10 nesting) |
| 2 | Click a row to select (synced with canvas); drag rows to reorder |
| 3 | Reorder controls stacking; bring-to-front / send-to-back (Ctrl+] / Ctrl+[) |
| 4 | Per-element visibility toggle (`hidden`) and lock toggle (`locked` → not selectable/draggable) |
| 5 | Rename element (`name`) |
| 6 | Insert new elements into the selected frame/container (not root-only) |
| 7 | Context menu: Group / Ungroup (matches Ctrl+G / Ctrl+Shift+G) |
| 8 | **Page background** — select **Page** in the layers tree (or click empty canvas); inspector sets root `pageBackground` (color; image stretch later); canvas area reflects it (separate from `--bg-canvas` editor chrome) |

- **Schema impact:** small — add `name`, `hidden`, `locked`, `zIndex` (stack order among siblings; array order is document flow only); root-level `pageBackground` on config (string, default e.g. `#ffffff`).
- **UX:** three-panel shell (layers | canvas | inspector); rows with eye/lock icons; canvas shrinks both sides. **Page** row at tree root opens page-level inspector (background swatch).
- **Also from Phase 10 deferrals:** insert target follows selection in layers tree; context menu completes group UX.
- **Depends on:** Phase 10 nesting (for the tree).
- **Risks:** shell layout change; reorder + nesting drag interaction complexity.
- **Out of scope:** multi-page tree.

> **Shipped.** See Completed Phases → Phase 11.

### Phase 12 — Alignment, Distribution, Snapping & Guides — Draft

**Goal:** Precision layout — align/distribute multiple elements; snap to siblings/parent/grid with smart guides while dragging.

| # | Requirement |
|---|-------------|
| 1 | Align selected: left/center/right, top/middle/bottom (selection bounds or parent) |
| 2 | Distribute horizontal/vertical spacing across 3+ elements |
| 3 | Snapping on drag/resize to other elements' edges + centers, parent, and optional grid |
| 4 | Smart guide lines render during the gesture |
| 5 | Optional grid + snap on/off toggle |
| 6 | Group selection that spans different parents (reparent siblings, then wrap in frame) |

- **Schema impact:** none (operates on `offsetX/Y` + size). Snap/grid settings live in UI state.
- **UX:** alignment toolbar in inspector when 1+ selected; guides via `react-moveable` snappable.
- **Also from Phase 10 deferrals:** cross-parent grouping builds on reparent + existing Ctrl+G.
- **Depends on:** multi-select (7b); containers (10) for align-to-parent.
- **Risks:** snappable config tuning; performance with many snap targets.
- **Out of scope:** visible pixel grid overlay; draggable ruler guides.

> **Shipped.** See Completed Phases → Phase 12.

> **Shipped.** See Completed Phases → Phase 13.

### Phase 14 — Responsive Breakpoints — Draft

**Goal:** Per-breakpoint overrides so a design adapts to mobile/tablet/desktop.

| # | Requirement |
|---|-------------|
| 1 | Define breakpoints (e.g. base / md / lg) |
| 2 | Per-element overrides at a breakpoint (offset, size, visibility, typography) |
| 3 | Canvas width switcher to preview each breakpoint |
| 4 | Edits apply to the active breakpoint; indicator when a value is overridden |
| 5 | (Stretch) Auto-layout / flex mode on container frames — direction, gap, align-items (extends Phase 10) |
| 6 | **Scrollable containers + scrollbar editing** — `overflowX`/`overflowY` (visible, hidden, scroll, auto) on frames; fixed height/width creates scroll regions; inspector for scrollbar width and thumb/track colors (`scrollbarWidth`, `scrollbarColor` or equivalent tokens); canvas shows native scrollbars in preview |

- **Schema impact:** **MAJOR.** Element values become base + a `responsive` override map (e.g. `responsive: { md: { ... } }`); `mergeElement` resolves by active breakpoint. Flex fields on containers add moderate schema surface. Overflow + scrollbar fields are container-only (moderate).
- **UX:** breakpoint switcher in toolbar; inspector edits the active breakpoint. **Overflow & scroll** section on container select: overflow mode chips, scrollbar color swatches, width preset (thin / auto / none).
- **Also from Phase 10 deferrals:** flex/auto-layout containers and scroll/overflow + scrollbar styling deferred from Phase 10 land here.
- **Depends on:** stable element schema; containers (10) help.
- **Risks:** schema + `mergeElement`/undo/auto-save complexity across breakpoints; UI clarity on "which breakpoint am I editing."
- **Out of scope:** container queries, fluid type.

### Phase 15 — Components / Symbols — Draft

**Goal:** Define an element or group once, reuse instances; edit the master to update all.

| # | Requirement |
|---|-------------|
| 1 | Create a component (master) from a selected element/group |
| 2 | Insert instances that reference the master |
| 3 | Editing the master propagates to all instances |
| 4 | Optional per-instance overrides (e.g. text) |
| 5 | (Stretch) Rich text / multi-style copy within text elements (deferred from open-ended "rich text") |

- **Schema impact:** moderate. `components` registry (id, definition) + an instance element type referencing `componentId` + `overrides`.
- **UX:** components section in the insert palette; "create component" in context menu; instance badge.
- **Depends on:** containers/groups (10), insert (8).
- **Risks:** override resolution; circular components; undo across master + instances.
- **Out of scope:** component props/variants.

---

### Phase 16 — Multi-page + Page Registry — Draft

**Goal:** More than one page.

| # | Requirement |
|---|-------------|
| 1 | Page registry: list / create / rename / delete pages |
| 2 | API `GET/PUT /pages/:slug`, `GET /pages` |
| 3 | Page switcher in toolbar; each page has its own config (and snapshots) |

- **Schema impact:** storage — `pages` table keyed by `slug` replaces the single `id = 1` row; migrate the seed.
- **Depends on:** stable single-page editor.
- **Risks:** migration from single page; snapshot scoping per page.
- **Out of scope:** nested routes, page templates.

### Phase 17 — Embeddable `<VisualEditor>` Package — Draft

**Goal:** Ship the editor as a reusable component for host apps.

| # | Requirement |
|---|-------------|
| 1 | `<VisualEditor pageSlug="..." apiBase="..." />` wrapping the editor shell |
| 2 | Configurable API base; theming via CSS tokens; style isolation |
| 3 | Packaged (npm) with integration docs |
| 4 | (Stretch) Button form validation / submit hooks for host apps (deferred interactive-form work) |

- **Schema impact:** none.
- **Depends on:** feature set stable (post 9–12); multi-page (16) for slugs.
- **Risks:** bundling `react-moveable`/`react-colorful`; style isolation in host apps; auth (19).
- **Out of scope:** plugin API.

### Phase 18 — AI Read/Write Path — Draft

**Goal:** Agents edit the same config through the same API — humans and AI share one source of truth.

| # | Requirement |
|---|-------------|
| 1 | Documented JSON schema as the contract |
| 2 | AI can GET config and PUT changes through the existing endpoints |
| 3 | Server-side schema validation (same rules for humans and AI) |
| 4 | (Stretch) natural-language → config endpoint or tool |

- **Schema impact:** none new (reuses the config); adds validation.
- **Depends on:** stable schema (after the major schema phases 10/14).
- **Risks:** validation/guardrails; conflicting human vs. AI edits; auth (19).
- **Out of scope:** model hosting.

### Phase 19 — Auth & Access Control — Draft

**Goal:** Protect writes before any multi-user or public deployment.

| # | Requirement |
|---|-------------|
| 1 | Auth on `PUT/POST/DELETE` (session or bearer) |
| 2 | Roles (viewer / editor); optional public read |
| 3 | Login flow; edit disabled when unauthenticated |

- **Schema impact:** storage — users/sessions or token store.
- **Depends on:** before any public/multi-user deploy.
- **Risks:** session handling, CSRF on writes.
- **Out of scope:** SSO, org management.
