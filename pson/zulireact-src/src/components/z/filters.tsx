// @ts-nocheck
import { createContext, useContext, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetDescription } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { E, N } from '@/lib/legacy'
import { go, withParams, type Route } from '@/lib/router'

export const ADV_FIELDS = ['includes', 'excludes', 'status', 'ctype', 'subtype', 'sic', 'loc', 'incf', 'inct', 'disf', 'dist']
export const FiltersCtx = createContext<{ open: () => void }>({ open: () => {} })
export const useFilters = () => useContext(FiltersCtx)
const ANY = '__any'
const opts = (map) => Object.entries(map || {}).sort((a: any, b: any) => a[1].localeCompare(b[1]))

/* More filters (from /app/2): a right-hand sheet on desktop, a bottom sheet on mobile. Replaces the old Advanced page. */
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
  const seg = (val, onChange, items) => <ToggleGroup type="single" value={val || ANY} onValueChange={(x) => x && onChange(x === ANY ? '' : x)} className="seg mb-3 w-full rounded-(--r-ctl) bg-(--sunk) p-[3px]">{items.map(([v, l]) => <ToggleGroupItem key={l} value={v || ANY} className="h-8 rounded-[2px] text-[13px]">{l}</ToggleGroupItem>)}</ToggleGroup>
  const sel = (val, k, map, any) => <Select value={val || ANY} onValueChange={(x) => set(k, x === ANY ? '' : x)}><SelectTrigger className="w-full bg-white"><SelectValue /></SelectTrigger><SelectContent className="max-h-72"><SelectItem value={ANY}>{any}</SelectItem>{opts(map).map(([k2, v]: any) => <SelectItem key={k2} value={k2}>{v}</SelectItem>)}</SelectContent></Select>
  return <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent side="right" className="z-fd flex flex-col gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[440px]" showCloseButton={false}>
      <SheetHeader className="flex-row items-center justify-between px-5 pt-[18px] pb-3"><SheetTitle className="text-[20px] font-bold tracking-tight text-(--ink-900)">Filters</SheetTitle><SheetDescription className="sr-only">Filter companies, or search people and disqualified directors by name.</SheetDescription>
        <Button variant="secondary" size="icon" className="rounded-full" onClick={() => onOpenChange(false)} aria-label="Close filters"><X /></Button></SheetHeader>
      <form className="flex-1 overflow-y-auto px-5 pb-5" onSubmit={(e) => { e.preventDefault(); show() }}>
        <div className="fd-sec"><h3>Looking for</h3>{seg(kind, (x) => setKind(x || 'companies'), [['companies', 'Companies'], ['people', 'People'], ['disqualified', 'Disqualified']])}
          <label className="fd-f">{kind === 'companies' ? 'Name contains' : 'Name'}<Input id="fdName" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder={kind === 'companies' ? 'Optional' : 'Person’s name'} autoComplete="off" /></label>
          {kind !== 'companies' ? <p className="-mt-1 mb-3 text-[12.5px] text-(--ink-500)">People and disqualified directors can be searched by name only.</p> : null}</div>
        {kind === 'companies' ? <>
          <div className="fd-sec"><h3>Company filters</h3><div className="mb-1.5 text-[13px] font-semibold text-(--ink-800)">Status</div>{seg(f.status, (x) => set('status', x), [['', 'Any'], ['active', 'Active'], ['dissolved', 'Dissolved']])}
            <label className="fd-f">Location<Input id="fdLoc" value={f.loc} onChange={(e) => set('loc', e.target.value)} placeholder="Town or postcode district, e.g. Leeds or E14" /></label>
            <label className="fd-f">Industry (SIC code)<Input list="fdSicList" value={f.sicIn} onChange={(e) => set('sicIn', e.target.value)} onBlur={addSic} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSic() } }} placeholder="Type a code or an activity" autoComplete="off" /></label>
            <datalist id="fdSicList">{sicList.map(([c, d]: any) => <option key={c} value={c + ' ' + d} />)}</datalist>
            {f.sics.map((c) => <div className="sic-p" key={c}><b className="mono">{c}</b><span>{E.sic2007[c]}</span><button type="button" className="text-(--zb)" aria-label={'Remove SIC ' + c} onClick={() => set('sics', f.sics.filter((x) => x !== c))}><X className="size-3.5" /></button></div>)}</div>
          <div className="fd-sec"><h3>More options</h3>
            <label className="fd-f">Name excludes<Input value={f.excl} onChange={(e) => set('excl', e.target.value)} /></label>
            <div className="fd-f">Exact status{sel(f.xstatus, 'xstatus', E.company_status, 'Use the status above')}</div>
            <div className="fd-f">Company type{sel(f.ctype, 'ctype', E.company_type, 'Any type')}</div>
            <div className="fd-f">Subtype{sel(f.subtype, 'subtype', E.company_subtype, 'Any subtype')}</div>
            <div className="fd-row2"><label className="fd-f">Incorporated from<Input type="date" value={f.incf} onChange={(e) => set('incf', e.target.value)} /></label><label className="fd-f">Incorporated to<Input type="date" value={f.inct} onChange={(e) => set('inct', e.target.value)} /></label></div>
            <div className="fd-row2"><label className="fd-f">Dissolved from<Input type="date" value={f.disf} onChange={(e) => set('disf', e.target.value)} /></label><label className="fd-f">Dissolved to<Input type="date" value={f.dist} onChange={(e) => set('dist', e.target.value)} /></label></div></div>
          <div className="fd-sec"><h3>Browse by name</h3>
            <label className="fd-f">Starting from name<Input value={f.bq} onChange={(e) => set('bq', e.target.value)} /></label>
            {seg(f.bmode, (x) => set('bmode', x || 'az'), [['az', 'A–Z, all companies'], ['dissolved', 'Dissolved names']])}
            <label className="mb-3 flex items-center gap-2 text-[13px] text-(--ink-700)"><Checkbox checked={f.prev} onCheckedChange={(x) => set('prev', !!x)} />Include previous names (dissolved only)</label>
            <Button variant="outline" type="button" onClick={browse}>Browse list</Button></div></> : null}
        <button type="submit" hidden />
      </form>
      <SheetFooter className="flex-row gap-2.5 border-t border-(--line-soft) px-5 py-3.5"><Button variant="outline" className="flex-1" onClick={clear}>Clear all</Button><Button className="flex-1" id="fdGo" onClick={show}>Show results</Button></SheetFooter>
    </SheetContent></Sheet>
}
/* Plain-text summary of applied filters above results (no badges). */
export function FilterSummary({ q, onEdit }) {
  const g = (k) => q.get(k) || '', lab = (m, k) => (E[m] && E[m][k]) || k
  const parts = []
  if (g('sic')) parts.push(<span key="s">{g('sic').split(',').map((c, i) => <span key={c}>{i ? '; ' : ''}<b>{c}</b> {(E.sic2007 || {})[c] || ''}</span>)}</span>)
  if (g('status')) parts.push(lab('company_status', g('status')))
  if (g('loc')) parts.push(<span key="l">in <b>{g('loc')}</b></span>)
  if (g('includes')) parts.push('name contains “' + g('includes') + '”')
  if (g('excludes')) parts.push('name excludes “' + g('excludes') + '”')
  if (g('ctype')) parts.push(lab('company_type', g('ctype')))
  if (g('subtype')) parts.push(lab('company_subtype', g('subtype')))
  if (g('incf') || g('inct')) parts.push('incorporated ' + [g('incf') && 'from ' + N.fmtDate(g('incf')), g('inct') && 'to ' + N.fmtDate(g('inct'))].filter(Boolean).join(' '))
  if (g('disf') || g('dist')) parts.push('dissolved ' + [g('disf') && 'from ' + N.fmtDate(g('disf')), g('dist') && 'to ' + N.fmtDate(g('dist'))].filter(Boolean).join(' '))
  return <div className="f-sum"><span>{parts.length ? parts.map((p, i) => <span key={i}>{i ? ' · ' : ''}{p}</span>) : 'No filters'}</span><span className="flex gap-3"><button type="button" className="lnk" onClick={onEdit}>Edit filters</button><a className="lnk" href="#/">Clear</a></span></div>
}
