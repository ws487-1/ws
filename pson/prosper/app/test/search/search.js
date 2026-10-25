/* Prosper search index + ranking. Pure; works on card view models and simple company rows.
   SearchIndex.build({ vms, rows }) -> index; SearchIndex.query(index, q, scope) -> { number, groups: { company, officer, address } } */
(function (root, f) { if (typeof module === 'object' && module.exports) module.exports = f(); else root.SearchIndex = f(); })(this, function () {
  'use strict';
  const norm = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const NUM = /^(?:[A-Z]{2}\d{6}|\d{1,8})$/i;
  const KEEP = /^(THE|AND|FOR|OF|LTD|PLC|LLP|CIC|CO|BIG|NEW|TOP|ONE|TWO|OLD|RED|SUN|ART|CAR|BAR|BAY|HUB|SKY|WAY)$/;
  const tidy = (s) => String(s || '').replace(/\b([A-Z])([A-Z']+)\b/g, (m, a, b) => (m.length <= 3 && !KEEP.test(m)) ? m : a + b.toLowerCase()).replace(/\b(Ltd|Plc|Llp|Uk)\b/g, (m) => ({ Ltd: 'Ltd', Plc: 'PLC', Llp: 'LLP', Uk: 'UK' })[m]);
  const addr1 = (a) => [a.premises, a.address_line_1, a.address_line_2, a.locality, a.postal_code].filter(Boolean).join(', ');
  const akey = (a) => norm([a.premises, a.address_line_1, a.postal_code].filter(Boolean).join(' '));

  function build({ vms, rows }) {
    const co = new Map(), off = new Map(), ad = new Map();
    const addCo = (c) => { const k = String(c.number).toUpperCase(); if (!co.has(k) || c.full) co.set(k, Object.assign(co.get(k) || {}, c)); };
    const addAd = (a, c) => { if (!a) return; const k = akey(a); if (!k) return; const e = ad.get(k) || { kind: 'address', text: addr1(a), postcode: a.postal_code || '', cos: [] }; if (!e.cos.some((x) => x.number === c.number)) e.cos.push({ name: tidy(c.name), number: c.number }); ad.set(k, e); };
    for (const vm of vms) {
      addCo({ kind: 'company', name: tidy(vm.name), number: vm.number, status: vm.status.label, tone: vm.status.tone, sub: [vm.address.town, vm.address.postcode].filter(Boolean).join(' '), created: vm.createdText, full: true });
      const raw = vm._raw && vm._raw.profile && vm._raw.profile.registered_office_address; if (raw) addAd(raw, vm);
      for (const p of vm.officers.active.concat(vm.officers.former)) {
        const k = norm(p.name) + '|' + (p.born || '');
        const e = off.get(k) || { kind: 'officer', name: p.name, born: p.born, roles: [] };
        e.roles.push({ company: tidy(vm.name), number: vm.number, role: p.roleLabel, active: !p.resigned, since: p.appointed });
        off.set(k, e);
      }
      for (const a of Object.values(vm.appointments || {})) for (const it of a.items || []) addCo({ kind: 'company', name: tidy(it.company), number: it.number, status: it.status || '', sub: '' });
      for (const s of vm.similar.items || []) addCo({ kind: 'company', name: tidy(s.name), number: s.number, status: s.status, sub: [s.town, s.postcode].filter(Boolean).join(' '), created: s.created });
    }
    for (const r of rows || []) { const c = { kind: 'company', name: tidy(r.name), number: r.number, status: 'Active', tone: 'ok', sub: [r.address && r.address.locality, r.address && r.address.postal_code].filter(Boolean).join(' '), created: r.created, isNew: true }; addCo(c); addAd(r.address, c); }
    const all = [...co.values()].map((x) => Object.assign(x, { _n: norm(x.name) }));
    const offs = [...off.values()].map((x) => Object.assign(x, { _n: norm(x.name) }));
    const ads = [...ad.values()].map((x) => Object.assign(x, { _n: norm(x.text) }));
    return { co: all, off: offs, ad: ads, byNum: co };
  }

  function score(hay, toks) {
    const words = hay.split(' '); let s = 0;
    for (const t of toks) {
      const i = words.findIndex((w) => w.startsWith(t));
      if (i < 0) { if (hay.includes(t)) s += 1; else return 0; } else s += (words[i] === t ? 4 : 3) - Math.min(i, 3) * 0.3;
    }
    if (hay.startsWith(toks.join(' '))) s += 3;
    return s;
  }
  function query(ix, q, scope) {
    const nq = norm(q), toks = nq.split(' ').filter(Boolean), raw = String(q || '').trim();
    const out = { number: null, groups: { company: [], officer: [], address: [] }, total: 0 };
    if (!toks.length) return out;
    if (NUM.test(raw.replace(/\s/g, ''))) { const n = raw.replace(/\s/g, '').toUpperCase().padStart(8, '0'); out.number = { kind: 'number', number: n, hit: ix.byNum.get(n) || null }; }
    const rank = (list, key) => list.map((x) => { const b = score(x[key], toks); return { x, s: b ? b + (x.full ? 1.5 : 0) : 0 }; }).filter((r) => r.s > 0).sort((a, b) => b.s - a.s || a.x.name.length - b.x.name.length).map((r) => r.x);
    const want = (k) => !scope || scope === 'all' || scope === k;
    if (want('company')) out.groups.company = rank(ix.co, '_n').filter((c) => !out.number || c.number !== out.number.number);
    if (want('officer')) out.groups.officer = rank(ix.off, '_n');
    if (want('address')) out.groups.address = ix.ad.map((x) => { const b = score(x._n, toks); return { x, s: b ? b + x.cos.length * 0.1 : 0 }; }).filter((r) => r.s > 0).sort((a, b) => b.s - a.s).map((r) => r.x);
    out.total = out.groups.company.length + out.groups.officer.length + out.groups.address.length + (out.number ? 1 : 0);
    return out;
  }
  return { build, query, norm, tidy };
});
