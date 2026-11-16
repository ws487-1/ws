// @ts-nocheck
import { useEffect, useState } from 'react'
import { ApiError } from './data'
/* Runs an async loader when deps change; ignores stale results. */
export function useLoad<T>(fn: () => Promise<T>, deps: any[]) {
  const [s, setS] = useState<{ data?: T; err?: any; loading: boolean }>({ loading: true })
  useEffect(() => {
    let live = true
    setS({ loading: true })
    fn().then((data) => live && setS({ data, loading: false }), (err) => { if (!(err instanceof ApiError)) console.error(err); if (live) setS({ err, loading: false }) })
    return () => { live = false }
  }, deps)
  return s
}
export const setTitle = (t?: string) => { document.title = t ? t + ' · Zuli' : 'Zuli' }
