// UI: hash-routed views, two-way binding through data-bind paths, and a
// margin of notes beside each module that re-renders as you type.
(function () {
  const S = window.Sigao;
  const esc = S.text.escapeHtml;
  const app = document.getElementById('app');

  let state = S.store.load() || S.sample.create();
  if (!state.discover) state.discover = S.sample.blankDiscover();
  if (!state.design) state.design = S.design.blank();
  ['question', 'gap', 'aim', 'method'].forEach((k) => { if (typeof state.check[k] !== 'string') state.check[k] = ''; });
  let searching = false;
  let linkBusy = '';
  let linkErr = '';
  let openPaper = '';
  const paperAi = {};
  let searchErr = '';
  let pending = '';
  let verifying = false;
  const ai = {}; // per view: { loading, notes, error, blocked }
  const AI_API = window.ARGUO_API || (window.ARGUO_CONFIG || {}).apiUrl || 'https://arguo-api.arguolucid.workers.dev';
  const C = S.cloud;
  const acct = { mode: 'signin', msg: '', err: '', busy: false, projects: null, recovery: false, confirmOpen: '' };
  let cloudState = ''; // '', 'saving', 'saved', 'error'

  const MODULES = [
    { id: 'overview', name: 'Overview', pain: 'Progress and next step' },
    { id: 'discover', name: 'Discover research', pain: 'What’s new in my field? Where do I start?' },
    { id: 'matrix', name: 'Literature matrix', pain: 'A review without an argument · no clear gap' },
    { id: 'ideas', name: 'Next steps & ideas', pain: 'What should I do next? What would be new?' },
    { id: 'design', name: 'Study design', pain: 'How did similar studies do it? Is my design sound?' },
    { id: 'outline', name: 'Argument thread', pain: 'Sections that don’t line up · can’t get started' },
    { id: 'cite', name: 'Citation check', pain: 'Wrong details · AI-invented references' },
    { id: 'check', name: 'Consistency check', pain: 'Six sections, each checked against your argument thread' },
    { id: 'review', name: 'Reviewer comments', pain: 'A major revision you can’t break down' },
    { id: 'submit', name: 'Submission checklist', pain: 'Missing items at submission' },
  ];

  const LEVEL = {
    issue: ['Fix', 'pen'], tip: ['Suggestion', 'warn'], gap: ['Possible gap', 'accent'], ask: ['Think about', 'accent'], ok: ['Looks good', 'ok'],
  };

  // ---------- helpers ----------
  function getPath(obj, path) { return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj); }
  function setPath(obj, path, val) {
    const keys = path.split('.');
    const last = keys.pop();
    const target = keys.reduce((o, k) => (o[k] == null ? (o[k] = {}) : o[k]), obj);
    target[last] = val;
  }
  let cloudTimer = null;
  function save() {
    S.store.save(state);
    if (C.enabled() && C.user() && state.cloudId) {
      clearTimeout(cloudTimer);
      cloudTimer = setTimeout(pushCloud, 1500);
    }
  }
  async function pushCloud() {
    cloudState = 'saving'; paintCloud();
    try { state.cloudId = await C.save(state); S.store.save(state); cloudState = 'saved'; } catch (e) { cloudState = 'error'; }
    paintCloud();
  }
  function cloudLine() {
    if (!C.enabled()) return '';
    if (!C.user()) return '<p class="cloud-line">Only in this browser. <a href="#account">Sign in</a> to keep it in your account.</p>';
    if (!state.cloudId) return '<p class="cloud-line">Only in this browser. <button class="link-btn" data-action="cloud-save">Save to my account</button></p>';
    return `<p class="cloud-line">${{ saving: 'Saving to your account…', error: 'Could not save to your account. Your changes are kept in this browser.' }[cloudState] || 'Saved to your account.'}</p>`;
  }
  function paintCloud() { const el = document.getElementById('cloud-line'); if (el) el.innerHTML = cloudLine(); }
  function paintAccountLink() {
    const a = document.getElementById('account-link');
    if (!a) return;
    a.hidden = !C.enabled();
    a.textContent = C.user() ? 'Account' : 'Sign in';
  }

  function fieldLabel(key) { const f = S.outline.FIELDS.find((x) => x.key === key); return f ? f.label : ''; }

  function toast(msg) {
    let t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  function noteHtml(n) {
    const [tag, tone] = LEVEL[n.level] || LEVEL.tip;
    return `<article class="note tone-${tone}">
      <header><span class="note-tag">${tag}</span>${n.field ? `<button class="note-field" data-action="focus" data-target="f-${n.field}">${esc(fieldLabel(n.field))}</button>` : ''}</header>
      <h4>${esc(n.title)}</h4>
      ${n.why ? `<p class="note-why">${esc(n.why)}</p>` : ''}
      ${n.how ? `<p class="note-how"><b>How to fix</b>${esc(n.how)}</p>` : ''}
      ${n.example ? `<details class="note-example"><summary>See an example from another topic</summary><p>${esc(n.example)}</p></details>` : ''}
      ${n.ask ? `<p class="note-ask"><b>Ask yourself</b>${esc(n.ask)}</p>` : ''}
    </article>`;
  }

  function notesPanel(notes, extra) {
    const count = notes.filter((n) => n.level === 'issue').length;
    return `<div class="notes-head">
        <h3>Notes</h3>
        <span class="count">${count ? `${count} to fix` : 'Nothing to fix'}</span>
      </div>
      <p class="notes-rule">Arguo points out problems, explains how to fix them and shows examples from other topics. The writing stays yours.</p>
      ${extra || ''}
      <div class="notes-list">${notes.map(noteHtml).join('')}</div>`;
  }

  // ---------- module status (used by overview and sidebar) ----------
  function status() {
    const o = state.outline;
    const oNotes = S.outline.check(o);
    const mNotes = S.matrix.analyze(state.matrix);
    const refs = state.refs.results || [];
    const c = S.consistency.check({ question: o.question, method: o.method, ...state.check });
    const rs = S.review.summary(state.review.tasks);
    const issues = (ns) => ns.filter((n) => n.level === 'issue').length;
    return {
      design: { value: state.design.type ? S.design.TYPES[state.design.type].split(' (')[0] : 'Not planned yet', issues: S.design.check(state.design).filter((n) => n.level === 'issue').length && state.design.type ? S.design.check(state.design).filter((n) => n.level === 'issue').length : 0 },
      ideas: { value: `${S.ideas.nextSteps(state).filter((x) => x.done).length}/${S.ideas.nextSteps(state).length} steps done`, issues: 0 },
      discover: { value: state.discover.results.length ? `${state.discover.results.length} papers found` : 'No search yet', issues: 0 },
      outline: { value: `${S.outline.filled(o)}/6 nodes`, issues: issues(oNotes), done: S.outline.filled(o) === 6 && !issues(oNotes) },
      matrix: { value: `${state.matrix.filter((r) => r.source.trim()).length} sources`, issues: 0, gaps: mNotes.filter((n) => n.level === 'gap').length },
      cite: { value: `${refs.filter((r) => r.status === 'verified').length}/${refs.length} verified`, issues: refs.filter((r) => r.status === 'mismatch' || r.status === 'notfound').length },
      check: { value: !state.check.results.trim() || !state.check.discussion.trim() ? 'Nothing pasted yet'
        : c.flagged.length ? `${c.flagged.length} sentences to review` : 'No problems found', issues: issues(c.notes) },
      review: { value: `${rs.done}/${rs.total} addressed`, issues: rs.majorOpen },
      submit: { value: (() => { const it = S.checklist.build(state).flatMap((g) => g.items); return `${it.filter((i) => S.checklist.isDone(i, state)).length}/${it.length} items`; })(), issues: 0 },
    };
  }

  // ---------- AI feedback ----------
  function aiBlock(v) {
    const a = ai[v] || {};
    const body = a.loading ? '<p class="ai-status">Reading your text…</p>'
      : a.error ? `<p class="ai-status error">${esc(a.error)}</p>`
        : a.notes ? (a.notes.length ? a.notes.map((n) => (v.startsWith('check-') ? noteHtml(n).replace('See an example from another topic', 'See how published papers do it') : v === 'discover' ? noteHtml(n).replace('<b>How to fix</b>', '<b>Read first</b>') : v === 'ideas' ? noteHtml(n).replace('<b>How to fix</b>', '<b>How to test it</b>').replace('>Possible gap<', '>Direction<') : v === 'methods' ? noteHtml(n).replace('<b>How to fix</b>', '<b>For your study</b>').replace('>Suggestion<', '>Approach<') : noteHtml(n)) + (n.refs && n.refs.length ? `<p class="note-refs">Based on ${n.refs.map((r) => paperRef(v, r)).join(' ')}</p>` : '')).join('') : '<p class="ai-status">No further problems found.</p>')
          + (a.blocked ? `<p class="ai-status">${a.blocked} AI ${a.blocked === 1 ? 'note was' : 'notes were'} hidden because ${a.blocked === 1 ? 'it' : 'they'} repeated your wording.</p>` : '') : '';
    const label = v.startsWith('check-') ? 'AI section review' : { discover: 'AI research briefing', ideas: 'Possible new directions', design: 'AI design review', methods: 'Methods in similar studies' }[v] || 'AI feedback';
    if (v === 'discover' && !state.discover.results.length) return '';
    return `<section class="ai-box">
        <div class="ai-head"><h4>${label}</h4><button class="btn small-btn" data-action="ai" data-view="${v}"${a.loading ? ' disabled' : ''}>${a.notes || a.error ? 'Ask again' : { discover: 'Summarise these results', ideas: 'Suggest directions', design: 'Review my design', methods: 'Compare with similar studies' }[v] || 'Get AI feedback'}</button></div>
        ${v === 'discover' ? '<p class="ai-rule">The AI summarises only the papers listed here and links each point to them. Always read the papers themselves.</p>' : ''}
        <p class="ai-rule">This module’s text is sent to our AI provider, Groq, which does not train on it (<a href="#privacy">privacy</a>). The AI follows the same rule: diagnose, never write.</p>
        ${body}
      </section>`;
  }

  // Papers with abstracts the AI may quote as examples: Discover results first, then matrix papers.
  function examplePapers() {
    const seen = new Set();
    return [...state.discover.results, ...state.matrix.map((r) => r.meta).filter(Boolean)]
      .filter((p) => p && p.abstract && !seen.has(p.id) && seen.add(p.id)).slice(0, 6);
  }

  function sectionInput(v) {
    const t = S.consistency.TABS.find((x) => 'check-' + x.key === v);
    if (!t) return null;
    return { label: t.label, section: t.section, outline: state.outline, text: state.check[t.field] || '',
      papers: examplePapers().map((p) => ({ title: p.title, year: p.year, abstract: String(p.abstract).slice(0, 500) })) };
  }

  async function askAi(v) {
    const input = {
      outline: state.outline,
      check: { question: state.outline.question, method: state.outline.method, results: state.check.results, discussion: state.check.discussion },
      matrix: { rows: state.matrix },
      review: { comments: state.review.input },
      ideas: S.ideas.ideasInput(state),
      design: Object.assign({}, state.design, { question: state.design.question || state.outline.question }),
      methods: { type: S.design.TYPES[state.design.type] || '', procedure: state.design.procedure, papers: state.discover.results.slice(0, 10).map((r) => ({ title: r.title, year: r.year, abstract: String(r.abstract || '').slice(0, 600) })) },
      discover: { query: state.discover.query, papers: state.discover.results.slice(0, 12).map((r) => ({ title: r.title, year: r.year, venue: r.venue, cited: r.cited, abstract: r.abstract })) },
    }[v] || sectionInput(v);
    ai[v] = { loading: true };
    refreshNotes();
    try {
      const res = await fetch(AI_API + '/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: v.startsWith('check-') ? 'section' : { check: 'consistency', discover: 'survey' }[v] || v, input }) });
      const data = await res.json().catch(() => ({}));
      ai[v] = res.ok ? { notes: data.notes || [], blocked: data.blocked || 0 } : { error: data.error || `Request failed (${res.status}).` };
    } catch (e) {
      ai[v] = { error: 'Could not reach the AI server. Previews block outside requests; it works on the deployed site.' };
    }
    refreshNotes();
  }

  // ---------- views ----------
  function home() {
    const rows = [
      ['Discover research', 'Search 250 million scholarly works for the newest and most cited research on your topic, with links to every paper and an AI briefing that cites only those papers.', 'Already have a topic and need the state of the art'],
      ['Next steps & ideas', 'A plan worked out from where your project is, and AI-suggested research directions built only from the papers you found.', 'Not sure what to do next or what would be new'],
      ['Study design', 'Describe your planned study; Arguo checks controls, randomisation, sample size, confounders, ethics and preregistration, and the AI compares it with methods of similar studies.', 'How should I design my experiment?'],
      ['Argument thread', 'Link research question, gap, aim, method, result and conclusion into one line, and see where it breaks.', 'Sections that don’t line up · can’t get started'],
      ['Literature matrix', 'One row per paper. Arguo finds recurring limitations, a dominant design and missing samples, so the gap becomes visible.', 'Read a lot, but the review has no argument'],
      ['Citation check', 'Every reference is checked against Crossref for authors, year and title. References that cannot be traced are flagged.', 'Wrong details · AI-invented references'],
      ['Consistency check', 'Compares the discussion with the results sentence by sentence: unsupported claims, causal overreach, missing limitations.', 'A discussion that says more than the data'],
      ['Reviewer comments', 'Turns supervisor and reviewer comments into tasks, flags must-fix and vague comments, and tracks each one.', 'A major revision you can’t break into steps'],
      ['Submission checklist', 'Journal fit, ethics, data, funding and author statements, checked item by item before you submit.', 'Not sure what you’ve missed'],
    ];
    return `<section class="hero wrap">
        <p class="eyebrow">Academic writing workspace · prototype</p>
        <h1>Think it through.<br>Write it yourself.</h1>
        <p class="lede">From reading the literature to submission, Arguo points out what is wrong, explains how to fix it and shows examples from other topics. Every word of your paper stays yours.</p>
        <div class="hero-actions">
          <button class="btn primary" data-action="open-sample">Open the example project</button>
          <button class="btn" data-action="new-blank">Start a blank project</button>
        </div>
        <p class="fine">Your project is saved only in this browser.</p>
      </section>
      <section class="wrap modules-list">
        <h2>Nine modules, one line of argument</h2>
        <ol class="flow">${rows.map(([n, d, p]) => `<li><div><h3>${n}</h3><p>${d}</p></div><span class="pain">For: ${p}</span></li>`).join('')}</ol>
      </section>
      <section class="wrap redline">
        <h2>Feedback, never ghostwriting</h2>
        <div class="redline-grid">
          <div><h3>Arguo does</h3><ul>
            <li>Point out where the problem is and why it matters</li>
            <li>Explain how to fix it, step by step</li>
            <li>Show the pattern with an example from another topic</li>
            <li>Ask questions that help you think it through</li>
            <li>Verify references and format the bibliography</li></ul></div>
          <div class="no"><h3>Arguo does not</h3><ul>
            <li>Rewrite or continue your paragraphs</li>
            <li>Generate paragraphs, sections or papers</li>
            <li>One-click polishing or “humanising” AI text</li>
            <li>Invent references: every paper it shows is a real, linked record</li>
            <li>Write your response letter for you</li></ul></div>
        </div>
        <p class="fine">Many journals ask authors to disclose AI-generated text. Arguo does not generate any of your manuscript, but check your journal’s policy on disclosing AI-assisted feedback.</p>
      </section>
      <section class="wrap roadmap">
        <h2>Coming later</h2>
        <p>AI-powered feedback, a writing history that shows the work is yours, journal matching, language issue flags, progress tracking and peer review circles, guidance for narrating results, and Word, LaTeX/Overleaf and Zotero integration.</p>
      </section>`;
  }

  function overview() {
    const st = status();
    const next = MODULES.slice(1).find((m) => st[m.id] && st[m.id].issues);
    const confirmBar = pending ? `<div class="confirm" role="alert">
        <span>${pending === 'reset' ? 'Restoring the example replaces everything in this project.' : 'Clearing deletes everything in this project.'}</span>
        <button class="btn danger" data-action="confirm">${pending === 'reset' ? 'Restore example' : 'Clear project'}</button><button class="btn" data-action="cancel">Cancel</button></div>` : '';
    const main = `<div class="title-row">
        <label for="f-title" class="sr">Paper title</label>
        <input id="f-title" class="title-input" data-bind="title" value="${esc(state.title)}">
        ${state.sample ? '<span class="sample-chip">Example project</span>' : ''}
      </div>
      ${confirmBar}
      <div id="cloud-line">${cloudLine()}</div>
      <div class="status-grid">${MODULES.slice(1).map((m) => {
        const s = st[m.id];
        return `<a class="status-card" href="#${m.id}">
          <span class="status-name">${m.name}</span>
          <span class="status-value">${esc(s.value)}</span>
          ${s.issues ? `<span class="pill tone-pen">${s.issues} to address</span>` : s.gaps ? `<span class="pill tone-accent">${s.gaps} gap ${s.gaps === 1 ? 'clue' : 'clues'}</span>` : '<span class="pill tone-ok">No issues</span>'}
          <span class="status-pain">${m.pain}</span></a>`;
      }).join('')}</div>
      <div class="project-actions">
        <button class="btn" data-action="ask-reset">Restore example project</button>
        <button class="btn" data-action="ask-clear">Clear and start my paper</button>
      </div>`;
    const notes = [];
    if (next) notes.push({ level: 'ask', title: `Next: ${next.name}`, why: `${st[next.id].issues} ${st[next.id].issues === 1 ? 'item needs' : 'items need'} attention here.`, how: 'Work along the thread: argument first, then literature and citations, then consistency and submission.' });
    else notes.push({ level: 'ok', title: 'No open issues in any module', why: '', how: 'Before submitting, go through the submission checklist.' });
    if (state.sample) notes.push({ level: 'tip', title: 'You are viewing the example project', why: 'The example contains deliberate problems so you can see what each module flags.', how: 'When you are done, choose “Clear and start my paper”.' });
    return { main, notes: notesPanel(notes) };
  }

  function outline() {
    const main = `<p class="intro">Fill in all six nodes with a sentence or two. It does not need to be perfect. Once the thread is clear, every section knows its job.</p>
      <div class="thread">${S.outline.FIELDS.map((f) => `<div class="node">
        <label for="f-${f.key}">${f.label}</label>
        <p class="hint">${f.hint}</p>
        <textarea id="f-${f.key}" rows="3" data-bind="outline.${f.key}">${esc(state.outline[f.key])}</textarea>
        <details class="pattern"><summary>See how this looks for another topic</summary><p>${esc(f.example)}</p></details>
      </div>`).join('')}</div>`;
    return { main, notes: notesPanel(S.outline.check(state.outline), citedBlock(Object.values(state.outline).join(' ')) + aiBlock('outline')) };
  }

  function resultCard(r, i) {
    const inMatrix = state.matrix.some((m) => m.sourceId === r.id);
    return `<li class="paper" id="paper-${i + 1}">
      <div class="paper-top"><span class="paper-n">${i + 1}</span>
        <div class="paper-main">
          <a class="paper-title" href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.title)}</a>
          <p class="paper-meta">${esc(S.discover.shortAuthors(r.authors))} · ${r.year || 'n.d.'}${r.venue ? ` · <i>${esc(r.venue)}</i>` : ''}${r.cited ? ` · cited ${r.cited.toLocaleString()}` : ''}${r.type === 'review' ? ' · <span class="pill tone-accent">Review</span>' : ''}${r.type === 'preprint' ? ' · <span class="pill tone-warn">Preprint</span>' : ''}</p>
        </div></div>
      ${r.abstract ? `<details class="paper-abs"><summary>Abstract</summary><p>${esc(r.abstract)}</p></details>` : '<p class="paper-noabs">No abstract in the index. Open the paper to read it.</p>'}
      <div class="paper-links">
        <a href="${esc(r.url)}" target="_blank" rel="noopener">${r.doi ? 'Publisher page (DOI)' : 'Open record'}</a>
        ${r.oaUrl ? `<a href="${esc(r.oaUrl)}" target="_blank" rel="noopener">Free full text</a>` : ''}
        <a href="https://scholar.google.com/scholar?q=${encodeURIComponent(r.title)}" target="_blank" rel="noopener">Google Scholar</a>
        ${inMatrix ? '<span class="pill tone-ok">In matrix</span>' : `<button class="link-btn" data-action="to-matrix" data-i="${i}">Add to literature matrix</button>`}
      </div>
    </li>`;
  }

  function discover() {
    const d = state.discover;
    const opt = (obj, cur) => Object.entries(obj).map(([k, v]) => `<option value="${k}"${String(cur) === k ? ' selected' : ''}>${v}</option>`).join('');
    const main = `<p class="intro">Already have a topic? Search 250 million scholarly works for the latest and most influential research, then add the papers you read to your literature matrix.</p>
      <form class="search-bar" data-form="discover">
        <label for="d-q" class="sr">Topic</label>
        <input id="d-q" data-bind="discover.query" value="${esc(d.query)}" placeholder="e.g. bedtime social media use and sleep in university students">
        <button class="btn primary"${searching ? ' disabled' : ''}>${searching ? 'Searching…' : 'Search'}</button>
      </form>
      <div class="toolbar">
        <label for="d-years">Published</label><select id="d-years" data-bind="discover.years">${opt(S.discover.YEARS, d.years)}</select>
        <label for="d-sort">Sort</label><select id="d-sort" data-bind="discover.sort">${opt(S.discover.SORTS, d.sort)}</select>
        <label class="inline-check"><input type="checkbox" id="d-oa" data-bind="discover.oa"${d.oa ? ' checked' : ''}> Free full text only</label>
      </div>
      ${searchErr ? `<p class="acct-msg error">${esc(searchErr)}</p>` : ''}
      ${d.results.length ? `<p class="fine">${d.total ? `${d.total.toLocaleString()} matches; showing ${d.results.length}.` : ''} Results from <a href="https://openalex.org" target="_blank" rel="noopener">OpenAlex</a>. ${d.sample ? 'These example results are real papers.' : ''}</p>
        <ol class="paper-list">${d.results.map(resultCard).join('')}</ol>`
        : '<p class="empty">Type your topic and choose Search.</p>'}`;
    return { main, notes: notesPanel(discoverNotes(), aiBlock('discover')) };
  }

  function paperRef(v, n) {
    if (v.startsWith('check-')) {
      const p = examplePapers()[n - 1];
      return p ? `<a href="${esc(p.url)}" target="_blank" rel="noopener" title="${esc(p.title)}">[${n}] ${esc(S.discover.shortAuthors(p.authors))}, ${p.year || 'n.d.'}</a>` : `[${n}]`;
    }
    if (v === 'discover') return `<a href="#paper-${n}" data-action="jump" data-target="paper-${n}">[${n}]</a>`;
    const r = state.discover.results[n - 1];
    return r ? `<a href="${esc(r.url)}" target="_blank" rel="noopener" title="${esc(r.title)}">[${n}] ${esc(S.discover.shortAuthors(r.authors))}, ${r.year || 'n.d.'}</a>` : `[${n}]`;
  }

  function design() {
    const d = state.design;
    const main = `<p class="intro">Plan your study before you collect data. Describe it in a few lines per box; Arguo checks what reviewers always ask about, and the AI compares your plan with how similar studies were done.</p>
      <label for="g-type">Study design</label>
      <select id="g-type" data-bind="design.type" data-rerender="notes"><option value="">Choose a design</option>${Object.entries(S.design.TYPES).map(([k, v]) => `<option value="${k}"${d.type === k ? ' selected' : ''}>${v}</option>`).join('')}</select>
      ${S.design.FIELDS.map((f) => `<label for="g-${f.key}">${f.label}</label><p class="hint">${f.hint}</p>
        <textarea id="g-${f.key}" rows="${f.key === 'procedure' ? 6 : 3}" data-bind="design.${f.key}" placeholder="${f.key === 'question' ? esc(state.outline.question) : ''}">${esc(d[f.key])}</textarea>`).join('')}`;
    const methodsBlock = state.discover.results.length ? aiBlock('methods')
      : '<section class="ai-box"><h4>Methods in similar studies</h4><p class="ai-rule">Search for similar studies in <a href="#discover">Discover research</a> first. The AI then compares their methods with your plan, citing each paper.</p></section>';
    return { main, notes: notesPanel(S.design.check(Object.assign({}, d, { question: d.question || state.outline.question })), aiBlock('design') + methodsBlock) };
  }

  function ideas() {
    const steps = S.ideas.nextSteps(state);
    const next = steps.find((x) => !x.done);
    const main = `<p class="intro">Your plan, worked out from where your project is now. Tick off steps by doing them in each module.</p>
      ${next ? `<a class="next-card" href="#${next.href}"><span class="eyebrow">Do this next</span><b>${esc(next.title)}</b><span>${esc(next.why)}</span></a>` : '<p class="acct-msg">Every step is done. Time to submit.</p>'}
      <ol class="steps">${steps.map((x) => `<li class="${x.done ? 'done' : ''}"><span class="step-mark" aria-label="${x.done ? 'Done' : 'To do'}">${x.done ? '✓' : ''}</span>
        <div><a href="#${x.href}">${esc(x.title)}</a><small>${esc(x.why)}</small></div></li>`).join('')}</ol>
      <h2 class="sub">Where could your research go?</h2>
      <p class="intro">Ask for possible new directions built from the papers you found in Discover research and the limitations in your literature matrix. They are prompts to think with: choosing and framing your question is your job.</p>
      ${state.discover.results.length ? '' : '<p class="empty">Run a search in <a href="#discover">Discover research</a> first, so the ideas rest on real papers.</p>'}`;
    const notes = [{ level: 'tip', title: 'How to judge a new direction', why: 'An idea is only worth pursuing if it is new, answerable and feasible for you.', how: 'For each idea, check: has someone already done it (search it), can you get the data, and can you finish it in the time you have?' }];
    const block = state.discover.results.length ? aiBlock('ideas') : '';
    return { main, notes: notesPanel(notes, block) };
  }

  function discoverNotes() {
    const d = state.discover;
    if (!d.results.length) return [{ level: 'tip', title: 'Start with a specific topic', why: 'Broad terms return thousands of loosely related papers.', how: 'Combine your key concepts, population and setting, for example "bedtime social media use sleep quality university students".' }];
    const notes = [];
    const years = d.results.map((r) => r.year).filter(Boolean);
    const reviews = d.results.filter((r) => r.type === 'review').length;
    if (reviews) notes.push({ level: 'tip', title: `${reviews} ${reviews === 1 ? 'review' : 'reviews'} in these results`, why: 'Recent reviews and meta-analyses map a field quickly and point to its key studies.', how: 'Read the newest review first, then follow its references.' });
    else notes.push({ level: 'ask', title: 'No review articles here', why: 'A review is the fastest way into a field.', how: 'Add "review" or "meta-analysis" to your search.', ask: 'If nobody has reviewed this topic recently, could that be a gap?' });
    if (years.length && d.sort !== 'newest' && Math.max(...years) < new Date().getFullYear() - 1) notes.push({ level: 'tip', title: 'Nothing from the last year', why: 'Results are sorted by relevance or citations, which favours older work.', how: 'Switch to "Newest first" to see what has just been published.' });
    const pre = d.results.filter((r) => r.type === 'preprint').length;
    if (pre) notes.push({ level: 'tip', title: `${pre} ${pre === 1 ? 'preprint' : 'preprints'}`, why: 'Preprints have not been peer reviewed yet.', how: 'Cite them with care and check whether a published version exists.' });
    notes.push({ level: 'tip', title: 'Read before you cite', why: 'A search result is a lead, not evidence.', how: 'Open each paper, read it, then add it to the literature matrix in your own words.' });
    return notes;
  }

  function matrix() {
    const cols = S.matrix.COLUMNS;
    const main = `<p class="intro">One row per paper. Paste a link and Arguo fills in the details and a first reading of the abstract; then read the paper and make the notes your own. Click a title for a full analysis.</p>
      <form class="search-bar" data-form="add-link">
        <label for="m-link" class="sr">Paper link, DOI or title</label>
        <input id="m-link" placeholder="Paste a DOI, a link to the article (journal, arXiv, PubMed…) or its title">
        <button class="btn primary"${linkBusy ? ' disabled' : ''}>${linkBusy ? esc(linkBusy) : 'Add paper'}</button>
      </form>
      ${linkErr ? `<p class="acct-msg error">${esc(linkErr)}</p>` : ''}
      <div class="table-wrap"><table class="matrix">
        <thead><tr>${cols.map((c) => `<th scope="col">${c.label}</th>`).join('')}<th><span class="sr">Actions</span></th></tr></thead>
        <tbody>${state.matrix.map((r, i) => `<tr>${cols.map((c) => c.key === 'relation'
          ? `<td><label class="sr" for="m-${r.id}-relation">Relation to my study</label><select id="m-${r.id}-relation" data-bind="matrix.${i}.relation">
              <option value="">Choose</option>${S.matrix.RELATIONS.map((x) => `<option${r.relation === x ? ' selected' : ''}>${x}</option>`).join('')}</select></td>`
          : `<td>${c.key === 'source' && r.meta ? `<button class="paper-open" data-action="open-paper" data-id="${r.id}">${esc(r.meta.title)}</button>` : ''}
              ${c.key !== 'source' && (r.aiDraft || []).includes(c.key) ? '<span class="ai-chip" title="Drafted by AI from the abstract. Check it against the paper.">AI draft</span>' : ''}
              <label class="sr" for="m-${r.id}-${c.key}">${c.label}</label><textarea id="m-${r.id}-${c.key}" rows="3" placeholder="${c.placeholder}" data-bind="matrix.${i}.${c.key}">${esc(r[c.key])}</textarea></td>`).join('')}
          <td><button class="icon-btn" data-action="del-row" data-index="${i}" aria-label="Delete row ${i + 1}">Delete</button></td></tr>`).join('')}</tbody>
      </table></div>
      <button class="btn" data-action="add-row">Add an empty row</button>
      ${state.sample ? '<p class="fine">The papers in the example are real; the summaries are for demonstration only. Check the originals before citing them.</p>' : ''}`;
    return { main, notes: notesPanel(S.matrix.analyze(state.matrix), aiBlock('matrix')) };
  }

  function paperView() {
    const i = state.matrix.findIndex((r) => r.id === openPaper);
    const r = state.matrix[i];
    if (!r) return { main: '<p class="empty">This paper is no longer in your matrix. <a href="#matrix">Back to the literature matrix</a></p>', notes: '' };
    const m = r.meta || {};
    const a = paperAi[r.id] || {};
    const analysis = r.analysis || [];
    const main = `<p><a href="#matrix">← Literature matrix</a></p>
      <h2 class="paper-h">${esc(m.title || r.source)}</h2>
      <p class="paper-meta">${esc((m.authors || []).join(', ') || r.source)}${m.year ? ` · ${m.year}` : ''}${m.venue ? ` · <i>${esc(m.venue)}</i>` : ''}${m.cited ? ` · cited ${m.cited.toLocaleString()}` : ''}${m.type ? ` · ${esc(m.type)}` : ''}</p>
      <div class="paper-links">
        ${m.url ? `<a href="${esc(m.url)}" target="_blank" rel="noopener">${m.doi ? 'Publisher page (DOI)' : 'Open record'}</a>` : ''}
        ${m.oaUrl ? `<a href="${esc(m.oaUrl)}" target="_blank" rel="noopener">Free full text</a>` : ''}
        ${m.title ? `<a href="https://scholar.google.com/scholar?q=${encodeURIComponent(m.title)}" target="_blank" rel="noopener">Google Scholar</a>` : ''}
        ${m.doi ? `<a href="https://www.connectedpapers.com/api/redirect/doi/${encodeURIComponent(m.doi)}" target="_blank" rel="noopener">Related papers (Connected Papers)</a>` : ''}
      </div>
      <h3 class="sub">Abstract</h3>
      <p class="paper-abs-full">${m.abstract ? esc(m.abstract) : 'No abstract in the index. Open the paper to read it.'}</p>
      <h3 class="sub">Your reading notes</h3>
      ${S.matrix.COLUMNS.filter((c) => c.key !== 'source').map((c) => c.key === 'relation'
        ? `<label for="p-relation">${c.label}</label><select id="p-relation" data-bind="matrix.${i}.relation"><option value="">Choose</option>${S.matrix.RELATIONS.map((x) => `<option${r.relation === x ? ' selected' : ''}>${x}</option>`).join('')}</select>`
        : `<label for="p-${c.key}">${c.label}${(r.aiDraft || []).includes(c.key) ? ' <span class="ai-chip">AI draft</span>' : ''}</label><textarea id="p-${c.key}" rows="2" data-bind="matrix.${i}.${c.key}">${esc(r[c.key])}</textarea>`).join('')}
      <p class="fine">AI drafts come from the abstract only. Replace them with your own notes once you have read the paper.</p>`;
    const body = a.loading ? '<p class="ai-status">Reading the paper’s record…</p>'
      : a.error ? `<p class="ai-status error">${esc(a.error)}</p>`
        : analysis.length ? analysis.map((n) => noteHtml(n).replace('<b>How to fix</b>', '<b>Why it matters</b>')).join('') : '';
    const block = `<section class="ai-box">
        <div class="ai-head"><h4>AI analysis</h4><button class="btn small-btn" data-action="analyse-paper" data-id="${r.id}"${a.loading ? ' disabled' : ''}>${analysis.length ? 'Analyse again' : 'Analyse this paper'}</button></div>
        <p class="ai-rule">Based on the title and abstract, not the full text. Key points, methods, limitations, how it relates to your question, and what to look for when you read it.</p>
        ${body}</section>`;
    return { main, notes: notesPanel([{ level: 'tip', title: 'Read the full paper before you cite it', why: 'An abstract leaves out the details reviewers care about: sample, measures and limitations.', how: 'Open the free full text or the publisher page, then update your reading notes.' }], block) };
  }

  async function analysePaper(id, fill) {
    const r = state.matrix.find((x) => x.id === id);
    if (!r || !r.meta) return;
    paperAi[id] = { loading: true };
    refreshNotes();
    try {
      const m = r.meta;
      const res = await fetch(AI_API + '/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: 'paper', input: { question: state.outline.question, title: m.title, authors: (m.authors || []).join(', '), year: m.year, venue: m.venue, type: m.type, abstract: m.abstract } }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status}).`);
      r.analysis = data.notes || [];
      if (fill && data.fields) {
        r.aiDraft = r.aiDraft || [];
        ['sample', 'method', 'finding', 'limitation'].forEach((k) => {
          if (!String(r[k] || '').trim() && data.fields[k]) { r[k] = data.fields[k]; r.aiDraft.push(k); }
        });
      }
      paperAi[id] = {};
    } catch (e) { paperAi[id] = { error: e.message === 'Failed to fetch' ? 'Could not reach the AI server. Previews block outside requests; it works on the deployed site.' : e.message }; }
    save();
    if (current() === 'paper' || current() === 'matrix') render();
  }

  // One place where a found paper enters the project: a matrix row plus an
  // entry in the reference list, so the citation check sees it too.
  function addToMatrix(meta) {
    const existing = state.matrix.find((x) => x.meta && (x.meta.id === meta.id || (meta.doi && x.meta.doi === meta.doi)));
    if (existing) return existing;
    const row = Object.assign(S.matrix.blankRow(), S.discover.toMatrixRow(meta), { sourceId: meta.id, meta });
    const empty = state.matrix.findIndex((x) => !x.source.trim() && !x.finding.trim());
    if (empty >= 0) state.matrix[empty] = row; else state.matrix.push(row);
    syncRefs();
    return row;
  }

  function syncRefs() {
    let added = 0;
    state.matrix.forEach((r) => {
      if (!r.meta) return;
      const have = state.refs.input.toLowerCase();
      const known = (r.meta.doi && have.includes(r.meta.doi.toLowerCase())) || (r.meta.title && have.includes(r.meta.title.toLowerCase().slice(0, 60)));
      if (!known) {
        state.refs.input = (state.refs.input.trim() + '\n' + S.discover.toReference(r.meta)).trim();
        added++;
      }
    });
    return added;
  }

  // Citations written in the argument thread or discussion that are not yet in the matrix.
  const citeFind = {};
  function citedBlock(text) {
    const cited = S.discover.citationsIn(text);
    if (!cited.length) return '';
    const missing = cited.filter((c) => !S.discover.inMatrix(c, state.matrix));
    if (!missing.length) return `<section class="ai-box"><h4>Papers you cite</h4><p class="ai-rule">All ${cited.length} papers you cite here are in your literature matrix.</p></section>`;
    return `<section class="ai-box"><h4>Papers you cite</h4>
      <p class="ai-rule">You cite ${missing.length === 1 ? 'a paper that is' : `${missing.length} papers that are`} not in your literature matrix yet. Add ${missing.length === 1 ? 'it' : 'them'}, so you keep notes on ${missing.length === 1 ? 'it' : 'them'} and the citation check includes ${missing.length === 1 ? 'it' : 'them'}.</p>
      ${missing.map((c) => {
        const f = citeFind[c.key] || {};
        const cands = f.results ? (f.results.length ? f.results.map((r, i) => `<div class="cand"><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.title)}</a>
              <small>${esc(S.discover.shortAuthors(r.authors))} · ${r.year} · ${esc(r.venue)}</small>
              <button class="btn small-btn" data-action="add-cited" data-key="${c.key}" data-i="${i}">This one: add to matrix</button></div>`).join('')
            : '<p class="ai-status">No match found. Add it from a link in the literature matrix.</p>') : '';
        return `<div class="cited"><p><b>${esc(c.text)}</b>${f.loading ? ' · searching…' : f.error ? ` · ${esc(f.error)}` : ''}</p>
          ${f.results ? cands : `<button class="btn small-btn" data-action="find-cited" data-key="${c.key}" data-text="${esc(c.text)}">Find this paper</button>`}</div>`;
      }).join('')}</section>`;
  }

  async function findCited(key, text) {
    const c = S.discover.citationsIn(text)[0];
    if (!c) return;
    citeFind[key] = { loading: true }; refreshNotes();
    try { citeFind[key] = { results: await S.discover.findCited(c, state.discover.query || state.title, { proxy: AI_API }) }; }
    catch (e) { citeFind[key] = { error: e.message }; }
    refreshNotes();
  }

  async function addFromLink(form) {
    const input = form.querySelector('#m-link');
    const link = input.value;
    linkErr = ''; linkBusy = 'Finding the paper…'; render();
    try {
      const meta = await S.discover.lookup(link, { proxy: AI_API });
      if (state.matrix.some((x) => x.meta && x.meta.id === meta.id)) throw new Error('That paper is already in your matrix.');
      const row = addToMatrix(meta);
      linkBusy = 'Summarising…'; save(); render();
      await analysePaper(row.id, true);
      toast('Paper added. Check the AI draft against the paper.');
    } catch (e) { linkErr = e.message; }
    linkBusy = ''; render();
  }

  const STATUS = {
    verified: ['Verified', 'ok'], mismatch: ['Mismatch', 'warn'], notfound: ['Not found', 'pen'], error: ['Connection failed', 'warn'], pending: ['Checking', 'accent'],
  };

  const journalUi = { q: '', results: [], loading: false, err: '' };
  let formatting = false;

  function refText(r) {
    const j = state.refs.journal;
    if (j && r.formatted && r.formattedStyle === j.style) return r.formatted;
    return S.cite.format(r.record, j ? S.styles.fallback(j.format) : state.refs.style);
  }

  function citeList() {
    const res = state.refs.results || [];
    if (!res.length) return '<p class="empty">Papers in your literature matrix appear here automatically. Paste any others, one per line, then choose “Check references”.</p>';
    const j = state.refs.journal;
    return `<ol class="ref-list">${res.map((r) => {
      const [label, tone] = STATUS[r.status] || STATUS.pending;
      const fromMatrix = r.doi && state.matrix.some((m) => m.meta && m.meta.doi && m.meta.doi.toLowerCase() === r.doi.toLowerCase());
      return `<li class="ref">
        <div class="ref-head"><span class="pill tone-${tone}">${label}</span>${fromMatrix ? '<span class="pill tone-accent">In matrix</span>' : ''}${r.doi ? `<code>${esc(r.doi)}</code>` : ''}</div>
        <p class="ref-raw">${esc(r.raw)}</p>
        ${(r.issues || []).length ? `<ul class="ref-issues">${r.issues.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
        ${r.note ? `<p class="ref-note">${esc(r.note)}</p>` : ''}
        ${r.record ? `<p class="ref-fixed"><span>${j ? (r.formattedStyle === j.style ? `Formatted for ${esc(j.title)}` : r.doi ? 'Formatting…' : `No DOI: closest built-in style`) : 'Verified entry'}</span>${esc(refText(r))}</p>` : ''}
      </li>`;
    }).join('')}</ol>`;
  }

  function bibliography() {
    const j = state.refs.journal;
    const items = (state.refs.results || []).filter((r) => r.record).map(refText);
    if (j && j.format === 'numeric') return items.map((t, i) => `${i + 1}. ${t}`).join('\n');
    return items.sort((a, b) => a.localeCompare(b)).join('\n');
  }

  function citeNotes() {
    const res = state.refs.results || [];
    const n = (s) => res.filter((r) => r.status === s).length;
    const plural = (k, one, many) => (k === 1 ? one : many);
    const notes = [];
    if (n('notfound')) notes.push({ level: 'issue', title: `${n('notfound')} ${plural(n('notfound'), 'reference', 'references')} not found`, why: 'The authors or title may be wrong, or the paper may not exist at all (for example, a reference invented by an AI tool).', how: 'Find the original and check it. If you cannot find the original, do not cite it.' });
    if (n('mismatch')) notes.push({ level: 'issue', title: `${n('mismatch')} ${plural(n('mismatch'), 'reference differs', 'references differ')} from the record`, why: 'A wrong year, author or title is easy for reviewers and editors to spot.', how: 'Use the verified entry, and fix the matching in-text citation too (for example the year).' });
    if (n('error')) notes.push({ level: 'tip', title: `${n('error')} could not be checked`, why: 'The connection failed.', how: 'Choose “Check references” again later.' });
    const unchecked = S.cite.parse(state.refs.input).filter((e) => !res.some((r) => r.raw === e.raw)).length;
    if (unchecked) notes.push({ level: 'tip', title: `${unchecked} ${plural(unchecked, 'reference has', 'references have')} not been checked yet`, why: 'New papers from your literature matrix are added to the list automatically.', how: 'Choose “Check references” to verify and format them.' });
    if (!notes.length && res.length) notes.push({ level: 'ok', title: 'All references verified', why: '', how: 'Make sure every in-text citation matches an entry in the list.' });
    if (!state.refs.journal) notes.push({ level: 'ask', title: 'Choose your target journal', why: 'Each journal has its own reference style.', how: 'Search for the journal above; references with a DOI are then formatted in its official style.' });
    return notes;
  }

  function journalPicker() {
    const j = state.refs.journal;
    return j
      ? `<div class="journal-chip"><span>Target journal: <b>${esc(j.title)}</b> · ${esc(j.style)} style${j.info && j.info.publisher ? ` · ${esc(j.info.publisher)}` : ''}</span><button class="link-btn" data-action="journal-clear">Change journal</button></div>`
      : `<form class="search-bar" data-form="journal"><label for="j-q" class="sr">Target journal</label>
          <input id="j-q" value="${esc(journalUi.q)}" placeholder="Target journal, e.g. Sleep Medicine Reviews, Nature, PLOS ONE">
          <button class="btn"${journalUi.loading ? ' disabled' : ''}>${journalUi.loading ? 'Loading journals…' : 'Find journal'}</button></form>
        ${journalUi.err ? `<p class="acct-msg error">${esc(journalUi.err)}</p>` : ''}
        ${journalUi.results.length ? `<ul class="journal-list">${journalUi.results.map((x, i) => `<li><button class="link-btn" data-action="journal-pick" data-i="${i}">${esc(x.title)}</button><small>${esc(x.format)}</small></li>`).join('')}</ul>` : ''}`;
  }

  function cite() {
    const added = syncRefs();
    if (added) setTimeout(() => toast(`${added} ${added === 1 ? 'paper' : 'papers'} from your literature matrix added`), 0);
    const j = state.refs.journal;
    const picker = journalPicker();
    const main = `<p class="intro">Every paper in your literature matrix is listed here. Paste any other references, one per line. Arguo checks each against Crossref, then formats it for your target journal.</p>
      <h3 class="sub">Target journal</h3>
      ${picker}
      <label for="f-refs">References</label>
      <textarea id="f-refs" class="mono" rows="7" data-bind="refs.input">${esc(state.refs.input)}</textarea>
      <div class="toolbar">
        <button class="btn primary" data-action="verify"${verifying ? ' disabled' : ''}>${verifying ? 'Checking…' : 'Check references'}</button>
        ${j ? '' : `<label for="f-style">Style</label>
        <select id="f-style" data-bind="refs.style" data-rerender="cite-list">${Object.entries(S.cite.STYLES).map(([k, v]) => `<option value="${k}"${state.refs.style === k ? ' selected' : ''}>${v.label}</option>`).join('')}</select>`}
        <button class="btn" data-action="copy-bib">Copy reference list</button>
      </div>
      <div id="cite-list">${citeList()}</div>`;
    return { main, notes: notesPanel(citeNotes()) };
  }

  async function findJournal(form) {
    journalUi.q = form.querySelector('#j-q').value;
    journalUi.loading = true; journalUi.err = ''; render();
    try {
      const list = await S.styles.load();
      journalUi.results = S.styles.search(list, journalUi.q, 8);
      if (!journalUi.results.length) journalUi.err = 'No journal style found with that name. Try the full journal title, or pick a built-in style.';
    } catch (e) { journalUi.err = 'Could not load the journal list. Previews block outside requests; this works on the deployed site.'; }
    journalUi.loading = false; render();
  }

  async function pickJournal(x) {
    journalUi.loading = true; render();
    try {
      const style = await S.styles.parentOf(x);
      state.refs.journal = { title: x.title, name: x.name, style, format: x.format };
      S.styles.journalInfo(x.title, { proxy: AI_API }).then((info) => { if (state.refs.journal && state.refs.journal.name === x.name) { state.refs.journal.info = info; save(); render(); } }, () => {});
      journalUi.results = []; journalUi.err = '';
      save();
      formatAll();
    } catch (e) { journalUi.err = e.message; }
    journalUi.loading = false; render();
  }

  async function formatAll() {
    const j = state.refs.journal;
    if (!j || formatting) return;
    formatting = true;
    for (const r of state.refs.results || []) {
      if (!r.record || !r.doi || r.formattedStyle === j.style) continue;
      try { r.formatted = await S.styles.formatDoi(r.doi, j.style); r.formattedStyle = j.style; } catch (e) { r.formattedStyle = ''; }
      const list = document.getElementById('cite-list');
      if (list && current() === 'cite') list.innerHTML = citeList();
    }
    formatting = false; save();
  }

  function checkResult() {
    return S.consistency.check({ question: state.outline.question, method: state.outline.method, ...state.check });
  }

  function flaggedList(flagged) {
    if (!flagged.length) return '';
    return `<div class="flagged"><h3>Sentences to review in the discussion</h3><ol>${flagged.map((f) => `<li><q>${esc(f.sentence)}</q><span>${f.reasons.map(esc).join('; ')}</span></li>`).join('')}</ol></div>`;
  }

  let checkTab = 'question';

  function tabIssues(t) {
    if (t.key === 'conclusion') return state.check.discussion.trim() ? checkResult().notes.filter((n) => n.level === 'issue').length : 0;
    return (state.check[t.field] || '').trim() ? S.consistency.sectionCheck(t.key, state.check[t.field], state.outline).filter((n) => n.level === 'issue').length : 0;
  }

  function check() {
    const tabs = S.consistency.TABS;
    const t = tabs.find((x) => x.key === checkTab) || tabs[0];
    const text = state.check[t.field] || '';
    const conclusion = t.key === 'conclusion';
    const r = conclusion ? checkResult() : null;
    const notes = conclusion ? r.notes : S.consistency.sectionCheck(t.key, text, state.outline);
    const main = `<p class="intro">Check each section of your manuscript against the matching node of your argument thread. Paste a section, read the notes, and use the guide and published examples to revise it yourself.</p>
      <div class="tabs" role="tablist">${tabs.map((x, i) => {
        const n = tabIssues(x);
        const filled = (state.check[x.field] || '').trim();
        return `<button role="tab" class="tab${x.key === t.key ? ' on' : ''}" aria-selected="${x.key === t.key}" data-action="check-tab" data-tab="${x.key}">
          <span class="tab-n">${i + 1}</span>${x.label}${n ? `<b>${n}</b>` : filled ? '<i class="tab-ok" aria-label="checked">✓</i>' : ''}</button>`;
      }).join('')}</div>
      <div class="readonly"><span>${t.label} in your argument thread</span><p>${esc(state.outline[t.node]) || 'Not filled in yet.'}</p><a href="#outline">Edit</a></div>
      <label for="f-sec">Your ${esc(t.section)}</label>
      <textarea id="f-sec" rows="${conclusion ? 9 : 7}" data-bind="check.${t.field}" placeholder="Paste this section of your manuscript">${esc(text)}</textarea>
      ${conclusion ? `<details class="pattern"${state.check.results.trim() ? '' : ' open'}><summary>Results used for this check (from the Result tab)</summary><p>${esc(state.check.results) || 'Paste your results in the Result tab first.'}</p></details>` : ''}
      <div id="flagged">${conclusion ? flaggedList(r.flagged) : ''}</div>
      <div class="guide-grid">
        <section class="guide"><h4>What reviewers look for</h4><ul>${t.look.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>
        <section class="guide"><h4>A common structure</h4><p class="pattern-line">${esc(t.pattern)}</p><p class="guide-example"><b>Example from another topic</b> ${esc(t.example)}</p></section>
      </div>
      <div class="tab-nav">${tabs.indexOf(t) > 0 ? `<button class="btn" data-action="check-tab" data-tab="${tabs[tabs.indexOf(t) - 1].key}">← ${tabs[tabs.indexOf(t) - 1].label}</button>` : '<span></span>'}
        ${tabs.indexOf(t) < tabs.length - 1 ? `<button class="btn" data-action="check-tab" data-tab="${tabs[tabs.indexOf(t) + 1].key}">${tabs[tabs.indexOf(t) + 1].label} →</button>` : ''}</div>`;
    const papersNote = examplePapers().length ? '' : '<p class="ai-rule">Tip: search in <a href="#discover">Discover research</a> or add papers with abstracts to your matrix, and the AI will show how those published papers handle this section.</p>';
    return { main, notes: notesPanel(notes, citedBlock(text) + aiBlock('check-' + t.key).replace('</section>', papersNote + '</section>')) };
  }

  const LETTER = `<details class="guide" open><summary>How a response letter is structured</summary>
      <ol><li>Thank the editor and reviewers in a sentence or two.</li>
      <li>For each comment: <b>the comment</b> → <b>your response</b> → <b>where it changed</b> (page and line).</li>
      <li>If you agree, say what you changed. If you disagree, give your reasons and evidence politely.</li>
      <li>If a comment is vague, state how you understood it, then what you did on that reading.</li></ol>
      <p class="guide-example"><b>Example from another topic</b> (urban parks study). Comment: “The sample covers only three cities.” Response: “Thank you. We now describe the climate range of the sample cities in Section 4.3 and state that the conclusions apply to subtropical cities (p. 15, lines 8–14).”</p></details>`;

  function reviewTasks() {
    const tasks = state.review.tasks;
    if (!tasks.length) return '<p class="empty">Paste the comments and choose “Break into tasks”.</p>';
    let last = null;
    return tasks.map((t, i) => {
      const head = t.reviewer !== last ? `<h3 class="reviewer">${esc(t.reviewer)}</h3>` : '';
      last = t.reviewer;
      return `${head}<div class="task${t.done ? ' done' : ''}">
        <div class="task-top">
          <input type="checkbox" id="t-${t.id}-done" data-bind="review.tasks.${i}.done" data-rerender="all"${t.done ? ' checked' : ''}>
          <label for="t-${t.id}-done" class="task-text">${esc(t.text)}</label>
        </div>
        <div class="task-meta">
          <span class="pill tone-accent">${esc(t.category)}</span>
          <label class="sr" for="t-${t.id}-pri">Priority</label>
          <select id="t-${t.id}-pri" data-bind="review.tasks.${i}.priority" data-rerender="notes">${S.review.PRIORITIES.map((p) => `<option${t.priority === p ? ' selected' : ''}>${p}</option>`).join('')}</select>
          ${t.vague ? '<span class="pill tone-warn">Vague comment</span>' : ''}
        </div>
        ${t.vague ? '<p class="task-vague">This comment does not say what to change. Ask if you can; if not, write down two or three ways to read it, pick one, and say so in your response.</p>' : ''}
        <label for="t-${t.id}-plan" class="small">Your revision plan</label>
        <textarea id="t-${t.id}-plan" rows="2" data-bind="review.tasks.${i}.plan" placeholder="What will you change? Which analysis or literature do you need?">${esc(t.plan)}</textarea>
        <label for="t-${t.id}-where" class="small">Where it changed</label>
        <input id="t-${t.id}-where" data-bind="review.tasks.${i}.where" value="${esc(t.where)}" placeholder="e.g. p. 8, lines 12–20">
      </div>`;
    }).join('');
  }

  function reviewNotes() {
    const s = S.review.summary(state.review.tasks);
    const notes = [];
    if (!s.total) return [{ level: 'tip', title: 'No tasks yet', why: '', how: 'Paste the comments and choose “Break into tasks”.' }];
    notes.push({ level: s.majorOpen ? 'issue' : 'ok', title: s.majorOpen ? `${s.majorOpen} must-fix ${s.majorOpen === 1 ? 'comment' : 'comments'} still open` : 'All must-fix comments addressed',
      why: `${s.done} of ${s.total} comments addressed.`, how: 'Start with must-fix items, especially on methods and argument; they can affect several sections.' });
    if (s.vague) notes.push({ level: 'tip', title: `${s.vague} vague ${s.vague === 1 ? 'comment' : 'comments'}`, why: 'Comments like “needs strengthening” do not say what to change.', how: 'Write down how you read it, decide what to do, and state your reading in the response.' });
    if (s.noPlan) notes.push({ level: 'tip', title: `${s.noPlan} without a revision plan`, why: '', how: 'One sentence each: what changes, where, and what you need to add.' });
    return notes;
  }

  function review() {
    const main = `<p class="intro">Paste comments from your supervisor or reviewers. Headings like “Reviewer 1” or “Major comments” and numbered points work best.</p>
      <label for="f-review" class="sr">Reviewer comments</label>
      <textarea id="f-review" rows="6" data-bind="review.input">${esc(state.review.input)}</textarea>
      <div class="toolbar"><button class="btn primary" data-action="split-review">${state.review.tasks.length ? 'Break into tasks again (replaces current tasks)' : 'Break into tasks'}</button></div>
      <div id="tasks">${reviewTasks()}</div>`;
    return { main, notes: notesPanel(reviewNotes(), aiBlock('review') + LETTER) };
  }

  function submit() {
    const groups = S.checklist.build(state);
    const items = groups.flatMap((g) => g.items);
    const d = state.design.type ? S.design.TYPES[state.design.type] : '';
    const main = `<p class="intro">The checklist adapts to your target journal and study design. Items Arguo can verify from your project are checked automatically; tick the rest yourself. The journal’s Guide for Authors has the final say.</p>
      <h3 class="sub">Target journal</h3>
      ${journalPicker()}
      <p class="fine">${d ? `Study design: ${esc(d)} (<a href="#design">change</a>).` : 'Choose your study design in <a href="#design">Study design</a> to get design-specific items.'}</p>
      ${groups.map((g) => `<fieldset class="checks"><legend>${g.name}</legend>${g.items.map((i) => {
        const done = S.checklist.isDone(i, state);
        const control = i.auto === true ? '<span class="auto-mark" title="Checked by Arguo">✓</span>'
          : `<input type="checkbox" id="c-${i.id}" data-bind="submit.checked.${i.id}" data-rerender="all"${state.submit.checked[i.id] ? ' checked' : ''}>`;
        return `<div class="check-item${done ? ' is-done' : ''}">${control}
          <label${i.auto === true ? '' : ` for="c-${i.id}"`}>${esc(i.label)}
            ${i.auto === true ? '<em class="auto-chip">Checked by Arguo</em>' : i.auto === false ? `<a class="auto-chip warn" href="#${i.fix}">${esc(i.autoNote)}: fix it →</a>` : ''}
            ${i.how ? `<small>${esc(i.how)}</small>` : ''}
            ${i.links.length ? `<small>${i.links.map((l) => `<a href="${esc(l.href)}" target="_blank" rel="noopener">${esc(l.text)}</a>`).join(' · ')}</small>` : ''}</label></div>`;
      }).join('')}</fieldset>`).join('')}`;
    const left = items.filter((i) => !S.checklist.isDone(i, state));
    const notes = [];
    if (!state.refs.journal) notes.push({ level: 'ask', title: 'Choose your target journal', why: 'Requirements differ between journals: scope, length, reference style, fees.', how: 'Search for it above. The checklist and your reference list then follow that journal.' });
    const info = state.refs.journal && state.refs.journal.info;
    if (info && info.isOa && !info.doaj) notes.push({ level: 'issue', title: 'Open-access journal not listed in DOAJ', why: 'Most legitimate open-access journals are in the Directory of Open Access Journals.', how: 'Check the publisher, editorial board and indexing before you submit. Ask your library if unsure.' });
    notes.push(left.length
      ? { level: 'tip', title: `${left.length} ${left.length === 1 ? 'item' : 'items'} left`, why: left.slice(0, 6).map((i) => i.label).join('; ') + (left.length > 6 ? '…' : ''), how: 'Editors often return a manuscript straight away when statements or ethics details are missing.' }
      : { level: 'ok', title: 'Checklist complete', why: '', how: 'Read your cover letter once more before you submit.' });
    return { main, notes: notesPanel(notes) };
  }

  const VIEWS = { overview, discover, ideas, design, paper: paperView, outline, matrix, cite, check, review, submit };

  // ---------- render ----------
  function account() {
    const head = '<section class="account wrap"><h1>Your account</h1>';
    if (!C.enabled()) return head + '<p class="intro">Accounts are not set up on this site yet. Your projects are saved in this browser.</p></section>';
    const msg = (acct.msg ? `<p class="acct-msg">${esc(acct.msg)}</p>` : '') + (acct.err ? `<p class="acct-msg error">${esc(acct.err)}</p>` : '');
    const busy = acct.busy ? ' disabled' : '';
    if (acct.recovery) {
      return head + `${msg}<form class="acct-form" data-form="set-password">
        <label for="a-new">New password</label><input id="a-new" type="password" autocomplete="new-password" minlength="8" required>
        <button class="btn primary"${busy}>Set new password</button></form></section>`;
    }
    const u = C.user();
    if (!u) {
      const m = acct.mode;
      const title = { signin: 'Sign in', signup: 'Create an account', reset: 'Reset your password' }[m];
      return head + `<p class="intro">Sign in to keep your projects in your account and open them on any device.</p>${msg}
        <form class="acct-form" data-form="${m}">
          <h2>${title}</h2>
          <label for="a-email">Email</label><input id="a-email" type="email" autocomplete="email" required>
          ${m !== 'reset' ? `<label for="a-pass">Password</label><input id="a-pass" type="password" autocomplete="${m === 'signup' ? 'new-password' : 'current-password'}" minlength="8" required>` : ''}
          ${m === 'signup' ? '<p class="fine">By creating an account you agree to the <a href="#terms">Terms of Service</a> and the <a href="#privacy">Privacy Policy</a>.</p>' : ''}
          <button class="btn primary"${busy}>${{ signin: 'Sign in', signup: 'Create account', reset: 'Send reset link' }[m]}</button>
        </form>
        <p class="acct-switch">${m === 'signin' ? '<button class="link-btn" data-action="acct-mode" data-mode="signup">Create an account</button> · <button class="link-btn" data-action="acct-mode" data-mode="reset">Forgot password?</button>'
          : '<button class="link-btn" data-action="acct-mode" data-mode="signin">Back to sign in</button>'}</p></section>`;
    }
    if (acct.projects === null) loadProjects();
    const rows = (Array.isArray(acct.projects) ? acct.projects : []).map((p) => `<li><div><b>${esc(p.title)}</b><small>Updated ${new Date(p.updated_at).toLocaleString()}</small></div>
        <span>${state.cloudId === p.id ? '<span class="pill tone-ok">Open now</span>'
          : acct.confirmOpen === p.id ? '<button class="btn danger small-btn" data-action="cloud-open" data-id="' + p.id + '" data-force="1">Replace this browser’s project</button>'
            : '<button class="btn small-btn" data-action="cloud-open" data-id="' + p.id + '">Open</button>'}
        <button class="icon-btn" data-action="cloud-delete" data-id="${p.id}">Delete</button></span></li>`).join('');
    return head + `<p class="intro">Signed in as <b>${esc(u.email)}</b>. <button class="link-btn" data-action="sign-out">Sign out</button></p>${msg}
      <h2>Your projects</h2>
      ${!Array.isArray(acct.projects) ? '<p class="empty">Loading…</p>' : rows ? `<ul class="proj-list">${rows}</ul>` : '<p class="empty">No projects in your account yet.</p>'}
      ${state.cloudId ? '' : `<button class="btn primary" data-action="cloud-save">Save “${esc(state.title)}” to my account</button>`}
      <p class="fine">Projects are stored with Supabase and only you can read them.</p></section>`;
  }

  async function loadProjects() {
    acct.projects = 'loading';
    try { acct.projects = await C.list(); } catch (e) { acct.projects = []; acct.err = e.message; }
    if (current() === 'account') render();
  }

  async function accountSubmit(form) {
    const kind = form.dataset.form;
    const email = (form.querySelector('#a-email') || {}).value;
    const pass = (form.querySelector('#a-pass') || form.querySelector('#a-new') || {}).value;
    acct.busy = true; acct.err = ''; acct.msg = ''; render();
    try {
      if (kind === 'signin') await C.signIn(email, pass);
      if (kind === 'signup') { const r = await C.signUp(email, pass); if (r.needsConfirm) acct.msg = 'Check your email and click the link to confirm your account, then sign in.'; }
      if (kind === 'reset') { await C.sendReset(email); acct.msg = 'If that email has an account, a reset link is on its way.'; }
      if (kind === 'set-password') { await C.setPassword(pass); acct.recovery = false; acct.msg = 'Password updated.'; }
    } catch (e) { acct.err = e.message; }
    acct.busy = false; render();
  }

  function current() { const v = location.hash.slice(1); return ['home', 'account', 'privacy', 'terms'].includes(v) || VIEWS[v] ? v : 'home'; }

  function render() {
    const v = current();
    const navFor = v === 'home' || v === 'account' ? '#' + v : '#overview';
    document.querySelectorAll('.top-nav a').forEach((a) => a.classList.toggle('active', a.getAttribute('href') === navFor));
    paintAccountLink();
    if (v === 'home') { app.innerHTML = home(); return; }
    if (v === 'account') { app.innerHTML = account(); return; }
    if (v === 'privacy' || v === 'terms') { app.innerHTML = S.legal[v](); return; }
    const st = status();
    if (v === 'paper' && !state.matrix.some((r) => r.id === openPaper)) { location.hash = 'matrix'; return; }
    const m = MODULES.find((x) => x.id === (v === 'paper' ? 'matrix' : v));
    const view = VIEWS[v]();
    app.innerHTML = `<div class="workspace wrap">
      <nav class="side" aria-label="Modules">${MODULES.map((x) => `<a href="#${x.id}"${x.id === (v === 'paper' ? 'matrix' : v) ? ' aria-current="page"' : ''}>
        <span>${x.name}</span>${st[x.id] && st[x.id].issues ? `<b>${st[x.id].issues}</b>` : ''}</a>`).join('')}</nav>
      <section class="module">
        <header class="module-head"><h1>${m.name}</h1><p>${m.pain}</p></header>
        <div class="module-body"><div class="editor">${view.main}</div><aside class="notes" id="notes" aria-label="Notes">${view.notes}</aside></div>
      </section></div>`;
  }

  function refreshNotes() {
    const v = current();
    if (!VIEWS[v]) return;
    const view = VIEWS[v]();
    const notes = document.getElementById('notes');
    if (notes) notes.innerHTML = view.notes;
    if (v === 'check') document.getElementById('flagged').innerHTML = checkTab === 'conclusion' ? flaggedList(checkResult().flagged) : '';
    const st = status();
    document.querySelectorAll('.side a').forEach((a) => {
      const id = a.getAttribute('href').slice(1);
      const n = st[id] && st[id].issues;
      let b = a.querySelector('b');
      if (n && !b) { b = document.createElement('b'); a.appendChild(b); }
      if (b) { if (n) b.textContent = n; else b.remove(); }
    });
  }

  let timer = null;
  function onEdit(e) {
    const el = e.target.closest('[data-bind]');
    if (!el) return;
    setPath(state, el.dataset.bind, el.type === 'checkbox' ? el.checked : el.value);
    const mm = el.dataset.bind.match(/^matrix\.(\d+)\.(\w+)$/);
    if (mm && state.matrix[mm[1]] && state.matrix[mm[1]].aiDraft) state.matrix[mm[1]].aiDraft = state.matrix[mm[1]].aiDraft.filter((k) => k !== mm[2]);
    save();
    const re = el.dataset.rerender;
    if (re === 'all') { render(); return; }
    if (re === 'cite-list') { document.getElementById('cite-list').innerHTML = citeList(); return; }
    clearTimeout(timer);
    timer = setTimeout(refreshNotes, re === 'notes' ? 0 : 250);
  }
  const isChoice = (el) => el.matches('select, input[type=checkbox]');
  app.addEventListener('input', (e) => { if (!isChoice(e.target)) onEdit(e); });
  app.addEventListener('change', (e) => { if (isChoice(e.target)) onEdit(e); });

  async function runSearch() {
    if (searching) return;
    searching = true; searchErr = ''; render();
    try {
      const d = state.discover;
      const r = await S.discover.search(d, { proxy: AI_API });
      Object.assign(d, { results: r.results, total: r.total, sample: false });
      ai.discover = null;
      if (!r.results.length) searchErr = 'No papers found. Try fewer or broader terms, or a longer time range.';
    } catch (e) { searchErr = e.message; }
    searching = false; save(); render();
  }

  async function verifyAll() {
    verifying = true;
    state.refs.results = S.cite.parse(state.refs.input).map((e) => Object.assign(e, { status: 'pending' }));
    render();
    for (const entry of state.refs.results) {
      Object.assign(entry, await S.cite.verify(entry));
      const list = document.getElementById('cite-list');
      if (list) list.innerHTML = citeList();
    }
    verifying = false;
    save();
    if (current() === 'cite') render();
    formatAll();
  }

  function copy(text) {
    const done = () => toast('Copied');
    const fallback = () => {
      const ta = document.createElement('textarea');
      ta.value = text; ta.className = 'copy-fallback'; ta.setAttribute('aria-label', 'References');
      document.querySelector('#cite-list').prepend(ta); ta.focus(); ta.select();
      toast('Press Ctrl+C / ⌘C to copy the selected text');
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
    else fallback();
  }

  const ACTIONS = {
    'open-sample': () => { if (!state.sample) state = S.sample.create(); save(); location.hash = 'overview'; },
    'new-blank': () => { state = S.sample.blank(); save(); location.hash = 'outline'; },
    'acct-mode': (el) => { acct.mode = el.dataset.mode; acct.msg = ''; acct.err = ''; render(); },
    'sign-out': async () => { try { await C.signOut(); } catch (e) { /* session already gone */ } state.cloudId = undefined; S.store.save(state); acct.projects = null; render(); },
    'cloud-save': () => { pushCloud().then(() => { acct.projects = null; render(); }); },
    'cloud-open': async (el) => {
      const local = !state.sample && !state.cloudId;
      if (local && !el.dataset.force) { acct.confirmOpen = el.dataset.id; render(); return; }
      try { state = await C.load(el.dataset.id); S.store.save(state); acct.confirmOpen = ''; location.hash = 'overview'; }
      catch (e) { acct.err = e.message; render(); }
    },
    'cloud-delete': async (el) => {
      try { await C.remove(el.dataset.id); if (state.cloudId === el.dataset.id) { state.cloudId = undefined; S.store.save(state); } }
      catch (e) { acct.err = e.message; }
      acct.projects = null; render();
    },
    'ask-reset': () => { pending = 'reset'; render(); },
    'ask-clear': () => { pending = 'clear'; render(); },
    cancel: () => { pending = ''; render(); },
    confirm: () => {
      state = pending === 'reset' ? S.sample.create() : S.sample.blank();
      pending = ''; save(); render(); toast(state.sample ? 'Example project restored' : 'Project cleared. Start with your research question.');
    },
    'add-row': () => { state.matrix.push(S.matrix.blankRow()); save(); render(); },
    'del-row': (el) => { state.matrix.splice(Number(el.dataset.index), 1); save(); render(); },
    verify: () => { if (!verifying) verifyAll(); },
    'open-paper': (el) => {
      openPaper = el.dataset.id;
      location.hash = 'paper';
      const r = state.matrix.find((x) => x.id === openPaper);
      // Rows added before abstracts were stored (or example rows): fetch the full record once.
      if (r && r.meta && r.meta.doi && !r.meta.abstract && !r.meta.refreshed) {
        r.meta.refreshed = true;
        S.discover.lookup(r.meta.doi, { proxy: AI_API }).then((m) => { Object.assign(r.meta, m, { id: r.meta.id, refreshed: true }); save(); if (current() === 'paper') render(); }, () => {});
      }
    },
    'analyse-paper': (el) => { if (!(paperAi[el.dataset.id] || {}).loading) analysePaper(el.dataset.id, false); },
    'to-matrix': (el) => {
      addToMatrix(state.discover.results[Number(el.dataset.i)]);
      save(); render(); toast('Added to your literature matrix and reference list');
    },
    'find-cited': (el) => findCited(el.dataset.key, el.dataset.text),
    'check-tab': (el) => { checkTab = el.dataset.tab; render(); },
    'add-cited': (el) => {
      const f = citeFind[el.dataset.key];
      const meta = f && f.results && f.results[Number(el.dataset.i)];
      if (!meta) return;
      const row = addToMatrix(meta);
      save(); refreshNotes(); toast('Added to your literature matrix and reference list');
      analysePaper(row.id, true);
    },
    'journal-pick': (el) => pickJournal(journalUi.results[Number(el.dataset.i)]),
    'journal-clear': () => { state.refs.journal = null; save(); render(); },
    jump: (el) => { const t = document.getElementById(el.dataset.target); if (t) { t.scrollIntoView({ block: 'center', behavior: 'smooth' }); t.classList.add('flash'); setTimeout(() => t.classList.remove('flash'), 1200); } },
    ai: (el) => { if (!(ai[el.dataset.view] || {}).loading) askAi(el.dataset.view); },
    'copy-bib': () => { const b = bibliography(); if (b) copy(b); else toast('No verified references yet'); },
    'split-review': () => { state.review.tasks = S.review.split(state.review.input); save(); render(); toast(`${state.review.tasks.length} tasks created`); },
    focus: (el) => { const t = document.getElementById(el.dataset.target); if (t) { t.focus(); t.scrollIntoView({ block: 'center', behavior: 'smooth' }); } },
  };
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (el && ACTIONS[el.dataset.action]) { e.preventDefault(); ACTIONS[el.dataset.action](el); }
  });

  document.addEventListener('submit', (e) => {
    const form = e.target.closest('[data-form]');
    if (form) { e.preventDefault(); if (form.dataset.form === 'discover') runSearch(); else if (form.dataset.form === 'add-link') addFromLink(form); else if (form.dataset.form === 'journal') findJournal(form); else accountSubmit(form); }
  });

  window.addEventListener('hashchange', () => { pending = ''; render(); window.scrollTo(0, 0); });
  C.onChange((event) => {
    if (event === 'PASSWORD_RECOVERY') { acct.recovery = true; history.replaceState(null, '', '#account'); }
    if (event === 'SIGNED_IN' && /access_token|type=/.test(location.hash)) history.replaceState(null, '', '#account');
    acct.projects = null;
    render();
  });
  render();
  C.init().then(render, render);
})();
