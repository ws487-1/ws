// @ts-nocheck
import { Fragment, createContext, useContext, useRef, useState, type ReactNode } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useTweaks } from '@/lib/tweaks'
import { backItems, goBackTo } from '@/lib/nav'
import { ArrowUpRight, ArrowLeft, ChevronRight, Building2, Download, BadgeCheck, CircleAlert } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { note } from '@/lib/toast'
import { cn } from '@/lib/utils'

/* Profile context: open buttons on a profile remember it so the expanded view shows "Back to …". */
export const ProfileCtx = createContext<{ here: string; name: string } | null>(null)
export const useProfile = () => useContext(ProfileCtx)

export const initials = (n) => String(n || '?').replace(/^(Mr|Mrs|Ms|Miss|Dr|Sir|Dame|Lord|Lady)\.?\s+/i, '').split(/\s+/).filter(Boolean).map((w) => w[0]).filter((c) => /[A-Za-z0-9]/.test(c)).slice(0, 2).join('').toUpperCase() || '?'
const tint = (n) => { let h = 0; for (const c of String(n || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0; return 'b' + (h % 6 + 1) }
/* Initials in a shadcn Avatar; colours come from the 'Initials' setting (CSS). */
export const Ini = ({ name, className = '' }) => <Avatar className={cn('size-8', className)} aria-hidden="true"><AvatarFallback className={'ini ' + tint(name)}>{initials(name)}</AvatarFallback></Avatar>
/* Company marker: the building icon in a muted rounded square, same footprint as an Avatar. */
export const CoMark = ({ className = '' }) => <span className={cn('z-mark grid size-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground', className)} aria-hidden="true"><Building2 className="size-4" /></span>
export const Mark = ({ kind, name, className = '' }) => (kind === 'company' ? <CoMark className={className} /> : <Ini name={name} className={className} />)

export function Cp({ v, children }: { v: string; children?: ReactNode }) {
  const [c, setC] = useState(false)
  if (!v) return <>{children}</>
  const copy = () => { navigator.clipboard?.writeText(v).then(() => { setC(true); setTimeout(() => setC(false), 1200); note('Copied', { description: v.length > 80 ? v.slice(0, 80) + '…' : v }) }, () => note('Copy failed')) }
  return <span className={'cp' + (c ? ' copied' : '')} role="button" tabIndex={0} title={c ? 'Copied' : 'Click to copy'} onClick={copy} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); copy() } }}>{children ?? v}</span>
}
export const St = ({ label, colour }) => (label ? <span className={'st ' + (colour || 'grey')}>{label}</span> : null)
/* ID verification label with a popover (consultation 2, item 7). Officer rows: verified + overdue by default (no "due");
   PSC rows: all states (grey "due {date}"). Settings: idOff, idPsc, idPop (hover / click). */
