// Prosper contact-details pipeline (prototype). Node 18+, no dependencies.
// Finds the business contact details a UK company publishes about itself.
//   Stage 1  Companies House: profile, registered office.
//   Stage 2  The company's own website: find it, prove it is theirs, extract published phone/email/address.
//   Stage 3  Optional Serper web search to find the website when guessing fails (costs credits).
// Keys come from the caller or env (CH_KEY, SERPER_KEY). Nothing is logged except URLs fetched.
'use strict';

const UA = 'ProsperContacts/0.1 (+https://wills.im/pson/prosper/app/test/contacts/)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Stage 1: Companies House ----------
function chClient(key, gapMs = 600) {
  const auth = 'Basic ' + Buffer.from(key + ':').toString('base64'); let last = 0;
  return async (path) => {
    const w = Math.max(0, last + gapMs - Date.now()); if (w) await sleep(w); last = Date.now();
    const r = await fetch('https://api.company-information.service.gov.uk' + path, { headers: { Authorization: auth, Accept: 'application/json' } });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error('Companies House ' + r.status);
    return r.json();
  };
}
async function stage1(ch, number) {
  const p = await ch('/company/' + encodeURIComponent(number));
  if (!p) throw new Error('No such company ' + number);
  const ro = p.registered_office_address || {};
  return {
    number: p.company_number, name: p.company_name, status: p.company_status, type: p.type,
    incorporated: p.date_of_creation, sic: p.sic_codes || [],
    office: { line1: ro.address_line_1 || '', line2: ro.address_line_2 || '', town: ro.locality || '', postcode: (ro.postal_code || '').toUpperCase(), premises: ro.premises || '' },
    source: 'https://find-and-update.company-information.service.gov.uk/company/' + p.company_number,
  };
}

// ---------- Polite fetching ----------
const hostLast = new Map(); const robotsCache = new Map();
const HOST_GAP = 1500, TIMEOUT = 9000, MAX_BYTES = 1.5e6;
async function rawGet(url) {
  const host = new URL(url).host; const w = Math.max(0, (hostLast.get(host) || 0) + HOST_GAP - Date.now());
  if (w) await sleep(w); hostLast.set(host, Date.now());
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), TIMEOUT);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html,text/plain;q=0.9' }, redirect: 'follow', signal: ac.signal });
    const type = r.headers.get('content-type') || ''; let body = '';
    if (r.ok && /html|text/.test(type)) { body = await r.text(); if (body.length > MAX_BYTES) body = body.slice(0, MAX_BYTES); }
    return { ok: r.ok, status: r.status, url: r.url || url, body, type };
  } catch (e) { return { ok: false, status: 0, url, body: '', error: e.name === 'AbortError' ? 'timeout' : e.message }; }
  finally { clearTimeout(t); }
}
// Minimal robots.txt: groups for our agent or *, Disallow/Allow prefixes, longest match wins.
function parseRobots(txt) {
  const groups = []; let cur = null, lastWasAgent = false;
  for (let line of txt.split(/\r?\n/)) {
    line = line.replace(/#.*/, '').trim(); const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i); if (!m) continue;
    const k = m[1].toLowerCase(), v = m[2].trim();
    if (k === 'user-agent') { if (!lastWasAgent) { cur = { agents: [], rules: [] }; groups.push(cur); } cur.agents.push(v.toLowerCase()); lastWasAgent = true; }
    else { lastWasAgent = false; if (cur && (k === 'disallow' || k === 'allow')) cur.rules.push({ allow: k === 'allow', path: v }); }
  }
  const mine = groups.filter((g) => g.agents.some((a) => a !== '*' && 'prospercontacts'.includes(a)));
  const rules = (mine.length ? mine : groups.filter((g) => g.agents.includes('*'))).flatMap((g) => g.rules);
  return (path) => {
    let best = null;
    for (const r of rules) { if (!r.path) continue; const re = new RegExp('^' + r.path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'));
      if (re.test(path) && (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.allow))) best = r; }
    return !best || best.allow;
  };
}
async function allowed(url) {
  const u = new URL(url); const origin = u.origin;
  if (!robotsCache.has(origin)) {
    const r = await rawGet(origin + '/robots.txt');
    robotsCache.set(origin, r.ok && r.body && !/<html/i.test(r.body.slice(0, 500)) ? parseRobots(r.body) : r.status >= 500 ? () => false : () => true);
  }
  return robotsCache.get(origin)(u.pathname + u.search);
}
async function politeGet(url, log) {
  if (!(await allowed(url))) { log.push({ url, skipped: 'robots.txt' }); return null; }
  const r = await rawGet(url); log.push({ url, status: r.status, error: r.error }); return r.ok ? r : null;
}

// ---------- Text helpers ----------
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', pound: '£', copy: '©' };
const decode = (s) => s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENT[e.toLowerCase()] ?? m);
const textOf = (html) => decode(html.replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, ' ').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|h\d|tr|address|footer|section)>/gi, '\n').replace(/<[^>]+>/g, ' ')).replace(/[ \t\u00a0]+/g, ' ').replace(/\n\s*/g, '\n');
const norm = (s) => s.toUpperCase().replace(/&/g, ' AND ').replace(/[^A-Z0-9]+/g, ' ').trim();
const SUFFIX = /\b(LIMITED|LTD|PLC|LLP|L L P|CIC|COMMUNITY INTEREST COMPANY|CO|COMPANY|UK|GB)\b/g;
const baseName = (n) => norm(n).replace(SUFFIX, ' ').replace(/\s+/g, ' ').trim();
const PC = /\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b/g;
const pcNorm = (p) => p.toUpperCase().replace(/\s+/g, '').replace(/^(.+)(\d[A-Z]{2})$/, '$1 $2');

