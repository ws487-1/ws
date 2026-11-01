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
  const URL = {
    company: (n) => 'company.html?co=' + encodeURIComponent(n),
    officers: (n) => 'officers.html?co=' + encodeURIComponent(n),
    filings: (n) => 'filings.html?co=' + encodeURIComponent(n),
    person: (ids) => 'officer.html?id=' + [].concat(ids).map(encodeURIComponent).join(','),
  };
  const head = (title, count, aside) => `<div class="tile-head"><h3>${esc(title)}${count != null && count !== '' ? `<span class="count">${esc(count)}</span>` : ''}</h3>${aside ? `<span class="aside">${aside}</span>` : ''}</div>`;

  /* Overview header: status as bold coloured text, no external link buttons. */
  function header(vm, o = {}) {
    const meta = [vm.type.label, vm.type.subtype, vm.number && `No. ${vm.number}`, vm.createdText && `Incorporated ${vm.createdText}`, vm.ceasedText && `Ceased ${vm.ceasedText}`].filter(Boolean);
    return `<header class="hdr">
      <div class="hdr-top"><div style="min-width:0">
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:8px">${st(vm.status.label, vm.status.colour)}${vm.status.detail ? st(vm.status.detail, vm.status.detailColour) : ''}${vm.jurisdiction ? `<span class="faint" style="font-size:12px">${esc(vm.jurisdiction)}</span>` : ''}</div>
        <h1>${esc(vm.name)}</h1>
        <div class="hdr-meta">${meta.map((m) => `<span>${esc(m)}</span>`).join('<span class="sep"></span>')}</div>
        ${vm.address.oneLine ? `<div class="hdr-addr">${ICON.pin}<span>${esc(vm.address.oneLine)}</span></div>` : ''}
        ${vm.sic.length ? `<div class="hdr-sic">${vm.sic.map((s) => `<span class="chip"><b class="mono">${esc(s.code)}</b>${esc(s.desc)}</span>`).join('')}</div>` : ''}
      </div>
      <div class="hdr-actions"><button class="save-btn" data-act="save" data-co="${esc(vm.number)}">${o.saved ? 'Saved' : 'Save'}</button></div></div>
      ${vm.verdict.length ? `<div class="verdict ${vm.verdict.some((v) => v.tone === 'bad') ? 'bad' : vm.verdict.some((v) => v.tone === 'warn') ? 'warn' : 'neutral'}"><b>Heads up</b><span>${vm.verdict.map((v) => esc(v.text)).join(' · ')}</span></div>` : ''}
      ${vm.flags.length ? `<div class="flags">${vm.flags.map((f) => `<span class="flagtxt ${esc(f.tone)}">${esc(f.label)}</span>`).join('')}</div>` : ''}
    </header>`;
  }

  const factTile = (f, href) => { const t = `<div class="fact ${f.tone || ''}"><div class="eyebrow">${esc(f.label)}</div><div class="v num">${esc(f.value)}</div><div class="s">${esc(f.sub) || '&nbsp;'}</div></div>`; return href ? `<a class="fact-link" href="${esc(href)}">${t}</a>` : t; };

  function deadlines(vm) {
    const a = vm.accounts, c = vm.confirmation;
    const rows = vm.deadlines.map((d) => {
      const pct = d.days < 0 ? 100 : Math.max(4, Math.min(100, 100 - (d.days / 365) * 100));
      return `<div class="dline ${d.tone}"><span class="t">${esc(d.label)}</span><span class="d num">${esc(d.dueText)}</span><span class="n">${esc(d.note)}</span><span class="r">${esc(d.relText)}</span><div class="bar"><i class="${d.tone === 'ok' ? 'ok' : d.tone === 'warn' ? 'warn' : ''}" style="width:${pct}%;${d.tone === 'bad' ? 'background:var(--bad)' : ''}"></i></div></div>`;
    }).join('');
    const dl = [['Year end', a.refDate], ['Last accounts', [a.lastMadeUp, a.lastType].filter(Boolean).join(' · ')], ['Last period', a.lastPeriod], ['Next period', a.nextPeriod], ['Last confirmation', c.last]].filter((x) => x[1]);
    return `${head('Deadlines')}
      ${rows ? `<div class="dlines">${rows}</div>` : `<div class="empty">${vm.status.active ? 'No filing deadlines on record.' : 'No deadlines: the company is ' + esc(vm.status.label.toLowerCase()) + '.'}</div>`}
      ${dl.length ? `<dl class="dl acc-dl">${dl.map(([k, v]) => `<dt>${esc(k)}</dt><dd class="num">${esc(v)}</dd>`).join('')}</dl>` : ''}`;
  }

  /* People: names open that person's appointments; other appointments link to those companies. */
  function personName(p) { return p.officerId ? `<a href="${esc(URL.person(p.officerId))}">${esc(p.name)}</a>` : esc(p.name); }
  function personRow(p, vm) {
    const ap = p.appointmentsLink && vm.appointments[p.appointmentsLink];
    const other = ap ? ap.items.filter((x) => x.number !== vm.number) : [];
    const idv = p.idv ? `<span class="idv" title="Identity verified ${esc(p.idv.verifiedOn)}">${ICON.check}ID verified</span>` : '';
    const left = `<div style="min-width:0"><div class="nm">${personName(p)}${idv}</div><div class="rl">${esc(p.roleLabel)}${p.resigned ? ' · resigned ' + esc(p.resigned) : p.appointed ? ' · since ' + esc(p.appointed) : ''}${p.tenureYears != null && !p.resigned ? ` (${p.tenureYears}y)` : ''}</div></div>`;
    const c2 = `<div class="cell hide-c">${esc(p.nationality)}<span class="faint">${esc(p.residence ? 'Lives in ' + p.residence : '')}</span></div>`;
    const apHtml = other.length ? `<details class="appts"><summary>${other.length} other appointment${other.length === 1 ? '' : 's'}${ap.total > ap.items.length ? ` (of ${ap.total})` : ''}</summary><ul>${other.slice(0, 8).map((x) => `<li><span>${x.number ? `<a href="${esc(URL.company(x.number))}">${esc(x.company)}</a>` : esc(x.company)} <span class="faint" style="display:inline">${esc(x.role)}</span></span><span class="faint" style="display:inline">${esc(x.resigned ? 'resigned ' + x.resigned : x.status)}</span></li>`).join('')}</ul></details>` : '';
    return `<div class="person"><div class="avatar${p.corporate ? ' corp' : ''}">${esc(initials(p.name))}</div>${left}${c2}${apHtml}</div>`;
  }
  function officers(vm, o = {}) {
    const of = vm.officers, lim = o.limit || 6;
    const roles = Object.entries(of.roleCounts).map(([k, v]) => `<span class="chip"><b>${v}</b>${esc(k.toLowerCase())}${v > 1 ? 's' : ''}</span>`).join('');
    const sum = [roles, of.medianAge ? `<span class="chip">Median age <b>${of.medianAge}</b></span>` : '', of.nationalities[0] ? `<span class="chip">${esc(of.nationalities.slice(0, 2).map((n) => n.name).join(', '))}</span>` : '', of.verifiedCount ? `<span class="chip">ID verified <b>${of.verifiedCount}/${of.active.length}</b></span>` : ''].join('');
    const act = of.active.map((p) => personRow(p, vm));
    const former = of.former.slice(0, 20).map((p) => personRow(p, vm));
    return `${head('People', of.counts.active + ' active', of.counts.resigned ? of.counts.resigned + ' former' : '')}
      ${!of.active.length ? '' : `<div class="people-sum">${sum}</div>`}
      ${act.length ? `<div class="people compact">${act.slice(0, lim).join('')}</div>` : `<div class="empty">No current officers.${of.counts.resigned ? ' ' + of.counts.resigned + ' former officer' + (of.counts.resigned === 1 ? '' : 's') + ' below.' : ''}</div>`}
      ${act.length > lim ? `<details><summary class="more">Show ${act.length - lim} more</summary><div class="people compact">${act.slice(lim).join('')}</div></details>` : ''}
      ${former.length ? `<details${act.length ? '' : ' open'}><summary class="more">Former officers (${of.counts.resigned})</summary><div class="people compact">${former.join('')}</div>${of.counts.resigned > 20 ? '<div class="faint" style="font-size:12px;padding-top:6px">Showing the 20 most recent.</div>' : ''}</details>` : ''}`;
  }

  /* Officer changes: the whole tile opens the full officers list. */
  function changes(vm) {
    const ch = vm.officers.changes;
    return `<a class="tile tile-link s5" href="${esc(URL.officers(vm.number))}">${head('Officer changes', 'last 12 months')}${ch.length ? `<ul class="changes">${ch.slice(0, 8).map((c) => `<li><span class="k ${c.kind}">${c.kind}</span><span><b style="font-weight:600;color:var(--ink-900)">${esc(c.name)}</b> <span class="muted">${esc(c.role.toLowerCase())} · ${esc(c.dateText)}</span></span></li>`).join('')}</ul>` : '<div class="empty">No appointments or resignations in the last 12 months.</div>'}<div class="tile-foot">View all officers</div></a>`;
  }

  /* Ownership: one plain line per PSC. */
  function ownership(vm) {
    const w = vm.ownership;
    const row = (p) => {
      const nm = p.ukCompany ? `<a href="${esc(URL.company(p.ukCompany))}">${esc(p.name)}</a>` : esc(p.name);
      return `<div class="psc"><div class="line"><span class="nm">${nm}${p.idv ? `<span class="idv">${ICON.check}ID verified</span>` : ''}</span>${p.summary.main ? `<span class="bd">${esc(p.summary.main)}</span>` : ''}${p.notified ? `<span class="since">since ${esc(p.notified)}</span>` : ''}</div>${p.summary.other ? `<div class="other">${esc(p.summary.other)}</div>` : ''}${p.sanctioned ? '<div class="other flagtxt bad">On a sanctions list</div>' : ''}</div>`;
    };
    const list = w.current.map(row).join('');
    const notes = w.notes.map((t) => `<div class="own-note">${esc(t)}</div>`).join('');
    return `${head('Ownership', w.current.length ? w.current.length + ' PSC' + (w.current.length === 1 ? '' : 's') : '', w.counts.ceased ? w.counts.ceased + ' ceased' : '')}
      ${list ? `<div class="psc-list">${list}</div>` : ''}
      ${notes ? `<div${list ? ' style="margin-top:10px"' : ''}>${notes}</div>` : ''}
      ${w.ceased.length ? `<details><summary class="more">Former PSCs (${w.ceased.length})</summary><div class="psc-list" style="margin-top:8px">${w.ceased.map((p) => `<div class="psc"><div class="line"><span class="nm">${esc(p.name)}</span><span class="since">${esc(p.notified)} – ${esc(p.ceased)}</span></div></div>`).join('')}</div></details>` : ''}`;
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

  function similar(vm, o = {}) {
    const s = vm.similar, lim = o.limit || 7;
    const town = vm.address.town;
    if (!s.items.length) return `${head('Similar companies')}<div class="empty">No similar active companies found${town ? ' in ' + esc(town) : ''}.</div>`;
    return `${head('Similar nearby', '', esc(s.total.toLocaleString('en-GB')) + ' in ' + esc(town || 'the UK'))}<div class="sim">${s.items.slice(0, lim).map((x) => `<div class="sim-row"><a class="nm" href="${esc(URL.company(x.number))}">${esc(x.name)}</a><span class="m num">${x.ageYears != null ? esc(x.ageYears + 'y') : ''}</span><span class="s">${esc(join([x.town, x.postcode]))}</span><span class="m">${esc(x.number)}</span></div>`).join('')}</div>`;
  }

  function details(vm) {
    const rows = [['Company number', esc(vm.number)], ['Type', esc([vm.type.label, vm.type.subtype].filter(Boolean).join(' · '))], ['Jurisdiction', esc(vm.jurisdiction)], ['Incorporated', esc(vm.createdText)], ['Ceased', esc(vm.ceasedText)],
      ['Previous names', esc(vm.previousNames.map((p) => `${p.name} (${p.from || '?'} – ${p.to || '?'})`).join('; '))], ['Service address', esc(vm.serviceAddress && vm.serviceAddress.oneLine)],
      ['Overseas registration', vm.overseas ? join([vm.overseas.regNumber, vm.overseas.registry, vm.overseas.country]) : ''],
      ['Registers', esc(vm.registers.map((r) => `${r.name}: ${r.where}`).join('; '))], ['UK establishments', vm.ukEstablishments.map((u) => `<a href="${esc(URL.company(u.number))}">${esc(u.name)}</a> (${esc(u.number)})`).join('; ')]].filter((r) => r[1]);
    return `${head('Details')}<dl class="dl">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>`;
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
        ${tile('s5', similar(vm, { limit: 7 }))}
        ${tile('s7', details(vm))}
      </div></div></article>`;
  }

  root.UI = { esc, st, initials, URL, head, header, companyPage, filingRow, personRow };
})(window);
