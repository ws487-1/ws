// @ts-nocheck
import { Fragment, Suspense, lazy, useEffect, useLayoutEffect, useState } from 'react'
import { House, Search, Bookmark, Bell, Settings, SlidersHorizontal, CircleHelp, Menu, Palette, Moon, Sun, Clock, Building2, UserRound, ChevronsUpDown, KeyRound, FileDown, LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb'
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarRail, SidebarTrigger, useSidebar } from '@/components/ui/sidebar'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import { useRoute } from '@/lib/router'
import { chKey, viewedList, viewHref } from '@/lib/store'
import { install as installNav, onRoute, restoreScroll } from '@/lib/nav'
import { BackBar } from '@/components/z/bits'
import { Toaster } from '@/components/ui/sonner'
import { useCrumbTrail } from '@/lib/crumbs'
import { useTweaks, getTweaks } from '@/lib/tweaks'
import { makeReport } from '@/components/z/report'
import { note } from '@/lib/toast'
import { FiltersCtx, FiltersSheet } from '@/components/z/filters'
import { CommandPalette } from '@/components/z/command'
import { XpSheet } from '@/components/z/xp'
import { ModK } from '@/pages/Home'
import { Home } from '@/pages/Home'
import { SearchPage } from '@/pages/Search'
import { CompanyPage } from '@/pages/Company'
import { OfficersPage } from '@/pages/Officers'
import { FilingsPage } from '@/pages/Filings'
import { PersonPage } from '@/pages/Person'
import { SavedPage, AlertsPage, SettingsPage } from '@/pages/Misc'
const PdfPage = lazy(() => import('@/pages/Pdf')) // react-pdf stays in its own chunk

const BASE = import.meta.env.BASE_URL
/* Logo: 'new' = concept 03 (ink letters, bright blue dot #3a7ff0; dark mode swaps to the light-letter SVG with the #7fa9f0
   dot). 'ink' / 'colour' = the old PNG (monochrome via CSS filter, or the original artwork). */
function Logo({ className = '' }) {
  const [tw] = useTweaks()
  if (tw.logo !== 'new') return <img src={BASE + 'zuli-logo.png'} alt="Zuli" className={cn('z-logo h-6 w-auto', className)} />
  return <span className={cn('inline-flex', className)}><img src={BASE + 'zuli-logo-03.svg'} alt="Zuli" className="z-logo-l h-[22px] w-auto" /><img src={BASE + 'zuli-logo-03-dark.svg'} alt="Zuli" className="z-logo-d h-[22px] w-auto" /></span>
}
const NAV = [['home', '#/', 'Home', House], ['search', '#/search', 'Search', Search], ['saved', '#/saved', 'Saved', Bookmark], ['alerts', '#/alerts', 'Alerts', Bell], ['settings', '#/settings', 'Settings', Settings]]

/* Account menu: the experimental settings live here, plus quick links and a theme switch. */
function AccountMenu({ openXp, children, side = 'bottom', align = 'end' }) {
  const [tw, set] = useTweaks()
  const dark = document.documentElement.classList.contains('dark')
  return <DropdownMenu><DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
    <DropdownMenuContent side={side} align={align} className="w-60">
      <DropdownMenuLabel className="flex items-center gap-2 font-normal"><Avatar className="size-8 rounded-lg"><AvatarFallback className="rounded-lg">Z</AvatarFallback></Avatar><div className="grid leading-tight"><span className="text-sm font-medium">Zuli</span><span className="text-xs text-muted-foreground">{chKey() ? 'API key saved' : 'No API key'}</span></div></DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuItem onSelect={() => setTimeout(openXp, 0)}><Palette />Experimental settings…</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => set('mode', dark ? 'light' : 'dark')}>{dark ? <Sun /> : <Moon />}{dark ? 'Light mode' : 'Dark mode'}</DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuItem asChild><a href="#/saved"><Bookmark />Saved</a></DropdownMenuItem>
        <DropdownMenuItem asChild><a href="#/settings"><KeyRound />API key</a></DropdownMenuItem>
      </DropdownMenuGroup>
      {tw.kbd === 'on' ? <><DropdownMenuSeparator /><DropdownMenuLabel className="flex items-center justify-between text-xs font-normal text-muted-foreground">Command palette<ModK /></DropdownMenuLabel></> : null}
    </DropdownMenuContent></DropdownMenu>
}

