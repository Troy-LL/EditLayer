# API

See [architecture.md](architecture.md). Single-page editor with snapshots, HTML write-back, and asset management.

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

Save the updated config. After SQLite write, runs `configToHtml(config)` and overwrites `source_path` when configured.

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
{
  "updated_at": "2026-06-18T13:25:00.000Z",
  "htmlWriteError": null
}
```

When HTML write fails but JSON saved:

```json
{
  "updated_at": "2026-06-18T13:25:00.000Z",
  "htmlWriteError": "Path outside project root"
}
```

**Response `400`**

```json
{ "error": "config is required and must be an object with elements[]" }
```

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

See [spec.md](spec.md) Future Scope:

**Multi-page (Phase 16)** — routes become slug-based (`GET/PUT /pages/:slug`); snapshots scope per page.

**AI path (Phase 18)** — same page/config endpoints with server-side schema validation.

**Auth (Phase 19)** — protects all writes (`PUT`/`POST`/`DELETE`) via session or bearer token.
