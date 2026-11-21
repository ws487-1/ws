// @ts-nocheck
/* Test page (not in the nav): build a company report PDF in the browser from a company number. #/pdf or #/pdf/<number> */
import { useEffect, useRef, useState } from 'react'
import { pdf } from '@react-pdf/renderer'
import { Download, FileText, LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PageHead, Muted, Note } from '@/components/z/bits'
import { useCrumbs } from '@/lib/crumbs'
import { setTitle } from '@/lib/hooks'
import { loadCompany, allPages, nation } from '@/lib/data'
import { N } from '@/lib/legacy'
import { ReportDoc } from '@/pdf/report'

const LOGO = import.meta.env.BASE_URL + 'zuli-logo.png'
const SAMPLES = [['00445790', 'Tesco'], ['00002065', 'Lloyds Bank'], ['09446231', 'Monzo'], ['05358761', 'O & O Electrical']]

/* react-pdf can't draw SVG files, so the flag-icons SVG is rasterised to a PNG data URL first. */
function flagPng(code) {
  return new Promise((ok, no) => {
    const img = new window.Image(); img.onload = () => { const c = document.createElement('canvas'); c.width = 160; c.height = 120; c.getContext('2d').drawImage(img, 0, 0, 160, 120); ok(c.toDataURL('image/png')) }
    img.onerror = no; img.src = import.meta.env.BASE_URL + 'flags/' + code + '.svg'
  })
}
/* Same loader as the company page, plus every charge: fetched when the profile links to charges (or the older has_charges flag says so). */
async function loadReport(n) {
  const { raw, vm } = await loadCompany(n)
  const p = raw.profile, L = p.links || {}
  if (L.charges || p.has_charges) {
    const c = await allPages('/company/' + n + '/charges', 100)
    if (!c._http) vm.charges = N.charges(c)
  }
  const nat = await nation(vm).catch(() => null)
  if (nat && nat.flag) nat.png = await flagPng(nat.flag).catch(() => '')
  return { vm, nat }
}

export default function PdfPage({ route }) {
  const initial = (route.parts[1] || '').toUpperCase()
  const [num, setNum] = useState(initial)
  const [st, setSt] = useState({ busy: false, err: '', url: '', name: '', pages: 0, ms: 0 })
  const urlRef = useRef('')
  useCrumbs([{ label: 'PDF report (test)' }], [])
  useEffect(() => setTitle('PDF report'), [])
  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current) }, [])
  const run = async (n) => {
    n = String(n || '').trim().toUpperCase().replace(/\s+/g, '')
    if (!n) return
    if (/^\d{1,7}$/.test(n)) n = n.padStart(8, '0')
    setNum(n); setSt({ busy: true, err: '', url: '', name: '', pages: 0, ms: 0 })
    const t0 = performance.now()
    try {
      const { vm, nat } = await loadReport(n)
      const generated = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      /* Two passes: the first records which page each section starts on, the second prints those numbers on the
         contents page. The contents page is one fixed page, so the numbers can't shift between passes. */
      const base = location.origin + import.meta.env.BASE_URL, starts = {}
      const doc = (toc) => <ReportDoc vm={vm} nation={nat} logo={LOGO} generated={generated} base={base} pages={starts} toc={toc} />
      await pdf(doc(null)).toBlob()
      const toc = { ...starts }
      const blob = await pdf(doc(toc)).toBlob()
      const head = await blob.slice(0, Math.min(blob.size, 4e6)).text().catch(() => '')
      const pages = (head.match(/\/Type\s*\/Page[^s]/g) || []).length
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
      urlRef.current = URL.createObjectURL(blob)
      setSt({ busy: false, err: '', url: urlRef.current, name: vm.name, number: vm.number, pages, ms: Math.round(performance.now() - t0), size: blob.size })
      if (location.hash !== '#/pdf/' + n) history.replaceState(null, '', '#/pdf/' + n)
    } catch (e) { console.error(e); setSt({ busy: false, err: e.message || String(e), url: '', name: '', pages: 0, ms: 0 }) }
  }
  useEffect(() => { if (initial) run(initial) }, [])
  const file = st.name ? 'Zuli report ' + st.number + ' ' + st.name.replace(/[^\w &.-]+/g, '').trim() + '.pdf' : 'report.pdf'
  return <div className="z-stack">
    <PageHead title="PDF report" desc="Test page: builds a company report PDF in this browser from a company number." />
    <Card><CardContent className="grid gap-3">
      <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); run(num) }}>
        <Input value={num} onChange={(e) => setNum(e.target.value)} placeholder="Company number, e.g. 00445790" className="w-64" aria-label="Company number" autoFocus />
        <Button type="submit" disabled={st.busy}>{st.busy ? <LoaderCircle className="animate-spin" /> : <FileText />}Generate</Button>
        {st.url ? <Button variant="outline" asChild><a href={st.url} download={file}><Download />Download PDF</a></Button> : null}
      </form>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground"><span>Try</span>{SAMPLES.map(([n, l]) => <button key={n} type="button" className="underline-offset-4 hover:underline" onClick={() => run(n)}>{l} <span className="font-mono text-xs">{n}</span></button>)}</div>
      {st.busy ? <Muted>Fetching Companies House data and laying out the report…</Muted> : null}
      {st.err ? <Muted className="text-destructive">{st.err}</Muted> : null}
      {st.url ? <Note>{st.name} · {st.pages || '?'} page{st.pages === 1 ? '' : 's'} · {(st.size / 1024).toFixed(0)} KB · built in {(st.ms / 1000).toFixed(1)}s</Note> : null}
    </CardContent></Card>
    {st.url ? <iframe title="Report preview" src={st.url} className="h-[82vh] w-full rounded-lg border bg-muted" /> : null}
  </div>
}
