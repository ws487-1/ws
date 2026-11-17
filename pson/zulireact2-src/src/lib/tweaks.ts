// @ts-nocheck
/* Experimental settings for this build only (localStorage 'zulireact2.tweaks'; v1 keeps 'zuli3.tweaks').
   Applied as attributes and CSS variables on <html>, so most changes need no re-render. */
import { createContext, useContext, useEffect, useState } from 'react'
const KEY = 'zulireact2.tweaks'
export const PRESETS = [['default', 'Near-black (stock)', ''], ['zuli', 'Zuli blue', '#245091'], ['blue', 'Blue', '#2563EB'], ['sky', 'Sky', '#0284C7'], ['teal', 'Teal', '#0D9488'], ['green', 'Green', '#16A34A'], ['amber', 'Amber', '#D97706'], ['orange', 'Orange', '#EA580C'], ['red', 'Red', '#DC2626'], ['rose', 'Rose', '#E11D48']]
export const DEF = {
  /* Defaults from Will's copied settings, 17 Nov 2026. */
  base: 'slate', primary: '#245091', mode: 'light', radius: 0.375,
  layout: 'sidebar', sidebarVariant: 'inset', collapsible: 'offcanvas', nav: 'ghost', sidebarWidth: 13.5, startCollapsed: false,
  density: 'compact', fs: 95, font: 'geist', width: 'full',
  stat: 'default', shadow: 'soft', border: 'on', cardbg: 'plain', stripe: 'off',
  initials: 'primary', logo: 'ink', chart: 'grouped', breadcrumbs: 'on', kbd: 'off',
  /* Round 3 settings */
  status: 'bold', btn: 'solid', chartPal: 'theme',
  navActive: 'stock', sbLabels: 'on', sbSeps: 'off', sticky: 'on', homeSearch: 'hero',
  headSize: 'default', headWeight: 'semibold', tracking: 'tight',
  cardHead: 'plain', statIcon: 'on', statSize: 'default', rows: 'default', rowHover: 'on', barRadius: 4, avatar: 'circle',
  flag: 'country',
  links: 'hover', focus: 'stock', motion: 'stock', scrollbar: 'stock',
}
export type Tweaks = typeof DEF
export function getTweaks(): Tweaks { let v = {}; try { v = JSON.parse(localStorage.getItem(KEY) || '{}') || {} } catch { v = {} } return Object.assign({}, DEF, v) }
/* Readable text on a custom primary: white unless the colour is light. */
function fgFor(hex) { const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255; return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62 ? '#0a0a0a' : '#ffffff' }
const mq = () => window.matchMedia('(prefers-color-scheme: dark)')
export function applyTweaks(v: Tweaks) {
  const h = document.documentElement
  const dark = v.mode === 'dark' || (v.mode === 'system' && mq().matches)
  h.classList.toggle('dark', dark)
  h.style.colorScheme = dark ? 'dark' : 'light'
  for (const k of ['base', 'density', 'font', 'width', 'shadow', 'border', 'cardbg', 'stripe', 'initials', 'logo', 'nav', 'layout']) h.dataset[k] = String(v[k])
  for (const k of Object.keys(DEF)) if (typeof DEF[k] === 'string') h.setAttribute('data-t-' + k.toLowerCase(), String(v[k]))
  h.style.setProperty('--radius', v.radius + 'rem')
  h.style.setProperty('--fs', String(v.fs / 100))
  const p = /^#[0-9a-f]{6}$/i.test(v.primary) ? v.primary : ''
  for (const k of ['--primary', '--primary-foreground', '--sidebar-primary', '--sidebar-primary-foreground', '--chart-1']) h.style.removeProperty(k)
  if (p) { const f = fgFor(p); h.style.setProperty('--primary', p); h.style.setProperty('--primary-foreground', f); h.style.setProperty('--sidebar-primary', p); h.style.setProperty('--sidebar-primary-foreground', f); h.style.setProperty('--chart-1', p) }
}
const listeners = new Set<(v: Tweaks) => void>()
export function setTweaks(v: Partial<Tweaks>) {
  const n = Object.assign({}, DEF, v)
  try { const diff = Object.fromEntries(Object.entries(n).filter(([k, x]) => DEF[k] !== x)); if (Object.keys(diff).length) localStorage.setItem(KEY, JSON.stringify(diff)); else localStorage.removeItem(KEY) } catch { /* blocked */ }
  applyTweaks(n); listeners.forEach((f) => f(n))
}
export function useTweaks(): [Tweaks, (k: string, val: any) => void] {
  const [v, setV] = useState(getTweaks())
  useEffect(() => { listeners.add(setV); const m = mq(); const f = () => { const t = getTweaks(); if (t.mode === 'system') applyTweaks(t) }; m.addEventListener('change', f); return () => { listeners.delete(setV); m.removeEventListener('change', f) } }, [])
  return [v, (k, val) => setTweaks({ ...getTweaks(), [k]: val })]
}
