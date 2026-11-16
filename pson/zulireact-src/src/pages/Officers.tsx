// @ts-nocheck
import { useEffect } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { BackBtn, Loading, ErrorBox } from '@/components/z/bits'
import { N } from '@/lib/legacy'
import { ApiError, allPages, ch, disqByPn, normNumber } from '@/lib/data'
import { useLoad, setTitle } from '@/lib/hooks'
import { backFor } from '@/lib/store'
import { U } from '@/lib/router'

export const CompanyLine = ({ p }) => <><a className="lnk" href={U.company(p.company_number)}>{N.profile(p).name}</a> · No. {p.company_number}</>

/* Expanded officers view: current then resigned, in a shadcn Table. */
export function OfficersPage({ route, n: raw }) {
  const n = normNumber(decodeURIComponent(raw || ''))
  const s = useLoad(async () => {
    const prof = await ch('/company/' + n)
    if (prof._http) throw new ApiError('404', 'No company found with number ' + n + '.')
    const r = await allPages('/company/' + n + '/officers', 100)
    return { prof, of: N.officers(r._http ? null : r), word: N.officerWord(prof.type) }
  }, [n])
  useEffect(() => { setTitle(s.data ? s.data.word.many + ' · ' + N.profile(s.data.prof).name : 'Officers') }, [s.data])
  const back = backFor(route.key)
  if (s.loading) return <><BackBtn b={back} /><div className="panel"><Loading /></div></>
  if (s.err) return <div className="panel"><ErrorBox e={s.err} /></div>
  const { prof, of, word } = s.data, dq = disqByPn()
  const rows = of.active.concat(of.former)
  return <>
    <BackBtn b={back} />
    <div className="page-head"><div><h1>{word.many}</h1><div className="sub"><CompanyLine p={prof} /> · {of.counts.active} current · {of.counts.resigned} resigned</div></div></div>
    <div className="panel">{!of.all.length ? <div className="plain-msg">No {word.many.toLowerCase()} on record.</div> :
      <Table className="z-table"><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Role</TableHead><TableHead>Appointed</TableHead><TableHead>Resigned</TableHead><TableHead>Nationality / country</TableHead></TableRow></TableHeader>
        <TableBody>{rows.map((p, i) => <TableRow key={i}><TableCell className="whitespace-normal">{p.officerId ? <a href={U.person(p.officerId)}>{p.name}</a> : p.name}{p.personNumber && dq[p.personNumber] ? <> <a className="flagtxt bad" href={U.person(p.officerId)}>Disqualified director</a></> : null}</TableCell>
          <TableCell>{p.roleLabel}</TableCell><TableCell className="num">{p.appointed}</TableCell><TableCell className="num">{p.resigned}</TableCell><TableCell className="whitespace-normal">{[p.nationality, p.residence].filter(Boolean).join(' / ')}</TableCell></TableRow>)}</TableBody></Table>}</div>
  </>
}
