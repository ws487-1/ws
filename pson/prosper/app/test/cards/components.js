/* Prosper cards prototype: purpose-built card components.
   Each component takes a normalised view model (normalise.js) and returns an HTML string.
   Components never read raw API JSON and never guard against missing fields: the normaliser does that. */
(function (root) {
  'use strict';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const initials = (n) => String(n || '?').replace(/^(Mr|Mrs|Ms|Miss|Dr|Sir|Dame|Lord|Lady)\.?\s+/i, '').split(/\s+/).filter(Boolean).map((w) => w[0]).filter((c) => /[A-Za-z0-9]/.test(c)).slice(0, 2).join('').toUpperCase() || '?';
  const pill = (text, tone, plain) => `<span class="pill ${tone || ''}${plain ? ' plain' : ''}">${esc(text)}</span>`;
  const join = (xs, sep) => xs.filter(Boolean).map(esc).join(sep || ' · ');
  const ICON = {
    pin: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    ext: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></svg>',
  };
  const head = (title, count, aside, tag) => `<div class="${tag === 'tile' ? 'tile-head' : 'section-head'}"><${tag === 'tile' ? 'h3' : 'h2'}>${esc(title)}${count != null && count !== '' ? `<span class="count">${esc(count)}</span>` : ''}</${tag === 'tile' ? 'h3' : 'h2'}>${aside ? `<span class="aside">${aside}</span>` : ''}</div>`;

  /* Status header */
  function header(vm, o = {}) {
    const meta = [vm.type.label, vm.type.subtype, vm.number && `No. ${vm.number}`, vm.createdText && `Incorporated ${vm.createdText}`, vm.ceasedText && `Ceased ${vm.ceasedText}`].filter(Boolean);
    const q = encodeURIComponent(vm.name);
    return `<header class="hdr${o.compact ? ' compact' : ''}">
      <div class="hdr-top"><div style="min-width:0">
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:8px">${pill(vm.status.label, vm.status.tone)}${vm.status.detail ? pill(vm.status.detail, 'neutral', true) : ''}${vm.jurisdiction ? `<span class="faint" style="font-size:12px">${esc(vm.jurisdiction)}</span>` : ''}</div>
        <h1>${esc(vm.name)}</h1>
        <div class="hdr-meta">${meta.map((m) => `<span>${esc(m)}</span>`).join('<span class="sep"></span>')}</div>
        ${vm.address.oneLine ? `<div class="hdr-addr">${ICON.pin}<span>${esc(vm.address.oneLine)}</span></div>` : ''}
        ${vm.sic.length ? `<div class="hdr-sic">${vm.sic.map((s) => `<span class="chip"><b class="mono">${esc(s.code)}</b>${esc(s.desc)}</span>`).join('')}</div>` : ''}
      </div>
      <div class="hdr-actions">
        ${vm.url ? `<a class="btn sm" href="${esc(vm.url)}" target="_blank" rel="noopener">Companies House ${ICON.ext}</a>` : ''}
        <a class="btn sm" href="https://www.google.com/search?q=${q}" target="_blank" rel="noopener">Google ${ICON.ext}</a>
        ${vm.address.postcode ? `<a class="btn sm" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(vm.name + ' ' + vm.address.postcode)}" target="_blank" rel="noopener">Map ${ICON.ext}</a>` : ''}
      </div></div>
      ${vm.verdict.length ? `<div class="verdict ${vm.verdict.some((v) => v.tone === 'bad') ? 'bad' : vm.verdict.some((v) => v.tone === 'warn') ? 'warn' : 'neutral'}"><b>Heads up</b><span>${vm.verdict.map((v) => esc(v.text)).join(' · ')}</span></div>` : ''}
      ${vm.flags.length ? `<div class="flags">${vm.flags.map((f) => pill(f.label, f.tone)).join('')}</div>` : ''}
    </header>`;
  }

  /* Key-fact tiles */
  function facts(vm, o = {}) {
    const list = o.keys ? vm.keyFacts.filter((f) => o.keys.includes(f.key)) : vm.keyFacts;
    return `<div class="facts${o.strip ? ' strip' : ''}">${list.map((f) => `<div class="fact ${f.tone || ''}"><div class="eyebrow">${esc(f.label)}</div><div class="v num" title="${esc(f.value)}">${esc(f.value)}</div><div class="s" title="${esc(f.sub)}">${esc(f.sub) || '&nbsp;'}</div></div>`).join('')}</div>`;
  }
  const factTile = (f) => `<div class="fact ${f.tone || ''}"><div class="eyebrow">${esc(f.label)}</div><div class="v num">${esc(f.value)}</div><div class="s">${esc(f.sub) || '&nbsp;'}</div></div>`;

  /* Deadlines + accounts detail */
  function deadlines(vm, o = {}) {
    const a = vm.accounts, c = vm.confirmation;
    const rows = vm.deadlines.map((d) => {
      const pct = d.days < 0 ? 100 : Math.max(4, Math.min(100, 100 - (d.days / 365) * 100));
      return `<div class="dline ${d.tone}"><span class="t">${esc(d.label)}</span><span class="d num">${esc(d.dueText)}</span><span class="n">${esc(d.note)}</span><span class="r">${esc(d.relText)}</span><div class="bar"><i class="${d.tone === 'ok' ? 'ok' : d.tone === 'warn' ? 'warn' : ''}" style="width:${pct}%;${d.tone === 'bad' ? 'background:var(--bad)' : ''}"></i></div></div>`;
    }).join('');
    const dl = [['Year end', a.refDate], ['Last accounts', [a.lastMadeUp, a.lastType].filter(Boolean).join(' · ')], ['Last period', a.lastPeriod], ['Next period', a.nextPeriod], ['Last confirmation', c.last]].filter((x) => x[1]);
    return `${o.title === false ? '' : head('Deadlines', '', '', o.tag)}
      ${rows ? `<div class="dlines">${rows}</div>` : `<div class="empty">${vm.status.active ? 'No filing deadlines on record.' : 'No deadlines: the company is ' + esc(vm.status.label.toLowerCase()) + '.'}</div>`}
      ${dl.length && o.details !== false ? `<dl class="dl acc-dl">${dl.map(([k, v]) => `<dt>${esc(k)}</dt><dd class="num">${esc(v)}</dd>`).join('')}</dl>` : ''}`;
  }

  /* People */
  function personRow(p, vm, o) {
    const ap = p.appointmentsLink && vm.appointments[p.appointmentsLink];
    const other = ap ? ap.items.filter((x) => x.number !== vm.number) : [];
    const idv = p.idv ? `<span class="idv" title="Identity verified ${esc(p.idv.verifiedOn)}">${ICON.check}ID verified</span>` : '';
    const left = `<div style="min-width:0"><div class="nm">${esc(p.name)}${idv}</div><div class="rl">${esc(p.roleLabel)}${p.resigned ? ' · resigned ' + esc(p.resigned) : p.appointed ? ' · since ' + esc(p.appointed) : ''}${p.tenureYears != null && !p.resigned ? ` (${p.tenureYears}y)` : ''}</div></div>`;
    const c1 = p.corporate ? `<div class="cell">${p.registration && p.registration.number ? 'Reg. ' + esc(p.registration.number) : ''}<span class="faint">${esc(p.registration && p.registration.legalForm)}</span></div>`
      : `<div class="cell">${esc(p.born ? 'Born ' + p.born : '')}${p.age != null ? ` <span class="faint" style="display:inline">(${p.age})</span>` : ''}<span class="faint">${esc(p.occupation)}</span></div>`;
    const c2 = `<div class="cell${o.compact ? ' hide-c' : ''}">${esc(p.nationality)}<span class="faint">${esc(p.residence ? 'Lives in ' + p.residence : '')}</span></div>`;
    const apHtml = other.length ? `<details class="appts"><summary>${other.length} other appointment${other.length === 1 ? '' : 's'}${ap.total > ap.items.length ? ` (of ${ap.total})` : ''}</summary><ul>${other.slice(0, 8).map((x) => `<li><span>${esc(x.company)} <span class="faint" style="display:inline">${esc(x.role)}</span></span><span class="faint" style="display:inline">${esc(x.resigned ? 'resigned ' + x.resigned : x.status)}</span></li>`).join('')}</ul></details>` : '';
    return `<div class="person"><div class="avatar${p.corporate ? ' corp' : ''}">${esc(initials(p.name))}</div>${left}${o.compact ? '' : c1}${c2}${apHtml}</div>`;
  }
  function officers(vm, o = {}) {
    const of = vm.officers, lim = o.limit || 8;
    const roles = Object.entries(of.roleCounts).map(([k, v]) => `<span class="chip"><b>${v}</b>${esc(k.toLowerCase())}${v > 1 ? 's' : ''}</span>`).join('');
    const sum = [roles, of.medianAge ? `<span class="chip">Median age <b>${of.medianAge}</b></span>` : '', of.nationalities[0] ? `<span class="chip">${esc(of.nationalities.slice(0, 2).map((n) => n.name).join(', '))}</span>` : '', of.verifiedCount ? `<span class="chip">ID verified <b>${of.verifiedCount}/${of.active.length}</b></span>` : ''].join('');
    const act = of.active.map((p) => personRow(p, vm, o));
    const former = of.former.slice(0, 20).map((p) => personRow(p, vm, o));
    return `${head(o.title || 'People', of.counts.active + ' active', of.counts.resigned ? of.counts.resigned + ' former' : '', o.tag)}
      ${o.summary === false || !of.active.length ? '' : `<div class="people-sum">${sum}</div>`}
      ${act.length ? `<div class="people${o.compact ? ' compact' : ''}">${act.slice(0, lim).join('')}</div>` : `<div class="empty">No current officers.${of.counts.resigned ? ' ' + of.counts.resigned + ' former officer' + (of.counts.resigned === 1 ? '' : 's') + ' below.' : ''}</div>`}
      ${act.length > lim ? `<details><summary class="more">Show ${act.length - lim} more</summary><div class="people${o.compact ? ' compact' : ''}">${act.slice(lim).join('')}</div></details>` : ''}
      ${former.length ? `<details${act.length ? '' : ' open'}><summary class="more">Former officers (${of.counts.resigned})</summary><div class="people${o.compact ? ' compact' : ''}">${former.join('')}</div>${of.counts.resigned > 20 ? '<div class="faint" style="font-size:12px;padding-top:6px">Showing the 20 most recent.</div>' : ''}</details>` : ''}`;
  }
  function changes(vm, o = {}) {
    const ch = vm.officers.changes;
    return `${head('Officer changes', 'last 12 months', '', o.tag)}${ch.length ? `<ul class="changes">${ch.slice(0, 8).map((c) => `<li><span class="k ${c.kind}">${c.kind}</span><span><b style="font-weight:600;color:var(--ink-900)">${esc(c.name)}</b> <span class="muted">${esc(c.role.toLowerCase())} · ${esc(c.dateText)}</span></span></li>`).join('')}</ul>` : '<div class="empty">No appointments or resignations in the last 12 months.</div>'}`;
  }

  /* Ownership */
  function ownership(vm, o = {}) {
    const w = vm.ownership;
    const cards = w.current.map((p) => {
      const pct = p.shares ? +p.shares.split('–')[1] : 0;
      const sub = p.corporate ? join([p.registration.legalForm, p.registration.register || p.registration.country, p.registration.number && 'No. ' + p.registration.number])
        : join([p.born && 'Born ' + p.born, p.nationality, p.residence && 'lives in ' + p.residence]);
      return `<div class="owner"><div class="avatar lg${p.corporate ? ' corp' : ''}">${esc(initials(p.name))}</div>
        <div style="min-width:0"><div class="nm">${esc(p.name)}${p.idv ? `<span class="idv">${ICON.check}ID verified</span>` : ''}</div><div class="sub">${esc(p.kindLabel)}${p.beneficialOwner ? ' · beneficial owner' : ''}${sub ? ' · ' + sub : ''}${p.notified ? ' · since ' + esc(p.notified) : ''}</div>
        <div class="ctl">${p.controls.map((c) => `<span class="chip">${esc(c)}</span>`).join('')}${p.sanctioned ? pill('Sanctioned', 'bad') : ''}</div></div>
        <div class="band">${p.band ? `<div class="v num">${esc(p.band)}</div>` : ''}${pct ? `<div class="bar"><i style="width:${pct}%"></i></div>` : ''}</div></div>`;
    }).join('');
    const notes = [...w.exemptions.map((e) => `<div class="empty">${esc(e.text)}${e.from ? ` <span class="faint">(${e.current ? 'since ' + esc(e.from) : esc(e.from) + ' – ' + esc(e.to)})</span>` : ''}</div>`), ...w.statements.map((s) => `<div class="empty">${esc(s.text)}${s.notified ? ` <span class="faint">(${esc(s.notified)})</span>` : ''}</div>`)];
    return `${head(o.title || 'Ownership', w.current.length ? w.current.length + ' PSC' + (w.current.length === 1 ? '' : 's') : '', w.counts.ceased ? w.counts.ceased + ' ceased' : '', o.tag)}
      ${cards ? `<div class="owners">${cards}</div>` : `<div class="empty">${esc(w.explanation)}</div>`}
      ${notes.length && (cards || notes.length > 1) ? `<div class="notes">${notes.join('')}</div>` : ''}
      ${w.ceased.length ? `<details><summary class="more">Former PSCs (${w.ceased.length})</summary><div class="owners" style="margin-top:8px">${w.ceased.map((p) => `<div class="owner"><div class="avatar lg">${esc(initials(p.name))}</div><div><div class="nm">${esc(p.name)}</div><div class="sub">${esc(p.notified)} – ${esc(p.ceased)}</div></div><div></div></div>`).join('')}</div></details>` : ''}`;
  }

  /* Charges */
  function charges(vm, o = {}) {
    const c = vm.charges, lim = o.limit || 6;
    if (!c.available || !c.total) return `${head('Charges', '', '', o.tag)}<div class="empty">No charges registered against this company.</div>`;
    const out = c.outstanding, sat = c.satisfied;
    const row = (x) => `<div class="charge${x.outstanding ? '' : ' muted-row'}"><div class="charge-top"><div style="min-width:0"><div class="who">${esc(x.entitled.join(', ') || x.title)}${x.moreEntitled ? ' and others' : ''}</div>
      <div class="meta">${esc(x.title)} · created ${esc(x.created)}${x.code ? ` · <span class="mono">${esc(x.code)}</span>` : ''}${x.satisfied ? ' · satisfied ' + esc(x.satisfied) : ''}</div></div>${pill(x.statusLabel, x.tone)}</div>
      ${x.features.length ? `<div class="feat">${x.features.map((f) => `<span class="chip">${esc(f)}</span>`).join('')}</div>` : ''}
      ${x.description || x.secured ? `<div class="desc">${esc((x.description || x.secured).slice(0, 220))}${(x.description || x.secured).length > 220 ? '…' : ''}</div>` : ''}</div>`;
    return `${head('Charges', out + ' outstanding', c.total + ' total', o.tag)}
      <div class="chg-sum"><div class="bar"><i class="warn" style="width:${(out / c.total) * 100}%"></i><i class="neutral" style="width:${(sat / c.total) * 100}%"></i></div><div class="legend"><span><i style="background:#d49a4b"></i>${out} outstanding</span><span><i style="background:var(--ink-300)"></i>${sat} satisfied</span></div></div>
      ${c.lenders.length ? `<div class="people-sum">${c.lenders.slice(0, 4).map((l) => `<span class="chip">${esc(l.name)} <b>${l.n}</b></span>`).join('')}</div>` : ''}
      <div class="charges">${c.items.slice(0, lim).map(row).join('')}</div>
      ${c.items.length > lim ? `<details><summary class="more">Show ${c.items.length - lim} more</summary><div class="charges" style="margin-top:8px">${c.items.slice(lim).map(row).join('')}</div></details>` : ''}`;
  }

  /* Insolvency (only rendered when there is a case) */
  function insolvency(vm, o = {}) {
    const i = vm.insolvency; if (!i.cases.length) return '';
    return `${head('Insolvency', i.cases.length + ' case' + (i.cases.length === 1 ? '' : 's'), '', o.tag)}${i.cases.map((c) => `<div class="ins"><h4>${esc(c.type)}${c.number ? ` <span class="faint" style="font-weight:500;font-size:13px">case ${esc(c.number)}</span>` : ''}</h4>
      <div class="dates">${c.dates.map((d) => `<span class="chip">${esc(d.label)} <b>${esc(d.date)}</b></span>`).join('')}</div>
      ${c.practitioners.map((p) => `<div class="ip"><b style="color:var(--ink-900)">${esc(p.name)}</b> <span class="muted">${esc(p.role)}${p.appointed ? ' · appointed ' + esc(p.appointed) : ''}${p.ceased ? ' · ceased ' + esc(p.ceased) : ''}</span><div class="faint" style="font-size:12px">${esc(p.address)}</div></div>`).join('')}
      ${c.notes.map((n) => `<div class="faint" style="font-size:12px;margin-top:6px">${esc(n)}</div>`).join('')}</div>`).join('')}`;
  }

  /* Filings timeline */
  function filings(vm, o = {}) {
    const f = vm.filings, lim = o.limit || 12;
    if (!f.items.length) return `${head('Filing history', '', '', o.tag)}<div class="empty">No filings on record.</div>`;
    const cats = {}; for (const it of f.items) cats[it.category] = (cats[it.category] || 0) + 1;
    let n = 0; const years = [];
    for (const y of f.years) { if (n >= lim) break; const items = y.items.slice(0, lim - n); n += items.length; years.push({ year: y.year, items }); }
    const item = (it) => `<div class="tl-item cat-${esc(it.category)}"><div class="ti"><span class="cat">${esc(it.categoryLabel)}</span><br>${it.strong && it.title.startsWith(it.strong) ? `<b>${esc(it.strong)}</b>${esc(it.title.slice(it.strong.length))}` : esc(it.title)}</div>
      <div class="dt num">${esc(it.date)}<br>${it.viewUrl ? `<a href="${esc(it.viewUrl)}" target="_blank" rel="noopener">View${it.pages ? ' · ' + it.pages + 'p' : ''}</a>` : ''}</div>${it.resolutions.length ? `<div class="res">${esc(it.resolutions.slice(0, 2).join(' · '))}</div>` : ''}</div>`;
    return `${head('Filing history', f.total, f.total > f.loaded ? 'latest ' + f.loaded : '', o.tag)}
      ${o.filters === false ? '' : `<div class="tl-filters" style="margin-bottom:14px">${Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<span class="chip cat-${esc(k)}"><i></i>${esc((f.items.find((x) => x.category === k) || {}).categoryLabel)} <b>${v}</b></span>`).join('')}</div>`}
      <div class="tl">${years.map((y) => `<div class="tl-year"><div class="tl-y">${esc(y.year)}</div><div class="tl-items">${y.items.map(item).join('')}</div></div>`).join('')}</div>
      ${f.loaded > lim ? `<div class="more">Load more filings</div>` : ''}`;
  }

  /* Similar companies */
  function similar(vm, o = {}) {
    const s = vm.similar, lim = o.limit || 6;
    const town = vm.address.town;
    if (!s.items.length) return `${head('Similar companies', '', '', o.tag)}<div class="empty">No similar active companies found${town ? ' in ' + esc(town) : ''}.</div>`;
    return `${head('Similar nearby', '', esc(s.total.toLocaleString('en-GB')) + ' in ' + esc(town || 'the UK'), o.tag)}<div class="sim">${s.items.slice(0, lim).map((x) => `<div class="sim-row"><span class="nm">${esc(x.name)}</span><span class="m num">${x.ageYears != null ? esc(x.ageYears + 'y') : ''}</span><span class="s">${esc(join([x.town, x.postcode]))}</span><span class="m">${esc(x.number)}</span></div>`).join('')}</div>`;
  }

  /* AI summary slot (placeholder; live app fills it with a Haiku summary) */
  function ai(vm, o = {}) {
    return `<div class="ai"><div class="ai-head"><h3><span class="ai-spark"></span>AI summary</h3><span class="faint" style="font-size:12px">Haiku</span></div>
      <div class="ai-lines"><i></i><i></i><i></i><i></i></div><div class="ai-note">Placeholder slot. In the app this streams a short summary of the facts on this card.</div></div>`;
  }

  /* Details: everything else the API gives that doesn't need its own component */
  function details(vm, o = {}) {
    const rows = [['Company number', vm.number], ['Type', [vm.type.label, vm.type.subtype].filter(Boolean).join(' · ')], ['Jurisdiction', vm.jurisdiction], ['Incorporated', vm.createdText], ['Ceased', vm.ceasedText],
      ['Previous names', vm.previousNames.map((p) => `${p.name} (${p.from || '?'} – ${p.to || '?'})`).join('; ')], ['Service address', vm.serviceAddress && vm.serviceAddress.oneLine],
      ['Overseas registration', vm.overseas && join([vm.overseas.regNumber, vm.overseas.registry, vm.overseas.country])],
      ['Registers', vm.registers.map((r) => `${r.name}: ${r.where}`).join('; ')], ['UK establishments', vm.ukEstablishments.map((u) => `${u.name} (${u.number})`).join('; ')]].filter((r) => r[1]);
    return `${head('Details', '', '', o.tag)}<dl class="dl">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`;
  }

  /* Dense table variants (layout C) */
  function officersTable(vm) {
    const of = vm.officers;
    const occ = of.active.concat(of.former).some((p) => p.occupation);
    const tr = (p) => `<tr><td><b>${esc(p.name)}</b>${p.idv ? `<span class="idv">${ICON.check}</span>` : ''}</td><td>${esc(p.roleLabel)}</td><td class="num">${esc(p.appointed)}${p.resigned ? ' – ' + esc(p.resigned) : ''}</td><td class="num">${esc(p.born)}</td><td>${esc(p.nationality)}</td><td>${esc(p.residence)}</td>${occ ? `<td>${esc(p.occupation)}</td>` : ''}</tr>`;
    return `${head('People', of.counts.active + ' active', of.counts.resigned ? of.counts.resigned + ' former' : '')}
      ${of.active.length ? `<table class="table"><thead><tr><th>Name</th><th>Role</th><th>Appointed</th><th>Born</th><th>Nationality</th><th>Lives in</th>${occ ? '<th>Occupation</th>' : ''}</tr></thead><tbody>${of.active.map(tr).join('')}</tbody></table>` : '<div class="empty">No current officers.</div>'}
      ${of.former.length ? `<details${of.active.length ? '' : ' open'}><summary class="more">Former officers (${of.counts.resigned})</summary><table class="table" style="margin-top:8px"><tbody>${of.former.slice(0, 20).map(tr).join('')}</tbody></table></details>` : ''}`;
  }

  const C = { esc, pill, header, facts, factTile, deadlines, officers, changes, ownership, charges, insolvency, filings, similar, ai, details, officersTable };
  if (typeof module !== 'undefined' && module.exports) module.exports = C; else root.Cards = C;
})(typeof window !== 'undefined' ? window : globalThis);
