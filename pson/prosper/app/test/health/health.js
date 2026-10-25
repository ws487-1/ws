/* Prosper health read: plain-English "how risky does this look" from the public Companies House record.
   Pure function. Health.assess(raw, vm, acc?, now?) -> { level, score, headline, summary, signals[] }.
   Each signal: { id, title, tone: ok|info|warn|bad, points, finding, rule, evidence[] }. Wording is factual: it describes the record, never people. */
(function (root, f) { if (typeof module === 'object' && module.exports) module.exports = f(); else root.Health = f(); })(this, function () {
  'use strict';
  const DAY = 864e5;
  const d = (s) => (s ? new Date(s + (String(s).length === 10 ? 'T00:00:00Z' : '')).getTime() : NaN);
  const addM = (t, m) => { const x = new Date(t); const day = x.getUTCDate(); x.setUTCMonth(x.getUTCMonth() + m); if (x.getUTCDate() < day) x.setUTCDate(0); return x.getTime(); };
  const fmt = (t) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const plural = (n, w, p) => `${n} ${n === 1 ? w : (p || w + 's')}`;

  // Filings received after the usual statutory deadline (from the filing history loaded, typically the latest 25-100)
  function lateFilings(raw, vm) {
    const items = ((raw.filings || {}).items || []), created = d(vm.created), plc = vm.type.code === 'plc';
    const out = { accounts: [], cs: [], checkedA: 0, checkedC: 0 };
    for (const it of items) {
      const mu = d((it.description_values || {}).made_up_date), got = d(it.date);
      if (!isFinite(mu) || !isFinite(got)) continue;
      if (it.type === 'AA') {
        out.checkedA++;
        const first = isFinite(created) && mu - created < 19 * 30.5 * DAY;
        let due = addM(mu, plc ? 6 : 9);
        if (first) due = Math.max(addM(created, plc ? 18 : 21), addM(mu, 3));
        if (got > due + DAY) out.accounts.push({ madeUp: mu, filed: got, due, days: Math.round((got - due) / DAY) });
      } else if (it.type === 'CS01' || it.type === 'AR01') {
        out.checkedC++;
        const due = mu + (it.type === 'CS01' ? 14 : 28) * DAY;
        if (got > due + DAY) out.cs.push({ madeUp: mu, filed: got, due, days: Math.round((got - due) / DAY) });
      }
    }
    return out;
  }

  function assess(raw, vm, acc, now) {
    now = now || Date.now();
    const p = raw.profile || {}, S = [];
    const add = (s) => { S.push(Object.assign({ points: 0, evidence: [] }, s)); };
    const closed = ['dissolved', 'converted-closed', 'removed', 'closed'].includes(vm.status.code);
    const insolv = ['liquidation', 'administration', 'receivership', 'voluntary-arrangement', 'insolvency-proceedings', 'in-administration'].includes(vm.status.code);

    // 1. Status and insolvency
    {
      const cases = (vm.insolvency.cases || []);
      const ev = cases.map((c) => `${c.type}${c.dates && c.dates[0] ? ', ' + c.dates[0].label + ' ' + c.dates[0].date : ''}`);
      if (closed) add({ id: 'status', title: 'Company status', tone: 'bad', points: 0, finding: `The company is ${vm.status.label.toLowerCase()}${vm.ceasedText ? ' (' + vm.ceasedText + ')' : ''}. It can't trade or enter contracts.`, rule: 'A dissolved or closed company is shown as closed rather than scored.', evidence: ev });
      else if (insolv) add({ id: 'status', title: 'Insolvency', tone: 'bad', points: 60, finding: `The register shows the company in ${vm.status.label.toLowerCase()}.`, rule: 'Liquidation, administration, receivership or a voluntary arrangement: +60. Insolvency is a formal process; creditors may not be paid in full.', evidence: ev });
      else if (p.has_insolvency_history || cases.length) add({ id: 'status', title: 'Insolvency history', tone: 'warn', points: 15, finding: 'The company is active but has a past insolvency case on record.', rule: 'Active with any past insolvency case: +15. Companies can and do recover; check the case dates.', evidence: ev });
      else add({ id: 'status', title: 'Status and insolvency', tone: 'ok', finding: `${vm.status.label}, with no insolvency history on record.`, rule: 'Insolvency now: +60. Past insolvency: +15. None: 0.' });
    }

    // 2. Strike-off
    {
      const items = (raw.filings || {}).items || [];
      const gaz = items.filter((i) => /^gazette-notice-(compulsory|voluntary)/.test(i.description || ''));
      const lastG = gaz[0], stopped = lastG && items.find((i) => d(i.date) >= d(lastG.date) && /gazette-filings-brought-up-to-date|dissolution-discontinued|striking-off-action-(suspended|discontinued)/.test((i.description || '') + ' ' + (i.type || '')));
      const proposed = /strike off/i.test(vm.status.detail || '') && !closed;
      const vol = lastG && /voluntary/.test(lastG.description);
      if (proposed) add({ id: 'strike', title: 'Strike-off', tone: 'bad', points: vol ? 20 : 30, finding: vol ? 'The directors have applied to close the company, and the notice is in The Gazette.' : 'Companies House has proposed striking the company off the register.', rule: 'An active compulsory strike-off proposal: +30. Companies House usually starts this when filings are missing. A voluntary one, where the directors asked to close the company: +20.', evidence: gaz.slice(0, 3).map((g) => `${g.description.replace(/-/g, ' ')}, ${fmt(d(g.date))}`) });
      else if (gaz.length && !closed) add({ id: 'strike', title: 'Strike-off', tone: 'info', points: 5, finding: `A strike-off notice was published before${stopped ? ' and later stopped' : ''}. None is active now.`, rule: 'A past strike-off notice that is no longer active: +5.', evidence: gaz.slice(0, 3).map((g) => `${g.description.replace(/-/g, ' ')}, ${fmt(d(g.date))}`) });
      else if (!closed) add({ id: 'strike', title: 'Strike-off', tone: 'ok', finding: 'No strike-off notices in the filing history loaded.', rule: 'Active compulsory proposal: +30. Voluntary: +20. Past notice: +5.' });
    }

    // 3. Filing on time
    if (!closed) {
      const L = lateFilings(raw, vm), ev = [];
      let pts = 0;
      if (vm.accounts.overdue) { pts += 20; ev.push(`Accounts were due ${vm.accounts.nextDue} and haven't been filed`); }
      if (vm.confirmation.overdue) { pts += 10; ev.push(`Confirmation statement was due ${vm.confirmation.nextDue} and hasn't been filed`); }
      for (const x of L.accounts) ev.push(`Accounts to ${fmt(x.madeUp)} filed ${fmt(x.filed)}, ${plural(x.days, 'day')} after the usual deadline`);
      for (const x of L.cs.slice(0, 3)) ev.push(`Confirmation statement to ${fmt(x.madeUp)} filed ${plural(x.days, 'day')} late`);
      const hist = Math.min(15, L.accounts.length * 6 + L.cs.length * 2); pts += hist;
      const now_ = vm.accounts.overdue || vm.confirmation.overdue;
      const tone = vm.accounts.overdue ? 'bad' : pts ? 'warn' : 'ok';
      const finding = now_ ? [vm.accounts.overdue && 'Accounts are overdue', vm.confirmation.overdue && 'the confirmation statement is overdue'].filter(Boolean).join(' and ').replace(/^t/, 'T') + '.' + (hist ? ' Some past filings were also late.' : '')
        : hist ? `Everything due is filed, but ${[L.accounts.length && plural(L.accounts.length, 'set') + ' of accounts', L.cs.length && plural(L.cs.length, 'confirmation statement')].filter(Boolean).join(' and ')} in the history came in after the usual deadline.` : `Everything due is filed. The ${L.checkedA + L.checkedC} accounts and confirmation statements checked were on time.`;
      add({ id: 'late', title: 'Filing on time', tone, points: pts, finding, rule: 'Accounts overdue now: +20. Confirmation statement overdue: +10. Each late set of accounts in the history: +6. Each late confirmation statement: +2 (history capped at +15). The deadlines used are 9 months after the year end (6 for a PLC), 21 months after incorporation for first accounts, and 14 days for confirmation statements. Companies House can grant extensions, so a filing that looks late may have been allowed.', evidence: ev });
    }

    // 4. Charges
    {
      const c = vm.charges, out = c.outstanding || 0;
      const recent = (c.items || []).filter((x) => x.outstanding && now - d(x.createdIso) < 365 * DAY).length;
      let pts = 0; if (out) pts += 3; if (c.allAssets && out) pts += 4; if (out >= 5) pts += 3; if (recent) pts += 3;
      const lenders = (c.lenders || []).slice(0, 4).map((l) => l.name + (l.n > 1 ? ` (${l.n})` : ''));
      add({ id: 'charges', title: 'Secured lending (charges)', tone: !out ? 'ok' : pts >= 10 ? 'warn' : 'info', points: closed ? 0 : pts,
        finding: !c.total ? 'No charges registered. No lender holds security over the company\'s assets.' : !out ? `All ${plural(c.total, 'charge')} on record are satisfied.` : `${plural(out, 'charge')} outstanding${c.allAssets ? ', including at least one over all assets' : ''}${lenders.length ? ', held by ' + lenders.join(', ') : ''}.`,
        rule: 'Charges are normal when a company borrows; they mean a lender is paid first if things go wrong. Any outstanding: +3. One covers all assets (a floating charge or debenture): +4. 5 or more outstanding: +3. A new charge in the last 12 months: +3.',
        evidence: recent ? [`${plural(recent, 'charge')} created in the last 12 months`] : [] });
    }

    // 5. Officer churn
    {
      const all = vm.officers.active.concat(vm.officers.former).filter((o) => !/secretary/i.test(o.role));
      const resign = all.filter((o) => o.resignedIso && now - d(o.resignedIso) < 365 * DAY);
      const appoint = all.filter((o) => o.appointedIso && now - d(o.appointedIso) < 365 * DAY && d(o.appointedIso) - d(vm.created) > 30 * DAY);
      const board = vm.officers.active.filter((o) => !/secretary/i.test(o.role)).length;
      const ratio = (resign.length + appoint.length) / Math.max(board, 1);
      let pts = 0, tone = 'ok', finding;
      if (!closed && vm.officers.available && board === 0) { pts = 15; tone = 'bad'; finding = 'No current directors on record.'; }
      else {
        if (resign.length >= 3 || ratio >= 1) pts = 10; else if (resign.length + appoint.length >= 2) pts = 5;
        tone = pts >= 10 ? 'warn' : pts ? 'info' : 'ok';
        finding = resign.length + appoint.length ? `In the last 12 months: ${[appoint.length && plural(appoint.length, 'director') + ' appointed', resign.length && plural(resign.length, 'director') + ' left'].filter(Boolean).join(', ')}. ${plural(board, 'director')} now.` : `No director changes in the last 12 months. ${plural(board, 'director')}${vm.officers.active.length ? `, the longest-serving since ${vm.officers.active.slice().sort((a, b) => d(a.appointedIso) - d(b.appointedIso))[0].appointed}` : ''}.`;
      }
      if (closed) pts = 0;
      add({ id: 'churn', title: 'Director changes', tone, points: pts, finding, rule: 'Counted over the last 12 months, leaving out secretaries and the founding appointments. 3 or more leavers, or as many changes as there are directors: +10. 2 or more changes: +5. No current directors at all: +15. Boards change for many ordinary reasons, such as funding, sale or retirement.',
        evidence: resign.slice(0, 5).map((o) => `${o.name} left ${o.resigned}`).concat(appoint.slice(0, 5).map((o) => `${o.name} appointed ${o.appointed}`)) });
    }

    // 6. Age
    {
      const days = (now - d(vm.created)) / DAY, y = days / 365.25;
      const pts = closed ? 0 : y < 1 ? 10 : y < 2 ? 6 : y < 3 ? 3 : 0;
      add({ id: 'age', title: 'Company age', tone: pts >= 6 ? 'warn' : pts ? 'info' : 'ok', points: pts,
        finding: y < 1 ? `Incorporated ${vm.createdText}, less than a year ago. There's little history to go on.` : `Incorporated ${vm.createdText}, ${plural(Math.floor(y), 'year')} ago.`,
        rule: 'Younger companies have less record to judge, not more risk in themselves. Under 1 year: +10. Under 2: +6. Under 3: +3.' });
    }

    // 7. Accounts picture
    {
      const ser = (Array.isArray(acc) ? acc : []).filter((p) => p.values && p.values.netAssets != null).sort((a, b) => (a.end < b.end ? -1 : 1));
      const last = ser[ser.length - 1], prev = ser[ser.length - 2];
      const mu = ((p.accounts || {}).last_accounts || {}).made_up_to, stale = !!(last && mu && last.end < mu);
      if (vm.accounts.dormant) add({ id: 'accounts', title: 'Accounts', tone: 'info', points: closed ? 0 : 4, finding: 'The latest accounts are dormant, meaning no significant trading in the period.', rule: 'Dormant accounts: +4. They\'re normal for holding or shelf companies, but there\'s no trading record.' });
      else if (last) {
        const A = last.values, B = prev && prev.values, neg = A.netAssets < 0, fall = B && B.netAssets > 0 && A.netAssets < B.netAssets * 0.5;
        const pts = closed || stale ? 0 : neg ? 10 : fall ? 4 : 0, gbp = (n) => (n < 0 ? '−' : '') + '£' + Math.abs(n).toLocaleString('en-GB');
        add({ id: 'accounts', title: 'Balance sheet', tone: pts >= 10 ? 'warn' : pts ? 'info' : neg || fall ? 'info' : 'ok', points: pts, finding: `Net assets ${gbp(A.netAssets)} at ${fmt(d(last.end))}${B ? ` (${gbp(B.netAssets)} a year earlier)` : ''}.${stale ? ' These are the latest figures that can be read automatically; later accounts were filed as PDF.' : ''}`, rule: 'Read from the tagged accounts. Net liabilities, where the company owes more than it owns: +10. Net assets more than halved in a year: +4. Not scored if newer accounts exist that can\'t be read. Many start-ups and funded companies run at net liabilities for a while.' });
      } else add({ id: 'accounts', title: 'Accounts', tone: 'info', finding: vm.accounts.lastMadeUp ? `Latest accounts to ${vm.accounts.lastMadeUp} (${(vm.accounts.lastType || '').toLowerCase() || 'type not given'}). The figures aren't machine-readable here, so they aren't scored.` : 'No accounts filed yet.', rule: 'Only scored when figures can be read from tagged (iXBRL) accounts.' });
    }

    // 8. Address and ownership transparency
    {
      const ev = []; let pts = 0;
      if (p.registered_office_is_in_dispute) { pts += 8; ev.push('Registered office address is in dispute'); }
      if (p.undeliverable_registered_office_address) { pts += 8; ev.push('Post to the registered office is being returned'); }
      const o = vm.ownership, noPsc = o.available && !o.current.length && !o.statements.length && !o.exemptions.length && !vm.type.code.match(/plc|llp|charit/);
      if (noPsc && !closed) { pts += 4; ev.push('No people with significant control and no statement explaining why'); }
      if (o.sanctioned) { pts += 25; ev.push('A person with significant control is marked as sanctioned'); }
      add({ id: 'record', title: 'Address and ownership record', tone: pts >= 8 ? 'warn' : pts ? 'info' : 'ok', points: closed ? 0 : pts,
        finding: ev.length ? ev[0] + (ev.length > 1 ? ` (and ${ev.length - 1} more).` : '.') : 'Registered office is in good standing, and ownership is declared or explained.', rule: 'Disputed registered office: +8. Undeliverable registered office: +8. Ownership not declared or explained (not for PLCs or LLPs): +4. A sanctioned PSC: +25.', evidence: ev });
    }

    const score = Math.min(100, S.reduce((a, s) => a + s.points, 0));
    const level = closed ? 'closed' : score >= 40 ? 'high' : score >= 15 ? 'some' : 'low';
    const L = { closed: ['Closed', 'neutral'], high: ['High concern', 'bad'], some: ['Some concern', 'warn'], low: ['Low concern', 'ok'] }[level];
    const top = S.filter((s) => s.points > 0).sort((a, b) => b.points - a.points);
    const headline = closed ? `${vm.name.replace(/\b(\w)(\w*)/g, (m, a, b) => a + b.toLowerCase())} is closed.` : level === 'low' ? 'Likely low risk on the public record.' : level === 'some' ? 'Some things on the record are worth checking.' : 'The public record shows serious warning signs.';
    const summary = closed ? 'This is shown as closed rather than scored. The record below is history.' : top.length ? 'Mainly: ' + top.slice(0, 3).map((s) => s.title.toLowerCase()).join(', ') + '.' : 'Nothing on the record stands out.';
    return { level, label: L[0], tone: L[1], score: closed ? null : score, headline, summary, signals: S, lateFilings: lateFilings(raw, vm) };
  }
  return { assess, lateFilings };
});
