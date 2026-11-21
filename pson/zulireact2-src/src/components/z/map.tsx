// @ts-nocheck
/* Company map (MapLibre GL 6, BSD-3; tiles from OpenFreeMap, free, attribution kept). Lazy-loaded on first open.
   Defaults = the "Zuli blue" variant Will picked: Positron tinted blue, 3D buildings shaded pale → #245091 by height,
   vertical gradient on. Every option comes from the Map group in the experimental settings. No maps on person pages. */
import { useEffect, useRef, useState } from 'react'
import { Map as MapIcon, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useTweaks, reducedMotion } from '@/lib/tweaks'
import { cn } from '@/lib/utils'

const BLUE = '#245091'
const SIZE = { s: 240, m: 320, l: 420 }
const geoCache = {}
export async function geocode(pc) {
  const k = String(pc || '').toUpperCase().replace(/\s+/g, '')
  if (!k) return null
  if (geoCache[k] !== undefined) return geoCache[k]
  try {
    let r = await fetch('https://api.postcodes.io/postcodes/' + k)
    if (r.status === 404) r = await fetch('https://api.postcodes.io/terminated_postcodes/' + k)
    const j = r.ok ? (await r.json()).result : null
    geoCache[k] = j && j.latitude != null ? [j.longitude, j.latitude] : null
  } catch { geoCache[k] = null }
  return geoCache[k]
}
let mlP = null
const loadML = () => (mlP ||= Promise.all([import('maplibre-gl'), import('maplibre-gl/dist/maplibre-gl-worker.mjs?url'), import('maplibre-gl/dist/maplibre-gl.css')]).then(([m, w]) => { const M = m.default || m; try { M.setWorkerUrl(w.default) } catch { /* older API */ } return M }))

