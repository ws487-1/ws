// @ts-nocheck
/* Officer history views shared by the Officers page and the merged Board tile (consultation 2, items 3–5):
   KPIs, board-size step chart, yearly bars, Timeline (hand-rolled SVG), Changes feed and Line-ups. */
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { U } from '@/lib/router'
import { cn } from '@/lib/utils'

export const TODAY = () => new Date().toISOString().slice(0, 10)
const MS_Y = 365.25 * 864e5
export const months = (a, b) => Math.max(0, Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / (MS_Y / 12)))
export const tenure = (a, b) => { if (!a) return ''; const m = months(a, b || TODAY()); return m < 1 ? '<1m' : m < 12 ? m + 'm' : Math.floor(m / 12) + 'y' + (m % 12 ? ' ' + (m % 12) + 'm' : '') }
export const yearsAgo = (y) => { const d = new Date(); d.setUTCFullYear(d.getUTCFullYear() - y); return d.toISOString().slice(0, 10) }
export const RANGES = [['12m', '12m', 1], ['2y', '2y', 2], ['5y', '5y', 5], ['10y', '10y', 10], ['all', 'All', 0]]
export const rangeStart = (r) => { const x = RANGES.find((q) => q[0] === r); return x && x[2] ? yearsAgo(x[2]) : '' }
const isDirectorish = (o) => !/secretary/.test(o.role)
const roleGroup = (o) => (/secretary/.test(o.role) ? 'Secretary' : /llp/.test(o.role) ? 'Member' : 'Director')

export function kpis(all) {
  const today = TODAY(), cut5 = yearsAgo(5)
  const dated = all.filter((o) => o.appointedIso)
  const avg = dated.length ? dated.reduce((a, o) => a + months(o.appointedIso, o.resignedIso || today), 0) / dated.length / 12 : null
  return { inPost: all.filter((o) => !o.resignedIso).length, avg: avg == null ? '–' : avg.toFixed(1) + 'y', total: all.length, resigned5: all.filter((o) => o.resignedIso && o.resignedIso >= cut5).length }
}
export const Kpi = ({ label, value, className = '' }) => <div className={cn('grid gap-0.5', className)}><span className="text-xs text-muted-foreground">{label}</span><span className="z-stat-v text-xl font-semibold tabular-nums tracking-tight">{value}</span></div>
export function KpiRow({ all, className = '' }) {
  const k = kpis(all)
  return <div className={cn('flex flex-wrap gap-x-8 gap-y-3', className)}><Kpi label="In post" value={k.inPost} /><Kpi label="Average tenure" value={k.avg} /><Kpi label="Appointments on record" value={k.total} /><Kpi label="Resigned in 5y" value={k.resigned5} /></div>
}

export function events(all) {
  const ev = []
  for (const o of all) { if (o.appointedIso) ev.push({ kind: 'appointed', iso: o.appointedIso, date: o.appointed, o }); if (o.resignedIso) ev.push({ kind: 'resigned', iso: o.resignedIso, date: o.resigned, o }) }
  return ev.sort((a, b) => b.iso.localeCompare(a.iso) || (a.kind === 'resigned' ? -1 : 1))
}

function useWidth() {
  const ref = useRef(null), [w, setW] = useState(0)
  useLayoutEffect(() => { const el = ref.current; if (!el) return; setW(el.clientWidth); const ro = new ResizeObserver(() => setW(el.clientWidth)); ro.observe(el); return () => ro.disconnect() }, [])
  return [ref, w]
}
const fmtY = (iso) => iso.slice(0, 4)

