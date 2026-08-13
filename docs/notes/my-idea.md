# My Idea — Visual UI Editor (Reusable, DB-backed)

> **Snapshot** — original idea dump. Current product truth: [spec.md](../spec.md), [design.md](../design.md), [architecture.md](../architecture.md).

## The Problem

- Small UI tweaks require AI prompts → wastes tokens
- Don't want to hand-write HTML/CSS
- Don't want to leave the project to use Figma, Wix, or Webflow

## The Vision

A **reusable visual editor layer** that any user can drop into a React app.
Toggle Edit Mode → drag, resize, recolor, adjust spacing on any element → Save →
changes persist to a database → page re-renders with the new config.

No external platform. No prompts for visual tweaks. Works on any page.
Also machine-readable: an AI can read and write the same page config JSON,
making the editor a two-way bridge between human drag-and-drop and AI generation.

---

## Confirmed Decisions

| Decision | Answer |
|----------|--------|
| Do changes persist? | Yes — saved to DB, reflected in live UI |
| Who uses the editor? | Anyone (not just the developer) |
| Scope | Any page in the app |
| Storage | Database (page configs stored as JSON) |
| AI integration | AI can read/write the same JSON schema |

---

## How It Works (High Level)

```
User opens page
  → App fetches page config JSON from DB
  → Renderer builds UI from config

User toggles Edit Mode
  → Visual editor overlays the page
  → Drag / resize / color / knob adjustments update local config state

User clicks Save
  → Updated config JSON sent to API
  → DB record updated
  → Editor exits, page re-renders from new config
```

AI path (parallel):
```
AI reads page config JSON from DB
  → Understands current layout as structured data
  → Outputs updated JSON
  → Same API saves it → page re-renders
```

---

## Core Interactions

| Interaction | What it does |
|-------------|--------------|
| Drag element | Reposition on the page |
| Resize handles | Change width / height |
| Color wheel | Change background, text, border color |
| Slider / knob | Font size, padding, margin, opacity, border radius |
| Click to select | Open property panel for that element |
| Toggle Edit Mode | Switch between normal view and design mode |
| Save | Persist config to DB |

---

## Recommended Stack

### Editor UI
**Puck** (by Measured) — open-source React page builder.
Stores all layout data as a clean JSON schema (`Data` object).
Has a built-in drag-and-drop editor. Extend with custom fields
(color pickers, sliders) per component type.

### Color + Numeric Controls
- **`react-colorful`** — color wheel / hue slider (~2 kb)
- **`rc-slider`** or native `<input type="range">` — spacing, size, opacity

### Database
- **PostgreSQL with JSONB** (recommended — relational + flexible JSON queries)
- Or **SQLite** for local/small-scale
- Schema: one row per page → `{ page_id, slug, config: JSON, updated_at }`

### API Layer
- REST endpoints: `GET /pages/:slug`, `PUT /pages/:slug`
- The `PUT` body is the Puck `Data` JSON — same shape whether saved by human or AI

### Reusability
Package the editor as a self-contained React component:
```tsx
<VisualEditor pageSlug="home" apiBase="https://..." />
```
Drop it into any React app. Pass in the API base URL and page slug. Done.

---

## AI Integration Path

Because page config is structured JSON, an AI can:
1. Fetch current config via `GET /pages/:slug`
2. Receive a natural-language instruction ("make the hero text bigger, change to blue")
3. Output updated JSON
4. `PUT /pages/:slug` to save

This is the "skill fed through AI" model — the JSON schema is the contract between
human editing and AI editing. Same data, same API, same result.

---

## Phased Build Plan

| Phase | Scope |
|-------|-------|
| 1 | Single page, local JSON file (no DB yet) — validate editor feel |
| 2 | Add DB + API, wire Save button to persist |
| 3 | Multi-page support, page registry |
| 4 | Package as reusable `<VisualEditor>` component |
| 5 | AI read/write path via same API |

---

## Final Tech Decisions

| Concern | Choice |
|---------|--------|
| Backend | Node.js / Express |
| Database | Local — SQLite for Phase 1, PostgreSQL for Phase 2+ |
| Hosting | Self-hosted / local |

## Open Questions

1. What's the first page / component we prototype the editor on?