const ID_TEXT = {
  verified: (x) => `Identity verified with Companies House on ${x.on} for this role.${x.acsp ? ' Verified through ' + x.acsp + '.' : ''}`,
  due: (x) => `Verification for this role is due by ${x.due}, usually with the company's next confirmation statement. Nothing is wrong yet.`,
  overdue: (x) => `Verification was due on ${x.due} and hasn't been recorded. Companies House may annotate the register; it's an offence to act unverified.`,
}
export function IdLabel({ x, kind = 'officer' }: any) {
  const [tw] = useTweaks()
  const [open, setOpen] = useState(false)
  const tm = useRef(0)
  if (!x) return null
  const mode = kind === 'psc' ? tw.idPsc : tw.idOff
  const show = x.state === 'verified' || (x.state === 'overdue' && mode !== 'v') || (x.state === 'due' && mode === 'all')
  if (!show) return null
  const hover = tw.idPop === 'hover'
  const enter = () => { if (!hover) return; clearTimeout(tm.current); tm.current = window.setTimeout(() => setOpen(true), 120) }
  const leave = () => { if (!hover) return; clearTimeout(tm.current); tm.current = window.setTimeout(() => setOpen(false), 120) }
  const label = x.state === 'verified' ? <><BadgeCheck className="size-3.5" />ID verified</> : x.state === 'overdue' ? <><CircleAlert className="size-3.5" />ID overdue</> : <>ID due {x.due}</>
  const cls = x.state === 'verified' ? 'font-semibold' : x.state === 'overdue' ? 'font-semibold text-amber-700 dark:text-amber-400' : 'font-normal text-muted-foreground'
  return <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild>
    <button type="button" className={cn('inline-flex translate-y-px cursor-help items-center gap-1 rounded-sm text-xs leading-none', cls)} style={x.state === 'verified' ? { color: 'var(--ok)' } : undefined} onMouseEnter={enter} onMouseLeave={leave} aria-label={'Identity verification: ' + x.state}>{label}</button>
  </PopoverTrigger><PopoverContent side="top" className="w-72 text-sm" onMouseEnter={enter} onMouseLeave={leave} onOpenAutoFocus={(e) => e.preventDefault()}>
    <p className="font-medium">{x.state === 'verified' ? 'Identity verified' : x.state === 'overdue' ? 'Identity verification overdue' : 'Identity verification due'}</p><p className="mt-1 text-muted-foreground">{ID_TEXT[x.state](x)}</p></PopoverContent></Popover>
}
export const IdV = ({ on, title }: any) => (on ? <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: 'var(--ok)' }} title={title}><BadgeCheck className="size-3.5" />ID verified</span> : null)
export const Muted = ({ children, className = '' }) => <p className={cn('text-sm text-muted-foreground', className)}>{children}</p>
export const Note = ({ children }) => <p className="text-xs text-muted-foreground">{children}</p>

/* Square outline "open" button (arrow-up-right); on a profile it remembers the profile for the back button. */
export function OpenBtn({ href, label }) {
  const prof = useProfile()
  return <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon-sm" asChild><a href={href} aria-label={label}><ArrowUpRight /></a></Button></TooltipTrigger><TooltipContent>{label}</TooltipContent></Tooltip>
}
export function MoreLink({ href, children }) {
  const prof = useProfile()
  return <Button variant="link" size="sm" className="h-auto px-0" asChild><a href={href}>{children}</a></Button>
}

/* Section card: icon + title, a muted count line, optional action (open button), then content. */
export function Section({ icon: Ic, title, desc, action, children, footer, className = '', contentClass = '' }: any) {
  return <Card className={cn('z-sec h-full', className)}>
    <CardHeader><CardTitle className="flex items-center gap-2">{Ic ? <Ic className="size-4 text-muted-foreground" /> : null}{title}</CardTitle>{desc ? <CardDescription>{desc}</CardDescription> : null}{action ? <CardAction className="flex items-center gap-2">{action}</CardAction> : null}</CardHeader>
    <CardContent className={cn('flex-1', contentClass)}>{children}</CardContent>
    {footer ? <CardFooter>{footer}</CardFooter> : null}
  </Card>
}

/* Stat card. Styles from the 'Stat tiles' setting: default (shadcn dashboard), compact, icon, centred. */
export function Stat({ label, value, sub, icon: Ic, tone, href, style = 'default' }: any) {
  const prof = useProfile()
  const v = <span className={cn('z-stat-v font-semibold tabular-nums tracking-tight', style === 'compact' ? 'text-xl' : 'text-2xl @[250px]/card:text-3xl', tone === 'warn' && 'text-amber-700 dark:text-amber-400')}>{value}</span>
  let body
  if (style === 'icon') body = <CardContent className="flex items-center gap-4">{Ic ? <span className="z-stat-ic grid size-11 shrink-0 place-items-center rounded-lg bg-muted"><Ic className="size-5" /></span> : null}<div className="min-w-0"><div className="text-sm text-muted-foreground">{label}</div>{v}<div className="truncate text-xs text-muted-foreground">{sub || '\u00a0'}</div></div></CardContent>
  else if (style === 'centred') body = <CardContent className="grid justify-items-center gap-1 text-center">{Ic ? <Ic className="z-stat-ic size-5 text-muted-foreground" /> : null}<div className="text-sm text-muted-foreground">{label}</div>{v}<div className="text-xs text-muted-foreground">{sub || '\u00a0'}</div></CardContent>
  else body = <><CardHeader><CardDescription>{label}</CardDescription><CardTitle>{v}</CardTitle>{Ic ? <CardAction className="z-stat-ic"><Ic className="size-4 text-muted-foreground" /></CardAction> : null}</CardHeader>
    {style === 'compact' ? <CardContent><div className="truncate text-xs text-muted-foreground">{sub || '\u00a0'}</div></CardContent> : <CardFooter className="text-sm text-muted-foreground"><span className="truncate">{sub || '\u00a0'}</span></CardFooter>}</>
  const card = <Card size={style === 'compact' ? 'sm' : 'default'} className={cn('@container/card h-full', href && 'transition-colors hover:bg-accent/50')}>{body}</Card>
  return href ? <a href={href} className="block h-full">{card}</a> : card
}

