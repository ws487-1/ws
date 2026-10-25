/* Live accounts: filing history (accounts) → document API metadata → iXBRL content → IXBRL.parse.
   Uses the user's own key from Settings. The content download redirects to Amazon S3; if the browser blocks it, the chart falls back to the list of filings. */
(function (root) {
  'use strict';
  const API = 'https://api.company-information.service.gov.uk', DOC = 'https://document-api.company-information.service.gov.uk/document/';
  const auth = () => ({ Authorization: 'Basic ' + btoa(root.Live.getKey() + ':') });
  async function accounts(n, max = 6) {
    n = String(n).trim().toUpperCase().padStart(8, '0');
    const fh = await (await fetch(`${API}/company/${n}/filing-history?category=accounts&items_per_page=12`, { headers: auth() })).json();
    const docs = []; let blocked = 0;
    for (const it of (fh.items || []).slice(0, max)) {
      const id = (it.links && it.links.document_metadata || '').split('/').pop(); if (!id) continue;
      const d = { date: it.date, type: it.type, madeUp: it.description_values && it.description_values.made_up_date, id, formats: [] };
      try {
        const meta = await (await fetch(DOC + id, { headers: auth() })).json(); d.formats = Object.keys(meta.resources || {});
        if (d.formats.includes('application/xhtml+xml')) {
          try { const x = await (await fetch(DOC + id + '/content', { headers: { ...auth(), Accept: 'application/xhtml+xml' } })).text(); const p = root.IXBRL.parse(x); d.periods = p.periods; d.factCount = p.facts.length; } catch (e) { blocked++; }
        }
      } catch (e) { blocked++; }
      docs.push(d);
    }
    return { number: n, docs, blocked };
  }
  root.LiveAccounts = { accounts };
})(window);
