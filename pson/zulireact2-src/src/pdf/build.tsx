// @ts-nocheck
/* Shared PDF builder for the /pdf test page and the Download report button (lazy chunk with react-pdf). */
import { pdf } from '@react-pdf/renderer'
import { loadCompany, allPages, ch, nation } from '@/lib/data'
import { N } from '@/lib/legacy'
import { getTweaks } from '@/lib/tweaks'
import { ReportDoc } from './report'

const B = import.meta.env.BASE_URL
export const logoFor = (logo = getTweaks().logo) => (logo === 'new' ? { src: B + 'zuli-logo-03.png', w: 22 * 949 / 300 } : { src: B + 'zuli-logo.png', w: 66 })
function flagPng(code) {
  return new Promise((ok, no) => {
    const img = new window.Image(); img.onload = () => { const c = document.createElement('canvas'); c.width = 160; c.height = 120; c.getContext('2d').drawImage(img, 0, 0, 160, 120); ok(c.toDataURL('image/png')) }
    img.onerror = no; img.src = B + 'flags/' + code + '.svg'
  })
}
/* Company loader plus every charge (when the profile links to charges, or the older has_charges flag says so) and, if
   asked, more filings. Works on a copy so the in-memory company cache isn't changed. */
export async function loadReport(n, filingsN = 25) {
  const { raw, vm: v0 } = await loadCompany(n)
  const vm = { ...v0 }
  const p = raw.profile, L = p.links || {}
  if (L.charges || p.has_charges) { const c = await allPages('/company/' + n + '/charges', 100); if (!c._http) vm.charges = N.charges(c) }
  if (filingsN > vm.filings.items.length && vm.filings.total > vm.filings.items.length) { const f = await ch('/company/' + n + '/filing-history?items_per_page=' + Math.min(100, filingsN)); if (!f._http) vm.filings = N.filings(f) }
  const nat = await nation(vm).catch(() => null)
  if (nat && nat.flag) nat.png = await flagPng(nat.flag).catch(() => '')
  return { vm, nat }
}
/* Two passes: the first records which page each section starts on, the second prints those numbers on the contents page. */
export async function buildReport(n, opt: any = {}) {
  const { vm, nat } = await loadReport(n, +opt.filingsN || 25)
  const generated = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  const base = location.origin + B, starts = {}, lg = logoFor(opt.logo)
  const doc = (toc) => <ReportDoc vm={vm} nation={nat} logo={lg.src} generated={generated} base={base} pages={starts} toc={toc} opt={{ ...opt, logoW: lg.w }} />
  if (opt.contents !== false) await pdf(doc(null)).toBlob()
  const blob = await pdf(doc({ ...starts })).toBlob()
  return { blob, vm }
}
const today = () => new Date().toISOString().slice(0, 10)
const safe = (x) => String(x).replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim()
export function reportFilename(vm, fmt = 'name-number-date') {
  const name = safe(vm.name), num = vm.number
  if (fmt === 'number-name') return `${num} ${name}.pdf`
  if (fmt === 'name') return `${name} – company report.pdf`
  if (fmt === 'slug') return `zuli-${num}-${today().replace(/-/g, '')}.pdf`
  return `Zuli report – ${name} – ${num} – ${today()}.pdf`
}
/* Settings → builder options. */
export function optsFromTweaks(t = getTweaks()) {
  return { size: t.repSize, cover: t.repCover === 'on', contents: t.repContents === 'on', figs: t.repFigs === 'on', links: t.repLinks === 'on', outline: t.repOutline === 'on', filingsN: +t.repFilingsN, logo: t.logo,
    secs: { overview: t.repOverview === 'on', officers: t.repOfficers === 'on', former: t.repFormer === 'on', ownership: t.repOwnership === 'on', charges: t.repCharges === 'on', filings: t.repFilings === 'on', changes: t.repChanges === 'on' } }
}
