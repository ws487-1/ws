// @ts-nocheck
/* Back link, trail and scroll memory (consultation 2, items 10–11).
   - A click on an in-page link (inside .z-content) records where you came from. Sidebar, header, search and command
     palette navigation don't, so they reset the trail.
   - 'Back link' setting: one level (default; only the page you came from) or a capped trail of 3.
   - Our Back button calls history.back() when the previous history entry is the origin, so scroll is restored and no loop
     is created; otherwise it navigates.
   - Scroll position is kept per route key in sessionStorage and restored on browser Back/Forward and our Back. */
import { getTweaks } from './tweaks'
const TK = 'zuli.trail', SK = 'zuli.scroll'
const ss = { get(k, d) { try { return JSON.parse(sessionStorage.getItem(k) || 'null') ?? d } catch { return d } }, set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)) } catch { /* blocked */ } } }
const pathOf = (key) => String(key || '').replace(/^#/, '').split('?')[0] || '/'
const curKey = () => (location.hash || '#/').replace(/^#/, '')
const pageName = () => (document.title || '').replace(/ · Zuli$/, '') || 'previous page'
export const trail = () => ss.get(TK, { at: '', items: [] })
let popNav = false, lastKey = curKey(), samePage = false

/* Called from a document-level click listener (see install()). */
function record(toHref) {
  const to = toHref.replace(/^#/, ''), from = curKey()
  if (pathOf(to) === pathOf(from)) return
  const t = trail(), cap = getTweaks().back === 'trail' ? 3 : 1
  let items = (t.at === pathOf(from) ? t.items : []).concat({ key: from, name: pageName() })
  const loop = items.findIndex((x) => pathOf(x.key) === pathOf(to))
  if (loop >= 0) items = items.slice(0, loop) /* A → X → A: going "forward" to A collapses the loop */
  ss.set(TK, { at: pathOf(to), items: items.slice(-cap), pushed: true })
}
/* On every route change: keep the trail if we arrived by a recorded click, pop it when we went back to its last page,
   otherwise clear it. */
export function onRoute(key) {
  const t = trail(), p = pathOf(key)
  if (t.at === p) { /* recorded click or a same-page change (tabs, filters) */ }
  else if (t.items.length && pathOf(t.items[t.items.length - 1].key) === p) ss.set(TK, { at: p, items: t.items.slice(0, -1) })
  else if (t.at || t.items.length) ss.set(TK, { at: '', items: [] })
  const wasPop = popNav; popNav = false
  const prev = lastKey; lastKey = key
  samePage = pathOf(prev) === p && prev !== key
  try { if (!wasPop && !(history.state && history.state.zprev)) history.replaceState({ ...(history.state || {}), zprev: prev }, '') } catch { /* ignore */ }
  return wasPop
}
export function backItems(key) { const t = trail(); return t.at === pathOf(key) ? t.items : [] }
export function goBackTo(item, stepsBack) {
  const st = history.state || {}
  if (stepsBack === 1 && st.zprev && pathOf(st.zprev) === pathOf(item.key)) { history.back(); return }
  restoreNext = item.key
  location.hash = '#' + item.key
}
/* Scroll memory */
let restoreNext = ''
const saveScroll = () => { const m = ss.get(SK, {}); m[lastKey] = Math.round(window.scrollY); const ks = Object.keys(m); if (ks.length > 80) delete m[ks[0]]; ss.set(SK, m) }
export function restoreScroll(key, wasPop) {
  const want = wasPop || restoreNext === key ? (ss.get(SK, {})[key] || 0) : 0
  restoreNext = ''
  if (!want) { if (!samePage) window.scrollTo(0, 0); return }
  let tries = 0
  const tick = () => { if (document.documentElement.scrollHeight - window.innerHeight >= want - 4 || tries > 40) { window.scrollTo(0, want); return } tries++; window.scrollTo(0, want); setTimeout(tick, 50) }
  requestAnimationFrame(tick)
}
let installed = false
export function install() {
  if (installed) return; installed = true
  try { history.scrollRestoration = 'manual' } catch { /* old browser */ }
  window.addEventListener('popstate', () => { popNav = true })
  let tm = 0
  window.addEventListener('scroll', () => { clearTimeout(tm); tm = window.setTimeout(saveScroll, 120) }, { passive: true })
  /* Capture phase so the scroll is saved before the route changes. */
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    const a = e.target && e.target.closest && e.target.closest('a[href^="#/"]')
    if (!a || a.target === '_blank') return
    saveScroll()
    if (a.closest('.z-content') && !a.closest('[data-no-trail]')) record(a.getAttribute('href'))
  }, true)
}
