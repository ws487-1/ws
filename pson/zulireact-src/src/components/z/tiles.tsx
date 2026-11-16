// @ts-nocheck
import { Fragment, useState } from 'react'
import { Bookmark, Bell, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Charts } from '@/lib/legacy'
import { U } from '@/lib/router'
import { isSaved, savedKey, toggleSaved } from '@/lib/store'
import { useLoad } from '@/lib/hooks'
import { SIM, connected } from '@/lib/data'
import { Avatar, Cp, FilingRow, IdV, KindIcon, Loading, St, TileHead, useProfile } from './bits'
import { rememberBack } from '@/lib/store'

const cpd = (v) => (/^\d/.test(v || '') ? <Cp v={v} /> : v) // dates copy; 'before 1992' stays plain text
const BASE = import.meta.env.BASE_URL

/* Save (bookmark, filled when saved) and the Alerts placeholder. Same storage as /pson/zuli. */
export function SaveBtns({ entry }) {
  const [on, setOn] = useState(isSaved(savedKey(entry)))
  return <div className="hdr-actions">
    <Button variant="outline" aria-pressed={on} onClick={() => setOn(toggleSaved(entry))} className={on ? 'text-(--zb)' : ''}><Bookmark className={on ? 'fill-current' : ''} />{on ? 'Saved' : 'Save'}</Button>
    <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" aria-disabled="true" aria-label="Alerts (coming soon)" className="cursor-default text-(--ink-500)"><Bell /></Button></TooltipTrigger><TooltipContent>Alerts coming soon</TooltipContent></Tooltip>
  </div>
}

function Nation({ n }) {
  if (!n) return null
  if (n.flag) return <span className="nat" title={'Registered in ' + n.name} aria-label={'Registered in ' + n.name} role="img"><img className="flag" src={BASE + 'flags/' + n.flag + '.svg'} width="24" height="18" alt="" /><span aria-hidden="true">{n.name}</span></span>
  if (n.reg) return <span className="nat" title={'Registered in ' + n.text}>{n.text}</span>
  return <span className="nat">Registered office: {n.text}</span>
}
const sicHref = (code, vm) => {
  const pc = (/^([A-Z]{1,2}\d[A-Z\d]?)\s*\d[A-Z]{2}$/.exec(String(vm.address.postcode || '').toUpperCase().trim()) || [])[1] || ''
  const p = new URLSearchParams({ mode: 'advanced', sic: code, status: 'active' })
  if (pc || vm.address.town) p.set('near', pc || vm.address.town)
  if (vm.address.town && pc) p.set('neartown', vm.address.town)
  return '#/search?' + p.toString()
}
const Sep = () => <span className="sep" />
const joinMeta = (xs) => xs.filter(Boolean).flatMap((m, i) => (i ? [<Sep key={'s' + i} />, <span key={i}>{m}</span>] : [<span key={i}>{m}</span>]))

