// @ts-nocheck
import { useEffect, useState } from 'react'
import { House, Bookmark, Bell, Settings, Search, SlidersHorizontal, CircleHelp, CircleUserRound, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useRoute, go, withParams } from '@/lib/router'
import { clearBackUnless } from '@/lib/store'
import { FiltersCtx, FiltersSheet } from '@/components/z/filters'
import { XpPanel } from '@/components/z/xp'
import { Home } from '@/pages/Home'
import { SearchPage } from '@/pages/Search'
import { CompanyPage } from '@/pages/Company'
import { OfficersPage } from '@/pages/Officers'
import { FilingsPage } from '@/pages/Filings'
import { PersonPage } from '@/pages/Person'
import { SavedPage, AlertsPage, SettingsPage } from '@/pages/Misc'

const LOGO = import.meta.env.BASE_URL + 'zuli-logo.png'
const NAV = [['home', '#/', 'Home', House], ['saved', '#/saved', 'Saved', Bookmark], ['alerts', '#/alerts', 'Alerts', Bell], ['settings', '#/settings', 'Settings', Settings]]

function Nav({ active, onPick }: { active: string; onPick?: () => void }) {
  return <nav className="z-nav" aria-label="Main">{NAV.map(([k, h, l, Ic]: any) => <a key={k} href={h} className={active === k ? 'on' : ''} aria-current={active === k ? 'page' : undefined} onClick={onPick}><Ic strokeWidth={1.9} />{l}</a>)}</nav>
}

function TopSearch({ route, openFilters }) {
  const cur = route.path === '/search' && !route.q.get('mode') ? route.q.get('q') || '' : ''
  const [q, setQ] = useState(cur)
  useEffect(() => setQ(cur), [cur])
  const type = route.path === '/search' && !route.q.get('mode') ? route.q.get('type') || '' : ''
  return <form className="z-search" role="search" onSubmit={(e) => { e.preventDefault(); const v = q.trim(); if (v) go(withParams('/search', { q: v, type })) }}>
    <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search companies, people or numbers" aria-label="Search Companies House" />
    <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" type="button" onClick={openFilters} aria-label="More filters"><SlidersHorizontal /></Button></TooltipTrigger><TooltipContent>More filters</TooltipContent></Tooltip>
    <Button type="submit"><Search />Search</Button>
  </form>
}

export default function App() {
  const route = useRoute()
  const [fOpen, setFOpen] = useState(false)
  const [menu, setMenu] = useState(false)
  const [fKey, setFKey] = useState(0)
  const p = route.parts
  const active = route.path === '/' ? 'home' : ['saved', 'alerts', 'settings'].includes(p[0]) ? p[0] : ''
  useEffect(() => { clearBackUnless(route.key); window.scrollTo(0, 0); setFOpen(false); setMenu(false) }, [route.key])
  const openFilters = () => { setFKey((k) => k + 1); setFOpen(true) }
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
  else page = <div className="panel plain-msg">Page not found. <a className="lnk" href="#/">Home</a></div>
  return <FiltersCtx.Provider value={{ open: openFilters }}>
    <div className={'z-app' + (active === 'home' ? ' z-hide-home' : '')}>
      <aside className="z-side"><a className="z-logo" href="#/" aria-label="Zuli home"><img src={LOGO} alt="Zuli" /></a><Nav active={active} /></aside>
      <header className="z-top">
        <Button variant="ghost" size="icon" className="z-menu-btn" onClick={() => setMenu(true)} aria-label="Menu"><Menu /></Button>
        <a className="z-mob-logo" href="#/" aria-label="Zuli home"><img src={LOGO} alt="Zuli" /></a>
        <TopSearch route={route} openFilters={openFilters} />
        <div className="z-top-r">
          <Popover><PopoverTrigger asChild><Button variant="outline" size="icon" aria-label="Help"><CircleHelp /></Button></PopoverTrigger>
            <PopoverContent align="end" className="w-72 rounded-(--r-card) p-3.5 text-[13px] leading-normal text-(--ink-700)"><h2 className="mb-1.5 text-[14px] font-semibold text-(--ink-900)">Using Zuli</h2>
              <p className="mb-1.5">Search by company name or number, or a person's name. Paste a Companies House link or officer ID to jump straight there.</p>
              <p className="mb-1.5">Click any underlined-on-hover value to copy it. Use the filter button for status, location, industry and dates.</p>
              <p>Zuli needs your Companies House API key: <a className="lnk" href="#/settings">Settings</a>.</p></PopoverContent></Popover>
          <Popover><PopoverTrigger asChild><Button variant="outline" size="icon" aria-label="Account and experimental settings" id="acctBtn"><CircleUserRound /></Button></PopoverTrigger>
            <PopoverContent align="end" className="z-xp max-h-[calc(100dvh-64px)] w-[min(380px,calc(100vw-20px))] overflow-y-auto rounded-(--r-card) p-0" id="acctPop"><XpPanel /></PopoverContent></Popover>
        </div>
      </header>
      <main className="z-main" id="main">{page}</main>
    </div>
    <Sheet open={menu} onOpenChange={setMenu}><SheetContent side="left" className="w-[240px] bg-(--page) p-3.5"><SheetTitle className="z-logo mt-1"><img src={LOGO} alt="Zuli" /></SheetTitle><SheetDescription className="sr-only">Main navigation</SheetDescription><Nav active={active} onPick={() => setMenu(false)} /></SheetContent></Sheet>
    <FiltersSheet key={fKey + route.key} open={fOpen} onOpenChange={setFOpen} route={route} />
  </FiltersCtx.Provider>
}
