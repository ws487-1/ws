// @ts-nocheck
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { BackBtn, FilingRow, Loading, ErrorBox, Pager } from '@/components/z/bits'
import { N } from '@/lib/legacy'
import { ApiError, ch, normNumber } from '@/lib/data'
import { useLoad, setTitle } from '@/lib/hooks'
import { backFor } from '@/lib/store'
import { go, withParams } from '@/lib/router'
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
      const fl = N.filings(r._http ? null : r)
      return { prof, items: fl.items, total: r._http ? 0 : r.total_count || 0, note: '' }
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
  useEffect(() => { setTitle(s.data ? 'Filing history · ' + N.profile(s.data.prof).name : 'Filing history') }, [s.data])
  const back = backFor(route.key)
  const cats = Object.entries(N.FH_CAT).sort((a: any, b: any) => a[1].localeCompare(b[1]))
  if (s.err) return <><BackBtn b={back} /><div className="panel"><ErrorBox e={s.err} /></div></>
  const d = s.data
  return <>
    <BackBtn b={back} />
    <div className="page-head"><div><h1>Filing history</h1><div className="sub">{d ? <CompanyLine p={d.prof} /> : 'No. ' + n}</div></div></div>
    <div className="panel">
      <form className="fl-filters" onSubmit={(e) => { e.preventDefault(); nav({ from: f.from, to: f.to, q: f.q.trim(), page: '' }) }}>
        <label>Category<Select value={cat || ALL} onValueChange={(v) => nav({ category: v === ALL ? '' : v, page: '' })}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>All categories</SelectItem>{cats.map(([k, v]: any) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></label>
        <label>From<Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></label>
        <label>To<Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></label>
        <label className="grow">Search<Input type="search" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder="Description or form type" /></label>
        <div className="flex gap-1.5"><Button variant="outline" type="submit">Search</Button>{cat || from || to || text ? <Button variant="ghost" asChild><a href={'#' + path}>Clear</a></Button> : null}</div>
      </form>
      {s.loading ? <Loading /> : !d.items.length ? <div className="plain-msg">{from || to || text ? 'No filings match these filters.' : 'No filings found.'}</div> : <>
        <div>{d.items.map((it, i) => <FilingRow key={i} it={it} />)}</div>
        <Pager page={page} pages={Math.ceil(d.total / per)} total={d.total} from={(page - 1) * per + 1} to={(page - 1) * per + d.items.length} href={(p) => '#' + withParams(path, { category: cat, from, to, q: text, page: p })} /></>}
      {d && d.note ? <div className="note">{d.note}</div> : null}
    </div>
  </>
}
