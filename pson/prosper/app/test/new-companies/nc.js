/* New companies prototype. Live mode: Companies House advanced search (max 5,000 per request, 10,000 per search).
   Demo mode: a fixture of real results so the page works without a key. Saved searches in localStorage. */
'use strict';
const { $, esc, date, addr, pc, typeName } = Kit;
const S = { mode: 'demo', items: [], hits: 0, capped: false, page: 0, agents: [], detected: [], shown: [], hidden: 0, fixture: null, running: false };
const PER = 100, SAVED = 'prosper.test.nc.saved', SHARED_MIN = 10;
const TYPE_OPTS = [['', 'Any type'], ['ltd', 'Private limited'], ['plc', 'Public limited'], ['llp', 'LLP'], ['private-limited-guarant-nsc', 'Limited by guarantee'], ['cic', 'Community interest company'], ['limited-partnership', 'Limited partnership'], ['registered-overseas-entity', 'Overseas entity']];

const iso = (d) => d.toISOString().slice(0, 10);
function defaults() {
  if (S.mode === 'demo') return { from: '2026-10-19', to: '2026-10-23' };
  const to = new Date(); const from = new Date(Date.now() - 7 * 864e5); return { from: iso(from), to: iso(to) };
}
function readF() {
  return { from: $('#f-from').value, to: $('#f-to').value, pc: $('#f-pc').value.trim(), sector: $('#f-sector').value, type: $('#f-type').value, hide: $('#f-hide').checked };
}
function writeF(f) {
  $('#f-from').value = f.from || ''; $('#f-to').value = f.to || ''; $('#f-pc').value = f.pc || ''; $('#f-sector').value = f.sector || ''; $('#f-type').value = f.type || ''; $('#f-hide').checked = f.hide !== false;
}
const areas = (s) => String(s || '').toUpperCase().split(/[\s,;]+/).filter(Boolean);
function pcMatch(code, list) {
  if (!list.length) return true; const p = pc(code); if (p.length < 5) return false; const out = p.slice(0, -3);
  return list.some((a) => (/\d/.test(a) ? out === a : new RegExp('^' + a.replace(/[^A-Z]/g, '') + '\\d').test(out)));
}
const sectorCodes = (id) => (id ? (id.startsWith('sic:') ? [id.slice(4)] : (SIC_SECTIONS.find((s) => s.id === id) || { codes: [] }).codes) : []);
function typeMatch(c, t) { if (!t) return true; if (t === 'cic') return c.company_subtype === 'community-interest-company'; return c.company_type === t; }
function sectorMatch(c, id) { if (!id) return true; const set = new Set(sectorCodes(id)); return (c.sic_codes || []).some((x) => set.has(x)); }
function sectorName(c) { const x = (c.sic_codes || [])[0]; return x ? (SIC[x] || x) : ''; }

/* shared addresses: known list (postcode level) + anything used SHARED_MIN+ times in the current results */
const addrKey = (a) => { a = a || {}; const n = ((a.premises || '') + ' ' + (a.address_line_1 || '')).match(/\d+(-\d+)?/); return pc(a.postal_code) + '|' + (n ? n[0] : ''); };
function isAgent(c) { const p = pc((c.registered_office_address || {}).postal_code); return S.agentSet.has(p) || S.detSet.has(addrKey(c.registered_office_address)); }
function detect(items) {
  const n = {}; for (const c of items) { const a = c.registered_office_address; if (!a || !a.postal_code) continue; const k = addrKey(a); n[k] = n[k] || { k, c: 0, a }; n[k].c++; }
  S.detected = Object.values(n).filter((x) => x.c >= SHARED_MIN && !S.agentSet.has(x.k.split('|')[0])).sort((a, b) => b.c - a.c);
  S.detSet = new Set(S.detected.map((x) => x.k));
}

function apply() {
  const f = readF(); const list = areas(f.pc);
  detect(S.items);
  const base = S.items.filter((c) => pcMatch((c.registered_office_address || {}).postal_code, list) && typeMatch(c, f.type) && sectorMatch(c, f.sector)
    && (!f.from || c.date_of_creation >= f.from) && (!f.to || c.date_of_creation <= f.to));
  S.shown = f.hide ? base.filter((c) => !isAgent(c)) : base;
  S.hidden = base.length - S.shown.length;
  S.shown.sort((a, b) => (b.date_of_creation || '').localeCompare(a.date_of_creation || '') || a.company_name.localeCompare(b.company_name));
  S.page = 0; render();
}

