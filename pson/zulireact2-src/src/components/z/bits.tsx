// @ts-nocheck
import { createContext, useContext, useState, type ReactNode } from 'react'
import { ArrowUpRight, ArrowLeft, Building2, Download, BadgeCheck, CircleAlert } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { rememberBack } from '@/lib/store'
import { cn } from '@/lib/utils'

/* Profile context: open buttons on a profile remember it so the expanded view shows "Back to …". */
export const ProfileCtx = createContext<{ here: string; name: string } | null>(null)
export const useProfile = () => useContext(ProfileCtx)

export const initials = (n) => String(n || '?').replace(/^(Mr|Mrs|Ms|Miss|Dr|Sir|Dame|Lord|Lady)\.?\s+/i, '').split(/\s+/).filter(Boolean).map((w) => w[0]).filter((c) => /[A-Za-z0-9]/.test(c)).slice(0, 2).join('').toUpperCase() || '?'
const tint = (n) => { let h = 0; for (const c of String(n || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0; return 'b' + (h % 6 + 1) }
/* Initials in a shadcn Avatar; colours come from the 'Initials' setting (CSS). */
export const Ini = ({ name, className = '' }) => <Avatar className={cn('size-8', className)} aria-hidden="true"><AvatarFallback className={'ini ' + tint(name)}>{initials(name)}</AvatarFallback></Avatar>
/* Company marker: the building icon in a muted rounded square, same footprint as an Avatar. */
export const CoMark = ({ className = '' }) => <span className={cn('grid size-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground', className)} aria-hidden="true"><Building2 className="size-4" /></span>
export const Mark = ({ kind, name, className = '' }) => (kind === 'company' ? <CoMark className={className} /> : <Ini name={name} className={className} />)

export function Cp({ v, children }: { v: string; children?: ReactNode }) {
  const [c, setC] = useState(false)
  if (!v) return <>{children}</>
  const copy = () => { navigator.clipboard?.writeText(v).then(() => { setC(true); setTimeout(() => setC(false), 1200) }, () => {}) }
  return <span className={'cp' + (c ? ' copied' : '')} role="button" tabIndex={0} title={c ? 'Copied' : 'Click to copy'} onClick={copy} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); copy() } }}>{children ?? v}</span>
}
export const St = ({ label, colour }) => (label ? <span className={'st ' + (colour || 'grey')}>{label}</span> : null)
export const IdV = ({ on, title }: any) => (on ? <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: 'var(--ok)' }} title={title}><BadgeCheck className="size-3.5" />ID verified</span> : null)
export const Muted = ({ children, className = '' }) => <p className={cn('text-sm text-muted-foreground', className)}>{children}</p>
export const Note = ({ children }) => <p className="text-xs text-muted-foreground">{children}</p>

/* Square outline "open" button (arrow-up-right); on a profile it remembers the profile for the back button. */
export function OpenBtn({ href, label }) {
  const prof = useProfile()
  return <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon-sm" asChild><a href={href} aria-label={label} onClick={() => prof && rememberBack(href, prof.here, prof.name)}><ArrowUpRight /></a></Button></TooltipTrigger><TooltipContent>{label}</TooltipContent></Tooltip>
}
export function MoreLink({ href, children }) {
  const prof = useProfile()
  return <Button variant="link" size="sm" className="h-auto px-0" asChild><a href={href} onClick={() => prof && rememberBack(href, prof.here, prof.name)}>{children}</a></Button>
}

/* Section card: icon + title, a muted count line, optional action (open button), then content. */
export function Section({ icon: Ic, title, desc, action, children, footer, className = '', contentClass = '' }: any) {
  return <Card className={cn('h-full', className)}>
    <CardHeader><CardTitle className="flex items-center gap-2">{Ic ? <Ic className="size-4 text-muted-foreground" /> : null}{title}</CardTitle>{desc ? <CardDescription>{desc}</CardDescription> : null}{action ? <CardAction className="flex items-center gap-2">{action}</CardAction> : null}</CardHeader>
    <CardContent className={cn('flex-1', contentClass)}>{children}</CardContent>
    {footer ? <CardFooter>{footer}</CardFooter> : null}
  </Card>
}