/* Overview header: status as bold coloured text, address with nation, SIC rows, Save + alerts, verdict, flags. */
export function CompanyHeader({ vm, nat }) {
  const meta = [<Cp key="t" v={vm.type.label} />, vm.type.subtype, vm.number && <>No. <Cp v={vm.number} /></>, vm.createdText && <>Incorporated <Cp v={vm.createdText} /></>, vm.ceasedText && <>Ceased <Cp v={vm.ceasedText} /></>]
  const tone = vm.verdict.some((v) => v.tone === 'bad') ? 'bad' : vm.verdict.some((v) => v.tone === 'warn') ? 'warn' : 'neutral'
  return <header className="hdr"><div className="hdr-top"><div className="min-w-0">
    <div className="mb-2 flex flex-wrap items-center gap-2.5"><St label={vm.status.label} colour={vm.status.colour} />{vm.status.detail ? <St label={vm.status.detail} colour={vm.status.detailColour} /> : null}</div>
    <h1><Cp v={vm.name} /></h1>
    <div className="hdr-meta"><KindIcon kind="company" label="Company" />{joinMeta(meta)}</div>
    {vm.address.oneLine ? <div className="hdr-addr"><MapPin /><span className="addr-txt"><Cp v={vm.address.oneLine} /></span><span className="ro-nation"><Nation n={nat} /></span></div> : null}
    {vm.otherRegister ? <div className="hdr-addr"><span>Also registered with the <a className="lnk" href={vm.otherRegister.url} target="_blank" rel="noopener">{vm.otherRegister.body}</a>.</span></div> : null}
    {vm.sic.length ? <div className="hdr-sic">{vm.sic.map((s) => <a key={s.code} className="sic-row" href={sicHref(s.code, vm)} title={'Find active companies with SIC ' + s.code}><b className="mono">{s.code}</b><span className="sic-d">{s.desc}</span></a>)}</div> : null}
  </div><SaveBtns entry={{ kind: 'company', number: vm.number, name: vm.name, status: vm.status.label, colour: vm.status.colour, town: vm.address.town || '' }} /></div>
    {vm.verdict.length ? <div className={'verdict ' + tone}><b>Heads up</b><span>{vm.verdict.map((v) => v.text).join(' · ')}</span></div> : null}
    {vm.flags.length ? <div className="flags">{vm.flags.map((f) => <span key={f.label} className={'flagtxt ' + f.tone}>{f.label}</span>)}</div> : null}
  </header>
}

export function PersonHeader({ name, meta, extra, entry, corporate }) {
  return <header className="hdr"><div className="hdr-top"><div className="min-w-0">
    {extra ? <div className="mb-2 flex flex-wrap items-center gap-2.5">{extra}</div> : null}
    <h1><Cp v={name} /></h1><div className="hdr-meta"><KindIcon kind={corporate ? 'company' : 'person'} label={corporate ? 'Company' : 'Person'} name={name} />{joinMeta(meta)}</div></div>
    <SaveBtns entry={entry} /></div></header>
}

export function Deadlines({ vm }) {
  const a = vm.accounts, c = vm.confirmation
  const dl = [['Year end', a.refDate], ['Last accounts', a.lastMadeUp || a.lastType ? <>{a.lastMadeUp ? <Cp v={a.lastMadeUp} /> : null}{a.lastMadeUp && a.lastType ? ' · ' : ''}{a.lastType}</> : ''], ['Last period', a.lastPeriod], ['Next period', a.nextPeriod], ['Last confirmation', c.last ? <Cp v={c.last} /> : '']].filter((x) => x[1])
  return <><TileHead title="Deadlines" />
    {vm.deadlines.length ? <div className="dlines">{vm.deadlines.map((d) => { const pct = d.days < 0 ? 100 : Math.max(4, Math.min(100, 100 - (d.days / 365) * 100)); return <div key={d.label} className={'dline ' + d.tone}><span className="t">{d.label}</span><span className="d num"><Cp v={d.dueText} /></span><span className="n">{d.note}</span><span className="r">{d.relText}</span><div className="bar"><i className={d.tone === 'ok' ? 'ok' : d.tone === 'warn' ? 'warn' : ''} style={{ width: pct + '%', background: d.tone === 'bad' ? 'var(--bad)' : undefined }} /></div></div> })}</div>
      : <div className="empty">{vm.status.active ? 'No filing deadlines on record.' : 'No deadlines: the company is ' + vm.status.label.toLowerCase() + '.'}</div>}
    {dl.length ? <dl className="dl acc-dl">{dl.map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd className="num">{v}</dd></Fragment>)}</dl> : null}</>
}

/* People row: initials in a Zuli-blue shade (companies get the building marker). Other appointments link to the person
   (no collapsible list). */
