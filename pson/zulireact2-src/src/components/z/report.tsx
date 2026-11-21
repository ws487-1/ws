// @ts-nocheck
/* Download report (WIP): builds the company PDF in the browser (react-pdf loaded on first click) with the sections and
   format from the experimental settings, then downloads it or opens it in a new tab. */
import { useState } from 'react'
import { FileDown, LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTweaks } from '@/lib/tweaks'
import { note } from '@/lib/toast'
import { cn } from '@/lib/utils'

export async function makeReport(number, tw, win?) {
  const m = await import('@/pdf/build')
  const { blob, vm } = await m.buildReport(number, m.optsFromTweaks(tw))
  const url = URL.createObjectURL(blob), name = m.reportFilename(vm, tw.repFile)
  if (tw.repOpen === 'tab' && win) win.location.href = url
  else { const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove() }
  setTimeout(() => URL.revokeObjectURL(url), 120000)
  return { name, pages: 0 }
}
export function ReportButton({ number, className = '', full = false }) {
  const [tw] = useTweaks()
  const [busy, setBusy] = useState(false)
  const go = async () => {
    if (busy) return
    setBusy(true)
    /* A new tab has to be opened inside the click, or the browser blocks it; it's pointed at the PDF when ready. */
    const win = tw.repOpen === 'tab' ? window.open('', '_blank') : null
    if (win) try { win.document.title = 'Building report…'; win.document.body.style.font = '14px system-ui'; win.document.body.textContent = 'Building the Zuli report…' } catch { /* cross-origin */ }
    try { const r = await makeReport(number, tw, win); note(tw.repOpen === 'tab' ? 'Report opened in a new tab' : 'Report downloaded', { kind: 'success', description: r.name }) }
    catch (e) { console.error(e); if (win) win.close(); note('Couldn\u2019t build the report', { description: e.message || String(e) }) }
    finally { setBusy(false) }
  }
  const variant = { outline: 'outline', solid: 'default', ghost: 'ghost', secondary: 'secondary', link: 'link' }[tw.repStyle] || 'outline'
  const icon = busy ? <LoaderCircle className="animate-spin" /> : <FileDown />
  const label = busy ? 'Building…' : 'Download report'
  if (tw.repLabel === 'icon' && !full) return <Tooltip><TooltipTrigger asChild><Button variant={variant} size="icon" onClick={go} aria-label="Download report (PDF)" disabled={busy} className={className}>{icon}</Button></TooltipTrigger><TooltipContent>Download report (PDF, work in progress)</TooltipContent></Tooltip>
  return <Button variant={variant} onClick={go} disabled={busy} className={cn(className)} title="Company report as a PDF (work in progress)">{icon}{label}</Button>
}
