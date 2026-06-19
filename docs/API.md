# API

See [ARCHITECTURE.md](ARCHITECTURE.md). The **MVP** exposes two routes for a single page.

## Base URL

```
http://localhost:3001
```

---

## MVP Endpoints

### `GET /page`

Fetch the single page config.

**Response `200`**

```json
{
  "config": {
    "elements": [
      { "id": "heading-1", "type": "heading", "text": "Hello", "color": "#1a1a1a", "fontSize": 32 }
    ]
  },
  "preset": "demo",
  "updated_at": "2026-06-18T13:22:00.000Z"
}
```

If no config exists yet, the server returns a default seed config (so the page always renders).

---

### `GET /page/presets`

List available page presets (seed layouts for testing).

**Response `200`**

```json
[
  { "id": "demo", "label": "Demo" },
  { "id": "marketplace", "label": "MCP Marketplace" }
]
```

---

### `POST /page/preset`

Replace the stored page config with a preset seed. Used when switching test canvases (Demo vs MCP Marketplace).

**Body**

```json
{ "preset": "marketplace" }
```

**Response `200`**

```json
{
  "config": { "elements": [] },
  "preset": "marketplace",
  "updated_at": "2026-06-18T13:25:00.000Z"
}
```

**Response `400`** — unknown preset id.

---

### `PUT /page`

Save the updated config.

**Body**

```json
{
  "config": {
    "elements": [
      { "id": "heading-1", "type": "heading", "text": "Hi there", "color": "#2563eb", "fontSize": 40 }
    ]
  }
}
```

**Response `200`**

```json
{ "updated_at": "2026-06-18T13:25:00.000Z" }
```

**Response `400`**

```json
{ "error": "config is required and must be an object" }
```

---

### `POST /assets`

Upload an image for use in `image` elements. Avoids bloating page config with data URLs.

**Body**

```json
{
  "data": "<base64-encoded bytes>",
  "mimeType": "image/png"
}
```

Supported `mimeType` values: `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `image/svg+xml`. Max size 5MB.

**Response `200`**

```json
{
  "url": "http://localhost:3001/assets/<uuid>.png"
}
```

**Response `400`**

```json
{ "error": "Invalid base64 data" }
```

Uploaded files are stored under `server/assets/` and served at `GET /assets/<filename>`.

---

## Auth

None in the MVP (local, single user). Auth is required before multi-user use — parked.

---

## Future API (drafts)

Routes planned alongside the roadmap (see [SPEC.md](SPEC.md) Future Scope):

**Snapshots / presets (Phase 13)** — save and restore named design versions:

- `GET /snapshots` — list (id, name, created_at)
- `POST /snapshots` — save current config under a name → `{ id }`
- `GET /snapshots/:id` — fetch a snapshot's config
- `DELETE /snapshots/:id` — remove

Export (JSON) can stay client-side. **HTML write-back (Phase 13)** runs server-side on save so the file lands in the repo:

- `PUT /page` — after persisting config, if `sourcePath` is set, serialize and write HTML (response may include `{ updated_at, htmlWritten: true, path }`)
- `GET /page/export` — optional on-demand HTML download without save
- Path guard: resolve `sourcePath` relative to `PROJECT_ROOT`; reject `..` and paths outside root

Import is a client-side `PUT /page` with the parsed config (JSON only — not HTML parse-back).

**Assets (Phase 9 upload; Phase 13 asset manager)** — avoid bloating the config with data URLs:

- `POST /assets` — upload → `{ url }` — **implemented**
- `GET /assets/:id` — **implemented** (static file serve)
- `GET /assets` — list uploaded files (name, url, size) — **Phase 13**
- `DELETE /assets/:id` — remove file from disk — **Phase 13**

**Multi-page (Phase 16)** — routes become slug-based:

- `GET /pages` (list), `GET /pages/:slug`, `PUT /pages/:slug`
- Snapshots scope per page (`/pages/:slug/snapshots`).

**AI path (Phase 18)** uses the same page/config endpoints — no dedicated AI routes — with server-side schema validation.

**Auth (Phase 19)** protects all writes (`PUT`/`POST`/`DELETE`) via session or bearer token.
