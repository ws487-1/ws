// @ts-nocheck
import { createContext, useContext, useState, type ReactNode } from 'react'
import { ArrowUpRight, Building2, CircleUserRound, UserRound, User, CalendarClock, UsersRound, ChartPie, Landmark, ArrowLeftRight, ChartColumn, FileText, ShieldAlert, Briefcase, Calendar, Users, Archive, Hourglass, Timer, Download, Check, ArrowLeft, Loader2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { rememberBack } from '@/lib/store'

/* Profile context: open buttons on a company or person profile remember it, so the expanded view can link back. */
export const ProfileCtx = createContext<{ here: string; name: string } | null>(null)
export const useProfile = () => useContext(ProfileCtx)

export const initials = (n) => String(n || '?').replace(/^(Mr|Mrs|Ms|Miss|Dr|Sir|Dame|Lord|Lady)\.?\s+/i, '').split(/\s+/).filter(Boolean).map((w) => w[0]).filter((c) => /[A-Za-z0-9]/.test(c)).slice(0, 2).join('').toUpperCase() || '?'
/* Six Zuli-blue shades, picked by a hash of the name so a person keeps the same one. */
const tint = (n) => { let h = 0; for (const c of String(n || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0; return 'b' + (h % 6 + 1) }
export const Avatar = ({ name }) => <span className={'av ' + tint(name)} aria-hidden="true">{initials(name)}</span>

/* Company / person marker in Zuli blue. The person marker carries every option; <html data-picon> picks one (CSS). */
export function KindIcon({ kind, name, label, lg }: { kind: string; name?: string; label?: string; lg?: boolean }) {
  const cls = 'kic' + (lg ? ' lg' : '')
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true }
  if (kind !== 'person') return <span className={cls + ' company'} {...a11y}><Building2 strokeWidth={1.75} /></span>
  return <span className={cls + ' person' + (name ? '' : ' no-ini')} {...a11y}>
    <CircleUserRound className="pv pv-circle" strokeWidth={1.75} /><UserRound className="pv pv-round" strokeWidth={1.75} /><User className="pv pv-user" strokeWidth={1.75} />
    {name ? <b className="pv pv-ini">{initials(name)}</b> : null}
  </span>
}

/* Click-to-copy value with a brief highlight. */
export function Cp({ v, children }: { v: string; children?: ReactNode }) {
  const [c, setC] = useState(false)
  if (!v) return <>{children}</>
  const copy = () => { navigator.clipboard?.writeText(v).then(() => { setC(true); setTimeout(() => setC(false), 1200) }, () => {}) }
  return <span className={'cp' + (c ? ' copied' : '')} role="button" tabIndex={0} title="Click to copy" onClick={copy} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); copy() } }}>{children ?? v}</span>
}
export const St = ({ label, colour }) => <span className={'st ' + (colour || 'grey')}>{label}</span>

const TI = { Deadlines: CalendarClock, People: UsersRound, Directors: UsersRound, Officers: UsersRound, Members: UsersRound, Partners: UsersRound, Ownership: ChartPie, Charges: Landmark, 'Officer changes': ArrowLeftRight, 'Board activity': ChartColumn, 'Appointments by year': ChartColumn, 'Appointment history': ChartColumn, 'Filing history': FileText, 'Similar companies': Building2, 'UK establishments': Building2, Insolvency: ShieldAlert, Appointments: Briefcase, 'Companies this person controls': ChartPie, 'Disqualified director': ShieldAlert, 'Owner details only': ChartPie, Details: UserRound, 'Recently viewed': null, Saved: null }

