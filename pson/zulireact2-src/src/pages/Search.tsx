// @ts-nocheck
import { useEffect, useState } from 'react'
import { Clock, Trash2, X, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Mark, St, Pager, Rows, ErrorCard, PageHead, Section, Muted } from '@/components/z/bits'
import { ADV_FIELDS, FilterSummary, useFilters } from '@/components/z/filters'
import { E, N } from '@/lib/legacy'
import { ch, isNumber, normNumber, pastedTarget } from '@/lib/data'
import { useLoad, setTitle } from '@/lib/hooks'
import { useCrumbs } from '@/lib/crumbs'
import { go, withParams, U } from '@/lib/router'
import { note } from '@/lib/toast'
import { fmtWhen, saveViewed, viewedList, viewHref, viewKey } from '@/lib/store'
import { NoKey } from './Home'

const TYPES = [['companies', 'Companies'], ['people', 'People'], ['disqualified', 'Disqualified']]
/* One result row: marker, name, status on the right, meta and address below. */
const Row = ({ kind, name, href, right, meta, addr, extra }: any) => <div className="flex gap-3 py-3"><Mark kind={kind} name={name} /><div className="grid min-w-0 flex-1 gap-0.5">
  <div className="flex items-baseline justify-between gap-3"><a className="truncate font-medium hover:underline" href={href}>{name}</a><span className="shrink-0 text-sm">{right}</span></div>
  {meta ? <div className="text-xs text-muted-foreground">{meta}</div> : null}{addr ? <div className="text-xs text-muted-foreground">{addr}</div> : null}{extra}</div></div>
const CoRow = ({ c, extra }: any) => <Row kind="company" name={c.name} href={U.company(c.number)} right={<St label={c.status} colour={c.colour} />} meta={['No. ' + c.number, c.type, c.created && 'Incorporated ' + c.created, c.ceased && 'Ceased ' + c.ceased].filter(Boolean).join(' · ')} addr={c.address} extra={extra} />

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
    return { rows: res.items.map((c) => <CoRow key={c.number} c={c} extra={c.sic.length ? <div className="text-xs text-muted-foreground">SIC {c.sic.join(', ')}</div> : null} />), total: res.total, pager: pg(per, Math.min(res.total, 10000), res.items.length, (p) => '#' + withParams('/search', Object.assign({ mode }, Object.fromEntries(ADV_FIELDS.concat(['near', 'neartown']).map((k) => [k, g(k)])), { page: p }))) }
  }
  if (mode === 'az') {
    const after = g('after')
    const raw = await ch(`/alphabetical-search/companies?q=${encodeURIComponent(q)}&size=${after ? 40 : 20}`)
    let res = N.searchList(raw).items
    if (after) res = res.filter((c) => c.key > after).slice(0, 20)
    if (!res.length) return { msg: 'No companies found.' }
    const last = res[res.length - 1]
    return { rows: res.map((c) => <CoRow key={c.number} c={c} />), next: '#' + withParams('/search', { mode: 'az', q: last.name, after: last.key }) }
  }
  if (mode === 'dissolved') {
    const per = 20, prev = !!g('prev')
    const raw = await ch(`/dissolved-search/companies?q=${encodeURIComponent(q)}&search_type=${prev ? 'previous-name-dissolved' : 'best-match'}&size=${per}&start_index=${(page - 1) * per}`)
    const res = N.searchList(raw)
    if (!res.items.length) return { msg: 'No dissolved companies found.' }
    return { rows: res.items.map((c) => <CoRow key={c.number} c={c} extra={c.previous.length ? <div className="text-xs text-muted-foreground">Previous names: {c.previous.map((x) => x.name + (x.to ? ' (until ' + x.to + ')' : '')).join('; ')}</div> : null} />), total: res.total, pager: pg(per, Math.min(res.total, 10000), res.items.length, (p) => '#' + withParams('/search', { mode, q, prev: prev ? 1 : '', page: p })) }
  }
  if (type === 'companies') {
    const per = 20, raw = await ch(`/search/companies?q=${encodeURIComponent(q)}&items_per_page=${per}&start_index=${(page - 1) * per}`)
    const res = N.searchCompanies(raw)
    if (!res.items.length) return { msg: 'No companies found.' }
    return { rows: res.items.map((c) => <CoRow key={c.number} c={{ ...c, type: '' }} />), total: res.total, pager: pg(per, Math.min(res.total, 1000), res.items.length, (p) => '#' + withParams('/search', { q, page: p })) }
  }
  if (type === 'people') {
    const per = 50, raw = await ch(`/search/officers?q=${encodeURIComponent(q)}&items_per_page=${per}&start_index=${(page - 1) * per}`)
    const res = N.searchOfficers(raw)
    if (!res.groups.length) return { msg: 'No people found.' }
    return { rows: res.groups.map((x) => <Row key={x.ids.join(',')} kind="person" name={x.name} href={U.person(x.ids)} right={<span className="text-xs text-muted-foreground">{x.count} appointment{x.count === 1 ? '' : 's'}</span>} meta={(x.born ? 'Born ' + x.born : 'Date of birth not shown') + (x.ids.length > 1 ? ` · ${x.ids.length} Companies House records` : '')} addr={x.addresses[0]} />),
      total: res.total, pager: pg(per, Math.min(res.total, 1000), res.loaded, (p) => '#' + withParams('/search', { q, type: 'people', page: p })) }
  }
  const per = 20, raw = await ch(`/search/disqualified-officers?q=${encodeURIComponent(q)}&items_per_page=${per}&start_index=${(page - 1) * per}`)
  const res = N.searchDisqualified(raw)
  if (!res.items.length) return { msg: 'No disqualified directors found.' }
  return { rows: res.items.map((d) => <Row key={d.id} kind={d.kind === 'corporate' ? 'company' : 'person'} name={d.name} href={U.disq(d.kind, d.id)} meta={d.description} addr={d.address} />), total: res.total, pager: pg(per, Math.min(res.total, 1000), res.items.length, (p) => '#' + withParams('/search', { q, type: 'disqualified', page: p })) }
}

