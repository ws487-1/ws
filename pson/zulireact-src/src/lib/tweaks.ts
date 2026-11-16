// Experimental settings (same storage key and options as /pson/zuli, so choices carry over).
// Applied to <html> as CSS custom properties and data attributes before first render.
export type Tweaks = { accent: string; scale: number; tk: number; ststyle: string; stpos: string; tistyle: string; initials: string; avSize: number; picon: string; openbtn: string; sicH: number }
const KEY = 'zuli3.tweaks'
export const DEF: Tweaks = { accent: '#245091', scale: 100, tk: 100, ststyle: 'current', stpos: 'left', tistyle: 'tinted', initials: 'variants', avSize: 36, picon: 'circle', openbtn: 'outline', sicH: 25 }
const VARS: Record<string, string> = { sicH: '--sic-h', avSize: '--av-size' }
const ATTR = ['ststyle', 'stpos', 'tistyle', 'initials', 'picon', 'openbtn'] as const
const SHADES = ['50', '100', '200', '300', '500', '600', '700', '800', '900', '950']
const rgb = (hex: string) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim()); if (!m) return null; const n = parseInt(m[1], 16); return [n >> 16, (n >> 8) & 255, n & 255] }
const hx = (c: number[]) => '#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')
const mix = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t)
function palette(hex: string) {
  const c = rgb(hex); if (!c) return null
  const W = [255, 255, 255], K = [8, 14, 30]
  const t: Record<string, [number[], number]> = { 50: [W, 0.94], 100: [W, 0.88], 200: [W, 0.76], 300: [W, 0.55], 500: [W, 0.14], 600: [c, 0], 700: [K, 0.17], 800: [K, 0.33], 900: [K, 0.5], 950: [K, 0.64] }
  const out: Record<string, string> = {}; SHADES.forEach((s) => { out[s] = hx(mix(c, t[s][0], t[s][1])) }); return out
}
export function getTweaks(): Tweaks { let v = {}; try { v = JSON.parse(localStorage.getItem(KEY) || '{}') || {} } catch { v = {} } return Object.assign({}, DEF, v) }
export function applyTweaks(v: Tweaks) {
  const h = document.documentElement, st = h.style
  for (const k in VARS) { const val = (v as any)[k]; if (val !== (DEF as any)[k] && isFinite(+val)) st.setProperty(VARS[k], +val + 'px'); else st.removeProperty(VARS[k]) }
  const p = String(v.accent).toLowerCase() !== DEF.accent.toLowerCase() && palette(v.accent)
  SHADES.forEach((s) => { if (p) st.setProperty('--brand-' + s, p[s]); else st.removeProperty('--brand-' + s) })
  for (const k of ATTR) { if (v[k] !== DEF[k]) h.dataset[k] = String(v[k]); else delete h.dataset[k] }
  const tk = +v.tk; if (isFinite(tk) && tk !== DEF.tk) { st.setProperty('--tk', String(Math.max(0, Math.min(200, tk)) / 100)); h.dataset.tk = '' } else { st.removeProperty('--tk'); delete h.dataset.tk }
  const sc = +v.scale; (st as any).zoom = isFinite(sc) && sc !== DEF.scale ? String(Math.max(80, Math.min(120, sc)) / 100) : ''
}
export function setTweaks(v: Partial<Tweaks>) {
  const diff: Record<string, unknown> = {}
  for (const k in DEF) { const val = (v as any)[k]; if (val !== undefined && val !== (DEF as any)[k]) diff[k] = val }
  try { if (Object.keys(diff).length) localStorage.setItem(KEY, JSON.stringify(diff)); else localStorage.removeItem(KEY) } catch { /* storage blocked */ }
  applyTweaks(Object.assign({}, DEF, diff) as Tweaks)
}
