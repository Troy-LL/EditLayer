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

Spec, design, and API notes are in [docs/](docs/).
