/* Prosper prototype – static, client-side only.
   The API key lives in localStorage on the user's device; nothing is stored in this file. */
(function () {
  'use strict';

  // Prices in USD per million tokens (source: docs.claude.com/en/docs/about-claude/pricing, Oct 2026).
  // Web search: $10 per 1,000 searches.
  var MODELS = [
    { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 (default, lowest cost)', effort: 'medium', input: 0.10, output: 0.50, cacheWrite: 0.125, cacheRead: 0.01,
      longContext: { over: 100000, input: 0.50, output: 2.50, cacheWrite: 0.625, cacheRead: 0.05 } },
    { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (higher quality)', effort: 'medium', input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.10 },
    { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.10 },
    { id: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5', input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.30 }
  ];
  var DEFAULT_MODEL = 'claude-haiku-5-5';
  var WEB_SEARCH_PRICE = 0.01;
  var MAX_SEARCHES = 4;
  var MAX_TOKENS = 12000; // includes the model's thinking tokens; real briefs use far fewer
  var MAX_CONTINUATIONS = 2;
  var HISTORY_LIMIT = 50;
  var LS = { key: 'prosper.apiKey', model: 'prosper.model', history: 'prosper.history', total: 'prosper.costTotal' };

  var $ = function (id) { return document.getElementById(id); };
  var els = {
    form: $('searchForm'), q: $('q'), btn: $('searchBtn'), status: $('status'), result: $('result'),
    empty: $('empty'), keyNotice: $('keyNotice'), history: $('history'), historyEmpty: $('historyEmpty'),
    clearHistory: $('clearHistory'), costTotal: $('costTotal'), settings: $('settings'), apiKey: $('apiKey'),
    model: $('model'), modelNote: $('modelNote'), settingsTotal: $('settingsTotal'), settingsCount: $('settingsCount'),
    toast: $('toast')
  };
  var current = null;   // currently displayed history entry
  var busy = false;

  // ---------- storage ----------
  function lsGet(k, fallback) { try { var v = localStorage.getItem(k); return v === null ? fallback : v; } catch (e) { return fallback; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { toast('Could not save to browser storage'); } }
  function getKey() { return (lsGet(LS.key, '') || '').trim(); }
  function getModel() { var m = lsGet(LS.model, DEFAULT_MODEL); return modelInfo(m) ? m : DEFAULT_MODEL; }
  function modelInfo(id) { for (var i = 0; i < MODELS.length; i++) if (MODELS[i].id === id) return MODELS[i]; return null; }
  function getHistory() { try { return JSON.parse(lsGet(LS.history, '[]')) || []; } catch (e) { return []; } }
  function setHistory(h) { lsSet(LS.history, JSON.stringify(h.slice(0, HISTORY_LIMIT))); }
  function getTotal() { try { var t = JSON.parse(lsGet(LS.total, '{}')); return { usd: +t.usd || 0, count: +t.count || 0 }; } catch (e) { return { usd: 0, count: 0 }; } }
  function setTotal(t) { lsSet(LS.total, JSON.stringify(t)); }

  // ---------- helpers ----------
  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'class') n.className = attrs[k];
      else n.setAttribute(k, attrs[k]);
    }
    (children || []).forEach(function (c) { if (c != null) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  function safeUrl(u) {
    if (!u || typeof u !== 'string') return null;
    u = u.trim();
    if (!/^https?:\/\//i.test(u)) { if (/^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(u)) u = 'https://' + u; else return null; }
    try { var p = new URL(u); return (p.protocol === 'http:' || p.protocol === 'https:') ? p.href : null; } catch (e) { return null; }
  }
  function host(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } }
  function normUrl(u) { try { var p = new URL(u); return (p.hostname.replace(/^www\./, '') + p.pathname.replace(/\/$/, '')).toLowerCase(); } catch (e) { return (u || '').toLowerCase(); } }
  function fmtUsd(n) { return '$' + (n < 1 ? n.toFixed(3) : n.toFixed(2)); }
  function fmtDate(ts) { var d = new Date(ts); return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); }
  function isMissing(v) { return v == null || v === '' || /^(not found|unknown|n\/a|none)\.?$/i.test(String(v).trim()) || (Array.isArray(v) && !v.length); }
  function toast(msg) {
    els.toast.textContent = msg; els.toast.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(function () { els.toast.hidden = true; }, 2200);
  }

  // ---------- cost ----------
  function estimateCost(usage, modelId) {
    var m = modelInfo(modelId) || MODELS[0];
    var inTok = usage.input_tokens || 0, outTok = usage.output_tokens || 0;
    var cw = usage.cache_creation_input_tokens || 0, cr = usage.cache_read_input_tokens || 0;
    var searches = usage.web_search_requests || 0;
    var p = m;
    // Haiku 5.5 long-prompt tier: conservative estimate using the per-request maximum prompt size.
    if (m.longContext && (usage.max_prompt_tokens || 0) > m.longContext.over) p = m.longContext;
    var tokens = (inTok * p.input + outTok * p.output + cw * p.cacheWrite + cr * p.cacheRead) / 1e6;
    return { tokens: tokens, search: searches * WEB_SEARCH_PRICE, total: tokens + searches * WEB_SEARCH_PRICE };
  }
  function renderTotal() {
    var t = getTotal();
    els.costTotal.textContent = fmtUsd(t.usd);
    els.settingsTotal.textContent = fmtUsd(t.usd);
    els.settingsCount.textContent = t.count ? '(' + t.count + ' brief' + (t.count === 1 ? '' : 's') + ', avg ' + fmtUsd(t.usd / t.count) + ')' : '';
  }

  // ---------- prompt ----------
  var SYSTEM = [
    'You are a careful B2B sales research analyst for UK companies. You research one company using web search and return a factual prospect brief.',
    'Rules:',
    '- Only state facts you found in search results. Never guess or invent names, numbers, dates, people or URLs.',
    '- If something cannot be found, use the exact string "not found". Leave arrays empty rather than padding them.',
    '- If the query is ambiguous (several UK companies share the name), pick the most likely match, say so in "match_note", and list the alternatives you saw.',
    '- Prefer authoritative UK sources: the company website, Companies House (find-and-update.company-information.service.gov.uk), reputable news, LinkedIn/job boards for hiring.',
    '- Recent signals should ideally be from the last 18 months; always include a date if known.',
    '- "why_prospect" and "talking_points" are your reasoned suggestions, but must be grounded in the facts found.',
    '- Be concise: facts as short phrases (e.g. "c. 60 (LinkedIn, 2026)"), dates as "14 Sep 2026" or "Sep 2026", at most 6 signals, newest first. Use British English.',
    'Output: after researching, reply with ONLY one JSON object (no prose before or after, no markdown fences) matching this shape:',
    '{',
    '  "status": "found" | "not_found" | "ambiguous",',
    '  "company_name": string,',
    '  "match_note": string,            // "" unless the match is uncertain or ambiguous',
    '  "companies_house_number": string,',
    '  "website": string,',
    '  "what_they_do": string,          // 2-3 sentences',
    '  "sector": string,',
    '  "size_location": { "employees": string, "revenue": string, "headquarters": string, "other_locations": string, "founded": string },',
    '  "signals": [ { "type": "hiring" | "funding" | "leadership" | "expansion" | "contract" | "financial" | "news" | "other", "date": string, "detail": string, "source_url": string } ],',
    '  "why_prospect": [ string ],      // 2-4 bullets',
    '  "talking_points": [ string ],    // 3-5 bullets',
    '  "sources": [ { "title": string, "url": string } ],  // URLs you actually used, copied exactly from search results',
    '  "confidence": "high" | "medium" | "low"',
    '}'
  ].join('\n');

  function userPrompt(q) {
    var kind = /^(SC|NI|OC|SO|NC|R0)?\d{6,8}$/i.test(q.replace(/\s/g, '')) ? 'a Companies House company number'
      : /\.[a-z]{2,}(\/|$)/i.test(q) ? 'a company website' : 'a company name';
    return 'Research this UK company for a sales prospecting brief. The input is ' + kind + ': "' + q + '".\n' +
      'You have at most ' + MAX_SEARCHES + ' web searches, so plan them: identify the company (and its Companies House record), then look for recent news, hiring, funding and leadership changes.\n' +
      'Return only the JSON object.';
  }

  // ---------- API ----------
  function ApiError(kind, title, detail, raw) { this.kind = kind; this.title = title; this.detail = detail; this.raw = raw; }

  async function callApi(key, body) {
    var res;
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify(body)
      });
    } catch (e) {
      throw new ApiError('network', 'Network error', 'Could not reach api.anthropic.com. Check your connection (or any ad/script blocker) and try again.', String(e));
    }
    var text = await res.text();
    var data = null; try { data = JSON.parse(text); } catch (e) { /* ignore */ }
    if (!res.ok) throw classifyError(res.status, data, text);
    if (!data) throw new ApiError('parse', 'Unexpected response', 'The API returned something that was not JSON.', text.slice(0, 2000));
    return data;
  }

  function classifyError(status, data, text) {
    var msg = (data && data.error && data.error.message) || '';
    var type = (data && data.error && data.error.type) || '';
    if (status === 401 || type === 'authentication_error')
      return new ApiError('auth', 'API key rejected', 'Anthropic did not accept this API key. Check it in Settings (it should start with sk-ant-).', msg);
    if (/credit balance|billing|purchase credits/i.test(msg) || type === 'billing_error' || status === 402)
      return new ApiError('credit', 'Out of API credit', 'Your Anthropic account does not have enough credit for this request. Add credit in the Claude Console billing page, then retry.', msg);
    if (status === 429 || type === 'rate_limit_error')
      return new ApiError('rate', 'Rate limit reached', 'Too many requests in a short time. Wait a minute and try again.', msg);
    if (status === 529 || type === 'overloaded_error')
      return new ApiError('overloaded', 'Service busy', 'Anthropic’s API is temporarily overloaded. Try again shortly.', msg);
    if (status === 403 || type === 'permission_error')
      return new ApiError('permission', 'Not permitted', 'This key does not have access to the selected model or feature. Try another model in Settings.', msg);
    if (status === 404 || type === 'not_found_error')
      return new ApiError('model', 'Model not available', 'The selected model was not found for this key. Pick another model in Settings.', msg);
    if (status >= 500)
      return new ApiError('server', 'Anthropic API error', 'The API returned a server error (' + status + '). Try again shortly.', msg || text.slice(0, 1000));
    return new ApiError('request', 'Request failed (' + status + ')', msg || 'The API rejected the request.', text.slice(0, 2000));
  }

  async function research(q, key, modelId) {
    var messages = [{ role: 'user', content: userPrompt(q) }];
    var body = {
      model: modelId,
      max_tokens: MAX_TOKENS,
      system: SYSTEM,
      messages: messages,
      tools: [{
        type: 'web_search_20250305', name: 'web_search', max_uses: MAX_SEARCHES,
        user_location: { type: 'approximate', country: 'GB', timezone: 'Europe/London' }
      }]
    };
    var mi = modelInfo(modelId);
    if (mi && mi.effort) body.output_config = { effort: mi.effort };
    var usage = { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, web_search_requests: 0, max_prompt_tokens: 0 };
    var allContent = [];
    var data, i = 0;
    while (true) {
      data = await callApi(key, body);
      var u = data.usage || {};
      usage.input_tokens += u.input_tokens || 0;
      usage.output_tokens += u.output_tokens || 0;
      usage.cache_creation_input_tokens += u.cache_creation_input_tokens || 0;
      usage.cache_read_input_tokens += u.cache_read_input_tokens || 0;
      usage.web_search_requests += (u.server_tool_use && u.server_tool_use.web_search_requests) || 0;
      usage.max_prompt_tokens = Math.max(usage.max_prompt_tokens, (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0));
      allContent = allContent.concat(data.content || []);
      if (data.stop_reason === 'pause_turn' && i < MAX_CONTINUATIONS) {
        i++;
        messages = messages.concat([{ role: 'assistant', content: data.content }]);
        body.messages = messages;
        continue;
      }
      break;
    }
    return { content: allContent, usage: usage, stop_reason: data.stop_reason, model: data.model || modelId };
  }

  // ---------- parse ----------
  function extract(content) {
    var searchResults = [], citations = [], text = '', searchErrors = [];
    var lastToolIdx = -1;
    content.forEach(function (b, idx) { if (b.type === 'web_search_tool_result' || b.type === 'server_tool_use') lastToolIdx = idx; });
    content.forEach(function (b, idx) {
      if (b.type === 'web_search_tool_result') {
        if (Array.isArray(b.content)) b.content.forEach(function (r) { if (r.url) searchResults.push({ title: r.title || r.url, url: r.url }); });
        else if (b.content && b.content.error_code) searchErrors.push(b.content.error_code);
      }
      if (b.type === 'text') {
        if (idx > lastToolIdx) text += b.text;
        (b.citations || []).forEach(function (c) { if (c.url) citations.push({ title: c.title || c.url, url: c.url }); });
      }
    });
    // Fallback: if the final text region was empty, use all text.
    if (!text.trim()) content.forEach(function (b) { if (b.type === 'text') text += b.text; });
    return { text: text, searchResults: searchResults, citations: citations, searchErrors: searchErrors };
  }

  function parseBrief(text) {
    var t = text.trim();
    var fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) t = fence[1].trim();
    var start = t.indexOf('{'), end = t.lastIndexOf('}');
    if (start === -1 || end <= start) return null;
    var candidate = t.slice(start, end + 1);
    try { return JSON.parse(candidate); } catch (e) {
      // Light repair: strip trailing commas and // comments.
      try { return JSON.parse(candidate.replace(/\/\/[^\n"]*$/gm, '').replace(/,\s*([}\]])/g, '$1')); } catch (e2) { return null; }
    }
  }

  // Keep only sources that really came back from the search tool (or citations), then add citations not listed.
  function buildSources(brief, ex) {
    var known = {};
    ex.searchResults.concat(ex.citations).forEach(function (s) { known[normUrl(s.url)] = s; });
    var out = [], seen = {};
    function add(s, verified) {
      var u = safeUrl(s.url); if (!u) return;
      var k = normUrl(u); if (seen[k]) return; seen[k] = 1;
      out.push({ title: (s.title || (known[k] && known[k].title) || host(u)).toString().slice(0, 200), url: u, verified: verified });
    }
    ((brief && Array.isArray(brief.sources)) ? brief.sources : []).forEach(function (s) {
      if (s && s.url) add(s, !!known[normUrl(s.url)]);
    });
    ex.citations.forEach(function (s) { add(s, true); });
    if (!out.length) ex.searchResults.slice(0, 8).forEach(function (s) { add(s, true); });
    return out;
  }

  // ---------- render ----------
  function factOrNF(v) { return isMissing(v) ? el('span', { class: 'nf', text: 'Not found' }) : document.createTextNode(String(v)); }
  function section(title, child) { return el('section', { class: 'section' }, [el('h2', { text: title }), child]); }
  function list(items) {
    items = (items || []).filter(function (x) { return !isMissing(x); });
    if (!items.length) return el('p', { class: 'nf', text: 'Not found' });
    return el('ul', null, items.map(function (x) { return el('li', { text: String(x) }); }));
  }

  function renderEntry(entry) {
    current = entry;
    var b = entry.brief, r = els.result;
    r.innerHTML = '';
    var name = (b && !isMissing(b.company_name)) ? b.company_name : entry.query;

    var metaBits = [];
    if (b && !isMissing(b.companies_house_number)) metaBits.push(el('span', { text: 'Company no. ' + b.companies_house_number }));
    var site = b && safeUrl(b.website);
    if (site) metaBits.push(el('a', { href: site, target: '_blank', rel: 'noopener noreferrer', text: host(site) }));
    if (b && !isMissing(b.sector)) metaBits.push(el('span', { text: b.sector }));
    if (b && b.confidence) metaBits.push(el('span', { class: 'badge' + (b.confidence === 'low' ? ' warn' : ''), text: 'Confidence: ' + b.confidence }));

    var head = el('div', { class: 'result-head' }, [
      el('div', null, [el('h1', { text: name }), el('div', { class: 'result-meta' }, metaBits)]),
      el('div', { class: 'result-actions' }, [
        el('button', { type: 'button', class: 'btn btn-secondary', id: 'copyBtn', text: 'Copy brief' }),
        el('button', { type: 'button', class: 'btn btn-secondary', id: 'exportBtn', text: 'Export .md' })
      ])
    ]);
    r.appendChild(head);

    if (!b) {
      r.appendChild(el('section', { class: 'section' }, [
        el('p', { class: 'small', text: (entry.stopReason === 'max_tokens' ? 'The answer hit the length limit before it finished. ' : '') + 'The brief could not be read as structured data, so the raw answer is shown below. You can retry the search or try another model.' }),
      ]));
      r.appendChild(section('Raw answer', el('div', { class: 'raw', text: entry.rawText || '(empty)' })));
    } else {
      if (b.status === 'not_found') {
        r.appendChild(el('section', { class: 'section' }, [el('p', null, [el('strong', { text: 'Company not found. ' }), document.createTextNode(b.match_note || 'No reliable match for this UK company was found. Try the full registered name, website or company number.')])]));
      } else if (!isMissing(b.match_note)) {
        r.appendChild(el('section', { class: 'section' }, [el('p', { class: 'small' }, [el('span', { class: 'badge warn', text: b.status === 'ambiguous' ? 'Ambiguous match' : 'Note' }), document.createTextNode(' ' + b.match_note)])]));
      }
      r.appendChild(section('What they do', el('p', null, [factOrNF(b.what_they_do)])));
      var sl = b.size_location || {};
      var facts = el('dl', { class: 'facts' }, [
        ['Employees', sl.employees], ['Revenue', sl.revenue], ['Headquarters', sl.headquarters], ['Other locations', sl.other_locations], ['Founded', sl.founded]
      ].map(function (f) { return el('div', null, [el('dt', { text: f[0] }), el('dd', null, [factOrNF(f[1])])]); }));
      r.appendChild(section('Size & location', facts));

      var sigs = (Array.isArray(b.signals) ? b.signals : []).filter(function (s) { return s && !isMissing(s.detail); });
      var sigNode = sigs.length ? el('ul', { class: 'signals' }, sigs.map(function (s) {
        var src = safeUrl(s.source_url);
        return el('li', null, [
          el('div', { class: 'sig-type' }, [cap(s.type || 'news'), isMissing(s.date) ? null : el('span', { class: 'sig-date', text: s.date })]),
          el('div', null, [document.createTextNode(s.detail), src ? el('a', { class: 'sig-src', href: src, target: '_blank', rel: 'noopener noreferrer', text: '(' + host(src) + ')' }) : null])
        ]);
      })) : el('p', { class: 'nf', text: 'No recent signals found' });
      r.appendChild(section('Recent news & signals', sigNode));
      r.appendChild(section('Why they might be a good prospect', list(b.why_prospect)));
      r.appendChild(section('Suggested talking points', list(b.talking_points)));
    }

    var srcs = entry.sources || [];
    var srcNode = srcs.length ? el('ol', { class: 'sources' }, srcs.map(function (s) {
      return el('li', null, [el('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer', text: s.title }), el('span', { class: 'host', text: host(s.url) + (s.verified ? '' : ' · not in search results') })]);
    })) : el('p', { class: 'nf', text: 'No sources returned' });
    r.appendChild(section('Sources', srcNode));

    var c = entry.cost || { total: 0, tokens: 0, search: 0 };
    var u = entry.usage || {};
    r.appendChild(el('div', { class: 'result-foot' }, [
      el('span', { text: 'Est. cost ' + fmtUsd(c.total) + ' (' + fmtUsd(c.tokens) + ' tokens + ' + fmtUsd(c.search) + ' for ' + (u.web_search_requests || 0) + ' searches)' }),
      el('span', { text: (u.input_tokens || 0).toLocaleString('en-GB') + ' in / ' + (u.output_tokens || 0).toLocaleString('en-GB') + ' out tokens' }),
      el('span', { text: shortModel(entry.model) }),
      el('span', { text: fmtDate(entry.ts) + (entry.seconds ? ' · ' + entry.seconds + 's' : '') }),
      entry.searchErrors && entry.searchErrors.length ? el('span', { text: 'Search warnings: ' + entry.searchErrors.join(', ') }) : null
    ]));

    $('copyBtn').addEventListener('click', copyBrief);
    $('exportBtn').addEventListener('click', exportBrief);
    r.hidden = false; els.empty.hidden = true;
    renderHistory();
  }
  function cap(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }
  function shortModel(id) { var m = modelInfo(id); return m ? m.label.replace(/\s*\(.*\)$/, '') : (id || ''); }

  // ---------- markdown ----------
  function toMarkdown(entry) {
    var b = entry.brief, L = [];
    var name = (b && !isMissing(b.company_name)) ? b.company_name : entry.query;
    var nf = function (v) { return isMissing(v) ? 'Not found' : String(v); };
    L.push('# ' + name, '');
    if (b) {
      var meta = [];
      if (!isMissing(b.companies_house_number)) meta.push('Company no. ' + b.companies_house_number);
      if (!isMissing(b.website)) meta.push(b.website);
      if (!isMissing(b.sector)) meta.push(b.sector);
      if (b.confidence) meta.push('Confidence: ' + b.confidence);
      if (meta.length) L.push(meta.join(' · '), '');
      if (!isMissing(b.match_note)) L.push('> ' + b.match_note, '');
      L.push('## What they do', '', nf(b.what_they_do), '');
      var sl = b.size_location || {};
      L.push('## Size & location', '', '- Employees: ' + nf(sl.employees), '- Revenue: ' + nf(sl.revenue), '- Headquarters: ' + nf(sl.headquarters), '- Other locations: ' + nf(sl.other_locations), '- Founded: ' + nf(sl.founded), '');
      L.push('## Recent news & signals', '');
      var sigs = (b.signals || []).filter(function (s) { return s && !isMissing(s.detail); });
      if (!sigs.length) L.push('No recent signals found');
      sigs.forEach(function (s) { L.push('- **' + cap(s.type || 'news') + (isMissing(s.date) ? '' : ', ' + s.date) + ':** ' + s.detail + (safeUrl(s.source_url) ? ' ([source](' + safeUrl(s.source_url) + '))' : '')); });
      L.push('', '## Why they might be a good prospect', '');
      (b.why_prospect && b.why_prospect.length ? b.why_prospect : ['Not found']).forEach(function (x) { L.push('- ' + x); });
      L.push('', '## Suggested talking points', '');
      (b.talking_points && b.talking_points.length ? b.talking_points : ['Not found']).forEach(function (x) { L.push('- ' + x); });
      L.push('');
    } else {
      L.push('## Raw answer', '', entry.rawText || '', '');
    }
    L.push('## Sources', '');
    (entry.sources || []).forEach(function (s, i) { L.push((i + 1) + '. [' + s.title.replace(/[\[\]]/g, '') + '](' + s.url + ')'); });
    L.push('', '---', '_Prosper brief · ' + shortModel(entry.model) + ' · ' + new Date(entry.ts).toLocaleString('en-GB') + ' · est. cost ' + fmtUsd((entry.cost || {}).total || 0) + '. AI-generated from web sources; verify before use._');
    return L.join('\n');
  }
  function copyBrief() {
    if (!current) return;
    var md = toMarkdown(current);
    var done = function () { toast('Brief copied to clipboard'); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(md).then(done, function () { fallbackCopy(md); done(); });
    else { fallbackCopy(md); done(); }
  }
  function fallbackCopy(t) { var ta = el('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) {} ta.remove(); }
  function exportBrief() {
    if (!current) return;
    var name = ((current.brief && current.brief.company_name) || current.query).replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'brief';
    var blob = new Blob([toMarkdown(current)], { type: 'text/markdown;charset=utf-8' });
    var a = el('a', { href: URL.createObjectURL(blob), download: 'prosper-' + name + '.md' });
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  // ---------- history ----------
  function renderHistory() {
    var h = getHistory();
    els.history.innerHTML = '';
    els.historyEmpty.hidden = h.length > 0;
    els.clearHistory.hidden = h.length === 0;
    h.forEach(function (entry) {
      var name = (entry.brief && !isMissing(entry.brief.company_name)) ? entry.brief.company_name : entry.query;
      var btn = el('button', { type: 'button', class: current && current.id === entry.id ? 'active' : '' }, [
        el('span', { class: 'h-name', text: name }),
        el('span', { class: 'h-meta', text: fmtDate(entry.ts) + ' · ' + fmtUsd((entry.cost || {}).total || 0) })
      ]);
      btn.addEventListener('click', function () {
        hideStatus(); renderEntry(entry);
        if (window.matchMedia('(max-width: 860px)').matches) els.result.scrollIntoView({ behavior: 'auto', block: 'start' });
      });
      els.history.appendChild(el('li', null, [btn]));
    });
  }

  // ---------- status ----------
  var timer = null;
  function showLoading(q) {
    var start = Date.now();
    els.status.className = 'status loading'; els.status.hidden = false;
    els.status.innerHTML = '';
    var elapsed = el('span', { class: 'elapsed', text: '0s' });
    els.status.appendChild(el('span', { class: 'spinner', 'aria-hidden': 'true' }));
    els.status.appendChild(el('span', null, [el('strong', { text: 'Researching ' + q }), el('br'), el('span', { class: 'muted small', text: 'Searching the web and writing the brief. Usually 20–60 seconds.' })]));
    els.status.appendChild(elapsed);
    timer = setInterval(function () { elapsed.textContent = Math.round((Date.now() - start) / 1000) + 's'; }, 500);
  }
  function hideStatus() { clearInterval(timer); els.status.hidden = true; els.status.innerHTML = ''; }
  function showError(err) {
    clearInterval(timer);
    els.status.className = 'status error'; els.status.hidden = false; els.status.innerHTML = '';
    els.status.appendChild(el('strong', { text: err.title || 'Something went wrong' }));
    els.status.appendChild(el('p', { text: err.detail || String(err) }));
    if (err.kind === 'auth' || err.kind === 'model' || err.kind === 'permission') {
      var b = el('button', { type: 'button', class: 'linklike', text: 'Open Settings' }); b.addEventListener('click', openSettings);
      els.status.appendChild(el('p', null, [b]));
    }
    if (err.raw) els.status.appendChild(el('details', null, [el('summary', { class: 'small', text: 'Details' }), el('pre', { text: String(err.raw) })]));
  }

  // ---------- search ----------
  async function onSearch(e) {
    e.preventDefault();
    if (busy) return;
    var q = els.q.value.trim();
    if (!q) return;
    var key = getKey();
    if (!key) { showError(new ApiError('nokey', 'API key needed', 'Add your Anthropic API key in Settings first.')); openSettings(); return; }
    var modelId = getModel();
    busy = true; els.btn.disabled = true; els.btn.textContent = 'Researching…';
    els.result.hidden = true; els.empty.hidden = true; current = null; renderHistory();
    showLoading(q);
    var t0 = Date.now();
    try {
      var out = await research(q, key, modelId);
      var ex = extract(out.content);
      var brief = parseBrief(ex.text);
      if (brief && typeof brief !== 'object') brief = null;
      var cost = estimateCost(out.usage, modelId);
      var entry = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        query: q, ts: Date.now(), model: modelId, seconds: Math.round((Date.now() - t0) / 1000),
        brief: brief, rawText: brief ? '' : ex.text.slice(0, 20000), sources: buildSources(brief, ex),
        usage: out.usage, cost: cost, stopReason: out.stop_reason, searchErrors: ex.searchErrors
      };
      var t = getTotal(); t.usd += cost.total; t.count += 1; setTotal(t); renderTotal();
      var h = getHistory(); h.unshift(entry); setHistory(h);
      hideStatus();
      renderEntry(entry);
      if (!brief) toast(out.stop_reason === 'max_tokens' ? 'Answer was cut off; shown as raw text' : 'Brief shown as raw text');
    } catch (err) {
      if (!(err instanceof ApiError)) err = new ApiError('unknown', 'Something went wrong', 'An unexpected error occurred while building the brief.', String(err && err.stack || err));
      showError(err);
      if (!current) els.empty.hidden = false;
    } finally {
      busy = false; els.btn.disabled = false; els.btn.textContent = 'Research';
    }
  }

  // ---------- settings ----------
  function openSettings() {
    els.apiKey.value = getKey(); els.apiKey.type = 'password'; $('toggleKey').textContent = 'Show';
    els.model.value = getModel(); updateModelNote();
    renderTotal();
    if (typeof els.settings.showModal === 'function') els.settings.showModal(); else els.settings.setAttribute('open', '');
  }
  function updateModelNote() {
    var m = modelInfo(els.model.value);
    if (m) els.modelNote.textContent = '$' + m.input.toFixed(2) + ' / $' + m.output.toFixed(2) + ' per million input / output tokens, plus $0.01 per web search.';
  }
  function saveSettings() {
    var k = els.apiKey.value.trim();
    if (k) lsSet(LS.key, k); else { try { localStorage.removeItem(LS.key); } catch (e) {} }
    lsSet(LS.model, els.model.value);
    refreshKeyNotice();
    toast('Settings saved');
  }
  function refreshKeyNotice() { els.keyNotice.hidden = !!getKey(); }

  function init() {
    MODELS.forEach(function (m) { els.model.appendChild(el('option', { value: m.id, text: m.label })); });
    $('hintSearches').textContent = MAX_SEARCHES;
    els.form.addEventListener('submit', onSearch);
    $('openSettings').addEventListener('click', openSettings);
    document.querySelectorAll('[data-open-settings]').forEach(function (b) { b.addEventListener('click', openSettings); });
    els.model.addEventListener('change', updateModelNote);
    $('toggleKey').addEventListener('click', function () {
      var show = els.apiKey.type === 'password'; els.apiKey.type = show ? 'text' : 'password'; this.textContent = show ? 'Hide' : 'Show';
    });
    $('settingsForm').addEventListener('submit', function (e) {
      var v = e.submitter && e.submitter.value;
      if (v === 'save') saveSettings();
    });
    $('clearKey').addEventListener('click', function () { els.apiKey.value = ''; try { localStorage.removeItem(LS.key); } catch (e) {} refreshKeyNotice(); toast('Key removed'); });
    $('resetTotal').addEventListener('click', function () { if (confirm('Reset the running cost total to $0?')) { setTotal({ usd: 0, count: 0 }); renderTotal(); } });
    els.clearHistory.addEventListener('click', function () {
      if (!confirm('Clear all saved briefs from this browser?')) return;
      setHistory([]); current = null; els.result.hidden = true; els.empty.hidden = false; renderHistory();
    });
    renderTotal(); renderHistory(); refreshKeyNotice();
  }
  init();
})();
