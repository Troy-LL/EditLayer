# EditLayer

Drop-in visual editor for a React app. Toggle edit, drag and restyle, save to a database.

The layout is JSON. A person can drag it. A model can write the same file.

Overlay handles are still in comparison (`?overlay=A|B|C`, default **A**):
transform-only bugfix, not “real HTML done.” Flex/grid nest fails. See
[docs/COMPARE.md](docs/COMPARE.md). Do not read that as positioned-trees-only (C).

## Run

```bash
cd server && npm install && npm run dev
```

```bash
cd client && npm install && npm run dev
```

## Work with an AI co-worker

The AI edits the same live page you have open, like a second cursor on a Figma board.
Leave a request in **Co-worker → Requests**. The agent picks it up through the
`editlayer` MCP server (`.cursor/mcp.json`). You'll see its edits appear with a violet
outline, and one Ctrl+Z undoes each change. See [docs/COWORKER.md](docs/COWORKER.md).

```bash
npm test          # unit + scenario tests
npm run check     # quality gate on every preset (needs both dev servers running)
```

Spec, design, and API notes are in [docs/](docs/).
