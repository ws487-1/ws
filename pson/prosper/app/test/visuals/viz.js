/* Prosper visuals prototype: hand-written SVG charts over the normalised view model (../cards/normalise.js).
   No chart libraries. Each function returns an HTML/SVG string. */
(function (root) {
  'use strict';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const MON = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
  /** '26 Oct 2017' | '2017-10-26' → ms since epoch (UTC) or NaN */
  function t(s) {
    s = String(s || '').trim(); let m;
    if ((m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s))) return Date.UTC(+m[1], +m[2] - 1, +m[3]);
    if ((m = /^(\d{1,2}) ([A-Z][a-z]{2}) (\d{4})$/.exec(s))) return Date.UTC(+m[3], MON[m[2]], +m[1]);
    return NaN;
  }
  const NOW = Date.now();
  const yr = (ms) => new Date(ms).getUTCFullYear();
  const keyName = (n) => String(n || '').toLowerCase().replace(/^(mr|mrs|ms|miss|dr|sir|dame|lord|lady)\.?\s+/, '').replace(/[^a-z ]/g, '').split(/\s+/).filter(Boolean).sort().join(' ');
  const short = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);
  const tidyCo = (s) => String(s || '').replace(/\b(LIMITED|LTD|PLC|LLP)\b\.?$/i, (x) => x.toUpperCase() === 'LIMITED' ? 'Ltd' : x.toUpperCase() === 'PLC' ? 'plc' : x).replace(/\B[A-Z]+/g, (w) => w.toLowerCase()).replace(/'S\b/g, "'s");

  /* ---------- 1. Network: company ↔ people (officers, PSCs) ↔ their other companies ---------- */
  function network(vm, o = {}) {
    const W = o.width || 1160, H = o.height || 600, cx = W / 2, cy = H / 2;
    const people = new Map();
    const add = (k, p) => { const e = people.get(k) || { key: k, name: p.name, roles: new Set(), officer: null, psc: null, corporate: !!p.corporate }; people.set(k, e); return e; };
    for (const p of vm.officers.active) { const e = add(keyName(p.name), p); e.roles.add(p.roleLabel); e.officer = p; }
    for (const p of vm.ownership.current) { const e = add(keyName(p.name), p); e.roles.add('PSC ' + (p.band || '')); e.psc = p; }
    const ppl = [...people.values()].slice(0, 18);
    // Other companies via each officer's appointment list
    const cos = new Map();
    for (const e of ppl) {
      const ap = e.officer && vm.appointments[e.officer.appointmentsLink];
      if (ap) for (const a of ap.items) {
        if (!a.number || a.number === vm.number) continue;
        const c = cos.get(a.number) || { number: a.number, name: a.company, active: false, links: [] };
        c.active = c.active || (!a.resigned && a.statusCode === 'active'); c.links.push({ person: e.key, role: a.role, current: !a.resigned });
        cos.set(a.number, c);
      }
    }
    const outer = [...cos.values()].sort((a, b) => b.links.length - a.links.length || (b.active - a.active)).slice(0, o.maxCompanies || 32);
    const hidden = cos.size - outer.length;
    const rx1 = Math.min(250, W * 0.2), ry1 = Math.min(150, H * 0.26), rx2 = W * 0.36, ry2 = H * 0.43;
    const pos = new Map();
    ppl.forEach((e, i) => { const a = -Math.PI / 2 + (i + 0.5) * (2 * Math.PI / Math.max(ppl.length, 1)); pos.set(e.key, { x: cx + rx1 * Math.cos(a), y: cy + ry1 * Math.sin(a), a }); });
    // Place each outer company near the mean angle of the people it links to, then spread evenly in that order
    const ang = (c) => { const as = c.links.map((l) => pos.get(l.person).a); const sx = as.reduce((s, a) => s + Math.cos(a), 0), sy = as.reduce((s, a) => s + Math.sin(a), 0); return Math.atan2(sy, sx); };
    outer.forEach((c) => { c._a = ang(c); });
    outer.sort((a, b) => a._a - b._a);
    const off = outer.length ? outer[0]._a : 0;
    outer.forEach((c, i) => { const a = off + i * (2 * Math.PI / outer.length); c.x = cx + rx2 * Math.cos(a); c.y = cy + ry2 * Math.sin(a); c.a = a; });
    const edge = [];
    for (const c of outer) for (const l of c.links) { const p = pos.get(l.person); edge.push(`<line class="e2${l.current ? '' : ' old'}" x1="${p.x.toFixed(1)}" y1="${p.y.toFixed(1)}" x2="${c.x.toFixed(1)}" y2="${c.y.toFixed(1)}"/>`); }
    for (const e of ppl) { const p = pos.get(e.key); edge.push(`<line class="e1${e.officer ? '' : ' psc'}" x1="${cx}" y1="${cy}" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(1)}"/>`); }
    const nodes = [];
    nodes.push(`<g class="n0"><rect x="${cx - 92}" y="${cy - 24}" width="184" height="48" rx="12"/><text x="${cx}" y="${cy - 2}" text-anchor="middle" class="t0">${esc(short(tidyCo(vm.name), 24))}</text><text x="${cx}" y="${cy + 14}" text-anchor="middle" class="t0s">${esc(vm.number)} · ${esc(vm.status.label)}</text></g>`);
    for (const e of ppl) {
      const p = pos.get(e.key), right = Math.cos(p.a) >= 0, both = e.officer && e.psc;
      const shape = e.corporate ? `<rect x="${(p.x - 8).toFixed(1)}" y="${(p.y - 8).toFixed(1)}" width="16" height="16" rx="3"/>` : `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="8"/>`;
      const roles = [...e.roles].map((r) => r.trim()).join(' · ');
      nodes.push(`<g class="n1${e.officer ? '' : ' psc'}${both ? ' both' : ''}"><title>${esc(e.name)}: ${esc(roles)}</title>${shape}<text x="${(p.x + (right ? 14 : -14)).toFixed(1)}" y="${(p.y - 1).toFixed(1)}" text-anchor="${right ? 'start' : 'end'}" class="t1">${esc(short(e.name, 26))}</text><text x="${(p.x + (right ? 14 : -14)).toFixed(1)}" y="${(p.y + 12).toFixed(1)}" text-anchor="${right ? 'start' : 'end'}" class="t1s">${esc(short(roles, 34))}</text></g>`);
    }
    for (const c of outer) {
      const right = Math.cos(c.a) >= 0.05, mid = Math.abs(Math.cos(c.a)) < 0.05, shared = new Set(c.links.map((l) => l.person)).size > 1;
      nodes.push(`<g class="n2${c.active ? '' : ' gone'}${shared ? ' shared' : ''}" data-co="${esc(c.number)}"><title>${esc(c.name)} (${esc(c.number)})${shared ? ': shared by ' + new Set(c.links.map((l) => l.person)).size + ' people' : ''}</title><circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="${shared ? 6 : 4.5}"/><text x="${(c.x + (mid ? 0 : right ? 9 : -9)).toFixed(1)}" y="${(c.y + (mid ? (Math.sin(c.a) > 0 ? 16 : -10) : 4)).toFixed(1)}" text-anchor="${mid ? 'middle' : right ? 'start' : 'end'}" class="t2">${esc(short(tidyCo(c.name), 22))}</text></g>`);
    }
    const legend = `<div class="vz-legend"><span><i class="lg-o"></i>Officer</span><span><i class="lg-p"></i>Person with significant control</span><span><i class="lg-b"></i>Both</span><span><i class="lg-c"></i>Other company, active</span><span><i class="lg-g"></i>Dissolved or resigned</span><span><i class="lg-s"></i>Shared by 2+ people</span></div>`;
    const note = [];
    const withAp = ppl.filter((e) => e.officer && vm.appointments[e.officer.appointmentsLink]).length;
    if (vm.officers.active.length && withAp < vm.officers.active.filter((p) => !p.corporate).length) note.push(`Other appointments loaded for ${withAp} of ${vm.officers.active.length} current officers.`);
    if (hidden > 0) note.push(`${hidden} more linked companies not shown.`);
    if (!ppl.length) return `<div class="empty">No current officers or people with significant control on record, so there is nothing to connect.</div>`;
    return `<svg class="vz-net" viewBox="0 0 ${W} ${H}" role="img" aria-label="Network of ${esc(vm.name)}">${edge.join('')}${nodes.join('')}</svg>${legend}${note.length ? `<p class="vz-note">${esc(note.join(' '))}</p>` : ''}`;
  }

  /* ---------- 2. Timeline: lanes for filings, people, ownership, charges, insolvency ---------- */
  function timeline(vm, o = {}) {
    const W = o.width || 1160, L = 190, R = 24, rowH = 18, maxPeople = o.maxPeople || 18;
    const inc = t(vm.created) || NaN, end = t(vm.ceased) || NOW;
    if (!isFinite(inc)) return '<div class="empty">No incorporation date on record.</div>';
    // Old companies: start the axis a year before the earliest event on record, so recent history isn't squashed
    const ev = [].concat(vm.filings.items.map((f) => t(f.dateIso || f.date)), vm.officers.active.concat(vm.officers.former).map((p) => t(p.appointedIso || p.appointed)), vm.ownership.current.concat(vm.ownership.ceased).map((p) => t(p.notified)), vm.charges.items.map((c) => t(c.createdIso || c.created))).filter(isFinite);
    const first = ev.length ? Math.min(...ev) : inc, cut = first - inc > 12 * 365.25 * 864e5;
    const start = cut ? Date.UTC(yr(first) - 1, 0, 1) : inc;
    const y0 = yr(start), y1 = yr(end) + 1, x = (ms) => L + ((ms - Date.UTC(y0, 0, 1)) / (Date.UTC(y1, 0, 1) - Date.UTC(y0, 0, 1))) * (W - L - R);
    const rows = []; let y = 34;
    const lane = (title, sub) => { rows.push(`<text x="0" y="${y + 13}" class="tl-lane">${esc(title)}</text>${sub ? `<text x="0" y="${y + 27}" class="tl-sub">${esc(sub)}</text>` : ''}`); };
    const bar = (a, b, cls, label, tip) => { const xa = x(a), xb = Math.max(x(b), xa + 3); rows.push(`<g class="${cls}"><title>${esc(tip)}</title><rect x="${xa.toFixed(1)}" y="${y + 3}" width="${(xb - xa).toFixed(1)}" height="${rowH - 6}" rx="3"/><text x="${(xa - 6).toFixed(1)}" y="${y + 13}" text-anchor="end" class="tl-lbl">${esc(label)}</text></g>`); y += rowH; };
    // Filings strip
    lane('Filings', vm.filings.items.length < vm.filings.total ? `latest ${vm.filings.items.length} of ${vm.filings.total.toLocaleString('en-GB')}` : `${vm.filings.total}`);
    for (const f of vm.filings.items) { const ms = t(f.dateIso || f.date); if (isFinite(ms)) rows.push(`<circle class="tl-f cat-${esc(f.category)}" cx="${x(ms).toFixed(1)}" cy="${y + 12}" r="4.5"><title>${esc(f.date)}: ${esc(f.title)}</title></circle>`); }
    y += 40;
    // People (Gantt)
    const ppl = vm.officers.active.concat(vm.officers.former).map((p) => ({ p, a: t(p.appointedIso || p.appointed), b: p.resignedIso || p.resigned ? t(p.resignedIso || p.resigned) : end })).filter((r) => isFinite(r.a)).sort((m, n) => (n.b === end) - (m.b === end) || n.a - m.a);
    lane('Officers', `${vm.officers.active.length} current, ${vm.officers.former.length} former`);
    y += 30;
    const shownP = ppl.slice(0, maxPeople);
    for (const r of shownP) bar(Math.max(r.a, start), r.b, r.b === end && !r.p.resigned ? 'tl-b cur' : 'tl-b old', short(r.p.name, 26), `${r.p.name}, ${r.p.roleLabel}: ${r.p.appointed}${r.p.resigned ? ' to ' + r.p.resigned : ' to now'}`);
    if (ppl.length > shownP.length) { rows.push(`<text x="${L - 6}" y="${y + 13}" text-anchor="end" class="tl-sub">+${ppl.length - shownP.length} more former officers</text>`); y += rowH; }
    y += 14;
    // Ownership
    const ps = vm.ownership.current.concat(vm.ownership.ceased).map((p) => ({ p, a: t(p.notified), b: p.ceased ? t(p.ceased) : end })).filter((r) => isFinite(r.a));
    if (ps.length || vm.ownership.explanation) {
      lane('Ownership', ps.length ? `${vm.ownership.current.length} current` : 'none on record'); y += 30;
      for (const r of ps.slice(0, 10)) bar(Math.max(r.a, start), r.b, r.p.ceased ? 'tl-b old psc' : 'tl-b psc', short(r.p.name, 26), `${r.p.name} ${r.p.band ? '(' + r.p.band + ')' : ''}: notified ${r.p.notified}${r.p.ceased ? ', ceased ' + r.p.ceased : ''}`);
      if (!ps.length) { rows.push(`<text x="${L}" y="${y + 13}" class="tl-sub">${esc(short(vm.ownership.explanation, 140))}</text>`); y += rowH; }
      y += 14;
    }
    // Charges
    const cs = vm.charges.items.map((c) => ({ c, a: t(c.createdIso || c.created), b: c.satisfied ? t(c.satisfied) : end })).filter((r) => isFinite(r.a));
    if (cs.length) {
      lane('Charges', `${vm.charges.outstanding} outstanding`); y += 30;
      for (const r of cs.slice(0, 10)) bar(r.a, r.b, r.c.outstanding ? 'tl-b chg' : 'tl-b old', short(r.c.entitled[0] || r.c.title, 26), `${r.c.entitled.join(', ') || r.c.title}: created ${r.c.created}${r.c.satisfied ? ', satisfied ' + r.c.satisfied : ', ' + r.c.statusLabel.toLowerCase()}`);
      if (cs.length > 10) { rows.push(`<text x="${L - 6}" y="${y + 13}" text-anchor="end" class="tl-sub">+${cs.length - 10} more charges</text>`); y += rowH; }
      y += 14;
    }
    // Insolvency markers
    const ins = []; for (const c of vm.insolvency.cases) for (const d of c.dates) { const ms = t(d.date); if (isFinite(ms)) ins.push({ ms, label: `${c.type}: ${d.label} ${d.date}` }); }
    if (ins.length) { lane('Insolvency'); for (const i of ins) rows.push(`<path class="tl-ins" d="M${x(i.ms).toFixed(1)} ${y + 3} l7 12 h-14z"><title>${esc(i.label)}</title></path>`); y += 36; }
    const Ht = y + 10;
    // Year grid
    const step = Math.max(1, Math.ceil((y1 - y0) / 14)); const grid = [];
    for (let yy = y0; yy <= y1; yy += step) { const gx = x(Date.UTC(yy, 0, 1)); grid.push(`<line class="tl-grid" x1="${gx.toFixed(1)}" x2="${gx.toFixed(1)}" y1="22" y2="${Ht}"/><text class="tl-yr" x="${gx.toFixed(1)}" y="14" text-anchor="middle">${yy}</text>`); }
    const marks = [`<line class="tl-now" x1="${x(end).toFixed(1)}" x2="${x(end).toFixed(1)}" y1="22" y2="${Ht}"/><text class="tl-yr strong" x="${x(end).toFixed(1)}" y="${Ht + 14}" text-anchor="middle">${vm.ceased ? 'Ceased' : 'Today'}</text>`, `<line class="tl-now" x1="${x(start).toFixed(1)}" x2="${x(start).toFixed(1)}" y1="22" y2="${Ht}"/><text class="tl-yr strong" x="${x(start).toFixed(1)}" y="${Ht + 14}" text-anchor="${cut ? 'start' : 'middle'}">${cut ? '‹ Incorporated ' + yr(inc) + ', earlier history not on record' : 'Incorporated'}</text>`];
    return `<svg class="vz-tl" viewBox="0 0 ${W} ${Ht + 22}" role="img" aria-label="Timeline of ${esc(vm.name)}">${grid.join('')}${marks.join('')}${rows.join('')}</svg>`;
  }

  /* ---------- 3. Accounts trend: small multiples from iXBRL figures ---------- */
  const money = (v) => { const a = Math.abs(v), s = v < 0 ? '−' : ''; return a >= 1e9 ? `${s}£${(a / 1e9).toFixed(1)}bn` : a >= 1e6 ? `${s}£${(a / 1e6).toFixed(1)}m` : a >= 1e4 ? `${s}£${Math.round(a / 1e3)}k` : `${s}£${Math.round(a).toLocaleString('en-GB')}`; };
  function accounts(acc, vm, METRICS) {
    const docs = (acc && acc.docs) || [];
    const series = root.IXBRL.merge(docs.filter((d) => d.periods && d.periods.length).map((d) => ({ filed: d.date, periods: d.periods })));
    const pdf = docs.filter((d) => !(d.periods && d.periods.length));
    const srcList = docs.length ? `<details class="vz-src"><summary class="more">Sources: ${docs.length} accounts filings, ${docs.length - pdf.length} machine-readable</summary><table class="table"><thead><tr><th>Filed</th><th>Type</th><th>Made up to</th><th>Format</th><th></th></tr></thead><tbody>${docs.map((d) => `<tr><td class="num">${esc(d.date)}</td><td>${esc(d.type)}</td><td class="num">${esc(d.madeUp || '')}</td><td>${d.periods && d.periods.length ? `iXBRL, ${d.factCount} figures` : d.formats.includes('application/xhtml+xml') ? 'iXBRL, no headline figures' : 'PDF only'}</td><td><a href="https://find-and-update.company-information.service.gov.uk/company/${esc(vm.number)}/filing-history" target="_blank" rel="noopener">View</a></td></tr>`).join('')}</tbody></table></details>` : '';
    if (!series.length) {
      const why = !docs.length ? (vm.accounts.lastType ? 'No accounts documents are on record in this sample.' : 'This company has not filed accounts.') : `${docs.length === pdf.length ? 'All recent accounts were filed as PDF (scanned or paper), which can\'t be read automatically.' : 'The accounts were filed without the headline figures tagged.'} The latest accounts type is “${esc(vm.accounts.lastType || 'unknown')}”${vm.accounts.lastMadeUp ? ', made up to ' + esc(vm.accounts.lastMadeUp) : ''}.`;
      return `<div class="empty">${why}</div>${srcList}`;
    }
    const W = 260, H = 120, P = { l: 24, r: 24, t: 14, b: 22 };
    const cards = METRICS.map(({ key, label }) => {
      const pts = series.filter((p) => typeof p.values[key] === 'number').map((p) => ({ end: p.end, v: p.values[key] }));
      if (!pts.length) return '';
      const isEmp = key === 'employees', fmt = isEmp ? (v) => Math.round(v).toLocaleString('en-GB') : money;
      const vs = pts.map((p) => p.v), lo = Math.min(0, ...vs), hi = Math.max(0, ...vs), span = hi - lo || 1;
      const xs = (i) => P.l + (pts.length === 1 ? (W - P.l - P.r) / 2 : (i * (W - P.l - P.r)) / (pts.length - 1)), ys = (v) => P.t + (1 - (v - lo) / span) * (H - P.t - P.b);
      const bw = Math.min(34, (W - P.l - P.r) / pts.length - 8);
      const bars = pts.map((p, i) => { const y0 = ys(0), y1 = ys(p.v); return `<rect class="${p.v < 0 ? 'neg' : ''}${i === pts.length - 1 ? ' last' : ''}" x="${(xs(i) - bw / 2).toFixed(1)}" y="${Math.min(y0, y1).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(1, Math.abs(y1 - y0)).toFixed(1)}" rx="2"><title>${esc(p.end)}: ${esc(fmt(p.v))}</title></rect><text x="${xs(i).toFixed(1)}" y="${H - 6}" text-anchor="middle" class="ax">${esc(p.end.slice(0, 4))}</text>`; }).join('');
      const last = pts[pts.length - 1], prev = pts[pts.length - 2];
      const ch = prev && prev.v ? (last.v - prev.v) / Math.abs(prev.v) : null;
      return `<div class="tile vz-m"><div class="eyebrow">${esc(label)}</div><div class="v num">${esc(fmt(last.v))}</div><div class="s">${ch == null ? 'year to ' + esc(last.end) : `<span class="${ch >= 0 ? 'up' : 'down'}">${ch >= 0 ? '▲' : '▼'} ${Math.abs(ch * 100).toFixed(ch && Math.abs(ch) < 0.1 ? 1 : 0)}%</span> on the year before`}</div><svg viewBox="0 0 ${W} ${H}"><line class="zero" x1="0" x2="${W}" y1="${ys(0).toFixed(1)}" y2="${ys(0).toFixed(1)}"/>${bars}</svg></div>`;
    }).filter(Boolean);
    const small = !series.some((p) => 'turnover' in p.values);
    return `<div class="vz-grid">${cards.join('')}</div>${small ? '<p class="vz-note">No turnover or profit figures: small and micro companies can file a balance sheet only.</p>' : ''}${pdf.length ? `<p class="vz-note">${pdf.length} of ${docs.length} recent filings are PDF only, so those years can't be read automatically.</p>` : ''}${srcList}`;
  }

  root.Viz = { network, timeline, accounts, t, money };
})(typeof window !== 'undefined' ? window : globalThis);
