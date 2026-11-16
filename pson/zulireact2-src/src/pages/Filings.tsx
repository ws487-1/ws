// @ts-nocheck
import { useEffect, useState } from 'react'
import { Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { BackBtn, ErrorCard, FilingTable, PageHead, Pager, Rows, Note } from '@/components/z/bits'
import { N } from '@/lib/legacy'
import { ApiError, ch, normNumber } from '@/lib/data'
import { useLoad, setTitle } from '@/lib/hooks'
import { useCrumbs } from '@/lib/crumbs'
import { backFor } from '@/lib/store'
import { go, withParams, U } from '@/lib/router'
import { CompanyLine } from './Officers'

const ALL = '__all'
/* Expanded filing history: category, date range and text filters, 50 a page. */
export function FilingsPage({ route, n: raw }) {
  const n = normNumber(decodeURIComponent(raw || ''))
  const g = (k) => route.q.get(k) || ''
  const cat = g('category'), from = g('from'), to = g('to'), text = g('q').trim()
  const page = Math.max(1, parseInt(g('page'), 10) || 1), per = 50
  const path = '/company/' + n + '/filings'
  const nav = (o) => go(withParams(path, Object.assign({ category: cat, from, to, q: text }, o)))
  const [f, setF] = useState({ from, to, q: text })
  useEffect(() => setF({ from, to, q: text }), [route.key])
  const s = useLoad(async () => {
    const prof = await ch('/company/' + n)
    if (prof._http) throw new ApiError('404', 'No company found with number ' + n + '.')
    const base = '/company/' + n + '/filing-history' + (cat ? '?category=' + encodeURIComponent(cat) : '')
    if (!from && !to && !text) {
      const r = await ch(`${base}${cat ? '&' : '?'}items_per_page=${per}&start_index=${(page - 1) * per}`)
      return { prof, items: N.filings(r._http ? null : r).items, total: r._http ? 0 : r.total_count || 0, note: '' }
    }
    const CAP = 2000, all = []
    let start = 0, grand = Infinity, note = ''
    while (start < grand && all.length < CAP) {
      const r = await ch(`${base}${cat ? '&' : '?'}items_per_page=100&start_index=${start}`)
      if (r._http || !(r.items || []).length) break
      grand = r.total_count || 0; all.push(...r.items); start += r.items.length
      const last = r.items[r.items.length - 1]
      if (from && last.date && last.date < from) break
    }
    if (all.length >= CAP && start < grand) note = `Searched the latest ${all.length.toLocaleString('en-GB')} filings of ${grand.toLocaleString('en-GB')}. Narrow the date range to reach older ones.`
    const t = text.toLowerCase()
    const items = N.filings({ items: all, total_count: all.length }).items.filter((it) => (!from || it.dateIso >= from) && (!to || it.dateIso <= to) && (!t || (it.title + ' ' + it.typeCode + ' ' + it.categoryLabel).toLowerCase().includes(t)))
    return { prof, items: items.slice((page - 1) * per, page * per), total: items.length, note }
  }, [route.key])
  const name = s.data ? N.profile(s.data.prof).name : n
  useCrumbs([{ label: 'Companies', href: '#/search' }, { label: name, href: U.company(n) }, { label: 'Filing history' }], [name])
  useEffect(() => { setTitle(s.data ? 'Filing history · ' + name : 'Filing history') }, [s.data])
  const back = backFor(route.key)
  const cats = Object.entries(N.FH_CAT).sort((a: any, b: any) => a[1].localeCompare(b[1]))
  if (s.err) return <div className="z-stack"><BackBtn b={back} /><ErrorCard e={s.err} /></div>
  const d = s.data
  return <div className="z-stack">
    <BackBtn b={back} />
    <PageHead title="Filing history" desc={d ? <><CompanyLine p={d.prof} /> · {d.total.toLocaleString('en-GB')} filings</> : 'No. ' + n} />
    <Card><CardContent className="grid gap-4">
      <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[14rem_10rem_10rem_minmax(0,1fr)_auto] lg:items-end" onSubmit={(e) => { e.preventDefault(); nav({ from: f.from, to: f.to, q: f.q.trim(), page: '' }) }}>
        <div className="grid gap-1.5"><Label>Category</Label><Select value={cat || ALL} onValueChange={(v) => nav({ category: v === ALL ? '' : v, page: '' })}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>All categories</SelectItem>{cats.map(([k, v]: any) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
        <div className="grid gap-1.5"><Label htmlFor="flFrom">From</Label><Input id="flFrom" type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></div>
        <div className="grid gap-1.5"><Label htmlFor="flTo">To</Label><Input id="flTo" type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></div>
        <div className="grid gap-1.5"><Label htmlFor="flQ">Search</Label><Input id="flQ" type="search" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder="Description or form type" /></div>
        <div className="flex gap-2"><Button type="submit"><Search />Search</Button>{cat || from || to || text ? <Button variant="ghost" asChild><a href={'#' + path}><X />Clear</a></Button> : null}</div>
      </form>
      {s.loading ? <Rows n={8} /> : !d.items.length ? <p className="text-sm text-muted-foreground">{from || to || text ? 'No filings match these filters.' : 'No filings found.'}</p> : <>
        <FilingTable items={d.items} />
        <Pager page={page} pages={Math.ceil(d.total / per)} total={d.total} from={(page - 1) * per + 1} to={(page - 1) * per + d.items.length} href={(p) => '#' + withParams(path, { category: cat, from, to, q: text, page: p })} /></>}
      {d && d.note ? <Note>{d.note}</Note> : null}
    </CardContent></Card>
  </div>
}
