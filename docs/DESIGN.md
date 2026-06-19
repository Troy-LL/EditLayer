# Design

See [SPEC.md](SPEC.md) for scope and phase status.

---

## Product Metaphor

**Figma's inspector, embedded in your app.**

| Figma | Us |
|-------|-----|
| Design file in Figma's cloud | Live page in your project |
| Canvas + right Design panel | Your page + right inspector panel |
| Layers panel (left) | Layers panel (Phase 11 — shipped) |
| Auto-save | Auto-save + undo/revert (Phase 5) |
| Properties: Fill, Stroke, Effects, Layout | Same grouping — mapped to our JSON schema |

The user never leaves their app. The editor is an overlay — toggle on to edit, toggle off to use.

---

## Design Principles

1. **Simplicity is king** — if a control doesn't help edit the page, cut it
2. **SVG only** — inline SVG for icons, chips, toggles; no icon font libraries
3. **Technical, not flashy** — monospace for values (px, hex, %), hairline borders, minimal shadow
4. **Figma-familiar** — collapsible sections, compact rows, swatch + hex, chip toggles
5. **System theme** — `prefers-color-scheme` for light/dark; no manual theme picker yet

---

## Visual Language

### Color tokens (system-aware)

| Token | Light | Dark | Use |
|-------|-------|------|-----|
| `--bg-canvas` | `#f7f7f8` | `#1a1a1a` | Page background behind content |
| `--bg-panel` | `#ffffff` | `#2c2c2c` | Inspector / toolbar chrome |
| `--bg-input` | `#f5f5f7` | `#383838` | Input fields, chips |
| `--border` | `#e5e5ea` | `#444444` | Hairline dividers, input borders |
| `--text-primary` | `#1a1a1a` | `#f5f5f7` | Labels, values |
| `--text-muted` | `#8e8e93` | `#98989d` | Section headers, hints |
| `--accent` | `#2563eb` | `#3b82f6` | Selection, active chip, focus ring |

One accent color. Everything else is neutral.

### Typography

| Role | Font | Size | Use |
|------|------|------|-----|
| UI labels | System sans | 11–13px | Section headers, field labels |
| Values | System mono | 12px | Numbers, hex codes, dimensions |
| Content | Inherited | — | The page being edited (not our chrome) |

### Spacing & shape

- Panel width: **280px** (Figma-like, narrow)
- Section padding: **12px**
- Input height: **28px** (compact)
- Border radius: **4px** on inputs/chips; **0** on panel edges (flush to viewport edge)
- Shadow: none on panel — border only; simplicity over depth
- **Scroll zones:** click **Page** (canvas) or **Inspector** to focus which pane is active; active zone shows a subtle ring/edge + label chip
- **Scrollbars:** page canvas uses the OS default (single scroll container for the project); inspector uses a thin 5px tool scrollbar. Document/body does not scroll — only `.editor-canvas` and `.inspector-body`.

### Icons

- Inline SVG, **16×16** default, **1.5px stroke**, no fill (unless semantic)
- Used in: toolbar buttons, section chevrons, chip toggles, alignment controls
- Source: hand-authored in `client/src/icons/` — no dependency

---

## Layout (Figma-inspired shell)

```
┌─────────────────────────────────────────────────────────────┐
│  [toolbar: Edit toggle · Undo · Redo]              (top)    │
├──────────────────────────────────────┬──────────────────────┤
│                                      │  INSPECTOR (right)   │
│         YOUR PAGE (canvas)           │  ┌─ Typography ────┐ │
│         rendered from config         │  │ Text            │ │
│         click to select              │  │ Size  [  32  ] px│ │
│                                      │  │ Color [■][#hex] │ │
│                                      │  └─────────────────┘ │
│                                      │  ┌─ Fill ──────────┐ │
│                                      │  │ [■][#hex]       │ │
│                                      │  └─────────────────┘ │
│                                      │  ┌─ Layout ────────┐ │
│                                      │  │ Pad [ 0 ] Mar [20]│
│                                      │  └─────────────────┘ │
│                                      │  ...collapsible...   │
└──────────────────────────────────────┴──────────────────────┘

Future (Phase 11):
┌──────────┬─────────────────────────────┬──────────────────┐
│ LAYERS   │         CANVAS              │    INSPECTOR     │
│ (left)   │                             │    (right)       │
└──────────┴─────────────────────────────┴──────────────────┘
```

