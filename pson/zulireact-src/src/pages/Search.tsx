// @ts-nocheck
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tile, TileHead, KindIcon, St, Pager, Loading, ErrorBox } from '@/components/z/bits'
import { ADV_FIELDS, FilterSummary, useFilters } from '@/components/z/filters'
import { E, N } from '@/lib/legacy'
import { ch, isNumber, normNumber, pastedTarget } from '@/lib/data'
import { useLoad, setTitle } from '@/lib/hooks'
import { go, withParams, U } from '@/lib/router'
import { fmtWhen, saveViewed, viewedList, viewHref, viewKey } from '@/lib/store'
import { NoKey } from './Home'
import { Clock } from 'lucide-react'

const TYPES = [['companies', 'Companies'], ['people', 'People'], ['disqualified', 'Disqualified']]
const ResRow = ({ c, extra }: any) => <div className="res"><div className="res-nm"><KindIcon kind="company" /><a className="nm" href={U.company(c.number)}>{c.name}</a></div><div className="rt"><St label={c.status} colour={c.colour} /></div>
  <div className="meta">{['No. ' + c.number, c.type, c.created && 'Incorporated ' + c.created, c.ceased && 'Ceased ' + c.ceased].filter(Boolean).join(' · ')}</div>
  {c.address ? <div className="addr">{c.address}</div> : null}{extra}</div>
const Msg = ({ t }) => <div className="plain-msg">{t}</div>