async function search() {
  const f = readF();
  if (S.mode === 'demo') { S.items = S.fixture.items; S.hits = S.items.length; S.capped = false; apply(); return; }
  if (!Kit.key('ch')) { Kit.settings(); return; }
  const qs = new URLSearchParams({ company_status: 'active', size: '5000' });
  if (f.from) qs.set('incorporated_from', f.from); if (f.to) qs.set('incorporated_to', f.to);
  const codes = sectorCodes(f.sector); if (codes.length) qs.set('sic_codes', codes.join(','));
  if (f.type && f.type !== 'cic') qs.set('company_type', f.type); if (f.type === 'cic') qs.set('company_subtype', 'community-interest-company');
  const list = areas(f.pc); if (list.length === 1 && /\d/.test(list[0])) qs.set('location', list[0]); // a single district narrows the search before the 10,000 cap
  S.running = true; $('#go').disabled = true; $('#summary').innerHTML = 'Searching Companies House…';
  try {
    S.items = []; S.hits = 0;
    for (let start = 0; start < 10000; start += 5000) {
      qs.set('start_index', String(start));
      const r = await Kit.ch('/advanced-search/companies?' + qs);
      if (!r) break; S.hits = r.hits || 0; S.items.push(...(r.items || []));
      if (S.items.length >= S.hits || !(r.items || []).length) break;
    }
    S.capped = S.hits > S.items.length; apply();
  } catch (e) { $('#summary').textContent = e.message; $('#tbl').innerHTML = ''; }
  S.running = false; $('#go').disabled = false;
}

function render() {
  const f = readF(), n = S.shown.length, a = S.page * PER;
  $('#summary').innerHTML = `<b class="num">${n.toLocaleString('en-GB')}</b> companies${S.hidden ? ` · <span class="num">${S.hidden.toLocaleString('en-GB')}</span> hidden at shared addresses` : ''}${S.mode === 'demo' ? ' · demo data' : ''}`;
  $('#warn').innerHTML = S.capped ? `<div class="banner">Companies House returned ${S.items.length.toLocaleString('en-GB')} of ${S.hits.toLocaleString('en-GB')} matches (its limit is 10,000 per search). Narrow the dates or pick a sector to see everything.</div>` : '';
  const rows = S.shown.slice(a, a + PER).map((c) => {
    const ad = c.registered_office_address || {}; const ag = isAgent(c);
    return `<tr><td class="nm"><a href="https://find-and-update.company-information.service.gov.uk/company/${esc(c.company_number)}" target="_blank" rel="noopener">${esc(c.company_name)}</a><div class="no num">${esc(c.company_number)}</div></td>
      <td class="num pcd">${date(c.date_of_creation)}</td><td class="ty">${esc(typeName(c.company_type, c.company_subtype))}</td>
      <td class="sec">${esc(sectorName(c))}${(c.sic_codes || []).length > 1 ? ` <span class="muted">+${c.sic_codes.length - 1}</span>` : ''}</td>
      <td class="ad">${esc([ad.address_line_1, ad.locality].filter(Boolean).join(', '))}${ag ? ' <span class="pill warn">Shared address</span>' : ''}</td><td class="num pcd">${esc(ad.postal_code || '')}</td></tr>`;
  }).join('');
  $('#tbl').innerHTML = `<thead><tr><th>Company</th><th>Incorporated</th><th>Type</th><th>Sector</th><th>Registered office</th><th>Postcode</th></tr></thead><tbody>${rows || `<tr><td colspan="6" class="empty">No companies match these filters.</td></tr>`}</tbody>`;
  const pages = Math.ceil(n / PER);
  $('#pager').innerHTML = pages > 1 ? `<span>${a + 1}–${Math.min(n, a + PER)} of ${n.toLocaleString('en-GB')}</span><button class="btn sm" id="pv" ${S.page ? '' : 'disabled'}>Previous</button><button class="btn sm" id="nx" ${S.page < pages - 1 ? '' : 'disabled'}>Next</button>` : '';
  if (pages > 1) { $('#pv').onclick = () => { S.page--; render(); scrollTo(0, 0); }; $('#nx').onclick = () => { S.page++; render(); $('.tablewrap').scrollTop = 0; }; }
  renderAgents(); renderSaved();
}

