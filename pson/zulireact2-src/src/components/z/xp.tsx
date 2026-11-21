// @ts-nocheck
import { useEffect, useRef, useState } from 'react'
import { Check, Copy, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { DEF, setTweaks, useTweaks } from '@/lib/tweaks'

const Row = ({ label, hint, children, id }: any) => <div className="grid gap-2"><div className="flex items-baseline justify-between gap-2"><Label htmlFor={id}>{label}</Label>{hint ? <span className="text-xs text-muted-foreground tabular-nums">{hint}</span> : null}</div>{children}</div>
const H = ({ children, desc }: any) => <div className="grid gap-0.5"><h3 className="text-sm font-semibold">{children}</h3>{desc ? <p className="text-xs text-muted-foreground">{desc}</p> : null}</div>

/* Copy settings: only keys changed from defaults, as readable lines plus a JSON line. */
export function settingsText(v) {
  const diff = Object.fromEntries(Object.keys(DEF).filter((k) => v[k] !== DEF[k]).map((k) => [k, v[k]]))
  const ks = Object.keys(diff)
  if (!ks.length) return { text: 'No changes from default', n: 0 }
  const f = (x) => (x === '' ? 'near-black (stock)' : String(x))
  return { text: ['Zuli React v2 experimental settings (changed from default)'].concat(ks.map((k) => `${k}: ${f(diff[k])} (default: ${f(DEF[k])})`), ['JSON: ' + JSON.stringify(diff)]).join('\n'), n: ks.length }
}
async function copyText(t) {
  try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(t); return true } } catch { /* fall back */ }
  const ta = document.createElement('textarea')
  ta.value = t; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;font-size:16px'
  const host = document.querySelector('[data-slot=sheet-content]') || document.body
  host.appendChild(ta); ta.focus(); ta.select(); ta.setSelectionRange(0, t.length)
  let ok = false
  try { ok = document.execCommand('copy') } catch { ok = false }
  ta.remove(); return ok
}
function CopySettings({ v }) {
  const [msg, setMsg] = useState('')
  const tm = useRef(0)
  useEffect(() => () => clearTimeout(tm.current), [])
  const go = async () => {
    const { text, n } = settingsText(v)
    const ok = await copyText(text)
    setMsg(!ok ? 'Copy failed' : n ? 'Copied ' + n + ' change' + (n === 1 ? '' : 's') : 'No changes from default')
    clearTimeout(tm.current); tm.current = window.setTimeout(() => setMsg(''), 2000)
  }
  return <Button id="xpCopy" onClick={go} aria-live="polite">{msg && msg.startsWith('Copied') ? <Check /> : <Copy />}{msg || 'Copy settings'}</Button>
}

/* Experimental settings (rebuilt 21 Nov 2026, consultation 2 §14): a right-hand sheet, sections, nothing collapses.
   Stored in localStorage 'zulireact2.xp'. Light/dark mode lives on the Settings page. */
