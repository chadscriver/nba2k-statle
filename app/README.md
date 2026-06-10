# NBA 2K Statle — web app

Vite + React build of the game. The component lives in `src/App.jsx`; the player
pool it scores against is `src/pool.json`.

## Run locally

```bash
cd app
npm install
npm run dev
```

Open the localhost URL it prints (default http://localhost:5173).

## Build for production

```bash
npm run build      # outputs static files to app/dist
npm run preview    # serve the production build locally to sanity-check
```

## Deploy

- **Vercel / Netlify**: point the project at this repo, set the root/base
  directory to `app`, build command `npm run build`, output directory `dist`.
- **GitHub Pages**: build and publish `app/dist`. `vite.config.js` sets
  `base: './'` so relative asset paths work even under a project subpath.

## Data note (read before you trust the pool)

`src/pool.json` is a **derived snapshot** — the top 10 players per team, trimmed
to exactly the fields the scoring formula needs (category rollups, the individual
sub-attributes per category, intangibles, height, and badge-tier counts).

It does **not** auto-update when the daily scrape refreshes `../data/nba2k26.json`.
The two will drift over time.

TODO (good first Claude Code task): add a build step — e.g. `scripts/build-pool.mjs`
— that reads `../data/nba2k26.json`, applies the same transform that produced this
file, and regenerates `src/pool.json` so the game stays in sync with the scraper.
