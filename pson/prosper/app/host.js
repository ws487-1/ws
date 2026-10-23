/* Prosper web app: host layer.
   Storage (localStorage) and network (fetch) for the shared core (../core.js). Classic script: the top-level
   declarations here, in core.js and in app.js share one global scope, exactly like the userscript's closure.
   Keys are typed in Settings and kept only in this browser's localStorage. None is built in. */
'use strict';

const BUILD = 1;
const EDITION = 'web';
const BAKED = { ch: '', claude: '' }; // always empty in the web app
const warn = (...a) => { try { console.warn('Prosper:', ...a); } catch (e) { /* ignore */ } };

/* ---------- storage: localStorage, same key names as the userscript; values are JSON-encoded ---------- */
const API = 'localStorage';
let LS = null;
try { LS = window.localStorage; const t = 'prosper.__t'; LS.setItem(t, '1'); LS.removeItem(t); } catch (e) { LS = null; }
const memStore = new Map(); // used only when localStorage is unavailable (private mode with storage blocked)
async function storageInit() { if (!LS) warn('localStorage is not available: settings and keys last only until this tab closes.'); }
function gv(k, d) {
  try {
    const raw = LS ? LS.getItem(k) : (memStore.has(k) ? memStore.get(k) : null);
    if (raw == null) return d;
    try { return JSON.parse(raw); } catch (e) { return raw; }
  } catch (e) { warn('storage read failed for', k, e); return d; }
}
function sv(k, v) {
  const s = JSON.stringify(v === undefined ? null : v);
  if (!LS) { memStore.set(k, s); return; }
  try { LS.setItem(k, s); } catch (e) {
    // full: drop the Companies House cache (it is only a 10-minute cache) and try once more
    try { for (const x of lv()) if (x.startsWith('prosper.c.') || x.startsWith('prosper.fav.')) LS.removeItem(x); LS.setItem(k, s); }
    catch (e2) { warn('storage write failed for', k, (e2 && e2.name) || e2); }
  }
}
function dv(k) { try { if (LS) LS.removeItem(k); else memStore.delete(k); } catch (e) { warn('storage delete failed for', k, e); } }
function lv() {
  try {
    if (!LS) return Array.from(memStore.keys());
    const out = []; for (let i = 0; i < LS.length; i++) { const k = LS.key(i); if (k && k.startsWith('prosper.')) out.push(k); }
    return out;
  } catch (e) { return []; }
}

/* ---------- network: fetch with the userscript's xhr() contract ----------
   Always resolves { status, text, response, error, finalUrl }. status 0 = network error or blocked (CORS), -1 = timeout.
   onprogress(textSoFar) streams the body (server-sent events from the AI). */
function xhr(opts) {
  const to = opts.timeout || 20000;
  const ac = typeof AbortController === 'function' ? new AbortController() : null;
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; if (ac) ac.abort(); }, to);
  const headers = Object.assign({}, opts.headers || {});
  delete headers.Origin; delete headers.origin; // the browser sets Origin itself
  if (opts.user != null) headers.Authorization = 'Basic ' + btoa(opts.user + ':' + (opts.password || ''));
  const init = { method: opts.method || 'GET', headers, credentials: 'omit', redirect: 'follow', cache: 'no-store', signal: ac ? ac.signal : undefined, referrerPolicy: 'no-referrer' };
  if (opts.data != null) init.body = opts.data;
  const p = (async () => {
    let res;
    try { res = await fetch(opts.url, init); } catch (e) {
      return timedOut ? { status: -1, text: '', error: 'Timed out after ' + Math.round(to / 1000) + 's' }
        : { status: 0, text: '', error: 'Network error (request blocked or host unreachable)' };
    }
    const out = { status: res.status, text: '', response: undefined, error: res.status >= 400 ? (res.statusText || '') : '', finalUrl: res.url || '' };
    try {
      if (opts.responseType === 'arraybuffer') out.response = await res.arrayBuffer();
      else if (opts.onprogress && res.body && res.body.getReader) {
        const rd = res.body.getReader(), dec = new TextDecoder();
        let t = '';
        for (;;) { const { done, value } = await rd.read(); if (done) break; t += dec.decode(value, { stream: true }); try { opts.onprogress(t); } catch (e) { /* ignore */ } }
        t += dec.decode(); out.text = t;
      } else out.text = await res.text();
    } catch (e) {
      if (timedOut) return { status: -1, text: '', error: 'Timed out after ' + Math.round(to / 1000) + 's' };
      out.error = out.error || 'Response interrupted';
    }
    return out;
  })();
  return p.then((r) => {
    clearTimeout(timer);
    if (r.status !== 200 && r.status !== 404 && !opts.quiet) warn('request failed', (opts.method || 'GET'), String(opts.url).split('?')[0], 'HTTP ' + r.status, r.error || '');
    return r;
  });
}

/* Companies House: from a web page only the Authorization header works (the browser sends this site's Origin,
   which Companies House accepts when the key's JavaScript domains allow it). One method, so a bad key costs one request. */
const HOST_CH_AUTH = [
  { id: 'header', label: 'Authorization header', mk: (k) => ({ headers: { Authorization: 'Basic ' + btoa(k + ':'), Accept: 'application/json' } }) },
];
