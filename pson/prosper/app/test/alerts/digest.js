/* Prosper daily digest: builds a table-layout HTML email (inline styles, 600px, no images, no external assets) plus a plain-text part.
   Digest.build({ date, windowDays, watched: [{ raw, vm }], searches: [{ name, match(item) }], newItems, sic, appUrl }) -> { html, text, stats, subject, preheader } */
(function (root, f) { if (typeof module === 'object' && module.exports) module.exports = f(); else root.Digest = f(); })(this, function () {
  'use strict';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const DAY = 864e5, t = (s) => new Date(s + 'T00:00:00Z').getTime();
  const fd = (s, o) => new Date(typeof s === 'number' ? s : t(s)).toLocaleDateString('en-GB', Object.assign({ day: 'numeric', month: 'short', timeZone: 'UTC' }, o || {}));
  const C = { ink: '#1d1f24', ink2: '#4a4f5a', mute: '#7a7f8a', line: '#e3e5ea', bg: '#f4f5f7', accent: '#3b3f8f', bad: '#b42318', badBg: '#fdf0ee', warn: '#a15c07', warnBg: '#fdf6e9', ok: '#1e7a4a' };
  const F = "font-family:Inter,'Segoe UI',Helvetica,Arial,sans-serif;";
  const town = (a) => (a && (a.locality || a.post_town || a.region)) || '';
  const cat = { accounts: 'Accounts', 'confirmation-statement': 'Confirmation statement', officers: 'Officers', address: 'Address', capital: 'Capital', mortgage: 'Charges', 'persons-with-significant-control': 'Ownership', insolvency: 'Insolvency', liquidation: 'Insolvency', gazette: 'Gazette', resolution: 'Resolutions', 'change-of-name': 'Name change', incorporation: 'Incorporation' };

  function changes(vm, since, until) {
    const ev = vm.filings.items.filter((f) => t(f.dateIso) > since && t(f.dateIso) <= until).map((f) => ({ date: f.dateIso, kind: cat[f.category] || f.categoryLabel || 'Filing', text: f.title, url: f.viewUrl }));
    const alerts = [];
    if (vm.status.active) {
      if (vm.accounts.overdue) alerts.push({ tone: 'bad', text: `Accounts overdue (were due ${vm.accounts.nextDue})` });
      if (vm.confirmation.overdue) alerts.push({ tone: 'bad', text: `Confirmation statement overdue (was due ${vm.confirmation.nextDue})` });
      if (/strike off/i.test(vm.status.detail)) alerts.push({ tone: 'bad', text: 'Strike-off proposed in The Gazette' });
      for (const d of vm.deadlines) if (d.days >= 0 && d.days <= 30) alerts.push({ tone: 'warn', text: `${d.label} due ${d.dueText} (${d.relText})` });
    } else if (['liquidation', 'administration', 'receivership'].includes(vm.status.code)) alerts.push({ tone: 'bad', text: `In ${vm.status.label.toLowerCase()}` });
    return { ev, alerts };
  }

  const btn = (href, label) => `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:${C.accent};border-radius:6px;"><a href="${esc(href)}" style="${F}display:inline-block;padding:9px 16px;font-size:13px;font-weight:600;color:#ffffff;text-decoration:none;">${esc(label)}</a></td></tr></table>`;
  const h2 = (txt, sub) => `<tr><td style="padding:28px 32px 8px;${F}"><div style="font-size:17px;font-weight:700;color:${C.ink};letter-spacing:-0.01em;">${txt}</div>${sub ? `<div style="font-size:13px;color:${C.mute};margin-top:3px;">${sub}</div>` : ''}</td></tr>`;

  function build(o) {
    const until = t(o.date), since = until - (o.windowDays || 1) * DAY, app = o.appUrl || '#';
    const prevDay = new Date(t(o.date) - DAY).toISOString().slice(0, 10);
    const W = o.watched.map(({ raw, vm }) => Object.assign({ vm }, changes(vm, since, until)));
    const changed = W.filter((w) => w.ev.length || w.alerts.length).sort((a, b) => b.alerts.filter((x) => x.tone === 'bad').length - a.alerts.filter((x) => x.tone === 'bad').length || b.ev.length - a.ev.length);
    const attention = W.reduce((n, w) => n + w.alerts.length, 0);
    const S = o.searches.map((s) => ({ s, items: o.newItems.filter((i) => i.created === prevDay && s.match(i)) }));
    const newTotal = S.reduce((n, x) => n + x.items.length, 0);
    const dateLong = fd(o.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const subject = `${newTotal} new compan${newTotal === 1 ? 'y' : 'ies'}, ${changed.length} watched compan${changed.length === 1 ? 'y' : 'ies'} with updates`;
    const preheader = (attention ? `${attention} item${attention > 1 ? 's' : ''} need attention. ` : '') + S.map((x) => `${x.items.length} new in ${x.s.name}`).join(', ') + '.';
    const stat = (n, l, col) => `<td width="33%" style="padding:14px 16px;border-right:1px solid ${C.line};${F}" valign="top"><div style="font-size:24px;font-weight:700;color:${col || C.ink};">${n}</div><div style="font-size:12px;color:${C.mute};margin-top:2px;">${l}</div></td>`;

    const watchedHtml = changed.length ? changed.map((w) => `
      <tr><td style="padding:6px 32px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${C.line};border-radius:8px;">
        <tr><td style="padding:14px 16px 6px;${F}"><a href="${esc(app)}cards/?co=${esc(w.vm.number)}&amp;layout=B" style="font-size:15px;font-weight:700;color:${C.ink};text-decoration:none;">${esc(w.vm.name)}</a><span style="font-size:12px;color:${C.mute};"> &nbsp;${esc(w.vm.number)} · ${esc(w.vm.status.label)}</span></td></tr>
        ${w.alerts.map((a) => `<tr><td style="padding:2px 16px;${F}"><div style="background:${a.tone === 'bad' ? C.badBg : C.warnBg};color:${a.tone === 'bad' ? C.bad : C.warn};font-size:13px;font-weight:600;padding:7px 10px;border-radius:6px;">${esc(a.text)}</div></td></tr>`).join('')}
        ${w.ev.slice(0, 6).map((e) => `<tr><td style="padding:6px 16px 0;${F}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td width="62" valign="top" style="font-size:12px;color:${C.mute};${F}">${esc(fd(e.date))}</td><td valign="top" style="font-size:13px;color:${C.ink2};${F}"><span style="font-weight:600;color:${C.ink};">${esc(e.kind)}</span> · ${esc(e.text)}</td></tr></table></td></tr>`).join('')}
        ${w.ev.length > 6 ? `<tr><td style="padding:6px 16px 0 78px;font-size:12px;color:${C.mute};${F}">+${w.ev.length - 6} more filings</td></tr>` : ''}
        <tr><td style="padding:10px 16px 14px;${F}"><a href="${esc(app)}cards/?co=${esc(w.vm.number)}&amp;layout=B" style="font-size:13px;font-weight:600;color:${C.accent};text-decoration:none;">Open company →</a></td></tr>
      </table></td></tr>`).join('') : `<tr><td style="padding:6px 32px;font-size:14px;color:${C.mute};${F}">No changes to your watched companies.</td></tr>`;

    const newHtml = S.map(({ s, items }) => `
      <tr><td style="padding:14px 32px 4px;${F}"><span style="font-size:14px;font-weight:700;color:${C.ink};">${esc(s.name)}</span><span style="font-size:13px;color:${C.mute};"> · ${items.length} new</span></td></tr>
      <tr><td style="padding:0 32px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        ${items.slice(0, 8).map((i) => `<tr><td style="padding:8px 0;border-top:1px solid ${C.line};${F}" valign="top"><a href="https://find-and-update.company-information.service.gov.uk/company/${esc(i.number)}" style="font-size:13px;font-weight:600;color:${C.ink};text-decoration:none;">${esc(i.name)}</a><div style="font-size:12px;color:${C.mute};margin-top:1px;">${esc(i.number)} · ${esc(town(i.address))}${i.address && i.address.postal_code ? ' ' + esc(i.address.postal_code) : ''}</div></td><td style="padding:8px 0 8px 12px;border-top:1px solid ${C.line};font-size:12px;color:${C.ink2};${F}" valign="top" width="44%">${esc((o.sic[i.sic[0]] || i.sic[0] || '').replace(/^(.{60}).+$/, '$1…'))}</td></tr>`).join('') || `<tr><td style="padding:8px 0;border-top:1px solid ${C.line};font-size:13px;color:${C.mute};${F}">No new companies matched.</td></tr>`}
      </table></td></tr>
      ${items.length > 8 ? `<tr><td style="padding:6px 32px 0;${F}"><a href="${esc(app)}new-companies/" style="font-size:13px;font-weight:600;color:${C.accent};text-decoration:none;">View all ${items.length} →</a></td></tr>` : ''}`).join('');

    const html = `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(subject)}</title>
<style>@media (max-width:620px){.wrap{width:100%!important}.stack td{display:block!important;width:auto!important;border-right:0!important}}</style></head>
<body style="margin:0;padding:0;background:${C.bg};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.bg};"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:#ffffff;border:1px solid ${C.line};border-radius:10px;">
  <tr><td style="padding:22px 32px 18px;border-bottom:1px solid ${C.line};${F}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    <td style="font-family:'DM Sans',Inter,Helvetica,Arial,sans-serif;font-size:18px;font-weight:700;color:${C.ink};letter-spacing:-0.01em;">Prosper</td>
    <td align="right" style="font-size:12px;color:${C.mute};${F}">Daily digest · ${esc(dateLong)}</td></tr></table></td></tr>
  <tr><td style="padding:24px 32px 6px;${F}"><div style="font-size:21px;font-weight:700;color:${C.ink};letter-spacing:-0.02em;line-height:1.3;">Good morning. Here's what changed.</div>
    <div style="font-size:14px;color:${C.ink2};margin-top:6px;line-height:1.5;">New companies registered on ${esc(fd(prevDay, { weekday: 'long', day: 'numeric', month: 'long' }))}, and updates to the ${o.watched.length} companies you watch${(o.windowDays || 1) > 1 ? ` over the last ${o.windowDays} days` : ' since yesterday'}.</div></td></tr>
  <tr><td style="padding:14px 32px 4px;"><table role="presentation" class="stack" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${C.line};border-radius:8px;"><tr>
    ${stat(newTotal, 'new companies matched')}${stat(changed.length, 'watched with updates')}${stat(attention, 'need attention', attention ? C.bad : C.ok).replace(`border-right:1px solid ${C.line};`, '')}</tr></table></td></tr>
  ${h2('Watched companies', changed.length ? `${changed.length} of ${o.watched.length} have something new` : '')}
  ${watchedHtml}
  ${h2('New companies', 'From your saved searches')}
  ${newHtml}
  <tr><td style="padding:26px 32px 8px;">${btn(app, 'Open Prosper')}</td></tr>
  <tr><td style="padding:18px 32px 24px;border-top:1px solid ${C.line};font-size:12px;color:${C.mute};line-height:1.6;${F}">You get this at 7am because you have ${o.watched.length} watched companies and ${o.searches.length} saved searches in Prosper. Data is from the Companies House public register and contains public sector information licensed under the Open Government Licence v3.0.<br><a href="${esc(app)}alerts/#settings" style="color:${C.mute};">Manage alerts</a> · <a href="${esc(app)}alerts/#unsubscribe" style="color:${C.mute};">Unsubscribe</a></td></tr>
</table></td></tr></table></body></html>`;

    const text = [`Prosper daily digest, ${dateLong}`, '', subject, '', 'WATCHED COMPANIES', ...changed.flatMap((w) => [`${w.vm.name} (${w.vm.number})`, ...w.alerts.map((a) => `  ! ${a.text}`), ...w.ev.slice(0, 6).map((e) => `  ${fd(e.date)}  ${e.kind}: ${e.text}`), '']), 'NEW COMPANIES', ...S.flatMap(({ s, items }) => [`${s.name}: ${items.length} new`, ...items.slice(0, 8).map((i) => `  ${i.name} (${i.number}), ${town(i.address)}`), '']), 'Manage alerts: ' + app + 'alerts/'].join('\n');
    return { html, text, subject, preheader, stats: { newTotal, changed: changed.length, attention } };
  }
  return { build, changes };
});