/* Board-size step chart: directors (and LLP members) in post over time, with appointment/resignation ticks underneath. */
export function StepChart({ all, from = '', height = 180 }) {
  const [ref, w] = useWidth()
  const today = TODAY()
  const people = all.filter((o) => isDirectorish(o) && (o.appointedIso || o.pre1992 || o.appointedBefore))
  const ev = []
  let base = 0
  for (const o of people) { if (o.appointedIso) ev.push([o.appointedIso, 1]); else base++; if (o.resignedIso) ev.push([o.resignedIso, -1]) }
  ev.sort((a, b) => a[0].localeCompare(b[0]) || a[1] - b[1])
  if (!ev.length) return <p className="text-sm text-muted-foreground">No dated appointments to chart.</p>
  let n = base; const pts = [[ev[0][0], base]]
  for (const e of ev) { n += e[1]; pts.push([e[0], n]) }
  const t0s = from && from > ev[0][0] ? from : ev[0][0]
  let startN = base; for (const p of pts) if (p[0] <= t0s) startN = p[1]
  const vis = pts.filter((p) => p[0] > t0s)
  const mx = Math.max(1, startN, ...vis.map((p) => p[1]))
  const H = height, padL = 28, padR = 8, tickH = 14, axisH = 18
  const W = Math.max(w, 200), t0 = +new Date(t0s), t1 = +new Date(today)
  const X = (d) => padL + ((+new Date(d) - t0) / Math.max(1, t1 - t0)) * (W - padL - padR)
  const Y = (v) => 6 + (1 - v / mx) * (H - 12)
  let d = `M${X(t0s)},${Y(startN)}`; for (const p of vis) d += ` H${X(p[0]).toFixed(1)} V${Y(p[1]).toFixed(1)}`; d += ` H${X(today)}`
  const y0 = new Date(t0s).getUTCFullYear(), y1 = new Date(today).getUTCFullYear(), span = y1 - y0, step = span > 40 ? 10 : span > 20 ? 5 : span > 8 ? 2 : 1
  const yt = []; for (let v = 0; v <= mx; v += Math.max(1, Math.ceil(mx / 4))) yt.push(v)
  const evv = ev.filter((e) => e[0] > t0s)
  return <div ref={ref} className="w-full">{w ? <svg width={W} height={H + tickH + axisH} className="z-tl block text-[11px]" role="img" aria-label={`Board size over time: ${startN} in ${y0}, ${pts[pts.length - 1][1]} now`}>
    {yt.map((v) => <g key={v}><line x1={padL} x2={W - padR} y1={Y(v)} y2={Y(v)} stroke="var(--border)" strokeDasharray={v ? '2 3' : ''} /><text x={padL - 6} y={Y(v) + 4} textAnchor="end" fill="var(--muted-foreground)">{v}</text></g>)}
    <path d={d + ` V${Y(0)} H${X(t0s)} Z`} fill="var(--primary)" fillOpacity=".12" /><path d={d} fill="none" stroke="var(--primary)" strokeWidth="2" />
    {evv.map((e, i) => <line key={i} x1={X(e[0])} x2={X(e[0])} y1={H + 2} y2={H + 2 + (e[1] > 0 ? 6 : 12)} stroke={e[1] > 0 ? 'var(--ok)' : 'var(--muted-foreground)'} strokeOpacity={e[1] > 0 ? 1 : 0.6} strokeWidth="1.5" />)}
    {Array.from({ length: span + 1 }, (_, i) => y0 + i).filter((y) => y > y0 && (y - y0) % step === 0).map((y) => <text key={y} x={X(y + '-01-01')} y={H + tickH + 12} textAnchor="middle" fill="var(--muted-foreground)">{y}</text>)}
  </svg> : <div style={{ height: H + tickH + axisH }} />}
    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"><span><i className="mr-1.5 inline-block h-0.5 w-3 bg-primary align-middle" />Directors in post</span><span><i className="mr-1.5 inline-block h-2.5 w-0.5 align-middle" style={{ background: 'var(--ok)' }} />Appointment</span><span><i className="mr-1.5 inline-block h-2.5 w-0.5 bg-muted-foreground/60 align-middle" />Resignation</span></div>
  </div>
}

