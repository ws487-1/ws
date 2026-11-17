// @ts-nocheck
import { Fragment, useState } from 'react'
import { Bookmark, Bell, MapPin, CalendarClock, UsersRound, ChartPie, Landmark, ArrowLeftRight, ChartColumn, FileText, Building2, ShieldAlert, Network } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Charts } from '@/lib/legacy'
import { U } from '@/lib/router'
import { isSaved, savedKey, toggleSaved } from '@/lib/store'
import { useLoad } from '@/lib/hooks'
import { useTweaks } from '@/lib/tweaks'
import { SIM, connected } from '@/lib/data'
import { Cp, FilingTable, IdV, Mark, Ini, CoMark, MoreLink, Muted, Note, OpenBtn, Rows, Section, St, useProfile } from './bits'
import { cn } from '@/lib/utils'

const cpd = (v) => (/^\d/.test(v || '') ? <Cp v={v} /> : v)
const BASE = import.meta.env.BASE_URL
const Dot = () => <span className="text-muted-foreground/60" aria-hidden="true">·</span>
const metaLine = (xs) => xs.filter(Boolean).flatMap((m, i) => (i ? [<Dot key={'d' + i} />, <span key={i}>{m}</span>] : [<span key={i}>{m}</span>]))

/* Save (bookmark, filled when saved) + Alerts placeholder. Same storage as /pson/zuli. */
export function SaveBtns({ entry }) {
  const [on, setOn] = useState(isSaved(savedKey(entry)))
  return <div className="flex shrink-0 gap-2">
    <Button variant={on ? 'secondary' : 'outline'} aria-pressed={on} onClick={() => setOn(toggleSaved(entry))}><Bookmark className={on ? 'fill-current' : ''} />{on ? 'Saved' : 'Save'}</Button>
    <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" aria-disabled="true" aria-label="Alerts (coming soon)" className="text-muted-foreground"><Bell /></Button></TooltipTrigger><TooltipContent>Alerts coming soon</TooltipContent></Tooltip>
  </div>
}

/* Registered-office nation. 'Flag style' setting: country (England/Scotland/Wales flags; Northern Ireland as text),
   union (Union Jack for every UK company), both (Union Jack plus the country flag). SVGs from flag-icons (MIT). */
const Flag = ({ f }) => <img src={BASE + 'flags/' + f + '.svg'} width="18" height="13" alt="" className="z-flag rounded-[2px] ring-1 ring-border" />
function Nation({ n }) {
  const [tw] = useTweaks()
  if (!n) return null
  const name = n.flag ? n.name : n.text
  if (n.uk && tw.flag !== 'country') return <span className="inline-flex items-center gap-1.5" title={'Registered in ' + name + ', United Kingdom'}><Flag f="gb" />{tw.flag === 'both' && n.flag ? <Flag f={n.flag} /> : null}{name}</span>
  if (n.flag) return <span className="inline-flex items-center gap-1.5" title={'Registered in ' + n.name}><Flag f={n.flag} />{n.name}</span>
  return <span>{n.reg ? n.text : 'Registered office: ' + n.text}</span>
}
const sicHref = (code, vm) => {
  const pc = (/^([A-Z]{1,2}\d[A-Z\d]?)\s*\d[A-Z]{2}$/.exec(String(vm.address.postcode || '').toUpperCase().trim()) || [])[1] || ''
  const p = new URLSearchParams({ mode: 'advanced', sic: code, status: 'active' })
  if (pc || vm.address.town) p.set('near', pc || vm.address.town)
  if (vm.address.town && pc) p.set('neartown', vm.address.town)
  return '#/search?' + p.toString()
}