function PersonRow({ p, vm }) {
  const ap = p.appointmentsLink && vm.appointments[p.appointmentsLink]
  const other = ap ? ap.items.filter((x) => x.number !== vm.number) : []
  const dq = vm.disq && p.personNumber && vm.disq[p.personNumber]
  const total = ap && ap.total > ap.items.length ? ap.total - 1 : other.length
  return <div className="prow">{p.corporate ? <KindIcon kind="company" /> : <Avatar name={p.name} />}
    <div className="min-w-0"><div className="nm">{p.officerId ? <a href={U.person(p.officerId)}>{p.name}</a> : p.name}{p.idv ? <span className="idv" title={'Identity verified ' + p.idv.verifiedOn}><IdVIcon />ID verified</span> : null}</div>
      <div className="rl">{p.roleLabel}{p.resigned ? <> · resigned {cpd(p.resigned)}</> : p.appointed ? <> · since {cpd(p.appointed)}</> : null}{p.tenureYears != null && !p.resigned ? ` (${p.tenureYears}y)` : ''}</div>
      {dq ? <div><a className="flagtxt bad" href={U.person(p.officerId)}>Disqualified director</a></div> : null}</div>
    <div className="cell hide-c">{p.nationality}<span className="block text-(--ink-500)">{p.residence ? 'Lives in ' + p.residence : ''}</span></div>
    {other.length && p.officerId ? <div className="appts"><a href={U.person(p.officerId)}>{total} other appointment{total === 1 ? '' : 's'}</a></div> : null}
  </div>
}
const IdVIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>

export function People({ vm, limit = 6 }) {
  const of = vm.officers, w = vm.officerWord || { many: 'Officers' }
  const act = of.active, prof = useProfile()
  const remember = () => prof && rememberBack(U.officers(vm.number), prof.here, prof.name)
  return <><TileHead title={w.many === 'Officers' ? 'People' : w.many} count={of.counts.active + ' active'} aside={of.counts.resigned ? of.counts.resigned + ' former' : ''} open={{ href: U.officers(vm.number), label: 'Open the full officers list' }} />
    {act.length ? <div className="people-sum">{Object.entries(of.roleCounts).map(([k, v]: any) => <span className="chip" key={k}><b>{v}</b>{k.toLowerCase()}{v > 1 ? 's' : ''}</span>)}
      {of.medianAge ? <span className="chip">Median age <b>{of.medianAge}</b></span> : null}{of.nationalities[0] ? <span className="chip">{of.nationalities.slice(0, 2).map((n) => n.name).join(', ')}</span> : null}{of.verifiedCount ? <span className="chip">ID verified <b>{of.verifiedCount}/{of.active.length}</b></span> : null}</div> : null}
    {act.length ? <div className="people">{act.slice(0, limit).map((p, i) => <PersonRow key={i} p={p} vm={vm} />)}</div>
      : <div className="empty">No current {w.many.toLowerCase()}.</div>}
    {act.length > limit || of.counts.resigned ? <a className="more-link" href={U.officers(vm.number)} onClick={remember}>{[act.length > limit && `${act.length - limit} more current`, of.counts.resigned && `${of.counts.resigned} former`].filter(Boolean).join(' and ')} on the full list</a> : null}</>
}

const pscName = (p) => (p.ukCompany ? <a href={U.company(p.ukCompany)}>{p.name}</a> : p.pscId && !p.secure ? <a href={U.psc(p.pscId)}>{p.name}</a> : p.name)
const PscIcon = ({ p }) => <KindIcon kind={p.corporate ? 'company' : 'person'} label={p.secure ? 'Protected person' : p.kindLabel || (p.corporate ? 'Company' : 'Individual')} name={p.name} />
export function Ownership({ vm }) {
  const w = vm.ownership
  return <><TileHead title="Ownership" count={w.current.length ? w.current.length + ' PSC' + (w.current.length === 1 ? '' : 's') : ''} aside={w.counts.ceased ? w.counts.ceased + ' ceased' : ''} />
    {w.current.length ? <div className="psc-list">{w.current.map((p, i) => <div className="psc ic" key={i}><PscIcon p={p} /><div className="psc-body"><div className="line"><span className="nm">{pscName(p)}{p.idv ? <span className="idv"><IdVIcon />ID verified</span> : null}</span><span className="bd">{p.role}</span>{p.notified ? <span className="since">since {p.notified}</span> : null}</div>
      {p.controls.map((c) => <div className="other" key={c}>{c}</div>)}{p.sanctioned ? <div className="other flagtxt bad">On a sanctions list</div> : null}</div></div>)}</div> : null}
    {w.notes.length ? <div className={w.current.length ? 'mt-2.5' : ''}>{w.notes.map((t) => <div className="own-note" key={t}>{t}</div>)}</div> : null}
    {w.ceased.length ? <><div className="eyebrow mt-3.5 mb-1.5">Former PSCs ({w.ceased.length})</div><div className="psc-list">{w.ceased.map((p, i) => <div className="psc ic" key={i}><PscIcon p={p} /><div className="psc-body"><div className="line"><span className="nm">{pscName(p)}</span><span className="since">{p.notified} – {p.ceased}</span></div></div></div>)}</div></> : null}</>
}

