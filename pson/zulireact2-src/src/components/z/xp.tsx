// @ts-nocheck
import { useEffect, useRef, useState } from 'react'
import { Check, Copy, RotateCcw, Sun, Moon, Monitor } from 'lucide-react'
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
import { DEF, PRESETS, setTweaks, useTweaks } from '@/lib/tweaks'

const BASES = [['neutral', 'oklch(0.556 0 0)'], ['zinc', 'oklch(0.552 0.016 285.938)'], ['stone', 'oklch(0.553 0.013 58.071)'], ['slate', 'oklch(0.554 0.046 257.417)'], ['gray', 'oklch(0.551 0.027 264.364)']]
const Row = ({ label, hint, children, id }: any) => <div className="grid gap-2"><div className="flex items-baseline justify-between gap-2"><Label htmlFor={id}>{label}</Label>{hint ? <span className="text-xs text-muted-foreground tabular-nums">{hint}</span> : null}</div>{children}</div>
const H = ({ children, desc }: any) => <div className="grid gap-0.5"><h3 className="text-sm font-semibold">{children}</h3>{desc ? <p className="text-xs text-muted-foreground">{desc}</p> : null}</div>

/* Copy settings: only keys changed from defaults, as readable lines plus a JSON line. */
export function settingsText(v) {
  const diff = Object.fromEntries(Object.keys(DEF).filter((k) => v[k] !== DEF[k]).map((k) => [k, v[k]]))
  const ks = Object.keys(diff)
  if (!ks.length) return { text: 'No changes from default', n: 0 }
  const f = (x) => (x === '' ? 'stock' : String(x))
  return { text: ['Zuli React v2 settings (changed from default)'].concat(ks.map((k) => `${k}: ${f(diff[k])} (default: ${f(DEF[k])})`), ['JSON: ' + JSON.stringify(diff)]).join('\n'), n: ks.length }
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

/* Experimental settings: a right-hand sheet. Everything persists in localStorage 'zulireact2.tweaks'. */
export function XpSheet({ open, onOpenChange }) {
  const [v, set] = useTweaks()
  const seg = (k, items, label) => <ToggleGroup type="single" variant="outline" size="sm" value={String(v[k])} onValueChange={(x) => x && set(k, x)} className="w-full" aria-label={label}>{items.map(([val, l, Ic]) => <ToggleGroupItem key={val} value={val} className="flex-1 px-1.5 text-xs">{Ic ? <Ic /> : null}{l}</ToggleGroupItem>)}</ToggleGroup>
  const sel = (k, items, label) => <Select value={String(v[k])} onValueChange={(x) => set(k, x)}><SelectTrigger id={'xp-' + k} size="sm" className="w-full" aria-label={label}><SelectValue /></SelectTrigger><SelectContent>{items.map(([val, l]) => <SelectItem key={val} value={val}>{l}</SelectItem>)}</SelectContent></Select>
  const sw = (k, label, on = 'on', off = 'off') => <div className="flex items-center justify-between gap-3"><Label htmlFor={'xp-' + k} className="font-normal">{label}</Label><Switch id={'xp-' + k} checked={v[k] === on || v[k] === true} onCheckedChange={(c) => set(k, typeof DEF[k] === 'boolean' ? c : c ? on : off)} /></div>
  const sl = (k, label, min, max, step, fmt) => <Row label={label} hint={fmt(v[k])}><Slider value={[v[k]]} min={min} max={max} step={step} onValueChange={([x]) => set(k, x)} aria-label={label} /></Row>
  const custom = v.primary && !PRESETS.some(([, , hex]) => hex.toLowerCase() === v.primary.toLowerCase())
  return <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent side="right" overlayClassName="bg-transparent supports-backdrop-filter:backdrop-blur-none" className="flex flex-col gap-0 p-0 shadow-2xl data-[side=right]:w-full data-[side=right]:sm:max-w-sm">
      <SheetHeader className="border-b"><SheetTitle>Experimental settings</SheetTitle><SheetDescription>Saved in this browser. Only affects this build.</SheetDescription></SheetHeader>
      <ScrollArea className="min-h-0 flex-1"><div className="grid gap-6 p-4">
        <H desc="Stock shadcn base colours and a primary">Colour</H>
        <Row label="Mode">{seg('mode', [['light', 'Light', Sun], ['dark', 'Dark', Moon], ['system', 'System', Monitor]], 'Mode')}</Row>
        <Row label="Base colour" hint={v.base}><div className="grid grid-cols-5 gap-2">{BASES.map(([b, c]) => <Button key={b} variant="outline" size="sm" className={cn('h-auto flex-col gap-1 py-2 text-xs capitalize', v.base === b && 'border-primary ring-1 ring-primary')} onClick={() => set('base', b)} aria-pressed={v.base === b}><span className="size-4 rounded-full" style={{ background: c }} />{b}</Button>)}</div></Row>
        <Row label="Primary" hint={v.primary || 'Near-black'}><div className="flex flex-wrap gap-2">
          {PRESETS.map(([id, l, hex]) => <Tooltip key={id}><TooltipTrigger asChild><button type="button" aria-label={l} aria-pressed={(v.primary || '') === hex} onClick={() => set('primary', hex)} className={cn('grid size-8 place-items-center rounded-full border-2 transition-transform hover:scale-110', (v.primary || '').toLowerCase() === hex.toLowerCase() ? 'border-foreground' : 'border-transparent')}><span className="grid size-6 place-items-center rounded-full" style={{ background: hex || 'var(--foreground)' }}>{(v.primary || '').toLowerCase() === hex.toLowerCase() ? <Check className="size-3.5" style={{ color: hex ? '#fff' : 'var(--background)' }} /> : null}</span></button></TooltipTrigger><TooltipContent>{l}{hex ? ' ' + hex : ''}</TooltipContent></Tooltip>)}
          <label className={cn('relative grid size-8 cursor-pointer place-items-center rounded-full border-2', custom ? 'border-foreground' : 'border-dashed border-border')} title="Custom colour"><span className="size-6 rounded-full" style={{ background: custom ? v.primary : 'conic-gradient(#ef4444,#f59e0b,#22c55e,#06b6d4,#3b82f6,#ef4444)' }} /><input type="color" className="absolute inset-0 cursor-pointer opacity-0" value={v.primary || '#171717'} onChange={(e) => set('primary', e.target.value)} aria-label="Custom primary colour" /></label>
        </div></Row>
        {sl('radius', 'Radius', 0, 1.25, 0.125, (x) => x + 'rem')}
        <Row label="Initials avatars" id="xp-initials">{sel('initials', [['neutral', 'Neutral grey'], ['primary', 'Tints of primary'], ['solid', 'Solid primary']], 'Initials avatars')}</Row>
        <Separator />
        <H desc="Sidebar, navigation and page width">Layout</H>
        <Row label="Navigation">{seg('layout', [['sidebar', 'Sidebar'], ['topbar', 'Top bar only']], 'Navigation')}</Row>
        {v.layout === 'sidebar' ? <>
          <Row label="Sidebar style">{seg('sidebarVariant', [['sidebar', 'Default'], ['floating', 'Floating'], ['inset', 'Inset']], 'Sidebar style')}</Row>
          <Row label="Collapse">{seg('collapsible', [['icon', 'To icons'], ['offcanvas', 'Off-canvas'], ['none', 'Fixed']], 'Collapse')}</Row>
          {sl('sidebarWidth', 'Sidebar width', 12, 20, 0.5, (x) => x + 'rem')}
          {v.collapsible !== 'none' ? sw('startCollapsed', 'Start collapsed') : null}
        </> : null}
        <Row label="Menu buttons" id="xp-nav">{sel('nav', [['outline', 'Outline buttons'], ['secondary', 'Filled grey buttons'], ['solid', 'Plain, solid active'], ['ghost', 'Stock ghost']], 'Menu buttons')}</Row>
        <Row label="Content width">{seg('width', [['full', 'Full'], ['narrow', 'Contained']], 'Content width')}</Row>
        {sw('breadcrumbs', 'Breadcrumbs')}
        {sw('kbd', 'Keyboard hints')}
        <Separator />
        <H desc="Font, size and spacing">Type and density</H>
        <Row label="Font">{seg('font', [['geist', 'Geist'], ['inter', 'Inter'], ['system', 'System']], 'Font')}</Row>
        {sl('fs', 'Text size', 87.5, 112.5, 2.5, (x) => x + '%')}
        <Row label="Density">{seg('density', [['compact', 'Compact'], ['default', 'Default'], ['comfortable', 'Roomy']], 'Density')}</Row>
        <Separator />
        <H desc="Cards, stats, tables and charts">Components</H>
        <Row label="Stat tiles" id="xp-stat">{sel('stat', [['default', 'Dashboard (stock)'], ['compact', 'Compact'], ['icon', 'Icon left'], ['centred', 'Centred']], 'Stat tiles')}</Row>
        <Row label="Card shadow">{seg('shadow', [['none', 'None'], ['stock', 'Stock'], ['soft', 'Soft'], ['lifted', 'Lifted']], 'Card shadow')}</Row>
        {sw('border', 'Card borders')}
        {sw('cardbg', 'Muted card background', 'muted', 'plain')}
        {sw('stripe', 'Striped tables')}
        <Row label="History chart">{seg('chart', [['grouped', 'Grouped'], ['stacked', 'Stacked']], 'History chart')}</Row>
        {sw('logo', 'Monochrome logo', 'ink', 'colour')}
      </div></ScrollArea>
      <SheetFooter className="border-t"><CopySettings v={v} /><Button variant="outline" onClick={() => setTweaks({})}><RotateCcw />Reset to defaults</Button></SheetFooter>
    </SheetContent></Sheet>
}
