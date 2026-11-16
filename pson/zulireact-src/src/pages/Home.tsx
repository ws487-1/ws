// @ts-nocheck
import { useEffect, useRef, useState } from 'react'
import { Search, SlidersHorizontal, Clock, Bookmark, Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tile, TileHead, KindIcon } from '@/components/z/bits'
import { useFilters } from '@/components/z/filters'
import { chKey, saved, savedHref, viewedList, viewHref } from '@/lib/store'
import { go, withParams } from '@/lib/router'
import { setTitle } from '@/lib/hooks'

export const NoKey = () => (chKey() ? null : <div className="panel plain-msg mb-(--gap)">Add your Companies House API key in <a className="lnk" href="#/settings">Settings</a> to start searching.</div>)

/* Home: Zuli-blue banner with a greeting and a floating search, shortcut cards, then Recently viewed and Saved. */
export function Home() {
  const [type, setType] = useState('companies')
  const [q, setQ] = useState('')
  const ref = useRef<HTMLInputElement>(null)
  const filters = useFilters()
  useEffect(() => { setTitle('Home'); ref.current?.focus() }, [])
  const hr = new Date().getHours(), greet = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening'
  const rv = viewedList(), sv = saved()
  const row = (k, name, href, rt) => <div className="res" key={href}><div className="res-nm"><KindIcon kind={k} name={name} label={k === 'person' ? 'Person' : 'Company'} /><a className="nm" href={href}>{name}</a></div><div className="rt">{rt}</div></div>
  return <>
    <h1 className="sr-only">Home</h1>
    <div className="home-z"><form className="home-big" role="search" onSubmit={(e) => { e.preventDefault(); const v = q.trim(); if (v) go(withParams('/search', { q: v, type: type === 'companies' ? '' : type })) }}>
      <p className="home-greet">{greet}</p><label className="home-big-l" htmlFor="homeQ">Look up any UK company</label>
      <div className="home-big-r"><span className="home-big-ic" aria-hidden="true"><Search /></span>
        <Input ref={ref} id="homeQ" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Company name or number, or a person's name" />
        <Button variant="outline" size="icon" type="button" onClick={filters.open} aria-label="More filters" title="More filters"><SlidersHorizontal /></Button>
        <Button type="submit" className="grow-btn">Search</Button></div>
      <div className="home-scope"><Tabs value={type} onValueChange={(v) => { setType(v); ref.current?.focus() }}><TabsList aria-label="Search in">{[['companies', 'Companies'], ['people', 'People'], ['disqualified', 'Disqualified']].map(([k, l]) => <TabsTrigger key={k} value={k}>{l}</TabsTrigger>)}</TabsList></Tabs></div>
    </form></div>
    <NoKey />
    <div className="home-cards">
      <a className="hcard" href="#/search"><span className="hc-ic"><Clock /></span><span><b className="num">{rv.length}</b><small>Recently viewed</small></span></a>
      <a className="hcard" href="#/saved"><span className="hc-ic"><Bookmark /></span><span><b className="num">{sv.length}</b><small>Saved</small></span></a>
      <a className="hcard" href="#/alerts"><span className="hc-ic"><Bell /></span><span><b>Soon</b><small>Alerts</small></span></a>
    </div>
    <div className="bento">
      <Tile className="s7"><TileHead title="Recently viewed" icon={Clock} aside={<a className="lnk" href="#/search">See all</a>} open={{ href: '#/search', label: 'Open recently viewed' }} />
        {rv.length ? <div>{rv.slice(0, 6).map((r) => row(r.type === 'company' ? 'company' : 'person', r.name, viewHref(r), r.type === 'company' ? 'No. ' + r.id : ''))}</div> : <div className="plain-msg">Nothing viewed yet.</div>}</Tile>
      <Tile className="s5"><TileHead title="Saved" icon={Bookmark} aside={<a className="lnk" href="#/saved">All saved</a>} open={{ href: '#/saved', label: 'Open saved' }} />
        {sv.length ? <div>{sv.slice(0, 4).map((x) => row(x.kind === 'person' ? 'person' : 'company', x.name, savedHref(x), x.kind === 'person' ? '' : 'No. ' + x.number))}</div> : <div className="plain-msg">Nothing saved yet.</div>}</Tile>
    </div>
  </>
}
