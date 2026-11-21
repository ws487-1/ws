// @ts-nocheck
/* Experimental settings, rebuilt 21 Nov 2026 (consultation 2, section 14).
   - BAKED: the old round 1–3 settings, fixed at Will's chosen values (incl. his paste sbSeps on, tracking tighter,
     barRadius 2, links always). No longer adjustable; still applied as attributes on <html> so the CSS keeps working.
   - XP: the new experimental panel. Stored as a diff in localStorage 'zulireact2.xp' (new key, so old diffs can't leak back).
   - Mode (light/dark/system) is a real preference on the Settings page, stored in 'zulireact2.mode'. */
import { useEffect, useState } from 'react'
const KEY = 'zulireact2.xp', MODE = 'zulireact2.mode'
export const BAKED = {
  base: 'slate', primary: '#245091', radius: 0.375,
  layout: 'sidebar', sidebarVariant: 'inset', collapsible: 'offcanvas', nav: 'ghost', sidebarWidth: 13.5, startCollapsed: false,
  density: 'compact', fs: 95, font: 'geist', width: 'full',
  stat: 'default', shadow: 'soft', border: 'on', cardbg: 'plain', stripe: 'off',
  initials: 'primary', chart: 'grouped', breadcrumbs: 'on', kbd: 'off',
  status: 'bold', btn: 'solid', chartPal: 'theme',
  navActive: 'stock', sbLabels: 'on', sbSeps: 'on', sticky: 'on', homeSearch: 'hero',
  headSize: 'default', headWeight: 'semibold', tracking: 'tighter',
  cardHead: 'plain', statIcon: 'on', statSize: 'default', rows: 'default', rowHover: 'on', barRadius: 2, avatar: 'circle',
  links: 'always', focus: 'stock', scrollbar: 'stock',
}
export const XP = {
  /* Layout */
  dash: 'C', emptyCharges: 'row', pscCols: '2', statCharges: 'count',
  /* Board & officers */
  boardChart: 'bars', boardN: '8', offView: 'timeline', tlSort: 'current', tlColour: 'status', tlLabels: 'on', bigRange: '10y', offChart: 'step', lineups: 'off',
  /* Filings */
  fBtnSize: 'sm', fBtnStyle: 'outline', fRow: 'divider', fHover: 'both', fPages: 'beside', fType: 'shown', fRows: '5',
  /* Map (defaults = the "Zuli blue" variant Will picked: Positron tinted blue, 3D buildings shaded pale to #245091 by height) */
  mapBtn: 'end', mapForm: 'text', mapPlace: 'dialog', mapSize: 'm', mapBase: 'positron', mapTint: 'accent', mapStreets: 'on', mapPoi: 'off', mapHouse: 'off',
  map3d: 'on', mapBcol: 'gradient', mapVgrad: 'on', mapHeight: '1', mapZoom: '16', mapPitch: '45', mapBearing: '-20', mapFly: 'off', mapMarker: 'dot',
  mapInteract: 'coop', mapTerrain: 'off', mapGlobe: 'off', mapLinks: 'on',
  /* Flags */
  flag: 'country', flagPos: 'end', flagSize: '16', flagShape: 'rect', flagEdge: 'ring', flagLabel: 'both', personFlags: 'residence',
  /* ID verification */
  idOff: 'vo', idPsc: 'all', idPop: 'hover',
  /* Feedback & navigation */
  toastStyle: 'default', toastDur: '4', undoUnsave: 'on', back: 'one', fade: '150', pulse: 'on',
  /* Download report (WIP) */
  repPlace: 'header', repStyle: 'outline', repLabel: 'text', repOpen: 'download', repSize: 'A4', repFile: 'name-number-date',
  repCover: 'on', repContents: 'on', repFigs: 'on', repOverview: 'on', repOfficers: 'on', repFormer: 'off', repOwnership: 'on', repCharges: 'on', repFilings: 'on', repFilingsN: '25', repChanges: 'on', repLinks: 'on', repOutline: 'on',
  /* Brand */
  logo: 'new',
}
export const DEF = XP
export type Tweaks = typeof XP & typeof BAKED & { mode: string }
const readMode = () => { try { const m = localStorage.getItem(MODE); if (m === 'light' || m === 'dark' || m === 'system') return m; const old = JSON.parse(localStorage.getItem('zulireact2.tweaks') || '{}'); return old.mode === 'dark' || old.mode === 'system' ? old.mode : 'light' } catch { return 'light' } }
export function getTweaks(): Tweaks { let v = {}; try { v = JSON.parse(localStorage.getItem(KEY) || '{}') || {} } catch { v = {} } const x = {}; for (const k of Object.keys(XP)) if (k in v) x[k] = v[k]; return Object.assign({}, BAKED, XP, x, { mode: readMode() }) }
function fgFor(hex) { const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255; return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62 ? '#0a0a0a' : '#ffffff' }
const mq = () => window.matchMedia('(prefers-color-scheme: dark)')
export const reducedMotion = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false } }
export function applyTweaks(v: Tweaks) {
  const h = document.documentElement
  const dark = v.mode === 'dark' || (v.mode === 'system' && mq().matches)
  h.classList.toggle('dark', dark)
  h.style.colorScheme = dark ? 'dark' : 'light'
  for (const k of ['base', 'density', 'font', 'width', 'shadow', 'border', 'cardbg', 'stripe', 'initials', 'logo', 'nav', 'layout']) h.dataset[k] = String(v[k])
  for (const k of Object.keys(BAKED).concat(Object.keys(XP))) { const x = v[k]; if (typeof x === 'string') h.setAttribute('data-t-' + k.toLowerCase(), x) }
  h.style.setProperty('--radius', v.radius + 'rem')
  h.style.setProperty('--fs', String(v.fs / 100))
  h.style.setProperty('--z-fade', v.fade === 'none' ? '0ms' : v.fade + 'ms')
  h.style.setProperty('--z-flag-h', v.flagSize + 'px')
  const p = v.primary
  const f = fgFor(p); h.style.setProperty('--primary', p); h.style.setProperty('--primary-foreground', f); h.style.setProperty('--sidebar-primary', p); h.style.setProperty('--sidebar-primary-foreground', f); h.style.setProperty('--chart-1', p)
  /* Favicon follows the logo setting: the new symbol for concept 03, the old PNG otherwise. */
  const B = import.meta.env.BASE_URL
  const ic = document.querySelector('link[rel=icon][type="image/svg+xml"]')
  if (ic) ic.setAttribute('href', v.logo === 'new' ? B + 'favicon.svg' : B + 'zuli-logo.png')
}
const listeners = new Set<(v: Tweaks) => void>()
const emit = () => { const n = getTweaks(); applyTweaks(n); listeners.forEach((f) => f(n)) }
export function setTweaks(v: Partial<Tweaks>) {
  try { const diff = Object.fromEntries(Object.keys(XP).filter((k) => k in v && v[k] !== XP[k]).map((k) => [k, v[k]])); if (Object.keys(diff).length) localStorage.setItem(KEY, JSON.stringify(diff)); else localStorage.removeItem(KEY) } catch { /* blocked */ }
  emit()
}
export function setMode(m: string) { try { localStorage.setItem(MODE, m) } catch { /* blocked */ } emit() }
export function useTweaks(): [Tweaks, (k: string, val: any) => void] {
  const [v, setV] = useState(getTweaks())
  useEffect(() => { listeners.add(setV); const m = mq(); const f = () => { const t = getTweaks(); if (t.mode === 'system') applyTweaks(t) }; m.addEventListener('change', f); return () => { listeners.delete(setV); m.removeEventListener('change', f) } }, [])
  return [v, (k, val) => (k === 'mode' ? setMode(val) : setTweaks({ ...getTweaks(), [k]: val }))]
}