/* Appointed/resigned per year (recharts, no animation). */
export function YearBars({ all, years = 10, height = 180, radius = 2 }) {
  const y1 = new Date().getUTCFullYear(), y0 = y1 - years + 1
  const rows = Array.from({ length: years }, (_, i) => ({ y: String(y0 + i), a: 0, r: 0 }))
  for (const o of all) { const ya = +fmtY(o.appointedIso || '0000'), yr = +fmtY(o.resignedIso || '0000'); if (ya >= y0) rows[ya - y0].a++; if (yr >= y0) rows[yr - y0].r++ }
  const cfg = { a: { label: 'Appointed', color: 'var(--chart-1)' }, r: { label: 'Resigned', color: 'var(--chart-2)' } }
  return <ChartContainer config={cfg} className="aspect-auto w-full" style={{ height }} role="img" aria-label={rows.map((r) => `${r.y}: ${r.a} appointed, ${r.r} resigned`).join('; ')}>
    <BarChart data={rows} margin={{ left: -20, right: 4, top: 4 }}><CartesianGrid vertical={false} /><XAxis dataKey="y" tickLine={false} axisLine={false} tickMargin={8} minTickGap={8} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} />
      <ChartTooltip cursor={false} isAnimationActive={false} content={<ChartTooltipContent />} /><ChartLegend content={<ChartLegendContent />} />
      <Bar isAnimationActive={false} dataKey="a" fill="var(--color-a)" radius={radius} /><Bar isAnimationActive={false} dataKey="r" fill="var(--color-r)" radius={radius} /></BarChart>
  </ChartContainer>
}

/* Timeline: one bar per person. Current people first (setting), range zooms the axis, labels above bars on phones,
   hatched start where CH only says "appointed before" (pre-1992 records). */
