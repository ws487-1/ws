/* Live lookups: the user's own Companies House key, stored only in this browser (same localStorage slot as the app).
   Without a key the prototype uses the bundled fixtures (public Companies House data). */
(function (root) {
  'use strict';
  const SLOT = 'prosper.key.ch';
  const API = 'https://api.company-information.service.gov.uk';
  const getKey = () => { try { const v = localStorage.getItem(SLOT); return v ? JSON.parse(v) : ''; } catch (e) { return ''; } };
  const setKey = (k) => { try { if (k) localStorage.setItem(SLOT, JSON.stringify(k.trim())); else localStorage.removeItem(SLOT); } catch (e) { /* storage blocked */ } };
  async function g(path) {
    const r = await fetch(API + path, { headers: { Authorization: 'Basic ' + btoa(getKey() + ':') } });
    if (r.status === 200) return r.json();
    if (r.status === 401) throw new Error('Companies House rejected the key (401). Check it in Settings, and that this site is listed under the key\'s JavaScript domains.');
    return { _http: r.status };
  }
  async function company(n) {
    n = String(n).trim().toUpperCase().padStart(8, '0');
    const c = '/company/' + n, raw = { label: 'Live' };
    raw.profile = await g(c);
    if (raw.profile._http) throw new Error('No company found with number ' + n + '.');
    const p = raw.profile, sic = (p.sic_codes || [])[0], town = p.registered_office_address && p.registered_office_address.locality;
    const [officers, psc, pscStatements, exemptions, registers, ukEstablishments, charges, insolvency, filings, similar] = await Promise.all([
      g(c + '/officers?items_per_page=100'), g(c + '/persons-with-significant-control?items_per_page=25'), g(c + '/persons-with-significant-control-statements?items_per_page=25'),
      g(c + '/exemptions'), g(c + '/registers'), g(c + '/uk-establishments'), p.has_charges ? g(c + '/charges?items_per_page=25') : null,
      p.has_insolvency_history ? g(c + '/insolvency') : null, g(c + '/filing-history?items_per_page=25'),
      sic ? g('/advanced-search/companies?company_status=active&size=12&sic_codes=' + sic + (town ? '&location=' + encodeURIComponent(town) : '')) : null]);
    Object.assign(raw, { officers, psc, pscStatements, exemptions, registers, ukEstablishments, charges, insolvency, filings, similar, appointments: {} });
    const act = (officers.items || []).filter((o) => !o.resigned_on).slice(0, 3);
    await Promise.all(act.map(async (o) => { const l = o.links && o.links.officer && o.links.officer.appointments; if (l) raw.appointments[l] = await g(l + '?items_per_page=50'); }));
    return raw;
  }
  root.Live = { getKey, setKey, company };
})(window);
