// @ts-nocheck
import { useEffect, useMemo, useState } from 'react'
import { Archive, Hourglass, Timer, UserRound, Briefcase, ChartPie, ShieldAlert, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Cp, ErrorCard, Muted, Note, ProfileCtx, ProfileSkeleton, Rows, Section, St, Stat, CoMark } from '@/components/z/bits'
import { Dl, History, PersonHeader } from '@/components/z/tiles'
import { N } from '@/lib/legacy'
import { companyNames, disqForPerson, loadDisq, loadPerson, memo, peek } from '@/lib/data'
import { flagFor, flagSrc } from '@/lib/flags'
import { ExternalLink } from 'lucide-react'
import { useLoad, setTitle } from '@/lib/hooks'
import { useCrumbs } from '@/lib/crumbs'
import { useTweaks } from '@/lib/tweaks'
import { addViewed } from '@/lib/store'
import { U } from '@/lib/router'

const cpd = (v) => (/^\d/.test(v || '') ? <Cp v={v} /> : v)
const ageText = (dob) => { const lo = N.approxAge(dob); if (lo == null) return ''; return !dob.month || dob.month === new Date().getMonth() + 1 ? `${lo} or ${lo + 1}` : String(lo) }

function DisqCard({ d }) {
  const cur = d.items.some((x) => x.current)
  return <Section icon={ShieldAlert} title="Disqualified director" desc={<span className="font-semibold text-destructive">{cur ? 'Disqualified' : 'Previously disqualified'}</span>}>
    {d.items.map((x, i) => <div key={i} className="grid gap-3">{i ? <Separator /> : null}<Dl rows={[['Type', x.type], ['Reason', x.reason], ['Law', x.law], ['Disqualified', [x.from && 'from ' + x.from, x.until && 'until ' + x.until].filter(Boolean).join(' ')], ['Court', x.court], ['Heard on', x.heard], ['Undertaking given', x.undertaken], ['Case', x.caseId], ['Companies named', x.companies.join(', ')], ['Address on record', x.address]]} /></div>)}
    {d.permissions.length ? <Dl rows={d.permissions.map((p) => ['Permission to act', [p.companies.join(', '), p.court, p.granted && 'granted ' + p.granted, p.expires && 'until ' + p.expires].filter(Boolean).join(' · ')])} /> : null}
    <Note>{d.url ? <><a className="underline underline-offset-4" href={d.url} target="_blank" rel="noopener">View this record on Companies House</a>. </> : null}Linked to this person by an identical Companies House person number.</Note>
  </Section>
}
function Controls({ pn, names }) {
  const row = (x, i) => <div className="flex gap-3 py-2.5" key={i}><CoMark /><div className="grid min-w-0 gap-0.5 text-sm"><div className="flex flex-wrap items-baseline gap-x-2"><a className="font-medium hover:underline" href={U.company(x.number)}>{names[x.number] || 'Company ' + x.number}</a><span className="text-muted-foreground">{x.role}</span>{x.notified ? <span className="text-xs text-muted-foreground">since {x.notified}</span> : null}{x.ceased ? <span className="text-xs text-muted-foreground">ceased {x.ceased}</span> : null}</div>{x.controls.map((c) => <div className="text-xs text-muted-foreground" key={c}>{c}</div>)}</div></div>
  return <Section icon={ChartPie} title="Companies this person controls" desc={pn.current.length + ' current' + (pn.ceased.length ? ' · ' + pn.ceased.length + ' ceased' : '')}>
    {pn.current.length ? <div className="divide-y">{pn.current.map(row)}</div> : <Muted>No current significant control recorded.</Muted>}
    {pn.ceased.length ? <><Separator /><div className="text-xs font-medium text-muted-foreground">Ceased ({pn.ceased.length})</div><div className="divide-y">{pn.ceased.map(row)}</div></> : null}
  </Section>
}

