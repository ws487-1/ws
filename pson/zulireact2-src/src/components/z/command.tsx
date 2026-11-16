// @ts-nocheck
import { useEffect, useRef, useState } from 'react'
import { House, Search, Bookmark, Bell, Settings, SlidersHorizontal, Users, Ban, Moon, Sun, Building2, UserRound, Clock, Palette, ArrowRight } from 'lucide-react'
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut } from '@/components/ui/command'
import { ch } from '@/lib/data'
import { N } from '@/lib/legacy'
import { chKey, viewedList, viewHref } from '@/lib/store'
import { go, withParams, U } from '@/lib/router'
import { useTweaks } from '@/lib/tweaks'

/* ⌘K palette: live company/people lookup (debounced, 5 each), recently viewed, pages and actions. */
export function CommandPalette({ open, onOpenChange, openFilters, openXp }) {
  const [q, setQ] = useState('')
  const [res, setRes] = useState({ co: [], pp: [], loading: false, err: '' })
  const [tw, setTw] = useTweaks()
  const seq = useRef(0)
  useEffect(() => { if (!open) setQ('') }, [open])
  useEffect(() => {
    const t = q.trim(), id = ++seq.current
    if (t.length < 2 || !chKey()) { setRes({ co: [], pp: [], loading: false, err: '' }); return }
    setRes((r) => ({ ...r, loading: true }))
    const h = setTimeout(async () => {
      try {
        const [a, b] = await Promise.all([ch(`/search/companies?q=${encodeURIComponent(t)}&items_per_page=5`), ch(`/search/officers?q=${encodeURIComponent(t)}&items_per_page=15`)])
        if (id !== seq.current) return
        setRes({ co: N.searchCompanies(a).items.slice(0, 5), pp: N.searchOfficers(b).groups.slice(0, 5), loading: false, err: '' })
      } catch (e) { if (id === seq.current) setRes({ co: [], pp: [], loading: false, err: 'Search failed' }) }
    }, 250)
    return () => clearTimeout(h)
  }, [q])
  const run = (fn) => () => { onOpenChange(false); setTimeout(fn, 0) }
  const t = q.trim(), lc = t.toLowerCase()
  const m = (s) => !lc || s.toLowerCase().includes(lc)
  const rv = viewedList().filter((r) => m(r.name)).slice(0, 5)
  const pages = [['Home', '#/', House], ['Search', '#/search', Search], ['Saved', '#/saved', Bookmark], ['Alerts', '#/alerts', Bell], ['Settings', '#/settings', Settings]].filter(([l]) => m(l))
  const dark = document.documentElement.classList.contains('dark')
  const acts = [
    ['Filters', 'filters', SlidersHorizontal, openFilters],
    ['Experimental settings', 'appearance theme', Palette, openXp],
    [dark ? 'Switch to light mode' : 'Switch to dark mode', 'theme dark light', dark ? Sun : Moon, () => setTw('mode', dark ? 'light' : 'dark')],
  ].filter(([l, k]) => m(l) || m(k))
  return <CommandDialog open={open} onOpenChange={onOpenChange} title="Search Zuli" description="Search companies and people, or jump to a page"><Command shouldFilter={false}>
    <CommandInput value={q} onValueChange={setQ} placeholder="Search companies, people, pages…" />
    <CommandList className="max-h-[min(70vh,26rem)]">
      <CommandEmpty>{res.loading ? 'Searching…' : res.err || 'No results.'}</CommandEmpty>
      {t ? <CommandGroup heading="Search Companies House">
        <CommandItem value={'s-co ' + t} onSelect={run(() => go(withParams('/search', { q: t })))}><Search />Companies matching “{t}”<CommandShortcut>↵</CommandShortcut></CommandItem>
        <CommandItem value={'s-pp ' + t} onSelect={run(() => go(withParams('/search', { q: t, type: 'people' })))}><Users />People matching “{t}”</CommandItem>
        <CommandItem value={'s-dq ' + t} onSelect={run(() => go(withParams('/search', { q: t, type: 'disqualified' })))}><Ban />Disqualified directors matching “{t}”</CommandItem>
      </CommandGroup> : null}
      {res.co.length ? <CommandGroup heading="Companies">{res.co.map((c) => <CommandItem key={c.number} value={'co ' + c.number} onSelect={run(() => { location.hash = U.company(c.number) })}><Building2 /><span className="truncate">{c.name}</span><CommandShortcut className="tracking-normal">{c.number}</CommandShortcut></CommandItem>)}</CommandGroup> : null}
      {res.pp.length ? <CommandGroup heading="People">{res.pp.map((x) => <CommandItem key={x.ids.join(',')} value={'pp ' + x.ids.join(',')} onSelect={run(() => { location.hash = U.person(x.ids) })}><UserRound /><span className="truncate">{x.name}</span><CommandShortcut className="tracking-normal">{x.born || ''}</CommandShortcut></CommandItem>)}</CommandGroup> : null}
      {rv.length ? <CommandGroup heading="Recently viewed">{rv.map((r) => <CommandItem key={viewHref(r)} value={'rv ' + viewHref(r)} onSelect={run(() => { location.hash = viewHref(r) })}><Clock /><span className="truncate">{r.name}</span></CommandItem>)}</CommandGroup> : null}
      {pages.length || acts.length ? <CommandSeparator /> : null}
      {pages.length ? <CommandGroup heading="Pages">{pages.map(([l, h, Ic]) => <CommandItem key={h} value={'pg ' + l} onSelect={run(() => { location.hash = h })}><Ic />{l}</CommandItem>)}</CommandGroup> : null}
      {acts.length ? <CommandGroup heading="Actions">{acts.map(([l, , Ic, fn]) => <CommandItem key={l} value={'ac ' + l} onSelect={run(fn)}><Ic />{l}</CommandItem>)}</CommandGroup> : null}
    </CommandList>
  </Command></CommandDialog>
}