export function XpSheet({ open, onOpenChange }) {
  const [v, set] = useTweaks()
  const seg = (k, items, label) => <ToggleGroup type="single" variant="outline" size="sm" value={String(v[k])} onValueChange={(x) => x && set(k, x)} className="w-full" aria-label={label}>{items.map(([val, l]) => <ToggleGroupItem key={val} value={val} className="flex-1 px-1.5 text-xs">{l}</ToggleGroupItem>)}</ToggleGroup>
  const sel = (k, items, label) => <Select value={String(v[k])} onValueChange={(x) => set(k, x)}><SelectTrigger id={'xp-' + k} size="sm" className="w-full" aria-label={label}><SelectValue /></SelectTrigger><SelectContent>{items.map(([val, l]) => <SelectItem key={val} value={val}>{l}</SelectItem>)}</SelectContent></Select>
  const sw = (k, label, on = 'on', off = 'off') => <div className="flex items-center justify-between gap-3"><Label htmlFor={'xp-' + k} className="font-normal">{label}</Label><Switch id={'xp-' + k} checked={v[k] === on} onCheckedChange={(c) => set(k, c ? on : off)} /></div>
  /* One row: ≤4 short options as a segmented control, otherwise a select. */
  const r = (k, label, items) => <Row label={label} id={'xp-' + k} key={k}>{items.length <= 4 && items.every(([, l]) => l.length <= 12) ? seg(k, items, label) : sel(k, items, label)}</Row>
  const ON = [['on', 'On'], ['off', 'Off']]
  return <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent side="right" overlayClassName="bg-transparent supports-backdrop-filter:backdrop-blur-none" className="flex flex-col gap-0 p-0 shadow-2xl data-[side=right]:w-full data-[side=right]:sm:max-w-sm">
      <SheetHeader className="border-b"><SheetTitle>Experimental settings</SheetTitle><SheetDescription>Saved in this browser. Only affects this build. Light/dark mode is on the Settings page.</SheetDescription></SheetHeader>
      <ScrollArea className="min-h-0 flex-1"><div className="grid gap-6 p-4">
        <H desc="Company page grid">Layout</H>
        {r('dash', 'Dashboard layout', [['C', 'C full width'], ['A', 'A paired'], ['classic', 'Classic']])}
        {r('emptyCharges', 'Charges tile when none', [['row', 'Slim row'], ['hidden', 'Hidden']])}
        {r('pscCols', 'Ownership PSC columns (full width)', [['auto', 'Auto'], ['2', '2'], ['3', '3']])}
        <Separator />
        <H desc="Board tile and the Officers page">Board & officers</H>
        {r('boardChart', 'Board tile chart', [['bars', 'Yearly bars'], ['step', 'Board size'], ['none', 'None']])}
        {r('boardN', 'Board tile changes shown', [['5', '5'], ['8', '8'], ['10', '10']])}
        {r('offView', 'Officers default view', [['table', 'Table'], ['timeline', 'Timeline'], ['changes', 'Changes']])}
        {r('tlSort', 'Timeline sort', [['current', 'Current first'], ['appointed', 'Appointed'], ['tenure', 'Tenure']])}
        {r('tlColour', 'Timeline colour', [['status', 'Current/former'], ['role', 'By role']])}
        {sw('tlLabels', 'Tenure labels on timeline bars')}
        {r('bigRange', 'Default range over 40 records', [['5y', '5y'], ['10y', '10y'], ['all', 'All']])}
        {r('offChart', 'Officers page header chart', [['step', 'Board size'], ['bars', 'Yearly bars'], ['none', 'None']])}
        {sw('lineups', 'Line-ups view (experiment)')}
        <Separator />
        <H desc="Filing rows, tile and full page">Filings</H>
        {r('fBtnSize', 'Download button size', [['xs', 'XS 24'], ['sm', 'SM 28'], ['md', 'MD 32']])}
        {r('fBtnStyle', 'Download button style', [['outline', 'Outline'], ['ghost', 'Ghost'], ['soft', 'Soft'], ['pdf', '+ PDF']])}
        {r('fRow', 'Row style', [['divider', 'Divider'], ['zebra', 'Zebra'], ['boxed', 'Boxed']])}
        {r('fHover', 'Row hover', [['both', 'Tint + line'], ['tint', 'Tint'], ['underline', 'Underline']])}
        {r('fPages', 'Page count', [['beside', 'Beside'], ['under', 'Under'], ['hidden', 'Hidden']])}
        {r('fType', 'Type code column', [['shown', 'Shown'], ['hidden', 'Hidden']])}
        {r('fRows', 'Rows in tile (with pager)', [['5', '5'], ['6', '6'], ['8', '8']])}
        <Separator />
        <H desc="Registered office map (company pages only)">Map</H>
        {r('mapBtn', 'Button position', [['end', 'Address end'], ['label', 'Address start'], ['header', 'Header']])}
        {r('mapForm', 'Button form', [['text', 'Icon + Map'], ['icon', 'Icon only']])}
        {r('mapPlace', 'Placement', [['inline', 'Inline'], ['dialog', 'Dialog'], ['sheet', 'Sheet'], ['popover', 'Popover']])}
        {r('mapSize', 'Size', [['s', 'S 240'], ['m', 'M 320'], ['l', 'L 420']])}
        {r('mapBase', 'Base style', [['positron', 'Positron'], ['bright', 'Bright'], ['liberty', 'Liberty'], ['dark', 'Dark'], ['fiord', 'Fiord']])}
        {r('mapTint', 'Tint', [['none', 'None'], ['accent', 'Zuli blue'], ['grey', 'Greyscale']])}
        {sw('mapStreets', 'Street names')}
        {r('mapPoi', 'Points of interest', [['off', 'Off'], ['major', 'Major'], ['all', 'All']])}
        {sw('mapHouse', 'House numbers')}
        {sw('map3d', '3D buildings')}
        {r('mapBcol', 'Building colour', [['flat', 'Flat'], ['gradient', 'By height']])}
        {sw('mapVgrad', 'Soft wall shading (vertical gradient)')}
        {r('mapHeight', 'Height exaggeration', [['1', '1×'], ['1.5', '1.5×'], ['2', '2×']])}
        {r('mapZoom', 'Zoom', [['14', '14'], ['15', '15'], ['16', '16'], ['17', '17']])}
        {r('mapPitch', 'Pitch', [['0', '0°'], ['30', '30°'], ['45', '45°'], ['60', '60°']])}
        {r('mapBearing', 'Bearing', [['0', '0°'], ['-20', '−20°'], ['orbit', 'Orbit']])}
        {sw('mapFly', 'Fly-in on open')}
        {r('mapMarker', 'Marker', [['dot', 'Dot'], ['pin', 'Pin'], ['pulse', 'Pulse'], ['area', 'Area']])}
        {r('mapInteract', 'Interaction', [['static', 'Static'], ['coop', 'Cooperative'], ['free', 'Free']])}
        {sw('mapTerrain', 'Terrain and hill shading')}
        {sw('mapGlobe', 'Globe intro')}
        {sw('mapLinks', 'Google / Apple Maps links')}
        <Separator />
        <H desc="Registered office flag and person flags">Flags</H>
        {r('flag', 'Flag style', [['country', 'Country'], ['union', 'Union Jack'], ['both', 'Both']])}
        {r('flagPos', 'Company flag position', [['end', 'Address end'], ['start', 'Address start'], ['name', 'After name'], ['meta', 'Meta line'], ['row', 'Own row'], ['hidden', 'Hidden']])}
        {r('flagSize', 'Size', [['12', '12'], ['14', '14'], ['16', '16'], ['20', '20']])}
        {r('flagShape', 'Shape', [['rect', '4:3'], ['square', 'Square'], ['rounded', 'Rounded'], ['circle', 'Circle']])}
        {r('flagEdge', 'Edge', [['none', 'None'], ['ring', 'Inset ring'], ['border', 'Grey border'], ['shadow', 'Shadow']])}
        {r('flagLabel', 'Label', [['both', 'Flag + name'], ['flag', 'Flag only'], ['name', 'Name only']])}
        {r('personFlags', 'Person flags', [['off', 'Off'], ['residence', 'Residence in Details'], ['both', 'Residence + nationality'], ['overview', 'Overview too']])}
        <Separator />
        <H desc="Labels on officer and PSC rows; popover explains">ID verification</H>
        {r('idOff', 'Officer rows', [['vo', 'Verified + overdue'], ['v', 'Verified only'], ['all', 'All states']])}
        {r('idPsc', 'PSC rows', [['all', 'All states'], ['vo', 'Verified + overdue']])}
        {r('idPop', 'Popover', [['hover', 'On hover'], ['click', 'On click']])}
        <Separator />
        <H desc="Toasts (bottom-right), back link, loading">Feedback & navigation</H>
        {r('toastStyle', 'Toast style', [['default', 'Default'], ['rich', 'Rich colours'], ['minimal', 'Minimal']])}
        {r('toastDur', 'Toast duration', [['3', '3s'], ['4', '4s'], ['6', '6s']])}
        {sw('undoUnsave', 'Undo on unsave')}
        {r('back', 'Back link', [['one', 'One level'], ['trail', 'Trail (3)']])}
        {r('fade', 'Loading fade', [['150', '150ms'], ['100', '100ms'], ['none', 'None']])}
        {r('pulse', 'Placeholder pulse', [['on', 'Pulse'], ['static', 'Static']])}
        <Separator />
        <H desc="PDF built in the browser. Work in progress">Download report</H>
        {r('repPlace', 'Button placement', [['header', 'Header actions'], ['tile', 'Overview tile'], ['both', 'Both'], ['sidebar', 'Sidebar']])}
        {r('repStyle', 'Button style', [['outline', 'Outline'], ['solid', 'Solid'], ['secondary', 'Soft'], ['ghost', 'Ghost']])}
        {r('repLabel', 'Button label', [['text', 'Icon + text'], ['icon', 'Icon only']])}
        {r('repOpen', 'When ready', [['download', 'Download'], ['tab', 'Open in new tab']])}
        {r('repSize', 'Page size', [['A4', 'A4'], ['LETTER', 'US Letter']])}
        {r('repFile', 'File name', [['name-number-date', 'Zuli report – Name – No. – date'], ['number-name', 'No. Name'], ['name', 'Name – company report'], ['slug', 'zuli-number-yyyymmdd']])}
        {sw('repCover', 'Cover page')}
        {sw('repContents', 'Contents page (linked)')}
        {sw('repFigs', 'Headline figures strip')}
        {sw('repOverview', 'Section: Overview')}
        {sw('repOfficers', 'Section: Current officers')}
        {sw('repFormer', 'Section: Former officers')}
        {sw('repOwnership', 'Section: Ownership')}
        {sw('repCharges', 'Section: Charges')}
        {sw('repFilings', 'Section: Recent filings')}
        {r('repFilingsN', 'Filings included', [['10', '10'], ['25', '25'], ['50', '50'], ['100', '100']])}
        {sw('repChanges', 'Section: Officer changes')}
        {sw('repLinks', 'Links to Zuli and documents')}
        {sw('repOutline', 'PDF bookmarks (outline)')}
        <Separator />
        <H desc="Logo concept 03 is the new default">Brand</H>
        {r('logo', 'Logo', [['new', 'New (03)'], ['ink', 'Old, mono'], ['colour', 'Old, colour']])}
      </div></ScrollArea>
      <SheetFooter className="border-t"><CopySettings v={v} /><Button variant="outline" onClick={() => setTweaks({})}><RotateCcw />Reset to defaults</Button></SheetFooter>
    </SheetContent></Sheet>
}
