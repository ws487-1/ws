// @ts-nocheck
import { useEffect, useState } from 'react'
import { Tile, StatTile, Loading, ErrorBox, ProfileCtx } from '@/components/z/bits'
import { CompanyHeader, Deadlines, People, Ownership, Charges, Insolvency, Changes, History, Filings, Similar, UkEst } from '@/components/z/tiles'
import { loadCompany, nation, normNumber } from '@/lib/data'
import { useLoad, setTitle } from '@/lib/hooks'
import { addViewed, rememberBack } from '@/lib/store'
import { U } from '@/lib/router'

/* Company profile: overview header, stat tiles, then the bento of section tiles (layout B from /pson/zuli). */
export function CompanyPage({ route, n: raw }) {
  const n = normNumber(decodeURIComponent(raw || ''))
  const s = useLoad(() => loadCompany(n), [n])
  const [nat, setNat] = useState(null)
  useEffect(() => { setTitle(n) }, [n])
  useEffect(() => {
    if (!s.data) return
    const vm = s.data.vm
    setTitle(vm.name); addViewed('company', vm.number, vm.name)
    let live = true; nation(vm).then((x) => live && setNat(x)).catch(() => {})
    return () => { live = false }
  }, [s.data])
  if (s.loading) return <div className="panel"><Loading /></div>
  if (s.err) return <div className="panel"><ErrorBox e={s.err} /></div>
  const { vm, ukEst } = s.data
  const f = Object.fromEntries(vm.keyFacts.map((x) => [x.key, x]))
  const here = route.key
  return <ProfileCtx.Provider value={{ here, name: vm.name }}>
    <article className="z-profile">
      <Tile className="mb-(--gap)"><CompanyHeader vm={vm} nat={nat} /></Tile>
      <div className="bento">
        <div className="s3"><StatTile f={f.age} /></div><div className="s3"><StatTile f={f.directors} href={U.officers(vm.number)} /></div><div className="s3"><StatTile f={f.owners} /></div><div className="s3"><StatTile f={f.charges} /></div>
        {vm.insolvency.cases.length ? <Tile className="s12"><Insolvency vm={vm} /></Tile> : null}
        <Tile className="s4"><Deadlines vm={vm} /></Tile>
        <Tile className="s8"><People vm={vm} /></Tile>
        <Tile className="s5"><Ownership vm={vm} /></Tile>
        <Tile className="s7"><Charges vm={vm} /></Tile>
        <Tile className="s5" href={U.officers(vm.number)} onClick={() => rememberBack(U.officers(vm.number), here, vm.name)}><Changes vm={vm} /></Tile>
        <Tile className="s7 yc-tile"><History items={vm.officers.all || []} o={{ kind: 'company', available: vm.officers.available, complete: vm.officers.complete, loaded: vm.officers.counts.loaded, total: vm.officers.counts.total, created: vm.created, ceased: vm.ceased, status: vm.status.code, open: { href: U.officers(vm.number), label: 'Open the full officers list' } }} /></Tile>
        <Tile className="s12"><Filings vm={vm} /></Tile>
        {ukEst ? <><Tile className="s5"><Similar vm={vm} /></Tile><Tile className="s7"><UkEst vm={vm} /></Tile></> : <Tile className="s12"><Similar vm={vm} /></Tile>}
      </div>
    </article>
  </ProfileCtx.Provider>
}
