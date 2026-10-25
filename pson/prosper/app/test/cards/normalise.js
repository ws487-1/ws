/* Prosper cards prototype: normalisation layer.
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
  function statusTone(code) { return ({ active: 'ok', open: 'ok', dissolved: 'neutral', closed: 'neutral', 'converted-closed': 'neutral', liquidation: 'bad', receivership: 'bad', administration: 'bad', 'voluntary-arrangement': 'warn', 'insolvency-proceedings': 'bad', 'registered': 'ok', removed: 'neutral' })[code] || 'neutral'; }
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
    const ardText = ard.day && ard.month ? `${+ard.day} ${MON[+ard.month - 1]}` : '';
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
      status: { code: status, label: label('company_status', status) || 'Unknown', detail: label('company_status_detail', p.company_status_detail), tone: statusTone(status), active },
      type: { code: str(p.type), label: label('company_type', p.type), subtype: label('company_subtype', p.subtype) },
      jurisdiction: label('jurisdiction', p.jurisdiction),
      created, createdText: fmtDate(created), ceased, ceasedText: fmtDate(ceased),
      ageYears: yearsSince(created, ceased || undefined),
      address: address(p.registered_office_address),
      serviceAddress: p.service_address ? address(p.service_address) : null,
      sic: arr(p.sic_codes).map((c) => ({ code: str(c), desc: (E.sic_descriptions && E.sic_descriptions[c]) || '' })),
      previousNames: arr(p.previous_company_names).map((x) => ({ name: str(x.name), from: fmtDate(x.effective_from), to: fmtDate(x.ceased_on) })),
      accounts: {
        refDate: ardText,
        lastMadeUp: fmtDate(la.made_up_to), lastType: label('account_type', la.type), lastTypeCode: str(la.type),
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
      appointedIso: str(o.appointed_on), resignedIso: str(o.resigned_on),
      tenureYears: yearsSince(o.appointed_on, o.resigned_on || undefined),
      occupation: sentence(o.occupation), nationality: str(o.nationality), residence: str(o.country_of_residence),
      born: fmtMonthYear(o.date_of_birth), age: o.date_of_birth && o.date_of_birth.year ? new Date().getFullYear() - o.date_of_birth.year - ((o.date_of_birth.month || 12) > new Date().getMonth() + 1 ? 1 : 0) : null,
      address: address(o.address).oneLine,
      appointmentsLink: str(o.links && o.links.officer && o.links.officer.appointments),
      formerNames: arr(o.former_names).map((f) => [f.forenames, f.surname].filter(Boolean).join(' ')).filter(Boolean),
      registration: corporate ? { number: str(id.registration_number), legalForm: str(id.legal_form), place: str(id.place_registered || id.country_registered) } : null,
      idv: idv(o.identity_verification_details),
      responsibilities: str(o.responsibilities),
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
      available: ok(raw), active, former, changes,
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
  function psc(x) {
    const kind = str(x.kind);
    const corporate = /corporate|legal-person/.test(kind), secure = /super-secure/.test(kind);
    const id = x.identification || {};
    const natures = arr(x.natures_of_control).map(str);
    return {
      name: secure ? 'Super-secure person' : personName(x.name, corporate),
      kind, kindLabel: secure ? 'Protected' : corporate ? (/legal-person/.test(kind) ? 'Legal person' : 'Company') : 'Individual',
      beneficialOwner: /beneficial-owner/.test(kind),
      corporate, secure, description: str(x.description),
      controls: natures.map((c) => (E.psc_short_description && E.psc_short_description[c]) || label('psc_description', c)),
      band: controlBand(natures),
      shares: (/ownership-of-shares-([0-9]+)-to-([0-9]+)/.exec(natures.join(' ')) || []).slice(1).join('–'),
      notified: fmtDate(x.notified_on), ceased: fmtDate(x.ceased_on), isCeased: !!(x.ceased || x.ceased_on),
      nationality: str(x.nationality), residence: str(x.country_of_residence), born: fmtMonthYear(x.date_of_birth),
      address: address(x.address || x.principal_office_address).oneLine,
      registration: corporate ? { legalForm: str(id.legal_form), authority: str(id.legal_authority), register: str(id.place_registered), country: str(id.country_registered), number: str(id.registration_number) } : null,
      sanctioned: x.is_sanctioned === true,
      idv: idv(x.identity_verification_details),
    };
  }
  function ownership(rawPsc, rawStatements, rawExemptions) {
    const list = ok(rawPsc) ? arr(rawPsc.items).map(psc) : [];
    const current = list.filter((p) => !p.isCeased), ceased = list.filter((p) => p.isCeased);
    const statements = ok(rawStatements) ? arr(rawStatements.items).filter((s) => !s.ceased_on).map((s) => ({
      text: (E.psc_statement_description && E.psc_statement_description[s.statement]) || label('', s.statement),
      notified: fmtDate(s.notified_on), linkedPsc: str(s.linked_psc_name), restrictions: !!s.restrictions_notice_withdrawal_reason || /restrictions-notice/.test(str(s.statement)),
    })) : [];
    const exemptions = [];
    if (ok(rawExemptions) && rawExemptions.exemptions) {
      for (const [k, v] of Object.entries(rawExemptions.exemptions)) {
        const code = str(v.exemption_type) || k.replace(/_/g, '-');
        for (const it of arr(v.items)) exemptions.push({ code, text: (E.ex_exemption_type && E.ex_exemption_type[code]) || label('', code), from: fmtDate(it.exempt_from), to: fmtDate(it.exempt_to), current: !it.exempt_to });
      }
    }
    let explanation = '';
    if (!current.length) {
      const ex = exemptions.find((e) => e.current && /psc-exempt/.test(e.code)) || exemptions.find((e) => e.current);
      explanation = ex ? 'Exempt from the PSC register: ' + ex.text.replace(/^The company has been or is exempt from the requirement to obtain information of its PSC, as it /, 'it ').replace(/^This is/, 'this is')
        : statements.length ? statements[0].text
        : ok(rawPsc) || rawPsc ? 'No people with significant control on record, and no statement explaining why.' : 'Ownership data was not available.';
    }
    return {
      available: ok(rawPsc), current, ceased, statements, exemptions, explanation,
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
      status: label('company_status', a.appointed_to && a.appointed_to.company_status), statusCode: str(a.appointed_to && a.appointed_to.company_status),
      role: label('officer_role', a.officer_role), appointed: fmtDate(a.appointed_on), resigned: fmtDate(a.resigned_on), occupation: sentence(a.occupation),
    }));
    return { name: personName(raw.name, raw.is_corporate_officer), born: fmtMonthYear(raw.date_of_birth), total: raw.total_results || items.length, active: raw.active_count || 0, resigned: raw.resigned_count || 0, items };
  }

  /* ---------- similar companies (advanced search) ---------- */
  function similar(raw, selfNumber) {
    if (!ok(raw)) return { available: false, total: 0, items: [] };
    const items = arr(raw.items).filter((i) => i.company_number !== selfNumber).map((i) => {
      const a = address(i.registered_office_address);
      return { name: tidyCaps(i.company_name), number: str(i.company_number), status: label('company_status', i.company_status), created: fmtDate(i.date_of_creation), ageYears: yearsSince(i.date_of_creation), town: a.town, postcode: a.postcode, type: label('company_type', i.company_type) };
    });
    return { available: true, total: raw.hits || items.length, items };
  }

  /* ---------- registers / UK establishments ---------- */
  function registers(raw) {
    if (!ok(raw) || !raw.registers) return [];
    return Object.entries(raw.registers).map(([k, v]) => { const it = arr(v.items)[0] || {}; return { name: sentence(k.replace(/_/g, ' ')), where: it.register_moved_to === 'public-register' ? 'Companies House (public register)' : 'Registered office / SAIL', since: fmtDate(it.moved_on) }; });
  }
  function ukEstablishments(raw) { return ok(raw) ? arr(raw.items).map((i) => ({ name: tidyCaps(i.company_name), number: str(i.company_number), status: label('company_status', i.company_status), town: str(i.locality) })) : []; }

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
    const o = vm.officers, c = vm.charges, own = vm.ownership;
    vm.keyFacts = [
      { key: 'age', label: 'Age', value: pr.ageYears == null ? '—' : pr.ageYears < 1 ? '< 1 year' : `${pr.ageYears} year${pr.ageYears === 1 ? '' : 's'}`, sub: pr.createdText ? 'Incorporated ' + pr.createdText : '' },
      { key: 'directors', label: 'Officers', value: String(o.counts.active), sub: o.counts.resigned ? `${o.counts.resigned} former` : 'none former', tone: o.counts.active ? '' : 'warn' },
      { key: 'owners', label: 'Owners', value: own.current.length ? String(own.current.length) : own.exemptions.some((e) => e.current) ? 'Exempt' : '—', sub: own.current.length ? (own.current[0].band ? own.current[0].band + ' largest' : own.current[0].kindLabel) : own.exemptions.some((e) => e.current) ? 'Listed company' : 'No PSC' },
      { key: 'charges', label: 'Charges', value: c.available ? String(c.outstanding) : '0', sub: c.available ? `outstanding of ${c.total}` : 'none registered', tone: c.allAssets ? 'warn' : '' },
      { key: 'accounts', label: 'Last accounts', value: pr.accounts.lastMadeUp || 'None filed', sub: pr.accounts.lastType || '', tone: pr.accounts.overdue && pr.status.active ? 'bad' : '' },
      { key: 'yearend', label: 'Year end', value: pr.accounts.refDate || '—', sub: pr.accounts.nextPeriod ? 'Next period ends ' + pr.accounts.nextPeriod.split(' – ')[1] : '' },
      { key: 'filings', label: 'Filings', value: vm.filings.total.toLocaleString('en-GB'), sub: vm.filings.items[0] ? 'Latest ' + vm.filings.items[0].date : '' },
      { key: 'changes', label: 'Officer changes', value: String(o.changes.length), sub: 'last 12 months', tone: o.changes.length >= 3 ? 'warn' : '' },
    ];
    // Plain-language verdict line for the header (no AI; rules only)
    const v = [];
    if (!pr.status.active) v.push({ tone: pr.status.tone === 'bad' ? 'bad' : 'neutral', text: pr.status.label + (pr.ceasedText ? ' on ' + pr.ceasedText : '') });
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

  const api = { setEnums, company, profile, officers, ownership, charges, insolvency, filings, appointments, similar, registers, ukEstablishments, fmtDate, personName, address };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Normalise = api;
})(typeof window !== 'undefined' ? window : globalThis);