function renderAgents() {
  const det = S.detected.map((x) => `<div><span class="det">${esc([x.a.address_line_1, x.a.locality].filter(Boolean).join(', '))} · ${esc(x.a.postal_code)}</span><span class="n">${x.c}</span></div>`).join('');
  $('#agents').innerHTML = `<div class="ag">${det}${S.agents.map((x) => `<div><span>${esc(x.label)} · ${esc(x.postcode)}</span><span class="n">${x.seen}</span></div>`).join('')}</div>`;
}

/* ---------- saved searches: 'new since last time' = incorporations after the newest one seen, plus unseen ones on that day ---------- */
const saved = () => Kit.get(SAVED, []);
const putSaved = (v) => Kit.set(SAVED, v);
function snapshot(items) { const max = items.reduce((m, c) => (c.date_of_creation > m ? c.date_of_creation : m), ''); return { seenMax: max, seenOnMax: items.filter((c) => c.date_of_creation === max).map((c) => c.company_number).slice(0, 2000) }; }
function countNew(s, items) { const on = new Set(s.seenOnMax || []); return items.filter((c) => c.date_of_creation > s.seenMax || (c.date_of_creation === s.seenMax && !on.has(c.company_number))).length; }
function filtered(f, items) { const list = areas(f.pc); return items.filter((c) => pcMatch((c.registered_office_address || {}).postal_code, list) && typeMatch(c, f.type) && sectorMatch(c, f.sector) && (!f.hide || !isAgent(c))); }
function describe(f) {
  const bits = [f.pc || 'All areas', f.sector ? (f.sector.startsWith('sic:') ? f.sector.slice(4) : (SIC_SECTIONS.find((s) => s.id === f.sector) || {}).name) : 'any sector'];
  if (f.type) bits.push((TYPE_OPTS.find((t) => t[0] === f.type) || [])[1]); return bits.join(' · ');
}
function saveSearch() {
  const f = readF(); const name = prompt('Name this search', describe(f)); if (!name) return;
  const list = saved(); const snap = snapshot(S.shown);
  list.unshift({ id: Date.now().toString(36), name, f: { pc: f.pc, sector: f.sector, type: f.type, hide: f.hide }, mode: S.mode, at: new Date().toISOString(), ...snap, fresh: 0 });
  putSaved(list); renderSaved(); Kit.toast('Saved. Check it any time for new companies.');
}
async function checkAll() {
  const list = saved().filter((s) => s.mode === S.mode); if (!list.length) return;
  $('#check').disabled = true;
  for (const s of list) {
    let items;
    if (S.mode === 'demo') items = S.fixture.items.filter((c) => c.date_of_creation >= s.seenMax);
    else {
      try {
        const qs = new URLSearchParams({ company_status: 'active', size: '5000', incorporated_from: s.seenMax || iso(new Date(Date.now() - 7 * 864e5)) });
        const codes = sectorCodes(s.f.sector); if (codes.length) qs.set('sic_codes', codes.join(','));
        if (s.f.type && s.f.type !== 'cic') qs.set('company_type', s.f.type);
        const r = await Kit.ch('/advanced-search/companies?' + qs); items = (r && r.items) || [];
      } catch (e) { Kit.toast(e.message); break; }
    }
    s.fresh = countNew(s, filtered(s.f, items)); s.checked = new Date().toISOString();
  }
  const all = saved().map((x) => list.find((y) => y.id === x.id) || x); putSaved(all); renderSaved(); $('#check').disabled = false;
}
async function openSaved(id) {
  const all = saved(); const s = all.find((x) => x.id === id); if (!s) return;
  if (s.mode !== S.mode) setMode(s.mode, true);
  const d = defaults(); writeF({ ...s.f, from: s.seenMax || d.from, to: d.to });
  await search();
  Object.assign(s, snapshot(S.shown.length ? S.shown : []), { fresh: 0, at: new Date().toISOString() }); if (!S.shown.length) s.seenMax = s.seenMax || d.to;
  putSaved(all.map((x) => (x.id === id ? s : x))); renderSaved();
}
function renderSaved() {
  const list = saved().filter((s) => s.mode === S.mode);
  $('#saved').innerHTML = list.length ? list.map((s) => `<div class="sv" data-id="${esc(s.id)}"><div style="flex:1;min-width:0"><div class="nm">${esc(s.name)}</div><div class="sub">Last seen up to ${date(s.seenMax) || '–'}</div></div>${s.fresh ? `<span class="newc" title="New since last time">${s.fresh} new</span>` : ''}<button class="x" data-del="${esc(s.id)}" title="Delete">×</button></div>`).join('')
    : `<div class="empty">Save a search to get a count of new companies each time you come back.</div>`;
  Kit.$$('.sv').forEach((el) => { el.onclick = (e) => { if (e.target.dataset.del) { putSaved(saved().filter((x) => x.id !== e.target.dataset.del)); renderSaved(); return; } openSaved(el.dataset.id); }; });
}