function SearchButton({ onClick, kbd }) {
  return <Button variant="outline" onClick={onClick} className="relative h-8 w-full justify-start gap-2 bg-muted/50 px-2.5 font-normal text-muted-foreground shadow-none sm:w-56 lg:w-72" aria-label="Search (Ctrl K)"><Search /><span className="truncate">Search companies, people…</span>{kbd ? <span className="ml-auto hidden sm:inline-flex"><ModK /></span> : null}</Button>
}

function Crumbs() {
  const trail = useCrumbTrail()
  if (!trail.length) return null
  return <Breadcrumb className="min-w-0"><BreadcrumbList className="flex-nowrap">{trail.map((c, i) => <Fragment key={i}>{i ? <BreadcrumbSeparator className="hidden md:block" /> : null}<BreadcrumbItem className={cn('min-w-0', i < trail.length - 1 && 'hidden md:inline-flex')}>{c.href && i < trail.length - 1 ? <BreadcrumbLink href={c.href} className="truncate">{c.label}</BreadcrumbLink> : <BreadcrumbPage className="max-w-[40vw] truncate md:max-w-80">{c.label}</BreadcrumbPage>}</BreadcrumbItem></Fragment>)}</BreadcrumbList></Breadcrumb>
}

function HeaderTools({ openCmd, openFilters, openXp, tw }) {
  return <div className="ml-auto flex items-center gap-2">
    <div className="hidden sm:block"><SearchButton onClick={openCmd} kbd={tw.kbd === 'on'} /></div>
    <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon-sm" className="sm:hidden" onClick={openCmd} aria-label="Search"><Search /></Button></TooltipTrigger><TooltipContent>Search</TooltipContent></Tooltip>
    <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon-sm" onClick={openFilters} aria-label="Filters"><SlidersHorizontal /></Button></TooltipTrigger><TooltipContent>Filters</TooltipContent></Tooltip>
    <Popover><Tooltip><TooltipTrigger asChild><PopoverTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="Help"><CircleHelp /></Button></PopoverTrigger></TooltipTrigger><TooltipContent>Help</TooltipContent></Tooltip>
      <PopoverContent align="end" className="grid w-72 gap-2 text-sm"><p className="font-medium">Zuli</p><p className="text-muted-foreground">Company and people lookups from Companies House. Search by name or number, or paste a Companies House link.</p><Separator /><div className="flex items-center justify-between text-muted-foreground">Command palette<ModK /></div><Button variant="outline" size="sm" asChild><a href="#/settings"><KeyRound />Set API key</a></Button></PopoverContent></Popover>
    <AccountMenu openXp={openXp}><Button variant="ghost" size="icon-sm" id="acctBtn" aria-label="Account and experimental settings" className="rounded-full"><Avatar className="size-7"><AvatarFallback className="text-xs">Z</AvatarFallback></Avatar></Button></AccountMenu>
  </div>
}

