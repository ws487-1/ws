// Embedded fonts (Inter text, DM Sans 700 wordmark), from the app's fonts.js. Load after ../../fonts.js (or ../fonts.js from app/test/).
(function () {
  try {
    const css = [];
    const f = interFonts(); for (const w in f) css.push(`@font-face{font-family:'Inter';font-weight:${w};font-display:swap;src:url(data:font/woff2;base64,${f[w]}) format('woff2')}`);
    css.push(`@font-face{font-family:'DM Sans Display';font-weight:700;src:url(data:font/woff2;base64,${dmDisplayFont()}) format('woff2')}`);
    const s = document.createElement('style'); s.textContent = css.join('\n'); document.head.appendChild(s);
  } catch (e) { /* system fonts */ }
})();