// One address per postcode: trim sentences down to the address, prefer short ones that start with a number or name.
function tidyAddress(a) {
  let v = a.value; const i = v.toUpperCase().lastIndexOf(a.postcode.split(' ')[0]);
  if (v.length > 90 && i > 0) { const pre = v.slice(0, i); const cut = Math.max(pre.lastIndexOf(' is '), pre.lastIndexOf(': '), pre.lastIndexOf('. ')); v = (cut > 0 ? pre.slice(cut + (pre[cut + 1] === 'i' ? 4 : 2)) : pre.slice(-70)).trim() + ' ' + a.postcode; }
  v = v.replace(/^(postal address|address|registered address|registered office)\s*:?\s*/i, '').replace(/\s*,[\s,]*/g, ', ').trim();
  return { ...a, value: v };
}
function bestAddresses(list) {
  const by = new Map();
  const score = (v) => (/^\s*(\d|unit|studio|flat|suite|[A-Z][a-z]+ (House|Court|Lodge|Building))/i.test(v) ? 0 : 10) + Math.abs(v.length - 50) / 10;
  for (const a0 of list) { const a = tidyAddress(a0); const cur = by.get(a.postcode); if (!cur || score(a.value) < score(cur.value)) by.set(a.postcode, a); }
  return [...by.values()];
}

