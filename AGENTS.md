# EditLayer — Agent Guide

Drop-in visual editor for a React app. Toggle edit, drag and restyle, save to a database.
The layout is JSON. A person can drag it. A model can write the same file.

## Run locally

```bash
cd server && npm install && npm run dev   # API on http://localhost:3001
cd client && npm install && npm run dev   # Vite on http://localhost:5173
```

## Philosophy: "it just makes sense"

We build for design engineers, but everything we ship must feel obvious.
If a user has to think about how the editor works, we got it wrong.
That applies to both product UX **and** code structure:

- Predictable over clever. A component's name, props, and file location should be guessable.
- The JSON layout is the source of truth — a human drags it, a model writes it, both must stay valid.
- Small details compound: easing, durations, borders, shadows. Never hand-roll motion or styling decisions without consulting the skills below.

## Skills to use (in `.agents/skills/`)

Load these instead of improvising on UI/motion decisions:

| Task | Skill |
|---|---|
| Building any animation from scratch | `animate` |
| General design-engineering judgment | `emil-design-eng` |
| Reviewing animations critically | `review-animations` |
| Auditing existing animations in the codebase | `improve-animations` |
| Deciding what deserves motion (and what doesn't) | `find-animation-opportunities` |
| Choosing easing/duration vocabulary precisely | `animation-vocabulary` |
| Apple-style fluid interface principles | `apple-design` |
| Picking a UI library instead of hand-rolling | `pick-ui-library` |
| Building multiple versions of a UI piece | `prototype` |
| Reviewing UI against interface guidelines | `web-design-guidelines` |
| React/Next.js performance patterns | `vercel-react-best-practices` |

Rule of thumb: if you're about to write a transition, shadow, border, or layout
component and you're choosing values by instinct — stop and load the relevant skill first.

## Codebase map

- `client/` — React + Vite editor frontend
- `server/` — Express API (`index.js`), SQLite persistence (`db.js`, `data.db`),
  HTML export (`configToHtml.js`), path utilities (`pathUtils.js`)
- `docs/` — spec, design, architecture, API notes