/* Overview header card: status as bold coloured text, name, meta, address with nation, SIC buttons, Save + alerts. */
export function CompanyHeader({ vm, nat }) {
  const tone = vm.verdict.some((v) => v.tone === 'bad') ? 'bad' : vm.verdict.some((v) => v.tone === 'warn') ? 'warn' : ''
  return <Card><CardContent className="grid gap-4">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="grid min-w-0 gap-2">
        <div className="flex flex-wrap items-center gap-3 text-sm"><St label={vm.status.label} colour={vm.status.colour} />{vm.status.detail ? <St label={vm.status.detail} colour={vm.status.detailColour} /> : null}</div>
        <h1 className="text-2xl font-semibold tracking-tight [overflow-wrap:anywhere] sm:text-3xl"><Cp v={vm.name} /></h1>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">{metaLine([<Cp key="t" v={vm.type.label} />, vm.type.subtype, vm.number && <>No. <Cp v={vm.number} /></>, vm.createdText && <>Incorporated <Cp v={vm.createdText} /></>, vm.ceasedText && <>Ceased <Cp v={vm.ceasedText} /></>])}</div>
        {vm.address.oneLine ? <div className="flex items-start gap-2 text-sm"><MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><span className="min-w-0"><Cp v={vm.address.oneLine} />{nat ? <span className="ml-2 inline-flex items-center gap-1.5 whitespace-nowrap align-middle"><Nation n={nat} /></span> : null}</span></div> : null}
        {vm.otherRegister ? <Muted>Also registered with the <a className="underline underline-offset-4" href={vm.otherRegister.url} target="_blank" rel="noopener">{vm.otherRegister.body}</a>.</Muted> : null}
      </div>
      <SaveBtns entry={{ kind: 'company', number: vm.number, name: vm.name, status: vm.status.label, colour: vm.status.colour, town: vm.address.town || '' }} />
    </div>
    {vm.sic.length ? <div className="flex flex-wrap gap-2">{vm.sic.map((s) => <Tooltip key={s.code}><TooltipTrigger asChild><Button variant="outline" size="sm" className="h-auto min-h-8 max-w-full justify-start py-1 text-left whitespace-normal" asChild><a href={sicHref(s.code, vm)}><span className="font-mono text-xs text-muted-foreground">{s.code}</span><span>{s.desc}</span></a></Button></TooltipTrigger><TooltipContent>Find active companies with SIC {s.code}</TooltipContent></Tooltip>)}</div> : null}
    {vm.verdict.length ? <div className={cn('rounded-lg border px-3 py-2 text-sm', tone === 'bad' ? 'border-destructive/30 text-destructive' : tone === 'warn' ? 'border-amber-500/40 text-amber-800 dark:text-amber-300' : 'text-muted-foreground')}><span className="font-semibold">Heads up: </span>{vm.verdict.map((v) => v.text).join(' · ')}</div> : null}
    {vm.flags.length ? <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">{vm.flags.map((f) => <span key={f.label} className={cn('font-semibold', f.tone === 'bad' ? 'text-destructive' : f.tone === 'warn' ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground')}>{f.label}</span>)}</div> : null}
  </CardContent></Card>
}

export function PersonHeader({ name, meta, extra, entry, corporate }) {
  return <Card><CardContent className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
    <div className="flex min-w-0 items-start gap-4"><Mark kind={corporate ? 'company' : 'person'} name={name} className="size-12 text-base [&_svg]:size-5" />
      <div className="grid min-w-0 gap-1.5">{extra ? <div className="text-sm">{extra}</div> : null}<h1 className="text-2xl font-semibold tracking-tight [overflow-wrap:anywhere] sm:text-3xl"><Cp v={name} /></h1>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">{metaLine(meta)}</div></div></div>
    <SaveBtns entry={entry} /></CardContent></Card>
}

const Dl = ({ rows }) => <dl className="z-dl">{rows.filter((r) => r[1]).map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd>{v}</dd></Fragment>)}</dl>
export { Dl }

export function Deadlines({ vm }) {
  const a = vm.accounts, c = vm.confirmation
  const dl = [['Year end', a.refDate], ['Last accounts', a.lastMadeUp || a.lastType ? <>{a.lastMadeUp ? <Cp v={a.lastMadeUp} /> : null}{a.lastMadeUp && a.lastType ? ' · ' : ''}{a.lastType}</> : ''], ['Last period', a.lastPeriod], ['Next period', a.nextPeriod], ['Last confirmation', c.last ? <Cp v={c.last} /> : '']]
  return <Section icon={CalendarClock} title="Deadlines" desc="Accounts and confirmation statement">
    {vm.deadlines.length ? <div className="grid gap-4">{vm.deadlines.map((d) => { const pct = d.days < 0 ? 100 : Math.max(4, Math.min(100, 100 - (d.days / 365) * 100)); return <div key={d.label} className="grid gap-1.5">
      <div className="flex items-baseline justify-between gap-2 text-sm"><span className="font-medium">{d.label}</span><span className="tabular-nums"><Cp v={d.dueText} /></span></div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className={cn('h-full rounded-full', d.tone === 'bad' ? 'bg-destructive' : d.tone === 'warn' ? 'bg-amber-500' : 'bg-primary')} style={{ width: pct + '%' }} /></div>
      <div className="flex justify-between gap-2 text-xs text-muted-foreground"><span>{d.note}</span><span className={cn('font-medium', d.tone === 'bad' ? 'text-destructive' : d.tone === 'warn' ? 'text-amber-700 dark:text-amber-400' : '')}>{d.relText}</span></div></div> })}</div>
      : <Muted>{vm.status.active ? 'No filing deadlines on record.' : 'No deadlines: the company is ' + vm.status.label.toLowerCase() + '.'}</Muted>}
    <Separator className="my-1" /><Dl rows={dl} />
  </Section>
}

