# Company card prototype

Live: https://wills.im/pson/prosper/app/test/cards/ (prototype only; the live app at `/pson/prosper/app/` is untouched).

Raw Companies House API responses → `normalise.js` (pure functions, view models) → `components.js` (HTML components) → `layouts.js` (three options). `styles.css` is the design system (tokens, then components, then layouts).

- **Offline by default:** `fixtures.js` bundles raw public CH API JSON for 5 companies of different shapes (large PLC with no PSCs because it is exempt, a company in liquidation with charges, a tiny dormant company proposed for strike-off, a dissolved company, a small company with charges and PSCs). No keys are in any file.
- **Live look-ups:** enter a company number. They use your own CH key from Settings, which is stored only in this browser's localStorage, in the same slot as the app (`prosper.key.ch`).
- **Normaliser:** every input field is optional, and every output field has a fixed type. Error/404 responses are treated as missing data. Templates come from CH's api-enumerations, with readable fallbacks. It also surfaces data the current app hides: officer nationality, country of residence, birth month/year, age, ID-verification status, other appointments; year end and the last/next accounts periods; PSC exemptions and statements that explain an empty PSC register; charge particulars (fixed, floating over all assets, negative pledge) and lender names with the address stripped; insolvency case numbers and practitioner roles; filing resolutions; registers, UK establishments and overseas details.
- **Occupation** is handled, but in 2026 the officers list endpoint did not return it for any company tested.

## Layouts
- **A · Stacked:** one 920px column. Header, 8 key-fact tiles, then each component as a full-width section. Easiest to read top to bottom; long for big companies.
- **B · Bento:** a 1240px header card over a 12-column grid of self-contained tiles sized by importance (facts, AI and deadlines, people and ownership, changes and charges, filings and similar, details). Best overview at a glance; tiles have uneven heights when the data is lopsided.
- **C · Tabbed:** compact header, an 8-fact strip, sticky anchored tabs with counts, a left rail (deadlines, officer changes) and dense tables. Highest density; suits power users and big PLCs; busier on first look.

**Recommendation: B for the default company view, with C's sticky tab bar added for long companies.** B makes the shape of a company obvious in one screen (a dormant shell, a lender-heavy SME, a liquidation). Every tile is an independent component, so tiles can be reordered, or hidden when empty, without breaking the layout.
