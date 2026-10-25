# Search (prototype)

Command-palette search for Prosper: Ctrl/⌘K or `/` opens one box for company names and numbers, officers and registered addresses.

- `search.js`: builds an index from card view models (`Normalise.company`) plus simple company rows, and ranks by word-prefix matches. A company-number pattern gets a direct "Open/Look up" row.
- Offline it uses the saved fixtures (6 full records, their officers, related and similar companies) and the 143 new incorporations from `../alerts/new-fixture.js`.
- With the user's own Companies House key (Settings, stored in this browser only), company and officer results are added live from `/search/companies` and `/search/officers`. Companies House has no address search endpoint, so address search stays offline.
- Recent searches live in `localStorage` (`prosper.test.search.recent`).
- Keys: ↑/↓ move, Enter open (Ctrl/⌘+Enter for a new tab), Tab/Shift+Tab change scope, Esc clears, then closes.
- Demo states: `?q=…`, `?state=loading`, `?state=error`, `?open=0`.