function PersonRow({ p, vm }) {
  const ap = p.appointmentsLink && vm.appointments[p.appointmentsLink]
  const other = ap ? ap.items.filter((x) => x.number !== vm.number) : []
  const total = ap && ap.total > ap.items.length ? ap.total - 1 : other.length
  const dq = vm.disq && p.personNumber && vm.disq[p.personNumber]
  return <div className="flex items-center gap-3 py-2.5">{p.corporate ? <CoMark /> : <Ini name={p.name} />}
    <div className="grid min-w-0 flex-1 gap-0.5"><div className="flex flex-wrap items-center gap-x-2 text-sm font-medium">{p.officerId ? <a className="truncate hover:underline" href={U.person(p.officerId)}>{p.name}</a> : <span className="truncate">{p.name}</span>}<IdV on={p.idv} title={p.idv && 'Identity verified ' + p.idv.verifiedOn} />{dq ? <a className="text-xs font-semibold text-destructive" href={U.person(p.officerId)}>Disqualified director</a> : null}</div>
      <div className="text-xs text-muted-foreground">{p.roleLabel}{p.resigned ? <> · resigned {cpd(p.resigned)}</> : p.appointed ? <> · since {cpd(p.appointed)}</> : null}{p.tenureYears != null && !p.resigned ? ` (${p.tenureYears}y)` : ''}</div></div>
    {other.length && p.officerId ? <Button variant="ghost" size="sm" className="hidden text-muted-foreground sm:inline-flex" asChild><a href={U.person(p.officerId)}>{total} other</a></Button> : null}
  </div>
}
export function People({ vm, limit = 6 }) {
  const of = vm.officers, w = vm.officerWord || { many: 'Officers' }, act = of.active
  const more = [act.length > limit && `${act.length - limit} more current`, of.counts.resigned && `${of.counts.resigned} former`].filter(Boolean).join(' and ')
  return <Section icon={UsersRound} title={w.many === 'Officers' ? 'People' : w.many} desc={of.counts.active + ' active' + (of.counts.resigned ? ' · ' + of.counts.resigned + ' former' : '')} action={<OpenBtn href={U.officers(vm.number)} label="Open the full officers list" />}>
    {act.length ? <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">{Object.entries(of.roleCounts).map(([k, v]: any) => <span key={k}><b className="font-semibold text-foreground">{v}</b> {k.toLowerCase()}{v > 1 ? 's' : ''}</span>)}
      {of.medianAge ? <span>Median age <b className="font-semibold text-foreground">{of.medianAge}</b></span> : null}{of.nationalities[0] ? <span>{of.nationalities.slice(0, 2).map((n) => n.name).join(', ')}</span> : null}{of.verifiedCount ? <span>ID verified <b className="font-semibold text-foreground">{of.verifiedCount}/{of.active.length}</b></span> : null}</div> : null}
    {act.length ? <div className="divide-y">{act.slice(0, limit).map((p, i) => <PersonRow key={i} p={p} vm={vm} />)}</div> : <Muted>No current {w.many.toLowerCase()}.</Muted>}
    {more ? <MoreLink href={U.officers(vm.number)}>{more} on the full list</MoreLink> : null}
  </Section>
}

