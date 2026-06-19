# AGENTS.md

## Cursor Cloud specific instructions

Visual UI editor with two services that must both run for the editor to work end to end:

| Service | Dir | Dev command | Port | Notes |
|---------|-----|-------------|------|-------|
| API server | `server/` | `npm start` (or `npm run dev` for `--watch`) | 3001 | Express + Node's built-in SQLite |
| Web client | `client/` | `npm run dev` | 5173 | Vite + React |

Standard commands live in `docs/DEVELOPMENT.md` (Local dev) and the `scripts` blocks of each `package.json`. Build the client with `npm run build` in `client/`. There is no automated test suite or lint config in this repo.

Non-obvious gotchas:

- **Node built-in SQLite**: the server runs with `node --experimental-sqlite` (already baked into the `server` npm scripts) and requires Node ≥ 22.5. Do not strip that flag — `node:sqlite` is unavailable without it.
- **Client API base is hardcoded** to `http://localhost:3001` in `client/src/api.js`. The server must be running or the client's auto-save fails (toolbar shows "Save failed") even though the page still renders.
- **SQLite DB** lives at `server/data.db` (gitignored) and is auto-created/seeded on first server start. The whole app shares one `page` row.
- **Preset tabs replace saved state**: switching Demo ↔ MCP Marketplace in the toolbar calls `POST /page/preset`, which overwrites the saved config with that preset's seed. Edits can look "reverted" after switching presets — this is intentional. Wait for "Saved" in the toolbar before reloading.
- Uploaded images go to `server/assets/` (gitignored) and are served at `GET /assets/<file>`.