/* Square Zuli-blue open button (arrow-up-right). On a profile it remembers the profile for the back button. */
export function OpenBtn({ href, label, span }: { href?: string; label?: string; span?: boolean }) {
  const prof = useProfile()
  if (span) return <span className="tile-open" aria-hidden="true"><ArrowUpRight /></span>
  return <a className="tile-open" href={href} aria-label={label} onClick={() => prof && rememberBack(href, prof.here, prof.name)}><ArrowUpRight /></a>
}
export function TileHead({ title, count, aside, open, icon }: { title: string; count?: ReactNode; aside?: ReactNode; open?: { href: string; label?: string } | { span: true }; icon?: any }) {
  const Ic = icon || TI[title]
  return <div className="tile-head"><h3>{Ic ? <span className="ti" aria-hidden="true"><Ic strokeWidth={2} /></span> : null}<span className="truncate">{title}</span>{count != null && count !== '' ? <span className="count">{count}</span> : null}</h3>
    {aside || open ? <span className="aside">{aside}{open ? ('span' in open ? <OpenBtn span /> : <OpenBtn href={open.href} label={open.label || 'Open ' + title} />) : null}</span> : null}</div>
}
/* Tile = shadcn Card with Zuli padding, radius and shadow. */
export function Tile({ className = '', children, href, onClick }: { className?: string; children: ReactNode; href?: string; onClick?: () => void }) {
  if (href) return <a href={href} onClick={onClick} className={'z-link ' + className}><Card className="z-card h-full">{children}</Card></a>
  return <Card className={'z-card ' + className}>{children}</Card>
}

const FACT_ICON = { age: Calendar, directors: Users, owners: ChartPie, charges: Landmark, Appointments: Briefcase, 'Dissolved or in liquidation': Archive, 'Longest role': Hourglass, 'Average tenure': Timer }
/* Stat tile: one of the figure boxes under an overview. Layout variants are CSS (html data-ststyle / data-stpos). */
export function StatTile({ f, href }: { f: any; href?: string }) {
  const prof = useProfile()
  if (!f) return null
  const Ic = FACT_ICON[f.key] || FACT_ICON[f.label]
  const inner = <>{Ic ? <span className="fi" aria-hidden="true"><Ic strokeWidth={1.75} /></span> : null}<div className="eyebrow">{f.label}</div><div className="v num">{f.value}</div><div className="s">{f.sub || '\u00a0'}</div></>
  return href ? <a className={'fact ' + (f.tone || '')} href={href} onClick={() => prof && rememberBack(href, prof.here, prof.name)}>{inner}</a> : <div className={'fact ' + (f.tone || '')}>{inner}</div>
}

/* One filing row: date, form type, description, 'N pages' and a thin download button. */
export function FilingRow({ it }) {
  const title = it.strong && it.title.startsWith(it.strong) ? <><b>{it.strong}</b>{it.title.slice(it.strong.length)}</> : it.title
  const pages = it.pages ? it.pages + (it.pages === 1 ? ' page' : ' pages') : ''
  return <div className="fl-row"><span className="dt num">{it.date}</span><span className="ty" title={it.categoryLabel}>{it.typeCode}</span><span className="ds">{title}</span>
    <span className="pdf">{pages ? <span className="pg">{pages}</span> : null}{it.pdfUrl ? <a className="dl-btn" href={it.pdfUrl} target="_blank" rel="noopener" title={'Download the PDF' + (pages ? ' (' + pages + ')' : '')} aria-label={'Download the PDF: ' + it.title}><Download /></a> : null}</span></div>
}
export const IdV = ({ on }) => (on ? <span className="idv"><Check strokeWidth={3} />ID verified</span> : null)

export function Pager({ page, pages, total, from, to, href }) {
  return <div className="pager"><span>{total ? `Showing ${from.toLocaleString('en-GB')}–${to.toLocaleString('en-GB')} of ${total.toLocaleString('en-GB')}` : ''}</span>
    <span className="flex gap-1.5">{page > 1 ? <Button variant="outline" size="sm" asChild><a href={href(page - 1)}>Previous</a></Button> : <Button variant="outline" size="sm" disabled>Previous</Button>}
      {page < pages ? <Button variant="outline" size="sm" asChild><a href={href(page + 1)}>Next</a></Button> : <Button variant="outline" size="sm" disabled>Next</Button>}</span></div>
}
export const Loading = ({ t }: { t?: string }) => <div className="flex items-center gap-2 py-6 text-[13px] text-(--ink-500)" role="status"><Loader2 className="size-4 animate-spin" />{t || 'Loading…'}</div>
export function ErrorBox({ e }) {
  const msg = e && e.message ? e.message : String(e)
  return <div><div className="err">{msg}</div>{e && (e.code === 'nokey' || e.code === '401') ? <div className="mt-2 text-[13px]"><a className="lnk" href="#/settings">Open Settings</a></div> : null}</div>
}
export function BackBtn({ b }) { return b ? <a className="back-btn" href={'#' + b.from}><ArrowLeft /><span>Back to {b.name || 'profile'}</span></a> : null }
