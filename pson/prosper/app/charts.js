/* Date/event engine shared by company and person history. No inferred appointment dates. */
(function(root) {
  'use strict';
  const BOARD = new Set(['director', 'corporate-director', 'nominee-director', 'corporate-nominee-director']);
  const CLOSED = new Set(['dissolved', 'closed', 'converted-closed', 'removed']);
  function iso(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return '';
    const d = new Date(value + 'T00:00:00Z');
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value ? value : '';
  }
  function analyse(input, o = {}) {
    const today = iso(o.today) || new Date().toISOString().slice(0, 10), now = +today.slice(0, 4);
    const minYear = now - (o.kind === 'company' ? 11 : 19);
    let from = minYear + '-01-01';
    if (iso(o.created) && o.created > from && o.created <= today) from = o.created;
    const items = input.filter(x => o.kind !== 'company' || BOARD.has(x.roleCode || x.role));
    let invalid = false, unknown = false, duplicate = false;
    const seen = new Set(), events = [], terms = [];
    for (const x of items) {
      const bound = iso(x.appointedBefore), uncertain = !!(x.pre1992 || x.appointedBefore);
      const a = uncertain ? '' : iso(x.appointedIso), r = iso(x.resignedIso);
      if ((x.appointedIso && !iso(x.appointedIso)) || (x.appointedBefore && !bound) || (x.resignedIso && !r) || (a && r && r < a) || (a && a > today) || (r && r > today)) invalid = true;
      const key = x.appointmentKey || JSON.stringify([x.officerId || x.number || '', x.roleCode || x.role || '', x.appointedIso || '', x.appointedBefore || '', x.resignedIso || '']);
      if (seen.has(key)) duplicate = true; seen.add(key);
      if (!a && !((bound && bound <= from) || (r && r < from))) unknown = true;
      if (a && a >= from && a <= today) events.push({date:a, kind:'a'});
      if (r && r >= from && r <= today) events.push({date:r, kind:'r'});
      terms.push({a,r,bound,x});
    }
    const years = new Set(events.map(e => e.date.slice(0, 4)));
    const complete = o.available !== false && o.complete === true;
    const quality = complete && !invalid && !unknown && !duplicate;
    const eligible = quality && events.length >= 5 && years.size >= 3;
    let reason = !complete ? (o.available === false ? 'unavailable' : 'partial') : invalid || unknown || duplicate ? 'dates' : 'sparse';
    const stockSafe = quality && (o.kind === 'company' ? !!o.status && !CLOSED.has(o.status) && !o.ceased : terms.every(t => !!t.r || (!!t.x.statusCode && !CLOSED.has(t.x.statusCode))));
    const exactDates = terms.map(t=>t.a).filter(Boolean);
    // Trim empty years, while keeping the full data window as the eligibility boundary.
    const firstEvent = events.length ? events.map(e=>+e.date.slice(0,4)).sort((a,b)=>a-b)[0] : now;
    const startYear = Math.max(+from.slice(0,4), firstEvent);
    const rows = [];
    for (let y=startYear; y<=now; y++) {
      const end = y===now ? today : y+'-12-31';
      rows.push({y, a:events.filter(e=>e.kind==='a' && +e.date.slice(0,4)===y).length, r:events.filter(e=>e.kind==='r' && +e.date.slice(0,4)===y).length,
        n:stockSafe ? terms.filter(t=>(t.a ? t.a<=end : t.bound && t.bound<=end) && (!t.r || t.r>end)).length : null});
    }
    return {eligible,quality,reason,rows,items,events,exactDates,stockSafe,from,today,total:items.length,eventYears:years.size};
  }
  const api = {analyse, iso, BOARD};
  if (typeof module === 'object' && module.exports) module.exports=api;
  else root.ProsperCharts=api;
})(typeof window !== 'undefined' ? window : globalThis);