function ChargeRow({ x }) {
  const d = x.description || x.secured
  return <div className={'charge' + (x.outstanding ? '' : ' muted-row')}><div className="charge-top"><div className="min-w-0"><div className="who">{x.entitled.join(', ') || x.title}{x.moreEntitled ? ' and others' : ''}</div>
    <div className="meta">{x.title} · created {x.created}{x.code ? <> · <span className="mono">{x.code}</span></> : null}{x.satisfied ? ' · satisfied ' + x.satisfied : ''}</div></div><span className={'flagtxt ' + (x.outstanding ? 'warn' : 'neutral')}>{x.statusLabel}</span></div>
    {x.features.length ? <div className="feat">{x.features.map((f) => <span className="chip" key={f}>{f}</span>)}</div> : null}
    {d ? <div className="desc">{d.slice(0, 220)}{d.length > 220 ? '…' : ''}</div> : null}</div>
}
export function Charges({ vm, limit = 3 }) {
  const c = vm.charges
  if (!c.available || !c.total) return <><TileHead title="Charges" /><div className="empty">No charges registered against this company.</div></>
  const out = c.outstanding, sat = c.satisfied
  return <><TileHead title="Charges" count={out + ' outstanding'} aside={c.total + ' total'} />
    <div className="chg-sum"><div className="bar"><i className="warn" style={{ width: (out / c.total) * 100 + '%' }} /><i className="neutral" style={{ width: (sat / c.total) * 100 + '%' }} /></div><div className="legend"><span><i style={{ background: '#d49a4b' }} />{out} outstanding</span><span><i style={{ background: 'var(--ink-300)' }} />{sat} satisfied</span></div></div>
    {c.lenders.length ? <div className="people-sum">{c.lenders.slice(0, 4).map((l) => <span className="chip" key={l.name}>{l.name} <b>{l.n}</b></span>)}</div> : null}
    <div className="charges">{c.items.slice(0, limit).map((x, i) => <ChargeRow key={i} x={x} />)}</div>
    {c.items.length > limit ? <div className="more-link mt-1.5">{c.items.length - limit} more charge{c.items.length - limit === 1 ? '' : 's'} not shown</div> : null}</>
}

export function Insolvency({ vm }) {
  const i = vm.insolvency
  return <><TileHead title="Insolvency" count={i.cases.length + ' case' + (i.cases.length === 1 ? '' : 's')} />{i.cases.map((c, k) => <div className="ins" key={k}><h4>{c.type}{c.number ? <span className="muted ml-1 text-[13px] font-medium">case {c.number}</span> : null}</h4>
    <div className="dates">{c.dates.map((d) => <span className="chip" key={d.label}>{d.label} <b>{d.date}</b></span>)}</div>
    {c.practitioners.map((p, j) => <div className="ip" key={j}><b className="text-(--ink-900)">{p.name}</b> <span className="muted">{p.role}{p.appointed ? ' · appointed ' + p.appointed : ''}{p.ceased ? ' · ceased ' + p.ceased : ''}</span><div className="muted text-[12px]">{p.address}</div></div>)}
    {c.notes.map((n) => <div className="muted mt-1.5 text-[12px]" key={n}>{n}</div>)}</div>)}</>
}