function styleUrl(base, dark) {
  const b = base === 'positron' && dark ? 'dark' : base
  return 'https://tiles.openfreemap.org/styles/' + ({ positron: 'positron', bright: 'bright', liberty: 'liberty', dark: 'dark', fiord: 'fiord' }[b] || 'positron')
}
function theme(map, tw, dark) {
  const L = map.getStyle().layers
  const sp = (id, p, v) => { try { map.setPaintProperty(id, p, v) } catch { /* layer lacks prop */ } }
  const hide = (id) => { try { map.setLayoutProperty(id, 'visibility', 'none') } catch { /* ignore */ } }
  for (const l of L) {
    const sl = l['source-layer'] || ''
    if (tw.mapTint === 'accent' && !dark) {
      if (l.id === 'background') sp(l.id, 'background-color', '#eef2f8')
      if (sl === 'water' && l.type === 'fill') sp(l.id, 'fill-color', '#c9d6ea')
      if (l.type === 'line' && sl === 'transportation' && !/casing/.test(l.id)) sp(l.id, 'line-color', '#ffffff')
      if ((sl === 'park' || sl === 'landcover') && l.type === 'fill') sp(l.id, 'fill-color', '#dfe7f2')
      if (l.type === 'symbol') { sp(l.id, 'text-color', '#33507a'); sp(l.id, 'text-halo-color', '#eef2f8') }
    }
    if (tw.mapTint === 'grey') {
      if (l.id === 'background') sp(l.id, 'background-color', dark ? '#1f1f1f' : '#f3f3f3')
      if (sl === 'water' && l.type === 'fill') sp(l.id, 'fill-color', dark ? '#2b2b2b' : '#d9d9d9')
      if ((sl === 'park' || sl === 'landcover' || sl === 'landuse') && l.type === 'fill') sp(l.id, 'fill-color', dark ? '#262626' : '#e9e9e9')
      if (l.type === 'symbol') sp(l.id, 'text-color', dark ? '#bbbbbb' : '#555555')
    }
    if (sl === 'transportation_name' && tw.mapStreets === 'off') hide(l.id)
    if (sl === 'housenumber' && tw.mapHouse === 'off') hide(l.id)
    if (sl === 'housenumber' && tw.mapHouse === 'on') { try { map.setLayoutProperty(l.id, 'visibility', 'visible') } catch { /* ignore */ } }
    if (sl === 'poi') { if (tw.mapPoi === 'off') hide(l.id); else if (tw.mapPoi === 'major') { try { map.setFilter(l.id, ['all', l.filter || true, ['<=', ['to-number', ['get', 'rank'], 99], 6]]) } catch { /* legacy filter */ } } }
  }
  if (tw.map3d === 'on') {
    if (map.getLayer('building-3d')) map.removeLayer('building-3d')
    if (map.getLayer('building')) hide('building')
    const lab = L.find((l) => l.type === 'symbol')?.id
    const ex = +tw.mapHeight || 1
    const grad = dark ? ['interpolate', ['linear'], ['get', 'render_height'], 0, '#1c2333', 60, '#2c3f66', 150, '#4a6fb0', 250, '#8fb0ff'] : ['interpolate', ['linear'], ['get', 'render_height'], 0, '#e3e9f3', 40, '#a9bcdc', 120, '#5f7fb6', 250, BLUE]
    try {
      map.addLayer({ id: 'z-b3d', type: 'fill-extrusion', source: 'openmaptiles', 'source-layer': 'building', minzoom: 13, filter: ['!=', ['get', 'hide_3d'], true],
        paint: { 'fill-extrusion-color': tw.mapBcol === 'gradient' ? grad : dark ? '#33415c' : '#cfd8e8', 'fill-extrusion-height': ['*', ['coalesce', ['get', 'render_height'], 5], ex], 'fill-extrusion-base': ['*', ['coalesce', ['get', 'render_min_height'], 0], ex], 'fill-extrusion-opacity': 1, 'fill-extrusion-vertical-gradient': tw.mapVgrad === 'on' } }, lab)
      map.setLight({ anchor: 'viewport', color: '#ffffff', intensity: 0.35 })
    } catch (e) { console.warn('3D buildings', e) }
  }
  if (tw.mapTerrain === 'on') {
    try {
      map.addSource('z-dem', { type: 'raster-dem', tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'], encoding: 'terrarium', tileSize: 256, maxzoom: 14, attribution: 'Terrain: Mapzen / AWS Terrain Tiles' })
      map.addLayer({ id: 'z-hs', type: 'hillshade', source: 'z-dem', paint: { 'hillshade-shadow-color': '#33507a', 'hillshade-exaggeration': 0.5 } }, L.find((l) => l.type === 'symbol')?.id)
      map.setTerrain({ source: 'z-dem', exaggeration: 1.5 })
    } catch (e) { console.warn('terrain', e) }
  }
}

export function MapView({ postcode, label, height }) {
  const [tw] = useTweaks()
  const el = useRef(null)
  const [st, setSt] = useState('loading')
  const [ll, setLl] = useState(null)
  const dark = document.documentElement.classList.contains('dark')
  const key = JSON.stringify(Object.fromEntries(Object.entries(tw).filter(([k]) => k.startsWith('map')))) + dark
  useEffect(() => {
    let map, live = true, orbit = 0
    ;(async () => {
      const [M, at] = await Promise.all([loadML(), geocode(postcode)])
      if (!live) return
      if (!at) { setSt('nogeo'); return }
      setLl(at)
      const rm = reducedMotion()
      const z = +tw.mapZoom || 16, pitch = +tw.mapPitch || 0, bearing = tw.mapBearing === 'orbit' ? 0 : +tw.mapBearing || 0
      const intro = !rm && (tw.mapFly === 'on' || tw.mapGlobe === 'on')
      map = new M.Map({ container: el.current, style: styleUrl(tw.mapBase, dark), center: at, zoom: intro ? (tw.mapGlobe === 'on' ? 2 : 11) : z, pitch: intro ? 0 : pitch, bearing: intro ? 0 : bearing, maxPitch: 70,
        interactive: tw.mapInteract !== 'static', cooperativeGestures: tw.mapInteract === 'coop', attributionControl: { compact: true } })
      if (tw.mapInteract !== 'static') map.addControl(new M.NavigationControl({ visualizePitch: true }), 'top-right')
      map.on('style.load', () => {
        if (tw.mapGlobe === 'on') try { map.setProjection({ type: 'globe' }) } catch { /* ignore */ }
        theme(map, tw, dark)
        if (tw.mapMarker === 'area') {
          map.addSource('z-area', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'Point', coordinates: at } } })
          map.addLayer({ id: 'z-area', type: 'circle', source: 'z-area', paint: { 'circle-radius': ['interpolate', ['exponential', 2], ['zoom'], 12, 6, 18, 380], 'circle-color': BLUE, 'circle-opacity': 0.14, 'circle-stroke-color': BLUE, 'circle-stroke-width': 1.5 } })
        }
      })
      if (tw.mapMarker === 'pin') new M.Marker({ color: BLUE }).setLngLat(at).addTo(map)
      else if (tw.mapMarker === 'dot' || tw.mapMarker === 'pulse') { const d = document.createElement('div'); d.className = 'z-map-dot' + (tw.mapMarker === 'pulse' && !rm ? ' pulse' : ''); d.setAttribute('aria-label', label || 'Registered office'); new M.Marker({ element: d }).setLngLat(at).addTo(map) }
      map.once('load', () => {
        if (!live) return
        setSt('ok')
        if (intro) map.flyTo({ center: at, zoom: z, pitch, bearing, duration: 2200, essential: false })
        if (tw.mapBearing === 'orbit' && !rm) { const spin = () => { if (!live) return; map.rotateTo((map.getBearing() + 30) % 360, { duration: 6000, easing: (t) => t }); orbit = window.setTimeout(spin, 6000) }; map.once('moveend', () => { orbit = window.setTimeout(spin, 300) }); if (!intro) spin() }
      })
      map.on('error', (e) => console.warn('map', e && e.error))
    })().catch((e) => { console.error(e); live && setSt('err') })
    return () => { live = false; clearTimeout(orbit); try { map && map.remove() } catch { /* ignore */ } }
  }, [postcode, key])
  const h = height || SIZE[tw.mapSize] || 320
  const q = encodeURIComponent((label ? label + ', ' : '') + postcode)
  return <div className="grid gap-2">
    <div className="relative overflow-hidden rounded-md border bg-muted" style={{ height: h }}>
      <div ref={el} style={{ position: "absolute", inset: 0 }} />
      {st === 'loading' ? <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">Loading map…</div> : null}
      {st === 'nogeo' ? <div className="absolute inset-0 grid place-items-center p-4 text-center text-sm text-muted-foreground">Couldn't place postcode {postcode || '(none)'} on the map.</div> : null}
      {st === 'err' ? <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">The map couldn't load.</div> : null}
    </div>
    {tw.mapLinks === 'on' ? <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs"><a className="inline-flex items-center gap-1 text-muted-foreground underline-offset-4 hover:underline" target="_blank" rel="noopener" href={ll ? `https://www.google.com/maps/search/?api=1&query=${ll[1]},${ll[0]}` : `https://www.google.com/maps/search/?api=1&query=${q}`}>Open in Google Maps<ExternalLink className="size-3" /></a><a className="inline-flex items-center gap-1 text-muted-foreground underline-offset-4 hover:underline" target="_blank" rel="noopener" href={`https://maps.apple.com/?q=${q}${ll ? '&ll=' + ll[1] + ',' + ll[0] : ''}`}>Open in Apple Maps<ExternalLink className="size-3" /></a></div> : null}
  </div>
}

/* The Map button. Placement: inline (toggles the map under the overview; the page renders it via onInline), Dialog,
   Sheet or Popover. Not Zuli blue, as Will asked. */
export function MapButton({ vm, onInline, inlineOpen, className = '' }) {
  const [tw] = useTweaks()
  const [open, setOpen] = useState(false)
  if (!vm.address.postcode) return null
  const icon = tw.mapForm === 'icon'
  const btn = (props = {}) => <Button variant="outline" size={icon ? 'icon-xs' : 'xs'} className={cn('align-middle', className)} aria-label="Show the registered office on a map" aria-expanded={tw.mapPlace === 'inline' ? !!inlineOpen : undefined} {...props}><MapIcon />{icon ? null : 'Map'}</Button>
  const view = <MapView postcode={vm.address.postcode} label={vm.address.oneLine} />
  const title = 'Registered office', desc = vm.address.oneLine
  if (tw.mapPlace === 'inline') return btn({ onClick: () => onInline && onInline(!inlineOpen) })
  if (tw.mapPlace === 'popover') return <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild>{btn()}</PopoverTrigger><PopoverContent align="start" className="w-[min(92vw,520px)] p-2">{open ? <MapView postcode={vm.address.postcode} label={vm.address.oneLine} height={Math.min(SIZE[tw.mapSize], 340)} /> : null}</PopoverContent></Popover>
  if (tw.mapPlace === 'sheet') return <>{btn({ onClick: () => setOpen(true) })}<Sheet open={open} onOpenChange={setOpen}><SheetContent side="right" className="w-full gap-0 sm:max-w-xl"><SheetHeader><SheetTitle>{title}</SheetTitle><SheetDescription>{desc}</SheetDescription></SheetHeader><div className="px-4">{open ? view : null}</div></SheetContent></Sheet></>
  return <>{btn({ onClick: () => setOpen(true) })}<Dialog open={open} onOpenChange={setOpen}><DialogContent className={tw.mapSize === 'l' ? 'sm:max-w-[800px]' : 'sm:max-w-[640px]'}><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{desc}</DialogDescription></DialogHeader>{open ? view : null}</DialogContent></Dialog></>
}