/* Filings table (consultation 2, item 8): the whole row opens the document (viewUrl, new tab) when CH has one; a separate
   download button (doesn't trigger the row). Settings: button size/style, page count position, type code column. */
export function FilingTable({ items }) {
  const [tw] = useTweaks()
  const size = { xs: 'icon-xs', sm: 'icon-sm', md: 'icon' }[tw.fBtnSize] || 'icon-sm'
  const variant = tw.fBtnStyle === 'ghost' ? 'ghost' : tw.fBtnStyle === 'soft' ? 'secondary' : 'outline'
  const open = (it) => it.viewUrl && window.open(it.viewUrl, '_blank', 'noopener')
  return <div className="z-ftable"><Table><TableHeader><TableRow><TableHead className="w-28">Date</TableHead><TableHead className="z-ftype hidden w-24 sm:table-cell">Type</TableHead><TableHead>Description</TableHead><TableHead className="w-24 text-right"><span className="sr-only">PDF</span></TableHead></TableRow></TableHeader>
    <TableBody>{items.map((it, i) => {
      const title = it.strong && it.title.startsWith(it.strong) ? <><span className="font-medium">{it.strong}</span>{it.title.slice(it.strong.length)}</> : it.title
      const pages = it.pages ? it.pages + (it.pages === 1 ? ' page' : ' pages') : ''
      const link = !!it.viewUrl
      const rowProps = link ? { className: 'z-frow', tabIndex: 0, role: 'link', 'aria-label': 'Open ' + it.title + ' (new tab)', onClick: () => open(it), onKeyDown: (e) => { if (e.key === 'Enter') { e.preventDefault(); open(it) } } } : {}
      const btn = it.pdfUrl ? <Button variant={variant} size={tw.fBtnStyle === 'pdf' ? 'xs' : size} asChild className={tw.fBtnStyle === 'pdf' ? 'gap-1 px-1.5' : ''}><a href={it.pdfUrl} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} title={'Download the PDF' + (pages ? ' (' + pages + ')' : '')} aria-label={'Download the PDF: ' + it.title}><Download />{tw.fBtnStyle === 'pdf' ? 'PDF' : null}</a></Button> : null
      return <TableRow key={i} {...rowProps}><TableCell className="tabular-nums text-muted-foreground">{it.date}</TableCell><TableCell className="z-ftype hidden font-mono text-xs sm:table-cell" title={it.categoryLabel}>{it.typeCode}</TableCell>
        <TableCell className="whitespace-normal"><span className="z-ftitle" title={tw.fType === 'hidden' ? it.typeCode + ' · ' + it.categoryLabel : undefined}>{title}</span>{tw.fPages === 'under' && pages ? <div className="text-xs text-muted-foreground">{pages}</div> : null}</TableCell>
        <TableCell className="text-right"><span className="inline-flex items-center gap-2">{tw.fPages === 'beside' ? <span className="hidden text-xs text-muted-foreground sm:inline">{pages}</span> : null}{btn}</span></TableCell></TableRow>
    })}</TableBody></Table></div>
}

