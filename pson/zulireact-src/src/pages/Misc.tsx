// @ts-nocheck
import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { KindIcon, St } from '@/components/z/bits'
import { N } from '@/lib/legacy'
import { setTitle } from '@/lib/hooks'
import { chKey, cleanKey, removeSaved, saved, savedHref, savedKey, setChKey } from '@/lib/store'

const ANY = '__any'
/* Saved: one list of companies and people, newest first, with kind tabs, a text filter and a status menu. */
export function SavedPage() {
  const [kind, setKind] = useState('all'), [text, setText] = useState(''), [status, setStatus] = useState(ANY), [, bump] = useState(0)
  useEffect(() => setTitle('Saved'), [])
  const all = saved().slice().sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)))
  const sts = all.filter((x) => x.kind === 'company' && x.status).map((x) => x.status).filter((s, i, a) => a.indexOf(s) === i).sort()
  const st = sts.includes(status) ? status : ANY
  const t = text.trim().toLowerCase()
  const list = all.filter((x) => (kind === 'all' || x.kind === kind) && (st === ANY || (x.kind === 'company' && x.status === st)) && (!t || [x.name, x.number, x.town, x.sub].join(' ').toLowerCase().includes(t)))
  const when = (x) => (x.noDate ? '' : x.dateOnly ? 'saved ' + N.fmtDate(x.savedAt.slice(0, 10)) : 'saved ' + N.fmtDate(x.savedAt.slice(0, 10)) + ', ' + new Date(x.savedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }))
  const rm = (x) => <Button variant="ghost" size="icon-sm" aria-label={'Remove ' + x.name + ' from saved'} onClick={() => { removeSaved(savedKey(x)); bump((n) => n + 1) }}><Trash2 /></Button>
  return <>
    <div className="page-head"><div><h1>Saved</h1><div className="sub">Companies and people you have saved in this browser, newest first.</div></div></div>
    <div className="panel">
      <div className="saved-tools"><Tabs value={kind} onValueChange={setKind}><TabsList aria-label="Show"><TabsTrigger value="all">All</TabsTrigger><TabsTrigger value="company">Companies</TabsTrigger><TabsTrigger value="person">People</TabsTrigger></TabsList></Tabs>
        <Input type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Search saved" aria-label="Search saved" />
        <Select value={st} onValueChange={setStatus}><SelectTrigger aria-label="Status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ANY}>Any status</SelectItem>{sts.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
      {!all.length ? <div className="plain-msg">Nothing saved yet. Use Save on a company or person page.</div> : !list.length ? <div className="plain-msg">Nothing saved matches.</div> :
        <div>{list.map((x) => <div className="res" key={savedKey(x)}><div className="res-nm"><KindIcon kind={x.kind === 'person' ? 'person' : 'company'} name={x.name} /><a className="nm" href={savedHref(x)}>{x.name}</a></div><div className="rt">{rm(x)}</div>
          <div className="meta">{x.kind === 'person' ? [x.sub, when(x)].filter(Boolean).join(' · ') : <><St label={x.status} colour={x.colour} /> · {['No. ' + x.number, x.town, when(x)].filter(Boolean).join(' · ')}</>}</div></div>)}</div>}
    </div></>
}

export function AlertsPage() {
  useEffect(() => setTitle('Alerts'), [])
  return <><div className="page-head"><div><h1>Alerts</h1></div></div><div className="panel plain-msg">Work in progress.</div></>
}

/* Settings: the Companies House key, stored in this browser under the same key as /pson/zuli. */
export function SettingsPage() {
  const [has, setHas] = useState(!!chKey()), [v, setV] = useState(''), [msg, setMsg] = useState('')
  useEffect(() => setTitle('Settings'), [])
  return <><div className="page-head"><div><h1>Settings</h1></div></div>
    <div className="panel"><form className="grid max-w-[520px] gap-1.5" autoComplete="off" onSubmit={(e) => { e.preventDefault(); const c = cleanKey(v); if (!c) { setMsg('Paste a key first.'); return } setChKey(c); setV(''); setHas(true); setMsg('Saved.') }}>
      <Label htmlFor="chk" className="text-[13px] font-semibold text-(--ink-800)">Companies House API key</Label>
      <Input id="chk" type="password" value={v} onChange={(e) => setV(e.target.value)} placeholder={has ? 'Saved. Paste a new key to replace it.' : 'Paste your key'} />
      <div className="text-[12px] text-(--ink-500)">Free from developer.company-information.service.gov.uk (REST key). Add {location.origin} under the key's JavaScript domains so this page can use it.</div>
      <div className="mt-2 flex gap-1.5"><Button type="submit">Save key</Button>{has ? <Button variant="outline" type="button" onClick={() => { setChKey(''); setHas(false); setMsg('Removed.') }}>Remove key</Button> : null}</div>
      <div className="mt-2 text-[12px] text-(--ink-500)">Stored only in this browser (localStorage).</div><div className="text-[12px] text-(--ink-700)" role="status">{msg}</div>
    </form></div></>
}