const FEW = 10, STEP = 25, CLOSED = ['dissolved', 'closed', 'converted-closed', 'removed']
function Appointments({ vm }) {
  const [t, setT] = useState(''), [sv, setSv] = useState('all'), [o, setO] = useState('new'), [shown, setShown] = useState(STEP)
  const many = vm.items.length > FEW
  const m = useMemo(() => {
    const q = t.trim().toLowerCase()
    const r = vm.items.filter((a) => (!q || (a.company + ' ' + a.number).toLowerCase().includes(q)) && (sv === 'all' || (sv === 'current' ? a.current : sv === 'resigned' ? !a.current : sv === 'co-active' ? a.statusCode === 'active' : CLOSED.includes(a.statusCode))))
    return r.slice().sort((a, b) => (o === 'az' ? a.company.localeCompare(b.company) || a.number.localeCompare(b.number) : o === 'old' ? (a.appointedIso || '0').localeCompare(b.appointedIso || '0') : (b.current - a.current) || (b.appointedIso || '0').localeCompare(a.appointedIso || '0')))
  }, [vm, t, sv, o])
  const list = many ? m : vm.items, vis = many ? Math.min(shown, m.length) : list.length
  const reset = (fn) => (v) => { fn(v); setShown(STEP) }
  return <Section icon={Briefcase} title="Appointments" desc={vm.total + ' appointment' + (vm.total === 1 ? '' : 's')}>
    {many ? <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]"><div className="relative"><Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" /><Input type="search" className="pl-8" value={t} onChange={(e) => reset(setT)(e.target.value)} placeholder="Filter by company name or number" aria-label="Filter appointments" /></div>
      <Select value={sv} onValueChange={reset(setSv)}><SelectTrigger aria-label="Status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All appointments</SelectItem><SelectItem value="current">Current</SelectItem><SelectItem value="resigned">Resigned</SelectItem><SelectItem value="co-active">Company active</SelectItem><SelectItem value="co-closed">Company dissolved or closed</SelectItem></SelectContent></Select>
      <Select value={o} onValueChange={reset(setO)}><SelectTrigger aria-label="Sort"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="new">Newest first</SelectItem><SelectItem value="old">Oldest first</SelectItem><SelectItem value="az">Company A–Z</SelectItem></SelectContent></Select>
      <Note>{`Showing ${vis.toLocaleString('en-GB')} of ${m.length.toLocaleString('en-GB')}${t || sv !== 'all' ? ' matching' : ''}`}{vm.loaded < vm.total ? ` · ${vm.loaded.toLocaleString('en-GB')} of ${vm.total.toLocaleString('en-GB')} loaded` : ''}</Note></div> : null}
    <Table><TableHeader><TableRow><TableHead>Company</TableHead><TableHead>Status</TableHead><TableHead className="hidden sm:table-cell">Role</TableHead><TableHead className="hidden sm:table-cell">Appointed</TableHead><TableHead className="hidden sm:table-cell">Resigned</TableHead></TableRow></TableHeader>
      <TableBody>{list.slice(0, vis).map((a, i) => <TableRow key={i}><TableCell className="whitespace-normal"><div className="grid">{a.number ? <a className="font-medium hover:underline" href={U.company(a.number)}>{a.company}</a> : a.company}<span className="text-xs text-muted-foreground">{a.number ? <Cp v={a.number} /> : null}<span className="sm:hidden">{a.number ? ' · ' : ''}{a.role} · {a.resigned ? 'resigned ' + a.resigned : 'since ' + a.appointed}</span></span></div></TableCell>
        <TableCell><St label={a.status} colour={a.colour} /></TableCell><TableCell className="hidden sm:table-cell">{a.role}</TableCell><TableCell className="hidden tabular-nums sm:table-cell">{cpd(a.appointed)}</TableCell><TableCell className="hidden tabular-nums sm:table-cell">{cpd(a.resigned)}</TableCell></TableRow>)}
        {!vis ? <TableRow><TableCell colSpan={5} className="text-muted-foreground">No appointments match.</TableCell></TableRow> : null}</TableBody></Table>
    {many && vis < m.length ? <Button variant="outline" className="w-fit justify-self-center" onClick={() => setShown(shown + STEP)}>Show {Math.min(STEP, m.length - vis)} more</Button> : null}
  </Section>
}