/* ---------- overview: full-screen summary of the current results ---------- */
function tally(items, fn) { const m = {}; for (const c of items) for (const k of [].concat(fn(c) || [])) if (k) m[k] = (m[k] || 0) + 1; return Object.entries(m).sort((a, b) => b[1] - a[1]); }
function bars(rows, n) { const top = rows.slice(0, n || 8); const max = top.length ? top[0][1] : 1; return top.map(([k, v]) => `<div class="bar"><div class="tr"><div class="fl" style="width:${(v / max * 100).toFixed(1)}%"></div><div class="lb">${esc(k)}</div></div><div class="ct">${v.toLocaleString('en-GB')}</div></div>`).join('') || '<p class="muted small">Nothing to show.</p>'; }
function overview() {
  const it = S.shown, ov = $('#ov');
  const days = tally(it, (c) => c.date_of_creation).sort((a, b) => a[0].localeCompare(b[0])); const dmax = Math.max(1, ...days.map((d) => d[1]));
  const secs = tally(it, (c) => { const x = (c.sic_codes || [])[0]; const s = x && SIC_SECTIONS.find((q) => q.codes.includes(x)); return s ? s.name : 'Not stated'; });
  const area = tally(it, (c) => { const m = pc((c.registered_office_address || {}).postal_code).match(/^[A-Z]{1,2}\d[A-Z\d]?(?=\d[A-Z]{2}$)/); return m ? m[0] : ''; });
  const town = tally(it, (c) => { const l = (c.registered_office_address || {}).locality; return l ? l.trim().replace(/\b\w+/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase()) : ''; });
  const types = tally(it, (c) => typeName(c.company_type, c.company_subtype));
  const codes = tally(it, (c) => (c.sic_codes || []).map((x) => SIC[x] || x));
  const f = readF();
  ov.innerHTML = `<div class="ov-h"><span class="logo">Prosper</span><h2 style="margin-left:8px">New companies overview</h2><span class="muted">${esc(describe(f))} · ${date(f.from)} to ${date(f.to)}</span><span class="sp"></span><button class="btn" id="ov-x">Close</button></div>
    <div class="kpis"><div class="kpi"><div class="v num">${it.length.toLocaleString('en-GB')}</div><div class="l">New companies shown</div></div>
      <div class="kpi"><div class="v num">${S.hidden.toLocaleString('en-GB')}</div><div class="l">Hidden at shared addresses</div></div>
      <div class="kpi"><div class="v num">${days.length ? Math.round(it.length / days.length).toLocaleString('en-GB') : 0}</div><div class="l">Per incorporation day</div></div>
      <div class="kpi"><div class="v num">${secs.length}</div><div class="l">Sectors represented</div></div></div>
    <div class="grid2"><div class="panel"><h3>By day</h3><div class="days">${days.map(([d, v]) => `<div class="d"><span class="k num">${v}</span><div class="c" style="height:${(v / dmax * 110).toFixed(0)}px"></div><span>${date(d).replace(/ \d{4}$/, '')}</span></div>`).join('')}</div></div>
      <div class="panel"><h3>Top sectors</h3>${bars(secs, 7)}</div><div class="panel"><h3>Company type</h3>${bars(types, 7)}</div>
      <div class="panel"><h3>Top postcode districts</h3>${bars(area, 8)}</div><div class="panel"><h3>Top towns</h3>${bars(town, 8)}</div><div class="panel"><h3>Top activities (SIC)</h3>${bars(codes, 8)}</div></div>`;
  ov.hidden = false; if (ov.requestFullscreen && !document.fullscreenElement) ov.requestFullscreen().catch(() => {});
  const close = () => { ov.hidden = true; if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); };
  $('#ov-x').onclick = close; document.onkeydown = (e) => { if (e.key === 'Escape' && !ov.hidden) close(); };
  document.onfullscreenchange = () => { if (!document.fullscreenElement) ov.hidden = true; };
}
function exportCsv() {
  Kit.csv(`new-companies-${readF().from || 'all'}.csv`, ['Company name', 'Company number', 'Incorporated', 'Type', 'Status', 'SIC codes', 'Sector', 'Registered office', 'Postcode', 'Shared address'],
    S.shown.map((c) => [c.company_name, c.company_number, c.date_of_creation, typeName(c.company_type, c.company_subtype), c.company_status, (c.sic_codes || []).join(' '), sectorName(c), addr(c.registered_office_address), (c.registered_office_address || {}).postal_code, isAgent(c) ? 'yes' : '']));
}

