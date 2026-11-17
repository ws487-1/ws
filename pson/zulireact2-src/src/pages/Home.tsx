// @ts-nocheck
import { useEffect, useRef, useState } from 'react'
import { Search, SlidersHorizontal, Clock, Bookmark, Bell, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Mark, OpenBtn, Section, Stat, Muted } from '@/components/z/bits'
import { useFilters } from '@/components/z/filters'
import { chKey, saved, savedHref, viewedList, viewHref } from '@/lib/store'
import { go, withParams } from '@/lib/router'
import { setTitle } from '@/lib/hooks'
import { useCrumbs } from '@/lib/crumbs'
import { useTweaks } from '@/lib/tweaks'

export const NoKey = () => (chKey() ? null : <Card><CardContent className="flex flex-wrap items-center justify-between gap-3"><div className="grid gap-0.5"><p className="font-medium">Add your Companies House API key</p><Muted>Zuli needs it to search and load records. It stays in this browser.</Muted></div><Button asChild><a href="#/settings">Open Settings<ArrowRight /></a></Button></CardContent></Card>)
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
export const Kbd = ({ children }) => <kbd className="pointer-events-none inline-flex h-5 items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground select-none">{children}</kbd>
export const ModK = () => <Kbd><span className="text-xs">{isMac ? '⌘' : 'Ctrl'}</span>K</Kbd>

export function Home() {
  const [type, setType] = useState('companies')
  const [q, setQ] = useState('')
  const ref = useRef<HTMLInputElement>(null)
  const filters = useFilters()
  const [tw] = useTweaks()
  useCrumbs([{ label: 'Home' }], [])
  useEffect(() => { setTitle('Home') }, [])
  const hr = new Date().getHours(), greet = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening'
  const rv = viewedList(), sv = saved()
  const row = (k, name, href, rt) => <a key={href} href={href} className="flex items-center gap-3 rounded-md px-2 py-2 -mx-2 transition-colors hover:bg-accent"><Mark kind={k} name={name} /><span className="min-w-0 flex-1 truncate text-sm font-medium">{name}</span><span className="shrink-0 text-xs text-muted-foreground">{rt}</span></a>
  return <div className="z-stack">
    <Card><CardContent className={tw.homeSearch === 'compact' ? 'grid gap-3' : 'grid justify-items-center gap-5 py-6 text-center sm:py-10'}>
      {tw.homeSearch === 'compact' ? <h1 className="text-xl font-semibold tracking-tight">Look up any UK company</h1> : <div className="grid gap-2"><p className="text-sm text-muted-foreground">{greet}</p><h1 className="z-hero text-3xl font-semibold tracking-tight sm:text-4xl">Look up any UK company</h1></div>}
      <form role="search" className={tw.homeSearch === 'compact' ? 'flex w-full flex-col gap-2 sm:flex-row' : 'flex w-full max-w-2xl flex-col gap-2 sm:flex-row'} onSubmit={(e) => { e.preventDefault(); const v = q.trim(); if (v) go(withParams('/search', { q: v, type: type === 'companies' ? '' : type })) }}>
        <div className="relative flex-1"><Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" /><Input ref={ref} id="homeQ" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Company name or number, or a person's name" className={tw.homeSearch === 'compact' ? 'pl-9' : 'h-10 pl-9'} autoFocus /></div>
        <div className="flex gap-2"><Button type="button" variant="outline" size="lg" onClick={filters.open}><SlidersHorizontal />Filters</Button><Button type="submit" size="lg" className="flex-1 sm:flex-none">Search</Button></div>
      </form>
      <Tabs value={type} onValueChange={(v) => { setType(v); ref.current?.focus() }}><TabsList aria-label="Search in"><TabsTrigger value="companies">Companies</TabsTrigger><TabsTrigger value="people">People</TabsTrigger><TabsTrigger value="disqualified">Disqualified</TabsTrigger></TabsList></Tabs>
      {tw.kbd === 'on' ? <p className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">Search from anywhere with <ModK /></p> : null}
    </CardContent></Card>
    <NoKey />
    <div className="bento">
      <div className="s4"><Stat style={tw.stat} icon={Clock} label="Recently viewed" value={rv.length} sub="Companies and people" href="#/search" /></div>
      <div className="s4"><Stat style={tw.stat} icon={Bookmark} label="Saved" value={sv.length} sub="In this browser" href="#/saved" /></div>
      <div className="s4"><Stat style={tw.stat} icon={Bell} label="Alerts" value="Soon" sub="Filing and officer changes" href="#/alerts" /></div>
      <div className="s7"><Section icon={Clock} title="Recently viewed" desc={rv.length ? 'Latest ' + Math.min(6, rv.length) + ' of ' + rv.length : 'Nothing yet'} action={<OpenBtn href="#/search" label="All recently viewed" />}>
        {rv.length ? <div className="grid">{rv.slice(0, 6).map((r) => row(r.type === 'company' ? 'company' : 'person', r.name, viewHref(r), r.type === 'company' ? 'No. ' + r.id : ''))}</div> : <Muted>Nothing viewed yet.</Muted>}</Section></div>
      <div className="s5"><Section icon={Bookmark} title="Saved" desc={sv.length ? sv.length + ' saved' : 'Nothing yet'} action={<OpenBtn href="#/saved" label="All saved" />}>
        {sv.length ? <div className="grid">{sv.slice(0, 4).map((x) => row(x.kind === 'person' ? 'person' : 'company', x.name, savedHref(x), x.kind === 'person' ? '' : 'No. ' + x.number))}</div> : <Muted>Nothing saved yet.</Muted>}</Section></div>
    </div>
  </div>
}