async function run(r) {
  const q = (r.q.get('q') || '').trim(), g = (k) => r.q.get(k) || ''
  const type = ['people', 'disqualified'].includes(g('type')) ? g('type') : 'companies'
  const mode = ['advanced', 'az', 'dissolved'].includes(g('mode')) ? g('mode') : ''
  const page = Math.max(1, parseInt(g('page'), 10) || 1)
  const pg = (per, total, shown, href) => ({ page, pages: Math.ceil(total / per), from: (page - 1) * per + 1, to: (page - 1) * per + shown, href })
  if (mode === 'advanced') {
    const map = { company_name_includes: g('includes'), company_name_excludes: g('excludes'), company_status: g('status'), company_type: g('ctype'), company_subtype: g('subtype'), sic_codes: g('sic'), location: g('loc'), incorporated_from: g('incf'), incorporated_to: g('inct'), dissolved_from: g('disf'), dissolved_to: g('dist') }
    const params = Object.entries(map).filter(([, v]) => v)
    if (!params.length) return { msg: 'Choose at least one filter.' }
    const per = 20, raw = await ch('/advanced-search/companies?' + new URLSearchParams(params.concat([['size', String(per)], ['start_index', String((page - 1) * per)]])).toString())
    const res = N.searchList(raw)
    if (!res.items.length) return { msg: 'No companies match these filters.' }
    return { rows: res.items.map((c) => <ResRow key={c.number} c={c} extra={c.sic.length ? <div className="addr">SIC {c.sic.join(', ')}</div> : null} />), total: res.total, pager: pg(per, Math.min(res.total, 10000), res.items.length, (p) => '#' + withParams('/search', Object.assign({ mode }, Object.fromEntries(ADV_FIELDS.concat(['near', 'neartown']).map((k) => [k, g(k)])), { page: p }))) }
  }
  if (mode === 'az') {
    const after = g('after')
    const raw = await ch(`/alphabetical-search/companies?q=${encodeURIComponent(q)}&size=${after ? 40 : 20}`)
    let res = N.searchList(raw).items
    if (after) res = res.filter((c) => c.key > after).slice(0, 20)
    if (!res.length) return { msg: 'No companies found.' }
    const last = res[res.length - 1]
    return { rows: res.map((c) => <ResRow key={c.number} c={c} />), next: '#' + withParams('/search', { mode: 'az', q: last.name, after: last.key }) }
  }
  if (mode === 'dissolved') {
    const per = 20, prev = !!g('prev')
    const raw = await ch(`/dissolved-search/companies?q=${encodeURIComponent(q)}&search_type=${prev ? 'previous-name-dissolved' : 'best-match'}&size=${per}&start_index=${(page - 1) * per}`)
    const res = N.searchList(raw)
    if (!res.items.length) return { msg: 'No dissolved companies found.' }
    return { rows: res.items.map((c) => <ResRow key={c.number} c={c} extra={c.previous.length ? <div className="addr">Previous names: {c.previous.map((x) => x.name + (x.to ? ' (until ' + x.to + ')' : '')).join('; ')}</div> : null} />), total: res.total, pager: pg(per, Math.min(res.total, 10000), res.items.length, (p) => '#' + withParams('/search', { mode, q, prev: prev ? 1 : '', page: p })) }
  }
  if (type === 'companies') {
    const per = 20, raw = await ch(`/search/companies?q=${encodeURIComponent(q)}&items_per_page=${per}&start_index=${(page - 1) * per}`)
    const res = N.searchCompanies(raw)
    if (!res.items.length) return { msg: 'No companies found.' }
    return { rows: res.items.map((c) => <ResRow key={c.number} c={{ ...c, type: '' }} />), total: res.total, pager: pg(per, Math.min(res.total, 1000), res.items.length, (p) => '#' + withParams('/search', { q, page: p })) }
  }
  if (type === 'people') {
    const per = 50, raw = await ch(`/search/officers?q=${encodeURIComponent(q)}&items_per_page=${per}&start_index=${(page - 1) * per}`)
    const res = N.searchOfficers(raw)
    if (!res.groups.length) return { msg: 'No people found.' }
    return { rows: res.groups.map((x) => <div className="res" key={x.ids.join(',')}><div className="res-nm"><KindIcon kind="person" name={x.name} /><a className="nm" href={U.person(x.ids)}>{x.name}</a></div><div className="rt">{x.count} appointment{x.count === 1 ? '' : 's'}</div>
      <div className="meta">{x.born ? 'Born ' + x.born : 'Date of birth not shown'}{x.ids.length > 1 ? ` · ${x.ids.length} Companies House records` : ''}</div>{x.addresses[0] ? <div className="addr">{x.addresses[0]}</div> : null}</div>),
      total: res.total, pager: pg(per, Math.min(res.total, 1000), res.loaded, (p) => '#' + withParams('/search', { q, type: 'people', page: p })) }
  }
  const per = 20, raw = await ch(`/search/disqualified-officers?q=${encodeURIComponent(q)}&items_per_page=${per}&start_index=${(page - 1) * per}`)
  const res = N.searchDisqualified(raw)
  if (!res.items.length) return { msg: 'No disqualified directors found.' }
  return { rows: res.items.map((d) => <div className="res" key={d.id}><div className="res-nm"><KindIcon kind={d.kind === 'corporate' ? 'company' : 'person'} name={d.name} /><a className="nm" href={U.disq(d.kind, d.id)}>{d.name}</a></div><div className="rt" />
    <div className="meta">{d.description}</div>{d.address ? <div className="addr">{d.address}</div> : null}</div>), total: res.total, pager: pg(per, Math.min(res.total, 1000), res.items.length, (p) => '#' + withParams('/search', { q, type: 'disqualified', page: p })) }
}

/* Recently viewed, full list: latest 10, 'Show 10 more' up to 100; rows can be removed or the list cleared. */
function Viewed() {
  const [l, setL] = useState(viewedList())
  const [n, setN] = useState(10)
  if (!l.length) return null
  const shown = Math.min(Math.max(n, 10), l.length)
  const rm = (k) => { const x = viewedList().filter((r) => viewKey(r) !== k); saveViewed(x); setL(x) }
  return <Tile className="mt-(--gap)"><TileHead title="Recently viewed" icon={Clock} count={l.length} aside={<button type="button" className="lnk" onClick={() => { saveViewed([]); setL([]) }}>Clear all</button>} />
    <div>{l.slice(0, shown).map((r) => <div className="res" key={viewKey(r)}><div className="res-nm"><KindIcon kind={r.type === 'person' ? 'person' : 'company'} name={r.name} label={r.type === 'company' ? 'Company' : r.type === 'person' ? 'Person' : 'Company (officer or owner)'} /><a className="nm" href={viewHref(r)}>{r.name}</a></div>
      <div className="rt"><button type="button" className="lnk" onClick={() => rm(viewKey(r))} aria-label={'Remove ' + r.name + ' from recently viewed'}>Remove</button></div>
      <div className="meta">{[r.type === 'company' && 'No. ' + r.id, fmtWhen(r.t) && (r.type === 'company' ? 'viewed ' : 'Viewed ') + fmtWhen(r.t)].filter(Boolean).join(' · ')}</div></div>)}</div>
    {l.length > shown ? <div className="mt-2.5 flex items-center gap-2.5 text-[12px] text-(--ink-500)"><Button variant="outline" size="sm" onClick={() => setN(shown + 10)}>Show {Math.min(10, l.length - shown)} more</Button>Showing {shown} of {l.length}</div> : null}
  </Tile>
}

