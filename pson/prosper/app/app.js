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
  const SLOT = { ch: 'prosper.key.ch', claude: 'prosper.key.claude', saved: 'prosper.saved' };
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
  const saved = () => (Array.isArray(lsGet(SLOT.saved)) ? lsGet(SLOT.saved) : []);
  const isSaved = (n) => saved().some((s) => s.number === n);

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
  };
  const NAV = [['search', 'Search', 'index.html', 'search'], ['saved', 'Saved', 'saved.html', 'bookmark'], ['alerts', 'Alerts', 'alerts.html', 'bell'], ['settings', 'Settings', 'settings.html', 'settings']];
  function shell(active) {
    const q = active === 'search' ? qs.get('q') || '' : '';
    const type = qs.get('type') === 'people' ? 'people' : '';
    document.body.innerHTML = `<div class="app">
      <aside class="side" id="side"><div class="side-in"><a class="wordmark" href="index.html">Prosper</a>
        <nav class="nav">${NAV.map(([k, label, href, ic]) => `<a href="${href}"${k === active ? ' class="on" aria-current="page"' : ''}>${svg(ICONS[ic])}<span>${label}</span></a>`).join('')}</nav></div></aside>
      <div class="main">
        <div class="top"><button class="icon-btn menu-btn" id="menuBtn" aria-label="Menu" aria-expanded="false">${svg(ICONS.menu)}</button><a class="wordmark" href="index.html">Prosper</a>
          <form class="search" action="index.html" method="get" role="search"><input name="q" type="search" value="${esc(q)}" placeholder="Search companies or people by name or number" aria-label="Search companies or people">${type ? '<input type="hidden" name="type" value="people">' : ''}<button class="btn" type="submit">Search</button></form></div>
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

  /* ---------- Search (home + results) ---------- */
  async function pageSearch() {
    const el = shell('search');
    const q = (qs.get('q') || '').trim(), type = qs.get('type') === 'people' ? 'people' : 'companies';
    const page = Math.max(1, parseInt(qs.get('page'), 10) || 1);
    if (!q) {
      setTitle('Search');
      el.innerHTML = `<div class="page-head"><div><h1>Search</h1><div class="sub">Search Companies House by company name or number, or by a person's name.</div></div></div>${chKey() ? '' : '<div class="panel plain-msg">Add your Companies House API key in <a href="settings.html">Settings</a> to start searching.</div>'}`;
      document.querySelector('.search input').focus();
      return;
    }
    if (type === 'companies' && isNumber(q) && page === 1) { location.replace(U.company(normNumber(q))); return; }
    setTitle(q);
    const tabs = `<nav class="tabs-plain">${[['companies', 'Companies'], ['people', 'People']].map(([k, l]) => `<a href="${esc(withParams('index.html', { q, type: k === 'people' ? 'people' : '' }))}"${k === type ? ' class="on"' : ''}>${l}</a>`).join('')}</nav>`;
    el.innerHTML = `<div class="page-head"><div><h1>Results for “${esc(q)}”</h1></div></div>${tabs}<div class="panel" id="res"></div>`;
    const res = document.getElementById('res');
    loading(res, 'Searching…');
    try {
      if (type === 'companies') {
        const per = 20, raw = await ch(`/search/companies?q=${encodeURIComponent(q)}&items_per_page=${per}&start_index=${(page - 1) * per}`);
        const r = N.searchCompanies(raw);
        if (!r.items.length) { res.innerHTML = '<div class="plain-msg">No companies found.</div>'; return; }
        const total = Math.min(r.total, 1000);
        res.innerHTML = `<div class="res-list">${r.items.map((c) => `<div class="res"><div><a class="nm" href="${esc(U.company(c.number))}">${esc(c.name)}</a></div><div class="rt">${st(c.status, c.colour)}</div>
          <div class="meta">${esc(['No. ' + c.number, c.created && 'Incorporated ' + c.created, c.ceased && 'Ceased ' + c.ceased].filter(Boolean).join(' · '))}</div><div></div>
          ${c.address ? `<div class="addr">${esc(c.address)}</div>` : ''}</div>`).join('')}</div>
          ${pager(page, Math.ceil(total / per), r.total, (page - 1) * per + 1, (page - 1) * per + r.items.length, (p) => withParams('index.html', { q, page: p }))}`;
      } else {
        const per = 50, raw = await ch(`/search/officers?q=${encodeURIComponent(q)}&items_per_page=${per}&start_index=${(page - 1) * per}`);
        const r = N.searchOfficers(raw);
        if (!r.groups.length) { res.innerHTML = '<div class="plain-msg">No people found.</div>'; return; }
        const total = Math.min(r.total, 1000);
        res.innerHTML = `<div class="res-list">${r.groups.map((g) => `<div class="res"><div><a class="nm" href="${esc(U.person(g.ids))}">${esc(g.name)}</a></div><div class="rt">${g.count} appointment${g.count === 1 ? '' : 's'}</div>
          <div class="meta">${esc(g.born ? 'Born ' + g.born : 'Date of birth not shown')}${g.ids.length > 1 ? ` · ${g.ids.length} Companies House records` : ''}</div><div></div>
          ${g.addresses[0] ? `<div class="addr">${esc(g.addresses[0])}</div>` : ''}</div>`).join('')}</div>
          ${pager(page, Math.ceil(total / per), r.total, (page - 1) * per + 1, (page - 1) * per + r.loaded, (p) => withParams('index.html', { q, type: 'people', page: p }))}`;
      }
    } catch (e) { showError(res, e); }
  }

  /* ---------- Company page (bento) ---------- */
  async function loadCompany(n) {
    const c = '/company/' + n, raw = {};
    raw.profile = await ch(c);
    if (raw.profile._http) throw new ApiError('404', 'No company found with number ' + n + '.');
    // Only ask for the parts the profile links to (Companies House answers 404 for the rest).
    const p = raw.profile, L = p.links || {}, sic = (p.sic_codes || [])[0], town = p.registered_office_address && p.registered_office_address.locality;
    const [officers, psc, pscStatements, exemptions, registers, ukEstablishments, charges, insolvency, filings, similar] = await Promise.all([
      ch(c + '/officers?items_per_page=100'), L.persons_with_significant_control ? ch(c + '/persons-with-significant-control?items_per_page=25') : null,
      L.persons_with_significant_control_statements ? ch(c + '/persons-with-significant-control-statements?items_per_page=25') : null,
      L.exemptions ? ch(c + '/exemptions') : null, L.registers ? ch(c + '/registers') : null, L.uk_establishments ? ch(c + '/uk-establishments') : null, p.has_charges ? ch(c + '/charges?items_per_page=25') : null,
      p.has_insolvency_history ? ch(c + '/insolvency') : null, ch(c + '/filing-history?items_per_page=25'),
      sic ? ch('/advanced-search/companies?company_status=active&size=12&sic_codes=' + sic + (town ? '&location=' + encodeURIComponent(town) : '')).catch(() => null) : null]);
    Object.assign(raw, { officers, psc, pscStatements, exemptions, registers, ukEstablishments, charges, insolvency, filings, similar, appointments: {} });
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
      const vm = N.company(await loadCompany(n));
      setTitle(vm.name);
      el.innerHTML = window.UI.companyPage(vm, { saved: isSaved(vm.number) });
      const b = el.querySelector('[data-act="save"]');
      b.addEventListener('click', () => {
        const list = saved().filter((s) => s.number !== vm.number);
        if (isSaved(vm.number)) { lsSet(SLOT.saved, list); b.textContent = 'Save'; }
        else { list.unshift({ number: vm.number, name: vm.name, status: vm.status.label, colour: vm.status.colour, town: vm.address.town || '', savedAt: new Date().toISOString().slice(0, 10) }); lsSet(SLOT.saved, list); b.textContent = 'Saved'; }
      });
    } catch (e) { showError(el, e); }
  }
  const companyLine = (p) => `<a href="${esc(U.company(p.company_number))}">${esc(N.profile(p).name)}</a> · No. ${esc(p.company_number)}`;

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
      const name = N.profile(prof).name;
      setTitle('Officers · ' + name);
      const nm = (p) => (p.officerId ? `<a href="${esc(U.person(p.officerId))}">${esc(p.name)}</a>` : esc(p.name));
      const natc = (p) => esc([p.nationality, p.residence].filter(Boolean).join(' / '));
      let body;
      if (!of.all.length) body = '<div class="plain-msg">No officers on record.</div>';
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
      el.innerHTML = `<div class="page-head"><div><h1>Officers</h1><div class="sub">${companyLine(prof)} · ${of.counts.active} current · ${of.counts.resigned} resigned</div></div></div><div class="panel">${body}</div>`;
    } catch (e) { showError(el, e); }
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

  /* ---------- Person page: appointments across all of this person's Companies House records ---------- */
  async function pageOfficer() {
    const el = shell('');
    const ids = (qs.get('id') || '').split(',').map((s) => s.trim()).filter((s) => /^[A-Za-z0-9_-]{6,}$/.test(s)).slice(0, 10);
    if (!ids.length) { el.innerHTML = '<div class="panel plain-msg">No person given. <a href="index.html?type=people">Search people</a></div>'; return; }
    setTitle('Person'); loading(el);
    try {
      const raws = await Promise.all(ids.map((id) => allPages('/officers/' + id + '/appointments', 50, 500)));
      const recs = raws.filter((r) => !r._http).map((r) => N.appointments(r)).filter(Boolean);
      if (!recs.length) throw new ApiError('404', 'No appointments found for this person.');
      const name = recs[0].name, born = recs.map((r) => r.born).find(Boolean) || '';
      const items = [].concat(...recs.map((r) => r.items)).sort((a, b) => (!!a.resignedIso - !!b.resignedIso) || (b.resignedIso || b.appointedIso).localeCompare(a.resignedIso || a.appointedIso));
      const active = items.filter((x) => !x.resignedIso).length;
      setTitle(name);
      el.innerHTML = `<div class="page-head"><div><h1>${esc(name)}</h1><div class="sub">${esc([born && 'Born ' + born, items.length + ' appointment' + (items.length === 1 ? '' : 's'), active + ' current'].filter(Boolean).join(' · '))}</div></div></div>
        <div class="panel"><div class="table-wrap"><table class="table"><thead><tr><th>Company</th><th>Status</th><th>Role</th><th class="nowrap">Appointed</th><th class="nowrap">Resigned</th></tr></thead><tbody>${items.map((a) => `<tr><td>${a.number ? `<a href="${esc(U.company(a.number))}">${esc(a.company)}</a> <span class="faint">${esc(a.number)}</span>` : esc(a.company)}</td><td>${a.status ? st(a.status, a.colour) : ''}</td><td>${esc(a.role)}</td><td class="nowrap num">${esc(a.appointed)}</td><td class="nowrap num">${esc(a.resigned)}</td></tr>`).join('')}</tbody></table></div></div>`;
    } catch (e) { showError(el, e); }
  }

  /* ---------- Saved, Alerts, Settings ---------- */
  function pageSaved() {
    const el = shell('saved'); setTitle('Saved');
    const draw = () => {
      const list = saved();
      el.innerHTML = `<div class="page-head"><div><h1>Saved</h1><div class="sub">Companies you have saved in this browser.</div></div></div><div class="panel">${list.length ? `<div class="res-list">${list.map((s) => `<div class="res"><div><a class="nm" href="${esc(U.company(s.number))}">${esc(s.name)}</a></div><div class="rt"><button class="lnk" data-rm="${esc(s.number)}">Remove</button></div><div class="meta">${st(s.status, s.colour)} · ${esc(['No. ' + s.number, s.town, s.savedAt && 'saved ' + N.fmtDate(s.savedAt)].filter(Boolean).join(' · '))}</div></div>`).join('')}</div>` : '<div class="plain-msg">Nothing saved yet. Use Save on a company page.</div>'}</div>`;
      el.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', () => { lsSet(SLOT.saved, saved().filter((s) => s.number !== b.dataset.rm)); draw(); }));
    };
    draw();
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
