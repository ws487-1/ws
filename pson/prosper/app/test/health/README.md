# Company health prototype

Live: https://wills.im/pson/prosper/app/test/health/

This is a plain-English read of how risky a company looks, using only the Companies House record. `health.js` is pure and tested in Node: `Health.assess(raw, vm, accountsSeries)` returns a level, a 0 to 100 concern score and eight signals. Each signal carries its finding, the exact rule, and the items on record behind it.

| Signal | Points |
|---|---|
| Status and insolvency | In insolvency now +60; past case +15; dissolved is shown as "Closed" and not scored |
| Strike-off | Active compulsory proposal +30; voluntary +20; past notice +5 |
| Filing on time | Accounts overdue +20; confirmation statement overdue +10; late history +6 per set of accounts, +2 per confirmation statement (history capped at +15) |
| Charges | Outstanding +3; over all assets +4; 5 or more +3; new in the last 12 months +3 |
| Director changes (12 months) | 3+ leavers or churn ≥ board size +10; 2+ changes +5; no directors +15 |
| Age | Under 1 year +10; under 2 +6; under 3 +3 |
| Accounts | Dormant +4; net liabilities +10; net assets more than halved +4 (iXBRL figures only) |
| Address and ownership | Disputed or undeliverable office +8 each; ownership unexplained +4; sanctioned PSC +25 |

Bands: 0 to 14 is low concern, 15 to 39 some concern, 40 or more high concern. The wording describes the record, never the people involved, and uses "Likely" rather than "Probably". Late filings are judged against the usual deadlines (9 months, 6 for a PLC, 21 months for first accounts, 14 days for confirmation statements) on the filings loaded. Extensions aren't visible, which the page says.
