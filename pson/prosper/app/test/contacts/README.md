# Contact details pipeline (prototype)

Finds the business contact details a UK company publishes about itself, and says how sure we are that the website is really theirs.

The page `index.html` shows a saved test run on real small UK companies (`fixture.json`). The code is in `pipeline/contacts.js`. It is plain Node 18+ with no dependencies.

## Stages

1. **Companies House.** We read the company profile and registered office. Inactive companies stop here.
2. **Own website.** We try the domain a website given to us, then the obvious domains made from the name (`name.co.uk`, `.com`, `.uk`, with and without hyphens). A site is only accepted if it shows something about the company. We then read up to four pages (home, contact, about, privacy or terms) and extract:
   - landline and non-geographic phone numbers (from `tel:` links and text);
   - role email addresses (info@, sales@, hello@ …);
   - addresses with a UK postcode.
   Every value keeps the URL of the page it came from.
3. **Web search (optional).** If no site is found and a Serper key is set, one search for the name and town is run, and the top non-directory results go through stage 2. Each search costs one Serper credit, so it is off by default.

## Confidence

- **Confirmed**: the company number is on the site, or the legal name and the registered office postcode both are.
- **Likely**: either the legal name or the registered office postcode is on the site, but not both.
- **Not verified** (greyed): only the trading name matches. Do not use it without checking.

## Running it

```
CH_KEY=… node pipeline/contacts.js 01234567 [https://known-website.example/]
SERPER_KEY=… CH_KEY=… node pipeline/contacts.js 01234567
```

Or call `require('./pipeline/contacts.js').findContacts(number, { chKey, serperKey, website })`. Keys are only read from the environment or from arguments. They are never logged or stored.

The live version would run server-side, in a queue. Browsers cannot read other sites, because of CORS, and a single queue makes rate limits enforceable.

## Compliance notes

- **Business details only.** We collect switchboard or landline numbers, role email addresses and business addresses that the company publishes about itself. Named-person emails (such as jane.smith@) and mobile numbers are skipped and not stored, because they are personal data. We count them, but we don't keep them.
- **No sole traders.** Only registered companies, LLPs and partnerships are looked up, using a Companies House number. Sole traders and ordinary partnerships are individuals under PECR and UK GDPR, so they are out of scope.
- **PECR.** Corporate subscribers can be sent B2B marketing email without prior consent. Every message must still identify the sender and offer a simple opt-out, and opt-outs must be honoured and suppressed. Before calling a number, check it against the TPS and CTPS.
- **UK GDPR.** We keep the source URL and the check date for every value, so a record can be traced, refreshed or deleted on request. We keep no page content, only the extracted values.
- **robots.txt.** It is read before any page on a site. Disallowed paths are skipped. If robots.txt itself returns a server error, we treat the whole site as off-limits.
- **Rate limits.** We wait 1.5 s between requests to the same site, read at most four pages per company, and give up on a page after 9 s. Companies House calls are paced at 600 ms (its limit is 600 per 5 minutes). Requests identify themselves with the `ProsperContacts/0.1` user agent and a link to this page.
- **No social networks or directories.** LinkedIn, Facebook, directory and credit-reference sites are never fetched. Search results pointing to them are dropped.
