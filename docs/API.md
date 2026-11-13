# API

See [ARCHITECTURE.md](ARCHITECTURE.md). Single-page editor with snapshots, HTML write-back, and asset management.

## Base URL

```
http://localhost:3001
```

---

## Page Endpoints

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
  "source_path": "client/public/pages/demo.html",
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

Replace the stored page config with a preset seed. Used when switching test canvases (Demo vs MCP Marketplace). Also sets `source_path` for HTML write-back.

**Body**

```json
{ "preset": "marketplace" }
```

**Response `200`**

```json
{
  "config": { "elements": [] },
  "preset": "marketplace",
  "source_path": "client/public/pages/marketplace.html",
  "updated_at": "2026-06-18T13:25:00.000Z",
  "htmlWriteError": null
}
```

**Response `400`** — unknown preset id.

---

### `PUT /page`

Validate and save the whole config. After the SQLite write, runs `configToHtml(config)`,
overwrites `source_path` when configured, and broadcasts a `change` event on `/page/events`.
This is the editor's autosave path. The AI and tests should prefer `POST /page/ops`.

**Body**

```json
{
  "config": {
    "elements": [
      { "id": "heading-1", "type": "heading", "text": "Hi there", "color": "#2563eb", "fontSize": 40 }
    ]
  },
  "origin": "7d0c…",
  "actor": { "kind": "human", "name": "You" }
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `config` | yes | Validated by `shared/coworker/schema.js` (errors block, unknown keys only warn) |
| `origin` | no | Sender's tab id. The tab with that id ignores the echo on `/page/events` |
| `actor` | no | `{kind: "human" \| "ai" \| "test", name?}`, default human |

**Response `200`**

```json
{
  "updated_at": "2026-06-18T13:25:00.000Z",
  "version": 42,
  "htmlWriteError": null
}
```

When the HTML write fails but the JSON saved, `htmlWriteError` holds the message (for example `"Path outside project root"`).

**Response `400`**

```json
{ "error": "config is required and must be an object with elements[]" }
```

```json
{ "error": "invalid config: elements[0] \"a\": fontSize must be number 1–400 (px) (got -3)", "errors": ["elements[0] \"a\": fontSize must be number 1–400 (px) (got -3)"] }
```

`POST /page/preset` and `POST /page/snapshots/:id/restore` also accept `origin`, return `version`, and broadcast.

---

## Co-worker Endpoints (live board)

Shared by the editor, the AI co-worker (MCP server / CLI), and tests. Op shapes and review
rules: [COWORKER.md](COWORKER.md).

### `POST /page/ops`

Apply an op list atomically to the saved page. If any op fails, nothing is saved.

**Body**

```json
{
  "ops": [
    { "op": "update", "id": "mp-section-label", "set": { "text": "Popular this week" } },
    { "op": "insert", "element": { "type": "button", "text": "Browse all" }, "afterId": "mp-card-linear" }
  ],
  "note": "Re: make the label feel more timely",
  "actor": { "kind": "ai", "name": "Claude" },
  "baseVersion": 41
}
```

`baseVersion` is optional. When present and stale, the server returns `409`.

**Response `200`**

```json
{
  "version": 42,
  "results": [{ "id": "mp-section-label" }, { "id": "button-1a2b3c4d" }],
  "touchedIds": ["mp-section-label", "button-1a2b3c4d"],
  "htmlWriteError": null,
  "review": { "score": 100, "counts": { "error": 0, "warn": 0, "info": 0 }, "findings": [], "htmlInSync": true }
}
```

**Errors:** `400 { "error": "op 1 (update): unknown field \"colour\"", "index": 1 }` · `400 { "error": "result is invalid: …" }` · `409 { "error": "page changed (version 43, you had 41); GET /page and retry", "version": 43 }`

### `GET /page/review`

```json
{
  "version": 42,
  "preset": "marketplace",
  "htmlInSync": true,
  "score": 95,
  "counts": { "error": 0, "warn": 1, "info": 0 },
  "findings": [
    {
      "id": "min-font-size:note-1",
      "rule": "min-font-size",
      "severity": "warn",
      "elementId": "note-1",
      "message": "note-1: 10px text is hard to read",
      "fix": [{ "op": "update", "id": "note-1", "set": { "fontSize": 12 } }]
    }
  ]
}
```

### `GET /page/events`

Server-Sent Events. The first frame is `{"type":"hello","version":42}`, and a comment ping follows every 25s.

| `type` | Payload |
|--------|---------|
| `change` | `at, version, actor{kind,name}, origin, note, summary[], touchedIds[], ops (resolved, or null for whole-config writes), config, preset` |
| `request` | `request` (see below) after create / reply / status change |

### `GET /page/activity`

`{ "activity": [ …change entries without config/ops, newest first, max 100… ] }`. The list is kept in memory and resets when the server restarts.

### `GET /page/requests?status=open|done`

`{ "requests": [{ "id", "text", "elementId", "target", "intent", "status": "open"|"done", "reply", "created_at", "updated_at" }] }`, newest first. `target` and `intent` are `null` for JSON-board requests.

### `POST /page/requests`

Body `{ "text": "Make this pop", "elementId": "hero-title" }` for the JSON board. For an element in your own app (sent by the overlay), use `{ "text", "target": {…}, "intent": { "changes", "feel" } }` instead. `elementId` and `target` are mutually exclusive, and both are optional. Text is capped at 2000 characters. The full `target`/`intent` shape and its limits (`FEEL_WORDS`, at most 30 changes, relative `source.file`) are in [PROJECT_OVERLAY.md](PROJECT_OVERLAY.md#request-shape-a-validates-c-sends-agent-reads). Returns `201 { "request": … }`. Errors: `400 { "error": "text is required" }`, and `400 { "error": "…" }` for a bad `target`/`intent`.

### `GET /overlay.js`

Serves `packages/overlay/overlay.js` for apps that don't use Vite. Add `<script type="module" src="http://localhost:3001/overlay.js" data-api="http://localhost:3001"></script>`. You get select, inspect, and Ask agent. Apply is off because there's no dev server to write files.

## Dev-server endpoints (vite-plugin-editlayer)

These live on your app's Vite dev server, not on :3001: `GET /__editlayer/overlay.js`, `POST /__editlayer/apply`, `POST /__editlayer/undo`, and `GET|PUT /__editlayer/brief`. They answer on loopback only. Contracts and status codes are in [PROJECT_OVERLAY.md](PROJECT_OVERLAY.md#dev-server-endpoints-b-implements-in-configureserver-c-calls-same-origin).

### `PATCH /page/requests/:id`

Body `{ "reply"?: string, "status"?: "open" | "done" }`. Returns `{ "request": … }`, or `404` for an unknown id.

---

## Snapshot Endpoints (Phase 13)

### `GET /page/snapshots`

List saved snapshots (metadata only).

**Response `200`**

```json
{
  "snapshots": [
    {
      "id": "uuid",
      "name": "Before hero tweak",
      "preset": "demo",
      "created_at": "2026-06-19T12:00:00.000Z"
    }
  ]
}
```

---

### `POST /page/snapshots`

Save the current live page config as a named snapshot.

**Body**

```json
{ "name": "Before hero tweak" }
```

**Response `201`**

```json
{
  "snapshot": {
    "id": "uuid",
    "name": "Before hero tweak",
    "preset": "demo",
    "created_at": "2026-06-19T12:00:00.000Z"
  }
}
```

---

### `DELETE /page/snapshots/:id`

Remove a snapshot.

**Response `200`**

```json
{ "ok": true }
```

**Response `404`** — snapshot not found.

---

### `POST /page/snapshots/:id/restore`

Load a snapshot into the live page row (updates config, preset, source_path). Client applies returned config as one undo entry.

**Response `200`**

```json
{
  "config": { "elements": [] },
  "preset": "demo",
  "source_path": "client/public/pages/demo.html",
  "updated_at": "2026-06-19T12:05:00.000Z",
  "htmlWriteError": null
}
```

---

## Asset Endpoints

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

---

### `GET /assets`

List uploaded image files with metadata.

**Response `200`**

```json
{
  "assets": [
    {
      "filename": "uuid.png",
      "url": "http://localhost:3001/assets/uuid.png",
      "size": 12345,
      "mtime": "2026-06-19T12:00:00.000Z"
    }
  ]
}
```

---

### `DELETE /assets/:filename`

Delete an uploaded image from disk.

**Response `200`**

```json
{ "ok": true }
```

**Response `404`** — file not found.

---

### `GET /assets/:filename`

Serve uploaded images (static).

---

## Client-side export/import

- **Export:** toolbar downloads current config as JSON (no API call).
- **Import:** client reads JSON file, validates `elements[]`, applies config via local state (one undo entry); next auto-save calls `PUT /page`.

---

## Auth

None in the MVP (local, single user). Auth is required before multi-user use — parked.

---

## Future API (drafts)

See [SPEC.md](SPEC.md) Future Scope:

**Multi-page (Phase 16)** — routes become slug-based (`GET/PUT /pages/:slug`); snapshots scope per page.

**AI path (Phase 18)** — shipped as the co-worker endpoints. Still open: a natural language → ops endpoint.

**Auth (Phase 19)** — protects all writes (`PUT`/`POST`/`DELETE`) via session or bearer token.