function AppSidebar({ active, tw, openXp, routeKey }) {
  const isMobile = useIsMobile()
  const { setOpenMobile } = useSidebar()
  useEffect(() => setOpenMobile(false), [routeKey])
  const rv = viewedList().slice(0, 5)
  const [co, setCo] = useState(window.__zCompany || null)
  useEffect(() => { const f = () => setCo(window.__zCompany || null); window.addEventListener('zcompany', f); return () => window.removeEventListener('zcompany', f) }, [])
  const [busy, setBusy] = useState(false)
  const report = async () => { if (busy || !co) return; setBusy(true); const t = getTweaks(); const win = t.repOpen === 'tab' ? window.open('', '_blank') : null; try { const r = await makeReport(co.number, t, win); note(t.repOpen === 'tab' ? 'Report opened in a new tab' : 'Report downloaded', { kind: 'success', description: r.name }) } catch (e) { if (win) win.close(); note('Couldn\u2019t build the report', { description: e.message || String(e) }) } finally { setBusy(false) } }
  const coll = tw.collapsible === 'none' && isMobile ? 'offcanvas' : tw.collapsible
  return <Sidebar variant={tw.sidebarVariant} collapsible={coll}>
    <SidebarHeader><SidebarMenu><SidebarMenuItem><SidebarMenuButton size="lg" asChild tooltip="Zuli home"><a href="#/" aria-label="Zuli home">
      {tw.logo === 'new' ? <img src={BASE + 'favicon.svg'} alt="" className="hidden size-8 shrink-0 rounded-lg group-data-[collapsible=icon]:block" /> : <span className="hidden size-8 shrink-0 place-items-center rounded-lg bg-sidebar-primary text-sm font-bold text-sidebar-primary-foreground group-data-[collapsible=icon]:grid">Z</span>}
      <Logo className="group-data-[collapsible=icon]:hidden" /></a></SidebarMenuButton></SidebarMenuItem></SidebarMenu></SidebarHeader>
    <SidebarContent>
      <SidebarGroup><SidebarGroupLabel>Navigate</SidebarGroupLabel><SidebarGroupContent><SidebarMenu>{NAV.map(([k, h, l, Ic]) => <SidebarMenuItem key={k}><SidebarMenuButton asChild isActive={active === k} tooltip={l}><a href={h} aria-current={active === k ? 'page' : undefined}><Ic />{l}</a></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></SidebarGroupContent></SidebarGroup>
      {tw.repPlace === 'sidebar' && co ? <SidebarGroup><SidebarGroupLabel>This company</SidebarGroupLabel><SidebarGroupContent><SidebarMenu><SidebarMenuItem><SidebarMenuButton onClick={report} tooltip="Download report" disabled={busy}>{busy ? <LoaderCircle className="animate-spin" /> : <FileDown />}<span>{busy ? 'Building report…' : 'Download report'}</span></SidebarMenuButton></SidebarMenuItem></SidebarMenu></SidebarGroupContent></SidebarGroup> : null}
      {rv.length ? <SidebarGroup className="group-data-[collapsible=icon]:hidden"><SidebarGroupLabel>Recently viewed</SidebarGroupLabel><SidebarGroupContent><SidebarMenu>{rv.map((r) => <SidebarMenuItem key={viewHref(r)}><SidebarMenuButton size="sm" asChild><a href={viewHref(r)}>{r.type === 'company' ? <Building2 /> : <UserRound />}<span>{r.name}</span></a></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></SidebarGroupContent></SidebarGroup> : null}
    </SidebarContent>
    <SidebarFooter><SidebarMenu><SidebarMenuItem><AccountMenu openXp={openXp} side={isMobile ? 'bottom' : 'right'} align="end">
      <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent" tooltip="Account"><Avatar className="size-8 rounded-lg"><AvatarFallback className="rounded-lg">Z</AvatarFallback></Avatar><div className="grid flex-1 text-left text-sm leading-tight"><span className="truncate font-medium">Zuli</span><span className="truncate text-xs text-muted-foreground">Experimental build</span></div><ChevronsUpDown className="ml-auto" /></SidebarMenuButton>
    </AccountMenu></SidebarMenuItem></SidebarMenu></SidebarFooter>
    {coll !== 'none' ? <SidebarRail /> : null}
  </Sidebar>
}

/* Top-bar-only layout: logo, nav buttons and tools in one header; a sheet holds the nav on phones. */
function TopBar({ active, tools, routeKey }) {
  const [open, setOpen] = useState(false)
  useEffect(() => setOpen(false), [routeKey])
  const nav = (cls) => NAV.map(([k, h, l, Ic]) => <Button key={k} variant={'ghost'} size="sm" asChild className={cls}><a href={h} data-active={active === k} aria-current={active === k ? 'page' : undefined}><Ic />{l}</a></Button>)
  return <header className="z-hdr sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
    <div className="z-content flex h-14 items-center gap-3 px-4 md:px-6">
      <Button variant="ghost" size="icon-sm" className="md:hidden" onClick={() => setOpen(true)} aria-label="Menu"><Menu /></Button>
      <a href="#/" aria-label="Zuli home" className="shrink-0"><Logo /></a>
      <nav className="z-topnav hidden items-center gap-1 md:flex" aria-label="Main">{nav('')}</nav>
      {tools}
    </div>
    <Sheet open={open} onOpenChange={setOpen}><SheetContent side="left" className="w-72"><SheetHeader><SheetTitle><Logo /></SheetTitle><SheetDescription className="sr-only">Main menu</SheetDescription></SheetHeader><nav className="z-topnav grid gap-1 px-4" aria-label="Main">{nav('justify-start')}</nav></SheetContent></Sheet>
  </header>
}

export default function App() {
  const route = useRoute()
  const [tw] = useTweaks()
  const [fOpen, setFOpen] = useState(false), [fKey, setFKey] = useState(0)
  const [cmd, setCmd] = useState(false), [xp, setXp] = useState(false)
  const [sbOpen, setSbOpen] = useState(!tw.startCollapsed)
  useEffect(() => setSbOpen(!tw.startCollapsed), [tw.startCollapsed])
  const p = route.parts
  const active = route.path === '/' ? 'home' : ['search', 'saved', 'alerts', 'settings'].includes(p[0]) ? p[0] : ''
  useLayoutEffect(() => { installNav(); const pop = onRoute(route.key); restoreScroll(route.key, pop); setFOpen(false); setCmd(false) }, [route.key])
  useEffect(() => { const f = (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setCmd((o) => !o) } }; window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f) }, [])
  const openFilters = () => { setFKey((k) => k + 1); setFOpen(true) }
  const openXp = () => setXp(true)
  let page
  if (route.path === '/') page = <Home />
  else if (p[0] === 'search') page = <SearchPage route={route} />
  else if (p[0] === 'company' && p[2] === 'officers') page = <OfficersPage route={route} n={p[1]} />
  else if (p[0] === 'company' && p[2] === 'filings') page = <FilingsPage route={route} n={p[1]} />
  else if (p[0] === 'company') page = <CompanyPage route={route} n={p[1]} />
  else if (p[0] === 'person') page = <PersonPage route={route} />
  else if (p[0] === 'saved') page = <SavedPage />
  else if (p[0] === 'alerts') page = <AlertsPage />
  else if (p[0] === 'settings') page = <SettingsPage />
  else if (p[0] === 'pdf') page = <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}><PdfPage route={route} /></Suspense>
  else page = <p className="text-muted-foreground">Page not found. <a className="underline" href="#/">Home</a></p>
  const tools = <HeaderTools openCmd={() => setCmd(true)} openFilters={openFilters} openXp={openXp} tw={tw} />
  const overlays = <><FiltersSheet key={fKey} open={fOpen} onOpenChange={setFOpen} route={route} /><CommandPalette open={cmd} onOpenChange={setCmd} openFilters={openFilters} openXp={openXp} /><XpSheet open={xp} onOpenChange={setXp} /><Toaster /></>
  const main = <div className="z-content flex flex-1 flex-col gap-[var(--gap)] p-4 md:p-6" key={route.key}><BackBar routeKey={route.key} />{page}</div>
  return <FiltersCtx.Provider value={{ open: openFilters }}>
    {tw.layout === 'topbar' ? <div className="flex min-h-svh flex-col"><TopBar active={active} tools={tools} routeKey={route.key} />
      {tw.breadcrumbs === 'on' ? <div className="z-content w-full px-4 pt-4 md:px-6"><Crumbs /></div> : null}{main}</div> :
      <SidebarProvider open={sbOpen} onOpenChange={setSbOpen} style={{ '--sidebar-width': tw.sidebarWidth + 'rem' }}>
        <AppSidebar active={active} tw={tw} openXp={openXp} routeKey={route.key} />
        <SidebarInset className="min-w-0">
          <header className="z-hdr sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur md:rounded-t-[inherit]">
            <SidebarTrigger className={cn('-ml-1', tw.collapsible === 'none' && 'md:hidden')} />
            {tw.breadcrumbs === 'on' ? <><Separator orientation="vertical" className="mr-1 h-4! self-center!" /><Crumbs /></> : null}
            {tools}
          </header>
          {main}
        </SidebarInset>
      </SidebarProvider>}
    {overlays}
  </FiltersCtx.Provider>
}
