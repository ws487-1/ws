(() => {
  const { esc, $, date } = Kit;
  Kit.header('contacts', { serper: true });
  const PILL = { Confirmed: 'ok', Likely: 'warn', Unverified: 'grey' };
  const LABEL = { Confirmed: 'Confirmed', Likely: 'Likely', Unverified: 'Not verified' };
  let data = [], filter = 'all';
  const path = (u) => { try { const x = new URL(u); return x.host.replace(/^www\./, '') + (x.pathname === '/' ? '' : x.pathname.replace(/\/$/, '')); } catch (e) { return u; } };
  const src = (u) => `<a class="s" href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(path(u))}</a>`;
  const addr = (o) => [o.premises, o.line1, o.line2, o.town, o.postcode].filter(Boolean).join(', ');
  function card(r) {
    const c = r.company, w = r.website, conf = w ? w.confidence : null;
    const left = `<div class="ch"><div class="k">Companies House</div><div class="nm">${esc(c.name)}</div>
      <div class="sub">${esc(c.number)} · ${esc(Kit.typeName(c.type))} · incorporated ${date(c.incorporated)}</div>
      <div class="ro"><div class="k">Registered office</div>${esc(addr(c.office))}</div>
      <div style="margin-top:8px"><a class="src" href="${esc(c.source)}" target="_blank" rel="noopener noreferrer">View on Companies House</a></div></div>`;
    if (!w) return `<article class="co grey">${left}<div class="web"><div class="wh"><span class="pill grey">No website found</span></div>
      <div class="none">${esc(r.note || 'No site at the obvious domain names showed this company’s name or details. A web search (stage 3) would be the next step.')}</div>
      <div class="foot2">Stages run: ${r.stagesRun.join(', ')} · checked ${date(r.checkedAt.slice(0, 10))}</div></div></article>`;
    const row = (k, arr, f) => arr.length ? `<div class="k">${k}</div><div class="v">${arr.map((x) => `<div>${f(x)} ${src(x.source)}</div>`).join('')}</div>` : '';
    const items = row('Phone', w.phones, (x) => esc(x.value)) + row('Email', w.emails, (x) => esc(x.value)) + row('Address', w.addresses, (x) => esc(x.value) + (x.postcode === c.office.postcode ? ' <span class="pill ok">matches registered office</span>' : ''));
    return `<article class="co${conf === 'Unverified' ? ' grey' : ''}">${left}<div class="web">
      <div class="wh"><span class="pill ${PILL[conf]}">${LABEL[conf]}</span><a href="${esc(w.website)}" target="_blank" rel="noopener noreferrer">${esc(path(w.website))}</a><span class="sub" style="font-size:12px;color:var(--mute)">found by ${esc(w.foundBy)}</span></div>
      <div class="proof">${w.proofs.length ? 'Proof: ' + w.proofs.map(esc).join(' · ') : 'Only the trading name appears on the site; nothing ties it to this company number.'}</div>
      ${items ? `<div class="items">${items}</div>` : '<div class="none">The site publishes no phone, role email or address we could read.</div>'}
      <div class="foot2">Read ${w.pagesRead.length} page${w.pagesRead.length > 1 ? 's' : ''}${w.personalSkipped ? ` · ${w.personalSkipped} named-person email${w.personalSkipped > 1 ? 's' : ''} skipped` : ''} · stages run: ${r.stagesRun.join(', ')} · checked ${date(r.checkedAt.slice(0, 10))}</div>
    </div></article>`;
  }
  function render() {
    const n = data.length, site = data.filter((r) => r.website), conf = site.filter((r) => r.website.confidence === 'Confirmed').length, lik = site.filter((r) => r.website.confidence === 'Likely').length;
    const withAny = site.filter((r) => r.website.confidence !== 'Unverified' && (r.website.phones.length || r.website.emails.length)).length;
    $('#kpis').innerHTML = [[n, 'Companies tested'], [site.length, 'Website found'], [conf, 'Confirmed'], [lik, 'Likely'], [withAny, 'Usable phone or email']].map(([v, l]) => `<div><div class="v">${v}</div><div class="l">${l}</div></div>`).join('');
    const F = { all: ['All', () => true], Confirmed: ['Confirmed', (r) => r.website && r.website.confidence === 'Confirmed'], Likely: ['Likely', (r) => r.website && r.website.confidence === 'Likely'], rest: ['Not verified or none', (r) => !r.website || r.website.confidence === 'Unverified'] };
    $('#seg').innerHTML = Object.entries(F).map(([k, [l, f]]) => `<button type="button" data-k="${k}" class="${k === filter ? 'on' : ''}">${l} (${data.filter(f).length})</button>`).join('');
    $('#seg').onclick = (e) => { const b = e.target.closest('button'); if (b) { filter = b.dataset.k; render(); } };
    const order = { Confirmed: 0, Likely: 1, Unverified: 2 };
    $('#list').innerHTML = data.filter(F[filter][1]).sort((a, b) => (a.website ? order[a.website.confidence] : 3) - (b.website ? order[b.website.confidence] : 3)).map(card).join('');
  }
  fetch('fixture.json').then((r) => r.json()).then((j) => { data = j.results; $('#saved').textContent = `Saved test run, ${date(j.ranOn)}. Real companies, business details only.`; render(); });
  Kit.footer('<span> Contact details as published on each company’s own website.</span>');
})();