---

## Inspector Panel (target UX)

Modeled on Figma's right **Design** panel. Replaces the current floating card.

### Section pattern

Each property group is a **collapsible section** with:
- Section title (uppercase, muted, 11px)
- Chevron SVG (rotate on collapse)
- Compact field rows below

### Field patterns (Figma-like)

| Pattern | Example | Our mapping |
|---------|---------|-------------|
| **Label + input** | Text field | `text` |
| **Label + number + unit** | `32 px` | `fontSize`, `padding`, `offsetX`, etc. |
| **Nullable number + unit** | `W [auto]` | `width`, `height` (null = auto) |
| **Swatch + hex input** | `[■] #1a1a1a` | `color`, `backgroundColor`, `borderColor` | Done |
| **Slider + value** | opacity `80%` | `opacity` | Done |
| **Chip toggle row** | alignment icons | `textAlign` | Done |
| **Link/unlink icon** | pad lock for uniform padding | future (per-side padding) |

### Selection chrome

- Selected element: **moveable control box** (accent lines + 8 resize handles) via `SelectionOverlay`
- Overlay **re-syncs on canvas scroll/resize** so the frame stays on the element
- Selection border lines are click-through; only handles capture pointer events
- Hover in edit mode: **1px dashed** muted border
- Drag body to reposition; drag handles to resize (top/left handles anchor opposite edge)
- Marquee: `react-selecto` on the canvas scroll container; drag starts only on non-element background

### Position & Size section (Phase 6)

First inspector section when an element is selected:

| Field | Maps to | Notes |
|-------|---------|-------|
| X | `offsetX` | px, CSS translate |
| Y | `offsetY` | px, CSS translate |
| W | `width` | px; placeholder "auto" when null |
| H | `height` | px; placeholder "auto" when null |

Drag/resize on canvas and number edits in the panel stay in sync live.

**Text wrapping (Figma-like):** setting a width constrains the text box — text reflows and long words break to fit. Side handles (left/right) change width only and keep height auto, so the box grows vertically as text wraps; top/bottom and corner handles set an explicit height (content clips beyond it).

---

## Toolbar (target UX)

Minimal top bar, icon-first where possible:

| Control | Type | Notes |
|---------|------|-------|
| Edit / Done | text button | enters/exits edit mode |
| Undo | SVG icon button | Done |
| Redo | SVG icon button | Done |
| Save indicator | muted text "Saved" / "Saving…" / "Save failed" | Done |
| Revert | text button | resets to last persisted snapshot |

---

## Current Implementation (Phase 7)

### Copy / paste / duplicate

```
Select element     → Ctrl+C copies to in-memory clipboard
Ctrl+X             → cut (copy + remove); one undo entry; works with multi-select
Ctrl+V             → in-frame: stack on source (+12px/layer, front); away: offset from copy
Ctrl+D             → same stack when pointer is over the original
Right-click Paste  → stack if click is on the source; otherwise near click (+12px)
Ctrl+D             → duplicate with +24px offset (unchanged)
Right-click        → context menu Paste uses click position as paste point
Right-click canvas → paste at cursor when clipboard has content
One paste          → one undo entry (includes DOM placement pass); auto-save persists
```

### Multi-select (Phase 7b)

```
Shift+click        → add/remove element from selection
Drag on canvas     → box-select (marquee) on empty area; Shift+drag adds to selection
Click empty canvas → clear selection
Drag selection     → moves all selected elements together (group drag)
Inspector          → shows "N selected" when multiple; single-element panel when one
Formal groups      → Phase 10 (persistent group objects, layers tree)
```

### Create / delete / nudge (Phase 8)

```
+ Insert (toolbar)   → pick type; appears at center of visible canvas viewport, auto-selected
Delete / Backspace   → remove selected (multi-select deletes all); one undo
Arrow keys           → nudge offset 1px; Shift+arrow 10px
Empty canvas         → placeholder prompts + Insert
Context menu         → Delete when right-clicking an element
```