export function Changes({ vm }) {
  const chg = vm.officers.changes
  return <><TileHead title="Officer changes" count="last 12 months" open={{ span: true }} />
    {chg.length ? <ul className="changes">{chg.slice(0, 8).map((c, i) => <li key={i}><span className={'k ' + c.kind}>{c.kind}</span><span><b className="font-semibold text-(--ink-900)">{c.name}</b> <span className="muted">{c.role.toLowerCase()} · {c.dateText}</span></span></li>)}</ul> : <div className="empty">No appointments or resignations in the last 12 months.</div>}
    <div className="tile-foot">View all officers</div></>
}

export function Filings({ vm }) {
  const f = vm.filings, prof = useProfile()
  if (!f.items.length) return <><TileHead title="Filing history" /><div className="empty">No filings on record.</div></>
  return <><TileHead title="Filing history" count={f.total.toLocaleString('en-GB')} aside="latest 5" open={{ href: U.filings(vm.number), label: 'Open the full filing history' }} />
    <div>{f.items.slice(0, 5).map((it, i) => <FilingRow key={i} it={it} />)}</div>
    <div className="tile-foot"><a href={U.filings(vm.number)} onClick={() => prof && rememberBack(U.filings(vm.number), prof.here, prof.name)}>View all filings</a></div></>
}

