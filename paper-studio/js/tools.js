// Free tools: standalone pages (no sign-up) that each do one job from the
// workspace. The page's <body data-tool="..."> picks the tool.
(function () {
  const S = window.Sigao;
  const esc = S.text.escapeHtml;
  const root = document.getElementById('tool');
  const tool = document.body.dataset.tool;
  const API = (window.ARGUO_CONFIG || {}).apiUrl || 'https://arguo-api.arguolucid.workers.dev';
  const track = (name, detail) => S.cloud && S.cloud.logEvent && S.cloud.logEvent(name, detail);
  const ui = { busy: false, err: '', results: [], journal: null, journals: [], briefing: null, quota: null };

  const STATUS = { verified: ['Real and correct', 'ok'], mismatch: ['Real, details wrong', 'warn'], notfound: ['Could not be found', 'pen'], error: ['Not checked', 'warn'], pending: ['Checking…', 'accent'] };

  function toast(msg) {
    let t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toast.timer); toast.timer = setTimeout(() => t.classList.remove('show'), 2200);
  }
  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => toast('Copied'), () => toast('Select the text and copy it'));
  }

  // ---------- citation checker ----------
  function refRows(format) {
    if (!ui.results.length) return '';
    const n = (s) => ui.results.filter((r) => r.status === s).length;
    const summary = ui.results.some((r) => r.status === 'pending') ? '' : `<div class="tool-summary">
      <span class="pill tone-ok">${n('verified')} real</span><span class="pill tone-warn">${n('mismatch')} with wrong details</span><span class="pill tone-pen">${n('notfound')} not found</span></div>`;
    return `${summary}<ol class="ref-list">${ui.results.map((r) => {
      const [label, tone] = STATUS[r.status] || STATUS.pending;
      const out = r.record ? (format ? format(r) : S.cite.format(r.record, 'apa')) : '';
      return `<li class="ref"><div class="ref-head"><span class="pill tone-${tone}">${label}</span>${r.doi ? `<code>${esc(r.doi)}</code>` : ''}</div>
        <p class="ref-raw">${esc(r.raw)}</p>
        ${(r.issues || []).length ? `<ul class="ref-issues">${r.issues.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
        ${r.note ? `<p class="ref-note">${esc(r.note)}</p>` : ''}
        ${out ? `<p class="ref-fixed"><span>${format ? 'Formatted' : 'Correct record'}</span>${esc(out)}</p>` : ''}
        ${r.record && r.record.doi ? `<p class="fine"><a href="https://doi.org/${esc(r.record.doi)}" target="_blank" rel="noopener">Open the paper</a></p>` : ''}</li>`;
    }).join('')}</ol>`;
  }

  async function verifyAll(text, after) {
    ui.results = S.cite.parse(text).map((e) => Object.assign(e, { status: 'pending' }));
    if (!ui.results.length) { ui.err = 'Paste at least one reference.'; render(); return; }
    ui.busy = true; ui.err = ''; render();
    for (const e of ui.results) { Object.assign(e, await S.cite.verify(e)); render(); }
    if (after) await after();
    ui.busy = false; render();
  }

  function citationChecker() {
    return `<form class="tool-form" data-form="check">
        <label for="t-refs">Paste your references, one per line</label>
        <textarea id="t-refs" rows="8" class="mono" placeholder="Levenson, J. C., et al. (2016). The association between social media use and sleep disturbance among young adults. Preventive Medicine, 85, 36–41.">${esc(ui.text || '')}</textarea>
        <div class="toolbar"><button class="btn grad"${ui.busy ? ' disabled' : ''}>${ui.busy ? 'Checking…' : 'Check references'}</button><button type="button" class="btn" data-action="example">Try an example</button></div>
        ${ui.err ? `<p class="acct-msg error">${esc(ui.err)}</p>` : ''}
      </form>
      <div id="out">${refRows()}</div>`;
  }

  // ---------- reference formatter ----------
  function formatter() {
    const j = ui.journal;
    const fmt = (r) => (j && r.formatted ? r.formatted : S.cite.format(r.record, j ? S.styles.fallback(j.format) : ui.style || 'apa'));
    const done = ui.results.filter((r) => r.record);
    return `<form class="tool-form" data-form="journal">
        <label for="t-j">Target journal or style</label>
        ${j ? `<div class="journal-chip"><span><b>${esc(j.title)}</b> · ${esc(j.style)} style</span><button type="button" class="link-btn" data-action="clear-journal">Change</button></div>`
          : `<div class="search-bar"><input id="t-j" placeholder="e.g. Nature, PLOS ONE, The Lancet, APA" value="${esc(ui.jq || '')}"><button class="btn">Find</button></div>
            ${ui.journals.length ? `<ul class="journal-list">${ui.journals.map((x, i) => `<li><button type="button" class="link-btn" data-action="pick" data-i="${i}">${esc(x.title)}</button><small>${esc(x.format)}</small></li>`).join('')}</ul>` : ''}`}
      </form>
      <form class="tool-form" data-form="format">
        <label for="t-refs">References or DOIs, one per line</label>
        <textarea id="t-refs" rows="7" class="mono" placeholder="10.1016/j.ypmed.2016.01.001&#10;https://doi.org/10.1136/bmjopen-2019-031161">${esc(ui.text || '')}</textarea>
        <div class="toolbar"><button class="btn grad"${ui.busy ? ' disabled' : ''}>${ui.busy ? 'Formatting…' : 'Format references'}</button>
          ${done.length ? `<button type="button" class="btn" data-action="copy">Copy list</button>` : ''}<button type="button" class="btn" data-action="example">Try an example</button></div>
        ${ui.err ? `<p class="acct-msg error">${esc(ui.err)}</p>` : ''}
      </form>
      <div id="out">${refRows(fmt)}</div>`;
  }

  async function formatResults() {
    const j = ui.journal;
    if (!j) return;
    for (const r of ui.results) {
      if (!r.record || !r.doi || r.formattedStyle === j.style) continue;
      try { r.formatted = await S.styles.formatDoi(r.doi, j.style); r.formattedStyle = j.style; } catch (e) { /* keep built-in */ }
      render();
    }
  }

  // ---------- gap finder ----------
  function gapFinder() {
    const b = ui.briefing;
    return `<form class="tool-form" data-form="gap">
        <label for="t-q">Your research topic</label>
        <div class="search-bar"><input id="t-q" placeholder="e.g. bedtime social media use and sleep in university students" value="${esc(ui.q || '')}"><button class="btn grad"${ui.busy ? ' disabled' : ''}>${ui.busy ? 'Searching…' : 'Find the gaps'}</button></div>
        ${ui.err ? `<p class="acct-msg error">${esc(ui.err)}</p>` : ''}
      </form>
      ${b ? `<section class="ai-box"><div class="ai-head"><h4>Where the gaps are</h4></div>
        ${b.loading ? '<p class="ai-status">Reading the papers…</p>' : b.error ? `<p class="ai-status error">${esc(b.error)}</p>`
          : b.notes.map((n) => `<article class="note"><header><span class="note-tag" style="color:var(--accent)">${n.level === 'gap' ? 'Possible gap' : 'Theme'}</span></header><h4>${esc(n.title)}</h4>${n.why ? `<p class="note-why">${esc(n.why)}</p>` : ''}${n.how ? `<p class="note-how"><b>Read first</b>${esc(n.how)}</p>` : ''}
            ${(n.refs || []).length ? `<p class="note-refs">Based on ${n.refs.map((k) => `<a href="#p${k}">[${k}]</a>`).join(' ')}</p>` : ''}</article>`).join('')}
        ${ui.quota ? `<p class="ai-quota">${ui.quota.remaining} of ${ui.quota.limit} free AI checks left today</p>` : ''}</section>` : ''}
      ${ui.results.length ? `<h3 class="sub">Recent and influential papers</h3><ol class="paper-list">${ui.results.map((r, i) => `<li class="paper" id="p${i + 1}"><div class="paper-top"><span class="paper-n">${i + 1}</span><div class="paper-main">
          <a class="paper-title" href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.title)}</a>
          <p class="paper-meta">${esc(S.discover.shortAuthors(r.authors))} · ${r.year || 'n.d.'}${r.venue ? ` · <i>${esc(r.venue)}</i>` : ''}${r.cited ? ` · cited ${r.cited.toLocaleString()}` : ''}</p></div></div>
          <div class="paper-links">${r.oaUrl ? `<a href="${esc(r.oaUrl)}" target="_blank" rel="noopener">Free full text</a>` : ''}<a href="${esc(r.url)}" target="_blank" rel="noopener">Publisher page</a></div></li>`).join('')}</ol>` : ''}`;
  }

  async function findGaps(q) {
    ui.q = q; ui.busy = true; ui.err = ''; ui.briefing = null; render();
    try {
      const r = await S.discover.smartSearch({ query: q, years: 5, sort: 'relevance', oa: false }, { proxy: API });
      ui.results = r.results.slice(0, 12);
      track('tool_gap', 'search');
      if (!ui.results.length) throw new Error('No papers found. Try broader terms.');
      ui.busy = false; ui.briefing = { loading: true }; render();
      const res = await fetch(API + '/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: 'survey', input: { query: q, papers: ui.results.map((p) => ({ title: p.title, year: p.year, venue: p.venue, cited: p.cited, abstract: p.abstract })) } }) });
      const data = await res.json().catch(() => ({}));
      if (data.limit) ui.quota = { remaining: data.remaining, limit: data.limit };
      ui.briefing = res.ok ? { notes: data.notes || [] } : { error: data.error || 'The AI briefing is not available right now; the papers below are still real and linked.' };
    } catch (e) { ui.err = e.message === 'Failed to fetch' ? 'Could not reach the search service. Try again.' : e.message; ui.briefing = ui.briefing && ui.briefing.loading ? null : ui.briefing; }
    ui.busy = false; render();
  }

  // ---------- shell ----------
  const VIEWS = { 'citation-checker': citationChecker, 'reference-formatter': formatter, 'gap-finder': gapFinder };
  function render() { root.innerHTML = VIEWS[tool](); }

  const EXAMPLE = 'Levenson, J. C., Shensa, A., Sidani, J. E., Colditz, J. B., & Primack, B. A. (2016). The association between social media use and sleep disturbance among young adults. Preventive Medicine, 85, 36–41. https://doi.org/10.1016/j.ypmed.2016.01.001\nWoods, H. C., & Scott, H. (2018). #Sleepyteens: Social media use in adolescence is associated with poor sleep quality, anxiety, depression and low self-esteem. Journal of Adolescence, 51, 41–49.\nZhang, W., & Li, M. (2021). Bedtime phone use and sleep quality among college students. Journal of Campus Sleep Studies, 12(3), 45–52.';

  document.addEventListener('submit', async (e) => {
    const f = e.target.closest('[data-form]');
    if (!f) return;
    e.preventDefault();
    const kind = f.dataset.form;
    if (kind === 'check') { ui.text = f.querySelector('#t-refs').value; track('tool_citation'); verifyAll(ui.text); }
    if (kind === 'format') { ui.text = f.querySelector('#t-refs').value; track('tool_format'); verifyAll(ui.text, formatResults); }
    if (kind === 'gap') findGaps(f.querySelector('#t-q').value.trim());
    if (kind === 'journal') {
      ui.jq = f.querySelector('#t-j').value;
      try { ui.journals = S.styles.search(await S.styles.load(), ui.jq, 8); ui.err = ui.journals.length ? '' : 'No style found with that name.'; } catch (err) { ui.err = 'Could not load the journal list. Try again.'; }
      render();
    }
  });
  document.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const a = el.dataset.action;
    if (a === 'example') { ui.text = tool === 'reference-formatter' ? '10.1016/j.ypmed.2016.01.001\n10.1016/j.adolescence.2016.05.008\n10.1136/bmjopen-2019-031161' : EXAMPLE; ui.results = []; render(); }
    if (a === 'pick') {
      const x = ui.journals[Number(el.dataset.i)];
      try { ui.journal = { title: x.title, style: await S.styles.parentOf(x), format: x.format }; ui.journals = []; track('journal_pick', 'tool'); await formatResults(); } catch (err) { ui.err = err.message; }
      render();
    }
    if (a === 'clear-journal') { ui.journal = null; render(); }
    if (a === 'copy') {
      const j = ui.journal;
      const items = ui.results.filter((r) => r.record).map((r) => (j && r.formatted ? r.formatted : S.cite.format(r.record, j ? S.styles.fallback(j.format) : 'apa')));
      copy(j && j.format === 'numeric' ? items.map((t, i) => `${i + 1}. ${t}`).join('\n') : items.sort((x, y) => x.localeCompare(y)).join('\n'));
    }
  });

  render();
  if (S.cloud && S.cloud.init) S.cloud.init().then(() => track('visit', tool), () => {});
})();