### Direct manipulation (Phase 6)

```
Select element     → SelectionOverlay shows drag frame + 8 resize handles
Drag body          → offsetX/offsetY update live; inspector X/Y sync
Drag handle        → width/height (+ offset for top/left); inspector W/H sync
One gesture        → one undo entry (beginContinuousEdit / endContinuousEdit)
Refresh            → position/size persisted via auto-save
```

### Persistence (Figma-like)

```
Edit a value     → live preview (instant)
Auto-save        → debounced PUT /page (600ms) → toolbar shows Saving… / Saved
Undo / Redo      → full config snapshots; Ctrl+Z / Ctrl+Y in edit mode (skipped while typing in inputs)
Copy / Paste     → Ctrl+C / Ctrl+V / Ctrl+D in edit mode (skipped while typing in inputs)
Revert           → reset to config captured when Edit was clicked (session baseline)
Done             → exit edit mode (changes already on disk via auto-save)
```

### Field patterns (Phase 4)
- **SwatchInput** — compact `[swatch] [hex]` row; click swatch opens color wheel popover; Esc / outside-click closes; background supports `transparent` + Clear
- **ChipGroup** — icon chip toggles; alignment row in Typography section
- **NumberField** — compact label + monospace number + unit suffix
- **Slider** — custom track; click anywhere to jump, drag to scrub, arrow keys to nudge (opacity)

### Shell layout

- **Toolbar** — Edit; in edit mode: Undo, Redo, save status, Revert, Done
- **Canvas** — page content; shrinks when inspector is open (element selected)
- **Inspector** — flush-right 280px sidebar; **hidden until an element is selected**; collapsible sections; text chip rows stack full-width (no clip)
- **Theme** — CSS tokens; light/dark follows system preference

See [DEVELOPMENT.md](DEVELOPMENT.md) for dev workflow and skill usage.

---

## Component Inventory

| Component | Status | Location |
|-----------|--------|----------|
| `EditorShell` | Done | `client/src/components/EditorShell.jsx` |
| `Toolbar` | Done | `client/src/components/Toolbar.jsx` |
| `InspectorPanel` | Done | `client/src/components/InspectorPanel.jsx` |
| `SectionHeader` | Done | `client/src/components/SectionHeader.jsx` |
| SVG icons | Done | `client/src/icons/` |
| `SwatchInput` | Done | `client/src/components/SwatchInput.jsx` |
| `ChipGroup` | Done | `client/src/components/ChipGroup.jsx` |
| `Slider` | Done | `client/src/components/Slider.jsx` |
| `SelectionOverlay` | Done | `client/src/components/SelectionOverlay.jsx` |
| `ContextMenu` | Done | `client/src/components/ContextMenu.jsx` |
| `useConfigHistory` | Done | `client/src/hooks/useConfigHistory.js` |
| `InsertMenu` | Done | `client/src/components/InsertMenu.jsx` |
| `LayersPanel` | Done | `client/src/components/LayersPanel.jsx` |
| `AlignDistributeSection` | Done | `client/src/components/AlignDistributeSection.jsx` |

---

## Accessibility

- Visible `:focus-visible` ring (accent color)
- Keyboard: Tab through panel fields; **Ctrl+Z / Ctrl+Y** undo/redo in edit mode; Escape deselects (future)
- `prefers-reduced-motion`: no collapse animations
- Color contrast: WCAG AA on all token pairs (verify when tokens land)

**Known gaps (tracked for Phase 17 / package):**
- `Slider` — no `role="slider"` / `aria-valuemin/max/now`; keyboard scrub only works with custom JS, not native arrow key handling
- `ChipGroup` — no `role="radiogroup"` / `aria-checked` on active chip
- `SwatchInput` — popover lacks `role="dialog"` and focus trap; color picker has no accessible label
- `NumberField` inputs lack `aria-label` when label is visual-only

