/* Zuli app2: S2 / Soft compact C4 base plus the app2 indigo layer. */
(function(){const h=document.documentElement;h.dataset.style='s2';h.dataset.layer='soft';h.dataset.resigned='hatched';h.dataset.person='A';document.write('<link rel="stylesheet" href="styles/common.css?v=app2b"><link rel="stylesheet" href="styles/s2.css?v=app2b"><link rel="stylesheet" href="styles/prosper.css?v=app2b"><link rel="stylesheet" href="styles/app2.css?v=app2b">')})();
/* Experimental settings (temporary, for testing): values live in localStorage 'zuli.tweaks' and are applied here, before
   first paint, as CSS custom properties and data attributes on <html>. The panel itself is in app.js (account button). */
(function (root) {
  const KEY = 'zuli.tweaks';
  const DEF = { rCard: 20, rCtl: 12, cardPad: 20, ctlH: 40, fs: 14, maxW: 1320, gap: 14, sideW: 232, navH: 44, navPad: 12, navGap: 4,
    accent: '#4F46E5', initials: 'grey', iconSq: 'tinted', shadows: 'on', borders: 'off' };
  const VARS = { rCard: '--r-card', rCtl: '--r-ctl', cardPad: '--card-pad', ctlH: '--ctl-h', fs: '--fs-body', maxW: '--content-max', gap: '--gap', sideW: '--side-w', navH: '--nav-h', navPad: '--nav-pad', navGap: '--nav-gap' };
  const ATTR = { initials: 'initials', iconSq: 'ti', shadows: 'shadows', borders: 'borders' };
  const SHADES = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];
  const rgb = (hex) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim()); if (!m) return null; const n = parseInt(m[1], 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const hx = (c) => '#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  /* Ramp from one colour: tints towards white for 50–500, the colour itself at 600, shades towards black above. */
  function palette(hex) {
    const c = rgb(hex); if (!c) return null;
    const W = [255, 255, 255], K = [10, 10, 25];
    const t = { 50: [W, .92], 100: [W, .85], 200: [W, .72], 300: [W, .55], 400: [W, .36], 500: [W, .16], 600: [c, 0], 700: [K, .14], 800: [K, .28], 900: [K, .44], 950: [K, .6] };
    const out = {}; SHADES.forEach((s) => { out[s] = hx(mix(c, t[s][0], t[s][1])); }); return out;
  }
  function get() { let v = {}; try { v = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { v = {}; } return Object.assign({}, DEF, v); }
  function apply(v) {
    const h = document.documentElement, st = h.style;
    for (const k in VARS) { if (v[k] !== DEF[k] && isFinite(+v[k])) st.setProperty(VARS[k], (+v[k]) + 'px'); else st.removeProperty(VARS[k]); }
    const p = String(v.accent).toLowerCase() !== DEF.accent.toLowerCase() && palette(v.accent);
    SHADES.forEach((s) => { if (p) st.setProperty('--in-' + s, p[s]); else st.removeProperty('--in-' + s); });
    if (p) { st.setProperty('--t-indigo-bg', p['50']); } else st.removeProperty('--t-indigo-bg');
    for (const k in ATTR) { if (v[k] !== DEF[k]) h.dataset[ATTR[k]] = v[k]; else delete h.dataset[ATTR[k]]; }
  }
  function set(v) { const diff = {}; for (const k in DEF) if (v[k] !== undefined && v[k] !== DEF[k]) diff[k] = v[k]; try { if (Object.keys(diff).length) localStorage.setItem(KEY, JSON.stringify(diff)); else localStorage.removeItem(KEY); } catch (e) { /* storage blocked */ } apply(Object.assign({}, DEF, diff)); }
  root.ZuliTweaks = { DEF, get, set, apply, palette };
  try { apply(get()); } catch (e) { /* defaults */ }
})(window);
