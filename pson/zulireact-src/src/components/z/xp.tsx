// @ts-nocheck
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { DEF, getTweaks, setTweaks } from '@/lib/tweaks'

/* Experimental settings (account button): same options and storage as /pson/zuli. */
const SEG = {
  ststyle: ['Style', [['current', 'Current'], ['thin', 'Thin'], ['centred', 'Centred'], ['accent', 'Accent border'], ['plain', 'Plain']]],
  stpos: ['Icon position', [['left', 'Top-left'], ['right', 'Top-right']]],
  tistyle: ['Header icons', [['tinted', 'Tinted blue'], ['plain', 'Plain']]],
  openbtn: ['Open buttons', [['outline', 'Outline'], ['filled', 'Filled']]],
  initials: ['Initials colour', [['variants', 'Blue variants'], ['single', 'Single blue'], ['grey', 'Grey']]],
  picon: ['Person icon', [['circle', 'Circle user'], ['round', 'User round'], ['user', 'User'], ['initials', 'Initials']]],
}
const SL = { tk: ['Highlight strength', 0, 200, 5, '%'], scale: ['UI scale', 80, 120, 1, '%'], avSize: ['Initials size', 20, 44, 1, 'px'], sicH: ['Row height', 20, 40, 1, 'px'] }
export function XpPanel() {
  const [v, setV] = useState(getTweaks())
  const put = (k, val) => { const n = { ...v, [k]: val }; setV(n); setTweaks(n) }
  const seg = (k) => { const [l, ops] = SEG[k]; return <div className="xp-r" key={k}><span>{l}</span>
    <ToggleGroup type="single" className="seg w-full flex-wrap rounded-(--r-ctl) bg-(--sunk) p-0.5" value={v[k]} onValueChange={(x) => x && put(k, x)} aria-label={l} data-xs={k}>
      {ops.map(([val, t]) => <ToggleGroupItem key={val} value={val} size="sm" className="h-[26px] rounded-[2px]" data-xv={val}>{t}</ToggleGroupItem>)}</ToggleGroup></div> }
  const sl = (k) => { const [l, mn, mx, step, u] = SL[k]; return <div className="xp-r" key={k}><span>{l}</span><span className="xp-sl">
    <Slider min={mn} max={mx} step={step} value={[+v[k]]} onValueChange={([x]) => put(k, x)} aria-label={l} data-xk={k} />
    <span className="xp-num"><Input type="number" min={mn} max={mx} step={step} value={v[k]} className="h-7 w-[52px] px-1.5 text-[12px] md:text-[12px]" aria-label={l} data-xn={k} onChange={(e) => { if (e.target.value !== '' && isFinite(+e.target.value)) put(k, +e.target.value) }} />{u}</span></span></div> }
  return <div>
    <div className="xp-head"><div><h2>Experimental settings</h2><span className="xp-sub">Saved in this browser. Applies to every page.</span></div><Button variant="outline" size="sm" id="xpReset" onClick={() => { setTweaks({}); setV(getTweaks()) }}>Reset to defaults</Button></div>
    <div className="xp-body">
      <div className="xp-sec"><h3>Zuli blue</h3><div className="xp-r"><span>Accent</span><div className="grid grid-cols-[40px_minmax(0,1fr)_auto] gap-1.5">
        <input type="color" value={v.accent} onChange={(e) => put('accent', e.target.value.toUpperCase())} aria-label="Accent colour" className="h-7 w-10 cursor-pointer rounded-(--r-ctl) border border-(--line) bg-white p-0" />
        <Input id="xpHex" defaultValue={v.accent} key={v.accent} maxLength={7} className="h-7 text-[12px] md:text-[12px]" aria-label="Accent hex" spellCheck={false} onChange={(e) => { const c = e.target.value.trim(); if (/^#[0-9a-f]{6}$/i.test(c)) put('accent', c.toUpperCase()) }} />
        <Button variant="outline" size="sm" onClick={() => put('accent', DEF.accent)} title={'Back to ' + DEF.accent}>Reset</Button></div></div>{sl('tk')}</div>
      <div className="xp-sec"><h3>Size</h3>{sl('scale')}</div>
      <div className="xp-sec"><h3>Stat tiles</h3>{seg('ststyle')}{seg('stpos')}</div>
      <div className="xp-sec"><h3>Section tiles</h3>{seg('tistyle')}{seg('openbtn')}</div>
      <div className="xp-sec"><h3>People</h3>{seg('initials')}{sl('avSize')}{seg('picon')}</div>
      <div className="xp-sec"><h3>SIC rows</h3>{sl('sicH')}</div>
    </div>
    <div className="xp-foot"><span>Accounts aren't available yet.</span><a className="lnk" href="#/settings">Settings</a></div>
  </div>
}
