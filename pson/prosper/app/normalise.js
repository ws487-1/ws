/* Prosper app: normalisation layer (from the cards prototype).
   Pure functions: raw Companies House API responses in, consistent view models out.
   Every field is optional on input; every view-model field has a defined type on output
   (strings default to '', lists to [], numbers to 0 or null), so components never need to guard.
   Field names follow the CH public data API spec (developer-specs.company-information.service.gov.uk). */
(function (root) {
  'use strict';
  let E = {}; // enumerations (labels, filing and PSC descriptions), set with setEnums()
  const setEnums = (e) => { E = e || {}; };

  /* ---------- primitives ---------- */
  const ok = (x) => !!x && typeof x === 'object' && !x._http && !x.errors; // API error / 404 => treat as absent
  const arr = (x) => (Array.isArray(x) ? x : []);
  const str = (x) => (x == null ? '' : String(x).trim());
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const isoOk = (d) => /^\d{4}-\d{2}-\d{2}/.test(str(d)) && !str(d).startsWith('9999');
  const fmtDate = (d) => { if (!isoOk(d)) return ''; const [y, m, dd] = str(d).slice(0, 10).split('-'); return `${+dd} ${MON[+m - 1]} ${y}`; };
  const fmtMonthYear = (o) => (o && o.year ? (o.month ? MON[o.month - 1] + ' ' : '') + o.year : '');
  const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
  const today = () => new Date().toISOString().slice(0, 10);
  const yearsSince = (d, to) => (isoOk(d) ? Math.floor(daysBetween(d, to || today()) / 365.25) : null);
  const label = (sec, code) => {
    if (!code) return '';
    const v = E[sec] && E[sec][code];
    if (v) return v.replace(/\*\*/g, '').trim();
    const s = String(code).replace(/[-_]/g, ' ');
    return s.charAt(0).toUpperCase() + s.slice(1);
  };
  const sentence = (s) => { s = str(s); return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : ''; };
  // "SMITH, John Paul" -> "John Paul Smith"; "Mr John SMITH" -> "Mr John Smith"; company names left alone
  const titleWord = (w) => (/^(ltd|plc|llp|uk|ii|iii|iv)$/i.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  const tidyCaps = (s) => str(s).replace(/[A-Za-z][A-Za-z'’]*/g, (w) => (w === w.toUpperCase() && w.length > 1 ? w.split(/(['’-])/).map(titleWord).join('') : w));
  function personName(raw, corporate) {
    const s = str(raw); if (!s) return '';
    if (corporate) return s;
    const m = /^([^,]+),\s*(.+)$/.exec(s);
    return tidyCaps(m ? `${m[2]} ${m[1]}` : s);
  }
  const address = (a) => {
    a = a || {};
    const lines = [[a.care_of && 'c/o ' + a.care_of], [a.po_box && 'PO Box ' + a.po_box], [a.premises, a.address_line_1], [a.address_line_2], [a.locality], [a.region], [a.postal_code], [a.country]]
      .map((p) => p.filter(Boolean).map(str).join(' ')).filter(Boolean);
    return { lines, oneLine: lines.join(', '), town: str(a.locality), postcode: str(a.postal_code), country: str(a.country) };
  };
  const tone = { ok: 'ok', warn: 'warn', bad: 'bad', none: 'neutral' };

  /* ---------- company profile ---------- */
  /* Status text colour. green = trading/open, red = dissolved or any insolvency state, amber = in-between, grey = closed/ended or unknown. */
  const STATUS_COLOUR = { active: 'green', open: 'green', registered: 'green', dissolved: 'red', liquidation: 'red', receivership: 'red', administration: 'red', 'voluntary-arrangement': 'red', 'insolvency-proceedings': 'red', 'converted-closed': 'amber', closed: 'grey', removed: 'grey' };
  const DETAIL_COLOUR = { 'active-proposal-to-strike-off': 'amber', 'petition-to-restore-dissolved': 'amber' };
  function statusColour(code) { return STATUS_COLOUR[str(code)] || 'grey'; }
  function statusTone(code) { const c = statusColour(code); return c === 'green' ? 'ok' : c === 'red' ? 'bad' : c === 'amber' ? 'warn' : 'neutral'; }
  function deadline(lbl, due, overdue, extra) {
    if (!isoOk(due)) return null;
    const d = daysBetween(today(), due);
    const t = overdue || d < 0 ? 'bad' : d <= 30 ? 'warn' : 'ok';
    const rel = d < 0 ? `${-d} day${d === -1 ? '' : 's'} overdue` : d === 0 ? 'due today' : d < 60 ? `in ${d} days` : `in ${Math.round(d / 30.4)} months`;
    return { label: lbl, due, dueText: fmtDate(due), days: d, relText: overdue && d >= 0 ? 'overdue' : rel, tone: t, note: extra || '' };
  }
  function profile(p, live) {
    p = ok(p) ? p : {};
    const acc = p.accounts || {}, la = acc.last_accounts || {}, na = acc.next_accounts || {}, cs = p.confirmation_statement || {};
    const ard = acc.accounting_reference_date || {};
    const ardText = +ard.day >= 1 && +ard.day <= 31 && +ard.month >= 1 && +ard.month <= 12 ? `${+ard.day} ${MON[+ard.month - 1]}` : '';
    const status = str(p.company_status);
    const active = ['active', 'open', 'registered'].includes(status) || (!status && !p.date_of_cessation);
    const flags = [];
    if (p.has_insolvency_history) flags.push({ label: 'Insolvency history', tone: 'bad' });
    if (p.has_been_liquidated && status !== 'liquidation') flags.push({ label: 'Has been liquidated', tone: 'bad' });
    if (active && (acc.overdue || na.overdue)) flags.push({ label: 'Accounts overdue', tone: 'bad' });
    if (active && cs.overdue) flags.push({ label: 'Confirmation statement overdue', tone: 'bad' });
    if (p.registered_office_is_in_dispute) flags.push({ label: 'Registered office in dispute', tone: 'warn' });
    if (p.undeliverable_registered_office_address) flags.push({ label: 'Mail to registered office undeliverable', tone: 'warn' });
    if (p.has_super_secure_pscs) flags.push({ label: 'Has super-secure PSCs', tone: 'neutral' });
    if (p.is_community_interest_company) flags.push({ label: 'Community interest company', tone: 'neutral' });
    if (p.partial_data_available) flags.push({ label: 'Partial data only', tone: 'neutral' });
    for (const a of arr(p.corporate_annotation)) flags.push({ label: sentence(a.type || a.description || 'Annotation'), tone: 'warn', note: str(a.description) });
    const deadlines = active ? [
      deadline('Accounts', na.due_on || acc.next_due, acc.overdue || na.overdue, isoOk(acc.next_made_up_to || na.period_end_on) ? 'for the period to ' + fmtDate(acc.next_made_up_to || na.period_end_on) : ''),
      deadline('Confirmation statement', cs.next_due, cs.overdue, isoOk(cs.next_made_up_to) ? 'made up to ' + fmtDate(cs.next_made_up_to) : ''),
    ].filter(Boolean).sort((a, b) => a.days - b.days) : [];
    const created = str(p.date_of_creation), ceased = str(p.date_of_cessation);
    const fc = p.foreign_company_details || {};
    return {
      name: str(p.company_name) || 'Unnamed company',
      number: str(p.company_number),
      url: p.company_number ? 'https://find-and-update.company-information.service.gov.uk/company/' + p.company_number : '',
      status: { code: status, label: label('company_status', status) || 'Unknown', detail: label('company_status_detail', p.company_status_detail), detailColour: DETAIL_COLOUR[str(p.company_status_detail)] || 'grey', tone: statusTone(status), colour: statusColour(status), active },
      type: { code: str(p.type), label: label('company_type', p.type), subtype: label('company_subtype', p.subtype) },
      jurisdiction: label('jurisdiction', p.jurisdiction), jurisdictionCode: str(p.jurisdiction),
      created, createdText: fmtDate(created), ceased, ceasedText: fmtDate(ceased),
      ageYears: yearsSince(created, ceased || undefined),
      address: address(p.registered_office_address),
      serviceAddress: p.service_address ? address(p.service_address) : null,
      sic: arr(p.sic_codes).map((c) => ({ code: str(c), desc: (E.sic_descriptions && E.sic_descriptions[c]) || '' })),
      previousNames: arr(p.previous_company_names).map((x) => ({ name: str(x.name), from: fmtDate(x.effective_from), to: fmtDate(x.ceased_on) })),
      accounts: {
        refDate: ardText,
        lastMadeUp: fmtDate(la.made_up_to), lastType: la.type && la.type !== 'null' ? label('account_type', la.type) : '', lastTypeCode: la.type === 'null' ? '' : str(la.type),
        lastPeriod: isoOk(la.period_start_on) && isoOk(la.period_end_on) ? `${fmtDate(la.period_start_on)} – ${fmtDate(la.period_end_on)}` : '',
        nextDue: fmtDate(na.due_on || acc.next_due),
        nextPeriod: isoOk(na.period_start_on) && isoOk(na.period_end_on) ? `${fmtDate(na.period_start_on)} – ${fmtDate(na.period_end_on)}` : '',
        overdue: !!(acc.overdue || na.overdue),
        dormant: /dormant/.test(str(la.type)),
      },
      confirmation: { last: fmtDate(cs.last_made_up_to), nextDue: fmtDate(cs.next_due), nextMadeUp: fmtDate(cs.next_made_up_to), overdue: !!cs.overdue },
      deadlines, flags,
      overseas: p.external_registration_number || fc.registration_number ? {
        regNumber: str(p.external_registration_number || fc.registration_number), country: str(fc.originating_registry && fc.originating_registry.country),
        registry: str(fc.originating_registry && fc.originating_registry.name), legalForm: str(fc.legal_form), business: str(fc.business_activity),
      } : null,
      hasCharges: !!p.has_charges, hasInsolvency: !!p.has_insolvency_history, canFile: p.can_file !== false,
    };
  }

  /* ---------- officers ---------- */
  function idv(v) {
    if (!v || !isoOk(v.identity_verified_on || v.appointment_verification_start_on)) return null;
    return { verifiedOn: fmtDate(v.identity_verified_on || v.appointment_verification_start_on), dueOn: fmtDate(v.appointment_verification_statement_due_on), acsp: str(v.authorised_corporate_service_provider_name) };
  }
  function officer(o) {
    const corporate = !!(o.identification || /corporate/.test(str(o.officer_role)));
    const role = str(o.officer_role);
    const id = o.identification || {};
    return {
      name: personName(o.name, corporate), rawName: str(o.name), corporate,
      role, roleLabel: label('officer_role', role) || sentence(role),
      appointed: fmtDate(o.appointed_on) || (o.is_pre_1992_appointment ? 'before 1992' : ''), resigned: fmtDate(o.resigned_on),
      appointedIso: str(o.appointed_on), appointedBefore: str(o.appointed_before), pre1992: !!o.is_pre_1992_appointment, appointmentKey: str(o.links && o.links.self), resignedIso: str(o.resigned_on),
      tenureYears: yearsSince(o.appointed_on, o.resigned_on || undefined),
      occupation: sentence(o.occupation), nationality: str(o.nationality), residence: str(o.country_of_residence),
      born: fmtMonthYear(o.date_of_birth), age: approxAge(o.date_of_birth),
      address: address(o.address).oneLine,
      appointmentsLink: str(o.links && o.links.officer && o.links.officer.appointments),
      officerId: (/\/officers\/([^/]+)\/appointments/.exec(str(o.links && o.links.officer && o.links.officer.appointments)) || [])[1] || '',
      formerNames: arr(o.former_names).map((f) => [f.forenames, f.surname].filter(Boolean).join(' ')).filter(Boolean),
      registration: corporate ? { number: str(id.registration_number), legalForm: str(id.legal_form), place: str(id.place_registered || id.country_registered) } : null,
      idv: idv(o.identity_verification_details),
      responsibilities: str(o.responsibilities),
      personNumber: str(o.person_number),
    };
  }
  const ROLE_ORDER = ['director', 'corporate-director', 'llp-designated-member', 'llp-member', 'secretary', 'corporate-secretary'];
  function officers(raw, recentDays = 365) {
    const r = ok(raw) ? raw : {};
    const all = arr(r.items).map(officer);
    const rank = (o) => { const i = ROLE_ORDER.indexOf(o.role); return i < 0 ? 99 : i; };
    const active = all.filter((o) => !o.resignedIso).sort((a, b) => rank(a) - rank(b) || a.appointedIso.localeCompare(b.appointedIso));
    const former = all.filter((o) => o.resignedIso).sort((a, b) => b.resignedIso.localeCompare(a.resignedIso));
    const cut = new Date(Date.now() - recentDays * 864e5).toISOString().slice(0, 10);
    const changes = [
      ...all.filter((o) => o.appointedIso >= cut).map((o) => ({ kind: 'appointed', date: o.appointedIso, dateText: o.appointed, name: o.name, role: o.roleLabel })),
      ...former.filter((o) => o.resignedIso >= cut).map((o) => ({ kind: 'resigned', date: o.resignedIso, dateText: o.resigned, name: o.name, role: o.roleLabel })),
    ].sort((a, b) => b.date.localeCompare(a.date));
    const roleCounts = {}; for (const o of active) roleCounts[o.roleLabel] = (roleCounts[o.roleLabel] || 0) + 1;
    const nat = {}; for (const o of active) if (o.nationality) nat[o.nationality] = (nat[o.nationality] || 0) + 1;
    const ages = active.map((o) => o.age).filter((x) => x != null);
    return {
      available: ok(raw), complete: !!raw && raw._complete === true, active, former, changes, all,
      counts: { active: r.active_count != null ? r.active_count : active.length, resigned: r.resigned_count != null ? r.resigned_count : former.length, total: r.total_results || all.length, loaded: all.length },
      roleCounts, nationalities: Object.entries(nat).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ name: k, count: v })),
      medianAge: ages.length ? ages.sort((a, b) => a - b)[Math.floor(ages.length / 2)] : null,
      verifiedCount: active.filter((o) => o.idv).length,
    };
  }

  /* ---------- ownership (PSC + statements + exemptions) ---------- */
  function controlBand(natures) {
    const n = natures.join(' ');
    return /75-to-100/.test(n) ? '75–100%' : /50-to-75/.test(n) ? '50–75%' : /25-to-50/.test(n) ? '25–50%' : /right-to-appoint-and-remove/.test(n) ? 'Board control' : /significant-influence/.test(n) ? 'Influence' : '';
  }
  /* One plain line per PSC: percentage bands combined, plus a second line only for a different kind of control. */
  const BAND = (n) => (/75-to-100/.test(n) ? '75–100%' : /50-to-75/.test(n) ? '50–75%' : /25-to-50/.test(n) ? '25–50%' : /more-than-25/.test(n) ? 'over 25%' : '');
  function controlSummary(natures) {
    const kinds = [['shares', /^ownership-of-shares/], ['voting rights', /^voting-rights/], ['surplus assets', /right-to-share-surplus-assets/]];
    const bands = [];
    for (const [name, re] of kinds) { const n = natures.find((x) => re.test(x)); if (n) bands.push({ name, band: BAND(n), via: /as-trust|over-trust/.test(n) ? 'trust' : /as-firm|over-firm/.test(n) ? 'firm' : '' }); }
    let main = '';
    if (bands.length) {
      const same = bands.every((b) => b.band === bands[0].band);
      main = same ? `${bands[0].band} ${bands.map((b) => b.name).join(bands.length > 2 ? ', ' : ' and ').replace(/, ([^,]+)$/, ' and $1')}`
        : bands.map((b) => `${b.name === 'voting rights' ? 'Voting' : b.name === 'surplus assets' ? 'Surplus assets' : 'Shares'} ${b.band}`).join(' · ');
      const via = bands.find((b) => b.via); if (via) main += via.via === 'trust' ? ' (through a trust)' : ' (as a member of a firm)';
    }
    const other = [];
    if (natures.some((x) => /right-to-appoint-and-remove-(directors|members|person)/.test(x))) other.push(natures.some((x) => /appoint-and-remove-members/.test(x)) ? 'Can appoint or remove members' : 'Can appoint or remove directors');
    if (natures.some((x) => /significant-influence-or-control/.test(x))) other.push('Significant influence or control');
    if (natures.some((x) => /^registered-owner-as-nominee/.test(x))) other.push('Land held as nominee');
    if (!main && other.length) main = other.shift();
    return { main, other: other.join(' · ') };
  }
  /* The PSC's own Companies House ID: the segment before /notifications in links.persons_with_significant_control.notifications. */
  const pscIdOf = (x) => (/\/persons-with-significant-control\/([^/]+)\/notifications/.exec(str(x && x.links && x.links.persons_with_significant_control && x.links.persons_with_significant_control.notifications)) || [])[1] || '';
  /* Each nature of control in Companies House's own short wording, one line each (shares, votes and board rights kept separate). */
  const controlLines = (natures) => natures.map((c) => ((E.psc_short_description && E.psc_short_description[c]) || label('psc_description', c)).replace(/\*\*/g, '').trim()).filter(Boolean);
  function psc(x) {
    const kind = str(x.kind);
    const corporate = /corporate|legal-person/.test(kind), secure = /super-secure/.test(kind);
    const id = x.identification || {};
    const natures = arr(x.natures_of_control).map(str);
    const role = /beneficial-owner/.test(kind) ? 'Beneficial owner' : natures.some((n) => /^ownership-of-shares/.test(n)) ? 'Owner' : 'Person with significant control';
    return {
      name: secure ? 'Super-secure person' : personName(x.name, corporate),
      pscId: pscIdOf(x), role, natures,
      kind, kindLabel: secure ? 'Protected' : corporate ? (/legal-person/.test(kind) ? 'Legal person' : 'Company') : 'Individual',
      beneficialOwner: /beneficial-owner/.test(kind),
      corporate, secure, description: str(x.description),
      controls: controlLines(natures),
      band: controlBand(natures), summary: controlSummary(natures),
      shares: (/ownership-of-shares-([0-9]+)-to-([0-9]+)/.exec(natures.join(' ')) || []).slice(1).join('–'),
      notified: fmtDate(x.notified_on), ceased: fmtDate(x.ceased_on), isCeased: !!(x.ceased || x.ceased_on),
      nationality: str(x.nationality), residence: str(x.country_of_residence), born: fmtMonthYear(x.date_of_birth),
      address: address(x.address || x.principal_office_address).oneLine,
      ukCompany: corporate && /^(england|wales|scotland|northern ireland|united kingdom|uk|great britain|companies house|registrar of companies)/i.test(str(id.place_registered || id.country_registered) + ' ' + str(id.legal_authority)) && /^[A-Z]{0,2}\d{5,8}$/i.test(str(id.registration_number).replace(/\s/g, '')) ? str(id.registration_number).replace(/\s/g, '').toUpperCase().padStart(8, '0') : '',
      registration: corporate ? { legalForm: str(id.legal_form), authority: str(id.legal_authority), register: str(id.place_registered), country: str(id.country_registered), number: str(id.registration_number) } : null,
      sanctioned: x.is_sanctioned === true,
      idv: idv(x.identity_verification_details),
    };
  }
  const STATEMENT_PLAIN = {
    'no-individual-or-entity-with-signficant-control': 'No one has significant control, according to the company.',
    'psc-exists-but-not-identified': 'The company says it has a PSC but has not identified them.',
    'psc-details-not-confirmed': 'A PSC has been identified, but their details are not confirmed yet.',
    'steps-to-find-psc-not-yet-completed': 'The company has not finished checking who has significant control.',
    'psc-contacted-but-no-response': 'The company asked a possible PSC for details and got no reply.',
    'psc-has-failed-to-confirm-changed-details': '{linked} has not confirmed changed details.',
    'restrictions-notice-issued-to-psc': 'The company has issued a restrictions notice to a PSC.',
    'awaiting-confirmation-from-psc': 'The company is waiting for a PSC to confirm their details.',
  };
  const STATEMENT_SHORT = { 'no-individual-or-entity-with-signficant-control': 'Company says none', 'psc-exists-but-not-identified': 'Not identified yet', 'psc-details-not-confirmed': 'Details not confirmed', 'steps-to-find-psc-not-yet-completed': 'Checks not finished', 'psc-contacted-but-no-response': 'No reply from PSC', 'awaiting-confirmation-from-psc': 'Awaiting confirmation' };
  function plainStatement(code, linked) {
    const base = code.replace(/-partnership$/, '');
    const t = STATEMENT_PLAIN[base];
    if (t) return t.replace('{linked}', linked || 'A PSC').replace(/the company/gi, (m) => (/-partnership$/.test(code) ? (m[0] === 'T' ? 'The partnership' : 'the partnership') : m));
    return ((E.psc_statement_description && E.psc_statement_description[code]) || label('', code)).replace('{linked_psc_name}', linked || 'A PSC');
  }
  function ownership(rawPsc, rawStatements, rawExemptions) {
    const list = ok(rawPsc) ? arr(rawPsc.items).map(psc) : [];
    const current = list.filter((p) => !p.isCeased), ceased = list.filter((p) => p.isCeased);
    const statements = ok(rawStatements) ? arr(rawStatements.items).filter((s) => !s.ceased_on).map((s) => ({
      text: (E.psc_statement_description && E.psc_statement_description[s.statement]) || label('', s.statement),
      plain: plainStatement(str(s.statement), str(s.linked_psc_name)),
      code: str(s.statement), notified: fmtDate(s.notified_on), linkedPsc: str(s.linked_psc_name), restrictions: !!s.restrictions_notice_withdrawal_reason || /restrictions-notice/.test(str(s.statement)),
    })) : [];
    const exemptions = [];
    if (ok(rawExemptions) && rawExemptions.exemptions) {
      for (const [k, v] of Object.entries(rawExemptions.exemptions)) {
        const code = str(v.exemption_type) || k.replace(/_/g, '-');
        for (const it of arr(v.items)) exemptions.push({ code, text: (E.ex_exemption_type && E.ex_exemption_type[code]) || label('', code), from: fmtDate(it.exempt_from), to: fmtDate(it.exempt_to), current: !it.exempt_to });
      }
    }
    /* Plain lines explaining why there is no PSC (or what the company has said about its PSCs). */
    const traded = exemptions.some((e) => e.current && /trading-on|admitted-on-market|disclosure-transparency/.test(e.code));
    const notes = [];
    if (!current.length && traded) notes.push('Publicly traded. No PSC register entries.');
    else if (!current.length && exemptions.some((e) => e.current)) notes.push('Exempt from keeping a PSC register.');
    for (const st of statements) notes.push(st.plain);
    if (!current.length && !notes.length) notes.push(ok(rawPsc) || rawPsc ? 'No PSC register entries.' : 'Ownership data was not available.');
    const explanation = current.length ? '' : notes[0];
    return {
      available: ok(rawPsc), current, ceased, statements, exemptions, explanation, notes, traded,
      counts: { active: ok(rawPsc) && rawPsc.active_count != null ? rawPsc.active_count : current.length, ceased: ok(rawPsc) && rawPsc.ceased_count != null ? rawPsc.ceased_count : ceased.length },
      sanctioned: current.some((p) => p.sanctioned),
    };
  }

  /* ---------- charges ---------- */
  function charge(c) {
    const p = c.particulars || {}, status = str(c.status);
    // Lender names sometimes carry the address ("X Limited, 45 Ludgate Hill, London…"): keep the name only
    const ent = arr(c.persons_entitled).map((x) => str(x.name).replace(/^(.*?\b(?:limited|ltd|plc|llp|bank|n\.a\.|s\.a\.|ag|inc|corporation|trustees?))\b[.,]?\s*,.*$/i, '$1')).filter(Boolean);
    const features = [];
    if (p.floating_charge_covers_all) features.push('Floating charge over all assets');
    else if (p.contains_floating_charge) features.push('Floating charge');
    if (p.contains_fixed_charge) features.push('Fixed charge');
    if (p.contains_negative_pledge) features.push('Negative pledge');
    if (p.chargor_acting_as_bare_trustee) features.push('Chargor is bare trustee');
    return {
      code: str(c.charge_code) || (c.charge_number ? 'No. ' + c.charge_number : ''),
      title: (c.classification && str(c.classification.description)) || 'Charge',
      created: fmtDate(c.created_on), createdIso: str(c.created_on), delivered: fmtDate(c.delivered_on), acquired: fmtDate(c.acquired_on),
      status, statusLabel: ({ outstanding: 'Outstanding', 'fully-satisfied': 'Satisfied', 'part-satisfied': 'Part satisfied', satisfied: 'Satisfied' })[status] || sentence(status) || 'Unknown',
      tone: status === 'outstanding' ? 'warn' : status === 'part-satisfied' ? 'warn' : 'neutral',
      outstanding: status === 'outstanding' || status === 'part-satisfied',
      satisfied: fmtDate(c.satisfied_on),
      entitled: ent, moreEntitled: !!c.more_than_four_persons_entitled,
      features, coversAll: !!p.floating_charge_covers_all,
      description: str(p.description), secured: str(c.secured_details && c.secured_details.description),
    };
  }
  function charges(raw) {
    if (!ok(raw)) return { available: false, total: 0, outstanding: 0, satisfied: 0, partSatisfied: 0, items: [], lenders: [] };
    const items = arr(raw.items).map(charge).sort((a, b) => (b.outstanding - a.outstanding) || b.createdIso.localeCompare(a.createdIso));
    const total = raw.total_count || items.length, satisfied = raw.satisfied_count || 0, part = raw.part_satisfied_count || 0;
    const lenders = {}; for (const c of items) if (c.outstanding) for (const e of c.entitled) lenders[e] = (lenders[e] || 0) + 1;
    return { available: true, total, satisfied, partSatisfied: part, outstanding: Math.max(0, total - satisfied), items, loaded: items.length,
      lenders: Object.entries(lenders).sort((a, b) => b[1] - a[1]).map(([name, n]) => ({ name, n })), allAssets: items.some((c) => c.outstanding && c.coversAll) };
  }

  /* ---------- insolvency ---------- */
  function insolvency(raw) {
    if (!ok(raw)) return { available: false, cases: [], status: [] };
    return {
      available: true, status: arr(raw.status).map((s) => label('company_status', s)),
      cases: arr(raw.cases).map((c) => ({
        type: label('insolvency_case_type', c.type), number: str(c.number), notes: arr(c.notes).map(str),
        dates: arr(c.dates).map((d) => ({ label: label('insolvency_case_date_type', d.type), date: fmtDate(d.date) })).filter((d) => d.date),
        practitioners: arr(c.practitioners).map((p) => ({ name: tidyCaps(p.name), role: sentence(str(p.role).replace(/-/g, ' ')), address: address(p.address).oneLine, appointed: fmtDate(p.appointed_on), ceased: fmtDate(p.ceased_to_act_on) })),
      })),
    };
  }

  /* ---------- filing history ---------- */
  const FH_CAT = { accounts: 'Accounts', 'confirmation-statement': 'Confirmation statement', officers: 'Officers', address: 'Address', capital: 'Capital', incorporation: 'Incorporation', mortgage: 'Charges', 'persons-with-significant-control': 'PSC', resolution: 'Resolutions', 'change-of-name': 'Name change', insolvency: 'Insolvency', liquidation: 'Insolvency', gazette: 'Gazette', 'annual-return': 'Annual return', miscellaneous: 'Other', 'officer-registers': 'Registers', auditors: 'Auditors', 'dissolution': 'Dissolution', other: 'Other' };
  function fillTemplate(tpl, vals) {
    vals = vals || {};
    let s = str(tpl).replace(/\{([a-z_]+)\}/g, (m, k) => { const v = vals[k]; if (v == null || v === '') return ''; return isoOk(v) ? fmtDate(v) : str(v).replace(/^[,\s]+/, ''); });
    if (Array.isArray(vals.capital) && vals.capital.length && !/capital/.test(tpl)) s += ' · ' + vals.capital.map((c) => `${c.currency} ${c.figure}`).join(', ');
    return s.replace(/\s+/g, ' ').replace(/\s([,.])/g, '$1').trim();
  }
  function filingTitle(f) {
    const code = str(f.description), vals = f.description_values || {};
    if (code === 'legacy' || !code) return { title: str(vals.description) || str(f.type) || 'Filing', strong: '' };
    const tpl = E.fh_description && E.fh_description[code];
    if (!tpl) return { title: str(vals.description) || label('', code), strong: '' };
    const strong = (/\*\*(.+?)\*\*/.exec(tpl) || [])[1] || '';
    return { title: fillTemplate(tpl.replace(/\*\*/g, ''), vals), strong: fillTemplate(strong, vals) };
  }
  function filings(raw) {
    if (!ok(raw)) return { available: false, total: 0, items: [], years: [] };
    const items = arr(raw.items).map((f) => {
      const t = filingTitle(f);
      return {
        id: str(f.transaction_id), date: fmtDate(f.date), dateIso: str(f.date), year: str(f.date).slice(0, 4),
        category: str(f.category), categoryLabel: FH_CAT[f.category] || sentence(str(f.category).replace(/-/g, ' ')) || 'Other',
        typeCode: str(f.type), title: t.title, strong: t.strong, pages: f.pages || 0, paper: !!f.paper_filed,
        docLink: str(f.links && f.links.document_metadata),
        viewUrl: f.links && f.links.self ? 'https://find-and-update.company-information.service.gov.uk' + f.links.self + '/document?format=pdf&download=0' : '',
        pdfUrl: f.links && f.links.self && f.links.document_metadata ? 'https://find-and-update.company-information.service.gov.uk' + f.links.self + '/document?format=pdf&download=1' : '',
        resolutions: arr(f.resolutions).map((r) => filingTitle(r).title).filter(Boolean),
        annotations: arr(f.annotations).map((a) => filingTitle(a).title || str(a.annotation)).filter(Boolean),
      };
    });
    const years = []; for (const it of items) { let y = years[years.length - 1]; if (!y || y.year !== it.year) years.push(y = { year: it.year, items: [] }); y.items.push(it); }
    const lastAccounts = items.find((i) => i.category === 'accounts');
    return { available: true, total: raw.total_count || items.length, loaded: items.length, items, years, lastAccounts: lastAccounts || null };
  }

  /* ---------- appointments (person drill-down) ---------- */
  function appointments(raw) {
    if (!ok(raw)) return null;
    const items = arr(raw.items).map((a) => ({
      company: tidyCaps((a.appointed_to && a.appointed_to.company_name) || ''), number: str(a.appointed_to && a.appointed_to.company_number),
      status: label('company_status', a.appointed_to && a.appointed_to.company_status), statusCode: str(a.appointed_to && a.appointed_to.company_status), colour: statusColour(a.appointed_to && a.appointed_to.company_status),
      appointedIso: str(a.appointed_on), resignedIso: str(a.resigned_on), nationality: str(a.nationality), residence: str(a.country_of_residence),
      role: label('officer_role', a.officer_role), appointed: fmtDate(a.appointed_on), resigned: fmtDate(a.resigned_on), occupation: sentence(a.occupation),
    }));
    return { name: personName(raw.name, raw.is_corporate_officer), born: fmtMonthYear(raw.date_of_birth), total: raw.total_results || items.length, active: raw.active_count || 0, resigned: raw.resigned_count || 0, items, loaded: items.length };
  }

  /* ---------- person page: personal data and appointment statistics from one or more appointment lists ---------- */
  const FINISHED = ['dissolved', 'liquidation'];
  /* Lower bound of the age: in the birth month (or with no month) the birthday is treated as not yet reached. */
  function approxAge(dob) {
    if (!dob || !dob.year) return null;
    const now = new Date(); return now.getFullYear() - dob.year - ((dob.month || 12) >= now.getMonth() + 1 ? 1 : 0);
  }
  function person(raws) {
    const rs = arr(raws).filter(ok);
    if (!rs.length) return null;
    const first = rs[0];
    const all = [].concat(...rs.map((r) => arr(r.items)));
    const uniq = (xs) => xs.map(str).filter(Boolean).filter((x, i, a) => a.indexOf(x) === i);
    const corporate = rs.some((r) => r.is_corporate_officer);
    const items = all.map((a) => {
      const to = a.appointed_to || {};
      const statusCode = str(to.company_status);
      const appointedIso = str(a.appointed_on), resignedIso = str(a.resigned_on);
      // Tenure only when both ends are known: appointment date, and a resignation date or still current at a live company
      const end = resignedIso || (FINISHED.includes(statusCode) || statusCode === 'converted-closed' || statusCode === 'closed' ? '' : today());
      const tenureDays = isoOk(appointedIso) && isoOk(end) ? daysBetween(appointedIso, end) : null;
      return {
        company: tidyCaps(str(to.company_name)), number: str(to.company_number),
        status: label('company_status', statusCode), statusCode, colour: statusColour(statusCode),
        role: label('officer_role', a.officer_role) || sentence(a.officer_role), roleCode: str(a.officer_role),
        appointed: fmtDate(appointedIso) || (a.is_pre_1992_appointment ? 'before 1992' : isoOk(a.appointed_before) ? 'before ' + fmtDate(a.appointed_before) : ''),
        appointedIso, appointedBefore: str(a.appointed_before), pre1992: !!a.is_pre_1992_appointment, resignedIso, resigned: fmtDate(resignedIso), current: !resignedIso,
        tenureDays, occupation: sentence(a.occupation), nationality: str(a.nationality), residence: str(a.country_of_residence),
        address: address(a.address).oneLine,
      };
    }).sort((a, b) => (b.current - a.current) || (b.resignedIso || b.appointedIso).localeCompare(a.resignedIso || a.appointedIso));
    const dob = rs.map((r) => r.date_of_birth).find((d) => d && d.year) || null;
    const formerNames = uniq([].concat(...all.map((a) => arr(a.former_names).map((f) => [f.forenames, f.surname].filter(Boolean).join(' ')))));
    const withTenure = items.filter((x) => x.tenureDays != null && x.tenureDays >= 0);
    const longest = withTenure.slice().sort((a, b) => b.tenureDays - a.tenureDays)[0] || null;
    const yrs = (d) => Math.round((d / 365.25) * 10) / 10;
    const total = rs.reduce((n, r) => n + (+r.total_results || arr(r.items).length), 0);
    return {
      name: personName(first.name, corporate), rawName: str(first.name), corporate,
      born: fmtMonthYear(dob), dob, age: approxAge(dob),
      nationalities: uniq(all.map((a) => a.nationality)), residences: uniq(all.map((a) => a.country_of_residence)),
      addresses: uniq(items.map((x) => x.address)), formerNames,
      roles: uniq(items.map((x) => x.role)),
      items, total, loaded: items.length,
      active: items.filter((x) => x.current && !['dissolved', 'converted-closed', 'removed', 'closed'].includes(x.statusCode)).length, resigned: items.filter((x) => !x.current).length,
      openClosed: items.filter((x) => x.current && ['dissolved', 'converted-closed', 'removed', 'closed'].includes(x.statusCode)).length,
      finished: items.filter((x) => FINISHED.includes(x.statusCode)).length,
      longest: longest ? { years: yrs(longest.tenureDays), company: longest.company, number: longest.number, role: longest.role } : null,
      averageYears: withTenure.length >= 2 ? yrs(withTenure.reduce((n, x) => n + x.tenureDays, 0) / withTenure.length) : null,
      tenureBase: withTenure.length,
    };
  }

  /* ---------- PSC notifications: every company where this PSC ID is recorded as having significant control ---------- */
  function pscNotifications(raw) {
    if (!ok(raw)) return null;
    const items = arr(raw.items).map((x) => {
      const natures = arr(x.natures_of_control).map(str);
      const kind = str(x.kind);
      return {
        number: str(x.notified_to && x.notified_to.company_number), kind,
        corporate: /corporate|legal-person/.test(kind),
        name: personName(x.name, /corporate|legal-person/.test(kind)),
        role: /beneficial-owner/.test(kind) ? 'Beneficial owner' : natures.some((n) => /^ownership-of-shares/.test(n)) ? 'Owner' : 'Person with significant control',
        controls: controlLines(natures), natures,
        notified: fmtDate(x.notified_on), notifiedIso: str(x.notified_on), ceased: fmtDate(x.ceased_on), isCeased: !!(x.ceased_on || x.ceased),
        nationality: str(x.nationality), residence: str(x.country_of_residence), address: address(x.address).oneLine,
      };
    }).filter((x) => x.number);
    const latest = items.slice().sort((a, b) => b.notifiedIso.localeCompare(a.notifiedIso))[0] || {};
    const corporate = items.some((x) => x.corporate);
    const uniq = (xs) => xs.filter(Boolean).filter((x, i, a) => a.indexOf(x) === i);
    return {
      name: personName(raw.name, corporate) || latest.name || '', corporate,
      born: fmtMonthYear(raw.date_of_birth), dob: raw.date_of_birth || null, age: approxAge(raw.date_of_birth),
      nationality: latest.nationality || '', residence: latest.residence || '', address: latest.address || '',
      names: uniq(items.map((x) => x.name)), items,
      current: items.filter((x) => !x.isCeased), ceased: items.filter((x) => x.isCeased), total: +raw.total_results || items.length,
    };
  }

  /* ---------- disqualified officers ---------- */
  function disqualification(raw) {
    if (!ok(raw)) return null;
    const corporate = /corporate/.test(str(raw.kind));
    const name = corporate ? str(raw.name) : tidyCaps([raw.title, raw.forename, raw.other_forenames, raw.surname].map(str).filter(Boolean).join(' '));
    return {
      name, corporate, personNumber: str(raw.person_number), born: fmtDate(raw.date_of_birth), nationality: str(raw.nationality),
      url: raw.links && raw.links.self ? 'https://find-and-update.company-information.service.gov.uk' + str(raw.links.self) : '',
      items: arr(raw.disqualifications).map((d) => {
        const r = d.reason || {};
        return {
          type: label('disq_type', d.disqualification_type), typeCode: str(d.disqualification_type),
          reason: (E.disq_description && E.disq_description[r.description_identifier]) || label('', r.description_identifier),
          law: [r.section ? 'Section ' + str(r.section) : '', r.article ? 'Article ' + str(r.article) : '', (E.disq_act && E.disq_act[r.act]) || label('', r.act)].filter(Boolean).join(', '),
          from: fmtDate(d.disqualified_from), until: fmtDate(d.disqualified_until), fromIso: str(d.disqualified_from), untilIso: str(d.disqualified_until),
          current: isoOk(d.disqualified_until) ? str(d.disqualified_until) >= today() : true,
          court: str(d.court_name), heard: fmtDate(d.heard_on), undertaken: fmtDate(d.undertaken_on), caseId: str(d.case_identifier),
          companies: arr(d.company_names).map((c) => tidyCaps(c)), address: address(d.address).oneLine,
        };
      }),
      permissions: arr(raw.permissions_to_act).map((p) => ({ companies: arr(p.company_names).map(tidyCaps), court: str(p.court_name), granted: fmtDate(p.granted_on), expires: fmtDate(p.expires_on) })),
    };
  }
  function searchDisqualified(raw) {
    if (!ok(raw)) return { total: 0, items: [] };
    return { total: +raw.total_results || 0, items: arr(raw.items).map((i) => {
      const m = /\/disqualified-officers\/(natural|corporate)\/([^/]+)/.exec(str(i.links && i.links.self)) || [];
      return { name: /corporate/.test(m[1]) ? str(i.title) : tidyCaps(i.title), kind: m[1] || '', id: m[2] || '', description: str(i.description), address: str(i.address_snippet) || address(i.address).oneLine };
    }).filter((x) => x.id) };
  }

  /* ---------- company types: what officers are called, and other regulators ---------- */
  function officerWord(type) {
    type = str(type);
    if (type === 'llp') return { one: 'Member', many: 'Members' };
    if (/^limited-partnership|^scottish-partnership/.test(type)) return { one: 'Partner', many: 'Partners' };
    return { one: 'Officer', many: 'Officers' };
  }
  /* Bodies that are also registered with another regulator. */
  function otherRegister(type) {
    type = str(type);
    if (type === 'charitable-incorporated-organisation') return { body: 'Charity Commission for England and Wales', what: 'charity record', url: 'https://register-of-charities.charitycommission.gov.uk/en/charity-search' };
    if (type === 'scottish-charitable-incorporated-organisation') return { body: 'Scottish Charity Regulator (OSCR)', what: 'charity record', url: 'https://www.oscr.org.uk/about-charities/search-the-register/' };
    if (type === 'registered-society-non-jurisdictional' || type === 'industrial-and-provident-society') return { body: 'FCA Mutuals Public Register', what: 'society record', url: 'https://mutuals.fca.org.uk/' };
    if (/^icvc-|^investment-company-with-variable-capital$/.test(type)) return { body: 'FCA Financial Services Register', what: 'fund record', url: 'https://register.fca.org.uk/s/' };
    return null;
  }

  /* SIC codes that say little about what a company does; matches on these are broad. */
  const GENERIC_SIC = ['99999', '74990', '70100', '64209', '82990', '96090', '98000', '68100', '68209', '66300', '64999'];

  /* ---------- similar companies (advanced search) ---------- */
  function similar(raw, selfNumber) {
    if (!ok(raw)) return { available: false, total: 0, items: [] };
    const items = arr(raw.items).filter((i) => i.company_number !== selfNumber).map((i) => {
      const a = address(i.registered_office_address);
      const sic = arr(i.sic_codes).map(str);
      return { name: tidyCaps(i.company_name), number: str(i.company_number), status: label('company_status', i.company_status), colour: statusColour(i.company_status), created: fmtDate(i.date_of_creation), createdIso: str(i.date_of_creation), ageYears: yearsSince(i.date_of_creation), town: a.town, postcode: a.postcode, type: label('company_type', i.company_type), sic, generic: !!sic.length && sic.every((c) => GENERIC_SIC.includes(c)) };
    });
    return { available: true, total: raw.hits || items.length, items };
  }

  /* ---------- search results ---------- */
  function searchCompanies(raw) {
    if (!ok(raw)) return { total: 0, start: 0, items: [] };
    return { total: raw.total_results || 0, start: raw.start_index || 0, items: arr(raw.items).map((i) => ({
      name: str(i.title), number: str(i.company_number), status: label('company_status', i.company_status) || 'Unknown', colour: statusColour(i.company_status),
      address: str(i.address_snippet) || address(i.address).oneLine, created: fmtDate(i.date_of_creation), ceased: fmtDate(i.date_of_cessation), type: label('company_type', i.company_type),
    })) };
  }
  /* Advanced, dissolved and alphabetical search share one item shape (company_name, registered_office_address, ...). Total is `hits`. */
  function searchList(raw) {
    if (!ok(raw)) return { total: 0, items: [] };
    return { total: raw.hits || raw.total_results || 0, items: arr(raw.items).map((i) => ({
      name: str(i.company_name), number: str(i.company_number), status: label('company_status', i.company_status) || 'Unknown', colour: statusColour(i.company_status),
      type: label('company_type', i.company_type), address: address(i.registered_office_address).oneLine, created: fmtDate(i.date_of_creation), ceased: fmtDate(i.date_of_cessation),
      sic: arr(i.sic_codes).map(str), key: str(i.ordered_alpha_key_with_id),
      previous: arr(i.previous_company_names).map((x) => ({ name: str(x.name), from: fmtDate(x.effective_from), to: fmtDate(x.ceased_on) })),
    })) };
  }
  /* Officer search returns one record per officer ID; the same person often has several. Group by name + birth month/year. */
  function searchOfficers(raw) {
    if (!ok(raw)) return { total: 0, start: 0, groups: [] };
    const groups = [], byKey = {};
    for (const i of arr(raw.items)) {
      const id = (/\/officers\/([^/]+)\/appointments/.exec(str(i.links && i.links.self)) || [])[1] || '';
      const name = personName(str(i.title), /corporate/.test(str(i.description)) && !/,/.test(str(i.title)));
      const born = fmtMonthYear(i.date_of_birth);
      const k = name.toLowerCase().replace(/^(mr|mrs|ms|miss|dr|sir|dame|lord|lady)\.?\s+/, '').replace(/\s+/g, ' ') + '|' + born;
      let g = byKey[k];
      if (!g) { g = byKey[k] = { name, born, count: 0, ids: [], addresses: [] }; groups.push(g); }
      if (id) g.ids.push(id);
      g.count += +i.appointment_count || 0;
      const a = str(i.address_snippet); if (a && !g.addresses.includes(a)) g.addresses.push(a);
    }
    return { total: raw.total_results || 0, start: raw.start_index || 0, loaded: arr(raw.items).length, groups };
  }

  /* ---------- registers / UK establishments ---------- */
  function registers(raw) {
    if (!ok(raw) || !raw.registers) return [];
    return Object.entries(raw.registers).map(([k, v]) => { const it = arr(v.items)[0] || {}; return { name: sentence(k.replace(/_/g, ' ')), where: it.register_moved_to === 'public-register' ? 'Companies House (public register)' : 'Registered office / SAIL', since: fmtDate(it.moved_on) }; });
  }
  function ukEstablishments(raw) { return ok(raw) ? arr(raw.items).map((i) => ({ name: tidyCaps(i.company_name), number: str(i.company_number), status: label('company_status', i.company_status), colour: statusColour(i.company_status), town: str(i.locality) })) : []; }

  /* ---------- whole company ---------- */
  function company(raw) {
    raw = raw || {};
    const pr = profile(raw.profile);
    const vm = {
      ...pr,
      officers: officers(raw.officers), ownership: ownership(raw.psc, raw.pscStatements, raw.exemptions),
      charges: charges(raw.charges), insolvency: insolvency(raw.insolvency), filings: filings(raw.filings),
      similar: similar(raw.similar, pr.number), registers: registers(raw.registers), ukEstablishments: ukEstablishments(raw.ukEstablishments),
      appointments: Object.fromEntries(Object.entries(raw.appointments || {}).map(([k, v]) => [k, appointments(v)]).filter(([, v]) => v)),
    };
    // Headline facts used by tiles; each tile is {label, value, sub, tone}
    vm.officerWord = officerWord(pr.type.code); vm.otherRegister = otherRegister(pr.type.code);
    const o = vm.officers, c = vm.charges, own = vm.ownership;
    vm.keyFacts = [
      { key: 'age', label: 'Age', value: pr.ageYears == null ? '—' : pr.ageYears < 1 ? '< 1 year' : `${pr.ageYears} year${pr.ageYears === 1 ? '' : 's'}`, sub: pr.createdText ? 'Incorporated ' + pr.createdText : '' },
      { key: 'directors', label: vm.officerWord.many, value: String(o.counts.active), sub: o.counts.resigned ? `${o.counts.resigned} former` : 'none former', tone: o.counts.active ? '' : 'warn' },
      { key: 'owners', label: own.current.some((p) => p.role === 'Owner') ? 'Owners' : 'Significant control', value: own.current.length ? String(own.current.length) : own.exemptions.some((e) => e.current) ? 'Exempt' : '—', sub: own.current.length ? (own.current[0].controls[0] || own.current[0].role) : own.exemptions.some((e) => e.current) ? 'Listed company' : own.statements[0] ? (STATEMENT_SHORT[own.statements[0].code.replace(/-partnership$/, '')] || 'See statement') : 'None on the register' },
      { key: 'charges', label: 'Charges', value: c.available ? String(c.outstanding) : '0', sub: c.available ? `outstanding of ${c.total}` : 'none registered', tone: c.allAssets ? 'warn' : '' },
      { key: 'accounts', label: 'Last accounts', value: pr.accounts.lastMadeUp || 'None filed', sub: pr.accounts.lastType || '', tone: pr.accounts.overdue && pr.status.active ? 'bad' : '' },
      { key: 'yearend', label: 'Year end', value: pr.accounts.refDate || '—', sub: pr.accounts.nextPeriod ? 'Next period ends ' + pr.accounts.nextPeriod.split(' – ')[1] : '' },
      { key: 'filings', label: 'Filings', value: vm.filings.total.toLocaleString('en-GB'), sub: vm.filings.items[0] ? 'Latest ' + vm.filings.items[0].date : '' },
      { key: 'changes', label: 'Officer changes', value: String(o.changes.length), sub: 'last 12 months', tone: o.changes.length >= 3 ? 'warn' : '' },
    ];
    // Plain-language verdict line for the header (no AI; rules only)
    const v = [];
    if (!pr.status.active) v.push({ tone: /^(liquidation|receivership|administration|insolvency-proceedings)$/.test(pr.status.code) ? 'bad' : 'neutral', text: pr.status.label + (pr.ceasedText ? ' on ' + pr.ceasedText : '') });
    if (vm.insolvency.cases.length) v.push({ tone: 'bad', text: vm.insolvency.cases[0].type });
    if (pr.accounts.dormant) v.push({ tone: 'neutral', text: 'Files dormant accounts' });
    if (c.allAssets) v.push({ tone: 'warn', text: 'Lender holds a charge over all assets' });
    if (own.sanctioned) v.push({ tone: 'bad', text: 'A PSC is on a sanctions list' });
    // Strike-off proposal: latest Gazette filing is a first notice and the company is still live
    const gz = vm.filings.items.find((f) => f.category === 'gazette');
    if (pr.status.active && gz && /GAZ1/.test(gz.typeCode) && (!vm.filings.items[0] || vm.filings.items[0] === gz || vm.filings.items.indexOf(gz) < 3)) {
      vm.flags.unshift({ label: 'Strike-off proposed (' + gz.date + ')', tone: 'bad' }); v.push({ tone: 'bad', text: 'Proposed for strike-off' });
    }
    vm.verdict = v;
    return vm;
  }

  const api = { setEnums, company, profile, officers, ownership, charges, insolvency, filings, appointments, person, pscNotifications, disqualification, searchDisqualified, officerWord, otherRegister, GENERIC_SIC, approxAge, controlLines, similar, registers, ukEstablishments, searchCompanies, searchOfficers, searchList, statusColour, fmtDate, personName, address, label, FH_CAT };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Normalise = api;
})(typeof window !== 'undefined' ? window : globalThis);
