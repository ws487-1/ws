/* Prosper web app: page shell (left menu + header search), Companies House API access and page controllers.
   Keys are typed into Settings and kept only in this browser (localStorage). No keys are built in.
   Icons: Lucide (https://lucide.dev), ISC License, Copyright (c) 2026 Lucide Icons and Contributors. */
(function () {
  'use strict';
  const { esc, st, URL: U } = window.UI;
  const N = window.Normalise;
  if (window.CH_ENUMS) N.setEnums(window.CH_ENUMS);
  const API = 'https://api.company-information.service.gov.uk';
  const qs = new URLSearchParams(location.search);

  /* ---------- storage ---------- */
  const SLOT = { ch: 'prosper.key.ch', claude: 'prosper.key.claude', saved: 'prosper.saved', recent: 'prosper.recent', pc: 'prosper.pc', disq: 'prosper.disq', conn: 'prosper.conn.' };
  const lsGet = (k) => { try { const v = localStorage.getItem(k); return v == null ? null : JSON.parse(v); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { if (v == null || v === '') localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } };
  function cleanKey(raw, kind) {
    let s = String(raw == null ? '' : raw);
    s = s.replace(/^\s*(?:authorization\s*:\s*)?(?:basic|bearer)\s+/i, '');
    s = s.replace(/[\s\u00a0\u200b-\u200d\u2060\ufeff]+/g, '');
    for (let i = 0; i < 3; i++) {
      s = s.replace(/^(?:x-api-key|api[_-]?key|apikey|key|token|ch|claude|anthropic)?[=:]+/i, '');
      s = s.replace(/^["'`\u2018\u2019\u201c\u201d<]+|["'`\u2018\u2019\u201c\u201d>,;]+$/g, '');
    }
    s = s.replace(/:+$/, '');
    if (kind === 'ch') { const m = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.exec(s); if (m) s = m[0]; }
    if (kind === 'claude') { const m = /sk-ant-[A-Za-z0-9_-]{20,}/.exec(s); if (m) s = m[0]; }
    return s;
  }
  const chKey = () => cleanKey(lsGet(SLOT.ch) || '', 'ch');
  /* Saved list: companies and people, newest first. Entries saved before round 2 had no kind and a date-only savedAt:
     they become companies, timestamped at midnight UTC of that date, with the old list order kept by millisecond offsets. */
  function saved() {
    const raw = lsGet(SLOT.saved);
    if (!Array.isArray(raw)) return [];
    let changed = false;
    const n = raw.length;
    const list = raw.filter((x) => x && typeof x === 'object').map((x, i) => {
      if (x.kind && /T/.test(x.savedAt || '')) return x;
      changed = true;
      const day = /^\d{4}-\d{2}-\d{2}$/.test(x.savedAt || '') ? Date.parse(x.savedAt + 'T00:00:00Z') : Date.UTC(2000, 0, 1);
      return Object.assign({}, x, { kind: x.kind || 'company', savedAt: new Date(day + (n - i)).toISOString(), dateOnly: true, noDate: !/^\d{4}-\d{2}-\d{2}$/.test(x.savedAt || '') });
    });
    if (changed) lsSet(SLOT.saved, list);
    return list;
  }
  const savedKey = (x) => (x.kind === 'person' ? 'p:' + x.key : 'c:' + x.number);
  const isSaved = (k) => saved().some((x) => savedKey(x) === k);
  function bindSave(btn, entry) {
    if (!btn) return;
    const k = savedKey(entry);
    btn.setAttribute('aria-pressed', String(isSaved(k)));
    btn.addEventListener('click', () => {
      const list = saved(), on = list.some((x) => savedKey(x) === k), rest = list.filter((x) => savedKey(x) !== k);
      if (!on) rest.unshift(Object.assign({}, entry, { savedAt: new Date().toISOString() }));
      lsSet(SLOT.saved, rest);
      btn.textContent = on ? 'Save' : 'Saved'; btn.setAttribute('aria-pressed', String(!on));
    });
  }

  /* ---------- Companies House API (cached for 10 minutes in this tab) ---------- */
  class ApiError extends Error { constructor(code, msg) { super(msg); this.code = code; } }
  const TTL = 10 * 60 * 1000;
  async function ch(path) {
    const key = chKey();
    if (!key) throw new ApiError('nokey', 'Add your Companies House API key in Settings to look companies up.');
    const ck = 'prosper.c.' + path;
    try { const c = JSON.parse(sessionStorage.getItem(ck) || 'null'); if (c && Date.now() - c.t < TTL) return c.d; } catch (e) { /* ignore */ }
    let r;
    try { r = await fetch(API + path, { headers: { Authorization: 'Basic ' + btoa(key + ':') } }); } catch (e) { throw new ApiError('network', 'Could not reach Companies House. Check your connection, and that this site is listed under your key\'s JavaScript domains.'); }
    if (r.status === 401) throw new ApiError('401', 'Companies House rejected the key (401). Check it in Settings, and that this site is listed under the key\'s JavaScript domains.');
    if (r.status === 429) throw new ApiError('429', 'Companies House rate limit reached (600 requests per 5 minutes). Wait a few minutes and try again.');
    let d;
    if (r.status === 404) d = { _http: 404 };
    else if (!r.ok) throw new ApiError(String(r.status), 'Companies House returned an error (' + r.status + '). Try again shortly.');
    else d = await r.json();
    try { sessionStorage.setItem(ck, JSON.stringify({ t: Date.now(), d })); } catch (e) { /* full */ }
    return d;
  }
  const normNumber = (n) => { const s = String(n || '').replace(/\s+/g, '').toUpperCase(); return /^\d+$/.test(s) ? s.padStart(8, '0') : s; };
  const isNumber = (q) => /^(?:[A-Z]{2}\d{6}|[A-Z]{2}\d{5}[A-Z]|\d{5,8})$/i.test(String(q).replace(/\s+/g, ''));

  /* ---------- shell ---------- */
  const svg = (inner) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
  const ICONS = {
    search: '<path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/>',
    bookmark: '<path d="M17 3a2 2 0 0 1 2 2v15a1 1 0 0 1-1.496.868l-4.512-2.578a2 2 0 0 0-1.984 0l-4.512 2.578A1 1 0 0 1 5 20V5a2 2 0 0 1 2-2z"/>',
    bell: '<path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>',
    settings: '<path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/>',
    menu: '<path d="M4 5h16"/><path d="M4 12h16"/><path d="M4 19h16"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    building: '<path d="M10 12h4"/><path d="M10 8h4"/><path d="M14 21v-3a2 2 0 0 0-4 0v3"/><path d="M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2"/><path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"/>',
    user: '<path d="M17.925 20.056a6 6 0 0 0-11.851.001"/><circle cx="12" cy="11" r="4"/><circle cx="12" cy="12" r="10"/>',
  };
  const NAV = [['search', 'Search', 'index.html', 'search'], ['saved', 'Saved', 'saved.html', 'bookmark'], ['alerts', 'Alerts', 'alerts.html', 'bell'], ['settings', 'Settings', 'settings.html', 'settings']];
  function shell(active) {
    const q = active === 'search' ? qs.get('q') || '' : '';
    const type = active === 'search' && ['people', 'disqualified'].includes(qs.get('type')) ? qs.get('type') : '';
    document.body.innerHTML = `<div class="app">
      <aside class="side" id="side"><div class="side-in"><a class="wordmark" href="index.html">Prosper</a>
        <nav class="nav">${NAV.map(([k, label, href, ic]) => `<a href="${href}"${k === active ? ' class="on" aria-current="page"' : ''}>${svg(ICONS[ic])}<span>${label}</span></a>`).join('')}</nav></div></aside>
      <div class="main">
        <div class="top"><button class="icon-btn menu-btn" id="menuBtn" aria-label="Menu" aria-expanded="false">${svg(ICONS.menu)}</button><a class="wordmark" href="index.html">Prosper</a>
          <form class="search" action="index.html" method="get" role="search"><input name="q" type="search" value="${esc(q)}" placeholder="Search companies or people by name or number" aria-label="Search companies or people">${type ? `<input type="hidden" name="type" value="${type}">` : ''}<button class="btn" type="submit">Search</button></form></div>
        <main class="content" id="content"></main>
      </div></div>`;
    const btn = document.getElementById('menuBtn');
    btn.addEventListener('click', () => { const open = document.body.classList.toggle('menu-open'); btn.setAttribute('aria-expanded', String(open)); btn.innerHTML = svg(open ? ICONS.x : ICONS.menu); });
    return document.getElementById('content');
  }
  const loading = (el, t) => { el.innerHTML = `<div class="loading">${esc(t || 'Loading…')}</div>`; };
  function showError(el, e) {
    const msg = e && e.message ? e.message : String(e);
    el.innerHTML = `<div class="panel"><div class="err">${esc(msg)}</div>${e && (e.code === 'nokey' || e.code === '401') ? '<div style="margin-top:8px"><a href="settings.html">Open Settings</a></div>' : ''}</div>`;
    if (!(e instanceof ApiError)) console.error(e);
  }
  const setTitle = (t) => { document.title = t ? t + ' · Prosper' : 'Prosper'; };
  const pager = (page, pages, total, from, to, hrefFor) => `<div class="pager"><span>${total ? `Showing ${from.toLocaleString('en-GB')}–${to.toLocaleString('en-GB')} of ${total.toLocaleString('en-GB')}` : ''}</span><span class="btns">${page > 1 ? `<a class="btn sm" href="${esc(hrefFor(page - 1))}">Previous</a>` : '<button class="btn sm" disabled>Previous</button>'}${page < pages ? `<a class="btn sm" href="${esc(hrefFor(page + 1))}">Next</a>` : '<button class="btn sm" disabled>Next</button>'}</span></div>`;
  const withParams = (base, params) => base + '?' + new URLSearchParams(Object.entries(params).filter(([k, v]) => v != null && v !== '' && !(k === 'page' && +v === 1))).toString();

  /* ---------- Search: Companies / People / Disqualified tabs, Advanced panel, A–Z browse, dissolved names ---------- */
  const E = window.CH_ENUMS || {};
  const SEARCH_TYPES = [['companies', 'Companies'], ['people', 'People'], ['disqualified', 'Disqualified']];
  const ADV_FIELDS = ['includes', 'excludes', 'status', 'ctype', 'subtype', 'sic', 'loc', 'incf', 'inct', 'disf', 'dist'];
  /* A pasted Companies House link or officer ID opens the right page directly. */
  function pastedTarget(q) {
    const s = String(q || '').trim();
    let m;
    if ((m = /\/officers\/([A-Za-z0-9_-]{10,})\/appointments/.exec(s))) return U.person(m[1]);
    if ((m = /\/disqualified-officers\/(natural|corporate)\/([A-Za-z0-9_-]{10,})/.exec(s))) return U.disq(m[1], m[2]);
    if ((m = /\/persons-with-significant-control\/([A-Za-z0-9_-]{10,})\/notifications/.exec(s))) return U.psc(m[1]);
    if ((m = /\/company\/([A-Z0-9]{8})(?:[/?#]|$)/i.exec(s))) return U.company(m[1].toUpperCase());
    if (/^[A-Za-z0-9_-]{27}$/.test(s) && /[a-z]/.test(s) && /[A-Z]/.test(s) && /[0-9_-]/.test(s)) return U.person(s);
    return '';
  }
  function addRecent(label, href) {
    const l = (lsGet(SLOT.recent) || []).filter((r) => r && r.href !== href);
    l.unshift({ label, href, at: new Date().toISOString() });
    lsSet(SLOT.recent, l.slice(0, 10));
  }
  function recentHtml() {
    const l = lsGet(SLOT.recent) || [];
    if (!l.length) return '';
    return `<div class="panel" id="recentPanel"><div class="tile-head"><h3>Recent searches</h3><span class="aside"><button class="lnk" type="button" id="clearRecent">Clear all</button></span></div><div class="recent">${l.map((r) => `<a href="${esc(r.href)}">${esc(r.label)}</a>`).join('')}</div></div>`;
  }
  const opts = (map, cur, any) => `<option value="">${esc(any)}</option>` + Object.entries(map || {}).sort((a, b) => a[1].localeCompare(b[1])).map(([k, v]) => `<option value="${esc(k)}"${k === cur ? ' selected' : ''}>${esc(v)}</option>`).join('');
  function advancedPanel(mode, open) {
    const g = (k) => qs.get(k) || '';
    const sics = g('sic').split(',').filter((c) => E.sic2007 && E.sic2007[c]);
    return `<div class="panel adv" id="adv"${open ? '' : ' hidden'}>
      <h2>Filter companies</h2>
      <form class="filters" id="advForm" method="get" action="index.html"><input type="hidden" name="mode" value="advanced">
        <label class="grow">Name includes<input class="input" name="includes" value="${esc(g('includes'))}"></label>
        <label class="grow">Name excludes<input class="input" name="excludes" value="${esc(g('excludes'))}"></label>
        <label>Status<select class="input" name="status">${opts(E.company_status, g('status'), 'Any status')}</select></label>
        <label>Type<select class="input" name="ctype">${opts(E.company_type, g('ctype'), 'Any type')}</select></label>
        <label>Subtype<select class="input" name="subtype">${opts(E.company_subtype, g('subtype'), 'Any subtype')}</select></label>
        <label class="grow">Location<input class="input" name="loc" value="${esc(g('loc'))}" placeholder="Town or postcode district"></label>
        <label class="grow">Activity (SIC 2007)<input class="input" id="sicIn" list="sicList" placeholder="Type a code or an activity" autocomplete="off"></label>
        <datalist id="sicList">${Object.entries(E.sic2007 || {}).map(([c, d]) => `<option value="${esc(c + ' ' + d)}"></option>`).join('')}</datalist>
        <input type="hidden" name="sic" id="sicHidden" value="${esc(sics.join(','))}">
        <label>Incorporated from<input class="input" type="date" name="incf" value="${esc(g('incf'))}"></label>
        <label>Incorporated to<input class="input" type="date" name="inct" value="${esc(g('inct'))}"></label>
        <label>Dissolved from<input class="input" type="date" name="disf" value="${esc(g('disf'))}"></label>
        <label>Dissolved to<input class="input" type="date" name="dist" value="${esc(g('dist'))}"></label>
        <button class="btn primary" type="submit">Search</button>${mode === 'advanced' ? '<a class="btn ghost" href="index.html?mode=advanced">Clear</a>' : ''}
      </form>
      <div class="sic-picked" id="sicPicked" aria-live="polite"></div>
      <h2 style="margin-top:16px">Browse by name</h2>
      <form class="filters" id="listForm" method="get" action="index.html">
        <label class="grow">Name<input class="input" name="q" value="${esc(mode === 'az' || mode === 'dissolved' ? g('q') : '')}" required></label>
        <label>List<select class="input" name="mode"><option value="az"${mode === 'az' ? ' selected' : ''}>A–Z, all companies</option><option value="dissolved"${mode === 'dissolved' ? ' selected' : ''}>Dissolved companies</option></select></label>
        <label style="display:flex;gap:6px;align-items:center;font-size:var(--fs-sm);color:var(--ink-700)"><input type="checkbox" name="prev" value="1"${g('prev') ? ' checked' : ''}>Search previous names (dissolved companies)</label>
        <button class="btn" type="submit">Browse</button>
      </form></div>`;
  }
  function wireAdvanced(el) {
    const btn = el.querySelector('#advBtn'), panel = el.querySelector('#adv');
    btn.addEventListener('click', () => { const open = panel.hidden; panel.hidden = !open; btn.setAttribute('aria-expanded', String(open)); if (open) panel.querySelector('input:not([type=hidden])').focus(); });
    const hidden = el.querySelector('#sicHidden'), picked = el.querySelector('#sicPicked'), inp = el.querySelector('#sicIn');
    const codes = () => hidden.value.split(',').filter(Boolean);
    const draw = () => {
      picked.innerHTML = codes().map((c) => `<span class="chip"><b class="mono">${esc(c)}</b>${esc(E.sic2007[c] || '')}<button type="button" class="lnk" data-rmsic="${esc(c)}" aria-label="Remove SIC ${esc(c)}">${svg(ICONS.x).replace('<svg ', '<svg width="12" height="12" ')}</button></span>`).join('');
      picked.querySelectorAll('[data-rmsic]').forEach((b) => b.addEventListener('click', () => { hidden.value = codes().filter((c) => c !== b.dataset.rmsic).join(','); draw(); inp.focus(); }));
    };
    const add = () => {
      const m = /^\s*(\d{5})\b/.exec(inp.value);
      let code = m && E.sic2007[m[1]] ? m[1] : '';
      if (!code && inp.value.trim()) { const t = inp.value.trim().toLowerCase(); const hit = Object.entries(E.sic2007).find(([, d]) => d.toLowerCase() === t); if (hit) code = hit[0]; }
      if (code && !codes().includes(code)) { hidden.value = codes().concat(code).join(','); draw(); }
      if (code) inp.value = '';
    };
    inp.addEventListener('change', add);
    inp.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); add(); } });
    draw();
    el.querySelectorAll('#advForm, #listForm').forEach((f) => f.addEventListener('submit', (ev) => {
      if (f.id === 'advForm') add();
      f.querySelectorAll('input, select').forEach((i) => { if (!i.value && i.name) i.disabled = true; });
    }));
  }
  const resRow = (c, extra) => `<div class="res"><div><a class="nm" href="${esc(U.company(c.number))}">${esc(c.name)}</a></div><div class="rt">${st(c.status, c.colour)}</div>
    <div class="meta">${esc(['No. ' + c.number, c.type, c.created && 'Incorporated ' + c.created, c.ceased && 'Ceased ' + c.ceased].filter(Boolean).join(' · '))}</div><div></div>
    ${c.address ? `<div class="addr">${esc(c.address)}</div>` : ''}${extra || ''}</div>`;

  async function pageSearch() {
    const el = shell('search');
    const q = (qs.get('q') || '').trim();
    const type = ['people', 'disqualified'].includes(qs.get('type')) ? qs.get('type') : 'companies';
    const mode = ['advanced', 'az', 'dissolved'].includes(qs.get('mode')) ? qs.get('mode') : '';
    const page = Math.max(1, parseInt(qs.get('page'), 10) || 1);
    const advBtn = (open) => `<button class="btn" type="button" id="advBtn" aria-expanded="${open}" aria-controls="adv">Advanced</button>`;
    if (q && !mode && page === 1) {
      const go = pastedTarget(q);
      if (go) { location.replace(go); return; }
      if (type === 'companies' && isNumber(q)) { location.replace(U.company(normNumber(q))); return; }
    }
    if (!q && !mode) {
      setTitle('Search');
      el.innerHTML = `<div class="page-head"><div><h1>Search</h1><div class="sub">Search Companies House by company name or number, or by a person's name. You can also paste a Companies House link or officer ID.</div></div><div>${advBtn(false)}</div></div>${chKey() ? '' : '<div class="panel plain-msg" style="margin-bottom:16px">Add your Companies House API key in <a href="settings.html">Settings</a> to start searching.</div>'}${advancedPanel('', false)}${recentHtml()}`;
      wireAdvanced(el);
      const cr = el.querySelector('#clearRecent');
      if (cr) cr.addEventListener('click', () => { lsSet(SLOT.recent, null); el.querySelector('#recentPanel').remove(); document.querySelector('.search input').focus(); });
      document.querySelector('.search input').focus();
      return;
    }
    let title, tabs = '';
    if (mode === 'advanced') title = 'Filtered companies';
    else if (mode === 'az') title = `A–Z from “${q}”`;
    else if (mode === 'dissolved') title = `Dissolved companies${qs.get('prev') ? ' with a previous name like' : ' named'} “${q}”`;
    else {
      title = `Results for “${q}”`;
      tabs = `<nav class="tabs-plain" aria-label="Result type">${SEARCH_TYPES.map(([k, l]) => `<a href="${esc(withParams('index.html', { q, type: k === 'companies' ? '' : k }))}"${k === type ? ' class="on" aria-current="page"' : ''}>${l}</a>`).join('')}</nav>`;
    }
    setTitle(title);
    el.innerHTML = `<div class="page-head"><div><h1>${esc(title)}</h1></div><div>${advBtn(!!mode)}</div></div>${advancedPanel(mode, !!mode)}${tabs}<div class="panel" id="res"></div>`;
    wireAdvanced(el);
    const res = document.getElementById('res');
    loading(res, 'Searching…');
    const href = location.pathname.split('/').pop() + location.search;
    try {
      if (mode === 'advanced') {
        const g = (k) => qs.get(k) || '';
        const map = { company_name_includes: g('includes'), company_name_excludes: g('excludes'), company_status: g('status'), company_type: g('ctype'), company_subtype: g('subtype'), sic_codes: g('sic'), location: g('loc'), incorporated_from: g('incf'), incorporated_to: g('inct'), dissolved_from: g('disf'), dissolved_to: g('dist') };
        const params = Object.entries(map).filter(([, v]) => v);
        if (!params.length) { res.innerHTML = '<div class="plain-msg">Choose at least one filter.</div>'; return; }
        const per = 20, raw = await ch('/advanced-search/companies?' + new URLSearchParams(params.concat([['size', per], ['start_index', (page - 1) * per]])).toString());
        const r = N.searchList(raw);
        addRecent('Filtered: ' + params.map(([k, v]) => (k === 'sic_codes' ? 'SIC ' + v : v)).join(', '), href);
        if (!r.items.length) { res.innerHTML = '<div class="plain-msg">No companies match these filters.</div>'; return; }
        const total = Math.min(r.total, 10000);
        res.innerHTML = `<div class="res-list">${r.items.map((c) => resRow(c, c.sic.length ? `<div class="addr">SIC ${esc(c.sic.join(', '))}</div>` : '')).join('')}</div>
          ${pager(page, Math.ceil(total / per), r.total, (page - 1) * per + 1, (page - 1) * per + r.items.length, (p) => withParams('index.html', Object.assign({ mode }, Object.fromEntries(ADV_FIELDS.map((k) => [k, qs.get(k)])), { page: p })))}`;
        return;
      }
      if (mode === 'az') {
        // Companies House centres this list on the name searched; its paging keys are ignored, so the next page starts from the last name shown.
        const after = qs.get('after') || '';
        const raw = await ch(`/alphabetical-search/companies?q=${encodeURIComponent(q)}&size=${after ? 40 : 20}`);
        let r = N.searchList(raw).items;
        if (after) r = r.filter((c) => c.key > after).slice(0, 20);
        addRecent('A–Z: ' + q, href);
        if (!r.length) { res.innerHTML = '<div class="plain-msg">No companies found.</div>'; return; }
        const last = r[r.length - 1];
        res.innerHTML = `<div class="res-list">${r.map((c) => resRow(c)).join('')}</div><div class="pager"><span>Alphabetical list from Companies House</span><span class="btns"><a class="btn sm" href="${esc(withParams('index.html', { mode: 'az', q: last.name, after: last.key }))}">Next</a></span></div>`;
        return;
      }
      if (mode === 'dissolved') {
        const per = 20, prev = !!qs.get('prev');
        const raw = await ch(`/dissolved-search/companies?q=${encodeURIComponent(q)}&search_type=${prev ? 'previous-name-dissolved' : 'best-match'}&size=${per}&start_index=${(page - 1) * per}`);
        const r = N.searchList(raw);
        addRecent((prev ? 'Dissolved, previous names: ' : 'Dissolved: ') + q, href);
        if (!r.items.length) { res.innerHTML = '<div class="plain-msg">No dissolved companies found.</div>'; return; }
        const total = Math.min(r.total, 10000);
        res.innerHTML = `<div class="res-list">${r.items.map((c) => resRow(c, c.previous.length ? `<div class="addr">Previous names: ${esc(c.previous.map((x) => x.name + (x.to ? ' (until ' + x.to + ')' : '')).join('; '))}</div>` : '')).join('')}</div>
          ${pager(page, Math.ceil(total / per), r.total, (page - 1) * per + 1, (page - 1) * per + r.items.length, (p) => withParams('index.html', { mode, q, prev: prev ? 1 : '', page: p }))}`;
        return;
      }
      addRecent(q + (type === 'companies' ? '' : type === 'people' ? ' (people)' : ' (disqualified)'), href);
      if (type === 'companies') {
        const per = 20, raw = await ch(`/search/companies?q=${encodeURIComponent(q)}&items_per_page=${per}&start_index=${(page - 1) * per}`);
        const r = N.searchCompanies(raw);
        if (!r.items.length) { res.innerHTML = '<div class="plain-msg">No companies found.</div>'; return; }
        const total = Math.min(r.total, 1000);
        res.innerHTML = `<div class="res-list">${r.items.map((c) => resRow(Object.assign({}, c, { type: '' }))).join('')}</div>
          ${pager(page, Math.ceil(total / per), r.total, (page - 1) * per + 1, (page - 1) * per + r.items.length, (p) => withParams('index.html', { q, page: p }))}`;
      } else if (type === 'people') {
        const per = 50, raw = await ch(`/search/officers?q=${encodeURIComponent(q)}&items_per_page=${per}&start_index=${(page - 1) * per}`);
        const r = N.searchOfficers(raw);
        if (!r.groups.length) { res.innerHTML = '<div class="plain-msg">No people found.</div>'; return; }
        const total = Math.min(r.total, 1000);
        res.innerHTML = `<div class="res-list">${r.groups.map((g) => `<div class="res"><div><a class="nm" href="${esc(U.person(g.ids))}">${esc(g.name)}</a></div><div class="rt">${g.count} appointment${g.count === 1 ? '' : 's'}</div>
          <div class="meta">${esc(g.born ? 'Born ' + g.born : 'Date of birth not shown')}${g.ids.length > 1 ? ` · ${g.ids.length} Companies House records` : ''}</div><div></div>
          ${g.addresses[0] ? `<div class="addr">${esc(g.addresses[0])}</div>` : ''}</div>`).join('')}</div>
          ${pager(page, Math.ceil(total / per), r.total, (page - 1) * per + 1, (page - 1) * per + r.loaded, (p) => withParams('index.html', { q, type: 'people', page: p }))}`;
      } else {
        const per = 20, raw = await ch(`/search/disqualified-officers?q=${encodeURIComponent(q)}&items_per_page=${per}&start_index=${(page - 1) * per}`);
        const r = N.searchDisqualified(raw);
        if (!r.items.length) { res.innerHTML = '<div class="plain-msg">No disqualified directors found.</div>'; return; }
        const total = Math.min(r.total, 1000);
        res.innerHTML = `<div class="res-list">${r.items.map((d) => `<div class="res"><div><a class="nm" href="${esc(U.disq(d.kind, d.id))}">${esc(d.name)}</a></div><div class="rt"></div>
          <div class="meta">${esc(d.description)}</div><div></div>${d.address ? `<div class="addr">${esc(d.address)}</div>` : ''}</div>`).join('')}</div>
          ${pager(page, Math.ceil(total / per), r.total, (page - 1) * per + 1, (page - 1) * per + r.items.length, (p) => withParams('index.html', { q, type: 'disqualified', page: p }))}`;
      }
    } catch (e) { showError(res, e); }
  }

  /* ---------- small helpers ---------- */
  async function pool(tasks, n) {
    const out = new Array(tasks.length);
    let i = 0;
    await Promise.all(Array.from({ length: Math.min(n, tasks.length) }, async () => { while (i < tasks.length) { const k = i++; try { out[k] = await tasks[k](); } catch (e) { out[k] = e; } } }));
    return out;
  }
  const timeoutSignal = (ms) => { try { return AbortSignal.timeout(ms); } catch (e) { const c = new AbortController(); setTimeout(() => c.abort(), ms); return c.signal; } };

  /* ---------- Registered office nation: Scotland and Northern Ireland from the jurisdiction; England or Wales from postcodes.io ---------- */
  async function pcCountry(postcode) {
    const k = String(postcode || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!/^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(k)) return null;
    const map = lsGet(SLOT.pc) || {};
    if (Object.prototype.hasOwnProperty.call(map, k)) return map[k];
    const get = async (u) => { const r = await fetch('https://api.postcodes.io' + u, { signal: timeoutSignal(4000) }); if (r.status === 404) return null; if (!r.ok) throw new Error('postcodes.io ' + r.status); return (await r.json()).result; };
    let country = null;
    try {
      const r = await get('/postcodes/' + k);
      if (r) country = r.country || null;
      else {
        // Retired postcode: use the live postcodes around its last location, only if they all agree.
        const t = await get('/terminated_postcodes/' + k);
        if (t && t.latitude != null && t.longitude != null) {
          const near = (await get(`/postcodes?lon=${t.longitude}&lat=${t.latitude}&limit=5&radius=200`)) || [];
          const cs = near.map((x) => x.country);
          if (cs.length && cs.every((c) => c === cs[0])) country = cs[0];
        }
      }
    } catch (e) { return null; } // not cached: try again next time
    map[k] = country;
    const keys = Object.keys(map);
    if (keys.length > 500) delete map[keys[0]];
    lsSet(SLOT.pc, map);
    return country;
  }
  async function nation(vm) {
    const j = vm.jurisdictionCode;
    if (j === 'scotland') return { flag: 'gb-sct', name: 'Scotland' };
    if (j === 'northern-ireland') return { text: 'Northern Ireland' };
    if (j === 'england-wales' || j === 'england' || j === 'wales') {
      const c = vm.address.postcode ? await pcCountry(vm.address.postcode) : null;
      if (c === 'England' && j !== 'wales') return { flag: 'gb-eng', name: 'England' };
      if (c === 'Wales' && j !== 'england') return { flag: 'gb-wls', name: 'Wales' };
      return { text: j === 'england-wales' ? 'England & Wales' : vm.jurisdiction };
    }
    const t = (vm.overseas && vm.overseas.country) || vm.jurisdiction || vm.address.country;
    return t ? { text: t } : null;
  }

  /* ---------- Disqualified directors: a match needs the identical Companies House person number ----------
     Officer IDs never equal disqualified-officer IDs, so the link is the person_number that Companies House puts on both
     company officer lists and disqualification records. Name search only finds candidate records to open; birth month/year
     only narrows them. Nothing is shown unless the person numbers are identical. */
  const DISQ_TTL = 24 * 3600 * 1000;
  const disqMap = () => lsGet(SLOT.disq) || {};
  function disqByPn() { const m = disqMap(), out = {}; for (const [pn, v] of Object.entries(m)) if (v && v.path && Date.now() - v.t < DISQ_TTL) out[pn] = v.path; return out; }
  function disqRemember(pns, path) { const m = disqMap(); for (const pn of pns) m[pn] = { t: Date.now(), path: path || '' }; const ks = Object.keys(m); if (ks.length > 2000) ks.slice(0, ks.length - 2000).forEach((k) => delete m[k]); lsSet(SLOT.disq, m); }
  const searchName = (raw) => { const m = /^([^,]+),\s*(.+)$/.exec(raw || ''); return (m ? m[2] + ' ' + m[1] : raw || '').replace(/^(mr|mrs|ms|miss|dr|sir)\.?\s+/i, '').trim(); };
  async function disqFind(rawName, dob, pns) {
    const s = await ch(`/search/disqualified-officers?q=${encodeURIComponent(searchName(rawName))}&items_per_page=50`);
    let c = ((s && s.items) || []).filter((i) => /\/disqualified-officers\/natural\//.test((i.links && i.links.self) || ''));
    if (dob && dob.year) c = c.filter((i) => { const d = String(i.date_of_birth || '').split('-'); return +d[0] === +dob.year && (!dob.month || +d[1] === +dob.month); });
    const hits = [];
    for (const i of c.slice(0, 5)) {
      const r = await ch(i.links.self);
      if (r && !r._http && r.person_number && pns.includes(String(r.person_number))) hits.push({ path: i.links.self, raw: r });
    }
    return hits;
  }

  /* ---------- Company page (bento) ---------- */
  async function loadCompany(n) {
    const c = '/company/' + n, raw = {};
    raw.profile = await ch(c);
    if (raw.profile._http) throw new ApiError('404', 'No company found with number ' + n + '.');
    // Only ask for the parts the profile links to (Companies House answers 404 for the rest).
    const p = raw.profile, L = p.links || {};
    const ukLink = p.type === 'oversea-company' && (L.uk_establishments || L['uk-establishments']);
    const [officers, psc, pscStatements, exemptions, registers, ukEstablishments, charges, insolvency, filings] = await Promise.all([
      ch(c + '/officers?items_per_page=100'), L.persons_with_significant_control ? ch(c + '/persons-with-significant-control?items_per_page=25') : null,
      L.persons_with_significant_control_statements ? ch(c + '/persons-with-significant-control-statements?items_per_page=25') : null,
      L.exemptions ? ch(c + '/exemptions') : null, L.registers ? ch(c + '/registers') : null, ukLink ? ch(c + '/uk-establishments') : null, p.has_charges ? ch(c + '/charges?items_per_page=25') : null,
      p.has_insolvency_history ? ch(c + '/insolvency') : null, ch(c + '/filing-history?items_per_page=25')]);
    Object.assign(raw, { officers, psc, pscStatements, exemptions, registers, ukEstablishments, charges, insolvency, filings, similar: null, appointments: {} });
    const act = (officers.items || []).filter((o) => !o.resigned_on).slice(0, 3);
    await Promise.all(act.map(async (o) => { const l = o.links && o.links.officer && o.links.officer.appointments; if (l) raw.appointments[l] = await ch(l + '?items_per_page=50').catch(() => null); }));
    return raw;
  }
  async function pageCompany() {
    const el = shell('');
    const n = normNumber(qs.get('co'));
    if (!n) { el.innerHTML = '<div class="panel plain-msg">No company number given. <a href="index.html">Search</a></div>'; return; }
    setTitle(n); loading(el);
    try {
      const raw = await loadCompany(n);
      const vm = N.company(raw);
      vm.disq = disqByPn();
      setTitle(vm.name);
      el.innerHTML = window.UI.companyPage(vm, { saved: isSaved('c:' + vm.number), ukEst: !!raw.ukEstablishments && !raw.ukEstablishments._http });
      bindSave(el.querySelector('[data-act="save"]'), { kind: 'company', number: vm.number, name: vm.name, status: vm.status.label, colour: vm.status.colour, town: vm.address.town || '' });
      nation(vm).then((x) => { const s = document.getElementById('roNation'); if (s) s.innerHTML = window.UI.nationHtml(x); }).catch(() => {});
      initSimilar(vm, raw);
    } catch (e) { showError(el, e); }
  }
  const companyLine = (p) => `<a href="${esc(U.company(p.company_number))}">${esc(N.profile(p).name)}</a> · No. ${esc(p.company_number)}`;

  /* ---------- Similar companies tile: Nearby / Same trade, UK-wide / Connected, each loaded when its tab opens ---------- */
  const note = (t) => (t ? `<div class="muted" style="font-size:12px;margin-top:8px">${esc(t)}</div>` : '');
  function sicChoice(vm) {
    const codes = vm.sic.map((s) => s.code);
    const pick = codes.find((c) => !N.GENERIC_SIC.includes(c)) || codes[0] || '';
    const desc = (vm.sic.find((s) => s.code === pick) || {}).desc || '';
    return { pick, desc, allGeneric: !!codes.length && codes.every((c) => N.GENERIC_SIC.includes(c)) };
  }
  const genericNote = (s) => (s.allGeneric ? `This company's activity code ${s.pick}${s.desc ? ' (' + s.desc + ')' : ''} is a general one, so these matches are broad.` : '');
  const rankGeneric = (items) => items.filter((x) => !x.generic).concat(items.filter((x) => x.generic));
  const SIM = {
    async nearby(vm) {
      const s = sicChoice(vm);
      if (!s.pick) return '<div class="empty">No activity (SIC) code on record, so there is nothing to compare with.</div>';
      const district = (/^([A-Z]{1,2}\d[A-Z\d]?)\s*\d[A-Z]{2}$/.exec((vm.address.postcode || '').toUpperCase().trim()) || [])[1] || '';
      const q = (loc) => ch(`/advanced-search/companies?company_status=active&size=20&sic_codes=${s.pick}&location=${encodeURIComponent(loc)}`);
      let where = district, r = { items: [], total: 0 };
      if (district) r = N.similar(await q(district), vm.number);
      if (!r.items.length && vm.address.town) { where = vm.address.town; r = N.similar(await q(vm.address.town), vm.number); }
      if (!where) return '<div class="empty">No registered office postcode or town on record to search near.</div>';
      if (!r.items.length) return `<div class="empty">No other active companies with SIC ${esc(s.pick)} in ${esc(where)}.</div>${note(genericNote(s))}`;
      return window.UI.simList(rankGeneric(r.items).slice(0, 10), [`Active companies with SIC ${s.pick}${s.desc ? ' (' + s.desc + ')' : ''} registered in ${where}${district && where !== district ? ' (none found in ' + district + ')' : ''}.`, genericNote(s)]);
    },
    async trade(vm) {
      const s = sicChoice(vm);
      if (!s.pick) return '<div class="empty">No activity (SIC) code on record, so there is nothing to compare with.</div>';
      const raw = await ch(`/advanced-search/companies?company_status=active&size=100&sic_codes=${s.pick}`);
      const r = N.similar(raw, vm.number);
      if (!r.items.length) return `<div class="empty">No other active companies with SIC ${esc(s.pick)}.</div>`;
      const items = rankGeneric(r.items.slice().sort((a, b) => b.createdIso.localeCompare(a.createdIso))).slice(0, 10);
      return window.UI.simList(items, [`Active companies with SIC ${s.pick}${s.desc ? ' (' + s.desc + ')' : ''}, newest first among the first ${Math.min(100, (raw.items || []).length)} of ${(+r.total).toLocaleString('en-GB')} matches returned by Companies House.`, genericNote(s)]);
    },
    async connected(vm, raw, progress) { return connected(vm, raw, progress); },
  };
  function initSimilar(vm, raw) {
    const body = document.getElementById('simBody');
    if (!body) return;
    const tabs = Array.from(document.querySelectorAll('[data-sim]'));
    const done = {};
    let cur = '';
    const show = async (k) => {
      cur = k;
      tabs.forEach((t) => { const on = t.dataset.sim === k; t.classList.toggle('on', on); t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; });
      body.setAttribute('aria-labelledby', 'simTab-' + k);
      if (done[k]) { body.innerHTML = done[k]; return; }
      body.innerHTML = '<div class="loading">Loading…</div>';
      try {
        const html = await SIM[k](vm, raw, (t) => { if (cur === k) body.innerHTML = `<div class="loading">${esc(t)}</div>`; });
        done[k] = html;
        if (cur === k) body.innerHTML = html;
      } catch (e) { if (cur === k) body.innerHTML = `<div class="err">${esc(e && e.message ? e.message : String(e))}</div>`; if (!(e instanceof ApiError)) console.error(e); }
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', (ev) => { ev.preventDefault(); if (t.dataset.sim !== cur) show(t.dataset.sim); });
      t.addEventListener('keydown', (ev) => {
        if (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft') return;
        ev.preventDefault();
        const nx = tabs[(i + (ev.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
        nx.focus(); show(nx.dataset.sim);
      });
    });
    show('nearby');
  }

  /* Connected: companies sharing a current officer or PSC with this company, matched by Companies House ID (one hop).
     Up to 40 requests, 5 at a time; the result is kept for 24 hours in this browser. */
  async function connected(vm, raw, progress) {
    const ck = SLOT.conn + vm.number, cached = lsGet(ck);
    if (cached && Date.now() - cached.t < 24 * 3600 * 1000 && cached.v === 1) return window.UI.connectedList(cached.rows, cached.notes);
    const BUDGET = 40, SHOW = 20;
    let calls = 0;
    const people = [];
    for (const o of vm.officers.active) if (o.officerId) people.push({ kind: 'officer', id: o.officerId, name: o.name, path: `/officers/${o.officerId}/appointments?items_per_page=50`, href: U.person(o.officerId) });
    for (const p of vm.ownership.current) if (p.pscId && !p.secure) people.push({ kind: 'psc', id: p.pscId, name: p.name, path: `/persons-with-significant-control/${p.pscId}/notifications`, href: p.ukCompany ? U.company(p.ukCompany) : U.psc(p.pscId) });
    const notes = [];
    const maxPeople = Math.min(people.length, 25);
    if (people.length > maxPeople) notes.push(`Checked ${maxPeople} of ${people.length} current officers and PSCs.`);
    if (!people.length) return window.UI.connectedList([], ['No current officers or PSCs with a Companies House ID.']);
    const by = {};
    const add = (number, name, status, link) => {
      if (!number || number === vm.number) return;
      const r = by[number] || (by[number] = { number, name: '', status: '', colour: '', links: [] });
      if (name && !r.name) r.name = name;
      if (status && !r.status) { r.status = N.label('company_status', status); r.colour = N.statusColour(status); }
      if (!r.links.some((l) => l.name === link.name && l.role === link.role)) r.links.push(link);
    };
    let done = 0, cut = false;
    progress(`Checking 0 of ${maxPeople} people…`);
    await pool(people.slice(0, maxPeople).map((p) => async () => {
      calls++;
      const d = await ch(p.path);
      done++; progress(`Checking ${done} of ${maxPeople} people…`);
      if (!d || d._http) return;
      if (p.kind === 'officer') {
        if ((d.total_results || 0) > (d.items || []).length) cut = true;
        for (const a of d.items || []) if (!a.resigned_on && a.appointed_to) add(a.appointed_to.company_number, a.appointed_to.company_name, a.appointed_to.company_status, { name: p.name, href: p.href, role: N.label('officer_role', a.officer_role) || 'Officer' });
      } else {
        for (const x of d.items || []) {
          if (x.ceased_on || x.ceased || !x.notified_to) continue;
          const natures = (x.natures_of_control || []);
          const role = /beneficial-owner/.test(x.kind || '') ? 'Beneficial owner' : natures.some((c) => /^ownership-of-shares/.test(c)) ? 'Owner' : 'Person with significant control';
          add(x.notified_to.company_number, '', '', { name: p.name, href: p.href, role });
        }
      }
    }), 5);
    if (cut) notes.push('Some people hold more than 50 appointments; only their latest 50 were checked.');
    let rows = Object.values(by).sort((a, b) => b.links.length - a.links.length || (a.name || a.number).localeCompare(b.name || b.number));
    if (rows.length > SHOW) notes.push(`Showing ${SHOW} of ${rows.length} connected companies, most links first.`);
    rows = rows.slice(0, SHOW);
    const missing = rows.filter((r) => !r.name);
    const room = Math.max(0, BUDGET - calls);
    if (missing.length) {
      progress('Looking up company names…');
      await pool(missing.slice(0, room).map((r) => async () => { calls++; const pr = await ch('/company/' + r.number); if (pr && !pr._http) { r.name = pr.company_name; r.status = N.label('company_status', pr.company_status); r.colour = N.statusColour(pr.company_status); } }), 5);
      if (missing.length > room) notes.push(`Stopped after ${BUDGET} requests; ${missing.length - room} companies are shown by number only.`);
    }
    rows.forEach((r) => { r.name = r.name ? N.profile({ company_name: r.name, company_number: r.number }).name : 'Company ' + r.number; });
    if (!rows.length) notes.push('No other current companies share a current officer or PSC with this one.');
    lsSet(ck, { v: 1, t: Date.now(), rows, notes });
    return window.UI.connectedList(rows, notes);
  }

  /* ---------- Officers page: current and resigned. ?officers=A table (default), ?officers=B timeline ---------- */
  async function allPages(base, per, max) {
    const first = await ch(`${base}${base.includes('?') ? '&' : '?'}items_per_page=${per}&start_index=0`);
    if (first._http) return first;
    const items = (first.items || []).slice();
    const total = first.total_results || first.total_count || items.length;
    for (let s = items.length; s < Math.min(total, max) && items.length; ) {
      const next = await ch(`${base}${base.includes('?') ? '&' : '?'}items_per_page=${per}&start_index=${s}`);
      const got = (next && next.items) || []; if (!got.length) break;
      items.push(...got); s += got.length;
    }
    return Object.assign({}, first, { items });
  }
  async function pageOfficers() {
    const el = shell('');
    const n = normNumber(qs.get('co')), look = (qs.get('officers') || 'A').toUpperCase() === 'B' ? 'B' : 'A';
    if (!n) { el.innerHTML = '<div class="panel plain-msg">No company number given.</div>'; return; }
    setTitle('Officers'); loading(el);
    try {
      const prof = await ch('/company/' + n);
      if (prof._http) throw new ApiError('404', 'No company found with number ' + n + '.');
      const raw = await allPages('/company/' + n + '/officers', 100, 5000);
      const of = N.officers(raw._http ? null : raw);
      const name = N.profile(prof).name, word = N.officerWord(prof.type);
      setTitle(word.many + ' · ' + name);
      const dq = disqByPn();
      const mark = (p) => `<span data-dq="${esc(p.personNumber)}">${p.personNumber && dq[p.personNumber] ? ` <a class="flagtxt bad" href="${esc(U.person(p.officerId))}">Disqualified director</a>` : ''}</span>`;
      const nm = (p) => (p.officerId ? `<a href="${esc(U.person(p.officerId))}">${esc(p.name)}</a>` : esc(p.name)) + mark(p);
      const natc = (p) => esc([p.nationality, p.residence].filter(Boolean).join(' / '));
      let body;
      if (!of.all.length) body = `<div class="plain-msg">No ${esc(word.many.toLowerCase())} on record.</div>`;
      else if (look === 'A') {
        const rows = of.active.concat(of.former);
        body = `<div class="table-wrap"><table class="table"><thead><tr><th>Name</th><th>Role</th><th class="nowrap">Appointed</th><th class="nowrap">Resigned</th><th>Nationality / country</th></tr></thead><tbody>${rows.map((p) => `<tr><td>${nm(p)}</td><td>${esc(p.roleLabel)}</td><td class="nowrap num">${esc(p.appointed)}</td><td class="nowrap num">${esc(p.resigned)}</td><td>${natc(p)}</td></tr>`).join('')}</tbody></table></div>`;
      } else {
        const ev = [];
        for (const p of of.all) {
          if (p.appointedIso) ev.push({ d: p.appointedIso, kind: 'appointed', p, text: p.appointed });
          else ev.push({ d: '0000', kind: 'appointed', p, text: 'before 1992' });
          if (p.resignedIso) ev.push({ d: p.resignedIso, kind: 'resigned', p, text: p.resigned });
        }
        ev.sort((a, b) => b.d.localeCompare(a.d) || (a.kind === 'resigned' ? -1 : 1));
        const byYear = []; let cur = null;
        for (const e of ev) { const y = e.d === '0000' ? 'Before 1992' : e.d.slice(0, 4); if (!cur || cur.y !== y) byYear.push(cur = { y, items: [] }); cur.items.push(e); }
        body = `<div class="tl">${byYear.map((g) => `<div class="tl-year"><div class="y">${esc(g.y)}</div><div class="c">${g.items.length} change${g.items.length === 1 ? '' : 's'}</div></div>${g.items.map((e) => `<div class="tl-item ev"><span class="k ${e.kind}">${e.kind}</span><div style="min-width:0"><div class="ti">${nm(e.p)} <span class="muted">${esc(e.p.roleLabel.toLowerCase())}</span></div><div class="faint" style="font-size:12px">${esc([e.text, [e.p.nationality, e.p.residence].filter(Boolean).join(' / ')].filter(Boolean).join(' · '))}</div></div></div>`).join('')}`).join('')}</div>`;
      }
      el.innerHTML = `<div class="page-head"><div><h1>${esc(word.many)}</h1><div class="sub">${companyLine(prof)} · ${of.counts.active} current · ${of.counts.resigned} resigned</div></div></div><div class="panel">${body}</div>`;
      lazyDisq(of.active.filter((p) => !p.corporate && p.personNumber && p.officerId).slice(0, 30), raw);
    } catch (e) { showError(el, e); }
  }
  /* Officers page: check current officers against the disqualified register in the background (3 at a time, cached 24 hours). */
  async function lazyDisq(list, raw) {
    const m = disqMap();
    const todo = list.filter((p) => !(m[p.personNumber] && Date.now() - m[p.personNumber].t < DISQ_TTL));
    const byId = {};
    for (const o of (raw && raw.items) || []) { const id = (/\/officers\/([^/]+)\/appointments/.exec((o.links && o.links.officer && o.links.officer.appointments) || '') || [])[1]; if (id) byId[id] = o; }
    await pool(todo.map((p) => async () => {
      const o = byId[p.officerId];
      if (!o) return;
      const hits = await disqFind(o.name, o.date_of_birth, [p.personNumber]);
      disqRemember([p.personNumber], hits[0] && hits[0].path);
      if (hits.length) document.querySelectorAll(`[data-dq="${CSS.escape(p.personNumber)}"]`).forEach((s) => { s.innerHTML = ` <a class="flagtxt bad" href="${esc(U.person(p.officerId))}">Disqualified director</a>`; });
    }), 3);
  }

  /* ---------- Filings page: category, date range and text filters, paged ---------- */
  async function pageFilings() {
    const el = shell('');
    const n = normNumber(qs.get('co'));
    if (!n) { el.innerHTML = '<div class="panel plain-msg">No company number given.</div>'; return; }
    const cat = qs.get('category') || '', from = qs.get('from') || '', to = qs.get('to') || '', text = (qs.get('q') || '').trim();
    const page = Math.max(1, parseInt(qs.get('page'), 10) || 1), per = 50;
    setTitle('Filing history'); loading(el);
    try {
      const prof = await ch('/company/' + n);
      if (prof._http) throw new ApiError('404', 'No company found with number ' + n + '.');
      setTitle('Filing history · ' + N.profile(prof).name);
      const cats = Object.entries(N.FH_CAT).sort((a, b) => a[1].localeCompare(b[1]));
      el.innerHTML = `<div class="page-head"><div><h1>Filing history</h1><div class="sub">${companyLine(prof)}</div></div></div>
        <div class="panel"><form class="filters" method="get" action="filings.html"><input type="hidden" name="co" value="${esc(n)}">
          <label>Category<select class="input" name="category"><option value="">All categories</option>${cats.map(([k, v]) => `<option value="${esc(k)}"${k === cat ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select></label>
          <label>From<input class="input" type="date" name="from" value="${esc(from)}"></label>
          <label>To<input class="input" type="date" name="to" value="${esc(to)}"></label>
          <label class="grow">Search<input class="input" type="search" name="q" value="${esc(text)}" placeholder="Description or form type"></label>
          <button class="btn" type="submit">Apply</button>${cat || from || to || text ? `<a class="btn ghost" href="${esc(U.filings(n))}">Clear</a>` : ''}</form>
          <div id="fl"><div class="loading">Loading…</div></div></div>`;
      el.querySelector('form.filters').addEventListener('submit', (ev) => ev.target.querySelectorAll('input, select').forEach((i) => { if (!i.value) i.disabled = true; }));
      const fl = document.getElementById('fl');
      const base = '/company/' + n + '/filing-history' + (cat ? '?category=' + encodeURIComponent(cat) : '');
      const href = (p) => withParams('filings.html', { co: n, category: cat, from, to, q: text, page: p });
      let items, total, note = '';
      if (!from && !to && !text) {
        const raw = await ch(`${base}${cat ? '&' : '?'}items_per_page=${per}&start_index=${(page - 1) * per}`);
        const f = N.filings(raw._http ? null : raw);
        items = f.items; total = raw._http ? 0 : raw.total_count || 0;
        if (!items.length) { fl.innerHTML = '<div class="plain-msg">No filings found.</div>'; return; }
        fl.innerHTML = items.map((it) => window.UI.filingRow(it, n)).join('') + pager(page, Math.ceil(total / per), total, (page - 1) * per + 1, (page - 1) * per + items.length, href);
        return;
      }
      // Date or text filters: Companies House has no such parameters, so read pages of 100 (newest first) and filter here.
      const CAP = 2000, all = [];
      let start = 0, grand = Infinity;
      while (start < grand && all.length < CAP) {
        const raw = await ch(`${base}${cat ? '&' : '?'}items_per_page=100&start_index=${start}`);
        if (raw._http || !(raw.items || []).length) break;
        grand = raw.total_count || 0;
        all.push(...raw.items); start += raw.items.length;
        const last = raw.items[raw.items.length - 1];
        if (from && last.date && last.date < from) break;
      }
      if (all.length >= CAP && start < grand) note = `Searched the latest ${all.length.toLocaleString('en-GB')} filings of ${grand.toLocaleString('en-GB')}. Narrow the date range to reach older ones.`;
      const t = text.toLowerCase();
      items = N.filings({ items: all, total_count: all.length }).items.filter((it) => (!from || it.dateIso >= from) && (!to || it.dateIso <= to) && (!t || (it.title + ' ' + it.typeCode + ' ' + it.categoryLabel).toLowerCase().includes(t)));
      total = items.length;
      if (!total) { fl.innerHTML = `<div class="plain-msg">No filings match these filters.</div>${note ? `<div class="faint" style="font-size:12px;margin-top:8px">${esc(note)}</div>` : ''}`; return; }
      const slice = items.slice((page - 1) * per, page * per);
      fl.innerHTML = slice.map((it) => window.UI.filingRow(it, n)).join('') + pager(page, Math.ceil(total / per), total, (page - 1) * per + 1, (page - 1) * per + slice.length, href) + (note ? `<div class="faint" style="font-size:12px;margin-top:8px">${esc(note)}</div>` : '');
    } catch (e) { showError(el, e); }
  }

  /* ---------- Person page ----------
     ?id=  officer appointments (several Companies House records can be combined: id=a,b)
     ?psc= PSC notifications. If the PSC ID is also an officer ID (Companies House sometimes uses the same ID), the page is
           combined; otherwise it is "Owner details only". People are never merged by name.
     ?disq= a disqualified-officer record (from the Disqualified search tab). */
  const dl = (rows) => `<dl class="dl">${rows.filter((r) => r && r[1]).map(([k, v, raw]) => `<dt>${esc(k)}</dt><dd>${raw ? v : esc(v)}</dd>`).join('')}</dl>`;
  const pHeader = (name, meta, extra, saveOn) => `<header class="hdr"><div class="hdr-top"><div style="min-width:0">
      ${extra ? `<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:8px">${extra}</div>` : ''}
      <h1>${esc(name)}</h1><div class="hdr-meta">${meta.filter(Boolean).map((m) => `<span>${esc(m)}</span>`).join('<span class="sep"></span>')}</div></div>
      <div class="hdr-actions"><button class="save-btn" data-act="save">${saveOn ? 'Saved' : 'Save'}</button></div></div></header>`;
  const ageText = (a) => (a != null ? `About ${a} (approximate, from birth month and year)` : '');
  function disqTile(d) {
    if (!d) return '';
    const cur = d.items.some((x) => x.current);
    return `${window.UI.head('Disqualified director')}
      <div class="verdict bad" style="margin-top:0"><b>${cur ? 'Disqualified' : 'Previously disqualified'}</b><span>as recorded by Companies House</span></div>
      ${d.items.map((x) => `<div style="margin-top:12px">${dl([
        ['Type', x.type], ['Reason', x.reason], ['Law', x.law],
        ['Disqualified', [x.from && 'from ' + x.from, x.until && 'until ' + x.until].filter(Boolean).join(' ')],
        ['Court', x.court], ['Heard on', x.heard], ['Undertaking given', x.undertaken], ['Case', x.caseId],
        ['Companies named', x.companies.join(', ')], ['Address on record', x.address]])}</div>`).join('')}
      ${d.permissions.length ? `<div style="margin-top:12px">${dl(d.permissions.map((p) => ['Permission to act', [p.companies.join(', '), p.court, p.granted && 'granted ' + p.granted, p.expires && 'until ' + p.expires].filter(Boolean).join(' · ')]))}</div>` : ''}
      <div class="muted" style="font-size:12px;margin-top:10px">${d.url ? `<a href="${esc(d.url)}" target="_blank" rel="noopener">View this record on Companies House</a>. ` : ''}Linked to this person by an identical Companies House person number.</div>`;
  }
  function controlsTile(pn, names) {
    if (!pn) return '';
    const row = (x) => `<div class="psc"><div class="line"><span class="nm"><a href="${esc(U.company(x.number))}">${esc(names[x.number] || 'Company ' + x.number)}</a></span><span class="bd">${esc(x.role)}</span>${x.notified ? `<span class="since">since ${esc(x.notified)}</span>` : ''}${x.ceased ? `<span class="since">ceased ${esc(x.ceased)}</span>` : ''}</div>${x.controls.map((c) => `<div class="other">${esc(c)}</div>`).join('')}</div>`;
    return `${window.UI.head('Companies this person controls (as recorded by Companies House)', pn.current.length + ' current', pn.ceased.length ? pn.ceased.length + ' ceased' : '')}
      ${pn.current.length ? `<div class="psc-list">${pn.current.map(row).join('')}</div>` : '<div class="empty">No current significant control recorded.</div>'}
      ${pn.ceased.length ? `<div class="eyebrow" style="margin:14px 0 6px">Ceased (${pn.ceased.length})</div><div class="psc-list">${pn.ceased.map(row).join('')}</div>` : ''}`;
  }
  async function companyNames(numbers) {
    const out = {}, list = numbers.filter((n, i, a) => n && a.indexOf(n) === i).slice(0, 20);
    await pool(list.map((n) => async () => { const p = await ch('/company/' + n); if (p && !p._http) out[n] = N.profile(p).name; }), 4);
    return out;
  }
  /* Person numbers for this person, read from up to 3 company officer lists (they can differ between appointments). */
  async function personNumbers(ids, items) {
    const pns = [], rec = { name: '', dob: null };
    const cos = items.slice().sort((a, b) => b.current - a.current).map((x) => x.number).filter((n, i, a) => n && a.indexOf(n) === i).slice(0, 3);
    await pool(cos.map((n) => async () => {
      const r = await ch('/company/' + n + '/officers?items_per_page=100');
      for (const o of (r && r.items) || []) {
        const id = (/\/officers\/([^/]+)\/appointments/.exec((o.links && o.links.officer && o.links.officer.appointments) || '') || [])[1];
        if (id && ids.includes(id)) { if (o.person_number && !pns.includes(String(o.person_number))) pns.push(String(o.person_number)); rec.name = rec.name || o.name; rec.dob = rec.dob || o.date_of_birth || null; }
      }
    }), 3);
    return Object.assign(rec, { pns });
  }
  async function disqForPerson(ids, vm) {
    if (vm.corporate) return null;
    const rec = await personNumbers(ids, vm.items);
    if (!rec.pns.length) return null;
    const m = disqMap();
    const known = rec.pns.map((pn) => m[pn]).find((v) => v && Date.now() - v.t < DISQ_TTL);
    if (known) { if (!known.path) return null; const r = await ch(known.path); return r && !r._http && rec.pns.includes(String(r.person_number)) ? N.disqualification(r) : null; }
    const hits = await disqFind(rec.name || vm.rawName, rec.dob || vm.dob, rec.pns);
    disqRemember(rec.pns, hits[0] && hits[0].path);
    return hits[0] ? N.disqualification(hits[0].raw) : null;
  }
  async function pageOfficer() {
    const el = shell('');
    const okId = (s) => /^[A-Za-z0-9_-]{6,}$/.test(s);
    const ids = (qs.get('id') || '').split(',').map((s) => s.trim()).filter(okId).slice(0, 10);
    const pscId = okId(qs.get('psc') || '') ? qs.get('psc') : '';
    const disqId = okId(qs.get('disq') || '') ? qs.get('disq') : '';
    if (!ids.length && !pscId && !disqId) { el.innerHTML = '<div class="panel plain-msg">No person given. <a href="index.html?type=people">Search people</a></div>'; return; }
    setTitle('Person'); loading(el);
    try {
      if (disqId) return await disqPage(el, disqId, qs.get('k') === 'corporate' ? 'corporate' : 'natural');
      let apIds = ids, pns = [];
      if (pscId) {
        const [pn, ap] = await Promise.all([ch(`/persons-with-significant-control/${pscId}/notifications`), allPages(`/officers/${pscId}/appointments`, 50, 500)]);
        if (ap._http) {
          if (pn._http) throw new ApiError('404', 'Companies House has no record for this owner.');
          return await pscOnlyPage(el, pscId, N.pscNotifications(pn));
        }
        apIds = [pscId]; pns = [{ id: pscId, raw: pn }];
        var apRaws = [ap];
      }
      const raws = apRaws || await Promise.all(apIds.map((id) => allPages('/officers/' + id + '/appointments', 50, 500)));
      const good = raws.filter((r) => !r._http);
      if (!good.length) throw new ApiError('404', 'No appointments found for this person.');
      const vm = N.person(good);
      if (!pscId) pns = (await Promise.all(apIds.slice(0, 3).map(async (id) => ({ id, raw: await ch(`/persons-with-significant-control/${id}/notifications`) })))).filter((x) => !x.raw._http);
      const pnv = pns.length ? N.pscNotifications({ name: pns[0].raw.name, date_of_birth: pns[0].raw.date_of_birth, items: [].concat(...pns.map((x) => x.raw.items || [])), total_results: pns.reduce((n, x) => n + (+x.raw.total_results || 0), 0) }) : null;
      setTitle(vm.name);
      const key = pscId ? 'psc:' + pscId : 'id:' + apIds.join(',');
      const f = (label, value, sub, tone) => window.UI.factTile({ label, value, sub, tone });
      const reliableAvg = vm.averageYears != null && vm.loaded === vm.total && vm.tenureBase >= Math.max(2, Math.ceil(vm.loaded * 0.8));
      const firstAp = vm.items.map((x) => x.appointedIso).filter(Boolean).sort()[0];
      const lastRes = vm.active ? '' : vm.items.map((x) => x.resignedIso).filter(Boolean).sort().pop();
      const details = dl([['Name', vm.name], ['Roles', vm.roles.join(', ')], ['First appointed', firstAp ? N.fmtDate(firstAp) : ''], ['Last resigned', lastRes ? N.fmtDate(lastRes) : ''],
        ['Nationality', vm.nationalities.join(', ')], ['Country of residence', vm.residences.join(', ')], ['Born', vm.born], ['Age', ageText(vm.age)],
        ['Correspondence address', vm.addresses.map(esc).join('<br>'), true], ['Former names', vm.formerNames.join(', ')], ['Companies House records', apIds.length > 1 ? apIds.length + ' combined (same person IDs chosen in search)' : '']]);
      const shown = vm.loaded < vm.total ? `Showing the latest ${vm.loaded} of ${vm.total}` : '';
      const apTable = `<div class="table-wrap"><table class="table"><thead><tr><th>Company</th><th>Status</th><th>Role</th><th class="nowrap">Appointed</th><th class="nowrap">Resigned</th></tr></thead><tbody>${vm.items.map((a) => `<tr><td>${a.number ? `<a href="${esc(U.company(a.number))}">${esc(a.company)}</a> <span class="muted">${esc(a.number)}</span>` : esc(a.company)}</td><td>${a.status ? st(a.status, a.colour) : ''}</td><td>${esc(a.role)}</td><td class="nowrap num">${esc(a.appointed)}</td><td class="nowrap num">${esc(a.resigned)}</td></tr>`).join('')}</tbody></table></div>`;
      const names = pnv ? await companyNames(pnv.items.map((x) => x.number)).catch(() => ({})) : {};
      vm.items.forEach((a) => { if (a.number && !names[a.number]) names[a.number] = a.company; });
      el.innerHTML = `<article class="lay-b"><div class="card shell">
        ${pHeader(vm.name, [vm.roles.slice(0, 3).join(', '), vm.born && 'Born ' + vm.born, vm.total + ' appointment' + (vm.total === 1 ? '' : 's')], '', isSaved('p:' + key))}
        <div class="bento">
          <div class="s3">${f('Appointments', String(vm.total), `${vm.active} active · ${vm.resigned} resigned${vm.openClosed ? ' · ' + vm.openClosed + ' at closed companies' : ''}${vm.loaded < vm.total ? ' (of ' + vm.loaded + ' loaded)' : ''}`)}</div>
          <div class="s3">${f('Dissolved or in liquidation', String(vm.finished), 'Companies appointed to', vm.finished ? 'warn' : '')}</div>
          <div class="s3">${f('Longest role', vm.longest ? vm.longest.years + (vm.longest.years === 1 ? ' year' : ' years') : '—', vm.longest ? vm.longest.company : 'No complete dates')}</div>
          <div class="s3">${f('Average tenure', reliableAvg ? vm.averageYears + (vm.averageYears === 1 ? ' year' : ' years') : '—', reliableAvg ? 'Across ' + vm.tenureBase + ' appointments' : (vm.loaded < vm.total ? 'Not shown: not all appointments loaded' : vm.tenureBase < 2 ? 'Not shown: needs two or more dated roles' : 'Not shown: dates incomplete'))}</div>
          <div class="tile s12" id="disqTile" hidden></div>
          <div class="tile s5">${window.UI.head('Personal details')}${details}</div>
          <div class="tile s7">${window.UI.head('Appointments', vm.total, shown)}${apTable}</div>
          ${pnv ? `<div class="tile s12">${controlsTile(pnv, names)}</div>` : ''}
        </div></div></article>`;
      bindSave(el.querySelector('[data-act="save"]'), { kind: 'person', key, href: pscId ? U.psc(pscId) : U.person(apIds), name: vm.name, sub: [vm.roles[0], vm.born && 'Born ' + vm.born].filter(Boolean).join(' · ') });
      disqForPerson(apIds, vm).then((d) => { const t = document.getElementById('disqTile'); if (d && t) { t.innerHTML = disqTile(d); t.hidden = false; } }).catch((e) => { if (!(e instanceof ApiError)) console.error(e); });
    } catch (e) { showError(el, e); }
  }
  async function pscOnlyPage(el, pscId, pn) {
    setTitle(pn.name || 'Owner');
    const names = await companyNames(pn.items.map((x) => x.number)).catch(() => ({}));
    const details = dl([['Name', pn.name], ['Other names on record', pn.names.filter((x) => x !== pn.name).join(', ')], ['Nationality', pn.nationality], ['Country of residence', pn.residence], ['Born', pn.born], ['Age', ageText(pn.age)], ['Correspondence address', pn.address]]);
    el.innerHTML = `<article class="lay-b"><div class="card shell">
      ${pHeader(pn.name || 'Owner', ['Owner details only', pn.born && 'Born ' + pn.born, pn.current.length + ' current'], '', isSaved('p:psc:' + pscId))}
      <div class="bento">
        <div class="tile s5">${window.UI.head('Owner details only')}${details}<div class="muted" style="font-size:12px;margin-top:10px">This person is not linked to any director appointments by Companies House ID.</div></div>
        <div class="tile s7">${controlsTile(pn, names)}</div>
      </div></div></article>`;
    bindSave(el.querySelector('[data-act="save"]'), { kind: 'person', key: 'psc:' + pscId, href: U.psc(pscId), name: pn.name, sub: ['Owner details only', pn.born && 'Born ' + pn.born].filter(Boolean).join(' · ') });
  }
  async function disqPage(el, id, kind) {
    const r = await ch(`/disqualified-officers/${kind}/${id}`);
    if (r._http) throw new ApiError('404', 'No disqualification record found.');
    const d = N.disqualification(r);
    setTitle(d.name);
    el.innerHTML = `<article class="lay-b"><div class="card shell">
      ${pHeader(d.name, [d.born && 'Born ' + d.born, d.nationality], '<span class="flagtxt bad">Disqualified director</span>', isSaved('p:disq:' + id))}
      <div class="bento"><div class="tile s12">${disqTile(d)}</div></div></div></article>`;
    bindSave(el.querySelector('[data-act="save"]'), { kind: 'person', key: 'disq:' + id, href: U.disq(kind, id), name: d.name, sub: 'Disqualified director' });
  }

  /* ---------- Saved: one list of companies and people, newest first ---------- */
  function pageSaved() {
    const el = shell('saved'); setTitle('Saved');
    let kind = 'all', text = '', status = '';
    const ic = (k) => `<span class="saved-ic" aria-hidden="true">${svg(k === 'person' ? ICONS.user : ICONS.building)}</span>`;
    const frame = () => {
      el.innerHTML = `<div class="page-head"><div><h1>Saved</h1><div class="sub">Companies and people you have saved in this browser, newest first.</div></div></div>
        <div class="panel"><div class="filters" id="savedFilters">
          <nav class="tabs-plain" aria-label="Show">${[['all', 'All'], ['company', 'Companies'], ['person', 'People']].map(([k, l]) => `<a href="#" data-kind="${k}"${k === kind ? ' class="on" aria-current="true"' : ''}>${l}</a>`).join('')}</nav>
          <label class="grow">Search saved<input class="input" id="savedQ" type="search" value="${esc(text)}"></label>
          <label>Status<select class="input" id="savedSt"><option value="">Any status</option></select></label>
        </div><div id="savedList"></div></div>`;
      el.querySelectorAll('[data-kind]').forEach((a) => a.addEventListener('click', (ev) => { ev.preventDefault(); kind = a.dataset.kind; el.querySelectorAll('[data-kind]').forEach((b) => { b.classList.toggle('on', b === a); if (b === a) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); }); draw(); }));
      el.querySelector('#savedQ').addEventListener('input', (ev) => { text = ev.target.value; draw(); });
      el.querySelector('#savedSt').addEventListener('change', (ev) => { status = ev.target.value; draw(); });
    };
    const draw = () => {
      const all = saved().slice().sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
      const sel = el.querySelector('#savedSt');
      const sts = all.filter((x) => x.kind === 'company' && x.status).map((x) => x.status).filter((s, i, a) => a.indexOf(s) === i).sort();
      if (!sts.includes(status)) status = '';
      sel.innerHTML = '<option value="">Any status</option>' + sts.map((s) => `<option${s === status ? ' selected' : ''}>${esc(s)}</option>`).join('');
      const t = text.trim().toLowerCase();
      const list = all.filter((x) => (kind === 'all' || x.kind === kind) && (!status || (x.kind === 'company' && x.status === status)) && (!t || [x.name, x.number, x.town, x.sub].join(' ').toLowerCase().includes(t)));
      const when = (x) => (x.noDate ? '' : x.dateOnly ? 'saved ' + N.fmtDate(x.savedAt.slice(0, 10)) : 'saved ' + N.fmtDate(x.savedAt.slice(0, 10)) + ', ' + new Date(x.savedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
      const row = (x) => x.kind === 'person'
        ? `<div class="res"><div style="display:flex;gap:8px;align-items:center">${ic('person')}<a class="nm" href="${esc(x.href)}">${esc(x.name)}</a></div><div class="rt"><button class="lnk" data-rm="${esc(savedKey(x))}">Remove</button></div><div class="meta">${esc([x.sub, when(x)].filter(Boolean).join(' · '))}</div></div>`
        : `<div class="res"><div style="display:flex;gap:8px;align-items:center">${ic('company')}<a class="nm" href="${esc(U.company(x.number))}">${esc(x.name)}</a></div><div class="rt"><button class="lnk" data-rm="${esc(savedKey(x))}">Remove</button></div><div class="meta">${st(x.status, x.colour)} · ${esc(['No. ' + x.number, x.town, when(x)].filter(Boolean).join(' · '))}</div></div>`;
      el.querySelector('#savedList').innerHTML = !all.length ? '<div class="plain-msg">Nothing saved yet. Use Save on a company or person page.</div>' : list.length ? `<div class="res-list">${list.map(row).join('')}</div>` : '<div class="plain-msg">Nothing saved matches.</div>';
      el.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', () => { lsSet(SLOT.saved, saved().filter((x) => savedKey(x) !== b.dataset.rm)); draw(); }));
    };
    frame(); draw();
  }

  function pageAlerts() {
    const el = shell('alerts'); setTitle('Alerts');
    el.innerHTML = '<div class="page-head"><div><h1>Alerts</h1></div></div><div class="panel plain-msg">Work in progress.</div>';
  }
  function pageSettings() {
    const el = shell('settings'); setTitle('Settings');
    const has = { ch: !!chKey(), claude: !!cleanKey(lsGet(SLOT.claude) || '', 'claude') };
    el.innerHTML = `<div class="page-head"><div><h1>Settings</h1></div></div><div class="panel"><form class="form" id="keys" autocomplete="off">
      <label for="chk">Companies House API key</label><input class="input" id="chk" type="password" placeholder="${has.ch ? 'Saved. Paste a new key to replace it.' : 'Paste your key'}">
      <div class="help">Free from developer.company-information.service.gov.uk (REST key). Add ${esc(location.origin)} under the key's JavaScript domains so this page can use it.</div>
      <label for="clk">Claude API key</label><input class="input" id="clk" type="password" placeholder="${has.claude ? 'Saved. Paste a new key to replace it.' : 'Paste your key'}">
      <div class="help">Optional. From console.anthropic.com.</div>
      <div class="row"><button class="btn primary" type="submit">Save keys</button>${has.ch ? '<button class="btn" type="button" data-rm="ch">Remove CH key</button>' : ''}${has.claude ? '<button class="btn" type="button" data-rm="claude">Remove Claude key</button>' : ''}</div>
      <div class="help" style="margin-top:10px">Stored only in this browser (localStorage).</div><div class="help" id="msg" role="status"></div></form></div>`;
    const msg = el.querySelector('#msg');
    el.querySelector('#keys').addEventListener('submit', (ev) => {
      ev.preventDefault();
      const c = cleanKey(el.querySelector('#chk').value, 'ch'), a = cleanKey(el.querySelector('#clk').value, 'claude');
      if (c) lsSet(SLOT.ch, c); if (a) lsSet(SLOT.claude, a);
      try { Object.keys(sessionStorage).filter((k) => k.startsWith('prosper.c.')).forEach((k) => sessionStorage.removeItem(k)); } catch (e) { /* ignore */ }
      if (c || a) { pageSettings(); document.getElementById('msg').textContent = 'Saved.'; } else msg.textContent = 'Paste a key first.';
    });
    el.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', () => { lsSet(b.dataset.rm === 'ch' ? SLOT.ch : SLOT.claude, null); pageSettings(); document.getElementById('msg').textContent = 'Removed.'; }));
  }

  const PAGES = { search: pageSearch, company: pageCompany, officers: pageOfficers, filings: pageFilings, officer: pageOfficer, saved: pageSaved, alerts: pageAlerts, settings: pageSettings };
  (PAGES[document.body.dataset.page] || pageSearch)();
})();
