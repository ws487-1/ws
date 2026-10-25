/* Prosper free tools: one small shared module. Each page sets <body data-tool="director|company|address">.
   Live: Companies House public API with the visitor's own key (Settings). No key: the worked example from fixture.json. */
'use strict';
const T = (() => {
  const { $, esc, date, addr, typeName, statusPill } = Kit;
  const CHL = (n) => `https://find-and-update.company-information.service.gov.uk/company/${encodeURIComponent(n)}`;
  let FX = null;
  const fx = async () => FX || (FX = await fetch('../fixture.json').then((r) => r.json()));
  const out = () => $('#out');
  const busy = (m) => { out().innerHTML = `<p class="status">${esc(m)}</p>`; };
  const fail = (e) => { out().innerHTML = `<div class="note">${esc(e.message)}${e.code === 'nokey' ? ' <a href="#" id="try-demo">See the worked example</a>.' : ''}</div>`; const d = $('#try-demo'); if (d) d.onclick = (ev) => { ev.preventDefault(); T.demo(); }; };
  const live = () => !!Kit.key('ch');
  const demoTag = (on) => (on ? '<span class="pill warn demo">Worked example, saved 25 Oct 2026</span>' : '');
  const role = (r) => String(r || '').replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());
  const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const born = (d) => (d && d.year ? `Born ${d.month ? MON[d.month - 1] + ' ' : ''}${d.year}` : '');

  /* ---------- Director lookup: officer search, grouped by name + birth month/year (one person often has several records) ---------- */
  const director = {
    async run(q, demo) {
      busy('Searching the officers register…');
      let items;
      try {
        if (demo) items = (await fx()).director.search;
        else { const r = await Kit.ch('/search/officers?items_per_page=30&q=' + encodeURIComponent(q)); items = ((r && r.items) || []).map((i) => ({ title: i.title, appointment_count: i.appointment_count, date_of_birth: i.date_of_birth, link: i.links && i.links.self })); }
      } catch (e) { return fail(e); }
      const groups = {};
      for (const i of items) { const k = i.title.toUpperCase().replace(/\s+/g, ' ') + '|' + (i.date_of_birth ? i.date_of_birth.month + '/' + i.date_of_birth.year : i.link); (groups[k] = groups[k] || { title: i.title, dob: i.date_of_birth, recs: [] }).recs.push(i); }
      const list = Object.values(groups).filter((g) => g.dob || !demo);
      if (!list.length) { out().innerHTML = '<div class="note">No officers found with that name. Try the full name as it appears on the register, for example “Jane Smith”.</div>'; return; }
      out().innerHTML = `<p class="status">${list.length} ${list.length === 1 ? 'person' : 'people'} found ${demoTag(demo)}</p><div class="card">${list.map((g, i) => `<div class="cand" data-i="${i}"><div><div class="nm">${esc(g.title)}</div><div class="sub">${esc([born(g.dob), g.recs.reduce((s, r) => s + (r.appointment_count || 0), 0) + ' appointments', g.recs.length > 1 ? g.recs.length + ' register records, likely the same person' : ''].filter(Boolean).join(' · '))}</div></div><span class="go">View companies →</span></div>`).join('')}</div>`;
      Kit.$$('.cand').forEach((el) => { el.onclick = () => director.show(list[+el.dataset.i], demo); });
      if (demo && list.length) director.show(list.find((g) => g.recs.length > 1) || list[0], demo);
    },
    async show(g, demo) {
      busy('Loading appointments…');
      let appts = [];
      try {
        for (const r of g.recs.slice(0, 8)) {
          const a = demo ? ((await fx()).director.appts[r.link] || []) : (((await Kit.ch(r.link + '?items_per_page=50')) || {}).items || []).map((x) => ({ company_name: x.appointed_to && x.appointed_to.company_name, company_number: x.appointed_to && x.appointed_to.company_number, company_status: x.appointed_to && x.appointed_to.company_status, officer_role: x.officer_role, appointed_on: x.appointed_on, appointed_before: x.appointed_before, resigned_on: x.resigned_on }));
          appts.push(...a);
        }
      } catch (e) { return fail(e); }
      const seen = new Set(); appts = appts.filter((a) => { const k = a.company_number + a.officer_role + a.appointed_on; if (seen.has(k)) return false; seen.add(k); return true; });
      const gone = (a) => /dissolved|closed|removed/.test(a.company_status || '');
      const cur = appts.filter((a) => !a.resigned_on && !gone(a)).sort((a, b) => (b.appointed_on || '').localeCompare(a.appointed_on || ''));
      const past = appts.filter((a) => a.resigned_on || gone(a)).sort((a, b) => (b.resigned_on || b.appointed_on || '').localeCompare(a.resigned_on || a.appointed_on || ''));
      const co = new Set(appts.map((a) => a.company_number));
      const row = (a) => `<div class="row"><div class="nm"><a href="${CHL(a.company_number)}" target="_blank" rel="noopener">${esc(a.company_name)}</a></div><div class="meta">${esc(role(a.officer_role))} · ${a.appointed_on ? 'appointed ' + date(a.appointed_on) : a.appointed_before ? 'appointed before ' + date(a.appointed_before) : ''}${a.resigned_on ? ' · resigned ' + date(a.resigned_on) : gone(a) ? ' · until the company closed' : ''}</div><div class="rt">${statusPill(a.company_status)}<span class="small muted num">${esc(a.company_number)}</span></div></div>`;
      out().innerHTML = `<p class="status">${demoTag(demo)}</p><div class="card"><div class="rh"><div><h2>${esc(g.title)}</h2><div class="sub">${esc(born(g.dob))}${g.recs.length > 1 ? ` · combined from ${g.recs.length} register records with the same name and birth month` : ''}</div></div></div>
        <div class="stats"><div><div class="v num">${co.size}</div><div class="l">Companies</div></div><div><div class="v num">${cur.length}</div><div class="l">Current roles</div></div><div><div class="v num">${past.length}</div><div class="l">Past roles</div></div><div><div class="v num">${appts.filter((a) => a.company_status === 'active').length}</div><div class="l">At active companies</div></div></div>
        <div class="list">${cur.length ? `<div class="sect">Current</div>${cur.map(row).join('')}` : ''}${past.length ? `<div class="sect">Past</div>${past.map(row).join('')}` : ''}</div></div>`;
    },
  };

  /* ---------- Company age & status ---------- */
  const NUM = /^(\d{8}|[A-Z]{2}\d{6}|\d{6,7})$/i;
  const company = {
    async run(q, demo) {
      busy('Looking up the company…');
      try {
        if (demo) { const p = (await fx()).company.profiles; return company.pick(Object.values(p).sort((a, b) => a.date_of_creation.localeCompare(b.date_of_creation)).map((c) => ({ title: c.company_name, company_number: c.company_number, company_status: c.company_status, date_of_creation: c.date_of_creation })), demo); }
        const s = q.trim().toUpperCase().replace(/\s+/g, '');
        if (NUM.test(s)) return company.show(s.padStart(8, '0'), false);
        const r = await Kit.ch('/search/companies?items_per_page=10&q=' + encodeURIComponent(q));
        company.pick(((r && r.items) || []).map((i) => ({ title: i.title, company_number: i.company_number, company_status: i.company_status, date_of_creation: i.date_of_creation })), false);
      } catch (e) { fail(e); }
    },
    pick(list, demo) {
      if (!list.length) { out().innerHTML = '<div class="note">No companies found. Try the registered name or the 8-character company number.</div>'; return; }
      out().innerHTML = `<p class="status">${list.length} found ${demoTag(demo)}</p><div class="card">${list.map((c, i) => `<div class="cand" data-i="${i}"><div><div class="nm">${esc(c.title)}</div><div class="sub">${esc(c.company_number)} · ${c.date_of_creation ? 'incorporated ' + date(c.date_of_creation) : ''}</div></div><span class="go">${statusPill(c.company_status)}</span></div>`).join('')}</div>`;
      Kit.$$('.cand').forEach((el) => { el.onclick = () => company.show(list[+el.dataset.i].company_number, demo); });
      if (demo) company.show(list[0].company_number, demo, true);
    },
    async show(n, demo, keepList) {
      let c;
      try { c = demo ? (await fx()).company.profiles[n] : await Kit.ch('/company/' + encodeURIComponent(n)); } catch (e) { return fail(e); }
      if (!c) { out().innerHTML = '<div class="note">No company with that number.</div>'; return; }
      const today = new Date(demo ? '2026-10-25' : Date.now()).toISOString().slice(0, 10);
      const acc = c.accounts || {}, cs = c.confirmation_statement || {};
      const nextAcc = (acc.next_accounts && acc.next_accounts.due_on) || acc.next_due, accOver = !!(acc.next_accounts && acc.next_accounts.overdue) || acc.overdue || (nextAcc && nextAcc < today && c.company_status === 'active');
      const csOver = !!cs.overdue || (cs.next_due && cs.next_due < today && c.company_status === 'active');
      const flags = [statusPill(c.company_status)];
      if (c.company_status === 'active') flags.push(accOver ? '<span class="pill bad">Accounts overdue</span>' : '<span class="pill ok">Accounts up to date</span>', csOver ? '<span class="pill bad">Confirmation statement overdue</span>' : '<span class="pill ok">Confirmation statement up to date</span>');
      if (c.has_insolvency_history) flags.push('<span class="pill bad">Insolvency history</span>');
      if (c.has_charges) flags.push('<span class="pill">Has registered charges</span>');
      const d = c.date_of_creation, end = c.date_of_cessation;
      const ageTxt = d ? Kit.ageOf(d, new Date(end || today)) : '';
      const prev = (c.previous_company_names || []).map((p) => `${esc(p.name)} <span class="muted">(until ${date(p.ceased_on)})</span>`).join('<br>');
      const html = `<div class="card" id="co"><div class="rh"><div style="flex:1"><div class="sub">${esc(c.company_number)} · ${esc(typeName(c.type, c.subtype))}</div><h2>${esc(c.company_name)}</h2></div><div style="text-align:right"><div class="age">${esc(ageTxt)}</div><div class="sub">${end ? 'old when dissolved' : 'old'}</div></div></div>
        <div class="verdict">${flags.join('')}</div>
        <dl class="facts"><dt>Incorporated</dt><dd>${date(d)}</dd>${end ? `<dt>Dissolved</dt><dd>${date(end)}</dd>` : ''}
        <dt>Last accounts</dt><dd>${acc.last_accounts && acc.last_accounts.made_up_to ? 'Made up to ' + date(acc.last_accounts.made_up_to) + (acc.last_accounts.type ? ` <span class="muted">(${esc(acc.last_accounts.type.replace(/-/g, ' '))})</span>` : '') : '<span class="muted">None filed yet</span>'}</dd>
        ${c.company_status === 'active' ? `<dt>Next accounts due</dt><dd>${nextAcc ? date(nextAcc) : '–'}</dd><dt>Next confirmation statement</dt><dd>${cs.next_due ? date(cs.next_due) : '–'}</dd>` : ''}
        <dt>Registered office</dt><dd>${esc(addr(c.registered_office_address))}</dd>${prev ? `<dt>Previous names</dt><dd>${prev}</dd>` : ''}
        <dt>Source</dt><dd><a href="${CHL(c.company_number)}" target="_blank" rel="noopener">Companies House record</a></dd></dl></div>`;
      if (keepList) out().insertAdjacentHTML('beforeend', '<div style="height:14px"></div>' + html); else out().innerHTML = `<p class="status">${demoTag(demo)}</p>` + html;
    },
  };

  /* ---------- Registered office address lookup: advanced search 'location' with the postcode, then match the building ---------- */
  const address = {
    async run(q, demo) {
      const m = q.toUpperCase().match(/([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\s*$/);
      if (!m && !demo) { out().innerHTML = '<div class="note">Add a full postcode at the end, for example “10 Downing Street, SW1A 2AA”.</div>'; return; }
      const post = demo ? 'EX1 1RS' : m[1] + ' ' + m[2]; const building = demo ? '' : q.toUpperCase().slice(0, m.index).replace(/[,\s]+$/, '').trim();
      busy('Searching registered office addresses…');
      let r;
      try { r = demo ? (await fx()).address : await Kit.ch('/advanced-search/companies?size=500&location=' + encodeURIComponent(post)); } catch (e) { return fail(e); }
      const all = ((r && r.items) || []).filter((c) => Kit.pc((c.registered_office_address || {}).postal_code) === Kit.pc(post));
      const num = (building.match(/\d+[A-Z]?/) || [''])[0];
      const items = num ? all.filter((c) => { const a = c.registered_office_address || {}; return (' ' + [a.premises, a.address_line_1, a.address_line_2].join(' ').toUpperCase() + ' ').includes(num); }) : all;
      items.sort((a, b) => (a.company_status === 'active' ? 0 : 1) - (b.company_status === 'active' ? 0 : 1) || (b.date_of_creation || '').localeCompare(a.date_of_creation || ''));
      const act = items.filter((c) => c.company_status === 'active').length;
      const shared = act >= 20 ? '<div class="note" style="margin:14px 20px">This looks like a <b>shared address</b> (an accountant, formation agent or virtual office). Companies registered here may trade from somewhere else.</div>' : '';
      const row = (c) => `<div class="row"><div class="nm"><a href="${CHL(c.company_number)}" target="_blank" rel="noopener">${esc(c.company_name)}</a></div><div class="meta">${esc(typeName(c.company_type, c.company_subtype))} · incorporated ${date(c.date_of_creation)}${c.date_of_cessation ? ' · dissolved ' + date(c.date_of_cessation) : ''} · ${esc([(c.registered_office_address || {}).premises, (c.registered_office_address || {}).address_line_1].filter(Boolean).join(' '))}</div><div class="rt">${statusPill(c.company_status)}<span class="small muted num">${esc(c.company_number)}</span></div></div>`;
      out().innerHTML = `<p class="status">${demoTag(demo)}</p><div class="card"><div class="rh"><div><h2>${esc(building ? building + ', ' + post : post)}</h2><div class="sub">Companies whose registered office is at this ${num ? 'address' : 'postcode'}</div></div></div>
        <div class="stats"><div><div class="v num">${items.length}</div><div class="l">Companies</div></div><div><div class="v num">${act}</div><div class="l">Active</div></div><div><div class="v num">${items.length - act}</div><div class="l">Dissolved or closed</div></div><div><div class="v num">${items.length ? date(items.map((c) => c.date_of_creation).sort().pop()).replace(/^\d+ /, '') : '–'}</div><div class="l">Newest arrival</div></div></div>
        ${shared}<div class="list">${items.slice(0, 200).map(row).join('') || '<p class="empty" style="padding:16px 20px">No companies registered here.</p>'}</div></div>
        ${(r.hits || 0) > 500 ? `<p class="hint">Showing the first 500 of ${r.hits.toLocaleString('en-GB')} matches for this postcode.</p>` : ''}`;
    },
  };

  const TOOLS = { director, company, address };
  function init() {
    const tool = document.body.dataset.tool;
    Kit.header('tools', { base: tool ? '../../' : '../' }); Kit.footer();
    if (!tool) return;
    const t = TOOLS[tool]; const inp = $('#q');
    const go = () => { const q = inp.value.trim(); if (!q) { inp.focus(); return; } if (!live()) { fail(Object.assign(new Error('Add your free Companies House API key in Settings to run your own searches.'), { code: 'nokey' })); return; } history.replaceState(null, '', '?q=' + encodeURIComponent(q)); t.run(q, false); };
    $('#go').onclick = go; inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    T.demo = () => { inp.value = { director: 'Deborah Meaden', company: 'Greggs', address: 'Curzon House, EX1 1RS' }[tool]; t.run('', true); };
    const d = $('#demo'); if (d) d.onclick = (e) => { e.preventDefault(); T.demo(); };
    const q = new URLSearchParams(location.search).get('q');
    if (q && live()) { inp.value = q; t.run(q, false); } else if (location.hash === '#example') T.demo();
  }
  return { init, demo: () => {} };
})();
T.init();
