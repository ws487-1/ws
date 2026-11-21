// @ts-nocheck
// Companies House access and page loaders, ported from /pson/zuli app.js (same endpoints, cache and error wording).
import { N } from './legacy'
import { SLOT, chKey, lsGet, lsObj, lsSet } from './store'
import { U } from './router'
const API = 'https://api.company-information.service.gov.uk'
export class ApiError extends Error { code: string; constructor(code, msg) { super(msg); this.code = code } }
const TTL = 10 * 60 * 1000
export async function ch(path) {
  const key = chKey()
  if (!key) throw new ApiError('nokey', 'Add your Companies House API key in Settings to look companies up.')
  const ck = 'prosper.c.' + path
  try { const c = JSON.parse(sessionStorage.getItem(ck) || 'null'); if (c && Date.now() - c.t < TTL) return c.d } catch { /* ignore */ }
  let r
  try { r = await fetch(API + path, { headers: { Authorization: 'Basic ' + btoa(key + ':') } }) } catch { throw new ApiError('network', "Could not reach Companies House. Check your connection, and that this site is listed under your key's JavaScript domains.") }
  if (r.status === 401) throw new ApiError('401', "Companies House rejected the key (401). Check it in Settings, and that this site is listed under the key's JavaScript domains.")
  if (r.status === 429) throw new ApiError('429', 'Companies House rate limit reached (600 requests per 5 minutes). Wait a few minutes and try again.')
  let d
  if (r.status === 404) d = { _http: 404 }
  else if (!r.ok) throw new ApiError(String(r.status), 'Companies House returned an error (' + r.status + '). Try again shortly.')
  else d = await r.json()
  try { sessionStorage.setItem(ck, JSON.stringify({ t: Date.now(), d })) } catch { /* full */ }
  return d
}
export const normNumber = (n) => { const s = String(n || '').replace(/\s+/g, '').toUpperCase(); return /^\d+$/.test(s) ? s.padStart(8, '0') : s }
export const isNumber = (q) => /^(?:[A-Z]{2}\d{6}|[A-Z]{2}\d{5}[A-Z]|\d{5,8})$/i.test(String(q).replace(/\s+/g, ''))
export function pastedTarget(q) {
  const s = String(q || '').trim(); let m
  if ((m = /\/officers\/([A-Za-z0-9_-]{10,})\/appointments/.exec(s))) return U.person(m[1])
  if ((m = /\/disqualified-officers\/(natural|corporate)\/([A-Za-z0-9_-]{10,})/.exec(s))) return U.disq(m[1], m[2])
  if ((m = /\/persons-with-significant-control\/([A-Za-z0-9_-]{10,})\/notifications/.exec(s))) return U.psc(m[1])
  if ((m = /\/company\/([A-Z0-9]{8})(?:[/?#]|$)/i.exec(s))) return U.company(m[1].toUpperCase())
  if (/^[A-Za-z0-9_-]{27}$/.test(s) && /[a-z]/.test(s) && /[A-Z]/.test(s) && /[0-9_-]/.test(s)) return U.person(s)
  return ''
}
export async function pool(tasks, n) {
  const out = new Array(tasks.length); let i = 0
  await Promise.all(Array.from({ length: Math.min(n, tasks.length) }, async () => { while (i < tasks.length) { const k = i++; try { out[k] = await tasks[k]() } catch (e) { out[k] = e } } }))
  return out
}
export async function allPages(base, per, max = Infinity) {
  const url = (offset) => `${base}${base.includes('?') ? '&' : '?'}items_per_page=${per}&start_index=${offset}`
  const first = await ch(url(0))
  if (first._http) return first
  const items = (first.items || []).slice()
  const total = Number(first.total_results ?? first.total_count ?? items.length)
  const seen = new Set([JSON.stringify(first.items || [])])
  let valid = Number.isInteger(total) && total >= 0, error = ''
  while (valid && items.length < Math.min(total, max)) {
    let next
    try { next = await ch(url(items.length)) } catch { valid = false; error = 'load'; break }
    const got = (next && next.items) || [], fp = JSON.stringify(got)
    if (next._http || !got.length || seen.has(fp) || Number(next.total_results ?? next.total_count ?? total) !== total || (next.start_index != null && Number(next.start_index) !== items.length)) { valid = false; error = 'pages'; break }
    seen.add(fp); items.push(...got)
  }
  return Object.assign({}, first, { items, _complete: valid && items.length === total, _loadError: error })
}

/* Company page: only the parts the profile links to (Companies House answers 404 for the rest). */
/* In-memory cache of company view-models (10 minutes, like the sessionStorage cache) so returning to a company renders on
   the first frame with no placeholders. Also used for any other loader via memo(). */
const MEM = new Map()
export const peek = (k) => { const e = MEM.get(k); return e && Date.now() - e.t < TTL ? e.v : undefined }
export async function memo(k, fn) { const hit = peek(k); if (hit !== undefined) return hit; const v = await fn(); MEM.set(k, { t: Date.now(), v }); return v }
export const peekCompany = (n) => peek('co:' + n)
export const loadCompany = (n) => memo('co:' + n, () => loadCompanyRaw(n))
async function loadCompanyRaw(n) {
  const c = '/company/' + n, raw: any = {}
  raw.profile = await ch(c)
  if (raw.profile._http) throw new ApiError('404', 'No company found with number ' + n + '.')
  const p = raw.profile, L = p.links || {}
  const ukLink = p.type === 'oversea-company' && (L.uk_establishments || L['uk-establishments'])
  const [officers, psc, pscStatements, exemptions, registers, ukEstablishments, charges, insolvency, filings] = await Promise.all([
    allPages(c + '/officers', 100), L.persons_with_significant_control ? ch(c + '/persons-with-significant-control?items_per_page=25') : null,
    L.persons_with_significant_control_statements ? ch(c + '/persons-with-significant-control-statements?items_per_page=25') : null,
    L.exemptions ? ch(c + '/exemptions') : null, L.registers ? ch(c + '/registers') : null, ukLink ? ch(c + '/uk-establishments') : null, (L.charges || p.has_charges) ? ch(c + '/charges?items_per_page=25') : null,
    (L.insolvency || p.has_insolvency_history) ? ch(c + '/insolvency') : null, ch(c + '/filing-history?items_per_page=25')])
  Object.assign(raw, { officers, psc, pscStatements, exemptions, registers, ukEstablishments, charges, insolvency, filings, similar: null, appointments: {} })
  const act = (officers.items || []).filter((o) => !o.resigned_on).slice(0, 3)
  await Promise.all(act.map(async (o) => { const l = o.links && o.links.officer && o.links.officer.appointments; if (l) raw.appointments[l] = await ch(l + '?items_per_page=50').catch(() => null) }))
  const vm = N.company(raw)
  vm.disq = disqByPn()
  return { raw, vm, ukEst: !!raw.ukEstablishments && !raw.ukEstablishments._http }
}

/* Registered office nation: Scotland and Northern Ireland from the jurisdiction; England or Wales from postcodes.io. */
const timeoutSignal = (ms) => { try { return AbortSignal.timeout(ms) } catch { const c = new AbortController(); setTimeout(() => c.abort(), ms); return c.signal } }
async function pcCountry(postcode) {
  const k = String(postcode || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (!/^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(k)) return null
  const map = lsObj(SLOT.pc)
  if (Object.prototype.hasOwnProperty.call(map, k)) return map[k]
  const get = async (u) => { const r = await fetch('https://api.postcodes.io' + u, { signal: timeoutSignal(4000) }); if (r.status === 404) return null; if (!r.ok) throw new Error('postcodes.io ' + r.status); return (await r.json()).result }
  let country = null
  try {
    const r = await get('/postcodes/' + k)
    if (r) country = r.country || null
    else {
      const t = await get('/terminated_postcodes/' + k)
      if (t && t.latitude != null && t.longitude != null) { const near = (await get(`/postcodes?lon=${t.longitude}&lat=${t.latitude}&limit=5&radius=200`)) || []; const cs = near.map((x) => x.country); if (cs.length && cs.every((c) => c === cs[0])) country = cs[0] }
    }
  } catch { return null }
  map[k] = country; const keys = Object.keys(map); if (keys.length > 500) delete map[keys[0]]; lsSet(SLOT.pc, map)
  return country
}
export async function nation(vm) {
  const j = vm.jurisdictionCode
  if (j === 'scotland') return { flag: 'gb-sct', name: 'Scotland', uk: true }
  if (j === 'northern-ireland') return { text: 'Northern Ireland', reg: true, uk: true }
  if (j === 'england-wales' || j === 'england' || j === 'wales') {
    const c = vm.address.postcode ? await pcCountry(vm.address.postcode) : null
    if (c === 'England' && j !== 'wales') return { flag: 'gb-eng', name: 'England', uk: true }
    if (c === 'Wales' && j !== 'england') return { flag: 'gb-wls', name: 'Wales', uk: true }
    return { text: j === 'england-wales' ? 'England & Wales' : vm.jurisdiction, reg: true, uk: true }
  }
  const t = (vm.overseas && vm.overseas.country) || vm.jurisdiction || vm.address.country
  return t ? { text: t } : null
}

/* Similar companies: Nearby and Same trade. Each returns {items, notes} or {empty}. */
export function sicChoice(vm) {
  const codes = vm.sic.map((s) => s.code)
  const pick = codes.find((c) => !N.GENERIC_SIC.includes(c)) || codes[0] || ''
  const desc = (vm.sic.find((s) => s.code === pick) || {}).desc || ''
  return { pick, desc, allGeneric: !!codes.length && codes.every((c) => N.GENERIC_SIC.includes(c)) }
}
const genericNote = (s) => (s.allGeneric ? `This company's activity code ${s.pick}${s.desc ? ' (' + s.desc + ')' : ''} is a general one, so these matches are broad.` : '')
const rankGeneric = (items) => items.filter((x) => !x.generic).concat(items.filter((x) => x.generic))
export const SIM = {
  async nearby(vm) {
    const s = sicChoice(vm)
    if (!s.pick) return { empty: 'No activity (SIC) code on record, so there is nothing to compare with.' }
    const district = (/^([A-Z]{1,2}\d[A-Z\d]?)\s*\d[A-Z]{2}$/.exec((vm.address.postcode || '').toUpperCase().trim()) || [])[1] || ''
    const q = (loc) => ch(`/advanced-search/companies?company_status=active&size=20&sic_codes=${s.pick}&location=${encodeURIComponent(loc)}`)
    let where = district, r = { items: [], total: 0 }
    if (district) r = N.similar(await q(district), vm.number)
    if (!r.items.length && vm.address.town) { where = vm.address.town; r = N.similar(await q(vm.address.town), vm.number) }
    if (!where) return { empty: 'No registered office postcode or town on record to search near.' }
    if (!r.items.length) return { empty: `No other active companies with SIC ${s.pick} in ${where}.`, notes: [genericNote(s)] }
    return { items: rankGeneric(r.items).slice(0, 10), notes: [`Active companies with SIC ${s.pick}${s.desc ? ' (' + s.desc + ')' : ''} registered in ${where}${district && where !== district ? ' (none found in ' + district + ')' : ''}.`, genericNote(s)] }
  },
  async trade(vm) {
    const s = sicChoice(vm)
    if (!s.pick) return { empty: 'No activity (SIC) code on record, so there is nothing to compare with.' }
    const raw = await ch(`/advanced-search/companies?company_status=active&size=100&sic_codes=${s.pick}`)
    const r = N.similar(raw, vm.number)
    if (!r.items.length) return { empty: `No other active companies with SIC ${s.pick}.` }
    const items = rankGeneric(r.items.slice().sort((a, b) => b.createdIso.localeCompare(a.createdIso))).slice(0, 10)
    return { items, notes: [`Active companies with SIC ${s.pick}${s.desc ? ' (' + s.desc + ')' : ''}, newest first among the first ${Math.min(100, (raw.items || []).length)} of ${(+r.total).toLocaleString('en-GB')} matches returned by Companies House.`, genericNote(s)] }
  },
}

/* Disqualified directors: a match needs the identical Companies House person number. */
const DISQ_TTL = 24 * 3600 * 1000
const disqMap = () => lsObj(SLOT.disq)
export function disqByPn() { const m = disqMap(), out = {}; for (const [pn, v] of Object.entries(m) as any) if (v && v.path && Date.now() - v.t < DISQ_TTL) out[pn] = v.path; return out }
function disqRemember(pns, path) { const m = disqMap(); for (const pn of pns) m[pn] = { t: Date.now(), path: path || '' }; const ks = Object.keys(m); if (ks.length > 2000) ks.slice(0, ks.length - 2000).forEach((k) => delete m[k]); lsSet(SLOT.disq, m) }
const searchName = (raw) => { const m = /^([^,]+),\s*(.+)$/.exec(raw || ''); return (m ? m[2] + ' ' + m[1] : raw || '').replace(/^(mr|mrs|ms|miss|dr|sir)\.?\s+/i, '').trim() }
async function disqFind(rawName, dob, pns) {
  const s = await ch(`/search/disqualified-officers?q=${encodeURIComponent(searchName(rawName))}&items_per_page=50`)
  let c = ((s && s.items) || []).filter((i) => /\/disqualified-officers\/natural\//.test((i.links && i.links.self) || ''))
  if (dob && dob.year) c = c.filter((i) => { const d = String(i.date_of_birth || '').split('-'); return +d[0] === +dob.year && (!dob.month || +d[1] === +dob.month) })
  const hits = []
  for (const i of c.slice(0, 5)) { const r = await ch(i.links.self); if (r && !r._http && r.person_number && pns.includes(String(r.person_number))) hits.push({ path: i.links.self, raw: r }) }
  return hits
}
async function personNumbers(ids, items) {
  const pns = [], rec = { name: '', dob: null }
  const cos = items.slice().sort((a, b) => b.current - a.current).map((x) => x.number).filter((n, i, a) => n && a.indexOf(n) === i).slice(0, 3)
  await pool(cos.map((n) => async () => {
    const r = await ch('/company/' + n + '/officers?items_per_page=100')
    for (const o of (r && r.items) || []) {
      const id = (/\/officers\/([^/]+)\/appointments/.exec((o.links && o.links.officer && o.links.officer.appointments) || '') || [])[1]
      if (id && ids.includes(id)) { if (o.person_number && !pns.includes(String(o.person_number))) pns.push(String(o.person_number)); rec.name = rec.name || o.name; rec.dob = rec.dob || o.date_of_birth || null }
    }
  }), 3)
  return Object.assign(rec, { pns })
}
export async function disqForPerson(ids, vm) {
  if (vm.corporate) return null
  const rec = await personNumbers(ids, vm.items)
  if (!rec.pns.length) return null
  const m = disqMap()
  const known = rec.pns.map((pn) => m[pn]).find((v) => v && Date.now() - v.t < DISQ_TTL)
  if (known) { if (!known.path) return null; const r = await ch(known.path); return r && !r._http && rec.pns.includes(String(r.person_number)) ? N.disqualification(r) : null }
  const hits = await disqFind(rec.name || vm.rawName, rec.dob || vm.dob, rec.pns)
  disqRemember(rec.pns, hits[0] && hits[0].path)
  return hits[0] ? N.disqualification(hits[0].raw) : null
}

/* Person page: officer appointments (several records can be combined), with PSC notifications when the IDs match. */
export async function loadPerson(ids, pscId) {
  let apIds = ids, pns = [], apRaws = null
  if (pscId) {
    const [pn, ap] = await Promise.all([ch(`/persons-with-significant-control/${pscId}/notifications`), allPages(`/officers/${pscId}/appointments`, 50)])
    if (ap._http) { if (pn._http) throw new ApiError('404', 'Companies House has no record for this owner.'); return { pscOnly: N.pscNotifications(pn), pscId } }
    apIds = [pscId]; pns = [{ id: pscId, raw: pn }]; apRaws = [ap]
  }
  const raws = apRaws || await Promise.all(apIds.map((id) => allPages('/officers/' + id + '/appointments', 50)))
  const good = raws.filter((r) => !r._http)
  if (!good.length) throw new ApiError('404', 'No appointments found for this person.')
  const vm = N.person(good)
  if (!pscId) pns = (await Promise.all(apIds.slice(0, 3).map(async (id) => ({ id, raw: await ch(`/persons-with-significant-control/${id}/notifications`) })))).filter((x) => !x.raw._http)
  const pnv = pns.length ? N.pscNotifications({ name: pns[0].raw.name, date_of_birth: pns[0].raw.date_of_birth, items: [].concat(...pns.map((x) => x.raw.items || [])), total_results: pns.reduce((n, x) => n + (+x.raw.total_results || 0), 0) }) : null
  const names = {}
  if (pnv) await pool(pnv.items.map((x) => x.number).filter((n, i, a) => n && a.indexOf(n) === i).slice(0, 20).map((n) => async () => { const p = await ch('/company/' + n); if (p && !p._http) names[n] = N.profile(p).name }), 4)
  vm.items.forEach((a) => { if (a.number && !names[a.number]) names[a.number] = a.company })
  return { vm, apIds, pnv, names, complete: good.length === raws.length && good.every((r) => r._complete === true) }
}
export async function loadDisq(id, kind) {
  const r = await ch(`/disqualified-officers/${kind}/${id}`)
  if (r._http) throw new ApiError('404', 'No disqualification record found.')
  return N.disqualification(r)
}

export async function companyNames(numbers) {
  const out = {}, list = numbers.filter((n, i, a) => n && a.indexOf(n) === i).slice(0, 20)
  await pool(list.map((n) => async () => { const p = await ch('/company/' + n); if (p && !p._http) out[n] = N.profile(p).name }), 4)
  return out
}

/* Connected: companies sharing a current officer or PSC with this company, matched by Companies House ID (one hop).
   Up to 40 requests, 5 at a time; kept for 24 hours in this browser under the same key as /pson/zuli. */
export async function connected(vm, progress) {
  const ck = SLOT.conn + vm.number, cached = lsGet(ck)
  if (cached && Date.now() - cached.t < 24 * 3600 * 1000 && cached.v === 1) return { rows: cached.rows, notes: cached.notes }
  const BUDGET = 40, SHOW = 20
  let calls = 0
  const people = []
  for (const o of vm.officers.active) if (o.officerId) people.push({ kind: 'officer', id: o.officerId, name: o.name, path: `/officers/${o.officerId}/appointments?items_per_page=50`, href: U.person(o.officerId) })
  for (const p of vm.ownership.current) if (p.pscId && !p.secure) people.push({ kind: 'psc', id: p.pscId, name: p.name, path: `/persons-with-significant-control/${p.pscId}/notifications`, href: p.ukCompany ? U.company(p.ukCompany) : U.psc(p.pscId) })
  const notes = []
  const maxPeople = Math.min(people.length, 25)
  if (people.length > maxPeople) notes.push(`Checked ${maxPeople} of ${people.length} current officers and PSCs.`)
  if (!people.length) return { rows: [], notes: ['No current officers or PSCs with a Companies House ID.'] }
  const by = {}
  const add = (number, name, status, link) => {
    if (!number || number === vm.number) return
    const r = by[number] || (by[number] = { number, name: '', status: '', colour: '', links: [] })
    if (name && !r.name) r.name = name
    if (status && !r.status) { r.status = N.label('company_status', status); r.colour = N.statusColour(status) }
    if (!r.links.some((l) => l.name === link.name && l.role === link.role)) r.links.push(link)
  }
  let done = 0, cut = false
  progress(`Checking 0 of ${maxPeople} people…`)
  await pool(people.slice(0, maxPeople).map((p) => async () => {
    calls++
    const d = await ch(p.path)
    done++; progress(`Checking ${done} of ${maxPeople} people…`)
    if (!d || d._http) return
    if (p.kind === 'officer') {
      if ((d.total_results || 0) > (d.items || []).length) cut = true
      for (const a of d.items || []) if (!a.resigned_on && a.appointed_to) add(a.appointed_to.company_number, a.appointed_to.company_name, a.appointed_to.company_status, { name: p.name, href: p.href, role: N.label('officer_role', a.officer_role) || 'Officer' })
    } else {
      for (const x of d.items || []) {
        if (x.ceased_on || x.ceased || !x.notified_to) continue
        const natures = x.natures_of_control || []
        const role = /beneficial-owner/.test(x.kind || '') ? 'Beneficial owner' : natures.some((c) => /^ownership-of-shares/.test(c)) ? 'Owner' : 'Person with significant control'
        add(x.notified_to.company_number, '', '', { name: p.name, href: p.href, role })
      }
    }
  }), 5)
  if (cut) notes.push('Some people hold more than 50 appointments; only their latest 50 were checked.')
  let rows: any[] = Object.values(by).sort((a: any, b: any) => b.links.length - a.links.length || (a.name || a.number).localeCompare(b.name || b.number))
  if (rows.length > SHOW) notes.push(`Showing ${SHOW} of ${rows.length} connected companies, most links first.`)
  rows = rows.slice(0, SHOW)
  const missing = rows.filter((r) => !r.name)
  const room = Math.max(0, BUDGET - calls)
  if (missing.length) {
    progress('Looking up company names…')
    await pool(missing.slice(0, room).map((r) => async () => { calls++; const pr = await ch('/company/' + r.number); if (pr && !pr._http) { r.name = pr.company_name; r.status = N.label('company_status', pr.company_status); r.colour = N.statusColour(pr.company_status) } }), 5)
    if (missing.length > room) notes.push(`Stopped after ${BUDGET} requests; ${missing.length - room} companies are shown by number only.`)
  }
  rows.forEach((r) => { r.name = r.name ? N.profile({ company_name: r.name, company_number: r.number }).name : 'Company ' + r.number })
  if (!rows.length) notes.push('No other current companies share a current officer or PSC with this one.')
  lsSet(ck, { v: 1, t: Date.now(), rows, notes })
  return { rows, notes }
}
