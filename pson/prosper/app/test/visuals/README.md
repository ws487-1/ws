# Visuals prototype

Live: https://wills.im/pson/prosper/app/test/visuals/. All charts are hand-written SVG; no chart libraries.

- **Who's connected:** the company at the centre, with current officers and PSCs around it. People who are both an officer and a PSC are merged into one node. The outer ring shows the officers' other companies, and companies shared by 2+ people are highlighted. Click an outer company to open it.
- **Timeline:** filings as dots by category, plus Gantt bars for officers, PSCs and charges, and markers for insolvency events. For old companies (e.g. Tesco, 1947), the axis starts a year before the earliest event on record.
- **Accounts trend:** `ixbrl.js` is a pure iXBRL reader. It takes non-dimensional `ix:nonFraction` facts and maps FRS 102/105 and IFRS concepts to turnover, profit, net assets, cash and so on. Each filing contains two years, and newer filings win.
  - Offline, `accounts.js` holds figures pre-read from the document API (public data, no keys).
  - Live look-ups use your Settings key against the document API. Its metadata endpoint allows cross-site requests; the content download redirects to Amazon S3 and may be blocked in the browser, in which case the page lists the filings instead.
  - Fallbacks: PDF-only accounts (large PLCs such as Tesco, older filings) and micro-entity balance-sheet-only filings are explained in plain English.