const shortDate = (s) => new Date(s + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
/* Board activity / appointments by year: conditional event chart from charts.js, factual fallback text otherwise. */
export function History({ items, o }) {
  const m = Charts.analyse(items, o)
  const title = o.kind === 'company' ? 'Board activity' : m.eligible ? 'Appointments by year' : 'Appointment history'
  if (!m.eligible) {
    let text
    if (m.reason === 'unavailable') text = 'History unavailable.'
    else if (m.reason === 'partial') text = `History not fully loaded${o.loaded != null && o.total != null ? ': ' + o.loaded + ' of ' + o.total + ' records' : ''}.`
    else if (m.reason === 'dates') text = 'Some appointment dates are incomplete or need review. See the individual records for details.'
    else {
      const noun = o.kind === 'company' ? 'directorship' : 'appointment'
      text = m.total + ' recorded ' + noun + (m.total === 1 ? '' : 's')
      const unique = [...new Set(m.exactDates)]
      if (m.exactDates.length === m.total && unique.length === 1) text += (m.total === 1 ? ', beginning on ' : ', all beginning on ') + shortDate(unique[0] as string)
      else if (!m.events.length) text += '; no dated changes since ' + m.from.slice(0, 4)
      else text += '; ' + m.events.length + ' dated change' + (m.events.length === 1 ? '' : 's') + ' across ' + m.eventYears + ' year' + (m.eventYears === 1 ? '' : 's')
      text += '.'
    }
    return <><TileHead title={title} open={o.open} /><p className="history-summary">{text}</p></>
  }
  const rows = m.rows, sumA = rows.reduce((a, r) => a + r.a, 0), sumR = rows.reduce((a, r) => a + r.r, 0), max = Math.max(1, ...rows.flatMap((r) => [r.a, r.r]))
  const label = rows.map((r) => `${r.y}: ${r.a} appointed, ${r.r} resigned${m.stockSafe ? ', ' + r.n + ' in post' : ''}`).join('; ')
  const kpi = (l, n) => <div className="yc-kpi" key={l}><span className="yc-kl">{l}</span><b className="num">{n}</b></div>
  return <><TileHead title={title} count={rows[0].y + '–' + shortDate(m.today)} open={o.open} />
    <div className={'yc-kpis' + (m.stockSafe ? '' : ' two')}>{m.stockSafe ? kpi(o.kind === 'company' ? 'In post now' : 'Roles held now', rows[rows.length - 1].n) : null}{kpi('Appointed since ' + rows[0].y, sumA)}{kpi('Resigned since ' + rows[0].y, sumR)}</div>
    <div className={'yc' + (m.stockSafe ? '' : ' events-only')} role="img" aria-label={label}><div className="yc-axis" aria-hidden="true"><span className="yc-al a">Appointed</span><span className="yc-al r">Resigned</span>{m.stockSafe ? <span className="yc-al n">In post</span> : null}</div>
      <div className="yc-cols" aria-hidden="true" style={{ '--n': rows.length }}>{rows.map((r) => <div key={r.y} className={'yc-col' + (r.y === +m.today.slice(0, 4) ? ' now' : '')}><div className="yc-up"><i className="a" style={{ height: (r.a / max) * 100 + '%' }}>{r.a ? <b>{r.a}</b> : null}</i></div><div className="yc-dn"><i className="r" style={{ height: (r.r / max) * 100 + '%' }}>{r.r ? <b>{r.r}</b> : null}</i></div><span className="yc-x">{r.y}</span>{m.stockSafe ? <span className="yc-n num">{r.n}</span> : null}</div>)}</div></div></>
}

const SimRow = ({ x }) => <div className="sim-row"><a className="nm" href={U.company(x.number)}>{x.name}</a><span className="m num">{x.ageYears != null ? x.ageYears + 'y' : ''}</span><span className="s">{[x.town, x.postcode, x.generic ? 'general activity code' : ''].filter(Boolean).join(' · ')}</span><span className="m">{x.number}</span></div>
const Notes = ({ n }) => <>{(n || []).filter(Boolean).map((t) => <div className="note" key={t}>{t}</div>)}</>
function SimBody({ k, vm }) {
  const [prog, setProg] = useState('')
  const s = useLoad(() => (k === 'connected' ? connected(vm, setProg) : SIM[k](vm)), [k, vm.number])
  if (s.loading) return <Loading t={prog || undefined} />
  if (s.err) return <div className="err">{s.err.message || String(s.err)}</div>
  const d = s.data
  if (k === 'connected') return <><div className="muted mb-1.5 text-[12px]">Companies sharing a director or owner with this company (matched by Companies House ID)</div>
    {d.rows.length ? <div className="sim">{d.rows.map((r) => <div className="sim-row" key={r.number}><a className="nm" href={U.company(r.number)}>{r.name}</a><span className="m">{r.status ? <St label={r.status} colour={r.colour} /> : null}</span><span className="s">Linked through {r.links.slice(0, 3).map((l, i) => <span key={i}>{i ? '; ' : ''}{l.href ? <a className="lnk" href={l.href}>{l.name}</a> : l.name}, {l.role.toLowerCase()}</span>)}{r.links.length > 3 ? ` and ${r.links.length - 3} more` : ''}</span><span className="m">{r.number}</span></div>)}</div> : null}<Notes n={d.notes} /></>
  if (d.empty) return <><div className="empty">{d.empty}</div><Notes n={d.notes} /></>
  return <><div className="sim">{d.items.map((x) => <SimRow key={x.number} x={x} />)}</div><Notes n={d.notes} /></>
}
export function Similar({ vm }) {
  const [k, setK] = useState('nearby')
  return <><TileHead title="Similar companies" />
    <Tabs value={k} onValueChange={setK} className="mb-2"><TabsList aria-label="Similar companies"><TabsTrigger value="nearby">Nearby</TabsTrigger><TabsTrigger value="trade">Same trade, UK-wide</TabsTrigger><TabsTrigger value="connected">Connected</TabsTrigger></TabsList></Tabs>
    <div role="tabpanel" aria-live="polite"><SimBody key={k} k={k} vm={vm} /></div></>
}
export function UkEst({ vm }) {
  const u = vm.ukEstablishments
  return <><TileHead title="UK establishments" count={u.length} />{u.length ? <div className="sim">{u.map((x) => <div className="sim-row" key={x.number}><a className="nm" href={U.company(x.number)}>{x.name}</a><span className="m">{x.status ? <St label={x.status} colour={x.colour} /> : null}</span><span className="s">{x.town}</span><span className="m">{x.number}</span></div>)}</div> : <div className="empty">No UK establishments on record.</div>}</>
}