export function Timeline({ all, from = '', sort = 'current', colour = 'status', labels = 'on' }) {
  const [ref, w] = useWidth()
  const today = TODAY()
  let rows = all.filter((o) => !from || !o.resignedIso || o.resignedIso >= from)
  const startOf = (o) => o.appointedIso || ''
  const cmpApp = (a, b) => (startOf(a) || '0').localeCompare(startOf(b) || '0')
  const ten = (o) => months(o.appointedIso || '1900-01-01', o.resignedIso || today)
  rows = rows.slice().sort(sort === 'tenure' ? (a, b) => ten(b) - ten(a) : sort === 'appointed' ? cmpApp : (a, b) => (a.resignedIso ? 1 : 0) - (b.resignedIso ? 1 : 0) || cmpApp(a, b))
  if (!rows.length) return <p className="text-sm text-muted-foreground">Nobody in post during this period.</p>
  const narrow = w && w < 640
  const earliest = rows.reduce((m, o) => (o.appointedIso && o.appointedIso < m ? o.appointedIso : m), today)
  const t0s = from && from > earliest ? from : (rows.some((o) => !o.appointedIso) ? String(+earliest.slice(0, 4) - 1) + '-01-01' : earliest)
  const W = Math.max(w, 280), lw = narrow ? 0 : Math.min(200, Math.max(120, W * 0.22)), padR = 10, rh = narrow ? 34 : 22, axisH = 22
  const x0 = lw + (narrow ? 0 : 8), x1 = W - padR, t0 = +new Date(t0s), t1 = +new Date(today)
  const X = (d) => x0 + ((Math.max(+new Date(d), t0) - t0) / Math.max(1, t1 - t0)) * (x1 - x0)
  const H = rows.length * rh
  const y0 = new Date(t0s).getUTCFullYear(), y1 = new Date(today).getUTCFullYear(), span = y1 - y0
  const step = Math.max(1, Math.ceil(span / (narrow ? 4 : 10)))
  const fill = (o) => { const cur = !o.resignedIso, g = roleGroup(o); if (colour === 'role') return g === 'Secretary' ? 'var(--muted-foreground)' : g === 'Member' ? 'var(--chart-2)' : 'var(--primary)'; return cur ? 'var(--primary)' : 'color-mix(in oklab, var(--primary) 32%, var(--background))' }
  const trunc = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s)
  const maxChars = Math.floor(lw / 6.4)
  return <div ref={ref} className="w-full">{w ? <svg width={W} height={H + axisH} className="z-tl block text-[11px]" role="img" aria-label={`Timeline of ${rows.length} officers`}>
    <defs><pattern id="zHatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" fill="var(--background)" /><line x1="0" y1="0" x2="0" y2="5" stroke="var(--muted-foreground)" strokeOpacity=".5" strokeWidth="2.5" /></pattern>
      <linearGradient id="zFadeIn" x1="0" x2="1"><stop offset="0" stopColor="white" stopOpacity="0" /><stop offset="1" stopColor="white" stopOpacity="1" /></linearGradient></defs>
    {Array.from({ length: span + 1 }, (_, i) => y0 + i).filter((y) => y > y0).map((y) => { const x = X(y + '-01-01'), major = (y - y0) % step === 0; return <g key={y}><line x1={x} x2={x} y1="0" y2={H} stroke="var(--border)" strokeOpacity={major ? 1 : 0.45} />{major ? <text x={x} y={H + 15} textAnchor="middle" fill="var(--muted-foreground)">{y}</text> : null}</g> })}
    {rows.map((o, i) => {
      const y = i * rh, unknownStart = !o.appointedIso, xa = unknownStart ? x0 : X(o.appointedIso), xb = X(o.resignedIso || today), bw = Math.max(2, xb - xa)
      const cur = !o.resignedIso, t = tenure(o.appointedIso, o.resignedIso)
      const label = <tspan fill={cur ? 'var(--foreground)' : 'var(--muted-foreground)'} fontWeight={cur ? 500 : 400}>{narrow ? o.name : trunc(o.name, maxChars)}</tspan>
      const title = `${o.name} · ${o.roleLabel} · ${o.appointed || (o.appointedBefore ? 'before ' + o.appointedBefore.slice(0, 4) : 'appointment date unknown')} – ${o.resigned || 'now'}${t ? ' (' + t + ')' : ''}`
      const nameEl = narrow ? <text x="2" y={y + 11}>{label}<tspan fill="var(--muted-foreground)">{' · ' + roleGroup(o) + (t ? ' · ' + t : '')}</tspan></text> : <text x={lw} y={y + 15} textAnchor="end">{label}</text>
      const by = narrow ? y + 16 : y + 5, bh = narrow ? 11 : 12
      return <g key={i}><title>{title}</title>
        {o.officerId ? <a href={U.person(o.officerId)}>{nameEl}</a> : nameEl}
        <rect x={xa} y={by} width={bw} height={bh} rx="2" fill={fill(o)} />
        {unknownStart ? <rect x={xa} y={by} width={Math.min(28, bw)} height={bh} rx="2" fill="url(#zHatch)" /> : null}
        {labels === 'on' && !narrow && t && bw > 46 ? <text x={xa + (unknownStart ? 32 : 5)} y={by + 9.5} fontSize="9.5" fill={cur || colour === 'role' ? 'var(--primary-foreground)' : 'var(--foreground)'}>{(unknownStart ? '>' : '') + t}</text> : null}
      </g>
    })}
    <line x1={X(today)} x2={X(today)} y1="0" y2={H} stroke="var(--foreground)" strokeDasharray="2 2" strokeOpacity=".6" />
  </svg> : <div style={{ height: H + axisH }} />}
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {colour === 'role' ? <><span><i className="mr-1.5 inline-block size-2.5 rounded-sm bg-primary align-middle" />Director</span><span><i className="mr-1.5 inline-block size-2.5 rounded-sm align-middle" style={{ background: 'var(--chart-2)' }} />LLP member</span><span><i className="mr-1.5 inline-block size-2.5 rounded-sm bg-muted-foreground align-middle" />Secretary</span></>
        : <><span><i className="mr-1.5 inline-block size-2.5 rounded-sm bg-primary align-middle" />Current</span><span><i className="mr-1.5 inline-block size-2.5 rounded-sm align-middle" style={{ background: 'color-mix(in oklab, var(--primary) 32%, var(--background))' }} />Former</span></>}
      {rows.some((o) => !o.appointedIso) ? <span><i className="mr-1.5 inline-block size-2.5 rounded-sm align-middle" style={{ background: 'repeating-linear-gradient(45deg, var(--muted-foreground) 0 2px, transparent 2px 4px)' }} />Appointed before records began</span> : null}
      <span>{sort === 'tenure' ? 'Longest serving first' : sort === 'appointed' ? 'By appointment date' : 'Current first, then by appointment'}</span>
    </div>
  </div>
}

