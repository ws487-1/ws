// ==UserScript==
// @name         Prosper
// @namespace    https://wills.im/pson/prosper
// @version      11.0.0
// @description  Highlight a company, email, website, Companies House number or person to get an instant Companies House card, quick check, quick links and an optional AI brief. Built for HubSpot prospecting.
// @author       Will
// @match        *://*/*
// @noframes
// @run-at       document-idle
// @icon         data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%230a7a52'/%3E%3Ctext x='32' y='45' font-family='Arial,Helvetica,sans-serif' font-size='38' font-weight='700' fill='%23fff' text-anchor='middle'%3EP%3C/text%3E%3C/svg%3E
// @downloadURL  https://wills.im/pson/prosper/prosper.user.js
// @updateURL    https://wills.im/pson/prosper/prosper.user.js
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_openInTab
// @grant        GM_setClipboard
// @grant        GM_registerMenuCommand
// @grant        GM_addValueChangeListener
// @connect      api.company-information.service.gov.uk
// @connect      api.anthropic.com
// @connect      raw.githubusercontent.com
// ==/UserScript==

(function () {
  'use strict';

  if (window.top !== window.self) return;
  if (window.__prosperV11) return;
  window.__prosperV11 = true;

  /* ------------------------------------------------------------------ */
  /* Constants                                                          */
  /* ------------------------------------------------------------------ */

  const VERSION = '11.0.0';
  const CH_API = 'https://api.company-information.service.gov.uk';
  const CH_WEB = 'https://find-and-update.company-information.service.gov.uk';
  const ENUMS_URL = 'https://raw.githubusercontent.com/companieshouse/api-enumerations/master/constants.yml';
  const CLAUDE_URL = 'https://api.anthropic.com/v1/messages';
  const TTL_CH = 10 * 60 * 1000;
  const TTL_BRIEF = 24 * 60 * 60 * 1000;
  const TTL_ENUMS = 30 * 24 * 60 * 60 * 1000;
  const K = {
    settings: 'prosper.settings',
    chKey: 'prosper.key.ch',
    claudeKey: 'prosper.key.claude',
    enums: 'prosper.enums',
  };
  const MODELS = {
    'claude-haiku-5-5': { label: 'Claude Haiku 5.5 (fast, cheap)', inM: 0.10, outM: 0.50 },
    'claude-sonnet-5-5': { label: 'Claude Sonnet 5.5 (deeper)', inM: 3.00, outM: 15.00, est: true },
  };
  const SEARCH_COST = 10 / 1000;
  const DEFAULTS = { model: 'claude-haiku-5-5', background: true, inInputs: false, scope: 'all' };

  const FREEMAIL = /^(gmail|googlemail|hotmail|outlook|live|yahoo|icloud|me|aol|proton|protonmail|btinternet|sky|talktalk|virginmedia|msn|ymail)\./i;
  const SLD = /^(co|org|gov|ac|ltd|plc|me|net|sch)$/i;
  const COMPANY_WORDS = /\b(ltd|limited|plc|llp|lp|inc|corp|co|company|group|holdings?|services|solutions|partners|associates|consulting|consultants|uk|international|global|trading|enterprises|ventures|capital|investments?|properties|property|estates?|electrical|engineering|construction|logistics|systems|technologies|technology|tech|digital|media|studio|labs?|foods?|retail|realisations|trust|foundation|council|university|school|college|club|bank|insurance|cic)\b|&/i;
  const FIRST_NAMES = new Set(('aaron abby abdul abigail adam adrian aidan aisha alan alastair albert alex alexander alexandra alfie ali alice alicia alison amanda amber amelia amy andrea andrew andy angela anna anne annie anthony antony archie arthur ashley barbara barry ben benjamin beth bethany bill billy bob bradley brian bruce callum cameron carl carlos carol caroline catherine charles charlie charlotte chloe chris christian christina christine christopher claire clare colin connor craig dan daniel danielle darren dave david dean debbie deborah declan denise dennis derek diana diane dominic donald douglas dylan eddie edward eileen elaine eleanor elizabeth ella ellie emily emma eric erin ethan evelyn evie fiona frances francesca frank fraser freddie frederick freya gail gareth gary gavin gemma geoff geoffrey george georgia gerald gillian gordon grace graham grant greg gregory hannah harriet harry harvey hayley heather helen henry holly hugh hugo iain ian imogen isaac isabel isabella isla jack jackie jacob jake james jamie jane janet jason jasmine jay jean jeff jeffrey jennifer jenny jeremy jessica jill jim jo joan joanna joanne joe joel john johnny jon jonathan jordan joseph josh joshua joy judith julia julian julie justin karen kate katherine kathryn katie kay keith kelly kenneth kerry kevin kieran kim kirsty laura lauren leah lee leo leon lewis liam lily linda lindsay lisa liz lloyd logan louis louise lucas lucy luke lydia lynn mandy marc marcus margaret maria marie mark martin mary matt matthew max maya megan melanie melissa mia michael michelle mike millie mohammed molly morgan nancy naomi natalie nathan neil nicholas nick nicola nigel noah oliver olivia oscar owen pamela patricia patrick paul paula pauline penny peter philip phillip phoebe poppy rachel ralph raymond rebecca richard rob robert robin roger rory ronald rosie ross ruby russell ruth ryan sally sam samantha samuel sandra sara sarah scarlett scott sean sebastian sharon shaun sheila simon sofia sophie spencer stacey stanley stephanie stephen steve steven stewart stuart sue susan suzanne swapnil tara teresa terry theo theodore thomas tim timo timothy tina toby tom tommy tony tracey tracy trevor victoria vincent wayne wendy will william yvonne zach zoe zara').split(' '));

  const PROVIDERS = [
    { id: 'google', name: 'Google', fav: 'google.com' },
    { id: 'maps', name: 'Maps', fav: 'maps.google.com' },
    { id: 'ch', name: 'Companies House', short: 'CH', fav: 'find-and-update.company-information.service.gov.uk' },
    { id: 'linkedin', name: 'LinkedIn', fav: 'linkedin.com' },
    { id: 'endole', name: 'Endole', fav: 'open.endole.co.uk' },
    { id: 'chatgpt', name: 'ChatGPT', fav: 'chatgpt.com' },
  ];

  /* ------------------------------------------------------------------ */
  /* Storage                                                            */
  /* ------------------------------------------------------------------ */

  function gv(k, d) { try { const v = GM_getValue(k); return v === undefined ? d : v; } catch (e) { return d; } }
  function sv(k, v) { try { GM_setValue(k, v); } catch (e) { /* ignore */ } }
  function dv(k) { try { GM_deleteValue(k); } catch (e) { /* ignore */ } }

  let settings = Object.assign({}, DEFAULTS, readJSON(gv(K.settings, null)) || {});
  function readJSON(v) { if (!v) return null; if (typeof v === 'object') return v; try { return JSON.parse(v); } catch (e) { return null; } }
  function saveSettings() { sv(K.settings, JSON.stringify(settings)); }
  function chKey() { return String(gv(K.chKey, '') || '').trim(); }
  function claudeKey() { return String(gv(K.claudeKey, '') || '').trim(); }

  function cacheGet(key, ttl) {
    const v = readJSON(gv('prosper.c.' + key, null));
    if (!v || !v.t || Date.now() - v.t > ttl) return null;
    return v;
  }
  function cacheSet(key, d) { sv('prosper.c.' + key, JSON.stringify({ t: Date.now(), d })); }
  function pruneCache() {
    try {
      if (typeof GM_listValues !== 'function') return;
      const now = Date.now();
      for (const k of GM_listValues()) {
        if (!k.startsWith('prosper.c.')) continue;
        const v = readJSON(gv(k, null));
        const ttl = k.startsWith('prosper.c.brief:') ? TTL_BRIEF : TTL_CH;
        if (!v || !v.t || now - v.t > ttl) dv(k);
      }
    } catch (e) { /* ignore */ }
  }
  function clearCache() {
    try { for (const k of GM_listValues()) if (k.startsWith('prosper.c.') || k === K.enums) dv(k); } catch (e) { /* ignore */ }
  }

  /* ------------------------------------------------------------------ */
  /* Helpers                                                            */
  /* ------------------------------------------------------------------ */

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function pd(s) { if (!s) return null; const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null; }
  function fmtDate(s) { const d = pd(s); return d ? `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}` : ''; }
  function ageText(s) {
    const d = pd(s); if (!d) return '';
    const months = Math.floor((Date.now() - d.getTime()) / (30.4375 * 864e5));
    if (months < 1) return 'under 1 month';
    if (months < 12) return `${months} month${months === 1 ? '' : 's'}`;
    const y = Math.floor(months / 12); return `${y} yr${y === 1 ? '' : 's'}`;
  }
  const daysAgo = (s) => { const d = pd(s); return d ? (Date.now() - d.getTime()) / 864e5 : Infinity; };
  const KEEP_UPPER = /^(UK|PLC|LLP|LP|CIC|II|III|IV|IT|HR|PR|AI|GB|USA|EU|UKI|SE|NHS|BBC|BT)$/;
  function titleCase(s) {
    return String(s || '').toLowerCase().replace(/[a-z0-9][a-z0-9']*/g, (w) => {
      if (KEEP_UPPER.test(w.toUpperCase()) && w !== 'it') return w.toUpperCase();
      if (w.length <= 4 && !/[aeiouy]/.test(w) && /^[a-z]+$/.test(w)) return w.toUpperCase();
      return w.replace(/^([a-z])|(-)([a-z])/g, (m, a, b, c) => a ? a.toUpperCase() : b + c.toUpperCase())
        .replace(/^([A-Z])'([a-z])(?=[a-z]{2})/, (m, a, b) => a + "'" + b.toUpperCase());
    }).replace(/\bLtd\b/g, 'Ltd');
  }
  function officerName(n) {
    if (!n) return '';
    const m = /^([^,]+),\s*(.+)$/.exec(n);
    if (!m || /\b(LIMITED|LTD|LLP|PLC)\b/i.test(n)) return titleCase(n);
    const rest = m[2].replace(/,\s*(Dr|Sir|Prof|Mr|Mrs|Ms|Lord|Lady)\.?$/i, (x, t) => ' (' + t + ')');
    return titleCase(rest) + ' ' + titleCase(m[1]);
  }
  function addrText(a) {
    if (!a) return '';
    return [a.care_of && ('c/o ' + a.care_of), a.po_box, a.premises, a.address_line_1, a.address_line_2, a.locality, a.region, a.postal_code, a.country]
      .filter(Boolean).map((x) => String(x).trim()).filter((x, i, arr) => x && arr.indexOf(x) === i).join(', ');
  }
  function alphaKey(s) {
    let k = String(s || '').toUpperCase().replace(/&/g, ' AND ').replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    k = k.replace(/\b(THE)\b\s*/g, '').replace(/\s*\b(LIMITED|LTD|PLC|LLP|LP|CIC|COMPANY|CO|PUBLIC LIMITED COMPANY|LIMITED LIABILITY PARTNERSHIP|UK)\b\.?$/g, '');
    k = k.replace(/\s*\b(LIMITED|LTD|PLC|LLP)\b$/g, '');
    return k.replace(/[^A-Z0-9]/g, '');
  }
  function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

  /* ------------------------------------------------------------------ */
  /* Detection                                                          */
  /* ------------------------------------------------------------------ */

  function companyLabelFromDomain(domain) {
    const parts = domain.toLowerCase().split('.').filter(Boolean);
    if (parts.length < 2) return parts[0] || domain;
    let i = parts.length - 2;
    if (parts.length >= 3 && SLD.test(parts[i])) i -= 1;
    return parts[i].replace(/-/g, ' ');
  }
  function cleanDomain(s) {
    return s.trim().replace(/^[a-z]+:\/\//i, '').replace(/^www\./i, '').replace(/[/?#:].*$/, '').toLowerCase();
  }
  function looksLikePerson(t) {
    if (t.length > 60 || /\d/.test(t) || COMPANY_WORDS.test(t)) return false;
    if (/^[A-Z][A-Z'\- ]+,\s*[A-Za-z'\- ]+$/.test(t)) return true; // SURNAME, First Middle (CH style)
    const words = t.split(/\s+/);
    if (words.length < 2 || words.length > 4) return false;
    if (!words.every((w) => /^[A-Za-z][A-Za-z'\-.]*$/.test(w))) return false;
    const first = words[0].replace(/\./g, '').toLowerCase();
    if (/^(mr|mrs|ms|miss|dr|sir|prof)$/.test(first)) return true;
    return FIRST_NAMES.has(first);
  }
  function detect(raw) {
    let t = String(raw || '').replace(/\s+/g, ' ').trim().replace(/^[\s"'(<\[]+|[\s"',;:)>\].]+$/g, '');
    if (!t) return null;
    const mail = /^(?:mailto:)?([a-z0-9._%+'-]+)@([a-z0-9.-]+\.[a-z]{2,})$/i.exec(t);
    if (mail) {
      const domain = mail[2].toLowerCase();
      if (FREEMAIL.test(domain)) {
        const local = mail[1].replace(/[0-9_]+/g, ' ').split(/[.\-+]/).filter((x) => x.length > 1);
        const name = local.length >= 2 ? local.map((x) => x[0].toUpperCase() + x.slice(1)).join(' ') : '';
        return { raw: t, type: 'freemail', label: 'Personal email', query: name || t, mode: name ? 'person' : 'none', email: t };
      }
      return { raw: t, type: 'email', label: 'Email', query: companyLabelFromDomain(domain), mode: 'company', domain, email: t };
    }
    const chn = t.replace(/\s+/g, '').toUpperCase();
    if (/^(?:\d{8}|[A-Z]{2}\d{6}|[A-Z]\d{7})$/.test(chn) && /^(\d{8}|SC|NI|OC|SO|NC|FC|SF|NF|IP|SP|RC|SR|LP|SL|NL|ZC|SZ|IC|SI|NR|NP|SE|GE|R\d|CE|CS|RS|AC|SA|NA|NO|IS)/.test(chn)) {
      return { raw: t, type: 'chnum', label: 'CH number', query: chn, mode: 'number', number: chn };
    }
    if (/^\d{6,7}$/.test(chn)) return { raw: t, type: 'chnum', label: 'CH number', query: chn.padStart(8, '0'), mode: 'number', number: chn.padStart(8, '0') };
    if (!/\s/.test(t) && /^(?:[a-z]+:\/\/)?(?:www\.)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:[:/?#].*)?$/i.test(t)) {
      const domain = cleanDomain(t);
      return { raw: t, type: 'domain', label: 'Website', query: companyLabelFromDomain(domain), mode: 'company', domain };
    }
    if (looksLikePerson(t)) return { raw: t, type: 'person', label: 'Person', query: t, mode: 'person' };
    return { raw: t, type: 'company', label: 'Company', query: t, mode: 'company' };
  }

  /* ------------------------------------------------------------------ */
  /* Network                                                            */
  /* ------------------------------------------------------------------ */

  function xhr(opts) {
    return new Promise((resolve) => {
      try {
        GM_xmlhttpRequest({
          method: opts.method || 'GET', url: opts.url, headers: opts.headers || {}, data: opts.data, timeout: opts.timeout || 20000,
          onload: (r) => resolve({ status: r.status, text: r.responseText }),
          onerror: () => resolve({ status: 0, text: '' }),
          ontimeout: () => resolve({ status: -1, text: '' }),
        });
      } catch (e) { resolve({ status: 0, text: String(e) }); }
    });
  }
  class PErr extends Error { constructor(code, msg) { super(msg || code); this.code = code; } }

  const inflight = new Map();
  async function ch(path, ttl) {
    ttl = ttl == null ? TTL_CH : ttl;
    const hit = cacheGet('ch:' + path, ttl);
    if (hit) return hit.d;
    const key = chKey();
    if (!key) throw new PErr('ch-nokey');
    if (inflight.has(path)) return inflight.get(path);
    const p = (async () => {
      const r = await xhr({ url: CH_API + path, headers: { Authorization: 'Basic ' + btoa(key + ':'), Accept: 'application/json' } });
      if (r.status === 200) { let d; try { d = JSON.parse(r.text); } catch (e) { throw new PErr('ch-bad'); } cacheSet('ch:' + path, d); return d; }
      if (r.status === 404) { cacheSet('ch:' + path, null); return null; }
      if (r.status === 401 || r.status === 403) throw new PErr('ch-401');
      if (r.status === 429) throw new PErr('ch-429');
      if (r.status <= 0) throw new PErr('ch-net');
      throw new PErr('ch-http', 'Companies House returned ' + r.status);
    })();
    inflight.set(path, p);
    try { return await p; } finally { inflight.delete(path); }
  }

  /* Companies House enumerations (SIC descriptions, labels) */
  let ENUMS = readJSON(gv(K.enums, null));
  function parseEnums(yml) {
    const out = {}; let sec = null;
    for (const line of yml.split(/\r?\n/)) {
      let m = /^([a-z_]+):\s*$/.exec(line);
      if (m) { sec = m[1]; out[sec] = {}; continue; }
      m = /^\s+['"]?([^'":]+?)['"]?\s*:\s*["'](.*)["']\s*$/.exec(line);
      if (m && sec) out[sec][m[1].trim()] = m[2];
    }
    const keep = ['sic_descriptions', 'company_status', 'company_status_detail', 'company_type', 'officer_role', 'insolvency_case_type', 'insolvency_case_date_type', 'account_type'];
    const r = { t: Date.now() }; for (const k of keep) r[k] = out[k] || {}; return r;
  }
  let enumsLoading = null;
  function loadEnums() {
    if (ENUMS && ENUMS.t && Date.now() - ENUMS.t < TTL_ENUMS) return Promise.resolve(ENUMS);
    if (enumsLoading) return enumsLoading;
    enumsLoading = xhr({ url: ENUMS_URL }).then((r) => {
      if (r.status === 200 && r.text.includes('sic_descriptions')) { ENUMS = parseEnums(r.text); sv(K.enums, JSON.stringify(ENUMS)); }
      return ENUMS;
    }).finally(() => { enumsLoading = null; });
    return enumsLoading;
  }
  const FALLBACK_LABELS = { 'ltd': 'Private limited company', 'plc': 'Public limited company', 'llp': 'Limited liability partnership', 'private-limited-guarant-nsc': 'Private limited by guarantee without share capital', 'private-limited-guarant-nsc-limited-exemption': 'Private limited by guarantee (exempt from Limited)', 'private-unlimited': 'Private unlimited company' };
  function label(sec, code) {
    if (!code) return '';
    const v = ENUMS && ENUMS[sec] && ENUMS[sec][code];
    if (v) return v.trim();
    if (sec === 'company_type' && FALLBACK_LABELS[code]) return FALLBACK_LABELS[code];
    const s = String(code).replace(/-/g, ' ');
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  const sicDesc = (c) => (ENUMS && ENUMS.sic_descriptions && ENUMS.sic_descriptions[c]) || '';

  /* ------------------------------------------------------------------ */
  /* Company lookup                                                     */
  /* ------------------------------------------------------------------ */

  async function findCompanies(q) {
    const enc = encodeURIComponent(q);
    const [search, alpha] = await Promise.all([
      ch(`/search/companies?q=${enc}&items_per_page=20`),
      ch(`/alphabetical-search/companies?q=${enc}&items_per_page=1`).catch(() => null),
    ]);
    const qk = alphaKey(q);
    const items = ((search && search.items) || []).map((it, i) => ({
      number: it.company_number, name: it.title, status: it.company_status, created: it.date_of_creation,
      address: it.address_snippet, formerly: (it.snippet || '').split(' · ').map((s) => s.trim()).filter(Boolean), rank: i,
    }));
    const top = alpha && alpha.top_hit;
    if (top && top.company_number && !items.some((x) => x.number === top.company_number)) {
      items.push({ number: top.company_number, name: top.company_name, status: top.company_status, formerly: [], rank: 30, address: '' });
    }
    for (const it of items) {
      it.exact = alphaKey(it.name) === qk;
      it.formerExact = !it.exact && it.formerly.some((f) => alphaKey(f) === qk);
      it.score = (it.exact ? 100 : 0) + (it.formerExact ? 60 : 0) + (it.status === 'active' ? 20 : 0) - it.rank;
    }
    items.sort((a, b) => b.score - a.score);
    const exactish = items.filter((x) => x.exact || x.formerExact);
    const ambiguous = items.length > 1 && (!items[0].exact || exactish.length > 1);
    return { items: items.slice(0, 8), ambiguous, matched: !!(items[0] && (items[0].exact || items[0].formerExact)), qk };
  }

  async function loadCompany(number) {
    number = String(number).toUpperCase();
    const profile = await ch('/company/' + number);
    if (!profile) throw new PErr('ch-404', 'No company with number ' + number);
    const want = (l) => profile.links && profile.links[l];
    const [officers, psc, charges, insolvency] = await Promise.all([
      ch(`/company/${number}/officers?items_per_page=100`).catch(() => null),
      want('persons_with_significant_control') ? ch(`/company/${number}/persons-with-significant-control?items_per_page=25`).catch(() => null) : null,
      (profile.has_charges || want('charges')) ? ch(`/company/${number}/charges?items_per_page=1`).catch(() => null) : null,
      (profile.has_insolvency_history || want('insolvency')) ? ch(`/company/${number}/insolvency`).catch(() => null) : null,
      loadEnums().catch(() => null),
    ]);
    return buildFacts(profile, officers, psc, charges, insolvency);
  }

  function buildFacts(p, officersRes, pscRes, chargesRes, insRes) {
    const offs = (officersRes && officersRes.items) || [];
    const current = offs.filter((o) => !o.resigned_on);
    const recent = [];
    for (const o of offs) {
      if (daysAgo(o.appointed_on) <= 365) recent.push({ date: o.appointed_on, text: `${officerName(o.name)} appointed ${label('officer_role', o.officer_role).toLowerCase()}` });
      if (o.resigned_on && daysAgo(o.resigned_on) <= 365) recent.push({ date: o.resigned_on, text: `${officerName(o.name)} resigned as ${label('officer_role', o.officer_role).toLowerCase()}` });
    }
    for (const n of p.previous_company_names || []) if (daysAgo(n.ceased_on) <= 365) recent.push({ date: n.ceased_on, text: `Changed name from ${titleCase(n.name)}` });
    recent.sort((a, b) => (a.date < b.date ? 1 : -1));
    const officerChanges = recent.filter((r) => /appointed|resigned/.test(r.text)).length;

    const total = chargesRes ? (chargesRes.total_count || 0) : 0;
    const satisfied = chargesRes ? (chargesRes.satisfied_count || 0) : 0;
    const outstanding = chargesRes ? Math.max(0, total - satisfied) : 0;
    const partSatisfied = chargesRes ? (chargesRes.part_satisfied_count || 0) : 0;

    const pscs = ((pscRes && pscRes.items) || []).filter((x) => !x.ceased && !x.ceased_on).map((x) => ({
      name: /individual/.test(x.kind || '') ? officerName(x.name) || titleCase(x.name) : titleCase(x.name),
      kind: /corporate/.test(x.kind || '') ? 'Company' : /legal-person/.test(x.kind || '') ? 'Legal person' : 'Individual',
      control: (x.natures_of_control || []).map((n) => n.replace(/-/g, ' ').replace(/ownership of shares (\d+) to (\d+) percent/, 'shares $1-$2%').replace(/voting rights (\d+) to (\d+) percent/, 'votes $1-$2%').replace(/ as (a )?(person|firm|trust)$/, '')).slice(0, 2).join(', '),
      notified: x.notified_on,
    }));

    const cases = ((insRes && insRes.cases) || []).map((c) => ({
      type: label('insolvency_case_type', c.type),
      dates: (c.dates || []).map((d) => `${label('insolvency_case_date_type', d.type)} ${fmtDate(d.date)}`).join('; '),
    }));

    const acc = p.accounts || {};
    const cs = p.confirmation_statement || {};
    const accountsOverdue = !!(acc.overdue || (acc.next_accounts && acc.next_accounts.overdue));
    const csOverdue = !!cs.overdue;
    const status = p.company_status || '';
    const active = status === 'active';
    const lastAccType = acc.last_accounts && acc.last_accounts.type;

    const caution = [], check = [], also = [];
    if (!active) caution.push(`Status is ${label('company_status', status).toLowerCase() || status}`);
    if (p.company_status_detail) caution.push(label('company_status_detail', p.company_status_detail));
    if (p.has_insolvency_history) caution.push('Has insolvency history');
    if (active) {
      if (accountsOverdue) check.push('Accounts overdue');
      if (csOverdue) check.push('Confirmation statement overdue');
      if (officersRes && current.length === 0) check.push('No current officers');
      if (p.registered_office_is_in_dispute) check.push('Registered office in dispute');
      if (p.undeliverable_registered_office_address) check.push('Registered office undeliverable');
    }
    if (daysAgo(p.date_of_creation) < 365) also.push('Under 1 year old');
    if (officerChanges >= 3) also.push(`${officerChanges} officer changes in 12 months`);
    if (outstanding > 0) also.push(`${outstanding} outstanding charge${outstanding === 1 ? '' : 's'}`);
    if (!(acc.last_accounts && acc.last_accounts.made_up_to)) also.push('No accounts filed yet');
    if (lastAccType === 'dormant' || (p.sic_codes || []).includes('99999')) also.push('Dormant');
    const verdict = caution.length ? 'caution' : check.length ? 'check' : 'ok';

    return {
      number: p.company_number, name: p.company_name, display: titleCase(p.company_name), status, statusLabel: label('company_status', status),
      statusDetail: p.company_status_detail ? label('company_status_detail', p.company_status_detail) : '',
      type: label('company_type', p.type), created: p.date_of_creation, ceased: p.date_of_cessation, jurisdiction: label('jurisdiction', p.jurisdiction),
      address: addrText(p.registered_office_address), postcode: (p.registered_office_address || {}).postal_code || '',
      sic: (p.sic_codes || []).map((c) => ({ code: c, desc: sicDesc(c) })),
      previousNames: (p.previous_company_names || []).map((n) => ({ name: titleCase(n.name), from: n.effective_from, to: n.ceased_on })),
      accounts: {
        lastMadeUp: acc.last_accounts && acc.last_accounts.made_up_to, lastType: lastAccType ? label('account_type', lastAccType) : '',
        nextDue: (acc.next_accounts && acc.next_accounts.due_on) || acc.next_due, overdue: accountsOverdue,
      },
      cs: { last: cs.last_made_up_to, nextDue: cs.next_due, overdue: csOverdue },
      officers: current.map((o) => ({ name: officerName(o.name), role: label('officer_role', o.officer_role), appointed: o.appointed_on, link: o.links && o.links.officer && o.links.officer.appointments })),
      officersKnown: !!officersRes, recent, officerChanges, pscs, pscKnown: !!pscRes,
      charges: { total, outstanding, partSatisfied, known: !!chargesRes || !p.has_charges },
      insolvency: cases, hasInsolvency: !!p.has_insolvency_history,
      verdict, caution, check, also,
      url: `${CH_WEB}/company/${p.company_number}`,
    };
  }

  /* ------------------------------------------------------------------ */
  /* Person lookup                                                      */
  /* ------------------------------------------------------------------ */

  async function findOfficers(q) {
    const r = await ch(`/search/officers?q=${encodeURIComponent(q)}&items_per_page=10`);
    return ((r && r.items) || []).map((o) => ({
      name: o.title, link: o.links && o.links.self, count: o.appointment_count,
      dob: o.date_of_birth ? `${MONTHS[o.date_of_birth.month - 1]} ${o.date_of_birth.year}` : '',
      address: o.address_snippet,
    }));
  }
  async function loadAppointments(link) {
    const r = await ch(`${link}?items_per_page=50`);
    return ((r && r.items) || []).map((a) => ({
      company: titleCase((a.appointed_to && a.appointed_to.company_name) || ''), number: a.appointed_to && a.appointed_to.company_number,
      status: a.appointed_to && a.appointed_to.company_status, role: label('officer_role', a.officer_role), appointed: a.appointed_on, resigned: a.resigned_on,
    }));
  }

  /* ------------------------------------------------------------------ */
  /* Claude brief                                                       */
  /* ------------------------------------------------------------------ */

  function factsText(f) {
    const L = [];
    L.push(`Company: ${f.name} (Companies House ${f.number})`);
    L.push(`Status: ${f.statusLabel}${f.statusDetail ? ' - ' + f.statusDetail : ''}; Type: ${f.type}; Incorporated ${fmtDate(f.created)} (${ageText(f.created)})`);
    if (f.address) L.push(`Registered office: ${f.address}`);
    if (f.sic.length) L.push(`SIC: ${f.sic.map((s) => s.code + (s.desc ? ' ' + s.desc : '')).join('; ')}`);
    if (f.previousNames.length) L.push(`Previous names: ${f.previousNames.map((n) => n.name).join('; ')}`);
    L.push(`Accounts: last made up to ${fmtDate(f.accounts.lastMadeUp) || 'none'}${f.accounts.lastType ? ' (' + f.accounts.lastType + ')' : ''}; next due ${fmtDate(f.accounts.nextDue) || 'n/a'}${f.accounts.overdue ? ' OVERDUE' : ''}`);
    if (f.officersKnown) L.push(`Directors/officers: ${f.officers.slice(0, 12).map((o) => `${o.name} (${o.role}, since ${fmtDate(o.appointed)})`).join('; ') || 'none'}`);
    if (f.recent.length) L.push(`Changes in last 12 months: ${f.recent.slice(0, 8).map((r) => r.text + ' ' + fmtDate(r.date)).join('; ')}`);
    if (f.pscs.length) L.push(`PSCs: ${f.pscs.map((p) => p.name + (p.control ? ' (' + p.control + ')' : '')).join('; ')}`);
    if (f.charges.total) L.push(`Charges: ${f.charges.outstanding} outstanding of ${f.charges.total}`);
    if (f.insolvency.length) L.push(`Insolvency: ${f.insolvency.map((c) => c.type + ' ' + c.dates).join(' | ')}`);
    L.push(`Quick check: ${verdictLabel(f.verdict)}${f.caution.concat(f.check).length ? ' - ' + f.caution.concat(f.check).join('; ') : ''}`);
    return L.join('\n');
  }

  function claudeError(status, text) {
    let msg = ''; try { const j = JSON.parse(text); msg = (j.error && j.error.message) || ''; } catch (e) { /* ignore */ }
    if (status === 401 || status === 403) return new PErr('cl-401', 'Claude API key was rejected. Check it in Settings.');
    if (status === 402 || /credit balance|billing/i.test(msg)) return new PErr('cl-credit', 'Your Anthropic account is out of credit. Top up at console.anthropic.com, then try again.');
    if (status === 429) return new PErr('cl-429', 'Claude rate limit hit. Wait a minute and try again.');
    if (status === 529 || status === 503) return new PErr('cl-busy', 'Claude is overloaded right now. Try again shortly.');
    if (status === 404 || /model/i.test(msg)) return new PErr('cl-model', 'Model not available: ' + (msg || status));
    if (status <= 0) return new PErr('cl-net', 'Could not reach api.anthropic.com.');
    return new PErr('cl-http', 'Claude error ' + status + (msg ? ': ' + msg : ''));
  }

  async function runBrief(f, domain, force) {
    const model = settings.model in MODELS ? settings.model : DEFAULTS.model;
    const ck = `brief:${f.number}:${model}`;
    if (!force) { const hit = cacheGet(ck, TTL_BRIEF); if (hit) return Object.assign({}, hit.d, { cachedAt: hit.t }); }
    const key = claudeKey();
    if (!key) throw new PErr('cl-nokey');
    const prompt = `You are helping a UK B2B salesperson prepare to contact a prospect. Companies House facts (authoritative, do not contradict):\n\n${factsText(f)}\n${domain ? 'Likely website: ' + domain + '\n' : ''}\nUse web search (at most 3 searches) to learn what this company actually does and find recent signals (news, hiring, funding, contracts, expansion, leadership changes; prefer the last 18 months). Make sure results are about THIS company, not a similarly named one.\n\nReply with ONLY a JSON object, no prose before or after:\n{"what":["3 short lines on what they do, who for, where"],"signals":[{"text":"one line","date":"YYYY-MM or empty","url":"source url from your search results"}],"talking_points":["3 specific, practical openers for a sales conversation"],"confidence":"high|medium|low"}\nRules: at most 4 signals; each line under 25 words; only use URLs that appeared in your search results; if nothing reliable is found, say so in "what" and leave signals empty.`;
    const body = {
      model, max_tokens: 4000,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3, user_location: { type: 'approximate', country: 'GB' } }],
      messages: [{ role: 'user', content: prompt }],
    };
    const r = await xhr({
      method: 'POST', url: CLAUDE_URL, timeout: 120000, data: JSON.stringify(body),
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json', 'anthropic-dangerous-direct-browser-access': 'true' },
    });
    if (r.status !== 200) throw claudeError(r.status, r.text);
    let res; try { res = JSON.parse(r.text); } catch (e) { throw new PErr('cl-bad', 'Claude returned an unreadable response.'); }
    const blocks = res.content || [];
    const searchUrls = new Map();
    let lastTool = -1;
    blocks.forEach((b, i) => {
      if (b.type === 'web_search_tool_result') {
        lastTool = i;
        if (Array.isArray(b.content)) for (const c of b.content) if (c.url) searchUrls.set(c.url, c.title || c.url);
      }
    });
    const cited = new Map();
    for (const b of blocks) if (b.type === 'text' && b.citations) for (const c of b.citations) if (c.url && searchUrls.has(c.url)) cited.set(c.url, c.title || searchUrls.get(c.url));
    let text = blocks.slice(lastTool + 1).filter((b) => b.type === 'text').map((b) => b.text).join('');
    if (!text.includes('{')) text = blocks.filter((b) => b.type === 'text').map((b) => b.text).join('');
    const fence = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
    let js = fence ? fence[1] : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
    let data = null; try { data = JSON.parse(js); } catch (e) { data = null; }
    if (!data) data = { what: [text.replace(/\s+/g, ' ').trim().slice(0, 400) || 'No brief returned.'], signals: [], talking_points: [] };
    const signals = (data.signals || []).slice(0, 4).map((s) => ({ text: String(s.text || ''), date: String(s.date || ''), url: s.url && searchUrls.has(s.url) ? s.url : '' }));
    const sources = new Map(cited);
    for (const s of signals) if (s.url) sources.set(s.url, searchUrls.get(s.url));
    if (!sources.size) for (const [u, t] of Array.from(searchUrls).slice(0, 4)) sources.set(u, t);
    const u = res.usage || {};
    const price = MODELS[model];
    const inTok = (u.input_tokens || 0) + 1.25 * (u.cache_creation_input_tokens || 0) + 0.1 * (u.cache_read_input_tokens || 0);
    const searches = (u.server_tool_use && u.server_tool_use.web_search_requests) || 0;
    const cost = (inTok * price.inM + (u.output_tokens || 0) * price.outM) / 1e6 + searches * SEARCH_COST;
    const brief = {
      what: (data.what || []).slice(0, 3).map(String), signals, talking: (data.talking_points || []).slice(0, 3).map(String),
      confidence: data.confidence || '', sources: Array.from(sources).slice(0, 6).map(([url, title]) => ({ url, title })),
      usage: { input: u.input_tokens || 0, output: u.output_tokens || 0, searches }, cost, model, at: Date.now(), estPrice: !!price.est,
    };
    cacheSet(ck, brief);
    return brief;
  }

  /* ------------------------------------------------------------------ */
  /* Links, copy, note                                                  */
  /* ------------------------------------------------------------------ */

  function linkFor(id, ctx) {
    const f = ctx.company;
    const nameQ = f ? f.display.replace(/\s+(Limited|Ltd|PLC|LLP)$/i, '') : ctx.query;
    const raw = ctx.raw || ctx.query;
    const enc = encodeURIComponent;
    switch (id) {
      case 'google': return 'https://www.google.com/search?q=' + enc(f ? f.display : (ctx.domain && ctx.det && ctx.det.type !== 'person' ? ctx.domain : raw));
      case 'maps': return 'https://www.google.com/maps/search/' + enc(f ? `${nameQ} ${f.postcode}`.trim() : raw);
      case 'ch':
        if (f) return f.url;
        if (ctx.det && ctx.det.mode === 'person') return `${CH_WEB}/search/officers?q=${enc(ctx.query)}`;
        return `${CH_WEB}/search/companies?q=${enc(ctx.query)}`;
      case 'linkedin':
        if (ctx.det && ctx.det.mode === 'person' && !f) return 'https://www.linkedin.com/search/results/people/?keywords=' + enc(ctx.query);
        return 'https://www.linkedin.com/search/results/companies/?keywords=' + enc(nameQ);
      case 'endole': return 'https://open.endole.co.uk/search/?q=' + enc(f ? nameQ : ctx.query).replace(/%20/g, '+');
      case 'chatgpt': return 'https://chatgpt.com/?q=' + enc(f ? `Tell me about ${f.display} (UK company number ${f.number}${ctx.domain ? ', website ' + ctx.domain : ''}): what they do, size, recent news.` : `Tell me about ${raw}`);
    }
    return '';
  }
  function openTab(url, bg) {
    const background = bg == null ? !!settings.background : bg;
    try { GM_openInTab(url, { active: !background, insert: true, setParent: true }); } catch (e) { window.open(url, '_blank', 'noopener'); }
  }
  function copyText(t) {
    try { if (typeof GM_setClipboard === 'function') { GM_setClipboard(t, 'text'); return Promise.resolve(true); } } catch (e) { /* fall through */ }
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(t).then(() => true, () => fallbackCopy(t));
    return Promise.resolve(fallbackCopy(t));
  }
  function fallbackCopy(t) {
    const ta = document.createElement('textarea'); ta.value = t; ta.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e) { /* ignore */ } ta.remove(); return ok;
  }
  function verdictLabel(v) { return v === 'caution' ? 'Caution' : v === 'check' ? 'Check' : 'Looks normal'; }

  function hubspotNote(f, brief) {
    const L = [];
    const d = new Date();
    L.push(`Prosper check - ${f.display} (${f.number}) - ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`);
    const reasons = f.caution.concat(f.check);
    L.push(`Quick check: ${verdictLabel(f.verdict)}${reasons.length ? ' (' + reasons.join('; ') + ')' : ''}`);
    if (f.also.length) L.push(`Also: ${f.also.join('; ')}`);
    L.push(`Status: ${f.statusLabel}${f.statusDetail ? ' - ' + f.statusDetail : ''} | ${f.type} | Incorporated ${fmtDate(f.created)} (${ageText(f.created)})`);
    if (f.address) L.push(`Registered office: ${f.address}`);
    if (f.sic.length) L.push(`SIC: ${f.sic.map((s) => s.code + (s.desc ? ' ' + s.desc : '')).join('; ')}`);
    if (f.previousNames.length) L.push(`Previous names: ${f.previousNames.map((n) => n.name).join('; ')}`);
    L.push(`Accounts: last made up to ${fmtDate(f.accounts.lastMadeUp) || 'none filed'}; next due ${fmtDate(f.accounts.nextDue) || 'n/a'}${f.accounts.overdue ? ' (OVERDUE)' : ''}`);
    L.push(`Confirmation statement: next due ${fmtDate(f.cs.nextDue) || 'n/a'}${f.cs.overdue ? ' (OVERDUE)' : ''}`);
    if (f.officersKnown) L.push(`Directors (${f.officers.length}): ${f.officers.map((o) => `${o.name}${o.role !== 'Director' ? ' (' + o.role + ')' : ''}`).join(', ') || 'none'}`);
    if (f.recent.length) L.push(`Last 12 months: ${f.recent.map((r) => `${r.text} (${fmtDate(r.date)})`).join('; ')}`);
    if (f.pscs.length) L.push(`PSCs: ${f.pscs.map((p) => p.name).join('; ')}`);
    if (f.charges.total) L.push(`Charges: ${f.charges.outstanding} outstanding of ${f.charges.total}`);
    if (f.insolvency.length) L.push(`Insolvency: ${f.insolvency.map((c) => `${c.type} (${c.dates})`).join('; ')}`);
    L.push(`Companies House: ${f.url}`);
    if (brief) {
      L.push('');
      L.push('AI brief (check before relying on it):');
      for (const w of brief.what) L.push(`- ${w}`);
      if (brief.signals.length) { L.push('Recent signals:'); for (const s of brief.signals) L.push(`- ${s.text}${s.date ? ' (' + s.date + ')' : ''}${s.url ? ' ' + s.url : ''}`); }
      if (brief.talking.length) { L.push('Talking points:'); for (const t of brief.talking) L.push(`- ${t}`); }
      if (brief.sources.length) { L.push('Sources:'); for (const s of brief.sources) L.push(`- ${s.url}`); }
    }
    return L.join('\n');
  }

  /* ------------------------------------------------------------------ */
  /* UI                                                                 */
  /* ------------------------------------------------------------------ */

  const CSS = `
:host { all: initial; }
* { box-sizing: border-box; }
.root {
  --bg: #ffffff; --bg2: #f6f7f8; --bg3: #eef0f2; --fg: #1f2328; --fg2: #57606a; --fg3: #8b949e;
  --line: #e1e4e8; --accent: #0a7a52; --accent-fg: #ffffff; --accent-soft: #e6f3ee;
  --warn: #9a6700; --warn-soft: #fff5d6; --bad: #b42318; --bad-soft: #fdecea; --shadow: 0 12px 32px rgba(15, 23, 42, .16), 0 2px 6px rgba(15, 23, 42, .08);
  font: 13px/1.45 Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: var(--fg);
  -webkit-font-smoothing: antialiased;
}
@media (prefers-color-scheme: dark) {
  .root { --bg: #17191c; --bg2: #1f2226; --bg3: #2a2e33; --fg: #e6e8ea; --fg2: #a8b0b8; --fg3: #7d858d; --line: #30353b;
    --accent: #2fa877; --accent-fg: #0b1510; --accent-soft: #15322a; --warn: #e3b341; --warn-soft: #3a2f12; --bad: #f47067; --bad-soft: #3d1d1b; --shadow: 0 12px 32px rgba(0,0,0,.5), 0 2px 6px rgba(0,0,0,.4); }
}
button, input, select { font: inherit; color: inherit; }
a { color: var(--accent); text-decoration: none; } a:hover { text-decoration: underline; }

.pill { position: fixed; z-index: 3; display: flex; align-items: center; gap: 0; height: 26px; padding: 0; border-radius: 13px; border: 1px solid var(--line);
  background: var(--bg); box-shadow: 0 4px 14px rgba(0,0,0,.14); cursor: pointer; opacity: 0; transform: translateY(4px) scale(.96); pointer-events: none;
  transition: opacity 120ms ease, transform 120ms ease; overflow: hidden; }
.pill.show { opacity: 1; transform: none; pointer-events: auto; }
.pill .p { width: 24px; height: 24px; display: grid; place-items: center; background: var(--accent); color: var(--accent-fg); font-weight: 700; font-size: 13px; border-radius: 12px; }
.pill .t { padding: 0 9px 0 7px; font-size: 11.5px; color: var(--fg2); white-space: nowrap; }
.pill:hover { border-color: var(--accent); }

.edge { position: fixed; right: 0; top: 42%; z-index: 1; width: 7px; height: 56px; border-radius: 6px 0 0 6px; background: var(--accent); opacity: .55; cursor: pointer;
  border: 0; padding: 0; transition: width 120ms ease, opacity 120ms ease; color: var(--accent-fg); font-weight: 700; font-size: 12px; overflow: hidden; }
.edge:hover, .edge:focus-visible { width: 22px; opacity: 1; }
.edge span { opacity: 0; transition: opacity 120ms; } .edge:hover span { opacity: 1; }
.edge.hide { display: none; }

.panel { position: fixed; right: 12px; top: 12px; bottom: 12px; width: 380px; max-width: calc(100vw - 24px); z-index: 2; display: flex; flex-direction: column;
  background: var(--bg); border: 1px solid var(--line); border-radius: 12px; box-shadow: var(--shadow); overflow: hidden;
  transform: translateX(calc(100% + 24px)); visibility: hidden; transition: transform 180ms cubic-bezier(.2,.8,.2,1), visibility 0s linear 180ms; }
.panel.open { transform: none; visibility: visible; transition: transform 180ms cubic-bezier(.2,.8,.2,1), visibility 0s; }
@media (prefers-reduced-motion: reduce) { .panel, .panel.open, .pill, .edge { transition: none !important; } }

.hd { display: flex; align-items: center; gap: 8px; padding: 10px 10px 10px 14px; border-bottom: 1px solid var(--line); flex: none; }
.logo { width: 20px; height: 20px; border-radius: 5px; background: var(--accent); color: var(--accent-fg); display: grid; place-items: center; font-weight: 700; font-size: 12px; }
.brand { font-weight: 600; font-size: 13.5px; flex: 1; }
.brand small { color: var(--fg3); font-weight: 400; margin-left: 4px; }
.ib { width: 28px; height: 28px; border: 0; background: transparent; border-radius: 6px; cursor: pointer; display: grid; place-items: center; color: var(--fg2); }
.ib:hover { background: var(--bg3); color: var(--fg); } .ib.on { color: var(--accent); background: var(--accent-soft); }
.ib svg { width: 16px; height: 16px; }

.sb { padding: 10px 14px; border-bottom: 1px solid var(--line); flex: none; background: var(--bg2); }
.det { display: flex; align-items: center; gap: 6px; margin-bottom: 7px; min-height: 18px; color: var(--fg2); font-size: 12px; }
.det q { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 250px; color: var(--fg); }
.badge { display: inline-flex; align-items: center; height: 18px; padding: 0 6px; border-radius: 4px; font-size: 10.5px; font-weight: 600; letter-spacing: .02em; text-transform: uppercase;
  background: var(--bg3); color: var(--fg2); white-space: nowrap; flex: none; }
.badge.g { background: var(--accent-soft); color: var(--accent); } .badge.w { background: var(--warn-soft); color: var(--warn); } .badge.r { background: var(--bad-soft); color: var(--bad); }
.srow { display: flex; gap: 6px; }
.srow input { flex: 1; min-width: 0; height: 32px; padding: 0 10px; border: 1px solid var(--line); border-radius: 7px; background: var(--bg); outline: none; }
.srow input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
.srow select { height: 32px; border: 1px solid var(--line); border-radius: 7px; background: var(--bg); padding: 0 6px; font-size: 12px; color: var(--fg2); }
.btn { height: 30px; padding: 0 11px; border: 1px solid var(--line); border-radius: 7px; background: var(--bg); cursor: pointer; font-size: 12.5px; font-weight: 500; white-space: nowrap; }
.btn:hover { background: var(--bg3); } .btn:disabled { opacity: .55; cursor: default; }
.btn.pri { background: var(--accent); border-color: var(--accent); color: var(--accent-fg); } .btn.pri:hover { filter: brightness(1.06); }
.btn.sm { height: 26px; padding: 0 9px; font-size: 12px; }

.body { flex: 1; overflow-y: auto; overscroll-behavior: contain; padding: 0 0 14px; }
.sec { padding: 12px 14px; border-bottom: 1px solid var(--line); }
.sec:last-child { border-bottom: 0; }
.sec h4 { margin: 0 0 7px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: var(--fg3); display: flex; align-items: center; gap: 6px; }
.sec h4 .ct { color: var(--fg3); font-weight: 500; text-transform: none; letter-spacing: 0; }
.title { font-size: 15px; font-weight: 600; line-height: 1.3; margin: 0 0 3px; }
.sub { color: var(--fg2); font-size: 12px; }
.kv { display: grid; grid-template-columns: 104px 1fr; gap: 4px 10px; font-size: 12.5px; }
.kv dt { color: var(--fg2); } .kv dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
.verdict { display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; border-radius: 8px; background: var(--accent-soft); margin-top: 10px; }
.verdict.check { background: var(--warn-soft); } .verdict.caution { background: var(--bad-soft); }
.verdict .vl { font-weight: 700; font-size: 12.5px; color: var(--accent); white-space: nowrap; }
.verdict.check .vl { color: var(--warn); } .verdict.caution .vl { color: var(--bad); }
.verdict ul { margin: 0; padding: 0; list-style: none; font-size: 12.5px; }
.verdict li + li { margin-top: 2px; }
.also { margin-top: 6px; font-size: 12px; color: var(--fg2); }
.also b { color: var(--fg); font-weight: 600; }
.list { margin: 0; padding: 0; list-style: none; }
.list li { padding: 5px 0; display: flex; gap: 8px; justify-content: space-between; align-items: baseline; font-size: 12.5px; }
.list li + li { border-top: 1px solid var(--line); }
.list .m { color: var(--fg2); font-size: 11.5px; white-space: nowrap; }
.list .n { min-width: 0; }
.list .n small { display: block; color: var(--fg2); font-size: 11.5px; }
.ovd { display: inline-block; margin-left: 6px; padding: 0 5px; border-radius: 3px; background: var(--bad); color: #fff; font-size: 10px; font-weight: 700; letter-spacing: .04em; vertical-align: 1px; }
.dark .ovd { color: #1a0d0c; }
.links { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.lk { display: flex; align-items: center; gap: 6px; height: 30px; padding: 0 8px; border: 1px solid var(--line); border-radius: 7px; background: var(--bg); cursor: pointer; font-size: 12px; min-width: 0; }
.lk:hover { border-color: var(--accent); }
.lk img, .lk .fb { width: 14px; height: 14px; flex: none; border-radius: 3px; }
.lk .fb { background: var(--bg3); display: grid; place-items: center; font-size: 9px; font-weight: 700; color: var(--fg2); }
.lk .nm { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; text-align: left; }
.lk kbd { font: 10px ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--fg3); }
.row { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.hint { font-size: 11.5px; color: var(--fg3); margin-top: 7px; }
.picker { margin-top: 8px; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
.picker summary { cursor: pointer; padding: 6px 10px; font-size: 12px; color: var(--fg2); background: var(--bg2); list-style: none; display: flex; justify-content: space-between; }
.picker summary::-webkit-details-marker { display: none; }
.picker[open] summary { border-bottom: 1px solid var(--line); }
.picker .opts { max-height: 196px; overflow-y: auto; }
.opt { display: flex; width: 100%; text-align: left; gap: 8px; justify-content: space-between; align-items: center; padding: 6px 10px; border: 0; background: var(--bg); cursor: pointer; font-size: 12.5px; }
.opt + .opt { border-top: 1px solid var(--line); }
.opt:hover { background: var(--bg2); } .opt.cur { background: var(--accent-soft); }
.opt .n { min-width: 0; } .opt small { display: block; color: var(--fg2); font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 250px; }
.state { padding: 26px 18px; text-align: center; color: var(--fg2); font-size: 12.5px; }
.state b { display: block; color: var(--fg); font-size: 13.5px; margin-bottom: 4px; }
.state .btn { margin-top: 10px; }
.err { margin: 12px 14px; padding: 10px 12px; border-radius: 8px; background: var(--bad-soft); color: var(--fg); font-size: 12.5px; }
.err b { color: var(--bad); }
.err .btn { margin-top: 8px; }
.skel { height: 12px; border-radius: 4px; background: var(--bg3); margin: 8px 0; animation: pulse 1.1s ease-in-out infinite; }
@keyframes pulse { 50% { opacity: .45; } }
@media (prefers-reduced-motion: reduce) { .skel { animation: none; } }
.spin { width: 14px; height: 14px; border: 2px solid var(--line); border-top-color: var(--accent); border-radius: 50%; animation: sp .7s linear infinite; display: inline-block; vertical-align: -2px; }
@keyframes sp { to { transform: rotate(360deg); } }
.brief p { margin: 0 0 3px; font-size: 12.5px; }
.brief h5 { margin: 10px 0 4px; font-size: 11.5px; font-weight: 600; color: var(--fg2); }
.brief ul { margin: 0; padding-left: 16px; font-size: 12.5px; } .brief li { margin: 2px 0; }
.brief .src a { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11.5px; }
.cost { font-size: 11px; color: var(--fg3); margin-top: 8px; }
.off { padding: 8px 0; } .off + .off { border-top: 1px solid var(--line); }
.off .on { display: flex; justify-content: space-between; gap: 8px; align-items: baseline; }
.off .on b { font-weight: 600; font-size: 12.5px; }
.appt { margin: 6px 0 0; padding: 0; list-style: none; }
.appt li { display: flex; justify-content: space-between; gap: 8px; padding: 3px 0; font-size: 12px; align-items: baseline; }
.appt button { border: 0; background: none; padding: 0; color: var(--accent); cursor: pointer; text-align: left; font-size: 12px; min-width: 0; }
.appt button:hover { text-decoration: underline; }
.appt .m { color: var(--fg2); font-size: 11px; white-space: nowrap; }
.set label.f { display: block; font-size: 12px; color: var(--fg2); margin: 10px 0 4px; font-weight: 500; }
.set input[type=password], .set input[type=text], .set select { width: 100%; height: 32px; border: 1px solid var(--line); border-radius: 7px; background: var(--bg); padding: 0 10px; outline: none; }
.set input:focus, .set select:focus { border-color: var(--accent); }
.set .ck { display: flex; gap: 8px; align-items: center; margin: 9px 0; font-size: 12.5px; cursor: pointer; }
.set .ck input { accent-color: var(--accent); margin: 0; }
.set .help { font-size: 11.5px; color: var(--fg3); margin-top: 3px; }
.set .seg { display: flex; border: 1px solid var(--line); border-radius: 7px; overflow: hidden; }
.set .seg label { flex: 1; text-align: center; padding: 6px 0; font-size: 12px; cursor: pointer; }
.set .seg input { display: none; }
.set .seg label:has(input:checked) { background: var(--accent-soft); color: var(--accent); font-weight: 600; }
.saved { color: var(--accent); font-size: 12px; margin-left: 8px; }
.toast { position: absolute; left: 50%; bottom: 14px; transform: translateX(-50%) translateY(8px); background: var(--fg); color: var(--bg); padding: 6px 12px; border-radius: 6px; font-size: 12px;
  opacity: 0; pointer-events: none; transition: opacity 120ms, transform 120ms; white-space: nowrap; }
.toast.show { opacity: 1; transform: translateX(-50%); }
`;

  const ICON = {
    x: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>',
    gear: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="8" r="2.2"/><path d="M8 1.8v1.6M8 12.6v1.6M14.2 8h-1.6M3.4 8H1.8M12.4 3.6l-1.1 1.1M4.7 11.3l-1.1 1.1M12.4 12.4l-1.1-1.1M4.7 4.7L3.6 3.6"/></svg>',
    back: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3L5 8l5 5"/></svg>',
  };

  let host, root, $pill, $panel, $edge, $body, $input, $det, $mode, $toast;
  const st = { open: false, view: 'main', det: null, ctx: null, req: 0, pillText: '', briefState: null };

  function mount() {
    host = document.createElement('prosper-root');
    host.style.cssText = 'all: initial; position: fixed; top: 0; left: 0; width: 0; height: 0; z-index: 2147483647; display: block;';
    const sr = host.attachShadow({ mode: 'open' });
    sr.innerHTML = `<style>${CSS}</style>
<div class="root">
  <div class="pill" part="pill" role="button" tabindex="-1" aria-label="Look up with Prosper (Alt+P)"><span class="p">P</span><span class="t"></span></div>
  <button class="edge" aria-label="Open Prosper" title="Prosper (Alt+P)"><span>P</span></button>
  <aside class="panel" role="dialog" aria-label="Prosper">
    <div class="hd"><div class="logo">P</div><div class="brand">Prosper<small>v${VERSION}</small></div>
      <button class="ib" data-act="settings" title="Settings">${ICON.gear}</button>
      <button class="ib" data-act="close" title="Close (Esc)">${ICON.x}</button></div>
    <div class="sb">
      <div class="det"></div>
      <form class="srow" data-form="search">
        <input type="text" placeholder="Company, email, website, CH number or person" spellcheck="false" autocomplete="off">
        <select title="Search as"><option value="auto">Auto</option><option value="company">Company</option><option value="person">Person</option></select>
        <button class="btn pri" type="submit">Go</button>
      </form>
    </div>
    <div class="body"></div>
    <div class="toast"></div>
  </aside>
</div>`;
    root = sr.querySelector('.root');
    $pill = sr.querySelector('.pill'); $edge = sr.querySelector('.edge'); $panel = sr.querySelector('.panel');
    $body = sr.querySelector('.body'); $input = sr.querySelector('.srow input'); $det = sr.querySelector('.det');
    $mode = sr.querySelector('.srow select'); $toast = sr.querySelector('.toast');
    (document.documentElement || document.body).appendChild(host);

    $pill.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); });
    $pill.addEventListener('click', (e) => { e.stopPropagation(); const t = st.pillText; hidePill(); openWith(t); });
    $edge.addEventListener('click', () => openEmpty());
    sr.querySelector('[data-form=search]').addEventListener('submit', (e) => {
      e.preventDefault(); const v = $input.value.trim(); if (!v) return; st.view = 'main'; lookup(v, $mode.value);
    });
    sr.addEventListener('click', onClick);
    sr.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } }, true);
    updateScope();
  }

  function allowedHere() { return settings.scope !== 'hubspot' || /hubspot/i.test(location.hostname); }
  function updateScope() { if (!$edge) return; $edge.classList.toggle('hide', !allowedHere() || st.open); }

  function placePanel() {
    let top = 12;
    try {
      const x = Math.max(0, window.innerWidth - 200);
      for (const y of [1, 8]) {
        let el = document.elementFromPoint(x, y);
        while (el && el !== document.body && el !== document.documentElement) {
          if (el === host) break;
          const cs = getComputedStyle(el);
          if (cs.position === 'fixed' || cs.position === 'sticky') {
            const r = el.getBoundingClientRect();
            if (r.top <= 2 && r.height > 0 && r.height < 160 && r.width > window.innerWidth * 0.5) top = Math.max(top, Math.round(r.bottom) + 8);
            break;
          }
          el = el.parentElement;
        }
      }
    } catch (e) { /* ignore */ }
    if (top > window.innerHeight * 0.35) top = 12;
    $panel.style.top = top + 'px';
  }

  function open() {
    placePanel();
    st.open = true; $panel.classList.add('open'); updateScope();
  }
  function close() {
    st.open = false; $panel.classList.remove('open'); hidePill(); updateScope();
  }
  function openEmpty() {
    open(); st.view = 'main';
    if (!st.ctx) { $input.value = ''; renderDet(null); renderEmpty(); }
    setTimeout(() => { $input.focus(); $input.select(); }, 30);
  }
  function openWith(text) {
    open();
    st.view = 'main';
    lookup(text, 'auto');
  }

  function showToast(t) {
    $toast.textContent = t; $toast.classList.add('show');
    clearTimeout(showToast.t); showToast.t = setTimeout(() => $toast.classList.remove('show'), 1600);
  }

  /* ---------- selection & pill ---------- */

  function isEditable(el) {
    if (!el) return false;
    const tag = (el.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea' || el.isContentEditable;
  }
  function getSelectionInfo() {
    const ae = document.activeElement;
    if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA') && ae !== host) {
      if (!settings.inInputs) return null;
      try {
        const s = ae.value.substring(ae.selectionStart, ae.selectionEnd);
        if (!s) return null;
        const r = ae.getBoundingClientRect();
        return { text: s, rect: { left: r.left, right: r.right, top: r.top, bottom: r.bottom } };
      } catch (e) { return null; }
    }
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
    const node = sel.anchorNode && (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement);
    if (node && host.contains(node)) return null;
    if (!settings.inInputs && node && node.closest && node.closest('[contenteditable=""],[contenteditable="true"]')) return null;
    const text = sel.toString();
    const range = sel.getRangeAt(0);
    const rects = range.getClientRects();
    const r = rects.length ? rects[rects.length - 1] : range.getBoundingClientRect();
    return { text, rect: r };
  }
  function onSelect(e) {
    if (!allowedHere()) return;
    if (e && e.composedPath && e.composedPath().includes(host)) return;
    setTimeout(() => {
      const info = getSelectionInfo();
      if (!info) return hidePill();
      const t = info.text.replace(/\s+/g, ' ').trim();
      if (t.length < 2 || t.length > 200) return hidePill();
      const d = detect(t);
      if (!d) return hidePill();
      st.pillText = t;
      $pill.querySelector('.t').textContent = d.label;
      const r = info.rect;
      const w = 110;
      let x = Math.min(window.innerWidth - w - 8, Math.max(8, r.right + 6));
      let y = r.bottom + 6;
      if (y + 30 > window.innerHeight) y = Math.max(8, r.top - 32);
      $pill.style.left = x + 'px'; $pill.style.top = y + 'px';
      $pill.classList.add('show');
    }, 10);
  }
  function hidePill() { if ($pill) $pill.classList.remove('show'); }

  /* ---------- lookup flow ---------- */

  function renderDet(det) {
    if (!det) { $det.innerHTML = '<span>Search Companies House, or highlight text on the page.</span>'; return; }
    const cls = det.type === 'chnum' ? 'g' : det.type === 'person' ? '' : det.type === 'freemail' ? 'w' : 'g';
    $det.innerHTML = `<span class="badge ${cls}">${esc(det.label)}</span><q>${esc(det.raw)}</q>`;
  }

  async function lookup(text, forceMode) {
    const det = detect(text) || { raw: text, type: 'company', label: 'Company', query: text, mode: 'company' };
    let mode = det.mode;
    if (forceMode === 'company' && mode !== 'number') { mode = 'company'; det.label = det.type === 'person' ? 'Company' : det.label; }
    if (forceMode === 'person') { mode = 'person'; if (det.type !== 'freemail') det.query = text; }
    $mode.value = forceMode || 'auto';
    st.det = det;
    $input.value = det.type === 'chnum' ? det.number : (det.type === 'email' || det.type === 'domain' || det.type === 'freemail' ? det.raw : det.query);
    renderDet(det);
    const ctx = st.ctx = { det, raw: det.raw, query: det.query, domain: det.domain || '', company: null, candidates: null, brief: null, mode };
    const req = ++st.req;
    if (!chKey()) return renderNoKey();
    renderLoading(mode === 'person' ? 'Searching officers' : 'Looking up Companies House');
    try {
      if (mode === 'number') {
        await showCompany(ctx, det.number, req);
      } else if (mode === 'person') {
        const officers = await findOfficers(ctx.query);
        if (req !== st.req) return;
        ctx.officers = officers;
        renderPerson(ctx);
        officers.slice(0, 3).forEach((o, i) => expandOfficer(ctx, i, req));
      } else if (mode === 'none') {
        renderNone(ctx);
      } else {
        const found = await findCompanies(ctx.query);
        if (req !== st.req) return;
        ctx.candidates = found;
        if (!found.items.length) return renderNoMatch(ctx);
        await showCompany(ctx, found.items[0].number, req);
      }
    } catch (e) { if (req === st.req) renderError(e); }
  }

  async function showCompany(ctx, number, req) {
    renderLoading('Loading company');
    const f = await loadCompany(number);
    if (req !== st.req) return;
    ctx.company = f;
    const hit = cacheGet(`brief:${f.number}:${settings.model}`, TTL_BRIEF);
    ctx.brief = hit ? Object.assign({}, hit.d, { cachedAt: hit.t }) : null;
    st.briefState = null;
    renderCompany(ctx);
  }

  /* ---------- renderers ---------- */

  function renderLoading(msg) {
    $body.innerHTML = `<div class="sec"><div class="sub"><span class="spin"></span>&nbsp; ${esc(msg)}...</div>
      <div class="skel" style="width:70%;height:16px;margin-top:14px"></div><div class="skel" style="width:45%"></div>
      <div class="skel" style="width:100%;height:46px;border-radius:8px"></div><div class="skel" style="width:85%"></div><div class="skel" style="width:60%"></div></div>`;
  }
  function renderEmpty() {
    $body.innerHTML = `<div class="state"><b>Look someone up</b>Highlight a company name, work email, website, Companies House number or person on any page, then click the P pill or press Alt+P.<br><br>Or type above and press Enter.</div>
      ${!chKey() ? '<div class="state" style="padding-top:0"><button class="btn pri" data-act="settings">Add Companies House key</button></div>' : ''}`;
  }
  function renderNoKey() {
    $body.innerHTML = `<div class="state"><b>Companies House API key needed</b>Prosper reads company data straight from Companies House. Get a free key at developer.company-information.service.gov.uk (create an application, then a REST key) and paste it in Settings.
      <br><button class="btn pri" data-act="settings">Open settings</button></div>${linksSection(st.ctx)}`;
  }
  function renderError(e) {
    const code = e && e.code;
    let t, m, act = '';
    if (code === 'ch-nokey') return renderNoKey();
    if (code === 'ch-401') { t = 'Companies House key rejected'; m = 'The API key in Settings was not accepted (401). Check it is a REST key for the live service.'; act = '<button class="btn" data-act="settings">Open settings</button>'; }
    else if (code === 'ch-429') { t = 'Companies House rate limit'; m = 'Too many requests (429). The limit is 600 per 5 minutes; wait a moment and try again.'; act = '<button class="btn" data-act="retry">Retry</button>'; }
    else if (code === 'ch-404') { t = 'Company not found'; m = e.message; }
    else if (code === 'ch-net') { t = 'Could not reach Companies House'; m = 'Check your connection and that the script is allowed to connect to api.company-information.service.gov.uk.'; act = '<button class="btn" data-act="retry">Retry</button>'; }
    else { t = 'Something went wrong'; m = (e && e.message) || String(e); act = '<button class="btn" data-act="retry">Retry</button>'; }
    $body.innerHTML = `<div class="err"><b>${esc(t)}</b><div>${esc(m)}</div>${act}</div>${linksSection(st.ctx)}`;
  }
  function renderNoMatch(ctx) {
    $body.innerHTML = `<div class="state"><b>No Companies House match</b>Nothing found for "${esc(ctx.query)}". Try the full registered name, or search as a person.
      <br><button class="btn" data-act="as-person">Search as person</button></div>${linksSection(ctx)}`;
  }
  function renderNone(ctx) {
    $body.innerHTML = `<div class="state"><b>Personal email address</b>${esc(ctx.raw)} is a free email provider, so there is no company domain to look up. Use the links below or type a company name above.</div>${linksSection(ctx)}`;
  }

  function linksSection(ctx) {
    if (!ctx) return '';
    return `<div class="sec"><h4>Quick links <span class="ct">1-6, 0 opens all</span></h4><div class="links">${PROVIDERS.map((p, i) => `
      <button class="lk" data-act="link" data-id="${p.id}" title="${esc(p.name)} (${i + 1})"><img alt="" src="https://www.google.com/s2/favicons?domain=${p.fav}&sz=32" data-fb="${esc(p.name[0])}"><span class="nm">${esc(p.short || p.name)}</span><kbd>${i + 1}</kbd></button>`).join('')}
    </div><div class="row" style="margin-top:6px"><button class="btn sm" data-act="link-all">Open all (0)</button><span class="hint" style="margin:0">${settings.background ? 'Opens in background tabs' : 'Opens in new tabs'}</span></div></div>`;
  }

  function pickerHtml(ctx) {
    const c = ctx.candidates;
    if (!c || c.items.length < 2 || (!c.ambiguous && c.matched)) return '';
    const cur = ctx.company && ctx.company.number;
    const others = c.items.length - 1;
    const stBadge = (s) => s === 'active' ? '<span class="badge g">Active</span>' : `<span class="badge r">${esc(label('company_status', s) || s || 'Unknown')}</span>`;
    return `<details class="picker" ${c.ambiguous ? 'open' : ''}><summary><span>${c.ambiguous ? 'Not the right one? ' : ''}Other matches (${others})</span><span>${c.matched ? '' : 'best guess'}</span></summary>
      <div class="opts">${c.items.map((it) => `<button class="opt ${it.number === cur ? 'cur' : ''}" data-act="pick" data-num="${esc(it.number)}"><span class="n">${esc(titleCase(it.name))}
        <small>${esc(it.number)}${it.formerExact ? ' · formerly ' + esc(titleCase(it.formerly.find((f) => alphaKey(f) === c.qk) || '')) : ''}${it.address ? ' · ' + esc(it.address) : ''}</small></span>${stBadge(it.status)}</button>`).join('')}</div>
    </details>`;
  }

  function renderCompany(ctx) {
    const f = ctx.company;
    const vcls = f.verdict === 'ok' ? '' : f.verdict;
    const reasons = f.caution.concat(f.check);
    const also = f.also.slice();
    if (ctx.candidates) {
      const sibling = ctx.candidates.items.find((it) => it.number !== f.number && (it.exact || it.formerExact) && it.status !== 'active' && it.status !== 'dissolved');
      if (sibling) also.push(`${titleCase(sibling.name)} (${sibling.number}) also matches "${ctx.query}" and is ${label('company_status', sibling.status).toLowerCase()}: check you have the right company`);
    }
    const statusBadge = f.status === 'active' ? 'g' : 'r';
    const ov = '<span class="ovd">OVERDUE</span>';
    let html = `<div class="sec">
      <div class="title">${esc(f.display)}</div>
      <div class="sub">${esc(f.number)} · <span class="badge ${statusBadge}">${esc(f.statusLabel)}</span>${f.statusDetail ? ' <span class="badge r">' + esc(f.statusDetail) + '</span>' : ''}</div>
      <div class="verdict ${vcls}"><div class="vl">${verdictLabel(f.verdict)}</div><div>${reasons.length ? `<ul>${reasons.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>` : '<ul><li>Active, filings up to date, officers in place.</li></ul>'}
      ${also.length ? `<div class="also"><b>Also:</b> ${also.map(esc).join(' · ')}</div>` : ''}</div></div>
      <div class="hint">Quick check is based on Companies House data only.</div>
      ${pickerHtml(ctx)}
    </div>
    <div class="sec"><dl class="kv">
      <dt>Type</dt><dd>${esc(f.type)}</dd>
      <dt>Incorporated</dt><dd>${esc(fmtDate(f.created))} <span class="sub">(${esc(ageText(f.created))})</span></dd>
      ${f.ceased ? `<dt>Ceased</dt><dd>${esc(fmtDate(f.ceased))}</dd>` : ''}
      <dt>Registered office</dt><dd>${esc(f.address || 'Not available')}</dd>
      <dt>SIC</dt><dd>${f.sic.length ? f.sic.map((s) => `<div>${esc(s.code)}${s.desc ? ' <span class="sub">' + esc(s.desc) + '</span>' : ''}</div>`).join('') : 'None listed'}</dd>
      ${f.previousNames.length ? `<dt>Previous names</dt><dd>${f.previousNames.slice(0, 4).map((n) => `<div>${esc(n.name)} <span class="sub">until ${esc(fmtDate(n.to))}</span></div>`).join('')}${f.previousNames.length > 4 ? `<div class="sub">+${f.previousNames.length - 4} more</div>` : ''}</dd>` : ''}
      <dt>Accounts</dt><dd>Last made up to ${esc(fmtDate(f.accounts.lastMadeUp) || 'none filed')}${f.accounts.lastType ? ' <span class="sub">(' + esc(f.accounts.lastType) + ')</span>' : ''}<br>Next due ${esc(fmtDate(f.accounts.nextDue) || 'n/a')}${f.accounts.overdue ? ov : ''}</dd>
      <dt>Confirmation</dt><dd>Last ${esc(fmtDate(f.cs.last) || 'n/a')}<br>Next due ${esc(fmtDate(f.cs.nextDue) || 'n/a')}${f.cs.overdue ? ov : ''}</dd>
      <dt>Charges</dt><dd>${f.charges.known ? (f.charges.total ? `${f.charges.outstanding} outstanding of ${f.charges.total}` : 'None registered') : 'Unknown'}</dd>
    </dl>
    <div class="row" style="margin-top:10px">
      <button class="btn sm" data-act="copy-num">Copy number</button>
      <button class="btn sm" data-act="copy-addr">Copy address</button>
      <button class="btn sm pri" data-act="copy-note">Copy HubSpot note</button>
      <a class="btn sm" style="display:inline-flex;align-items:center" href="${esc(f.url)}" data-act="ch-page" target="_blank" rel="noopener">CH page</a>
    </div></div>`;

    if (f.insolvency.length) {
      html += `<div class="sec"><h4>Insolvency <span class="ct">${f.insolvency.length} case${f.insolvency.length === 1 ? '' : 's'}</span></h4><ul class="list">${f.insolvency.map((c) => `<li><span class="n">${esc(c.type)}<small>${esc(c.dates)}</small></span></li>`).join('')}</ul></div>`;
    }
    html += `<div class="sec"><h4>Current officers <span class="ct">${f.officersKnown ? f.officers.length : '?'}</span></h4>${f.officers.length ? `<ul class="list">${f.officers.slice(0, 12).map((o) => `<li><span class="n">${esc(o.name)}<small>${esc(o.role)}</small></span><span class="m">since ${esc(fmtDate(o.appointed))}</span></li>`).join('')}</ul>${f.officers.length > 12 ? `<div class="hint">+${f.officers.length - 12} more on Companies House</div>` : ''}` : `<div class="sub">${f.officersKnown ? 'No current officers listed.' : 'Officer list unavailable.'}</div>`}</div>`;
    html += `<div class="sec"><h4>Last 12 months <span class="ct">${f.recent.length} change${f.recent.length === 1 ? '' : 's'}</span></h4>${f.recent.length ? `<ul class="list">${f.recent.slice(0, 10).map((r) => `<li><span class="n">${esc(r.text)}</span><span class="m">${esc(fmtDate(r.date))}</span></li>`).join('')}</ul>` : '<div class="sub">No officer or name changes.</div>'}</div>`;
    html += `<div class="sec"><h4>People with significant control <span class="ct">${f.pscs.length}</span></h4>${f.pscs.length ? `<ul class="list">${f.pscs.map((p) => `<li><span class="n">${esc(p.name)}<small>${esc(p.kind)}${p.control ? ' · ' + esc(p.control) : ''}</small></span></li>`).join('')}</ul>` : `<div class="sub">${f.pscKnown ? 'None listed (may be exempt or a statement filed).' : 'Not available.'}</div>`}</div>`;
    html += `<div class="sec brief" data-sec="brief">${briefHtml(ctx)}</div>`;
    html += linksSection(ctx);
    $body.innerHTML = html;
    $body.scrollTop = 0;
    wireFavicons();
  }

  function briefHtml(ctx) {
    const b = ctx.brief, s = st.briefState;
    const model = MODELS[settings.model] ? settings.model : DEFAULTS.model;
    let h = `<h4>AI brief <span class="ct">${esc(MODELS[model].label.replace(/\s*\(.*\)$/, ''))} + web search</span></h4>`;
    if (s && s.loading) return h + '<div class="sub"><span class="spin"></span>&nbsp; Researching (usually 10-30s)...</div><div class="skel" style="width:90%"></div><div class="skel" style="width:75%"></div><div class="skel" style="width:82%"></div>';
    if (s && s.error) {
      const needKey = s.error.code === 'cl-nokey' || s.error.code === 'cl-401';
      h += `<div class="err" style="margin:0 0 8px"><b>${s.error.code === 'cl-nokey' ? 'Claude API key needed' : 'Brief failed'}</b><div>${esc(s.error.code === 'cl-nokey' ? 'Add an Anthropic API key in Settings to generate briefs.' : s.error.message)}</div></div>
        <div class="row">${needKey ? '<button class="btn sm pri" data-act="settings">Open settings</button>' : ''}<button class="btn sm" data-act="brief">Try again</button></div>`;
      return h;
    }
    if (!b) {
      const p = MODELS[model];
      const est = (22000 * p.inM + 2300 * p.outM) / 1e6 + 2 * SEARCH_COST;
      return h + `<div class="sub" style="margin-bottom:8px">What they do, recent signals and talking points, grounded in the Companies House facts above.</div>
        <div class="row"><button class="btn sm pri" data-act="brief">Generate brief</button><span class="hint" style="margin:0">about $${est.toFixed(3)} per brief</span></div>`;
    }
    h += b.what.map((w) => `<p>${esc(w)}</p>`).join('');
    h += `<h5>Recent signals</h5>${b.signals.length ? `<ul>${b.signals.map((x) => `<li>${esc(x.text)}${x.date ? ' <span class="sub">' + esc(x.date) + '</span>' : ''}${x.url ? ` <a href="${esc(x.url)}" target="_blank" rel="noopener">source</a>` : ''}</li>`).join('')}</ul>` : '<div class="sub">Nothing reliable found.</div>'}`;
    h += `<h5>Talking points</h5><ul>${b.talking.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`;
    if (b.sources.length) h += `<h5>Sources</h5><div class="src">${b.sources.map((x) => `<a href="${esc(x.url)}" target="_blank" rel="noopener" title="${esc(x.title || x.url)}">${esc(x.title || x.url)}</a>`).join('')}</div>`;
    const when = b.cachedAt ? `cached ${Math.max(1, Math.round((Date.now() - b.cachedAt) / 60000))} min ago` : 'just now';
    h += `<div class="cost">${b.estPrice ? 'Estimated' : 'Cost'} $${b.cost.toFixed(4)} · ${b.usage.input.toLocaleString()} in / ${b.usage.output.toLocaleString()} out tokens · ${b.usage.searches} search${b.usage.searches === 1 ? '' : 'es'} · ${when}${b.confidence ? ' · confidence ' + esc(b.confidence) : ''}</div>
      <div class="row" style="margin-top:6px"><button class="btn sm" data-act="brief-regen">Regenerate</button></div>`;
    return h;
  }
  function rerenderBrief() { const el = $body.querySelector('[data-sec=brief]'); if (el && st.ctx) el.innerHTML = briefHtml(st.ctx); }

  async function doBrief(force) {
    const ctx = st.ctx; if (!ctx || !ctx.company) return;
    if (st.briefState && st.briefState.loading) return;
    st.briefState = { loading: true }; rerenderBrief();
    try {
      const b = await runBrief(ctx.company, ctx.domain, force);
      if (st.ctx !== ctx) return;
      ctx.brief = b; st.briefState = null;
    } catch (e) { if (st.ctx !== ctx) return; st.briefState = { error: e }; }
    rerenderBrief();
  }

  function renderPerson(ctx) {
    const list = ctx.officers || [];
    if (!list.length) {
      $body.innerHTML = `<div class="state"><b>No officers found</b>No Companies House officers match "${esc(ctx.query)}".<br><button class="btn" data-act="as-company">Search as company</button></div>${linksSection(ctx)}`;
      return;
    }
    $body.innerHTML = `<div class="sec"><h4>Officers matching "${esc(ctx.query)}" <span class="ct">${list.length}</span></h4>
      ${list.map((o, i) => `<div class="off" data-off="${i}"><div class="on"><b>${esc(officerName(o.name.replace(/^(.*) ([A-Z'\-]+)$/, '$2, $1')) || o.name)}</b><span class="sub">${o.count != null ? o.count + ' appt' + (o.count === 1 ? '' : 's') : ''}</span></div>
        <div class="sub">${o.dob ? 'Born ' + esc(o.dob) + ' · ' : ''}${esc(o.address || '')}</div><div class="ap"><button class="btn sm" style="margin-top:5px" data-act="appts" data-i="${i}">Show appointments</button></div></div>`).join('')}
      <div class="hint">Officer matches are by name only; check date of birth and address.</div></div>${linksSection(ctx)}`;
    wireFavicons();
  }
  async function expandOfficer(ctx, i, req) {
    const o = ctx.officers && ctx.officers[i]; if (!o || !o.link) return;
    const slot = () => $body.querySelector(`[data-off="${i}"] .ap`);
    if (slot()) slot().innerHTML = '<div class="sub" style="margin-top:4px"><span class="spin"></span> Loading appointments...</div>';
    try {
      const appts = await loadAppointments(o.link);
      if (req != null && req !== st.req) return; if (!slot()) return;
      slot().innerHTML = `<ul class="appt">${appts.slice(0, 15).map((a) => `<li><button data-act="open-co" data-num="${esc(a.number)}">${esc(a.company)}</button><span class="m">${esc(a.role)} · ${a.resigned ? 'resigned ' + esc(fmtDate(a.resigned)) : esc(label('company_status', a.status) || '')}</span></li>`).join('')}</ul>${appts.length > 15 ? `<div class="hint">+${appts.length - 15} more</div>` : ''}`;
    } catch (e) { if (slot()) slot().innerHTML = `<div class="sub">Could not load appointments (${esc(e.code || e.message)}).</div>`; }
  }

  function wireFavicons() {
    $body.querySelectorAll('.lk img').forEach((img) => {
      img.addEventListener('error', () => { const s = document.createElement('span'); s.className = 'fb'; s.textContent = img.dataset.fb || '?'; img.replaceWith(s); }, { once: true });
    });
  }

  /* ---------- settings ---------- */

  function renderSettings() {
    const hasCh = !!chKey(), hasCl = !!claudeKey();
    $body.innerHTML = `<div class="sec set"><div class="row" style="justify-content:space-between"><h4 style="margin:0">Settings</h4><button class="btn sm" data-act="back">${'Back'}</button></div>
      <label class="f" for="p-ch">Companies House API key</label>
      <input id="p-ch" type="password" autocomplete="off" spellcheck="false" placeholder="${hasCh ? 'Saved. Paste a new key to replace' : 'Paste your REST API key'}">
      <div class="help">${hasCh ? 'Key saved.' : 'Free from developer.company-information.service.gov.uk.'} Stored in Tampermonkey storage, never in the script.</div>
      <label class="f" for="p-cl">Anthropic (Claude) API key</label>
      <input id="p-cl" type="password" autocomplete="off" spellcheck="false" placeholder="${hasCl ? 'Saved. Paste a new key to replace' : 'sk-ant-... (only needed for AI briefs)'}">
      <div class="help">${hasCl ? 'Key saved.' : 'Optional. From console.anthropic.com.'}</div>
      <label class="f" for="p-model">AI brief model</label>
      <select id="p-model">${Object.keys(MODELS).map((m) => `<option value="${m}" ${settings.model === m ? 'selected' : ''}>${esc(MODELS[m].label)}</option>`).join('')}</select>
      <label class="ck"><input type="checkbox" id="p-bg" ${settings.background ? 'checked' : ''}> Open links in background tabs</label>
      <label class="ck"><input type="checkbox" id="p-inp" ${settings.inInputs ? 'checked' : ''}> Show the pill when selecting inside text fields</label>
      <label class="f">Run on</label>
      <div class="seg"><label><input type="radio" name="p-scope" value="all" ${settings.scope !== 'hubspot' ? 'checked' : ''}>All sites</label><label><input type="radio" name="p-scope" value="hubspot" ${settings.scope === 'hubspot' ? 'checked' : ''}>HubSpot only</label></div>
      <div class="help">With HubSpot only, the pill and edge tab only appear on hubspot domains. The Tampermonkey menu can still open Prosper anywhere.</div>
      <div class="row" style="margin-top:14px"><button class="btn pri" data-act="save">Save</button><span class="saved" hidden>Saved</span></div>
      <div class="row" style="margin-top:14px;padding-top:12px;border-top:1px solid var(--line)">
        <button class="btn sm" data-act="clear-cache">Clear cache</button>
        ${hasCh ? '<button class="btn sm" data-act="forget-ch">Remove CH key</button>' : ''}
        ${hasCl ? '<button class="btn sm" data-act="forget-cl">Remove Claude key</button>' : ''}
      </div>
      <div class="help" style="margin-top:10px">Shortcuts: Alt+P open, Esc close, 1-6 quick links, 0 open all, C copy HubSpot note. Companies House data cached 10 min, briefs 24 h.</div>
    </div>`;
    $body.scrollTop = 0;
  }
  function toggleSettings(force) {
    const show = force != null ? force : st.view !== 'settings';
    st.view = show ? 'settings' : 'main';
    root.querySelector('[data-act=settings]').classList.toggle('on', show);
    if (show) { if (!st.open) open(); renderSettings(); }
    else restoreMain();
  }
  function restoreMain() {
    const ctx = st.ctx;
    root.querySelector('[data-act=settings]').classList.remove('on');
    if (!ctx) return renderEmpty();
    if (ctx.company) return renderCompany(ctx);
    lookup(ctx.det.raw, $mode.value);
  }
  function saveFromForm() {
    const q = (s) => $body.querySelector(s);
    const chv = q('#p-ch').value.trim(), clv = q('#p-cl').value.trim();
    if (chv) sv(K.chKey, chv);
    if (clv) sv(K.claudeKey, clv);
    settings.model = q('#p-model').value;
    settings.background = q('#p-bg').checked;
    settings.inInputs = q('#p-inp').checked;
    const sc = $body.querySelector('input[name=p-scope]:checked'); settings.scope = sc ? sc.value : 'all';
    saveSettings(); updateScope();
    renderSettings();
    const s = $body.querySelector('.saved'); if (s) s.hidden = false;
    showToast('Settings saved');
  }

  /* ---------- actions ---------- */

  function onClick(e) {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act, ctx = st.ctx;
    switch (act) {
      case 'close': close(); break;
      case 'settings': toggleSettings(); break;
      case 'back': toggleSettings(false); break;
      case 'save': saveFromForm(); break;
      case 'clear-cache': clearCache(); ENUMS = null; showToast('Cache cleared'); break;
      case 'forget-ch': dv(K.chKey); renderSettings(); showToast('Companies House key removed'); break;
      case 'forget-cl': dv(K.claudeKey); renderSettings(); showToast('Claude key removed'); break;
      case 'retry': if (ctx) lookup(ctx.det.raw, $mode.value); break;
      case 'as-person': if (ctx) lookup(ctx.det.type === 'person' ? ctx.query : ctx.raw, 'person'); break;
      case 'as-company': if (ctx) lookup(ctx.raw, 'company'); break;
      case 'pick': if (ctx) { e.preventDefault(); const req = ++st.req; showCompany(ctx, el.dataset.num, req).catch((er) => req === st.req && renderError(er)); } break;
      case 'open-co': {
        const num = el.dataset.num; if (!num) break;
        lookup(num, 'auto');
        break;
      }
      case 'appts': if (ctx) expandOfficer(ctx, +el.dataset.i, st.req); break;
      case 'link': if (ctx) openTab(linkFor(el.dataset.id, ctx)); break;
      case 'link-all': openAll(); break;
      case 'ch-page': e.preventDefault(); if (ctx && ctx.company) openTab(ctx.company.url); break;
      case 'copy-num': if (ctx && ctx.company) copyText(ctx.company.number).then(() => showToast('Company number copied')); break;
      case 'copy-addr': if (ctx && ctx.company) copyText(ctx.company.address).then(() => showToast('Address copied')); break;
      case 'copy-note': copyNote(); break;
      case 'brief': doBrief(false); break;
      case 'brief-regen': doBrief(true); break;
    }
  }
  function openAll() { const ctx = st.ctx; if (!ctx) return; PROVIDERS.forEach((p) => openTab(linkFor(p.id, ctx), true)); showToast('Opened 6 tabs'); }
  function copyNote() { const ctx = st.ctx; if (!ctx || !ctx.company) return; copyText(hubspotNote(ctx.company, ctx.brief)).then(() => showToast('HubSpot note copied')); }

  function onKey(e) {
    if (e.altKey && !e.ctrlKey && !e.metaKey && (e.code === 'KeyP' || (e.key || '').toLowerCase() === 'p')) {
      if (!allowedHere()) return;
      e.preventDefault(); e.stopPropagation();
      const info = getSelectionInfo();
      const t = info ? info.text.replace(/\s+/g, ' ').trim() : '';
      hidePill();
      if (t.length >= 2 && t.length <= 200) openWith(t);
      else if (st.open && !(e.composedPath && e.composedPath().includes(host))) close();
      else openEmpty();
      return;
    }
    if (!st.open) { if (e.key === 'Escape') hidePill(); return; }
    if (e.key === 'Escape') { close(); return; }
    const path = e.composedPath ? e.composedPath() : [e.target];
    const inOurPanel = path.includes(host);
    const target = path[0];
    if (isEditable(target) || (target && target.tagName === 'SELECT')) return;
    if (!inOurPanel && isEditable(document.activeElement)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (st.view === 'settings' || !st.ctx) return;
    if (/^[1-6]$/.test(e.key)) { e.preventDefault(); openTab(linkFor(PROVIDERS[+e.key - 1].id, st.ctx)); }
    else if (e.key === '0') { e.preventDefault(); openAll(); }
    else if ((e.key === 'c' || e.key === 'C') && st.ctx.company) { e.preventDefault(); copyNote(); }
  }

  /* ------------------------------------------------------------------ */
  /* Boot                                                               */
  /* ------------------------------------------------------------------ */

  function boot() {
    if (!document.documentElement) return;
    mount();
    document.addEventListener('mouseup', onSelect, true);
    document.addEventListener('keyup', (e) => { if (e.shiftKey || e.key === 'Shift') onSelect(e); }, true);
    document.addEventListener('dblclick', onSelect, true);
    document.addEventListener('selectionchange', debounce(() => {
      const s = window.getSelection(); if ((!s || s.isCollapsed) && !(document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName))) hidePill();
    }, 120));
    document.addEventListener('mousedown', (e) => { if (!(e.composedPath && e.composedPath().includes(host))) hidePill(); }, true);
    window.addEventListener('scroll', debounce(hidePill, 30), { passive: true, capture: true });
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', debounce(() => { if (st.open) placePanel(); }, 100));
    try {
      if (typeof GM_registerMenuCommand === 'function') {
        GM_registerMenuCommand('Open Prosper', () => openEmpty());
        GM_registerMenuCommand('Prosper settings', () => toggleSettings(true));
      }
    } catch (e) { /* ignore */ }
    try {
      if (typeof GM_addValueChangeListener === 'function') {
        GM_addValueChangeListener(K.settings, (n, o, v, remote) => { if (remote) { settings = Object.assign({}, DEFAULTS, readJSON(v) || {}); updateScope(); } });
      }
    } catch (e) { /* ignore */ }
    setTimeout(() => { pruneCache(); loadEnums().catch(() => null); }, 1500);
  }

  // Exposed for automated tests only (no secrets).
  window.__prosperTest = { detect, alphaKey, companyLabelFromDomain, hubspotNote: () => st.ctx && st.ctx.company ? hubspotNote(st.ctx.company, st.ctx.brief) : '', state: () => st };

  boot();
})();
