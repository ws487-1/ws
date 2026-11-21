// @ts-nocheck
/* Officers page (consultation 2 §3/§5): one page, views Table | Timeline | Changes (| Line-ups, experiment), the view and
   range in the URL (?view=…&range=…). KPIs and a header chart (board-size step by default) above the view. People ↗
   lands on Table, Board ↗ on Changes; otherwise the 'Officers default view' setting (Timeline). */
import { useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { ErrorCard, Ini, CoMark, PageHead, Rows, IdLabel } from '@/components/z/bits'
import { KpiRow, StepChart, YearBars, Timeline, ChangesFeed, LineUps, RANGES, rangeStart, tenure } from '@/components/z/board'
import { N } from '@/lib/legacy'
import { loadCompany, peekCompany, disqByPn, normNumber } from '@/lib/data'
import { useLoad, setTitle } from '@/lib/hooks'
import { useCrumbs } from '@/lib/crumbs'
import { useTweaks } from '@/lib/tweaks'
import { withParams, U } from '@/lib/router'
import { cn } from '@/lib/utils'

export const CompanyLine = ({ p }) => <><a className="font-medium text-foreground underline-offset-4 hover:underline" href={U.company(p.company_number)}>{N.profile(p).name}</a> · No. {p.company_number}</>
const VIEWS = [['table', 'Table'], ['timeline', 'Timeline'], ['changes', 'Changes']]

export function OfficersPage({ route, n: raw }) {
  const n = normNumber(decodeURIComponent(raw || ''))
  const [tw] = useTweaks()
  const s = useLoad(() => loadCompany(n), [n], () => peekCompany(n))
  const vm = s.data && s.data.vm
  const word = vm ? vm.officerWord.many : 'Officers'
  const name = vm ? vm.name : n
  useCrumbs([{ label: 'Companies', href: '#/search' }, { label: name, href: U.company(n) }, { label: word }], [name, word])
  useEffect(() => { setTitle(vm ? word + ' · ' + name : 'Officers') }, [vm])
  const views = VIEWS.concat(tw.lineups === 'on' ? [['lineups', 'Line-ups']] : [])
  const qv = route.q.get('view'), view = views.some((v) => v[0] === qv) ? qv : tw.offView
  const all = vm ? vm.officers.all || [] : []
  const qr = route.q.get('range'), range = RANGES.some((r) => r[0] === qr) ? qr : all.length > 40 ? tw.bigRange : 'all'
  /* Tabs and range replace the history entry: switching views isn't a step Back has to undo. */
  const set = (o) => location.replace('#' + withParams('/company/' + n + '/officers', { view, range: qr || '', ...o }))
  if (s.err) return <ErrorCard e={s.err} />
  const from = rangeStart(range)
  const showRange = view === 'timeline' || view === 'changes' || view === 'lineups'
  const dq = disqByPn()
  const rows = vm ? vm.officers.active.concat(vm.officers.former) : []
  return <div className={cn('z-stack', !s.cached && vm && 'z-fade')}>
    <PageHead title={word} desc={vm ? <><a className="font-medium text-foreground underline-offset-4 hover:underline" href={U.company(n)}>{vm.name}</a> · No. {n} · {vm.officers.counts.active} current · {vm.officers.counts.resigned} resigned</> : 'No. ' + n} />
    <Card><CardContent className="grid gap-5">
      {!vm ? <Rows n={3} /> : <>
        <KpiRow all={all} />
        {tw.offChart === 'step' ? <StepChart all={all} from={showRange ? from : ''} /> : tw.offChart === 'bars' ? <YearBars all={all} years={from ? Math.max(2, new Date().getUTCFullYear() - +from.slice(0, 4) + 1) : 10} radius={+tw.barRadius} /> : null}
        {!vm.officers.complete && vm.officers.counts.loaded < vm.officers.counts.total ? <p className="text-xs text-muted-foreground">Showing {vm.officers.counts.loaded} of {vm.officers.counts.total} records loaded from Companies House.</p> : null}
      </>}
    </CardContent></Card>
    <Card><CardContent className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={view} onValueChange={(v) => set({ view: v })}><TabsList>{views.map(([k, l]) => <TabsTrigger key={k} value={k}>{l}</TabsTrigger>)}</TabsList></Tabs>
        {showRange ? <ToggleGroup type="single" variant="outline" size="sm" value={range} onValueChange={(v) => v && set({ range: v })} aria-label="Period">{RANGES.map(([k, l]) => <ToggleGroupItem key={k} value={k} className="px-2.5 text-xs">{l}</ToggleGroupItem>)}</ToggleGroup> : null}
      </div>
      {!vm ? <Rows n={8} /> : !all.length ? <p className="text-sm text-muted-foreground">No {word.toLowerCase()} on record.</p>
        : view === 'timeline' ? <Timeline all={all} from={from} sort={tw.tlSort} colour={tw.tlColour} labels={tw.tlLabels} />
        : view === 'changes' ? <ChangesFeed all={all} from={from} />
        : view === 'lineups' ? <LineUps all={all} from={from} />
        : <Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Role</TableHead><TableHead className="hidden sm:table-cell">Appointed</TableHead><TableHead className="hidden sm:table-cell">Resigned</TableHead><TableHead className="hidden sm:table-cell">Tenure</TableHead><TableHead className="hidden md:table-cell">Nationality / country</TableHead></TableRow></TableHeader>
          <TableBody>{rows.map((p, i) => <TableRow key={i} className={p.resigned ? 'text-muted-foreground' : ''}>
            <TableCell className="whitespace-normal"><div className="flex items-center gap-3">{p.corporate ? <CoMark /> : <Ini name={p.name} />}<div className="grid gap-0.5"><span className="flex flex-wrap items-center gap-x-2 font-medium text-foreground">{p.officerId ? <a className="hover:underline" href={U.person(p.officerId)}>{p.name}</a> : p.name}{!p.resigned ? <IdLabel x={p.idState} /> : null}</span>
              <span className="text-xs text-muted-foreground sm:hidden">{p.resigned ? 'Resigned ' + p.resigned : 'Since ' + (p.appointed || N.fmtDate(p.appointedBefore) || 'unknown')}{p.appointedIso ? ' · ' + tenure(p.appointedIso, p.resignedIso) : ''}</span>{p.personNumber && dq[p.personNumber] ? <a className="text-xs font-semibold text-destructive" href={U.person(p.officerId)}>Disqualified director</a> : null}</div></div></TableCell>
            <TableCell className="whitespace-normal">{p.roleLabel}</TableCell><TableCell className="hidden tabular-nums sm:table-cell">{p.appointed || (p.appointedBefore ? 'before ' + (N.fmtDate(p.appointedBefore) || p.appointedBefore) : '')}</TableCell><TableCell className="hidden tabular-nums sm:table-cell">{p.resigned}</TableCell>
            <TableCell className="hidden tabular-nums sm:table-cell">{p.appointedIso ? tenure(p.appointedIso, p.resignedIso) : ''}</TableCell><TableCell className="hidden whitespace-normal md:table-cell">{[p.nationality, p.residence].filter(Boolean).join(' / ')}</TableCell></TableRow>)}</TableBody></Table>}
    </CardContent></Card>
  </div>
}
