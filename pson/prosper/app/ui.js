/* Prosper app: company page tiles (bento layout B from the cards prototype, app/test/cards/).
   Each function takes the normalised view model (normalise.js) and returns an HTML string. */
(function (root) {
  'use strict';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const initials = (n) => String(n || '?').replace(/^(Mr|Mrs|Ms|Miss|Dr|Sir|Dame|Lord|Lady)\.?\s+/i, '').split(/\s+/).filter(Boolean).map((w) => w[0]).filter((c) => /[A-Za-z0-9]/.test(c)).slice(0, 2).join('').toUpperCase() || '?';
  const join = (xs, sep) => xs.filter(Boolean).map(esc).join(sep || ' · ');
  const st = (label, colour) => `<span class="st ${esc(colour || 'grey')}">${esc(label)}</span>`;
  const ICON = {
    pin: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  };
  /* Company and person markers: a black disc with the Lucide glyph in white (Lucide, ISC License).
     Companies: building-2. People: circle-user-round, whose own outer ring is the black disc, so only its head and shoulders are drawn. */
  const LU = (inner, extra) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra || ''}>${inner}</svg>`;
  const GLYPH = {
    company: '<path d="M10 12h4"/><path d="M10 8h4"/><path d="M14 21v-3a2 2 0 0 0-4 0v3"/><path d="M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2"/><path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"/>',
    person: '<path d="M17.925 20.056a6 6 0 0 0-11.851.001"/><circle cx="12" cy="11" r="4"/>',
    bookmark: '<path d="M17 3a2 2 0 0 1 2 2v15a1 1 0 0 1-1.496.868l-4.512-2.578a2 2 0 0 0-1.984 0l-4.512 2.578A1 1 0 0 1 5 20V5a2 2 0 0 1 2-2z"/>',
  };
  const kindIcon = (kind, label) => `<span class="kic ${kind === 'person' ? 'person' : 'company'}"${label ? ` role="img" aria-label="${label}"` : ' aria-hidden="true"'}>${LU(GLYPH[kind === 'person' ? 'person' : 'company'])}</span>`;
  /* Save button: Lucide bookmark, filled when saved. */
  const saveInner = (on) => `${LU(GLYPH.bookmark, on ? ' class="bm on"' : ' class="bm"')}<span>${on ? 'Saved' : 'Save'}</span>`;
  const cpd = (v) => (/^\d/.test(v || '') ? cp(v) : esc(v)); // dates copy; 'before 1992' stays plain text
  const saveBtn = (on, attrs) => `<button class="btn save-btn" type="button" data-act="save" aria-pressed="${on ? 'true' : 'false'}"${attrs || ''}>${saveInner(on)}</button>`;
  /* Click-to-copy value (the same set the Prosper userscript made copyable). app.js handles click, Enter and Space. */
  const cp = (value, shown) => (value ? `<span class="cp" role="button" tabindex="0" data-copy="${esc(value)}" title="Click to copy">${shown != null ? shown : esc(value)}</span>` : (shown != null ? shown : ''));
  const URL = {
    company: (n) => 'company.html?co=' + encodeURIComponent(n),
    officers: (n) => 'officers.html?co=' + encodeURIComponent(n),
    filings: (n) => 'filings.html?co=' + encodeURIComponent(n),
    person: (ids) => 'officer.html?id=' + [].concat(ids).map(encodeURIComponent).join(','),
    psc: (id) => 'officer.html?psc=' + encodeURIComponent(id),
    disq: (kind, id) => 'officer.html?disq=' + encodeURIComponent(id) + (kind === 'corporate' ? '&k=corporate' : ''),
  };
  const head = (title, count, aside) => `<div class="tile-head"><h3>${esc(title)}${count != null && count !== '' ? `<span class="count">${esc(count)}</span>` : ''}</h3>${aside ? `<span class="aside">${aside}</span>` : ''}</div>`;

  /* Registered office nation, shown after the status text. n = {flag, name} or {text}. */
  function nationHtml(n) {
    if (!n) return '';
    if (n.flag) return `<span class="muted" style="font-size:12px">Registered office</span><img class="flag" src="flags/${esc(n.flag)}.svg" width="24" height="18" alt="${esc(n.name)}" title="Registered office: ${esc(n.name)}">`;
    return `<span class="muted" style="font-size:12px">Registered office: ${esc(n.text)}</span>`;
  }

  /* Overview header: status as bold coloured text, no external link buttons. */
  function header(vm, o = {}) {
    const meta = [cp(vm.type.label), esc(vm.type.subtype), vm.number && `No. ${cp(vm.number)}`, vm.createdText && `Incorporated ${cp(vm.createdText)}`, vm.ceasedText && `Ceased ${cp(vm.ceasedText)}`].filter(Boolean);
    return `<header class="hdr">
      <div class="hdr-top"><div style="min-width:0">
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:8px">${st(vm.status.label, vm.status.colour)}${vm.status.detail ? st(vm.status.detail, vm.status.detailColour) : ''}<span class="ro-nation" id="roNation">${nationHtml(o.nation)}</span></div>
        <h1>${cp(vm.name)}</h1>
        <div class="hdr-meta">${kindIcon('company', 'Company')}${meta.map((m) => `<span>${m}</span>`).join('<span class="sep"></span>')}</div>
        ${vm.address.oneLine ? `<div class="hdr-addr">${ICON.pin}${cp(vm.address.oneLine)}</div>` : ''}
        ${vm.otherRegister ? `<div class="hdr-addr"><span>Also registered with the <a href="${esc(vm.otherRegister.url)}" target="_blank" rel="noopener">${esc(vm.otherRegister.body)}</a>.</span></div>` : ''}
        ${vm.sic.length ? `<div class="hdr-sic">${vm.sic.map((s) => `<span class="chip"><b class="mono">${cp(s.code)}</b>${esc(s.desc)}</span>`).join('')}</div>` : ''}
      </div>
      <div class="hdr-actions">${saveBtn(o.saved, ` data-co="${esc(vm.number)}"`)}</div></div>
      ${vm.verdict.length ? `<div class="verdict ${vm.verdict.some((v) => v.tone === 'bad') ? 'bad' : vm.verdict.some((v) => v.tone === 'warn') ? 'warn' : 'neutral'}"><b>Heads up</b><span>${vm.verdict.map((v) => esc(v.text)).join(' · ')}</span></div>` : ''}
      ${vm.flags.length ? `<div class="flags">${vm.flags.map((f) => `<span class="flagtxt ${esc(f.tone)}">${esc(f.label)}</span>`).join('')}</div>` : ''}
    </header>`;
  }

  const factTile = (f, href) => { const t = `<div class="fact ${f.tone || ''}"><div class="eyebrow">${esc(f.label)}</div><div class="v num">${esc(f.value)}</div><div class="s">${esc(f.sub) || '&nbsp;'}</div></div>`; return href ? `<a class="fact-link" href="${esc(href)}">${t}</a>` : t; };

  function deadlines(vm) {
    const a = vm.accounts, c = vm.confirmation;
    const rows = vm.deadlines.map((d) => {
      const pct = d.days < 0 ? 100 : Math.max(4, Math.min(100, 100 - (d.days / 365) * 100));
      return `<div class="dline ${d.tone}"><span class="t">${esc(d.label)}</span><span class="d num">${cp(d.dueText)}</span><span class="n">${esc(d.note)}</span><span class="r">${esc(d.relText)}</span><div class="bar"><i class="${d.tone === 'ok' ? 'ok' : d.tone === 'warn' ? 'warn' : ''}" style="width:${pct}%;${d.tone === 'bad' ? 'background:var(--bad)' : ''}"></i></div></div>`;
    }).join('');
    const dl = [['Year end', esc(a.refDate)], ['Last accounts', [cp(a.lastMadeUp), esc(a.lastType)].filter(Boolean).join(' · ')], ['Last period', esc(a.lastPeriod)], ['Next period', esc(a.nextPeriod)], ['Last confirmation', cp(c.last)]].filter((x) => x[1]);
    return `${head('Deadlines')}
      ${rows ? `<div class="dlines">${rows}</div>` : `<div class="empty">${vm.status.active ? 'No filing deadlines on record.' : 'No deadlines: the company is ' + esc(vm.status.label.toLowerCase()) + '.'}</div>`}
      ${dl.length ? `<dl class="dl acc-dl">${dl.map(([k, v]) => `<dt>${esc(k)}</dt><dd class="num">${v}</dd>`).join('')}</dl>` : ''}`;
  }

  /* People: names open that person's appointments; other appointments link to those companies. */
  function personName(p) { return p.officerId ? `<a href="${esc(URL.person(p.officerId))}">${esc(p.name)}</a>` : esc(p.name); }
  function personRow(p, vm) {
    const ap = p.appointmentsLink && vm.appointments[p.appointmentsLink];
    const other = ap ? ap.items.filter((x) => x.number !== vm.number) : [];
    const idv = p.idv ? `<span class="idv" title="Identity verified ${esc(p.idv.verifiedOn)}">${ICON.check}ID verified</span>` : '';
    const dq = vm.disq && p.personNumber && vm.disq[p.personNumber];
    const left = `<div style="min-width:0"><div class="nm">${personName(p)}${idv}</div><div class="rl">${esc(p.roleLabel)}${p.resigned ? ' · resigned ' + cpd(p.resigned) : p.appointed ? ' · since ' + cpd(p.appointed) : ''}${p.tenureYears != null && !p.resigned ? ` (${p.tenureYears}y)` : ''}</div>${dq ? `<div><a class="flagtxt bad" href="${esc(URL.person(p.officerId))}">Disqualified director</a></div>` : ''}</div>`;
    const c2 = `<div class="cell hide-c">${esc(p.nationality)}<span class="faint">${esc(p.residence ? 'Lives in ' + p.residence : '')}</span></div>`;
    const apHtml = other.length ? `<details class="appts"><summary>${other.length} other appointment${other.length === 1 ? '' : 's'}${ap.total > ap.items.length ? ` (of ${ap.total})` : ''}</summary><ul>${other.slice(0, 8).map((x) => `<li><span>${x.number ? `<a href="${esc(URL.company(x.number))}">${esc(x.company)}</a>` : esc(x.company)} <span class="faint" style="display:inline">${esc(x.role)}</span></span><span class="faint" style="display:inline">${esc(x.resigned ? 'resigned ' + x.resigned : x.status)}</span></li>`).join('')}</ul></details>` : '';
    return `<div class="person">${kindIcon(p.corporate ? 'company' : 'person')}${left}${c2}${apHtml}</div>`;
  }
  function officers(vm, o = {}) {
    const of = vm.officers, lim = o.limit || 6;
    const roles = Object.entries(of.roleCounts).map(([k, v]) => `<span class="chip"><b>${v}</b>${esc(k.toLowerCase())}${v > 1 ? 's' : ''}</span>`).join('');
    const sum = [roles, of.medianAge ? `<span class="chip">Median age <b>${of.medianAge}</b></span>` : '', of.nationalities[0] ? `<span class="chip">${esc(of.nationalities.slice(0, 2).map((n) => n.name).join(', '))}</span>` : '', of.verifiedCount ? `<span class="chip">ID verified <b>${of.verifiedCount}/${of.active.length}</b></span>` : ''].join('');
    const act = of.active.map((p) => personRow(p, vm));
    const former = of.former.slice(0, 20).map((p) => personRow(p, vm));
    const w = vm.officerWord || { many: 'Officers' };
    return `${head(w.many === 'Officers' ? 'People' : w.many, of.counts.active + ' active', of.counts.resigned ? of.counts.resigned + ' former' : '')}
      ${!of.active.length ? '' : `<div class="people-sum">${sum}</div>`}
      ${act.length ? `<div class="people compact">${act.slice(0, lim).join('')}</div>` : `<div class="empty">No current ${esc(w.many.toLowerCase())}.${of.counts.resigned ? ' ' + of.counts.resigned + ' former ' + esc((of.counts.resigned === 1 ? w.one || 'officer' : w.many).toLowerCase()) + ' below.' : ''}</div>`}
      ${act.length > lim ? `<details><summary class="more">Show ${act.length - lim} more</summary><div class="people compact">${act.slice(lim).join('')}</div></details>` : ''}
      ${former.length ? `<details${act.length ? '' : ' open'}><summary class="more">Former ${esc(w.many.toLowerCase())} (${of.counts.resigned})</summary><div class="people compact">${former.join('')}</div>${of.counts.resigned > 20 ? '<div class="muted" style="font-size:12px;padding-top:6px">Showing the 20 most recent.</div>' : ''}</details>` : ''}`;
  }

  /* Officer changes: the whole tile opens the full officers list. */
  function changes(vm) {
    const ch = vm.officers.changes;
    return `<a class="tile tile-link s5" href="${esc(URL.officers(vm.number))}">${head('Officer changes', 'last 12 months')}${ch.length ? `<ul class="changes">${ch.slice(0, 8).map((c) => `<li><span class="k ${c.kind}">${c.kind}</span><span><b style="font-weight:600;color:var(--ink-900)">${esc(c.name)}</b> <span class="muted">${esc(c.role.toLowerCase())} · ${esc(c.dateText)}</span></span></li>`).join('')}</ul>` : '<div class="empty">No appointments or resignations in the last 12 months.</div>'}<div class="tile-foot">View all officers</div></a>`;
  }

  /* Ownership: one row per PSC. Names open the PSC's own record (by Companies House PSC ID), or the company for UK corporate PSCs.
     Each nature of control is a separate line in Companies House's wording; 'Owner' only where it includes ownership of shares. */
  function pscLink(p) {
    if (p.ukCompany) return `<a href="${esc(URL.company(p.ukCompany))}">${esc(p.name)}</a>`;
    if (p.pscId && !p.secure) return `<a href="${esc(URL.psc(p.pscId))}">${esc(p.name)}</a>`;
    return esc(p.name);
  }
  function ownership(vm) {
    const w = vm.ownership;
    const row = (p) => `<div class="psc"><div class="line"><span class="nm">${pscLink(p)}${p.idv ? `<span class="idv">${ICON.check}ID verified</span>` : ''}</span><span class="bd">${esc(p.role)}</span>${p.notified ? `<span class="since">since ${esc(p.notified)}</span>` : ''}</div>${p.controls.map((c) => `<div class="other">${esc(c)}</div>`).join('')}${p.sanctioned ? '<div class="other flagtxt bad">On a sanctions list</div>' : ''}</div>`;
    const list = w.current.map(row).join('');
    const notes = w.notes.map((t) => `<div class="own-note">${esc(t)}</div>`).join('');
    return `${head('Ownership', w.current.length ? w.current.length + ' PSC' + (w.current.length === 1 ? '' : 's') : '', w.counts.ceased ? w.counts.ceased + ' ceased' : '')}
      ${list ? `<div class="psc-list">${list}</div>` : ''}
      ${notes ? `<div${list ? ' style="margin-top:10px"' : ''}>${notes}</div>` : ''}
      ${w.ceased.length ? `<details><summary class="more">Former PSCs (${w.ceased.length})</summary><div class="psc-list" style="margin-top:8px">${w.ceased.map((p) => `<div class="psc"><div class="line"><span class="nm">${pscLink(p)}</span><span class="since">${esc(p.notified)} – ${esc(p.ceased)}</span></div></div>`).join('')}</div></details>` : ''}`;
  }

  function charges(vm, o = {}) {
    const c = vm.charges, lim = o.limit || 3;
    if (!c.available || !c.total) return `${head('Charges')}<div class="empty">No charges registered against this company.</div>`;
    const out = c.outstanding, sat = c.satisfied;
    const row = (x) => `<div class="charge${x.outstanding ? '' : ' muted-row'}"><div class="charge-top"><div style="min-width:0"><div class="who">${esc(x.entitled.join(', ') || x.title)}${x.moreEntitled ? ' and others' : ''}</div>
      <div class="meta">${esc(x.title)} · created ${esc(x.created)}${x.code ? ` · <span class="mono">${esc(x.code)}</span>` : ''}${x.satisfied ? ' · satisfied ' + esc(x.satisfied) : ''}</div></div><span class="flagtxt ${x.outstanding ? 'warn' : 'neutral'}">${esc(x.statusLabel)}</span></div>
      ${x.features.length ? `<div class="feat">${x.features.map((f) => `<span class="chip">${esc(f)}</span>`).join('')}</div>` : ''}
      ${x.description || x.secured ? `<div class="desc">${esc((x.description || x.secured).slice(0, 220))}${(x.description || x.secured).length > 220 ? '…' : ''}</div>` : ''}</div>`;
    return `${head('Charges', out + ' outstanding', c.total + ' total')}
      <div class="chg-sum"><div class="bar"><i class="warn" style="width:${(out / c.total) * 100}%"></i><i class="neutral" style="width:${(sat / c.total) * 100}%"></i></div><div class="legend"><span><i style="background:#d49a4b"></i>${out} outstanding</span><span><i style="background:var(--ink-300)"></i>${sat} satisfied</span></div></div>
      ${c.lenders.length ? `<div class="people-sum">${c.lenders.slice(0, 4).map((l) => `<span class="chip">${esc(l.name)} <b>${l.n}</b></span>`).join('')}</div>` : ''}
      <div class="charges">${c.items.slice(0, lim).map(row).join('')}</div>
      ${c.items.length > lim ? `<details><summary class="more">Show ${c.items.length - lim} more</summary><div class="charges" style="margin-top:8px">${c.items.slice(lim).map(row).join('')}</div></details>` : ''}`;
  }

  function insolvency(vm) {
    const i = vm.insolvency; if (!i.cases.length) return '';
    return `${head('Insolvency', i.cases.length + ' case' + (i.cases.length === 1 ? '' : 's'))}${i.cases.map((c) => `<div class="ins"><h4>${esc(c.type)}${c.number ? ` <span class="faint" style="font-weight:500;font-size:13px">case ${esc(c.number)}</span>` : ''}</h4>
      <div class="dates">${c.dates.map((d) => `<span class="chip">${esc(d.label)} <b>${esc(d.date)}</b></span>`).join('')}</div>
      ${c.practitioners.map((p) => `<div class="ip"><b style="color:var(--ink-900)">${esc(p.name)}</b> <span class="muted">${esc(p.role)}${p.appointed ? ' · appointed ' + esc(p.appointed) : ''}${p.ceased ? ' · ceased ' + esc(p.ceased) : ''}</span><div class="faint" style="font-size:12px">${esc(p.address)}</div></div>`).join('')}
      ${c.notes.map((n) => `<div class="faint" style="font-size:12px;margin-top:6px">${esc(n)}</div>`).join('')}</div>`).join('')}`;
  }

  /* One filing row: date, form type, short description, PDF link. Shared by the tile and the filings page. */
  function filingRow(it, number) {
    const title = it.strong && it.title.startsWith(it.strong) ? `<b>${esc(it.strong)}</b>${esc(it.title.slice(it.strong.length))}` : esc(it.title);
    return `<div class="fl-row"><span class="dt num">${esc(it.date)}</span><span class="ty" title="${esc(it.categoryLabel)}">${esc(it.typeCode)}</span><span class="ds">${title}</span><span class="pdf">${it.pdfUrl ? `<a href="${esc(it.pdfUrl)}" target="_blank" rel="noopener" title="Download the PDF from Companies House">PDF${it.pages ? ' · ' + it.pages + 'p' : ''}</a>` : ''}</span></div>`;
  }
  function filings(vm) {
    const f = vm.filings;
    if (!f.items.length) return `${head('Filing history')}<div class="empty">No filings on record.</div>`;
    return `${head('Filing history', f.total.toLocaleString('en-GB'), 'latest 5')}
      <div>${f.items.slice(0, 5).map((it) => filingRow(it, vm.number)).join('')}</div>
      <div class="tile-foot"><a href="${esc(URL.filings(vm.number))}">View all filings</a></div>`;
  }

  /* Similar companies: three tabs, each loaded with its own request when opened (app.js fills #simBody). */
  const SIM_TABS = [['nearby', 'Nearby'], ['trade', 'Same trade, UK-wide'], ['connected', 'Connected']];
  function similar() {
    return `${head('Similar companies')}<div class="tabs-plain" role="tablist" aria-label="Similar companies">${SIM_TABS.map(([k, l], i) => `<a href="#" role="tab" id="simTab-${k}" data-sim="${k}" aria-controls="simBody" aria-selected="${i === 0}"${i === 0 ? ' class="on"' : ''}>${esc(l)}</a>`).join('')}</div><div id="simBody" role="tabpanel" aria-live="polite"><div class="loading">Loading…</div></div>`;
  }
  const simRow = (x) => `<div class="sim-row"><a class="nm" href="${esc(URL.company(x.number))}">${esc(x.name)}</a><span class="m num">${x.ageYears != null ? esc(x.ageYears + 'y') : ''}</span><span class="s">${esc(join([x.town, x.postcode, x.generic ? 'general activity code' : '']))}</span><span class="m">${esc(x.number)}</span></div>`;
  function simList(items, notes) {
    const n = (notes || []).filter(Boolean).map((t) => `<div class="muted" style="font-size:12px;margin-top:8px">${esc(t)}</div>`).join('');
    return (items.length ? `<div class="sim">${items.map(simRow).join('')}</div>` : '') + n;
  }
  /* Connected: companies sharing a current officer or PSC with this company, matched by Companies House ID. */
  function connectedList(rows, notes) {
    const n = (notes || []).filter(Boolean).map((t) => `<div class="muted" style="font-size:12px;margin-top:8px">${esc(t)}</div>`).join('');
    const via = (l) => `${l.href ? `<a href="${esc(l.href)}">${esc(l.name)}</a>` : esc(l.name)}, ${esc(l.role.toLowerCase())}`;
    return `<div class="muted" style="font-size:12px;margin-bottom:6px">Companies sharing a director or owner with this company (matched by Companies House ID)</div>${rows.length ? `<div class="sim">${rows.map((r) => `<div class="sim-row"><a class="nm" href="${esc(URL.company(r.number))}">${esc(r.name)}</a><span class="m">${r.status ? st(r.status, r.colour) : ''}</span><span class="s">Linked through ${r.links.slice(0, 3).map(via).join('; ')}${r.links.length > 3 ? ` and ${r.links.length - 3} more` : ''}</span><span class="m">${esc(r.number)}</span></div>`).join('')}</div>` : ''}${n}`;
  }

  function ukEstablishments(vm) {
    const u = vm.ukEstablishments;
    return `${head('UK establishments', u.length)}${u.length ? `<div class="sim">${u.map((x) => `<div class="sim-row"><a class="nm" href="${esc(URL.company(x.number))}">${esc(x.name)}</a><span class="m">${x.status ? st(x.status, x.colour) : ''}</span><span class="s">${esc(x.town)}</span><span class="m">${esc(x.number)}</span></div>`).join('')}</div>` : '<div class="empty">No UK establishments on record.</div>'}`;
  }

  /* Bento layout B, without the AI summary tile. */
  function companyPage(vm, o = {}) {
    const f = Object.fromEntries(vm.keyFacts.map((x) => [x.key, x]));
    const tile = (cls, html) => (html ? `<div class="tile ${cls}">${html}</div>` : '');
    const ins = insolvency(vm);
    return `<article class="lay-b"><div class="card shell">
      ${header(vm, o)}
      <div class="bento">
        <div class="s3">${factTile(f.age)}</div><div class="s3">${factTile(f.directors, URL.officers(vm.number))}</div><div class="s3">${factTile(f.owners)}</div><div class="s3">${factTile(f.charges)}</div>
        ${ins ? tile('s12', ins) : ''}
        ${tile('s4', deadlines(vm))}
        ${tile('s8', officers(vm, { limit: 6 }))}
        ${tile('s5', ownership(vm))}
        ${tile('s7', charges(vm, { limit: 3 }))}
        ${changes(vm)}
        ${tile('s7', filings(vm))}
        ${o.ukEst ? tile('s5', similar()) + tile('s7', ukEstablishments(vm)) : tile('s12', similar())}
      </div></div></article>`;
  }

  root.UI = { kindIcon, saveBtn, saveInner, cp, GLYPH, LU, esc, st, initials, URL, head, header, companyPage, filingRow, personRow, nationHtml, simList, connectedList, pscLink, ICON, factTile, join };
})(window);
