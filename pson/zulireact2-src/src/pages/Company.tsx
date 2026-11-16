// @ts-nocheck
import { useEffect, useState } from 'react'
import { Calendar, Users, ChartPie, Landmark } from 'lucide-react'
import { Stat, ProfileSkeleton, ErrorCard, ProfileCtx } from '@/components/z/bits'
import { CompanyHeader, Deadlines, People, Ownership, Charges, Insolvency, Changes, History, Filings, Similar, UkEst } from '@/components/z/tiles'
import { loadCompany, nation, normNumber } from '@/lib/data'
import { useLoad, setTitle } from '@/lib/hooks'
import { useCrumbs } from '@/lib/crumbs'
import { useTweaks } from '@/lib/tweaks'
import { addViewed } from '@/lib/store'
import { U } from '@/lib/router'

const ICONS = { age: Calendar, directors: Users, owners: ChartPie, charges: Landmark }
/* Company profile: header card, four stat cards, then the bento of section cards (same order as /pson/zuli). */
export function CompanyPage({ route, n: raw }) {
  const n = normNumber(decodeURIComponent(raw || ''))
  const s = useLoad(() => loadCompany(n), [n])
  const [nat, setNat] = useState(null)
  const [tw] = useTweaks()
  const name = s.data ? s.data.vm.name : n
  useCrumbs([{ label: 'Companies', href: '#/search' }, { label: name }], [name])
  useEffect(() => { setTitle(n) }, [n])
  useEffect(() => {
    if (!s.data) return
    const vm = s.data.vm
    setTitle(vm.name); addViewed('company', vm.number, vm.name)
    let live = true; nation(vm).then((x) => live && setNat(x)).catch(() => {})
    return () => { live = false }
  }, [s.data])
  if (s.loading) return <ProfileSkeleton />
  if (s.err) return <ErrorCard e={s.err} />
  const { vm, ukEst } = s.data
  const f = Object.fromEntries(vm.keyFacts.map((x) => [x.key, x]))
  const stat = (k, href?) => (f[k] ? <Stat label={f[k].label} value={f[k].value} sub={f[k].sub} tone={f[k].tone} icon={ICONS[k]} href={href} style={tw.stat} /> : null)
  return <ProfileCtx.Provider value={{ here: route.key, name: vm.name }}>
    <div className="z-stack">
      <CompanyHeader vm={vm} nat={nat} />
      <div className="bento">
        <div className="s3">{stat('age')}</div><div className="s3">{stat('directors', U.officers(vm.number))}</div><div className="s3">{stat('owners')}</div><div className="s3">{stat('charges')}</div>
        {vm.insolvency.cases.length ? <div className="s12"><Insolvency vm={vm} /></div> : null}
        <div className="s4"><Deadlines vm={vm} /></div>
        <div className="s8"><People vm={vm} /></div>
        <div className="s5"><Ownership vm={vm} /></div>
        <div className="s7"><Charges vm={vm} /></div>
        <div className="s5"><Changes vm={vm} /></div>
        <div className="s7"><History items={vm.officers.all || []} o={{ kind: 'company', available: vm.officers.available, complete: vm.officers.complete, loaded: vm.officers.counts.loaded, total: vm.officers.counts.total, created: vm.created, ceased: vm.ceased, status: vm.status.code, open: { href: U.officers(vm.number), label: 'Open the full officers list' } }} /></div>
        <div className="s12"><Filings vm={vm} /></div>
        {ukEst ? <><div className="s5"><Similar vm={vm} /></div><div className="s7"><UkEst vm={vm} /></div></> : <div className="s12"><Similar vm={vm} /></div>}
      </div>
    </div>
  </ProfileCtx.Provider>
}