export function Pager({ page, pages, total, from, to, href }) {
  return <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-sm text-muted-foreground"><span>{total ? `Showing ${from.toLocaleString('en-GB')}–${to.toLocaleString('en-GB')} of ${total.toLocaleString('en-GB')}` : ''}</span>
    <span className="flex gap-2">{page > 1 ? <Button variant="outline" size="sm" asChild><a href={href(page - 1)}>Previous</a></Button> : <Button variant="outline" size="sm" disabled>Previous</Button>}
      {page < pages ? <Button variant="outline" size="sm" asChild><a href={href(page + 1)}>Next</a></Button> : <Button variant="outline" size="sm" disabled>Next</Button>}</span></div>
}
export const Rows = ({ n = 5 }) => <div className="grid gap-3">{Array.from({ length: n }, (_, i) => <div key={i} className="flex items-center gap-3"><Skeleton className="size-8 rounded-full" /><div className="grid flex-1 gap-1.5"><Skeleton className="h-4 w-2/5" /><Skeleton className="h-3 w-3/5" /></div></div>)}</div>
/* Profile skeleton matched to the real layout (consultation 2 §6): header card, stat cards at their real 122px, then the
   tiles in the current Dashboard layout order at typical heights. Pulse only (or static, setting). */
const Ph = ({ h, cls = '', children = null }: any) => <Card className={cls} style={{ minHeight: h }}><CardContent className="grid content-start gap-3"><Skeleton className="h-4 w-32" />{h < 100 ? null : children || <Rows n={Math.max(1, Math.round((h - 80) / 48))} />}</CardContent></Card>
export const ProfileSkeleton = ({ layout = 'C' }: any) => <div className="z-stack" role="status" aria-label="Loading">
  <Card><CardContent className="grid gap-3"><Skeleton className="h-4 w-16" /><Skeleton className="h-8 w-80 max-w-full" /><Skeleton className="h-4 w-[28rem] max-w-full" /><Skeleton className="h-4 w-96 max-w-full" /><div className="flex gap-2"><Skeleton className="h-8 w-56" /><Skeleton className="h-8 w-40" /></div></CardContent></Card>
  <div className="bento">{[0, 1, 2, 3].map((i) => <Card key={i} className="s3" style={{ height: 122 }}><CardContent className="grid gap-2"><Skeleton className="h-4 w-20" /><Skeleton className="h-7 w-24" /><Skeleton className="h-3 w-28" /></CardContent></Card>)}
    <Ph cls="s4" h={360} /><Ph cls="s8" h={360} />
    {layout === 'classic' ? <><Ph cls="s5" h={220} /><Ph cls="s7" h={220} /><Ph cls="s5" h={300} /><Ph cls="s7" h={300} /></>
      : layout === 'A' ? <><Ph cls="s5" h={380} /><Ph cls="s7" h={380} /><Ph cls="s12" h={64} /></>
      : <><Ph cls="s12" h={180} /><Ph cls="s12" h={300} /><Ph cls="s12" h={64} /></>}
    <Ph cls="s12" h={330} /></div></div>
export function ErrorCard({ e }) {
  const msg = e && e.message ? e.message : String(e)
  return <Card><CardContent className="flex items-start gap-3"><CircleAlert className="mt-0.5 size-5 text-destructive" /><div className="grid gap-2"><p className="font-medium">{msg}</p>{e && (e.code === 'nokey' || e.code === '401') ? <Button size="sm" asChild className="w-fit"><a href="#/settings">Open Settings</a></Button> : null}</div></CardContent></Card>
}
/* Back link (global, above every page). One level: "Back to X". Trail (setting): up to three earlier pages, oldest first. */
export function BackBar({ routeKey }) {
  const items = backItems(routeKey)
  if (!items.length) return null
  if (items.length === 1) return <Button variant="ghost" size="sm" className="back-btn -mb-1 -ml-2 w-fit text-muted-foreground" onClick={() => goBackTo(items[0], 1)}><ArrowLeft />Back to {items[0].name}</Button>
  return <nav aria-label="Back trail" className="-mb-1 flex min-w-0 flex-wrap items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="size-4 shrink-0" />{items.map((x, i) => <Fragment key={i}>{i ? <ChevronRight className="size-3.5 shrink-0 opacity-60" /> : null}<button type="button" className="max-w-56 truncate rounded px-1 py-0.5 hover:bg-accent hover:text-foreground" onClick={() => goBackTo(x, items.length - i)}>{x.name}</button></Fragment>)}</nav>
}
export const PageHead = ({ title, desc, action }: any) => <div className="flex flex-wrap items-end justify-between gap-3"><div className="grid gap-1"><h1 className="text-2xl font-semibold tracking-tight">{title}</h1>{desc ? <div className="text-sm text-muted-foreground">{desc}</div> : null}</div>{action}</div>
