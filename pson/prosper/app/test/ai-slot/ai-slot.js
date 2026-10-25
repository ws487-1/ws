/* AI summary + chat panel for card layout B. Static mock: renders sample text; never calls an API. */
(function (root) {
  'use strict';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const SPARK = '<span class="ai-spark" aria-hidden="true"></span>';
  const ANCHOR = { Ownership: 'ownership', Charges: 'charges', Deadlines: 'deadlines', Filings: 'filings', Officers: 'officers', Insolvency: 'insolvency' };
  function panel(vm, s, o) {
    o = o || {};
    const tab = o.tab || 'summary', state = o.state || 'ready';
    const head = `<div class="ai-head"><h3>${SPARK}AI summary</h3><span class="ai-meta"><span class="ai-sample" title="Hand-written sample text for this mock-up">Sample</span><span class="faint">Haiku</span></span></div>
      <div class="ai-tabs" role="tablist"><button role="tab" data-ai-tab="summary" aria-selected="${tab === 'summary'}">Summary</button><button role="tab" data-ai-tab="ask" aria-selected="${tab === 'ask'}">Ask about this company</button></div>`;
    let body = '';
    if (state === 'nokey') body = `<div class="ai-empty"><b>Add your Claude key to get summaries</b><p>Summaries and answers are written from the facts on this card. Your key is stored only in this browser.</p><button class="btn sm" type="button">Open Settings</button></div>`;
    else if (state === 'loading') body = `<div class="ai-status">${SPARK}Reading the card…</div><div class="ai-lines"><i></i><i></i><i></i><i></i></div>`;
    else if (state === 'error') body = `<div class="ai-empty"><b>Couldn’t write a summary</b><p>The AI service didn’t respond. The facts on the card are unaffected.</p><button class="btn sm" type="button">Try again</button></div>`;
    else if (tab === 'summary') body = `<div class="ai-text">${s.summary.map((p) => `<p>${esc(p)}</p>`).join('')}</div>
      <ul class="ai-points">${s.points.map(([t, src]) => `<li><span>${esc(t)}</span><a class="ai-src" href="#${ANCHOR[src] || ''}">${esc(src)}</a></li>`).join('')}</ul>
      <div class="ai-foot"><span>Written from this card’s Companies House data. Check before relying on it.</span><span class="ai-acts"><button type="button" title="Copy">Copy</button><button type="button" title="Write it again">Regenerate</button><button type="button" aria-label="Helpful"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 10v11H3V10zM7 10l4-8a3 3 0 0 1 3 3v4h6a2 2 0 0 1 2 2.3l-1.4 8A2 2 0 0 1 18.6 21H7"/></svg></button><button type="button" aria-label="Not helpful" class="flip"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 10v11H3V10zM7 10l4-8a3 3 0 0 1 3 3v4h6a2 2 0 0 1 2 2.3l-1.4 8A2 2 0 0 1 18.6 21H7"/></svg></button></span></div>`;
    else body = `<div class="ai-thread" data-ai-thread>${s.thread.map(([q, a]) => msg(q, a)).join('')}</div>
      <div class="ai-chips">${s.ask.map((q) => `<button type="button" data-ai-ask="${esc(q)}">${esc(q)}</button>`).join('')}</div>
      <form class="ai-ask" data-ai-form><input type="text" placeholder="Ask about ${esc(vm.name.length > 34 ? 'this company' : titled(vm.name))}…" aria-label="Ask a question"><button class="btn sm primary" type="submit">Ask</button></form>
      <div class="ai-foot"><span>Answers use only this card’s data. Sample replies in this mock-up.</span></div>`;
    return `<div class="ai ai-v2" data-ai>${head}<div class="ai-body">${body}</div></div>`;
  }
  const titled = (n) => n.replace(/\b([A-Z])([A-Z]+)\b/g, (m, a, b) => m.length <= 3 && m !== 'LTD' ? m : a + b.toLowerCase());
  const msg = (q, a) => `<div class="ai-q">${esc(q)}</div><div class="ai-a">${SPARK}<div>${a == null ? '<div class="ai-lines sm"><i></i><i></i></div>' : esc(a)}</div></div>`;
  root.AISlot = { panel, msg, esc };
})(window);
