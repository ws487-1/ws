// @ts-nocheck
import { createContext, useContext, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetDescription } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { E, N } from '@/lib/legacy'
import { go, withParams, type Route } from '@/lib/router'

export const ADV_FIELDS = ['includes', 'excludes', 'status', 'ctype', 'subtype', 'sic', 'loc', 'incf', 'inct', 'disf', 'dist']
export const FiltersCtx = createContext<{ open: () => void }>({ open: () => {} })
export const useFilters = () => useContext(FiltersCtx)
const ANY = '__any'
const opts = (map) => Object.entries(map || {}).sort((a: any, b: any) => a[1].localeCompare(b[1]))
const F = ({ label, id, children }: any) => <div className="grid gap-2"><Label htmlFor={id}>{label}</Label>{children}</div>
const H = ({ children }) => <h3 className="text-sm font-semibold">{children}</h3>

/* Filters: company filters (advanced search), or people / disqualified by name, plus A–Z and dissolved-name browsing. */
export function FiltersSheet({ open, onOpenChange, route }: { open: boolean; onOpenChange: (o: boolean) => void; route: Route }) {
  const g = (k) => (route.path === '/search' ? route.q.get(k) || '' : '')
  const adv = g('mode') === 'advanced'
  const [kind, setKind] = useState(['people', 'disqualified'].includes(g('type')) ? g('type') : 'companies')
  const st0 = g('status'), simpleSt = ['', 'active', 'dissolved'].includes(st0) ? st0 : ''
  const [f, setF] = useState(() => ({ name: adv ? g('includes') : g('mode') ? '' : g('q'), status: simpleSt, xstatus: simpleSt === st0 ? '' : st0, loc: g('loc'), excl: g('excludes'), ctype: g('ctype'), subtype: g('subtype'), incf: g('incf'), inct: g('inct'), disf: g('disf'), dist: g('dist'), sics: g('sic').split(',').filter((c) => E.sic2007 && E.sic2007[c]), sicIn: '', bq: ['az', 'dissolved'].includes(g('mode')) ? g('q') : '', bmode: g('mode') === 'dissolved' ? 'dissolved' : 'az', prev: !!g('prev') }))
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  const sicList = useMemo(() => Object.entries(E.sic2007 || {}), [])
  const addSic = () => {
    const m = /^\s*(\d{5})\b/.exec(f.sicIn); let code = m && E.sic2007[m[1]] ? m[1] : ''
    if (!code && f.sicIn.trim()) { const t = f.sicIn.trim().toLowerCase(); const hit = sicList.find(([, d]: any) => d.toLowerCase() === t); if (hit) code = hit[0] }
    const sics = code && !f.sics.includes(code) ? f.sics.concat(code) : f.sics
    setF((x) => ({ ...x, sics, sicIn: code ? '' : x.sicIn })); return sics
  }
  const show = () => {
    const name = f.name.trim()
    if (kind !== 'companies') { if (!name) return; go(withParams('/search', { q: name, type: kind })); onOpenChange(false); return }
    const sics = addSic()
    const p: any = { mode: 'advanced', includes: name, excludes: f.excl.trim(), status: f.xstatus || f.status, ctype: f.ctype, subtype: f.subtype, sic: sics.join(','), loc: f.loc.trim(), incf: f.incf, inct: f.inct, disf: f.disf, dist: f.dist }
    if (adv && g('near')) { p.near = g('near'); p.neartown = g('neartown') }
    if (!ADV_FIELDS.some((k) => p[k])) return
    go(withParams('/search', p)); onOpenChange(false)
  }
  const browse = () => { const q = f.bq.trim(); if (!q) return; go(withParams('/search', { mode: f.bmode, q, prev: f.bmode === 'dissolved' && f.prev ? 1 : '' })); onOpenChange(false) }
  const clear = () => setF((x) => ({ ...x, name: '', status: '', xstatus: '', loc: '', excl: '', ctype: '', subtype: '', incf: '', inct: '', disf: '', dist: '', sics: [], sicIn: '', prev: false }))
  const seg = (val, onChange, items, label) => <ToggleGroup type="single" variant="outline" value={val || ANY} onValueChange={(x) => x && onChange(x === ANY ? '' : x)} className="w-full" aria-label={label}>{items.map(([v, l]) => <ToggleGroupItem key={l} value={v || ANY} className="flex-1">{l}</ToggleGroupItem>)}</ToggleGroup>
  const sel = (id, val, k, map, any) => <Select value={val || ANY} onValueChange={(x) => set(k, x === ANY ? '' : x)}><SelectTrigger id={id} className="w-full"><SelectValue /></SelectTrigger><SelectContent className="max-h-72"><SelectItem value={ANY}>{any}</SelectItem>{opts(map).map(([k2, v]: any) => <SelectItem key={k2} value={k2}>{v}</SelectItem>)}</SelectContent></Select>
  return <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent side="right" className="flex flex-col gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md">
      <SheetHeader className="border-b"><SheetTitle>Filters</SheetTitle><SheetDescription>Filter companies, or search people and disqualified directors by name.</SheetDescription></SheetHeader>
      <form className="grid flex-1 content-start gap-6 overflow-y-auto p-4" onSubmit={(e) => { e.preventDefault(); show() }}>
        <div className="grid gap-4"><H>Looking for</H>{seg(kind, (x) => setKind(x || 'companies'), [['companies', 'Companies'], ['people', 'People'], ['disqualified', 'Disqualified']], 'Looking for')}
          <F label={kind === 'companies' ? 'Name contains' : 'Name'} id="fdName"><Input id="fdName" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder={kind === 'companies' ? 'Optional' : 'Person’s name'} autoComplete="off" /></F>
          {kind !== 'companies' ? <p className="text-sm text-muted-foreground">People and disqualified directors can be searched by name only.</p> : null}</div>
        {kind === 'companies' ? <>
          <Separator />
          <div className="grid gap-4"><H>Company filters</H>
            <F label="Status">{seg(f.status, (x) => set('status', x), [['', 'Any'], ['active', 'Active'], ['dissolved', 'Dissolved']], 'Status')}</F>
            <F label="Location" id="fdLoc"><Input id="fdLoc" value={f.loc} onChange={(e) => set('loc', e.target.value)} placeholder="Town or postcode district, e.g. Leeds or E14" /></F>
            <F label="Industry (SIC code)" id="fdSic"><Input id="fdSic" list="fdSicList" value={f.sicIn} onChange={(e) => set('sicIn', e.target.value)} onBlur={addSic} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSic() } }} placeholder="Type a code or an activity" autoComplete="off" /></F>
            <datalist id="fdSicList">{sicList.map(([c, d]: any) => <option key={c} value={c + ' ' + d} />)}</datalist>
            {f.sics.length ? <div className="grid gap-1.5">{f.sics.map((c) => <div className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm" key={c}><span className="font-mono text-xs text-muted-foreground">{c}</span><span className="flex-1">{E.sic2007[c]}</span><Button type="button" variant="ghost" size="icon-xs" aria-label={'Remove SIC ' + c} onClick={() => set('sics', f.sics.filter((x) => x !== c))}><X /></Button></div>)}</div> : null}</div>
          <Separator />
          <div className="grid gap-4"><H>More options</H>
            <F label="Name excludes" id="fdEx"><Input id="fdEx" value={f.excl} onChange={(e) => set('excl', e.target.value)} /></F>
            <F label="Exact status" id="fdXs">{sel('fdXs', f.xstatus, 'xstatus', E.company_status, 'Use the status above')}</F>
            <F label="Company type" id="fdTy">{sel('fdTy', f.ctype, 'ctype', E.company_type, 'Any type')}</F>
            <F label="Subtype" id="fdSu">{sel('fdSu', f.subtype, 'subtype', E.company_subtype, 'Any subtype')}</F>
            <div className="grid grid-cols-2 gap-3"><F label="Incorporated from" id="fdIf"><Input id="fdIf" type="date" value={f.incf} onChange={(e) => set('incf', e.target.value)} /></F><F label="Incorporated to" id="fdIt"><Input id="fdIt" type="date" value={f.inct} onChange={(e) => set('inct', e.target.value)} /></F></div>
            <div className="grid grid-cols-2 gap-3"><F label="Dissolved from" id="fdDf"><Input id="fdDf" type="date" value={f.disf} onChange={(e) => set('disf', e.target.value)} /></F><F label="Dissolved to" id="fdDt"><Input id="fdDt" type="date" value={f.dist} onChange={(e) => set('dist', e.target.value)} /></F></div></div>
          <Separator />
          <div className="grid gap-4"><H>Browse by name</H>
            <F label="Starting from name" id="fdBq"><Input id="fdBq" value={f.bq} onChange={(e) => set('bq', e.target.value)} /></F>
            {seg(f.bmode, (x) => set('bmode', x || 'az'), [['az', 'A–Z, all'], ['dissolved', 'Dissolved names']], 'Browse mode')}
            <div className="flex items-center gap-2"><Checkbox id="fdPrev" checked={f.prev} onCheckedChange={(x) => set('prev', !!x)} /><Label htmlFor="fdPrev" className="font-normal">Include previous names (dissolved only)</Label></div>
            <Button variant="outline" type="button" className="w-fit" onClick={browse}>Browse list</Button></div></> : null}
        <button type="submit" hidden />
      </form>
      <SheetFooter className="flex-row border-t"><Button variant="outline" className="flex-1" onClick={clear}>Clear all</Button><Button className="flex-1" onClick={show}>Show results</Button></SheetFooter>
    </SheetContent></Sheet>
}
/* Plain-text summary of applied filters (no badges). */
export function FilterSummary({ q }) {
  const g = (k) => q.get(k) || '', lab = (m, k) => (E[m] && E[m][k]) || k
  const parts = []
  if (g('sic')) parts.push(<span key="s">{g('sic').split(',').map((c, i) => <span key={c}>{i ? '; ' : ''}<b className="font-medium text-foreground">{c}</b> {(E.sic2007 || {})[c] || ''}</span>)}</span>)
  if (g('status')) parts.push(lab('company_status', g('status')))
  if (g('loc')) parts.push(<span key="l">in <b className="font-medium text-foreground">{g('loc')}</b></span>)
  if (g('includes')) parts.push('name contains “' + g('includes') + '”')
  if (g('excludes')) parts.push('name excludes “' + g('excludes') + '”')
  if (g('ctype')) parts.push(lab('company_type', g('ctype')))
  if (g('subtype')) parts.push(lab('company_subtype', g('subtype')))
  if (g('incf') || g('inct')) parts.push('incorporated ' + [g('incf') && 'from ' + N.fmtDate(g('incf')), g('inct') && 'to ' + N.fmtDate(g('inct'))].filter(Boolean).join(' '))
  if (g('disf') || g('dist')) parts.push('dissolved ' + [g('disf') && 'from ' + N.fmtDate(g('disf')), g('dist') && 'to ' + N.fmtDate(g('dist'))].filter(Boolean).join(' '))
  return <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground"><span>{parts.length ? parts.map((p, i) => <span key={i}>{i ? ' · ' : ''}{p}</span>) : 'No filters'}</span><Button variant="ghost" size="sm" asChild><a href="#/search"><X />Clear filters</a></Button></div>
}