Planned fix: adopt **react-aria-components** (RAC) for these controls in Phase 17, matching the pattern used in [Figma's SDS](https://github.com/figma/sds). RAC provides keyboard navigation, ARIA semantics, and focus management for free.

---

## Design System Roadmap (informed by Figma SDS review)

Reference: [github.com/figma/sds](https://github.com/figma/sds) — Figma's own Simple Design System shows how Figma Variables, Code Connect, and a React codebase form a complete design-to-code pipeline.

### 1. Two-layer token model (Phase 17 — package)

Our current `tokens.css` is a flat *semantic-only* layer (e.g. `--bg-panel: #ffffff`). SDS separates:

| Layer | Example | Purpose |
|-------|---------|---------|
| **Color primitives** | `--color-black-100: #0c0c0d` | Raw palette; no direct use in components |
| **Semantic aliases** | `--bg-panel: var(--color-white-1000)` | What components reference |

Adding a primitive palette now (even if unused) gives Phase 17 the scaffolding to make the `<VisualEditor>` fully themeable — consumers can remap semantics without touching component code.

**Adoption plan:** Add a `/* primitives */` block at the top of `tokens.css` before Phase 17 packaging begins.

### 2. Icon wrapper component

Our icons are bare SVG function components with hardcoded `width`/`height`. SDS's `Icon` wrapper uses a typed `size` prop (`"14" | "16" | "20" | "24" | "32"`), standardising the size vocabulary.

Target pattern for Phase 17:

```jsx
// Before: <PencilIcon width={16} height={16} />
// After:
<Icon size="16"><PencilIcon /></Icon>
```

The `icons/index.jsx` re-export stays; the wrapper is additive.

### 3. Per-component CSS scoping (Phase 17 — package)

SDS colocates CSS with each component (`button.css`, `slider.css`). When we ship the Phase 17 package, component styles should move out of `App.jsx` / global CSS and into colocated files to prevent consumer style leakage.

### 4. Figma Code Connect (workflow reference)

SDS ships `figma.config.json` + `.figma.tsx` connect files that link React component code to Figma component nodes in Dev Mode. This creates a live code ↔ design sync.

Since our product metaphor **is** Figma's inspector, Code Connect is directly applicable if we ever produce a Figma design file for the editor chrome (e.g. as part of Phase 17 design documentation). Not blocking any phase, but the pattern is here to reference.

### 5. Storybook (Phase 17 — package documentation)

SDS uses Storybook (`npm run storybook`) for component documentation and visual regression testing. Relevant once we expose `<VisualEditor>` as a package — consumers need a browseable component catalog.

Add to Phase 17 scope: Storybook with stories for `InspectorPanel`, `LayersPanel`, `SwatchInput`, `ChipGroup`, `Slider`.

---

## Future Design (drafts)

UX direction per the roadmap (full drafts in [SPEC.md](SPEC.md), sequencing in [DEVELOPMENT.md](DEVELOPMENT.md)):

- **Insert palette (Phase 8)** — toolbar "+" opens a type menu; new element appears selected. Delete key + arrow-key nudge.
- **Type-aware inspector (Phase 9)** — sections adapt to the selected element type (image vs. button vs. text).
- **Containers & groups (Phase 10)** — frames render with a subtle outline; group/ungroup; align-to-parent buttons.
- **Layers panel (Phase 11 — shipped)** — three-panel shell; collapsed frames by default (expand on selection path); auto labels + ✎ rename; drag drop indicator; eye/lock, ↑↓ stack; **Layer order** in inspector + context menu; **Page** row for canvas background.
- **Alignment + smart guides (Phase 12 — shipped)** — alignment/distribute chips in inspector; snap guide lines during drag; toolbar snap toggle; 8px grid snap chip.
- **Versions & export (Phase 13)** — toolbar "Versions" (save/restore snapshots); **auto HTML write-back** to `sourcePath` on save; manual JSON export/download; React/JSX stretch later.
- **Responsive (Phase 14)** — breakpoint switcher in toolbar; inspector edits the active breakpoint; overridden values flagged; **overflow + scrollbar** section on containers (scroll/auto/hidden, thumb/track colors).
- **Components (Phase 15)** — components section in the insert palette; instance badge.
- Per-side padding with link/unlink icon (field-control backlog).
- Responsive chrome: inspector becomes a bottom sheet on narrow viewports.
