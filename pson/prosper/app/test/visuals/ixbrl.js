/* Minimal inline-XBRL (iXBRL) reader for UK company accounts. Pure function over the XHTML text, no DOM needed.
   Reads the numeric facts (ix:nonFraction) that are not split by a dimension, resolves their period from the
   context, and maps the common FRS 102 / FRS 105 / IFRS concepts to a few headline metrics. */
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.IXBRL = factory(); })(this, function () {
  'use strict';
  const METRICS = [
    ['turnover', 'Turnover', ['TurnoverRevenue', 'Revenue', 'RevenueFromContractsWithCustomers', 'Turnover']],
    ['grossProfit', 'Gross profit', ['GrossProfitLoss', 'GrossProfit']],
    ['operatingProfit', 'Operating profit', ['OperatingProfitLoss', 'ProfitLossFromOperatingActivities']],
    ['profit', 'Profit after tax', ['ProfitLoss', 'ProfitLossForPeriod', 'ProfitLossAttributableToOwnersOfParent', 'ProfitLossOnOrdinaryActivitiesAfterTax']],
    ['netAssets', 'Net assets', ['NetAssetsLiabilities', 'Equity', 'NetAssetsLiabilitiesIncludingPensionAssetLiability', 'TotalEquity']],
    ['cash', 'Cash', ['CashBankOnHand', 'CashCashEquivalents', 'CashAndCashEquivalents', 'CashBankInHand']],
    ['currentAssets', 'Current assets', ['CurrentAssets']],
    ['fixedAssets', 'Fixed assets', ['FixedAssets', 'PropertyPlantEquipment', 'NoncurrentAssets']],
    ['creditorsShort', 'Creditors due within a year', ['CreditorsDueWithinOneYear', 'Creditors']],
    ['employees', 'Employees', ['AverageNumberEmployeesDuringPeriod', 'AverageNumberOfEmployees']],
  ];
  const strip = (s) => s.replace(/<[^>]*>/g, '').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').trim();
  const attr = (tag, name) => { const m = tag.match(new RegExp('\\s' + name + '\\s*=\\s*"([^"]*)"', 'i')) || tag.match(new RegExp('\\s' + name + "\\s*=\\s*'([^']*)'", 'i')); return m ? m[1] : null; };

  function contexts(x) {
    const out = {};
    const re = /<(?:xbrli:)?context\b([^>]*)>([\s\S]*?)<\/(?:xbrli:)?context>/gi; let m;
    while ((m = re.exec(x))) {
      const id = attr(m[1], 'id'), b = m[2];
      const g = (t) => { const r = b.match(new RegExp('<(?:xbrli:)?' + t + '>\\s*([^<\\s]+)\\s*<', 'i')); return r ? r[1] : null; };
      out[id] = { start: g('startDate'), end: g('endDate') || g('instant'), instant: !!g('instant'), dims: /explicitMember|typedMember/i.test(b) };
    }
    return out;
  }
  function num(tag, inner) {
    const fmt = (attr(tag, 'format') || '').toLowerCase();
    let t = strip(inner);
    if (/zero|nocontent|fixed-zero/.test(fmt) || t === '-' || t === '—' || t === '') return 0;
    if (/comma.?decimal/.test(fmt)) t = t.replace(/[.\s]/g, '').replace(',', '.'); else t = t.replace(/[,\s]/g, '');
    let v = parseFloat(t.replace(/[^0-9.\-]/g, ''));
    if (!isFinite(v)) return null;
    const sc = parseInt(attr(tag, 'scale') || '0', 10); if (sc) v *= Math.pow(10, sc);
    if (attr(tag, 'sign') === '-') v = -v;
    return v;
  }
  /** parse(xhtml) → { facts: [{name, end, start, value}], periods: [{end, start, values: {metric: number}}], meta } */
  function parse(x) {
    x = String(x || '');
    const ctx = contexts(x), facts = [];
    const re = /<ix:nonFraction\b([^>]*)>([\s\S]*?)<\/ix:nonFraction>/gi; let m;
    while ((m = re.exec(x))) {
      const c = ctx[attr(m[1], 'contextRef')]; if (!c || c.dims || !c.end) continue;
      const name = (attr(m[1], 'name') || '').split(':').pop(); const value = num(m[1], m[2]);
      if (value == null) continue;
      facts.push({ name, start: c.start, end: c.end, value });
    }
    const byEnd = {};
    for (const [key, , names] of METRICS) {
      for (const f of facts) {
        if (!names.includes(f.name)) continue;
        const p = (byEnd[f.end] = byEnd[f.end] || { end: f.end, start: null, values: {} });
        if (f.start) p.start = p.start || f.start;
        const rank = names.indexOf(f.name);
        if (!(key in p.values) || rank < (p._r || {})[key]) { p.values[key] = f.value; (p._r = p._r || {})[key] = rank; }
      }
    }
    const periods = Object.values(byEnd).map((p) => ({ end: p.end, start: p.start, values: p.values })).sort((a, b) => a.end.localeCompare(b.end));
    const nm = x.match(/name="[^"]*:EntityCurrentLegalOrRegisteredName"[^>]*>([\s\S]*?)<\/ix:nonNumeric>/i);
    return { facts, periods, meta: { entity: nm ? strip(nm[1]) : '' } };
  }
  /** merge([parse(), …]) → one series per period end, newer documents winning (they restate prior years). */
  function merge(list) {
    const by = {};
    for (const r of list.slice().sort((a, b) => String(a.filed || '').localeCompare(String(b.filed || '')))) for (const p of r.periods) by[p.end] = { end: p.end, start: p.start || (by[p.end] && by[p.end].start), values: Object.assign({}, by[p.end] && by[p.end].values, p.values) };
    return Object.values(by).sort((a, b) => a.end.localeCompare(b.end));
  }
  return { parse, merge, METRICS: METRICS.map(([key, label]) => ({ key, label })) };
});