/* Recently viewed, full list: latest 10, 'Show 10 more' up to 100; rows can be removed or the list cleared. */
function Viewed() {
  const [l, setL] = useState(viewedList())
  const [n, setN] = useState(10)
  if (!l.length) return null
  const shown = Math.min(Math.max(n, 10), l.length)
  const undo = (prev) => ({ label: 'Undo', onClick: () => { saveViewed(prev); setL(prev) } })
  const rm = (k) => { const prev = viewedList(), x = prev.filter((r) => viewKey(r) !== k); saveViewed(x); setL(x); note('Removed from recently viewed', { action: undo(prev) }) }
  const clearAll = () => { const prev = viewedList(); saveViewed([]); setL([]); note('Cleared recently viewed', { action: undo(prev) }) }
  return <Section icon={Clock} title="Recently viewed" desc={l.length + ' in this browser'} action={<Button variant="ghost" size="sm" onClick={clearAll}><Trash2 />Clear all</Button>}>
    <div className="divide-y">{l.slice(0, shown).map((r) => <div className="flex items-center gap-3 py-2.5" key={viewKey(r)}><Mark kind={r.type === 'person' ? 'person' : 'company'} name={r.name} /><div className="grid min-w-0 flex-1"><a className="truncate text-sm font-medium hover:underline" href={viewHref(r)}>{r.name}</a><span className="text-xs text-muted-foreground">{[r.type === 'company' && 'No. ' + r.id, fmtWhen(r.t) && 'Viewed ' + fmtWhen(r.t)].filter(Boolean).join(' · ')}</span></div>
      <Button variant="ghost" size="icon-sm" onClick={() => rm(viewKey(r))} aria-label={'Remove ' + r.name + ' from recently viewed'}><X /></Button></div>)}</div>
    {l.length > shown ? <div className="flex items-center gap-3 text-xs text-muted-foreground"><Button variant="outline" size="sm" onClick={() => setN(shown + 10)}>Show {Math.min(10, l.length - shown)} more</Button>Showing {shown} of {l.length}</div> : null}
  </Section>
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
  const sicOnly = g('sic') && !g('sic').includes(',') && !g('includes')
  let title
  if (empty) title = 'Search'
  else if (mode === 'advanced') title = sicOnly && E.sic2007 && E.sic2007[g('sic')] ? `SIC ${g('sic')}: ${E.sic2007[g('sic')]}` : 'Filtered companies'
  else if (mode === 'az') title = `A–Z from “${q}”`
  else if (mode === 'dissolved') title = `Dissolved companies${g('prev') ? ' with a previous name like' : ' named'} “${q}”`
  else title = `Results for “${q}”`
  useCrumbs([{ label: 'Search', href: empty ? undefined : '#/search' }].concat(empty ? [] : [{ label: mode === 'advanced' ? 'Filtered' : q }]), [title])
  useEffect(() => setTitle(title), [title])
  if (empty) return <div className="z-stack"><PageHead title="Search" desc="Search Companies House by company name or number, or by a person's name. Paste a Companies House link or officer ID to jump straight there." action={<Button variant="outline" onClick={filters.open}><SlidersHorizontal />Filters</Button>} /><NoKey /><Viewed /></div>
  const near = mode === 'advanced' ? g('near').trim() : ''
  const town = g('neartown')
  const nearBase = Object.fromEntries(ADV_FIELDS.concat(['near', 'neartown']).map((k) => [k, g(k)]))
  return <div className="z-stack">
    <PageHead title={title} desc={s.data && s.data.total ? s.data.total.toLocaleString('en-GB') + ' results' : null} action={<Button variant="outline" onClick={filters.open}><SlidersHorizontal />{mode ? 'Edit filters' : 'Filters'}</Button>} />
    {mode === 'advanced' ? <FilterSummary q={route.q} /> : null}
    {near || !mode ? <div className="flex flex-wrap gap-2">
      {near ? <Tabs value={g('loc') === near ? 'near' : 'uk'} onValueChange={(v) => go(withParams('/search', Object.assign({ mode }, nearBase, { loc: v === 'near' ? near : '' })))}><TabsList aria-label="Area"><TabsTrigger value="uk">Whole UK</TabsTrigger><TabsTrigger value="near">Near {near}{town && town.toUpperCase() !== near.toUpperCase() ? ' (' + town + ')' : ''}</TabsTrigger></TabsList></Tabs> : null}
      {!mode ? <Tabs value={type} onValueChange={(v) => go(withParams('/search', { q, type: v === 'companies' ? '' : v }))}><TabsList aria-label="Result type">{TYPES.map(([k, l]) => <TabsTrigger key={k} value={k}>{l}</TabsTrigger>)}</TabsList></Tabs> : null}
    </div> : null}
    {s.err ? <ErrorCard e={s.err} /> : <Card><CardContent>{s.loading || jump ? <Rows n={8} /> : s.data.msg ? <Muted>{s.data.msg}</Muted> : <>
      <div className="divide-y">{s.data.rows}</div>
      {s.data.pager ? <Pager {...s.data.pager} total={s.data.total} /> : null}
      {s.data.next ? <div className="flex items-center justify-between pt-2 text-sm text-muted-foreground"><span>Alphabetical list</span><Button variant="outline" size="sm" asChild><a href={s.data.next}>Next</a></Button></div> : null}</>}</CardContent></Card>}
  </div>
}