// ---------- Stage 2: website ----------
function guessDomains(name) {
  const words = baseName(name).toLowerCase().split(' ').filter(Boolean);
  if (!words.length) return [];
  const joined = words.join(''), hy = words.join('-'), noAnd = words.filter((w) => w !== 'and').join('');
  const out = [];
  for (const b of [...new Set([joined, noAnd, hy])]) for (const tld of ['.co.uk', '.com', '.uk']) out.push('https://www.' + b + tld + '/');
  return out.slice(0, 7);
}
async function serperSearch(key, q) {
  const r = await fetch('https://google.serper.dev/search', { method: 'POST', headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' }, body: JSON.stringify({ q, gl: 'uk', num: 10 }) });
  if (!r.ok) throw new Error('Serper ' + r.status);
  const j = await r.json();
  const skip = /companieshouse|company-information|find-and-update|endole|companycheck|opencorporates|bizdb|yell\.|linkedin|facebook|instagram|twitter|x\.com|tiktok|youtube|checkatrade|trustpilot|indeed|glassdoor|wikipedia|gov\.uk|192\.com|duedil|creditsafe|dnb\.com/i;
  return (j.organic || []).map((o) => o.link).filter((l) => !skip.test(l)).map((l) => new URL(l).origin + '/').filter((v, i, a) => a.indexOf(v) === i).slice(0, 3);
}
const LINK_RX = /(contact|about|get-in-touch|find-us|office|studio|location|privacy|terms|legal|imprint|company-info)/i;
function linksFrom(html, base) {
  const out = []; const rx = /<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi; let m;
  while ((m = rx.exec(html))) {
    try { const u = new URL(decode(m[1]), base); if (u.origin !== new URL(base).origin) continue;
      const label = textOf(m[2]).trim(); if (LINK_RX.test(u.pathname) || LINK_RX.test(label)) out.push(u.origin + u.pathname); } catch (e) {}
  }
  const rank = (u) => /contact|get-in-touch|find-us|office|location/i.test(u) ? 0 : /privacy|terms|legal|imprint|company-info/i.test(u) ? 1 : 2;
  return [...new Set(out)].sort((a, b) => rank(a) - rank(b));
}
function proofOn(text, html, co) {
  const T = norm(text), proofs = [];
  const num = co.number.replace(/^0+/, '');
  if (new RegExp('\\b0*' + num + '\\b').test(text.replace(/\s+/g, '')) || new RegExp('\\b' + co.number + '\\b').test(text)) proofs.push('company number ' + co.number);
  const legal = norm(co.name);
  if (T.includes(legal) || T.includes(legal.replace(/\bLIMITED\b/, 'LTD'))) proofs.push('legal name “' + co.name + '”');
  if (co.office.postcode && T.replace(/\s/g, '').includes(co.office.postcode.replace(/\s/g, ''))) proofs.push('registered office postcode ' + co.office.postcode);
  const base = baseName(co.name); const two = base.split(' ').slice(0, 2).join(' ');
  const brand = (base.length >= 5 && T.includes(base)) || (two.length >= 8 && two.includes(' ') && T.includes(two));
  return { proofs, brand };
}
const GENERIC = /^(info|hello|enquiries|enquiry|sales|office|admin|contact|contactus|mail|bookings|booking|reception|accounts|support|team|studio|general|help|service|services|orders|shop|jobs|careers|hr|press|media|marketing|events|reservations|quotes|estimates|lettings|design|projects)$/i;
function extract(html, text, pageUrl, siteHost) {
  const phones = [], emails = [], addresses = []; let personalSkipped = 0;
  const pushPhone = (raw) => { let d = raw.replace(/[^\d+]/g, '').replace(/^\+44(0)?/, '0').replace(/^0044/, '0');
    if (/^0[1237]\d{8,9}$/.test(d) || /^08\d{8,9}$/.test(d)) { if (/^07/.test(d)) return; // mobiles are often personal: skip
      if (/0{6}|123456|(\d)\1{6}/.test(d.slice(1))) return; // placeholders such as 0800 000 0000
      const f = d.length !== 11 ? d : /^02/.test(d) ? d.replace(/^(\d{3})(\d{4})(\d{4})$/, '$1 $2 $3')
        : /^0(1\d1|11\d|[389])/.test(d) ? d.replace(/^(\d{4})(\d{3})(\d{4})$/, '$1 $2 $3') : d.replace(/^(\d{5})(\d{6})$/, '$1 $2');
      if (!phones.some((p) => p.value.replace(/\s/g, '') === d)) phones.push({ value: f, source: pageUrl }); } };
  for (const m of html.matchAll(/href\s*=\s*["']tel:([^"']+)["']/gi)) pushPhone(decodeURIComponent(m[1]));
  for (const m of text.matchAll(/(?:\+44\s?\(?0?\)?\s?|\b0)\d(?:[ -]?\d){8,9}(?!\d)/g)) pushPhone(m[0]);
  const em = new Set();
  for (const m of html.matchAll(/mailto:([^"'?\s>]+)/gi)) em.add(decodeURIComponent(m[1]).toLowerCase());
  for (const m of text.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)) em.add(m[0].toLowerCase());
  for (const e of em) {
    const [local, dom] = e.split('@'); if (!dom || /\.(png|jpg|gif|webp|svg)$/.test(dom) || /sentry|wixpress|example\.|domain\.com/.test(dom)) continue;
    if (GENERIC.test(local)) { if (!emails.some((x) => x.value === e)) emails.push({ value: e, source: pageUrl, sameDomain: siteHost.endsWith(dom.replace(/^www\./, '')) }); }
    else personalSkipped++; // named-person addresses are personal data: not collected
  }
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  lines.forEach((l, i) => { for (const m of l.matchAll(PC)) {
    let a = l.length > 25 ? l : [lines[i - 2], lines[i - 1], l].filter((x) => x && x.length < 60).join(', ');
    a = a.replace(/^(address|registered office|find us|visit us)\s*:?\s*/i, '').replace(/\s*,[\s,]*/g, ', ').replace(/^[,\s]+|[,\s]+$/g, '').slice(0, 160);
    const pc = pcNorm(m[1] + m[2]); if (!addresses.some((x) => x.postcode === pc)) addresses.push({ value: a, postcode: pc, source: pageUrl }); } });
  return { phones, emails, addresses, personalSkipped };
}
async function tryHome(url, co, log) {
  let r = await politeGet(url, log);
  if (!r && log[log.length - 1].status === 0) { const u = new URL(url); u.hostname = u.hostname.startsWith('www.') ? u.hostname.slice(4) : 'www.' + u.hostname; r = await politeGet(u.href, log); }
  if (!r) return null;
  const finalUrl = r.url; const text = textOf(r.body); const { proofs, brand } = proofOn(text, r.body, co);
  return { url: finalUrl, html: r.body, text, proofs, brand };
}
async function stage2(co, { candidates = [], maxPages = 4, log }) {
  let site = null;
  for (const c of candidates) { const h = await tryHome(c, co, log); if (h && (h.proofs.length || h.brand)) { site = h; break; } }
  if (!site) return null;
  const host = new URL(site.url).host.replace(/^www\./, '');
  const pages = [{ url: site.url, html: site.html, text: site.text }]; const proofMap = new Map();
  const addProof = (p, where) => { if (!proofMap.has(p)) proofMap.set(p, []); proofMap.get(p).push(where); };
  site.proofs.forEach((p) => addProof(p, 'home page'));
  for (const link of linksFrom(site.html, site.url).slice(0, maxPages - 1)) {
    const r = await politeGet(link, log); if (!r) continue; const text = textOf(r.body);
    pages.push({ url: r.url, html: r.body, text }); proofOn(text, r.body, co).proofs.forEach((p) => addProof(p, new URL(r.url).pathname));
  }
  const ex = { phones: [], emails: [], addresses: [], personalSkipped: 0 };
  for (const p of pages) { const e = extract(p.html, p.text, p.url, host);
    for (const k of ['phones', 'emails', 'addresses']) for (const v of e[k]) if (!ex[k].some((x) => x.value === v.value)) ex[k].push(v);
    ex.personalSkipped += e.personalSkipped; }
  ex.addresses = bestAddresses(ex.addresses);
  const pr = [...proofMap].map(([p, w]) => `${p} (${w.join(', ')})`);
  if (ex.addresses.some((a) => a.postcode === co.office.postcode) && !pr.some((p) => p.includes('postcode'))) pr.push('registered office postcode ' + co.office.postcode);
  const strong = pr.some((p) => p.startsWith('company number')) || (pr.some((p) => p.startsWith('legal name')) && pr.some((p) => p.includes('postcode')));
  const confidence = strong ? 'Confirmed' : pr.length ? 'Likely' : 'Unverified';
  return { website: site.url, confidence, proofs: pr, brandOnly: !pr.length, pagesRead: pages.map((p) => p.url), ...ex };
}

// ---------- Orchestration ----------
async function findContacts(number, opts = {}) {
  const ch = opts.ch || chClient(opts.chKey || process.env.CH_KEY);
  const serperKey = opts.serperKey || process.env.SERPER_KEY || '';
  const log = [];
  const company = await stage1(ch, number);
  const res = { company, website: null, stagesRun: ['companies-house'], fetched: log, checkedAt: new Date().toISOString() };
  if (company.status !== 'active') { res.note = 'Company is not active; website not looked up.'; return res; }
  const known = opts.website ? [opts.website] : [];
  res.stagesRun.push('website');
  let w = await stage2(company, { candidates: [...known, ...guessDomains(company.name)], log });
  if (w) w.foundBy = known.length && w.website.startsWith(new URL(known[0]).origin) ? 'supplied' : 'domain guess';
  if (!w && serperKey && opts.useSerper !== false) {
    res.stagesRun.push('serper'); const q = `"${baseName(company.name).toLowerCase()}" ${company.office.town || company.office.postcode}`;
    const c = await serperSearch(serperKey, q); w = await stage2(company, { candidates: c, log }); if (w) w.foundBy = 'web search';
  }
  res.website = w; return res;
}

module.exports = { bestAddresses, findContacts, stage1, stage2, chClient, guessDomains, parseRobots, extract, proofOn, baseName };

if (require.main === module) {
  const [num, site] = process.argv.slice(2);
  if (!num) { console.error('Usage: CH_KEY=… [SERPER_KEY=…] node contacts.js <company number> [known website]'); process.exit(1); }
  findContacts(num, { website: site }).then((r) => console.log(JSON.stringify(r, null, 2)), (e) => { console.error(e.message); process.exit(1); });
}
