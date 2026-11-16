// @ts-nocheck
import { Fragment, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Cp, ErrorBox, Loading, ProfileCtx, St, StatTile, Tile, TileHead } from '@/components/z/bits'
import { History, PersonHeader } from '@/components/z/tiles'
import { N } from '@/lib/legacy'
import { companyNames, disqForPerson, loadDisq, loadPerson } from '@/lib/data'
import { useLoad, setTitle } from '@/lib/hooks'
import { addViewed } from '@/lib/store'
import { U } from '@/lib/router'

const cpd = (v) => (/^\d/.test(v || '') ? <Cp v={v} /> : v)
const ageText = (dob) => { const lo = N.approxAge(dob); if (lo == null) return ''; return !dob.month || dob.month === new Date().getMonth() + 1 ? `${lo} or ${lo + 1}` : String(lo) }
/* rows: [label, value]; value may be a node. Empty values are dropped. */
const Dl = ({ rows }) => <dl className="dl">{rows.filter((r) => r && r[1] && !(Array.isArray(r[1]) && !r[1].length)).map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd>{v}</dd></Fragment>)}</dl>

function DisqTile({ d }) {
  const cur = d.items.some((x) => x.current)
  return <><TileHead title="Disqualified director" />
    <div className="verdict bad mt-0"><b>{cur ? 'Disqualified' : 'Previously disqualified'}</b></div>
    {d.items.map((x, i) => <div className="mt-3" key={i}><Dl rows={[['Type', x.type], ['Reason', x.reason], ['Law', x.law], ['Disqualified', [x.from && 'from ' + x.from, x.until && 'until ' + x.until].filter(Boolean).join(' ')], ['Court', x.court], ['Heard on', x.heard], ['Undertaking given', x.undertaken], ['Case', x.caseId], ['Companies named', x.companies.join(', ')], ['Address on record', x.address]]} /></div>)}
    {d.permissions.length ? <div className="mt-3"><Dl rows={d.permissions.map((p) => ['Permission to act', [p.companies.join(', '), p.court, p.granted && 'granted ' + p.granted, p.expires && 'until ' + p.expires].filter(Boolean).join(' · ')])} /></div> : null}
    <div className="muted mt-2.5 text-[12px]">{d.url ? <><a className="lnk" href={d.url} target="_blank" rel="noopener">View this record on Companies House</a>. </> : null}Linked to this person by an identical Companies House person number.</div></>
}
function Controls({ pn, names }) {
  const row = (x, i) => <div className="psc" key={i}><span /><div><div className="line"><span className="nm"><a href={U.company(x.number)}>{names[x.number] || 'Company ' + x.number}</a></span><span className="bd">{x.role}</span>{x.notified ? <span className="since">since {x.notified}</span> : null}{x.ceased ? <span className="since">ceased {x.ceased}</span> : null}</div>{x.controls.map((c) => <div className="other" key={c}>{c}</div>)}</div></div>
  return <><TileHead title="Companies this person controls" count={pn.current.length + ' current'} aside={pn.ceased.length ? pn.ceased.length + ' ceased' : ''} />
    {pn.current.length ? <div className="psc-list">{pn.current.map(row)}</div> : <div className="empty">No current significant control recorded.</div>}
    {pn.ceased.length ? <><div className="eyebrow mt-3.5 mb-1.5">Ceased ({pn.ceased.length})</div><div className="psc-list">{pn.ceased.map(row)}</div></> : null}</>
}