/* Stat card. Styles from the 'Stat tiles' setting: default (shadcn dashboard), compact, icon, centred. */
export function Stat({ label, value, sub, icon: Ic, tone, href, style = 'default' }: any) {
  const prof = useProfile()
  const v = <span className={cn('font-semibold tabular-nums tracking-tight', style === 'compact' ? 'text-xl' : 'text-2xl @[250px]/card:text-3xl', tone === 'warn' && 'text-amber-700 dark:text-amber-400')}>{value}</span>
  let body
  if (style === 'icon') body = <CardContent className="flex items-center gap-4">{Ic ? <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-muted"><Ic className="size-5" /></span> : null}<div className="min-w-0"><div className="text-sm text-muted-foreground">{label}</div>{v}<div className="truncate text-xs text-muted-foreground">{sub || '\u00a0'}</div></div></CardContent>
  else if (style === 'centred') body = <CardContent className="grid justify-items-center gap-1 text-center">{Ic ? <Ic className="size-5 text-muted-foreground" /> : null}<div className="text-sm text-muted-foreground">{label}</div>{v}<div className="text-xs text-muted-foreground">{sub || '\u00a0'}</div></CardContent>
  else body = <><CardHeader><CardDescription>{label}</CardDescription><CardTitle>{v}</CardTitle>{Ic ? <CardAction><Ic className="size-4 text-muted-foreground" /></CardAction> : null}</CardHeader>
    {style === 'compact' ? <CardContent><div className="truncate text-xs text-muted-foreground">{sub || '\u00a0'}</div></CardContent> : <CardFooter className="text-sm text-muted-foreground"><span className="truncate">{sub || '\u00a0'}</span></CardFooter>}</>
  const card = <Card size={style === 'compact' ? 'sm' : 'default'} className={cn('@container/card h-full', href && 'transition-colors hover:bg-accent/50')}>{body}</Card>
  return href ? <a href={href} className="block h-full" onClick={() => prof && rememberBack(href, prof.here, prof.name)}>{card}</a> : card
}

/* Filings as a shadcn Table: date, form type, description, pages and a download button. */
export function FilingTable({ items }) {
  return <Table><TableHeader><TableRow><TableHead className="w-28">Date</TableHead><TableHead className="hidden w-24 sm:table-cell">Type</TableHead><TableHead>Description</TableHead><TableHead className="w-24 text-right"><span className="sr-only">PDF</span></TableHead></TableRow></TableHeader>
    <TableBody>{items.map((it, i) => {
      const title = it.strong && it.title.startsWith(it.strong) ? <><span className="font-medium">{it.strong}</span>{it.title.slice(it.strong.length)}</> : it.title
      const pages = it.pages ? it.pages + (it.pages === 1 ? ' page' : ' pages') : ''
      return <TableRow key={i}><TableCell className="align-top tabular-nums text-muted-foreground">{it.date}</TableCell><TableCell className="hidden align-top font-mono text-xs sm:table-cell" title={it.categoryLabel}>{it.typeCode}</TableCell>
        <TableCell className="whitespace-normal">{title}</TableCell>
        <TableCell className="text-right align-top"><span className="inline-flex items-center gap-2"><span className="hidden text-xs text-muted-foreground sm:inline">{pages}</span>{it.pdfUrl ? <Button variant="ghost" size="icon-xs" asChild><a href={it.pdfUrl} target="_blank" rel="noopener" title={'Download the PDF' + (pages ? ' (' + pages + ')' : '')} aria-label={'Download the PDF: ' + it.title}><Download /></a></Button> : null}</span></TableCell></TableRow>
    })}</TableBody></Table>
}

export function Pager({ page, pages, total, from, to, href }) {
  return <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-sm text-muted-foreground"><span>{total ? `Showing ${from.toLocaleString('en-GB')}–${to.toLocaleString('en-GB')} of ${total.toLocaleString('en-GB')}` : ''}</span>
    <span className="flex gap-2">{page > 1 ? <Button variant="outline" size="sm" asChild><a href={href(page - 1)}>Previous</a></Button> : <Button variant="outline" size="sm" disabled>Previous</Button>}
      {page < pages ? <Button variant="outline" size="sm" asChild><a href={href(page + 1)}>Next</a></Button> : <Button variant="outline" size="sm" disabled>Next</Button>}</span></div>
}
export const Rows = ({ n = 5 }) => <div className="grid gap-3">{Array.from({ length: n }, (_, i) => <div key={i} className="flex items-center gap-3"><Skeleton className="size-8 rounded-full" /><div className="grid flex-1 gap-1.5"><Skeleton className="h-4 w-2/5" /><Skeleton className="h-3 w-3/5" /></div></div>)}</div>
/* Profile skeleton: header, four stats and two section cards. */
export const ProfileSkeleton = () => <div className="z-stack" role="status" aria-label="Loading"><Card><CardContent className="grid gap-3"><Skeleton className="h-4 w-16" /><Skeleton className="h-8 w-72 max-w-full" /><Skeleton className="h-4 w-96 max-w-full" /></CardContent></Card>
  <div className="bento">{[0, 1, 2, 3].map((i) => <Card key={i} className="s3"><CardContent className="grid gap-2"><Skeleton className="h-4 w-20" /><Skeleton className="h-7 w-24" /><Skeleton className="h-3 w-28" /></CardContent></Card>)}
    <Card className="s4"><CardContent><Rows n={4} /></CardContent></Card><Card className="s8"><CardContent><Rows n={5} /></CardContent></Card></div></div>
export function ErrorCard({ e }) {
  const msg = e && e.message ? e.message : String(e)
  return <Card><CardContent className="flex items-start gap-3"><CircleAlert className="mt-0.5 size-5 text-destructive" /><div className="grid gap-2"><p className="font-medium">{msg}</p>{e && (e.code === 'nokey' || e.code === '401') ? <Button size="sm" asChild className="w-fit"><a href="#/settings">Open Settings</a></Button> : null}</div></CardContent></Card>
}
export function BackBtn({ b }) { return b ? <Button variant="ghost" size="sm" className="back-btn -ml-2 w-fit text-muted-foreground" asChild><a href={"#" + b.from}><ArrowLeft />Back to {b.name || 'profile'}</a></Button> : null }
export const PageHead = ({ title, desc, action }: any) => <div className="flex flex-wrap items-end justify-between gap-3"><div className="grid gap-1"><h1 className="text-2xl font-semibold tracking-tight">{title}</h1>{desc ? <div className="text-sm text-muted-foreground">{desc}</div> : null}</div>{action}</div>
