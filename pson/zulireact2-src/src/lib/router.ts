import { useSyncExternalStore } from 'react'
// Hash routing (#/company/09446231) so every deep link works on GitHub Pages without a server rewrite.
const sub = (cb: () => void) => { window.addEventListener('hashchange', cb); return () => window.removeEventListener('hashchange', cb) }
const snap = () => window.location.hash || '#/'
export type Route = { path: string; parts: string[]; q: URLSearchParams; key: string }
export function parse(hash: string): Route {
  const h = hash.replace(/^#/, '') || '/'
  const [p, s] = h.split('?')
  const path = p.startsWith('/') ? p : '/' + p
  return { path, parts: path.split('/').filter(Boolean), q: new URLSearchParams(s || ''), key: h }
}
export function useRoute(): Route { return parse(useSyncExternalStore(sub, snap)) }
export const go = (to: string) => { window.location.hash = to.startsWith('#') ? to : '#' + to }
export const withParams = (base: string, params: Record<string, unknown>) => {
  const s = new URLSearchParams(Object.entries(params).filter(([k, v]) => v != null && v !== '' && !(k === 'page' && +(v as any) === 1)).map(([k, v]) => [k, String(v)])).toString()
  return s ? base + '?' + s : base
}
export const U = {
  home: () => '#/',
  search: (p: Record<string, unknown>) => '#' + withParams('/search', p),
  company: (n: string) => '#/company/' + encodeURIComponent(n),
  officers: (n: string, view?: string) => '#/company/' + encodeURIComponent(n) + '/officers' + (view ? '?view=' + view : ''),
  filings: (n: string) => '#/company/' + encodeURIComponent(n) + '/filings',
  person: (ids: string | string[]) => '#/person?id=' + [].concat(ids as any).map(encodeURIComponent).join(','),
  psc: (id: string) => '#/person?psc=' + encodeURIComponent(id),
  disq: (kind: string, id: string) => '#/person?disq=' + encodeURIComponent(id) + (kind === 'corporate' ? '&k=corporate' : ''),
}