export function SearchPage({ route }) {
  const filters = useFilters()
  const g = (k) => route.q.get(k) || ''
  const q = g('q').trim()
  const type = ['people', 'disqualified'].includes(g('type')) ? g('type') : 'companies'
  const mode = ['advanced', 'az', 'dissolved'].includes(g('mode')) ? g('mode') : ''
  const page = Math.max(1, parseInt(g('page'), 10) || 1)
  const jump = q && !mode && page === 1 ? pastedTarget(q) || (type === 'companies' && isNumber(q) ? U.company(normNumber(q)) : '') : ''
  useEffect(() => { if (jump) window.location.replace(jump) }, [jump])
  const empty = !q && !mode
  const s = useLoad(() => (empty || jump ? Promise.resolve(null) : run(route)), [route.key])
  let title
  const sicOnly = g('sic') && !g('sic').includes(',') && !g('includes')
  if (empty) title = 'Search'
  else if (mode === 'advanced') title = sicOnly && E.sic2007 && E.sic2007[g('sic')] ? `SIC ${g('sic')}: ${E.sic2007[g('sic')]}` : 'Filtered companies'
  else if (mode === 'az') title = `A–Z from “${q}”`
  else if (mode === 'dissolved') title = `Dissolved companies${g('prev') ? ' with a previous name like' : ' named'} “${q}”`
  else title = `Results for “${q}”`
  useEffect(() => setTitle(title), [title])
  if (empty) return <><div className="page-head"><div><h1>Search</h1><div className="sub">Search Companies House by company name or number, or by a person's name. You can also paste a Companies House link or officer ID. For filters, use the filter button next to the search box.</div></div></div><NoKey /><Viewed /></>
  const near = mode === 'advanced' ? g('near').trim() : ''
  const nearHere = g('loc') === near, town = g('neartown')
  const nearBase = Object.fromEntries(ADV_FIELDS.concat(['near', 'neartown']).map((k) => [k, g(k)]))
  return <>
    <div className="page-head"><div><h1>{title}</h1></div></div>
    {mode === 'advanced' ? <FilterSummary q={route.q} onEdit={filters.open} /> : mode ? <div className="f-sum"><span /><button type="button" className="lnk" onClick={filters.open}>Edit filters</button></div> : null}
    {near ? <Tabs value={nearHere ? 'near' : 'uk'} onValueChange={(v) => go(withParams('/search', Object.assign({ mode }, nearBase, { loc: v === 'near' ? near : '' })))} className="mb-(--gap)"><TabsList aria-label="Area"><TabsTrigger value="uk">Whole UK</TabsTrigger><TabsTrigger value="near">Near {near}{town && town.toUpperCase() !== near.toUpperCase() ? ' (' + town + ')' : ''}</TabsTrigger></TabsList></Tabs> : null}
    {!mode ? <Tabs value={type} onValueChange={(v) => go(withParams('/search', { q, type: v === 'companies' ? '' : v }))} className="mb-(--gap)"><TabsList aria-label="Result type">{TYPES.map(([k, l]) => <TabsTrigger key={k} value={k}>{l}</TabsTrigger>)}</TabsList></Tabs> : null}
    <div className="panel" id="res">{s.loading || jump ? <Loading t="Searching…" /> : s.err ? <ErrorBox e={s.err} /> : s.data.msg ? <Msg t={s.data.msg} /> : <>
      <div>{s.data.rows}</div>
      {s.data.pager ? <Pager {...s.data.pager} total={s.data.total} /> : null}
      {s.data.next ? <div className="pager"><span>Alphabetical list</span><Button variant="outline" size="sm" asChild><a href={s.data.next}>Next</a></Button></div> : null}</>}</div>
  </>
}