const pscName = (p) => (p.ukCompany ? <a className="hover:underline" href={U.company(p.ukCompany)}>{p.name}</a> : p.pscId && !p.secure ? <a className="hover:underline" href={U.psc(p.pscId)}>{p.name}</a> : p.name)
export function Ownership({ vm }) {
  const w = vm.ownership
  return <Section icon={ChartPie} title="Ownership" desc={[w.current.length ? w.current.length + ' PSC' + (w.current.length === 1 ? '' : 's') : 'No current PSCs', w.counts.ceased ? w.counts.ceased + ' ceased' : ''].filter(Boolean).join(' · ')}>
    {w.current.length ? <div className="grid gap-4">{w.current.map((p, i) => <div className="flex gap-3" key={i}><Mark kind={p.corporate ? 'company' : 'person'} name={p.name} /><div className="grid min-w-0 gap-0.5 text-sm">
      <div className="flex flex-wrap items-baseline gap-x-2"><span className="font-medium">{pscName(p)}</span><IdV on={p.idv} /><span className="text-muted-foreground">{p.role}</span>{p.notified ? <span className="text-xs text-muted-foreground">since {p.notified}</span> : null}</div>
      {p.controls.map((c) => <div className="text-xs text-muted-foreground" key={c}>{c}</div>)}{p.sanctioned ? <div className="text-xs font-semibold text-destructive">On a sanctions list</div> : null}</div></div>)}</div> : null}
    {w.notes.map((t) => <Muted key={t}>{t}</Muted>)}
    {w.ceased.length ? <><Separator /><div className="text-xs font-medium text-muted-foreground">Former PSCs ({w.ceased.length})</div><div className="grid gap-2">{w.ceased.map((p, i) => <div key={i} className="flex flex-wrap items-baseline gap-x-2 text-sm"><span className="font-medium">{pscName(p)}</span><span className="text-xs text-muted-foreground">{p.notified} – {p.ceased}</span></div>)}</div></> : null}
  </Section>
}

