// @ts-nocheck
// Browser storage, with the same key names as /pson/zuli so the Companies House key, saved items and recently viewed carry over.
import { N } from './legacy'
import { U } from './router'
export const SLOT = { ch: 'prosper.key.ch', saved: 'prosper.saved', recent: 'prosper.recent', viewed: 'prosper.viewed', pc: 'prosper.pc', disq: 'prosper.disq', conn: 'prosper.conn.' }
export const lsGet = (k) => { try { const v = localStorage.getItem(k); return v == null ? null : JSON.parse(v) } catch { return null } }
export const lsObj = (k) => { const v = lsGet(k); return v && typeof v === 'object' && !Array.isArray(v) ? v : {} }
export const lsSet = (k, v) => { try { if (v == null || v === '') localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)) } catch { /* blocked */ } }
export function cleanKey(raw) {
  let s = String(raw == null ? '' : raw)
  s = s.replace(/^\s*(?:authorization\s*:\s*)?(?:basic|bearer)\s+/i, '').replace(/[\s\u00a0\u200b-\u200d\u2060\ufeff]+/g, '')
  for (let i = 0; i < 3; i++) { s = s.replace(/^(?:x-api-key|api[_-]?key|apikey|key|token|ch)?[=:]+/i, ''); s = s.replace(/^["'`\u2018\u2019\u201c\u201d<]+|["'`\u2018\u2019\u201c\u201d>,;]+$/g, '') }
  s = s.replace(/:+$/, '')
  const m = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.exec(s); if (m) s = m[0]
  return s
}
export const chKey = () => cleanKey(lsGet(SLOT.ch) || '')
export const setChKey = (k) => { lsSet(SLOT.ch, k || null); try { Object.keys(sessionStorage).filter((x) => x.startsWith('prosper.c.')).forEach((x) => sessionStorage.removeItem(x)) } catch { /* ignore */ } }

/* Saved: companies and people, newest first (old entries without kind become companies). */
export function saved() {
  const raw = lsGet(SLOT.saved); if (!Array.isArray(raw)) return []
  let changed = false; const n = raw.length
  const list = raw.filter((x) => x && typeof x === 'object').map((x, i) => {
    if (x.kind && /T/.test(x.savedAt || '')) return x
    changed = true
    const day = /^\d{4}-\d{2}-\d{2}$/.test(x.savedAt || '') ? Date.parse(x.savedAt + 'T00:00:00Z') : Date.UTC(2000, 0, 1)
    return Object.assign({}, x, { kind: x.kind || 'company', savedAt: new Date(day + (n - i)).toISOString(), dateOnly: true, noDate: !/^\d{4}-\d{2}-\d{2}$/.test(x.savedAt || '') })
  })
  if (changed) lsSet(SLOT.saved, list)
  return list
}
export const savedKey = (x) => (x.kind === 'person' ? 'p:' + x.key : 'c:' + x.number)
export const isSaved = (k) => saved().some((x) => savedKey(x) === k)
export function toggleSaved(entry) {
  const k = savedKey(entry), list = saved(), on = list.some((x) => savedKey(x) === k), rest = list.filter((x) => savedKey(x) !== k)
  if (!on) rest.unshift(Object.assign({}, entry, { savedAt: new Date().toISOString() }))
  lsSet(SLOT.saved, rest); return !on
}
export const removeSaved = (k) => lsSet(SLOT.saved, saved().filter((x) => savedKey(x) !== k))

/* Recently viewed: {type, id, name, t}, newest first, at most 100. Hrefs are built for this app's routes. */
const VIEW_MAX = 100
const viewOk = (r) => !!r && typeof r === 'object' && ['company', 'person', 'corporate'].includes(r.type) && typeof r.id === 'string' && !!r.id && typeof r.name === 'string'
export const viewKey = (r) => (r.type === 'company' ? 'c:' : 'p:') + r.id
export const viewHref = (r) => (r.type === 'company' ? U.company(r.id) : r.id.startsWith('psc:') ? U.psc(r.id.slice(4)) : U.person(r.id.replace(/^id:/, '').split(',')))
export const savedHref = (x) => { if (x.kind !== 'person') return U.company(x.number); const k = String(x.key || ''); if (k.startsWith('psc:')) return U.psc(k.slice(4)); if (k.startsWith('disq:')) return U.disq(/k=corporate/.test(x.href || '') ? 'corporate' : 'natural', k.slice(5)); return U.person(k.replace(/^id:/, '').split(',')) }
export function saveViewed(l) { try { if (!l.length) localStorage.removeItem(SLOT.viewed); else localStorage.setItem(SLOT.viewed, JSON.stringify(l.slice(0, VIEW_MAX))) } catch { try { localStorage.setItem(SLOT.viewed, JSON.stringify(l.slice(0, 50))) } catch { /* full */ } } }
export function viewedList() { const raw = lsGet(SLOT.viewed); return (Array.isArray(raw) ? raw.filter(viewOk) : []).slice(0, VIEW_MAX) }
export function addViewed(type, id, name) { if (!id || !name) return; const e = { type, id: String(id), name: String(name), t: new Date().toISOString() }; saveViewed([e].concat(viewedList().filter((r) => viewKey(r) !== viewKey(e)))) }
export const fmtWhen = (t) => { const d = t ? new Date(t) : null; return d && !isNaN(+d) ? N.fmtDate(t.slice(0, 10)) + ', ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '' }

/* Back button scope: a tile's open button on a profile remembers that profile for this tab (sessionStorage 'zuli.back'). */
export const BACK = 'zuli.back'
export function rememberBack(to, from, name) { try { sessionStorage.setItem(BACK, JSON.stringify({ to: to.replace(/^#/, ''), from: from.replace(/^#/, ''), name })) } catch { /* blocked */ } }
export function backFor(here) { try { const b = JSON.parse(sessionStorage.getItem(BACK) || 'null'); return b && b.to === here ? b : null } catch { return null } }
export function clearBackUnless(here) { try { const b = JSON.parse(sessionStorage.getItem(BACK) || 'null'); if (b && b.to !== here) sessionStorage.removeItem(BACK) } catch { /* blocked */ } }