function setMode(m, quiet) {
  S.mode = m;
  $('#mode').innerHTML = `<button class="${m === 'demo' ? 'on' : ''}" data-m="demo">Demo data</button><button class="${m === 'live' ? 'on' : ''}" data-m="live">Live search</button>`;
  Kit.$$('#mode button').forEach((b) => { b.onclick = () => { if (b.dataset.m === S.mode) return; setMode(b.dataset.m); }; });
  writeF({ ...readF(), ...defaults() });
  if (!quiet) { if (m === 'demo') search(); else { S.items = []; S.shown = []; S.hidden = 0; S.capped = false; render(); $('#summary').innerHTML = Kit.key('ch') ? 'Set your filters and press Search.' : 'Add your Companies House key in Settings to search live. Demo data needs no key.'; } }
}

(async function init() {
  Kit.header('new-companies'); Kit.footer('<span>Formation-agent list: addresses shared by 20+ of 10,000 sampled incorporations.</span>');
  $('#f-sector').innerHTML = '<option value="">Any sector</option>' + SIC_SECTIONS.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('') + '<optgroup label="Popular SIC codes">' + ['62012', '62020', '70229', '68209', '41100', '43999', '56101', '47910', '96020', '86900'].map((c) => `<option value="sic:${c}">${c} ${esc(SIC[c])}</option>`).join('') + '</optgroup>';
  $('#f-type').innerHTML = TYPE_OPTS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
  const [ag, fx] = await Promise.all([fetch('formation-agents.json').then((r) => r.json()), fetch('fixture.json').then((r) => r.json())]);
  S.agents = ag.addresses; S.agentSet = new Set(ag.addresses.map((a) => pc(a.postcode))); S.detSet = new Set(); S.fixture = fx;
  const dayNums = (d) => fx.items.filter((c) => c.date_of_creation === d).map((c) => c.company_number);
  if (!saved().length) putSaved([{ id: 'demo1', name: 'Manchester tech', f: { pc: 'M', sector: 'J', type: '', hide: true }, mode: 'demo', at: '2026-10-21T18:00:00Z', seenMax: '2026-10-21', seenOnMax: dayNums('2026-10-21'), fresh: 0 },
    { id: 'demo2', name: 'Leeds and Bristol construction', f: { pc: 'LS, BS', sector: 'F', type: '', hide: true }, mode: 'demo', at: '2026-10-22T18:00:00Z', seenMax: '2026-10-22', seenOnMax: dayNums('2026-10-22'), fresh: 0 }]);
  $('#go').onclick = search; $('#save').onclick = saveSearch; $('#check').onclick = checkAll; $('#overview').onclick = overview; $('#export').onclick = exportCsv;
  ['#f-hide', '#f-sector', '#f-type'].forEach((s) => $(s).addEventListener('change', () => { if (S.items.length) apply(); }));
  $('#f-pc').addEventListener('keydown', (e) => { if (e.key === 'Enter') (S.mode === 'demo' ? apply() : search()); });
  document.addEventListener('kit-keys', () => { if (S.mode === 'live') setMode('live'); });
  setMode('demo'); await checkAll();
  if (location.hash === '#overview') overview();
})();