/* Person flags (consultation 2 §13; Will: residence flag yes). Flag after the text; unknown values stay text only. */
const withFlags = (vals, on) => (!vals || !vals.length ? '' : !on ? vals.join(', ') : <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">{vals.map((v, i) => { const f = flagFor(v); return <span key={i} className="inline-flex items-center gap-1.5">{v}{f ? <img src={flagSrc(f.code)} alt="" className="z-flag z-flag-s" title={v} loading="lazy" /> : null}{i < vals.length - 1 ? ',' : ''}</span> })}</span>)
function Officer({ route, ids, pscId }) {
  const s = useLoad(() => memo('p:' + route.key, () => loadPerson(ids, pscId)), [route.key], () => peek('p:' + route.key))
  const [dq, setDq] = useState(null)
  const [tw] = useTweaks()
  const nm = s.data ? (s.data.pscOnly ? s.data.pscOnly.name || 'Owner' : s.data.vm.name) : 'Person'
  useCrumbs([{ label: 'People', href: '#/search?type=people' }, { label: nm }], [nm])
  useEffect(() => {
    const d = s.data; if (!d) return
    if (d.pscOnly) { const pn = d.pscOnly; setTitle(pn.name || 'Owner'); addViewed(pn.corporate ? 'corporate' : 'person', 'psc:' + pscId, pn.name || 'Owner'); return }
    const key = pscId ? 'psc:' + pscId : 'id:' + d.apIds.join(',')
    setTitle(d.vm.name); addViewed(d.vm.corporate ? 'corporate' : 'person', key, d.vm.name)
    let live = true; setDq(null)
    disqForPerson(d.apIds, d.vm).then((x) => live && setDq(x)).catch((e) => console.warn(e))
    return () => { live = false }
  }, [s.data])
  if (s.loading) return <ProfileSkeleton />
  if (s.err) return <ErrorCard e={s.err} />
  if (s.data.pscOnly) return <PscOnly pn={s.data.pscOnly} pscId={pscId} />
  const { vm, apIds, pnv, names, complete } = s.data
  const key = pscId ? 'psc:' + pscId : 'id:' + apIds.join(',')
  const reliableAvg = vm.averageYears != null && vm.loaded === vm.total && vm.tenureBase >= Math.max(2, Math.ceil(vm.loaded * 0.8))
  const firstAp = vm.items.map((x) => x.appointedIso).filter(Boolean).sort()[0]
  const lastRes = vm.active ? '' : vm.items.map((x) => x.resignedIso).filter(Boolean).sort().pop()
  return <ProfileCtx.Provider value={{ here: route.key, name: vm.name }}><div className="z-stack">
    <PersonHeader name={vm.name} meta={[vm.roles.join(', '), vm.born && 'Born ' + vm.born, tw.personFlags === 'overview' && vm.residences[0] ? withFlags(vm.residences.slice(0, 1), true) : '']} corporate={vm.corporate} entry={{ kind: 'person', key, href: pscId ? U.psc(pscId) : U.person(apIds), name: vm.name, sub: [vm.roles[0], vm.born && 'Born ' + vm.born].filter(Boolean).join(' · ') }} />
    <div className="bento">
      <div className="s4"><Stat style={tw.stat} icon={Archive} label="Dissolved or in liquidation" value={String(vm.finished)} sub="Companies appointed to" tone={vm.finished ? 'warn' : ''} /></div>
      <div className="s4"><Stat style={tw.stat} icon={Hourglass} label="Longest role" value={vm.longest ? vm.longest.years + (vm.longest.years === 1 ? ' year' : ' years') : '—'} sub={vm.longest ? vm.longest.company : 'No complete dates'} /></div>
      <div className="s4"><Stat style={tw.stat} icon={Timer} label="Average tenure" value={reliableAvg ? vm.averageYears + (vm.averageYears === 1 ? ' year' : ' years') : '—'} sub={reliableAvg ? 'Across ' + vm.tenureBase + ' appointments' : vm.loaded < vm.total ? 'Not shown: not all appointments loaded' : vm.tenureBase < 2 ? 'Not shown: needs two or more dated roles' : 'Not shown: dates incomplete'} /></div>
      {dq ? <div className="s12"><DisqCard d={dq} /></div> : null}
      <div className="s4"><Section icon={UserRound} title="Details" desc="From Companies House records"><Dl rows={[['Date of birth', vm.born], ['Age', ageText(vm.dob)], ['Nationality', withFlags(vm.nationalities, tw.personFlags === 'both' || tw.personFlags === 'overview')], ['Country of residence', withFlags(vm.residences, tw.personFlags !== 'off')],
        ['First appointed', firstAp ? <Cp v={N.fmtDate(firstAp)} /> : ''], ['Last resigned', lastRes ? <Cp v={N.fmtDate(lastRes)} /> : ''],
        ['Correspondence address(es)', vm.addresses.length ? vm.addresses.map((a, i) => <div key={i}><Cp v={a} /> <a className="ml-1 inline-flex items-center gap-0.5 text-xs whitespace-nowrap text-muted-foreground underline-offset-4 hover:underline" target="_blank" rel="noopener" href={'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(a)}>Open in Maps<ExternalLink className="size-3" /></a></div>) : ''], ['Former names', vm.formerNames.join(', ')],
        ['Director ID', apIds.map((id) => <div key={id} className="font-mono text-xs [word-break:break-all]"><Cp v={id} /></div>)]]} /></Section></div>
      <div className="s8"><Appointments vm={vm} /></div>
      <div className="s12"><History items={vm.items} o={{ kind: 'person', complete, loaded: vm.loaded, total: vm.total }} /></div>
      {pnv ? <div className="s12"><Controls pn={pnv} names={names} /></div> : null}
    </div></div></ProfileCtx.Provider>
}

function PscOnly({ pn, pscId }) {
  const s = useLoad(() => companyNames(pn.items.map((x) => x.number)).catch(() => ({})), [pscId])
  return <div className="z-stack">
    <PersonHeader name={pn.name || 'Owner'} meta={['Owner details only', pn.born && 'Born ' + pn.born, pn.current.length + ' current']} corporate={pn.corporate} entry={{ kind: 'person', key: 'psc:' + pscId, href: U.psc(pscId), name: pn.name, sub: ['Owner details only', pn.born && 'Born ' + pn.born].filter(Boolean).join(' · ') }} />
    <div className="bento">
      <div className="s5"><Section icon={ChartPie} title="Owner details only" desc="Not linked to any director appointments by Companies House ID"><Dl rows={[['Name', pn.name && <Cp v={pn.name} />], ['Other names on record', pn.names.filter((x) => x !== pn.name).join(', ')], ['Nationality', pn.nationality], ['Country of residence', pn.residence], ['Born', pn.born && <Cp v={pn.born} />], ['Age', ageText(pn.dob)], ['Correspondence address(es)', pn.address && <Cp v={pn.address} />]]} /></Section></div>
      <div className="s7">{s.loading ? <Section title="Companies this person controls"><Rows n={3} /></Section> : <Controls pn={pn} names={s.data || {}} />}</div>
    </div></div>
}

function DisqRecord({ id, kind }) {
  const s = useLoad(() => loadDisq(id, kind), [id, kind])
  useCrumbs([{ label: 'Disqualified', href: '#/search?type=disqualified' }, { label: s.data ? s.data.name : 'Record' }], [s.data])
  useEffect(() => { if (s.data) setTitle(s.data.name) }, [s.data])
  if (s.loading) return <ProfileSkeleton />
  if (s.err) return <ErrorCard e={s.err} />
  const d = s.data
  return <div className="z-stack">
    <PersonHeader name={d.name} meta={[d.born && 'Born ' + d.born, d.nationality]} extra={<span className="font-semibold text-destructive">Disqualified director</span>} corporate={d.corporate} entry={{ kind: 'person', key: 'disq:' + id, href: U.disq(kind, id), name: d.name, sub: 'Disqualified director' }} />
    <DisqCard d={d} /></div>
}

/* ?id= officer appointments (several combined: id=a,b); ?psc= PSC notifications; ?disq= a disqualification record. */
export function PersonPage({ route }) {
  const okId = (s) => /^[A-Za-z0-9_-]{6,}$/.test(s)
  const ids = (route.q.get('id') || '').split(',').map((s) => s.trim()).filter(okId).slice(0, 10)
  const pscId = okId(route.q.get('psc') || '') ? route.q.get('psc') : ''
  const disqId = okId(route.q.get('disq') || '') ? route.q.get('disq') : ''
  useEffect(() => setTitle('Person'), [route.key])
  if (disqId) return <DisqRecord key={route.key} id={disqId} kind={route.q.get('k') === 'corporate' ? 'corporate' : 'natural'} />
  if (!ids.length && !pscId) return <ErrorCard e={{ message: 'No person given.' }} />
  return <Officer key={route.key} route={route} ids={ids} pscId={pscId} />
}