const FEW = 10, STEP = 25, CLOSED = ['dissolved', 'closed', 'converted-closed', 'removed']
/* Appointments table; over 10 rows it gets a filter box, a status menu, a sort menu and 'Show 25 more'. */
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
  return <><TileHead title="Appointments" count={vm.total} />
    {many ? <><div className="ap-tools"><Input type="search" value={t} onChange={(e) => reset(setT)(e.target.value)} placeholder="Filter by company name or number" aria-label="Filter appointments by company name or number" />
      <Select value={sv} onValueChange={reset(setSv)}><SelectTrigger aria-label="Status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All appointments</SelectItem><SelectItem value="current">Current</SelectItem><SelectItem value="resigned">Resigned</SelectItem><SelectItem value="co-active">Company active</SelectItem><SelectItem value="co-closed">Company dissolved or closed</SelectItem></SelectContent></Select>
      <Select value={o} onValueChange={reset(setO)}><SelectTrigger aria-label="Sort"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="new">Newest first</SelectItem><SelectItem value="old">Oldest first</SelectItem><SelectItem value="az">Company A–Z</SelectItem></SelectContent></Select></div>
      <div className="ap-count" role="status">{[`Showing ${vis.toLocaleString('en-GB')} of ${m.length.toLocaleString('en-GB')}${t || sv !== 'all' ? ' matching' : ''}`, vm.loaded < vm.total ? `${vm.loaded.toLocaleString('en-GB')} of ${vm.total.toLocaleString('en-GB')} appointments loaded` : ''].filter(Boolean).join(' · ')}</div></> : null}
    <Table className="z-table"><TableHeader><TableRow><TableHead>Company</TableHead><TableHead>Status</TableHead><TableHead>Role</TableHead><TableHead>Appointed</TableHead><TableHead>Resigned</TableHead></TableRow></TableHeader>
      <TableBody>{list.slice(0, vis).map((a, i) => <TableRow key={i}><TableCell className="whitespace-normal">{a.number ? <><a href={U.company(a.number)}>{a.company}</a> <span className="muted"><Cp v={a.number} /></span></> : a.company}</TableCell><TableCell>{a.status ? <St label={a.status} colour={a.colour} /> : null}</TableCell><TableCell>{a.role}</TableCell><TableCell className="num">{cpd(a.appointed)}</TableCell><TableCell className="num">{cpd(a.resigned)}</TableCell></TableRow>)}
        {!vis ? <TableRow><TableCell colSpan={5} className="muted">No appointments match.</TableCell></TableRow> : null}</TableBody></Table>
    {many && vis < m.length ? <div className="mt-2.5 flex justify-center"><Button variant="outline" onClick={() => setShown(shown + STEP)}>Show {Math.min(STEP, m.length - vis)} more</Button></div> : null}</>
}

function Officer({ route, ids, pscId }) {
  const s = useLoad(() => loadPerson(ids, pscId), [route.key])
  const [dq, setDq] = useState(null)
  useEffect(() => {
    const d = s.data; if (!d) return
    if (d.pscOnly) { const pn = d.pscOnly; setTitle(pn.name || 'Owner'); addViewed(pn.corporate ? 'corporate' : 'person', 'psc:' + pscId, pn.name || 'Owner'); return }
    const key = pscId ? 'psc:' + pscId : 'id:' + d.apIds.join(',')
    setTitle(d.vm.name); addViewed(d.vm.corporate ? 'corporate' : 'person', key, d.vm.name)
    let live = true; setDq(null)
    disqForPerson(d.apIds, d.vm).then((x) => live && setDq(x)).catch((e) => console.warn(e))
    return () => { live = false }
  }, [s.data])
  if (s.loading) return <div className="panel"><Loading /></div>
  if (s.err) return <div className="panel"><ErrorBox e={s.err} /></div>
  if (s.data.pscOnly) return <PscOnly pn={s.data.pscOnly} pscId={pscId} />
  const { vm, apIds, pnv, names, complete } = s.data
  const key = pscId ? 'psc:' + pscId : 'id:' + apIds.join(',')
  const reliableAvg = vm.averageYears != null && vm.loaded === vm.total && vm.tenureBase >= Math.max(2, Math.ceil(vm.loaded * 0.8))
  const firstAp = vm.items.map((x) => x.appointedIso).filter(Boolean).sort()[0]
  const lastRes = vm.active ? '' : vm.items.map((x) => x.resignedIso).filter(Boolean).sort().pop()
  const f = (label, value, sub, tone?) => ({ label, value, sub, tone })
  return <ProfileCtx.Provider value={{ here: route.key, name: vm.name }}><article className="z-profile">
    <Tile className="mb-(--gap)"><PersonHeader name={vm.name} meta={[vm.roles.join(', ')]} corporate={vm.corporate} entry={{ kind: 'person', key, href: pscId ? U.psc(pscId) : U.person(apIds), name: vm.name, sub: [vm.roles[0], vm.born && 'Born ' + vm.born].filter(Boolean).join(' · ') }} /></Tile>
    <div className="bento">
      <div className="s4"><StatTile f={f('Dissolved or in liquidation', String(vm.finished), 'Companies appointed to', vm.finished ? 'warn' : '')} /></div>
      <div className="s4"><StatTile f={f('Longest role', vm.longest ? vm.longest.years + (vm.longest.years === 1 ? ' year' : ' years') : '—', vm.longest ? vm.longest.company : 'No complete dates')} /></div>
      <div className="s4"><StatTile f={f('Average tenure', reliableAvg ? vm.averageYears + (vm.averageYears === 1 ? ' year' : ' years') : '—', reliableAvg ? 'Across ' + vm.tenureBase + ' appointments' : vm.loaded < vm.total ? 'Not shown: not all appointments loaded' : vm.tenureBase < 2 ? 'Not shown: needs two or more dated roles' : 'Not shown: dates incomplete')} /></div>
      {dq ? <Tile className="s12"><DisqTile d={dq} /></Tile> : null}
      <Tile className="s4 person-dl"><TileHead title="Details" /><Dl rows={[['Date of birth', vm.born], ['Age', ageText(vm.dob)], ['Nationality', vm.nationalities.join(', ')], ['Country of residence', vm.residences.join(', ')],
        ['First appointed', firstAp ? <Cp v={N.fmtDate(firstAp)} /> : ''], ['Last resigned', lastRes ? <Cp v={N.fmtDate(lastRes)} /> : ''],
        ['Correspondence address(es)', vm.addresses.length ? vm.addresses.map((a, i) => <div key={i}><Cp v={a} /></div>) : ''], ['Former names', vm.formerNames.join(', ')],
        ['Director ID', apIds.map((id) => <span className="dir-id mr-1.5" key={id}><Cp v={id} /></span>)]]} /></Tile>
      <Tile className="s8 appointments-tile"><Appointments vm={vm} /></Tile>
      <Tile className="s12 yc-tile person-chart"><History items={vm.items} o={{ kind: 'person', complete, loaded: vm.loaded, total: vm.total }} /></Tile>
      {pnv ? <Tile className="s12"><Controls pn={pnv} names={names} /></Tile> : null}
    </div></article></ProfileCtx.Provider>
}

