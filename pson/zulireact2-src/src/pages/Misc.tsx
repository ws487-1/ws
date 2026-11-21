// @ts-nocheck
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Sun, Moon, Monitor, SunMoon } from 'lucide-react'
import { useTweaks } from '@/lib/tweaks'
import { useEffect, useState } from 'react'
import { Trash2, Bell, KeyRound, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Mark, St, PageHead, Muted } from '@/components/z/bits'
import { N } from '@/lib/legacy'
import { setTitle } from '@/lib/hooks'
import { useCrumbs } from '@/lib/crumbs'
import { note } from '@/lib/toast'
import { getTweaks } from '@/lib/tweaks'
import { chKey, cleanKey, restoreSaved, removeSaved, saved, savedHref, savedKey, setChKey } from '@/lib/store'

const ANY = '__any'
/* Saved: one list of companies and people, newest first, with kind tabs, a text filter and a status menu. */
export function SavedPage() {
  const [kind, setKind] = useState('all'), [text, setText] = useState(''), [status, setStatus] = useState(ANY), [, bump] = useState(0)
  useCrumbs([{ label: 'Saved' }], [])
  useEffect(() => setTitle('Saved'), [])
  const all = saved().slice().sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)))
  const sts = all.filter((x) => x.kind === 'company' && x.status).map((x) => x.status).filter((s, i, a) => a.indexOf(s) === i).sort()
  const st = sts.includes(status) ? status : ANY
  const t = text.trim().toLowerCase()
  const list = all.filter((x) => (kind === 'all' || x.kind === kind) && (st === ANY || (x.kind === 'company' && x.status === st)) && (!t || [x.name, x.number, x.town, x.sub].join(' ').toLowerCase().includes(t)))
  const when = (x) => (x.noDate ? '' : x.dateOnly ? 'saved ' + N.fmtDate(x.savedAt.slice(0, 10)) : 'saved ' + N.fmtDate(x.savedAt.slice(0, 10)) + ', ' + new Date(x.savedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }))
  return <div className="z-stack">
    <PageHead title="Saved" desc="Companies and people you have saved in this browser, newest first." />
    <Card><CardContent className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2"><Tabs value={kind} onValueChange={setKind}><TabsList aria-label="Show"><TabsTrigger value="all">All</TabsTrigger><TabsTrigger value="company">Companies</TabsTrigger><TabsTrigger value="person">People</TabsTrigger></TabsList></Tabs>
        <div className="relative min-w-48 flex-1"><Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" /><Input type="search" className="pl-8" value={text} onChange={(e) => setText(e.target.value)} placeholder="Search saved" aria-label="Search saved" /></div>
        <Select value={st} onValueChange={setStatus}><SelectTrigger aria-label="Status" className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ANY}>Any status</SelectItem>{sts.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
      {!all.length ? <Muted>Nothing saved yet. Use Save on a company or person page.</Muted> : !list.length ? <Muted>Nothing saved matches.</Muted> :
        <div className="divide-y">{list.map((x) => <div className="flex items-center gap-3 py-2.5" key={savedKey(x)}><Mark kind={x.kind === 'person' ? 'person' : 'company'} name={x.name} /><div className="grid min-w-0 flex-1 gap-0.5"><a className="truncate font-medium hover:underline" href={savedHref(x)}>{x.name}</a>
          <span className="text-xs text-muted-foreground">{x.kind === 'person' ? [x.sub, when(x)].filter(Boolean).join(' · ') : <><St label={x.status} colour={x.colour} /> · {['No. ' + x.number, x.town, when(x)].filter(Boolean).join(' · ')}</>}</span></div>
          <Button variant="ghost" size="icon-sm" aria-label={'Remove ' + x.name + ' from saved'} onClick={() => { removeSaved(savedKey(x)); bump((n) => n + 1); note('Removed from saved', { description: x.name, action: getTweaks().undoUnsave === 'on' ? { label: 'Undo', onClick: () => { restoreSaved(x); bump((n) => n + 1) } } : undefined }) }}><Trash2 /></Button></div>)}</div>}
    </CardContent></Card></div>
}

export function AlertsPage() {
  useCrumbs([{ label: 'Alerts' }], [])
  useEffect(() => setTitle('Alerts'), [])
  return <div className="z-stack"><PageHead title="Alerts" /><Card><CardContent className="grid justify-items-center gap-3 py-10 text-center"><span className="grid size-12 place-items-center rounded-full bg-muted"><Bell className="size-5" /></span><p className="font-medium">Work in progress</p><Muted>Alerts for filings and officer changes are coming.</Muted></CardContent></Card></div>
}

/* Settings: the Companies House key, under the same localStorage key as /pson/zuli. */
export function SettingsPage() {
  const [has, setHas] = useState(!!chKey()), [v, setV] = useState(''), [msg, setMsg] = useState('')
  useCrumbs([{ label: 'Settings' }], [])
  useEffect(() => setTitle('Settings'), [])
  return <div className="z-stack"><PageHead title="Settings" desc="Stored only in this browser." />
    <Card className="max-w-2xl"><form autoComplete="off" onSubmit={(e) => { e.preventDefault(); const c = cleanKey(v); if (!c) { setMsg('Paste a key first.'); return } setChKey(c); setV(''); setHas(true); setMsg('Saved.') }} className="grid gap-6">
      <CardHeader><CardTitle className="flex items-center gap-2"><KeyRound className="size-4" />Companies House API key</CardTitle><CardDescription>Free from developer.company-information.service.gov.uk (REST key). Add {location.origin} under the key's JavaScript domains so this page can use it.</CardDescription></CardHeader>
      <CardContent className="grid gap-2"><Label htmlFor="chk">API key</Label><Input id="chk" type="password" value={v} onChange={(e) => setV(e.target.value)} placeholder={has ? 'Saved. Paste a new key to replace it.' : 'Paste your key'} /><p className="text-sm text-muted-foreground" role="status">{msg || (has ? 'A key is saved.' : 'No key saved yet.')}</p></CardContent>
      <CardFooter className="gap-2 border-t"><Button type="submit">Save key</Button>{has ? <Button variant="outline" type="button" onClick={() => { setChKey(''); setHas(false); setMsg('Removed.') }}>Remove key</Button> : null}</CardFooter>
    </form></Card>
    <AppearanceCard /></div>
}
/* Appearance: light / dark / system (moved here from the experimental panel; a real preference). */
function AppearanceCard() {
  const [tw, set] = useTweaks()
  return <Card className="max-w-2xl"><CardHeader><CardTitle className="flex items-center gap-2"><SunMoon className="size-4" />Appearance</CardTitle><CardDescription>Light, dark, or follow your device.</CardDescription></CardHeader>
    <CardContent><ToggleGroup type="single" variant="outline" value={tw.mode} onValueChange={(x) => x && set('mode', x)} aria-label="Colour mode" className="w-full max-w-sm">
      <ToggleGroupItem value="light" className="flex-1"><Sun />Light</ToggleGroupItem><ToggleGroupItem value="dark" className="flex-1"><Moon />Dark</ToggleGroupItem><ToggleGroupItem value="system" className="flex-1"><Monitor />System</ToggleGroupItem></ToggleGroup></CardContent></Card>
}
