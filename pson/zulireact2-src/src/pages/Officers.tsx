// @ts-nocheck
import { useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { BackBtn, ErrorCard, Ini, CoMark, PageHead, Rows } from '@/components/z/bits'
import { N } from '@/lib/legacy'
import { ApiError, allPages, ch, disqByPn, normNumber } from '@/lib/data'
import { useLoad, setTitle } from '@/lib/hooks'
import { useCrumbs } from '@/lib/crumbs'
import { backFor } from '@/lib/store'
import { U } from '@/lib/router'

export const CompanyLine = ({ p }) => <><a className="font-medium text-foreground underline-offset-4 hover:underline" href={U.company(p.company_number)}>{N.profile(p).name}</a> · No. {p.company_number}</>

/* Expanded officers view: current then resigned. */
export function OfficersPage({ route, n: raw }) {
  const n = normNumber(decodeURIComponent(raw || ''))
  const s = useLoad(async () => {
    const prof = await ch('/company/' + n)
    if (prof._http) throw new ApiError('404', 'No company found with number ' + n + '.')
    const r = await allPages('/company/' + n + '/officers', 100)
    return { prof, of: N.officers(r._http ? null : r), word: N.officerWord(prof.type) }
  }, [n])
  const name = s.data ? N.profile(s.data.prof).name : n
  useCrumbs([{ label: 'Companies', href: '#/search' }, { label: name, href: U.company(n) }, { label: s.data ? s.data.word.many : 'Officers' }], [name])
  useEffect(() => { setTitle(s.data ? s.data.word.many + ' · ' + name : 'Officers') }, [s.data])
  const back = backFor(route.key)
  if (s.err) return <div className="z-stack"><BackBtn b={back} /><ErrorCard e={s.err} /></div>
  const d = s.data, dq = disqByPn()
  return <div className="z-stack">
    <BackBtn b={back} />
    <PageHead title={d ? d.word.many : 'Officers'} desc={d ? <><CompanyLine p={d.prof} /> · {d.of.counts.active} current · {d.of.counts.resigned} resigned</> : 'Loading…'} />
    <Card><CardContent>{!d ? <Rows n={8} /> : !d.of.all.length ? <p className="text-sm text-muted-foreground">No {d.word.many.toLowerCase()} on record.</p> :
      <Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Role</TableHead><TableHead className="hidden sm:table-cell">Appointed</TableHead><TableHead className="hidden sm:table-cell">Resigned</TableHead><TableHead className="hidden md:table-cell">Nationality / country</TableHead></TableRow></TableHeader>
        <TableBody>{d.of.active.concat(d.of.former).map((p, i) => <TableRow key={i} className={p.resigned ? 'text-muted-foreground' : ''}>
          <TableCell className="whitespace-normal"><div className="flex items-center gap-3">{p.corporate ? <CoMark /> : <Ini name={p.name} />}<div className="grid"><span className="font-medium text-foreground">{p.officerId ? <a className="hover:underline" href={U.person(p.officerId)}>{p.name}</a> : p.name}</span>
            <span className="text-xs text-muted-foreground sm:hidden">{p.resigned ? 'Resigned ' + p.resigned : 'Since ' + p.appointed}</span>{p.personNumber && dq[p.personNumber] ? <a className="text-xs font-semibold text-destructive" href={U.person(p.officerId)}>Disqualified director</a> : null}</div></div></TableCell>
          <TableCell className="whitespace-normal">{p.roleLabel}</TableCell><TableCell className="hidden tabular-nums sm:table-cell">{p.appointed}</TableCell><TableCell className="hidden tabular-nums sm:table-cell">{p.resigned}</TableCell><TableCell className="hidden whitespace-normal md:table-cell">{[p.nationality, p.residence].filter(Boolean).join(' / ')}</TableCell></TableRow>)}</TableBody></Table>}</CardContent></Card>
  </div>
}
