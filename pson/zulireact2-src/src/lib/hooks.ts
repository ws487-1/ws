// @ts-nocheck
import { useEffect, useState } from 'react'
import { ApiError } from './data'
/* Runs an async loader when deps change; ignores stale results. */
/* peek: optional synchronous cache read; when it returns data the first render already has it (no placeholders). */
export function useLoad<T>(fn: () => Promise<T>, deps: any[], peek?: () => T | undefined) {
  const first = () => { const v = peek ? peek() : undefined; return v !== undefined ? { data: v, loading: false, cached: true } : { loading: true } }
  const [s, setS] = useState<{ data?: T; err?: any; loading: boolean; cached?: boolean }>(first)
  useEffect(() => {
    let live = true
    const v = peek ? peek() : undefined
    if (v !== undefined) { setS({ data: v, loading: false, cached: true }); return () => { live = false } }
    setS({ loading: true })
    fn().then((data) => live && setS({ data, loading: false }), (err) => { if (!(err instanceof ApiError)) console.error(err); if (live) setS({ err, loading: false }) })
    return () => { live = false }
  }, deps)
  return s
}
export const setTitle = (t?: string) => { document.title = t ? t + ' · Zuli' : 'Zuli' }
