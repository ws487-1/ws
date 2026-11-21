// @ts-nocheck
import { useEffect, useState } from 'react'
import { Calendar, Users, ChartPie, Landmark } from 'lucide-react'
import { Stat, ProfileSkeleton, ErrorCard, ProfileCtx } from '@/components/z/bits'
import { CompanyHeader, Deadlines, People, Ownership, Charges, Insolvency, Changes, History, Filings, Similar, UkEst, Board } from '@/components/z/tiles'
import { ReportButton } from '@/components/z/report'
import { loadCompany, peekCompany, nation, normNumber } from '@/lib/data'
import { useLoad, setTitle } from '@/lib/hooks'
import { useCrumbs } from '@/lib/crumbs'
import { useTweaks } from '@/lib/tweaks'
import { addViewed } from '@/lib/store'
import { U } from '@/lib/router'
import { cn } from '@/lib/utils'

const ICONS = { age: Calendar, directors: Users, owners: ChartPie, charges: Landmark }
const natCache = {}
/* Tell the shell which company is open (for the sidebar report button). */
export const setCurrentCompany = (c) => { window.__zCompany = c; window.dispatchEvent(new Event('zcompany')) }

/* Company profile. 'Dashboard layout' setting (consultation 2 §4):
   C (default): only Deadlines | People paired; Ownership, Board and Charges each a full-width row, so nothing stretches,
     and Charges showing or not just adds or removes a row.
   A: Ownership s5 | Board s7, Charges full width.
   classic: the previous grid (Ownership | Charges, Officer changes | Board activity; separate tiles).
   'Charges when none': a slim full-width "No charges registered" row (default) or hidden. */
export function CompanyPage({ route, n: raw }) {
  const n = normNumber(decodeURIComponent(raw || ''))
  const s = useLoad(() => loadCompany(n), [n], () => peekCompany(n))
  const [nat, setNat] = useState(natCache[n] || null)
  const [tw] = useTweaks()
  const name = s.data ? s.data.vm.name : n
  useCrumbs([{ label: 'Companies', href: '#/search' }, { label: name }], [name])
  useEffect(() => { setTitle(s.data ? s.data.vm.name : n) }, [n])
  useEffect(() => {
    if (!s.data) return
    const vm = s.data.vm
    setTitle(vm.name); addViewed('company', vm.number, vm.name); setCurrentCompany({ number: vm.number, name: vm.name })
    let live = true; nation(vm).then((x) => { natCache[n] = x; live && setNat(x) }).catch(() => {})
    return () => { live = false }
  }, [s.data])
  useEffect(() => () => setCurrentCompany(null), [])
  if (s.loading) return <ProfileSkeleton layout={tw.dash} />
  if (s.err) return <ErrorCard e={s.err} />
  const { vm, ukEst } = s.data
  const f = Object.fromEntries(vm.keyFacts.map((x) => [x.key, x]))
  const stat = (k, href?) => (f[k] ? <Stat label={f[k].label} value={f[k].value} sub={f[k].sub} tone={f[k].tone} icon={ICONS[k]} href={href} style={tw.stat} /> : null)
  const hasCharges = vm.charges.available && vm.charges.total > 0
  const showCharges = hasCharges || tw.emptyCharges === 'row'
  const charges = <Charges vm={vm} slim={!hasCharges} />
  const history = <History items={vm.officers.all || []} o={{ kind: 'company', available: vm.officers.available, complete: vm.officers.complete, loaded: vm.officers.counts.loaded, total: vm.officers.counts.total, created: vm.created, ceased: vm.ceased, status: vm.status.code, open: { href: U.officers(vm.number, 'changes'), label: 'Open officer changes' } }} />
  const report = <ReportButton number={vm.number} />
  let mid
  if (tw.dash === 'classic') mid = <>
    <div className="s5"><Ownership vm={vm} /></div>
    <div className="s7"><Charges vm={vm} /></div>
    <div className="s5"><Changes vm={vm} /></div>
    <div className="s7">{history}</div></>
  else if (tw.dash === 'A') mid = <>
    <div className="s5"><Ownership vm={vm} /></div>
    <div className="s7"><Board vm={vm} wide={false} /></div>
    {showCharges ? <div className="s12">{charges}</div> : null}</>
  else mid = <>
    <div className="s12"><Ownership vm={vm} wide /></div>
    <div className="s12"><Board vm={vm} /></div>
    {showCharges ? <div className="s12">{charges}</div> : null}</>
  return <ProfileCtx.Provider value={{ here: route.key, name: vm.name }}>
    <div className={cn('z-stack', !s.cached && 'z-fade')}>
      <CompanyHeader vm={vm} nat={nat} report={report} />
      <div className="bento">
        <div className="s3">{stat('age')}</div><div className="s3">{stat('directors', U.officers(vm.number, 'table'))}</div><div className="s3">{stat('owners')}</div><div className="s3">{stat('charges')}</div>
        {vm.insolvency.cases.length ? <div className="s12"><Insolvency vm={vm} /></div> : null}
        <div className="s4"><Deadlines vm={vm} /></div>
        <div className="s8"><People vm={vm} /></div>
        {mid}
        <div className="s12"><Filings vm={vm} /></div>
        {ukEst ? <><div className="s5"><Similar vm={vm} /></div><div className="s7"><UkEst vm={vm} /></div></> : <div className="s12"><Similar vm={vm} /></div>}
      </div>
    </div>
  </ProfileCtx.Provider>
}
