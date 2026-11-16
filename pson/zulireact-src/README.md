# Zuli (React)

React + Tailwind v4 + shadcn/ui (Radix) rebuild of /pson/zuli, built with Vite to static files.

- Source: this folder. Built output: `../zulireact/` (committed; GitHub Pages serves the repo as-is).
- Build: `npm ci && npm run build` (writes `../zulireact/`, base `/pson/zulireact/`).
- Routing: hash routes (`#/company/09446231`), so deep links work on Pages without rewrites.
- Data layer: `src/legacy/` is the unchanged normalise.js, charts.js and enums.js from /pson/zuli.
- Storage: same localStorage keys as /pson/zuli (`prosper.key.ch`, `prosper.saved`, `prosper.viewed`, `zuli3.tweaks`, ...).
