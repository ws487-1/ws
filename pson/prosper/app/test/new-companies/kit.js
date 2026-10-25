/* Prosper test prototypes: shared helpers (own copy per folder). Keys live in this browser's localStorage only. */
'use strict';
const Kit = (() => {
  const CH = 'https://api.company-information.service.gov.uk';
  const KEYS = { ch: 'prosper.key.ch', serper: 'prosper.key.serper' }; // same CH key name as the main app, so a key typed there works here
  const get = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const set = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage full or blocked */ } };
  const del = (k) => { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } };
  const key = (kind) => String(get(KEYS[kind], '') || '').trim();
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const date = (iso) => { if (!iso) return ''; const [y, m, d] = String(iso).split('-'); return d ? `${+d} ${MON[+m - 1]} ${y}` : iso; };
  const ageOf = (iso, now) => { if (!iso) return ''; const a = new Date(iso), b = now || new Date(); let y = b.getFullYear() - a.getFullYear(), m = b.getMonth() - a.getMonth(); if (b.getDate() < a.getDate()) m--; if (m < 0) { y--; m += 12; } if (!y && !m) { const d = Math.max(0, Math.round((b - a) / 864e5)); return `${d} day${d === 1 ? '' : 's'}`; } return y ? `${y} yr${y > 1 ? 's' : ''}${m ? ' ' + m + ' mo' : ''}` : `${m} mo`; };
  const addr = (a) => a ? [a.care_of && 'c/o ' + a.care_of, a.po_box && 'PO Box ' + a.po_box, a.premises, a.address_line_1, a.address_line_2, a.locality, a.region, a.postal_code].filter(Boolean).join(', ') : '';
  const pc = (s) => String(s || '').toUpperCase().replace(/\s+/g, '');
  const TYPES = { ltd: 'Private limited', plc: 'Public limited', llp: 'LLP', 'private-limited-guarant-nsc': 'Limited by guarantee', 'private-limited-guarant-nsc-limited-exemption': 'Limited by guarantee (exempt)', 'private-unlimited': 'Unlimited', 'limited-partnership': 'Limited partnership', 'scottish-partnership': 'Scottish partnership', 'registered-overseas-entity': 'Overseas entity', 'charitable-incorporated-organisation': 'CIO', 'scottish-charitable-incorporated-organisation': 'Scottish CIO', 'uk-establishment': 'UK establishment', 'oversea-company': 'Overseas company' };
  const typeName = (t, sub) => (sub === 'community-interest-company' ? 'CIC' : TYPES[t] || String(t || '').replace(/-/g, ' '));
  const STATUS = { active: 'ok', dissolved: 'grey', liquidation: 'bad', administration: 'bad', receivership: 'bad', 'voluntary-arrangement': 'warn', 'insolvency-proceedings': 'bad', 'converted-closed': 'grey', open: 'ok', closed: 'grey', removed: 'grey', registered: 'ok' };
  const statusPill = (s) => `<span class="pill ${STATUS[s] || ''}">${esc(String(s || 'unknown').replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase()))}</span>`;

  /* Companies House: Authorization header from the page; the key's JavaScript domains must include this site. Gentle pacing. */
  let last = 0;
  async function ch(path) {
    const k = key('ch');
    if (!k) { const e = new Error('Add your Companies House API key in Settings, or use the demo.'); e.code = 'nokey'; throw e; }
    const wait = Math.max(0, last + 350 - Date.now()); if (wait) await new Promise((r) => setTimeout(r, wait)); last = Date.now();
    let r;
    try { r = await fetch(CH + path, { headers: { Authorization: 'Basic ' + btoa(k + ':'), Accept: 'application/json' }, credentials: 'omit', referrerPolicy: 'no-referrer' }); }
    catch (e) { const er = new Error('Companies House did not answer. Check the key allows this site as a JavaScript domain.'); er.code = 'net'; throw er; }
    if (r.status === 404) return null;
    if (r.status === 401) { const e = new Error('Companies House rejected the key (401).'); e.code = 401; throw e; }
    if (r.status === 429) { const e = new Error('Rate limit reached. Wait five minutes and try again.'); e.code = 429; throw e; }
    if (!r.ok) { const e = new Error('Companies House error ' + r.status); e.code = r.status; throw e; }
    return r.json();
  }

  function fonts() {
    if (typeof FontFace !== 'function' || !document.fonts || typeof interFonts !== 'function') return;
    const bytes = (b) => { const s = atob(b), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u.buffer; };
    try { const d = interFonts(); for (const w of Object.keys(d)) { const f = new FontFace('Prosper Inter', bytes(d[w]), { weight: w }); document.fonts.add(f); f.load(); } } catch (e) { /* system font */ }
    try { const f = new FontFace('Prosper Display', bytes(dmDisplayFont()), { weight: '700' }); document.fonts.add(f); f.load(); } catch (e) { /* fallback */ }
  }

  const PAGES = [['new-companies', 'New companies'], ['tools', 'Free tools'], ['contacts', 'Contact details']];
  function header(cur, opts) {
    opts = opts || {}; const base = opts.base || '../';
    const h = document.createElement('header'); h.className = 'top';
    h.innerHTML = `<a class="logo" href="${base}../">Prosper</a><span class="tag">Prototype</span>
      <nav class="nav">${PAGES.map(([p, l]) => `<a href="${base}${p}/" class="${p === cur ? 'on' : ''}">${l}</a>`).join('')}</nav><span class="sp"></span>
      <button class="btn sm" id="kit-settings" type="button">Settings</button>`;
    document.body.prepend(h);
    $('#kit-settings').onclick = () => settings(opts.serper);
  }
  function settings(withSerper) {
    let d = $('#kit-dlg');
    if (d) d.remove();
    d = document.createElement('dialog'); d.id = 'kit-dlg';
    const has = (k) => key(k) ? 'Saved in this browser' : 'Not set';
    d.innerHTML = `<div class="dlg-h"><h2>Settings</h2></div><div class="dlg-b">
      <label class="f">Companies House API key <input id="k-ch" type="password" autocomplete="off" spellcheck="false" placeholder="${has('ch')}"></label>
      <p class="small muted">Free from the Companies House developer hub. Create a REST key and add <b>wills.im</b> as a JavaScript domain. Shared with the main Prosper app on this site.</p>
      ${withSerper ? `<label class="f">Serper API key (optional) <input id="k-serper" type="password" autocomplete="off" spellcheck="false" placeholder="${has('serper')}"></label>
      <p class="small muted">Only used for the search fallback. <b>Each search costs Serper credits.</b></p>` : ''}
      <p class="small muted">Keys are stored only in this browser (localStorage) and are sent only to the service they belong to.</p></div>
      <div class="dlg-f"><button class="btn ghost" id="k-clear" type="button">Clear keys</button><span class="sp"></span><button class="btn" id="k-close" type="button">Cancel</button><button class="btn pri" id="k-save" type="button">Save</button></div>`;
    document.body.append(d);
    $('#k-close', d).onclick = () => d.close();
    $('#k-clear', d).onclick = () => { del(KEYS.ch); del(KEYS.serper); d.close(); toast('Keys cleared'); document.dispatchEvent(new Event('kit-keys')); };
    $('#k-save', d).onclick = () => { const a = $('#k-ch', d).value.trim(); if (a) set(KEYS.ch, a); const s = $('#k-serper', d); if (s && s.value.trim()) set(KEYS.serper, s.value.trim()); d.close(); toast('Saved'); document.dispatchEvent(new Event('kit-keys')); };
    d.showModal();
  }
  function toast(msg) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.append(t); setTimeout(() => t.remove(), 2200); }
  function csv(name, head, rows) {
    const q = (v) => { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const body = [head, ...rows].map((r) => r.map(q).join(',')).join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + body], { type: 'text/csv' })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function footer(extra) { const f = document.createElement('footer'); f.className = 'foot'; f.innerHTML = `<span>Prosper prototype. Data: Companies House public register (Open Government Licence v3.0).</span>${extra || ''}`; document.body.append(f); }
  fonts();
  return { ch, key, get, set, del, esc, $, $$, date, ageOf, addr, pc, typeName, TYPES, statusPill, header, footer, settings, toast, csv };
})();
