/* Three layout options for the same view model. Each returns the HTML for one company card. */
(function (root) {
  'use strict';
  const C = root.Cards;
  const sec = (id, html, cls) => (html ? `<section class="section ${cls || ''}" id="${id}">${html}</section>` : '');
  const tile = (cls, html) => (html ? `<div class="tile ${cls}">${html}</div>` : '');

  /* A: one column. Header, tile grid, then every component stacked as a full-width section. */
  function A(vm) {
    return `<article class="card lay-a">
      ${C.header(vm)}
      <div class="facts-wrap">${C.facts(vm)}</div>
      ${sec('ai', C.ai(vm))}
      ${sec('deadlines', `<div class="two"><div>${C.deadlines(vm)}</div><div>${C.changes(vm)}</div></div>`)}
      ${sec('insolvency', C.insolvency(vm))}
      ${sec('people', C.officers(vm))}
      ${sec('ownership', C.ownership(vm))}
      ${sec('charges', C.charges(vm))}
      ${sec('filings', C.filings(vm))}
      ${sec('similar', `<div class="two"><div>${C.similar(vm)}</div><div>${C.details(vm)}</div></div>`)}
    </article>`;
  }

  /* B: bento. Header on top, then a 12-column grid of self-contained tiles sized by importance. */
  function B(vm) {
    const f = Object.fromEntries(vm.keyFacts.map((x) => [x.key, x]));
    const t = { tag: 'tile' };
    const ins = C.insolvency(vm, t);
    return `<article class="lay-b"><div class="card shell">
      ${C.header(vm)}
      <div class="bento">
        ${['age', 'directors', 'owners', 'charges'].map((k) => `<div class="s3">${C.factTile(f[k])}</div>`).join('')}
        ${ins ? tile('s12', ins) : ''}
        ${tile('s8', C.ai(vm))}
        ${tile('s4', C.deadlines(vm, { tag: 'tile' }))}
        ${tile('s7', C.officers(vm, { tag: 'tile', compact: true, limit: 6 }))}
        ${tile('s5', C.ownership(vm, t))}
        ${tile('s5', C.changes(vm, t))}
        ${tile('s7', C.charges(vm, { tag: 'tile', limit: 3 }))}
        ${tile('s7', C.filings(vm, { tag: 'tile', limit: 10, filters: false }))}
        ${tile('s5', C.similar(vm, { tag: 'tile', limit: 7 }))}
        ${tile('s12', C.details(vm, t))}
      </div></div></article>`;
  }

  /* C: compact header + sticky anchored tabs; left rail of at-a-glance facts; dense tables on the right. */
  function Cl(vm) {
    const tabs = [['overview', 'Overview'], ['people', 'People', vm.officers.counts.active], ['ownership', 'Ownership', vm.ownership.current.length || ''], ['charges', 'Charges', vm.charges.total || ''],
      vm.insolvency.cases.length ? ['insolvency', 'Insolvency', vm.insolvency.cases.length] : null, ['filings', 'Filings', vm.filings.total], ['similar', 'Similar'], ['details', 'Details']].filter(Boolean);
    return `<article class="card lay-c">
      ${C.header(vm, { compact: true })}
      ${C.facts(vm, { strip: true })}
      <nav class="tabs" data-tabs>${tabs.map(([id, l, n], i) => `<a href="#${id}" class="${i ? '' : 'on'}">${l}${n !== undefined && n !== '' ? `<span class="count">${n}</span>` : ''}</a>`).join('')}</nav>
      <div class="c-body">
        <aside class="c-rail">
          <div class="rail-sec">${C.deadlines(vm, { tag: 'tile' })}</div>
          <div class="rail-sec">${C.changes(vm, { tag: 'tile' })}</div>
        </aside>
        <div class="c-main">
          ${sec('overview', C.ai(vm))}
          ${sec('people', C.officersTable(vm))}
          ${sec('ownership', C.ownership(vm))}
          ${sec('charges', C.charges(vm))}
          ${sec('insolvency', C.insolvency(vm))}
          ${sec('filings', C.filings(vm, { limit: 15 }))}
          ${sec('similar', `<div class="c-cols"><div>${C.similar(vm)}</div><div>${C.details(vm)}</div></div>`)}
        </div>
      </div>
    </article>`;
  }
  root.Layouts = { A, B, C: Cl };
})(window);
