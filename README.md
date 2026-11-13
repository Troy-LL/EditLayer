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

## Use it on your own app

Figma on top of the project you already have, without leaving localhost. Add one plugin line to your Vite React app:

```js
import editlayer from "<path-to-EditLayer>/packages/vite-plugin-editlayer/index.js";
export default { plugins: [editlayer(), react()] };   // editlayer() first
```

Press **E** on your page, then select anything.
- **Apply to code** writes small tweaks (padding, color, static text) straight into your JSX. Vite hot-reloads, Undo restores the file, and no prompt is spent.
- **Ask agent** sends a precise request to your Cursor agent: the source file:line, the component, your previewed tweaks, and feel words like *tighter* or *premium*. Its reply shows as a pin on the element.

Try it on the bundled example (`examples/storefront`, port 5180). See [docs/PROJECT_OVERLAY.md](docs/PROJECT_OVERLAY.md).

```bash
npm run e2e:overlay   # real-browser check of the whole loop
```

Spec, design, and API notes are in [docs/](docs/).