/* Changes feed: every appointment and resignation in range, newest first, grouped by year with a summary and tenure. */
export function ChangesFeed({ all, from = '' }) {
  const ev = events(all).filter((e) => !from || e.iso >= from)
  if (!ev.length) return <p className="text-sm text-muted-foreground">No appointments or resignations in this period.</p>
  const years = []; for (const e of ev) { const y = e.iso.slice(0, 4); let g = years[years.length - 1]; if (!g || g.y !== y) years.push(g = { y, items: [] }); g.items.push(e) }
  return <div className="grid gap-5">{years.map((g) => { const a = g.items.filter((e) => e.kind === 'appointed').length, r = g.items.length - a; return <section key={g.y} className="grid gap-1">
    <h3 className="flex items-baseline gap-2 border-b pb-1 text-sm font-semibold">{g.y}<span className="text-xs font-normal text-muted-foreground">{[a && a + ' appointed', r && r + ' resigned'].filter(Boolean).join(' · ')}</span></h3>
    <ul className="divide-y">{g.items.map((e, i) => <ChangeRow key={i} e={e} />)}</ul></section> })}</div>
}
export function ChangeRow({ e, compact = false }) {
  const o = e.o
  const note = e.kind === 'resigned' ? (o.appointedIso ? 'after ' + tenure(o.appointedIso, o.resignedIso) : '') : o.resignedIso ? 'served ' + tenure(o.appointedIso, o.resignedIso) : 'in post'
  return <li className={cn('grid grid-cols-[5.5rem_5.5rem_minmax(0,1fr)] items-baseline gap-x-3 py-1.5 text-sm sm:grid-cols-[6.5rem_6rem_minmax(0,1fr)_auto]', compact && 'sm:grid-cols-[5.75rem_5.5rem_minmax(0,1fr)_auto] py-1')}>
    <span className="tabular-nums text-muted-foreground">{e.date}</span>
    <span className={cn('text-xs font-semibold uppercase tracking-wide', e.kind === 'resigned' && 'text-muted-foreground')} style={e.kind === 'appointed' ? { color: 'var(--ok)' } : undefined}>{e.kind}</span>
    <span className="min-w-0"><span className="font-medium">{o.officerId ? <a className="hover:underline" href={U.person(o.officerId)}>{o.name}</a> : o.name}</span> <span className="text-muted-foreground">{o.roleLabel.toLowerCase()}</span></span>
    <span className="col-start-3 text-xs text-muted-foreground sm:col-start-auto sm:text-right">{note}</span>
  </li>
}

/* Line-ups (experiment): board composition per period, newest first. Useful for small boards only. */
export function LineUps({ all, from = '' }) {
  const people = all.filter(isDirectorish)
  const dates = [...new Set(people.flatMap((o) => [o.appointedIso, o.resignedIso]).filter(Boolean))].sort()
  const periods = []
  for (let i = 0; i < dates.length; i++) {
    const a = dates[i], b = dates[i + 1] || ''
    const on = people.filter((o) => (!o.appointedIso || o.appointedIso <= a) && (!o.resignedIso || o.resignedIso > a))
    if (b && from && b < from) continue
    periods.push({ a, b, on })
  }
  periods.reverse()
  if (!periods.length) return <p className="text-sm text-muted-foreground">No dated changes to build line-ups from.</p>
  const fd = (iso) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  return <div className="grid gap-1">{people.length > 15 ? <p className="text-xs text-muted-foreground">Line-ups work best for boards of 10 or fewer; this one has had {people.length} directors.</p> : null}
    <div className="divide-y">{periods.slice(0, 30).map((p, i) => <div key={i} className="grid gap-1 py-2 sm:grid-cols-[13rem_minmax(0,1fr)] sm:gap-4">
      <span className="text-sm tabular-nums text-muted-foreground">{fd(p.a)} – {p.b ? fd(p.b) : 'now'}</span>
      <span className="text-sm"><b className="mr-2 font-semibold tabular-nums">{p.on.length}</b>{p.on.map((o) => o.name).join(', ') || 'Nobody'}</span></div>)}</div></div>
}