export function Charges({ vm, limit = 3 }) {
  const c = vm.charges
  if (!c.available || !c.total) return <Section icon={Landmark} title="Charges" desc="None registered"><Muted>No charges registered against this company.</Muted></Section>
  const out = c.outstanding, sat = c.satisfied
  return <Section icon={Landmark} title="Charges" desc={`${out} outstanding · ${c.total} total`}>
    <div className="flex h-2 overflow-hidden rounded-full bg-muted"><div className="bg-amber-500" style={{ width: (out / c.total) * 100 + '%' }} /><div className="bg-muted-foreground/30" style={{ width: (sat / c.total) * 100 + '%' }} /></div>
    <div className="flex gap-4 text-xs text-muted-foreground"><span><span className="mr-1.5 inline-block size-2 rounded-full bg-amber-500" />{out} outstanding</span><span><span className="mr-1.5 inline-block size-2 rounded-full bg-muted-foreground/30" />{sat} satisfied</span>{c.lenders.slice(0, 3).map((l) => <span key={l.name}>{l.name} <b className="text-foreground">{l.n}</b></span>)}</div>
    <div className="divide-y">{c.items.slice(0, limit).map((x, i) => { const d = x.description || x.secured; return <div key={i} className={cn('grid gap-1 py-2.5 text-sm', !x.outstanding && 'opacity-70')}>
      <div className="flex justify-between gap-3"><span className="font-medium">{x.entitled.join(', ') || x.title}{x.moreEntitled ? ' and others' : ''}</span><span className={cn('shrink-0 text-xs font-semibold', x.outstanding ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground')}>{x.statusLabel}</span></div>
      <div className="text-xs text-muted-foreground">{x.title} · created {x.created}{x.code ? <> · <span className="font-mono">{x.code}</span></> : null}{x.satisfied ? ' · satisfied ' + x.satisfied : ''}</div>
      {x.features.length ? <div className="text-xs text-muted-foreground">{x.features.join(' · ')}</div> : null}
      {d ? <div className="text-xs text-muted-foreground">{d.slice(0, 220)}{d.length > 220 ? '…' : ''}</div> : null}</div> })}</div>
    {c.items.length > limit ? <Note>{c.items.length - limit} more charge{c.items.length - limit === 1 ? '' : 's'} not shown.</Note> : null}
  </Section>
}

export function Insolvency({ vm }) {
  const i = vm.insolvency
  return <Section icon={ShieldAlert} title="Insolvency" desc={i.cases.length + ' case' + (i.cases.length === 1 ? '' : 's')}>{i.cases.map((c, k) => <div className="grid gap-2" key={k}>
    <div className="font-medium">{c.type}{c.number ? <span className="ml-2 text-sm font-normal text-muted-foreground">case {c.number}</span> : null}</div>
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">{c.dates.map((d) => <span key={d.label} className="text-muted-foreground">{d.label} <b className="font-medium text-foreground">{d.date}</b></span>)}</div>
    {c.practitioners.map((p, j) => <div className="text-sm" key={j}><span className="font-medium">{p.name}</span> <span className="text-muted-foreground">{p.role}{p.appointed ? ' · appointed ' + p.appointed : ''}{p.ceased ? ' · ceased ' + p.ceased : ''}</span><div className="text-xs text-muted-foreground">{p.address}</div></div>)}
    {c.notes.map((n) => <Note key={n}>{n}</Note>)}</div>)}</Section>
}

export function Changes({ vm }) {
  const chg = vm.officers.changes
  return <Section icon={ArrowLeftRight} title="Officer changes" desc="Last 12 months" action={<OpenBtn href={U.officers(vm.number)} label="Open the full officers list" />}>
    {chg.length ? <ul className="grid gap-2 text-sm">{chg.slice(0, 8).map((c, i) => <li key={i} className="flex items-baseline gap-3"><span className={cn('w-20 shrink-0 text-xs font-semibold uppercase tracking-wide', c.kind === 'appointed' ? '' : 'text-muted-foreground')} style={c.kind === 'appointed' ? { color: 'var(--ok)' } : undefined}>{c.kind}</span><span className="min-w-0"><span className="font-medium">{c.name}</span> <span className="text-muted-foreground">{c.role.toLowerCase()} · {c.dateText}</span></span></li>)}</ul> : <Muted>No appointments or resignations in the last 12 months.</Muted>}
  </Section>
}

export function Filings({ vm }) {
  const f = vm.filings
  if (!f.items.length) return <Section icon={FileText} title="Filing history"><Muted>No filings on record.</Muted></Section>
  return <Section icon={FileText} title="Filing history" desc={f.total.toLocaleString('en-GB') + ' filings · latest 5'} action={<OpenBtn href={U.filings(vm.number)} label="Open the full filing history" />} footer={<MoreLink href={U.filings(vm.number)}>View all filings</MoreLink>}>
    <FilingTable items={f.items.slice(0, 5)} />
  </Section>
}

const shortDate = (s) => new Date(s + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const PAL = {
  theme: ['var(--chart-1)', 'var(--chart-2)'],
  shades: ['var(--primary)', 'color-mix(in oklab, var(--primary) 35%, var(--background))'],
  mono: ['var(--foreground)', 'color-mix(in oklab, var(--foreground) 30%, var(--background))'],
  stock: ['oklch(0.646 0.222 41.116)', 'oklch(0.6 0.118 184.704)'],
}
const cfgFor = (p) => { const c = PAL[p] || PAL.theme; return { a: { label: 'Appointed', color: c[0] }, r: { label: 'Resigned', color: c[1] } } }
/* Board activity / appointments by year: shadcn Chart (recharts) from the unchanged charts.js analysis. */
export function History({ items, o }) {
  const [tw] = useTweaks()
  const m = Charts.analyse(items, o)
  const title = o.kind === 'company' ? 'Board activity' : m.eligible ? 'Appointments by year' : 'Appointment history'
  const action = o.open ? <OpenBtn href={o.open.href} label={o.open.label} /> : null
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
    return <Section icon={ChartColumn} title={title} action={action}><Muted>{text}</Muted></Section>
  }
  const rows = m.rows, sumA = rows.reduce((a, r) => a + r.a, 0), sumR = rows.reduce((a, r) => a + r.r, 0)
  const data = rows.map((r) => ({ y: String(r.y), a: r.a, r: r.r, n: r.n }))
  const kpi = (l, n) => <div className="grid gap-0.5" key={l}><span className="text-xs text-muted-foreground">{l}</span><span className="text-xl font-semibold tabular-nums">{n}</span></div>
  return <Section icon={ChartColumn} title={title} desc={rows[0].y + ' – ' + shortDate(m.today)} action={action}>
    <div className="flex flex-wrap gap-x-8 gap-y-2">{m.stockSafe ? kpi(o.kind === 'company' ? 'In post now' : 'Roles held now', rows[rows.length - 1].n) : null}{kpi('Appointed since ' + rows[0].y, sumA)}{kpi('Resigned since ' + rows[0].y, sumR)}</div>
    <ChartContainer config={cfgFor(tw.chartPal)} className="aspect-auto h-[200px] w-full" role="img" aria-label={rows.map((r) => `${r.y}: ${r.a} appointed, ${r.r} resigned`).join('; ')}>
      <BarChart data={data} margin={{ left: -20, right: 4, top: 4 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="y" tickLine={false} axisLine={false} tickMargin={8} minTickGap={8} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="a" fill="var(--color-a)" radius={tw.chart === 'stacked' ? [0, 0, 0, 0] : +tw.barRadius} stackId={tw.chart === 'stacked' ? 's' : undefined} />
        <Bar dataKey="r" fill="var(--color-r)" radius={tw.chart === 'stacked' ? [+tw.barRadius, +tw.barRadius, 0, 0] : +tw.barRadius} stackId={tw.chart === 'stacked' ? 's' : undefined} />
      </BarChart>
    </ChartContainer>
  </Section>
}

const SimRows = ({ items }) => <div className="divide-y">{items.map((x) => <div key={x.number} className="flex items-center gap-3 py-2"><CoMark className="size-7" /><div className="grid min-w-0 flex-1"><a className="truncate text-sm font-medium hover:underline" href={U.company(x.number)}>{x.name}</a><span className="truncate text-xs text-muted-foreground">{[x.town, x.postcode, x.generic ? 'general activity code' : ''].filter(Boolean).join(' · ')}</span></div><span className="hidden text-xs tabular-nums text-muted-foreground sm:inline">{x.ageYears != null ? x.ageYears + 'y' : ''}</span><span className="font-mono text-xs text-muted-foreground">{x.number}</span></div>)}</div>
function SimBody({ k, vm }) {
  const [prog, setProg] = useState('')
  const s = useLoad(() => (k === 'connected' ? connected(vm, setProg) : SIM[k](vm)), [k, vm.number])
  if (s.loading) return <div className="grid gap-2"><Note>{prog || 'Loading…'}</Note><Rows n={4} /></div>
  if (s.err) return <Muted className="text-destructive">{s.err.message || String(s.err)}</Muted>
  const d = s.data, notes = (d.notes || []).filter(Boolean).map((t) => <Note key={t}>{t}</Note>)
  if (k === 'connected') return <div className="grid gap-2"><Note>Companies sharing a director or owner with this company (matched by Companies House ID)</Note>
    {d.rows.length ? <div className="divide-y">{d.rows.map((r) => <div className="grid gap-0.5 py-2" key={r.number}><div className="flex items-center justify-between gap-2"><a className="truncate text-sm font-medium hover:underline" href={U.company(r.number)}>{r.name}</a><St label={r.status} colour={r.colour} /></div><span className="text-xs text-muted-foreground">Linked through {r.links.slice(0, 3).map((l, i) => <span key={i}>{i ? '; ' : ''}{l.href ? <a className="underline-offset-4 hover:underline" href={l.href}>{l.name}</a> : l.name}, {l.role.toLowerCase()}</span>)}{r.links.length > 3 ? ` and ${r.links.length - 3} more` : ''}</span></div>)}</div> : null}{notes}</div>
  if (d.empty) return <div className="grid gap-2"><Muted>{d.empty}</Muted>{notes}</div>
  return <div className="grid gap-2"><SimRows items={d.items} />{notes}</div>
}
export function Similar({ vm }) {
  const [k, setK] = useState('nearby')
  return <Section icon={Building2} title="Similar companies" desc="Same activity code, nearby or UK-wide, and companies linked by people">
    <Tabs value={k} onValueChange={setK}><TabsList><TabsTrigger value="nearby">Nearby</TabsTrigger><TabsTrigger value="trade">Same trade</TabsTrigger><TabsTrigger value="connected"><Network />Connected</TabsTrigger></TabsList>
      <TabsContent value={k} className="pt-2"><SimBody key={k} k={k} vm={vm} /></TabsContent></Tabs>
  </Section>
}
export function UkEst({ vm }) {
  const u = vm.ukEstablishments
  return <Section icon={Building2} title="UK establishments" desc={String(u.length)}>{u.length ? <SimRows items={u} /> : <Muted>No UK establishments on record.</Muted>}</Section>
}
