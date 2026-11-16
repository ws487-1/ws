// @ts-nocheck
/* Breadcrumbs: pages publish their trail; the top bar renders it with the shadcn Breadcrumb. */
import { useEffect, useSyncExternalStore } from 'react'
let cur: { label: string; href?: string }[] = []
const subs = new Set<() => void>()
export const useCrumbTrail = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f) }, () => cur)
export function useCrumbs(trail, deps) { useEffect(() => { cur = trail; subs.forEach((f) => f()) }, deps) }