function PscOnly({ pn, pscId }) {
  const s = useLoad(() => companyNames(pn.items.map((x) => x.number)).catch(() => ({})), [pscId])
  return <article className="z-profile">
    <Tile className="mb-(--gap)"><PersonHeader name={pn.name || 'Owner'} meta={['Owner details only', pn.born && 'Born ' + pn.born, pn.current.length + ' current']} corporate={pn.corporate} entry={{ kind: 'person', key: 'psc:' + pscId, href: U.psc(pscId), name: pn.name, sub: ['Owner details only', pn.born && 'Born ' + pn.born].filter(Boolean).join(' · ') }} /></Tile>
    <div className="bento">
      <Tile className="s5"><TileHead title="Owner details only" /><Dl rows={[['Name', pn.name && <Cp v={pn.name} />], ['Other names on record', pn.names.filter((x) => x !== pn.name).join(', ')], ['Nationality', pn.nationality], ['Country of residence', pn.residence], ['Born', pn.born && <Cp v={pn.born} />], ['Age', ageText(pn.dob)], ['Correspondence address(es)', pn.address && <Cp v={pn.address} />]]} />
        <div className="muted mt-2.5 text-[12px]">This person is not linked to any director appointments by Companies House ID.</div></Tile>
      <Tile className="s7">{s.loading ? <Loading /> : <Controls pn={pn} names={s.data || {}} />}</Tile>
    </div></article>
}

function DisqRecord({ id, kind }) {
  const s = useLoad(() => loadDisq(id, kind), [id, kind])
  useEffect(() => { if (s.data) setTitle(s.data.name) }, [s.data])
  if (s.loading) return <div className="panel"><Loading /></div>
  if (s.err) return <div className="panel"><ErrorBox e={s.err} /></div>
  const d = s.data
  return <article className="z-profile">
    <Tile className="mb-(--gap)"><PersonHeader name={d.name} meta={[d.born && 'Born ' + d.born, d.nationality]} extra={<span className="flagtxt bad">Disqualified director</span>} corporate={d.corporate} entry={{ kind: 'person', key: 'disq:' + id, href: U.disq(kind, id), name: d.name, sub: 'Disqualified director' }} /></Tile>
    <div className="bento"><Tile className="s12"><DisqTile d={d} /></Tile></div></article>
}

/* ?id= officer appointments (several records combined: id=a,b); ?psc= PSC notifications; ?disq= a disqualification record. */
export function PersonPage({ route }) {
  const okId = (s) => /^[A-Za-z0-9_-]{6,}$/.test(s)
  const ids = (route.q.get('id') || '').split(',').map((s) => s.trim()).filter(okId).slice(0, 10)
  const pscId = okId(route.q.get('psc') || '') ? route.q.get('psc') : ''
  const disqId = okId(route.q.get('disq') || '') ? route.q.get('disq') : ''
  useEffect(() => setTitle('Person'), [route.key])
  if (disqId) return <DisqRecord key={route.key} id={disqId} kind={route.q.get('k') === 'corporate' ? 'corporate' : 'natural'} />
  if (!ids.length && !pscId) return <div className="panel plain-msg">No person given. <a className="lnk" href="#/search?type=people">Search people</a></div>
  return <Officer key={route.key} route={route} ids={ids} pscId={pscId} />
}
