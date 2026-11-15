/* Zuli app3: S2 / Soft compact C4 (the main build's look) plus the app3 layer (styles/app3.css). */
(function(){const h=document.documentElement;h.dataset.style='s2';h.dataset.layer='soft';h.dataset.resigned='hatched';h.dataset.person='A';document.write('<link rel="stylesheet" href="styles/common.css?v=app3a"><link rel="stylesheet" href="styles/s2.css?v=app3a"><link rel="stylesheet" href="styles/prosper.css?v=app3a"><link rel="stylesheet" href="styles/app3.css?v=app3a">')})();
/* Experimental settings (temporary): stored in localStorage 'zuli3.tweaks', applied here before first paint as CSS custom
   properties and data attributes on <html>. The popup is in app.js (account button). */
(function (root) {
  const KEY = 'zuli3.tweaks';
  const DEF = { accent: '#245091', tipos: 'left', tistyle: 'tinted', initials: 'variants', picon: 'circle', openbtn: 'outline', sicH: 26 };
  const VARS = { sicH: '--sic-h' };
  const ATTR = { tipos: 'tipos', tistyle: 'tistyle', initials: 'initials', picon: 'picon', openbtn: 'openbtn' };
  const SHADES = ['50', '100', '200', '300', '500', '600', '700', '800', '900', '950'];
  const rgb = (hex) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim()); if (!m) return null; const n = parseInt(m[1], 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const hx = (c) => '#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  /* Ramp from one colour, matching the main build's steps: tints for 50–500, the colour at 600, shades above. */
  function palette(hex) {
    const c = rgb(hex); if (!c) return null;
    const W = [255, 255, 255], K = [8, 14, 30];
    const t = { 50: [W, .94], 100: [W, .88], 200: [W, .76], 300: [W, .55], 500: [W, .14], 600: [c, 0], 700: [K, .17], 800: [K, .33], 900: [K, .5], 950: [K, .64] };
    const out = {}; SHADES.forEach((s) => { out[s] = hx(mix(c, t[s][0], t[s][1])); }); return out;
  }
  function get() { let v = {}; try { v = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { v = {}; } return Object.assign({}, DEF, v); }
  function apply(v) {
    const h = document.documentElement, st = h.style;
    for (const k in VARS) { if (v[k] !== DEF[k] && isFinite(+v[k])) st.setProperty(VARS[k], (+v[k]) + 'px'); else st.removeProperty(VARS[k]); }
    const p = String(v.accent).toLowerCase() !== DEF.accent.toLowerCase() && palette(v.accent);
    SHADES.forEach((s) => { if (p) st.setProperty('--brand-' + s, p[s]); else st.removeProperty('--brand-' + s); });
    for (const k in ATTR) { if (v[k] !== DEF[k]) h.dataset[ATTR[k]] = v[k]; else delete h.dataset[ATTR[k]]; }
  }
  function set(v) { const diff = {}; for (const k in DEF) if (v[k] !== undefined && v[k] !== DEF[k]) diff[k] = v[k]; try { if (Object.keys(diff).length) localStorage.setItem(KEY, JSON.stringify(diff)); else localStorage.removeItem(KEY); } catch (e) { /* storage blocked */ } apply(Object.assign({}, DEF, diff)); }
  root.ZuliTweaks = { DEF, get, set, apply, palette };
  try { apply(get()); } catch (e) { /* defaults */ }
})(window);
