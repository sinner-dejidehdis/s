// UI: hash-routed views, two-way binding through data-bind paths, and a
// margin of notes beside each module that re-renders as you type.
(function () {
  const S = window.Sigao;
  const esc = S.text.escapeHtml;
  const app = document.getElementById('app');

  let state = S.store.load() || S.sample.create();
  if (!state.discover) state.discover = S.sample.blankDiscover();
  if (state.sample) syncRefs(); // the example's matrix papers are already in its reference list, silently
  if (!state.design) state.design = S.design.blank();
  if (!state.language) state.language = { text: state.sample ? state.check.discussion : '' };
  let fileBusy = '';
  // Workspace layout: sidebar full or icons, notes shown or hidden, focus mode. Kept per browser.
  const lay = (() => { try { return Object.assign({ mini: false, notes: true, focus: false }, JSON.parse(localStorage.getItem('arguo.layout') || '{}')); } catch (e) { return { mini: false, notes: true, focus: false }; } })();
  let drawer = false; // notes drawer on narrower screens
  function saveLay() { try { localStorage.setItem('arguo.layout', JSON.stringify({ mini: lay.mini, notes: lay.notes, focus: lay.focus })); } catch (e) { /* private mode */ } }
  const wide = () => window.matchMedia('(min-width: 1280px)').matches;
  function paintLayout() {
    const w = document.querySelector('.workspace');
    if (!w) return;
    w.classList.toggle('side-mini', lay.mini);
    w.classList.toggle('focus', lay.focus);
    w.classList.toggle('notes-off', !lay.notes || lay.focus);
    w.classList.toggle('drawer', drawer);
    document.querySelectorAll('[data-action=toggle-notes]').forEach((b) => b.classList.toggle('on', wide() ? lay.notes && !lay.focus : drawer));
    document.querySelectorAll('[data-action=toggle-focus]').forEach((b) => b.classList.toggle('on', lay.focus));
  }
  // Text fields grow with their content, so long sections are read in one piece.
  // Measuring collapses the field for a moment, which would pull the page up,
  // so the scroll position is put back afterwards.
  function fit(el) {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 2 + 'px';
  }
  function autosize(el) {
    if (!el || el.tagName !== 'TEXTAREA' || !el.closest('.workspace')) return;
    const y = window.scrollY;
    fit(el);
    if (window.scrollY !== y) window.scrollTo(0, y);
  }
  function autosizeAll(y) {
    if (y == null) y = window.scrollY;
    document.querySelectorAll('.workspace textarea').forEach(fit);
    if (window.scrollY !== y) window.scrollTo(0, y);
  }
  const jf = { busy: false, err: '', list: null, queries: [] }; // journal finder
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
  const track = (name, detail) => C.logEvent && C.logEvent(name, detail);
  let quota = null; // { remaining, limit } from the last AI reply
  const fb = { open: false, rating: 0, sent: false, err: '', busy: false };
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
    { id: 'language', name: 'Language check', pain: 'Overclaiming, vague or informal wording' },
    { id: 'review', name: 'Reviewer comments', pain: 'A major revision you can’t break down' },
    { id: 'submit', name: 'Submission checklist', pain: 'Missing items at submission' },
  ];

  // Task finder: what people come to do, mapped to the view and the exact control.
  const FIND = [
    { q: 'Check whether my references are real', view: 'cite', target: 'f-refs', k: 'citation reference fake invented hallucinated doi crossref verify check real' },
    { q: 'Format my references for a journal', view: 'cite', target: 'j-q', k: 'format style apa vancouver chicago journal reference list bibliography csl' },
    { q: 'Find papers on my research question', view: 'discover', target: 'd-q', k: 'search find papers literature articles topic question openalex' },
    { q: 'Import my Zotero / EndNote / Mendeley library', view: 'matrix', target: 'imp-bib', k: 'zotero endnote mendeley bibtex bib ris import library' },
    { q: 'Export references to Zotero or LaTeX', view: 'cite', target: 'exp-bib', k: 'export bibtex ris zotero latex endnote download' },
    { q: 'Upload my manuscript (Word or PDF)', view: 'check', target: 'imp-ms', k: 'upload import word docx pdf manuscript file paper draft' },
    { q: 'Improve my academic English', view: 'language', target: 'f-lang', k: 'english language grammar wording style vague informal overclaim tone polish non-native' },
    { q: 'Choose a journal to submit to', view: 'submit', target: 'jf', k: 'journal choose where submit recommend find target apc open access impact' },
    { q: 'Check my discussion against my results', view: 'check', tab: 'conclusion', target: 'f-sec', k: 'discussion results conclusion overclaim causal consistency' },
    { q: 'Check each section of my paper', view: 'check', tab: 'question', target: 'f-sec', k: 'introduction methods results section consistency manuscript' },
    { q: 'Match in-text citations to my reference list', view: 'cite', target: 'xcheck', k: 'in-text citation missing uncited match cross check list' },
    { q: 'Find a research gap', view: 'matrix', target: 'm-link', k: 'gap literature review matrix synthesis limitation' },
    { q: 'Build a clear argument (question → conclusion)', view: 'outline', k: 'argument outline structure research question aim gap logic start' },
    { q: 'Plan my study design', view: 'design', k: 'design method sample size control randomisation ethics experiment survey' },
    { q: 'What should I do next? New research ideas', view: 'ideas', k: 'next step ideas novelty direction innovation plan' },
    { q: 'Respond to reviewer comments', view: 'review', k: 'reviewer comments revision major minor response rebuttal' },
    { q: 'Get ready to submit', view: 'submit', k: 'submission checklist submit cover letter ethics registration guideline' },
    { q: 'See progress on my paper', view: 'overview', k: 'overview progress dashboard project status' },
  ];
  let goTarget = null; // { target } to focus after the next render
  function findTasks(q) {
    const words = String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return FIND;
    return FIND.map((t) => ({ t, n: words.filter((w) => (t.q + ' ' + t.k).toLowerCase().includes(w)).length }))
      .filter((x) => x.n).sort((a, b) => b.n - a.n).map((x) => x.t);
  }
  function goTask(i) {
    const t = FIND[i];
    if (!t) return;
    closeFinder();
    if (t.tab) checkTab = t.tab;
    goTarget = t.target || null;
    track('finder', t.view);
    if (location.hash === '#' + t.view) { render(); } else location.hash = t.view;
  }
  function focusTarget() {
    if (!goTarget) return;
    const el = document.getElementById(goTarget);
    goTarget = null;
    if (!el) return;
    setTimeout(() => {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el.classList.add('flash-target');
      if (el.matches('input, textarea')) el.focus({ preventScroll: true });
      setTimeout(() => el.classList.remove('flash-target'), 2200);
    }, 60);
  }
  function taskList(list, cls) {
    return list.length ? `<ul class="${cls}">${list.map((t) => `<li><button data-action="go-task" data-i="${FIND.indexOf(t)}">${icon(t.view)}<span>${esc(t.q)}</span></button></li>`).join('')}</ul>`
      : '<p class="fine">No match. Try another word, such as “journal”, “Zotero” or “English”.</p>';
  }
  function openFinder() {
    let box = document.getElementById('finder');
    if (!box) {
      box = document.createElement('div');
      box.id = 'finder'; box.className = 'finder'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Find a tool');
      box.innerHTML = `<div class="finder-card"><input id="finder-q" placeholder="What do you want to do? e.g. check references, choose a journal" autocomplete="off"><div id="finder-list"></div><p class="fine">↑↓ to move · Enter to open · Esc to close</p></div>`;
      document.body.appendChild(box);
      box.addEventListener('click', (e) => { if (e.target === box) closeFinder(); });
      box.querySelector('#finder-q').addEventListener('input', (e) => { box.querySelector('#finder-list').innerHTML = taskList(findTasks(e.target.value), 'task-list'); });
    }
    box.hidden = false;
    const q = box.querySelector('#finder-q'); q.value = '';
    box.querySelector('#finder-list').innerHTML = taskList(FIND, 'task-list');
    q.focus();
  }
  function closeFinder() { const b = document.getElementById('finder'); if (b) b.hidden = true; }
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openFinder(); return; }
    const box = document.getElementById('finder');
    if (!box || box.hidden) return;
    const items = [...box.querySelectorAll('[data-action=go-task]')];
    const at = items.indexOf(document.activeElement);
    if (e.key === 'Escape') closeFinder();
    else if (e.key === 'ArrowDown') { e.preventDefault(); (items[at + 1] || items[0]).focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); (at <= 0 ? box.querySelector('#finder-q') : items[at - 1]).focus(); }
    else if (e.key === 'Enter' && document.activeElement.id === 'finder-q' && items[0]) { e.preventDefault(); items[0].click(); }
  });

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
      language: (() => { const n = S.language.notes(state.language.text); return { value: state.language.text.trim() ? `${n.length} kinds of wording to review` : 'Nothing pasted yet', issues: n.filter((x) => x.level === 'issue').length }; })(),
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
        ${quota && quota.remaining != null ? `<p class="ai-quota">${quota.remaining} of ${quota.limit} free AI checks left today</p>` : ''}
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
      language: { text: state.language.text },
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
      if (data.limit) quota = { remaining: data.remaining, limit: data.limit };
      if (res.ok) track('ai_used', v);
      ai[v] = res.ok ? { notes: data.notes || [], blocked: data.blocked || 0 } : { error: data.error || `Request failed (${res.status}).` };
    } catch (e) {
      ai[v] = { error: 'Could not reach the AI server. Previews block outside requests; it works on the deployed site.' };
    }
    refreshNotes();
  }

  // ---------- views ----------
  // Lucide-style 24px stroke icons.
  const ICON_PATHS = {
    overview: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    discover: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    matrix: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16"/>',
    ideas: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V17h5.2v-1.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/>',
    design: '<path d="M9 3h6M10 3v6L4.5 18.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3"/><path d="M7.5 15h9"/>',
    outline: '<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="12" r="2"/><path d="M6 7v10M8 5h3a5 5 0 0 1 5 5v0"/>',
    cite: '<path d="M7 7h4v4c0 3-1.5 5-4 6M15 7h4v4c0 3-1.5 5-4 6"/>',
    check: '<path d="m3 12 4 4 8-8M13 16l2 2 6-6"/>',
    review: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12z"/><path d="M9 11h6M9 14h4"/>',
    language: '<path d="M4 7V5h16v2M9 19h6M12 5v14"/>',
    submit: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
  };
  const icon = (k) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[k] || ''}</svg>`;
  const GROUPS_NAV = [['Plan', ['overview', 'discover', 'matrix', 'ideas', 'design']], ['Write', ['outline', 'cite', 'check', 'language']], ['Revise & submit', ['review', 'submit']]];

  function home() {
    const tiles = [
      ['discover', 'Discover research', 'Search 250M+ scholarly works for the newest and most-cited research on your topic. An AI briefing summarises them and cites only those papers.', 'What’s the state of the art?', true],
      ['matrix', 'Literature matrix', 'Paste a link and the paper’s details and a first reading appear. Find shared limitations and the gap nobody has filled.', 'A review with no argument', true],
      ['ideas', 'Next steps & ideas', 'A plan from where your project is, plus research directions grounded in real papers.', 'What should I do next?'],
      ['design', 'Study design', 'Controls, randomisation, sample size, confounders, ethics: checked before you collect data.', 'Is my design sound?'],
      ['outline', 'Argument thread', 'Question, gap, aim, method, result, conclusion: one line, with every break flagged.', 'Sections that don’t line up'],
      ['check', 'Consistency check', 'Each manuscript section against its node, with examples from published papers.', 'Discussion outruns results'],
      ['cite', 'Citation check', 'Every reference verified against Crossref and formatted for your target journal.', 'Wrong details, invented refs'],
      ['review', 'Reviewer comments', 'Turn a major revision into tasks; vague comments flagged.', 'Can’t break down revisions'],
      ['submit', 'Submission checklist', 'Adapts to your target journal and study design: reporting guideline, registration, fees and statements. Anything Arguo can verify from your project is ticked automatically.', 'What did I miss?', 'full'],
    ];
    const preview = `<div class="preview" aria-hidden="true">
        <div class="pv-bar"><i></i><i></i><i></i><span>arguo · Consistency check</span></div>
        <div class="pv-body">
          <div class="pv-side">${['overview', 'discover', 'matrix', 'outline', 'check', 'cite'].map((k) => `<span class="${k === 'check' ? 'on' : ''}">${icon(k)}${MODULES.find((m) => m.id === k).name}</span>`).join('')}</div>
          <div class="pv-main">
            <h4>Conclusion</h4>
            <p class="pv-label">Your discussion</p>
            <div class="pv-field">We found that longer bedtime social media use was associated with poorer sleep quality. <mark>Our results also show that social media use damages students’ academic performance.</mark> <mark>This study proves</mark> that limiting phone use will help.</div>
            <p class="pv-label">Results</p>
            <div class="pv-field">Each additional hour of bedtime use was associated with a 1.2-point higher PSQI score (95% CI 0.8–1.6).</div>
          </div>
          <div class="pv-notes">
            <div class="pv-note"><span class="tag" style="color:var(--pen)">Fix</span><b>A claim with no supporting result</b>Academic performance was never measured. Remove it, or turn it into a question for future work.</div>
            <div class="pv-note"><span class="tag" style="color:var(--pen)">Fix</span><b>Correlation written as cause</b>“Damages” claims cause from survey data. Use “is associated with”.</div>
            <div class="pv-note"><span class="tag" style="color:var(--accent)">Published example</span><b>How Levenson et al. (2016) phrase it</b>They report an association and name the cross-sectional limit.</div>
          </div>
        </div>
      </div>`;
    return `<div class="home">
      <section class="hero wrap">
        <a class="hero-badge" href="citation-checker/"><b>FREE</b><span>Is that reference real? Check it in seconds →</span></a>
        <h1>Arguo checks your paper. <span class="g">It never writes it.</span></h1>
        <p class="lede">Every reference verified against Crossref, so no invented citations. Your reference list formatted for any of 10,000+ journals. Your argument, methods and discussion checked against each other. And not one sentence written for you, so there is nothing to disclose.</p>
        <div class="hero-actions">
          <button class="btn grad" data-action="open-sample">Try the example project</button>
          <button class="btn" data-action="new-blank">Start your paper</button>
        </div>
        <div class="home-find"><p class="home-find-label">Or go straight to what you need:</p>
          <label for="home-q" class="sr">What do you want to do?</label>
          <input id="home-q" placeholder="Type what you want to do, e.g. journal, Zotero, English…" autocomplete="off">
          <div id="home-tasks">${taskList(FIND.slice(0, 8), 'task-grid')}</div>
          <button class="link-btn" data-action="finder">See all ${FIND.length} tasks</button></div>
        <div class="trust"><span>No invented references</span><span>10,000+ journal styles</span><span>Nothing to disclose to journals</span><span>250M+ papers via OpenAlex</span></div>
        ${preview}
      </section>

      <section class="section wrap">
        <div class="section-head"><span class="kicker">One workspace</span><h2>Every step of the paper, connected.</h2>
          <p>Papers you find flow into your matrix, citations you write are matched to it, and your reference list formats itself for the journal you choose.</p></div>
        <div class="bento">${tiles.map(([k, n, d, p, wide]) => `<a class="tile${wide === 'full' ? ' full' : wide ? ' wide' : ''}" href="#${k}"><span class="tile-ico">${icon(k)}</span><h3>${n}</h3><p>${d}</p><span class="pain">${p}</span></a>`).join('')}</div>
      </section>

      <section class="section wrap" id="free-tools">
        <div class="section-head"><span class="kicker">Free tools · no sign-up</span><h2>Try one job before the whole workspace.</h2></div>
        <div class="bento">
          <a class="tile" href="citation-checker/"><span class="tile-ico">${icon('cite')}</span><h3>Citation Checker</h3><p>Is that reference real? Spot AI-invented citations, wrong years and misspelled authors.</p><span class="pain">Fake or wrong references</span></a>
          <a class="tile" href="reference-formatter/"><span class="tile-ico">${icon('submit')}</span><h3>Reference Formatter</h3><p>Paste DOIs, pick your journal, copy a verified list in its official style.</p><span class="pain">Reformatting for every journal</span></a>
          <a class="tile" href="gap-finder/"><span class="tile-ico">${icon('discover')}</span><h3>Research Gap Finder</h3><p>Latest papers on your topic and a briefing on open questions, citing only real papers.</p><span class="pain">Where is the gap?</span></a>
        </div>
      </section>

      <section class="section wrap">
        <div class="section-head"><span class="kicker">How it works</span><h2>From topic to submission in three moves.</h2></div>
        <div class="steps3">
          <div class="step3"><h3>Map the field</h3><p>Search your topic, read the briefing, and pull the key papers into your literature matrix with one click.</p></div>
          <div class="step3"><h3>Build the argument</h3><p>Write your question, gap and design in the argument thread. Arguo flags every break and suggests directions.</p></div>
          <div class="step3"><h3>Check and submit</h3><p>Check each section against your thread, verify and format references, and tick off a checklist built for your journal.</p></div>
        </div>
      </section>

      <section class="section wrap">
        <div class="section-head"><span class="kicker">Our promise</span><h2>Feedback, never ghostwriting.</h2>
          <p>Many journals ask authors to disclose AI-generated text. Arguo doesn’t generate any of your manuscript.</p></div>
        <div class="redline-grid">
          <div><h3>Arguo does</h3><ul>
            <li>Point out where the problem is and why it matters</li>
            <li>Explain how to fix it, step by step</li>
            <li>Show how published papers handle the same thing</li>
            <li>Ask questions that help you think it through</li>
            <li>Verify references and format them for your journal</li></ul></div>
          <div class="no"><h3>Arguo does not</h3><ul>
            <li>Rewrite or continue your paragraphs</li>
            <li>Generate paragraphs, sections or papers</li>
            <li>“Humanise” or polish AI text</li>
            <li>Invent references: every paper it shows is real and linked</li>
            <li>Write your response letter</li></ul></div>
        </div>
      </section>

      <section class="wrap">
        <div class="cta-band"><h2>Start with the example, then bring your own paper.</h2><p>Free while in testing. Your project stays in your browser unless you sign in.</p>
          <button class="btn" data-action="open-sample">Open the example project</button></div>
      </section>
    </div>`;
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
        <input id="d-q" data-bind="discover.query" value="${esc(d.query)}" placeholder="Ask in your own words, e.g. does scrolling on phones at night make students sleep worse?">
        <button class="btn primary"${searching ? ' disabled' : ''}>${searching ? 'Searching…' : 'Search'}</button>
      </form>
      <div class="toolbar">
        <label for="d-years">Published</label><select id="d-years" data-bind="discover.years">${opt(S.discover.YEARS, d.years)}</select>
        <label for="d-sort">Sort</label><select id="d-sort" data-bind="discover.sort">${opt(S.discover.SORTS, d.sort)}</select>
        <label class="inline-check"><input type="checkbox" id="d-oa" data-bind="discover.oa"${d.oa ? ' checked' : ''}> Free full text only</label>
      </div>
      ${searchErr ? `<p class="acct-msg error">${esc(searchErr)}</p>` : ''}
      ${d.results.length ? `<p class="fine">${d.queries && d.queries.length ? `Searched by meaning for: ${d.queries.map((q) => `<i>${esc(q)}</i>`).join(', ')}; ranked by how well each paper answers your question. The AI can misread a question or leave out a relevant paper, so check the search terms and try your own keywords too.` : d.total ? `${d.total.toLocaleString()} matches; showing ${d.results.length}.` : ''} Results from ${d.source === 'crossref' ? '<a href="https://www.crossref.org" target="_blank" rel="noopener">Crossref</a> (OpenAlex is busy right now, so the free-full-text filter and some abstracts are unavailable)' : '<a href="https://openalex.org" target="_blank" rel="noopener">OpenAlex</a>'}. ${d.sample ? 'These example results are real papers.' : ''}</p>
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
      <div class="toolbar import-bar"><label class="btn file-btn" id="imp-bib">${fileBusy === 'bib' ? 'Importing…' : 'Import from Zotero, EndNote or Mendeley'}<input type="file" accept=".bib,.ris,.txt" data-file="bib" hidden></label>
        <span class="fine">Export your library or a collection as BibTeX (.bib) or RIS (.ris), then choose the file. Up to 300 papers at a time; papers already in the matrix are skipped. Notes, PDFs and tags are not imported.</span></div>
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
      if (data.limit) quota = { remaining: data.remaining, limit: data.limit };
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status}).`);
      track('ai_used', 'paper');
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
    const same = (a, b) => String(a || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() === String(b || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const existing = state.matrix.find((x) => x.meta && (x.meta.id === meta.id || (meta.doi && x.meta.doi && x.meta.doi.toLowerCase() === meta.doi.toLowerCase()) || (same(x.meta.title, meta.title) && (!x.meta.year || !meta.year || Math.abs(x.meta.year - meta.year) <= 1))));
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
      if (state.matrix.some((x) => x.meta && S.discover.titleScore(x.meta.title, link) >= 0.9)) throw new Error('That paper is already in your matrix.');
      const meta = await S.discover.lookup(link, { proxy: AI_API });
      const n = state.matrix.filter((x) => x.meta).length;
      const row = addToMatrix(meta);
      if (state.matrix.filter((x) => x.meta).length === n) throw new Error('That paper is already in your matrix.');
      track('add_paper', 'link');
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
    const x = S.cite.crossCheck(allText(), state.refs.input);
    if (x.missing.length) notes.push({ level: 'issue', title: `${x.missing.length} ${plural(x.missing.length, 'citation is', 'citations are')} missing from the list`, why: 'Every source cited in the text needs a full entry in the reference list; reviewers and editors check this.', how: 'See “Citations in your text vs your reference list” below, then add each missing entry.' });
    if (x.uncited.length && (x.mode === 'numeric' || x.cited)) notes.push({ level: 'tip', title: `${x.uncited.length} ${plural(x.uncited.length, 'entry is', 'entries are')} never cited`, why: 'Most journals ask that the list contains only works cited in the text.', how: 'Cite each one where it supports a claim, or remove it from the list.' });
    if (!state.refs.journal) notes.push({ level: 'ask', title: 'Choose your target journal', why: 'Each journal has its own reference style.', how: 'Search for the journal above; references with a DOI are then formatted in its official style.' });
    return notes;
  }

  // All the writing in the project, for matching in-text citations.
  function allText() {
    return [...Object.values(state.outline), ...Object.values(state.check), state.language.text].filter((x) => typeof x === 'string').join('\n');
  }
  function crossBlock() {
    const x = S.cite.crossCheck(allText(), state.refs.input);
    if (x.mode === 'author-year' && !x.cited) return '<section class="ai-box"><h4>Citations in your text vs your reference list</h4><p class="ai-rule">No in-text citations found yet. Paste or import your manuscript in the Consistency or Language check, and Arguo will match every citation against this list.</p></section>';
    const miss = x.missing.length ? `<p><b>Cited in your text but not in the list (${x.missing.length}):</b> ${x.missing.map((c) => esc(c.text)).join('; ')}</p>` : '';
    const unc = x.uncited.length ? `<p><b>In the list but never cited in your text (${x.uncited.length}):</b></p><ul>${x.uncited.slice(0, 12).map((e) => `<li>${esc(e.raw.slice(0, 140))}</li>`).join('')}</ul>` : '';
    return `<section class="ai-box" id="xcheck"><h4>Citations in your text vs your reference list</h4>
      <p class="ai-rule">${x.mode === 'numeric' ? 'Numbered citations ([1], [2–4]) matched by number.' : 'Author–year citations matched by first author and year.'} Checks the text in your argument thread, consistency check and language check.</p>
      ${miss || unc ? miss + unc + '<p class="fine">Spelling variants, “et al.” lists and papers with the same author and year can be missed or mismatched; confirm each one.</p>' : '<p>Every citation has a matching entry, and every entry is cited.</p>'}</section>`;
  }

  function journalFinder() {
    const list = jf.list ? jf.list.map((j, i) => {
      const n = j.info || {};
      const facts = [n.publisher, n.isOa ? (n.doaj ? 'Open access (in DOAJ)' : 'Open access') : 'Subscription or hybrid', n.apc != null ? `APC about $${n.apc.toLocaleString()}` : '', n.hIndex ? `h-index ${n.hIndex}` : ''].filter(Boolean);
      return `<li class="jf-item"><div class="jf-top"><b>${esc(j.name)}</b><button class="btn small-btn" data-action="journal-use" data-i="${i}">Use as target journal</button></div>
        <p class="fine">${esc(facts.join(' · '))}${n.homepage ? ` · <a href="${esc(n.homepage)}" target="_blank" rel="noopener">Journal site</a>` : ''}</p>
        <details><summary>${j.papers.length} similar ${j.papers.length === 1 ? 'paper' : 'papers'} published here</summary><ul>${j.papers.map((p) => `<li><a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.title)}</a> (${p.year || 'n.d.'})</li>`).join('')}</ul></details></li>`;
    }).join('') : '';
    return `<section class="ai-box" id="jf"><div class="ai-head"><h4>Which journals publish work like yours?</h4><button class="btn small-btn" data-action="journal-suggest"${jf.busy ? ' disabled' : ''}>${jf.busy ? 'Searching…' : jf.list ? 'Search again' : 'Suggest journals'}</button></div>
      <p class="ai-rule">Uses your research question and aim to find similar papers from the last 5 years, then lists the journals that published them. Read each journal’s aims and scope and a few recent issues before deciding. Fees and open-access status come from OpenAlex and can be out of date; check them on the journal site.</p>
      ${jf.err ? `<p class="acct-msg error">${esc(jf.err)}</p>` : ''}
      ${jf.queries.length ? `<p class="fine">Searched for: ${jf.queries.map((q) => `<i>${esc(q)}</i>`).join(', ')}</p>` : ''}
      ${list ? `<ol class="jf-list">${list}</ol>` : ''}</section>`;
  }

  async function suggestJournals() {
    jf.busy = true; jf.err = ''; render();
    try {
      const r = await S.journals.suggest([state.outline.question, state.outline.aim].filter(Boolean).join(' ') || state.title, { proxy: AI_API });
      jf.list = r.journals; jf.queries = r.queries;
      track('journal_suggest');
    } catch (e) { jf.err = e.message; }
    jf.busy = false; render();
  }

  async function useJournal(j) {
    try {
      const list = await S.styles.load();
      const hit = S.styles.search(list, j.name, 5).find((x) => x.title.toLowerCase() === j.name.toLowerCase());
      if (hit) { await pickJournal(hit); toast(`Target journal: ${j.name}`); return; }
      journalUi.q = j.name; journalUi.results = S.styles.search(list, j.name, 8);
      toast('No exact style match; pick the journal from the list'); render();
    } catch (e) { toast('Could not load the journal list. Try again.'); }
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
        <button class="btn" id="exp-bib" data-action="export" data-format="bib">Export BibTeX</button>
        <button class="btn" data-action="export" data-format="ris">Export RIS</button>
      </div>
      <p class="fine">Exports contain every paper in your literature matrix, for Zotero, EndNote, Mendeley or LaTeX.</p>
      <div id="cite-list">${citeList()}</div>
      ${crossBlock()}`;
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
      track('journal_pick');
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
    const main = `<p class="intro">Check each section of your manuscript against the matching node of your argument thread. Paste a section, read the notes, and use the guide and published examples to revise it yourself.
      ${importBar()}</p>
      <div class="tabs" role="tablist">${tabs.map((x, i) => {
        const n = tabIssues(x);
        const filled = (state.check[x.field] || '').trim();
        return `<button role="tab" class="tab${x.key === t.key ? ' on' : ''}" aria-selected="${x.key === t.key}" data-action="check-tab" data-tab="${x.key}">
          <span class="tab-n">${i + 1}</span>${x.label}${n ? `<b>${n}</b>` : filled ? '<i class="tab-ok" aria-label="checked">✓</i>' : ''}</button>`;
      }).join('')}</div>
      <div class="readonly"><span>${t.label} in your argument thread</span><p>${esc(state.outline[t.node]) || 'Not filled in yet.'}</p><a href="#outline">Edit</a></div>
      <label for="f-sec">Your ${esc(t.section)}</label>
      <textarea id="f-sec" class="big" rows="${conclusion ? 9 : 7}" data-bind="check.${t.field}" placeholder="Paste this section of your manuscript">${esc(text)}</textarea>
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
      <textarea id="f-review" class="big" rows="6" data-bind="review.input">${esc(state.review.input)}</textarea>
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
      ${state.refs.journal ? '' : journalFinder()}
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

  function importBar() {
    return `<div class="toolbar import-bar"><label class="btn file-btn" id="imp-ms">${fileBusy === 'ms' ? 'Reading your manuscript…' : 'Import a manuscript (.docx, .pdf)'}<input type="file" accept=".docx,.pdf,.txt,.md" data-file="ms" hidden></label>
      <span class="fine">Fills all six tabs, the language check and the reference list. The file is read in your browser and is not uploaded. Sections are found by standard headings (Introduction, Methods, Results, Discussion, References); without them, paste each section into its tab. Scanned PDFs (images without text) and old .doc files cannot be read.</span></div>`;
  }

  function language() {
    const text = state.language.text;
    const main = `<p class="intro">Paste any part of your manuscript. Arguo flags wording reviewers often object to (overclaiming, causal verbs, vague or informal words, filler, very long sentences) and explains how to revise it. It never rewrites your sentences.</p>
      <p class="fine">Limits: the rules check English only and can flag words that are fine in context (for example “causes” in a randomised trial), so read each note against your design. The AI feedback reads about the first 4,000 characters, so for a long manuscript ask about one section at a time.</p>
      ${importBar()}
      <label for="f-lang">Your text</label>
      <textarea id="f-lang" class="big" rows="10" data-bind="language.text" placeholder="Paste a paragraph or a whole section">${esc(text)}</textarea>
      <div id="lang-preview">${langPreview()}</div>`;
    return { main, notes: notesPanel(S.language.notes(text), aiBlock('language')) };
  }

  function langPreview() {
    const r = S.language.check(state.language.text);
    if (!r.hits.length) return '';
    const flagged = new Set(r.hits.map((h) => h.i));
    const words = {};
    r.hits.forEach((h) => { words[h.i] = (words[h.i] || []).concat(h.kind === 'long' || h.kind === 'passive' ? [] : h.words); });
    const mark = (s, i) => {
      let out = esc(s);
      (words[i] || []).forEach((w) => { out = out.replace(new RegExp(`\\b(${esc(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\b`, 'gi'), '<mark>$1</mark>'); });
      return out;
    };
    const shown = [...flagged].slice(0, 60);
    return `<h3 class="sub">Sentences to look at (${flagged.size} of ${r.sentences.length})</h3>${flagged.size > 60 ? '<p class="fine">Showing the first 60. Revise these, or check one section at a time, to see the rest.</p>' : ''}<ol class="lang-list">${shown.map((i) => `<li><p>${mark(r.sentences[i], i)}</p>
      <small>${[...new Set(r.hits.filter((h) => h.i === i).map((h) => h.label))].join(' · ')}</small></li>`).join('')}</ol>`;
  }

  function download(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function onFile(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    const kind = input.dataset.file;
    fileBusy = kind; render();
    try {
      if (kind === 'bib') {
        const papers = S.bib.parse(await file.text());
        if (!papers.length) throw new Error('No references found. Export as BibTeX (.bib) or RIS (.ris).');
        const before = state.matrix.length;
        papers.slice(0, 300).forEach((p) => addToMatrix(p));
        track('import_bib', String(papers.length));
        toast(`${state.matrix.length - before} papers added to your matrix and reference list`);
      } else {
        const sec = S.manuscript.split(await S.manuscript.readFile(file));
        const pr = S.manuscript.toProject(sec);
        if (!pr.found.length) throw new Error('No section headings found (Introduction, Methods, Results, Discussion…). Paste the sections into each tab instead.');
        Object.keys(pr.check).forEach((k) => { if (pr.check[k]) state.check[k] = pr.check[k]; });
        state.language.text = pr.body;
        if (pr.refs.length) state.refs.input = (state.refs.input.trim() + '\n' + pr.refs.join('\n')).trim();
        state.sample = false;
        track('import_manuscript', pr.found.join(','));
        toast(`Read: ${pr.found.join(', ')}. Check each tab.`);
      }
      save();
    } catch (e) { toast(e.message); }
    fileBusy = ''; input.value = ''; render();
  }
  document.addEventListener('change', (e) => { if (e.target.matches('input[type=file][data-file]')) onFile(e.target); });

  const VIEWS = { overview, discover, ideas, design, paper: paperView, outline, matrix, cite, check, language, review, submit };

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
      if (kind === 'signup') { track('signup'); const r = await C.signUp(email, pass); if (r.needsConfirm) acct.msg = 'Check your email and click the link to confirm your account, then sign in.'; }
      if (kind === 'reset') { await C.sendReset(email); acct.msg = 'If that email has an account, a reset link is on its way.'; }
      if (kind === 'set-password') { await C.setPassword(pass); acct.recovery = false; acct.msg = 'Password updated.'; }
    } catch (e) { acct.err = e.message; }
    acct.busy = false; render();
  }

  function current() { const v = location.hash.slice(1); return ['home', 'account', 'privacy', 'terms'].includes(v) || VIEWS[v] ? v : 'home'; }

  function render() {
    const v = current();
    document.body.classList.toggle('ws', !['home', 'account', 'privacy', 'terms'].includes(v));
    const navFor = v === 'home' || v === 'account' ? '#' + v : '#overview';
    document.querySelectorAll('.top-nav a').forEach((a) => a.classList.toggle('active', a.getAttribute('href') === navFor));
    paintAccountLink();
    if (v === 'home') { app.innerHTML = home(); if (location.hash === '#tools') setTimeout(() => { const t = document.getElementById('free-tools'); if (t) t.scrollIntoView({ behavior: 'smooth' }); }, 50); return; }
    if (v === 'account') { app.innerHTML = account(); return; }
    if (v === 'privacy' || v === 'terms') { app.innerHTML = S.legal[v](); return; }
    const st = status();
    if (v === 'paper' && !state.matrix.some((r) => r.id === openPaper)) { location.hash = 'matrix'; return; }
    const m = MODULES.find((x) => x.id === (v === 'paper' ? 'matrix' : v));
    const view = VIEWS[v]();
    const issues = (view.notes.match(/class="note-tag">Fix</g) || []).length;
    app.innerHTML = `<div class="workspace v2">
      <nav class="side" aria-label="Modules"><button class="side-toggle" data-action="toggle-side" title="${lay.mini ? 'Expand sidebar' : 'Collapse sidebar'}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/></svg><span>${lay.mini ? 'Expand' : 'Collapse'}</span></button>${GROUPS_NAV.map(([g, ids]) => `<p class="side-label">${g}</p>` + ids.map((id) => MODULES.find((x) => x.id === id)).map((x) => `<a href="#${x.id}" title="${esc(x.pain)}"${x.id === (v === 'paper' ? 'matrix' : v) ? ' aria-current="page"' : ''}>
        ${icon(x.id)}<span>${x.name}</span>${st[x.id] && st[x.id].issues ? `<b>${st[x.id].issues}</b>` : ''}</a>`).join('')).join('')}<button class="side-tour" data-action="tour-start">✦ Take the guided tour</button></nav>
      <section class="module">
        <header class="module-head"><h1><span class="tile-ico">${icon(m.id)}</span>${m.name}</h1><p>${m.pain}</p>
          <div class="view-tools">
            <button class="view-btn" data-action="toggle-notes" title="Show or hide the notes"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/></svg><span class="lbl">Notes</span>${issues ? `<b>${issues}</b>` : ''}</button>
            <button class="view-btn" data-action="toggle-focus" title="Focus: hide the sidebar and notes"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg><span class="lbl">${lay.focus ? 'Exit focus' : 'Focus'}</span></button>
          </div></header>
        <div class="module-body${v === 'matrix' ? ' stack' : ''}"><div class="editor">${view.main}</div><aside class="notes" id="notes" aria-label="Notes">${view.notes}</aside></div>
      </section></div>`;
  }

  function refreshNotes() {
    const v = current();
    if (!VIEWS[v]) return;
    const view = VIEWS[v]();
    const notes = document.getElementById('notes');
    if (notes) notes.innerHTML = view.notes;
    const nb = document.querySelector('[data-action=toggle-notes]');
    if (nb) { const n = (view.notes.match(/class="note-tag">Fix</g) || []).length; let b = nb.querySelector('b'); if (n && !b) { b = document.createElement('b'); nb.appendChild(b); } if (b) { if (n) b.textContent = n; else b.remove(); } }
    if (v === 'language') document.getElementById('lang-preview').innerHTML = langPreview();
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
  app.addEventListener('input', (e) => {
    if (e.target.id === 'home-q') { document.getElementById('home-tasks').innerHTML = taskList(findTasks(e.target.value).slice(0, 8), 'task-grid'); return; }
    if (!isChoice(e.target)) onEdit(e);
    autosize(e.target);
  });
  app.addEventListener('change', (e) => { if (isChoice(e.target)) onEdit(e); });

  async function runSearch() {
    if (searching) return;
    searching = true; searchErr = ''; render();
    try {
      const d = state.discover;
      const r = await S.discover.smartSearch(d, { proxy: AI_API });
      Object.assign(d, { results: r.results, total: r.total, queries: r.queries, source: r.source, sample: false });
      track('search');
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
    'open-sample': () => {
      track('open_sample');
      if (!tourSeen()) { startTour('sample'); return; }
      if (!state.sample) { state = S.sample.create(); syncRefs(); } save(); location.hash = 'overview'; },
    'new-blank': () => {
      track('new_blank');
      if (!tourSeen()) { startTour('blank'); return; }
      state = S.sample.blank(); save(); location.hash = 'outline'; },
    'tour-start': () => startTour('replay'),
    'tour-next': () => tourGo(tour.i + 1),
    'tour-back': () => tourGo(tour.i - 1),
    'tour-skip': () => endTour(false),
    'tour-finish': (el) => endTour(el.dataset.blank === '1'),
    'tour-here': () => { location.hash = TOUR[tour.i].view; },
    'tour-min': () => { tour.min = !tour.min; paintTour(); },
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
      state = pending === 'reset' ? S.sample.create() : S.sample.blank(); syncRefs();
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
    'toggle-side': () => { lay.mini = !lay.mini; saveLay(); render(); },
    'toggle-notes': () => { if (wide()) { if (lay.focus) { lay.focus = false; lay.notes = true; } else lay.notes = !lay.notes; saveLay(); } else drawer = !drawer; paintLayout(); autosizeAll(); },
    'toggle-focus': () => { lay.focus = !lay.focus; drawer = false; saveLay(); render(); },
    'go-task': (el) => goTask(Number(el.dataset.i)),
    finder: () => openFinder(),
    'journal-suggest': () => { if (!jf.busy) suggestJournals(); },
    'journal-use': (el) => useJournal(jf.list[Number(el.dataset.i)]),
    'journal-clear': () => { state.refs.journal = null; save(); render(); },
    jump: (el) => { const t = document.getElementById(el.dataset.target); if (t) { t.scrollIntoView({ block: 'center', behavior: 'smooth' }); t.classList.add('flash'); setTimeout(() => t.classList.remove('flash'), 1200); } },
    ai: (el) => { if (!(ai[el.dataset.view] || {}).loading) askAi(el.dataset.view); },
    export: (el) => {
      const papers = state.matrix.filter((r) => r.meta).map((r) => r.meta);
      if (!papers.length) { toast('Add papers to your literature matrix first'); return; }
      const bib = el.dataset.format === 'bib';
      download(bib ? 'arguo-references.bib' : 'arguo-references.ris', bib ? S.bib.toBibtex(papers) : S.bib.toRis(papers), bib ? 'application/x-bibtex' : 'application/x-research-info-systems');
      track('export_' + el.dataset.format);
    },
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
    if (form && form.dataset.form === 'feedback') { e.preventDefault(); sendFeedback(form); return; }
    if (form) { e.preventDefault(); if (form.dataset.form === 'discover') runSearch(); else if (form.dataset.form === 'add-link') addFromLink(form); else if (form.dataset.form === 'journal') findJournal(form); else accountSubmit(form); }
  });

  // ---------- feedback ----------
  function feedbackHtml() {
    if (!C.enabled()) return '';
    if (!fb.open) return '<button class="fb-btn" data-action="fb-open">Feedback</button>';
    const body = fb.sent ? '<p class="fb-thanks">Thank you. Every message is read.</p>'
      : `<form data-form="feedback" class="fb-form">
          <p class="fb-q">How useful is Arguo so far?</p>
          <div class="fb-rate">${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="${fb.rating === n ? 'on' : ''}" data-action="fb-rate" data-n="${n}" aria-label="${n} out of 5">${n}</button>`).join('')}</div>
          <label for="fb-msg">What should we fix or add?</label>
          <textarea id="fb-msg" rows="3" required></textarea>
          <label for="fb-email">Email, if you want a reply (optional)</label>
          <input id="fb-email" type="email" autocomplete="email">
          ${fb.err ? `<p class="acct-msg error">${esc(fb.err)}</p>` : ''}
          <button class="btn primary"${fb.busy ? ' disabled' : ''}>${fb.busy ? 'Sending…' : 'Send feedback'}</button>
        </form>`;
    return `<section class="fb-panel" role="dialog" aria-label="Feedback"><div class="fb-head"><b>Send feedback</b><button class="icon-btn" data-action="fb-close" aria-label="Close">✕</button></div>${body}</section>`;
  }
  function paintFeedback() {
    let el = document.getElementById('fb');
    if (!el) { el = document.createElement('div'); el.id = 'fb'; document.body.appendChild(el); }
    el.innerHTML = feedbackHtml();
  }
  async function sendFeedback(form) {
    fb.busy = true; fb.err = '';
    const message = form.querySelector('#fb-msg').value;
    const email = form.querySelector('#fb-email').value;
    paintFeedback();
    try { await C.sendFeedback({ rating: fb.rating, message, email, page: current() }); fb.sent = true; track('feedback'); }
    catch (e) { fb.err = e.message; }
    fb.busy = false; paintFeedback();
  }
  ACTIONS['fb-open'] = () => { fb.open = true; fb.sent = false; paintFeedback(); const t = document.getElementById('fb-msg'); if (t) t.focus(); };
  ACTIONS['fb-close'] = () => { fb.open = false; paintFeedback(); };
  ACTIONS['fb-rate'] = (el) => { fb.rating = Number(el.dataset.n); document.querySelectorAll('.fb-rate button').forEach((b) => b.classList.toggle('on', Number(b.dataset.n) === fb.rating)); };

  function loadAnalytics() {
    const token = (window.ARGUO_CONFIG || {}).cfAnalyticsToken;
    if (!token) return;
    const sc = document.createElement('script');
    sc.defer = true; sc.src = 'https://static.cloudflareinsights.com/beacon.min.js';
    sc.setAttribute('data-cf-beacon', JSON.stringify({ token }));
    document.head.appendChild(sc);
  }

  // ---------- guided tour: learn what a module does, then try one thing in it ----------
  const TOUR = [
    { view: 'overview', title: 'Welcome to Arguo', learn: ['Arguo checks your paper at every stage and never writes it for you.', 'The sidebar follows the life of a paper: Plan (find and read research, design the study), Write (argument, references, consistency) and Revise & submit.', 'This tour uses an example project about social media and sleep. It contains deliberate mistakes so you can see what each module catches.'],
      try: 'Look at the module cards below. A red count means problems to fix.', target: '.status-grid' },
    { view: 'discover', title: 'Discover research', learn: ['Search 250M+ papers for the newest or most-cited work on your topic.', 'Every result links to the paper. “Summarise these results” gives an AI briefing that cites only these papers.', 'Use it when you have a topic and need to know the state of the art.'],
      try: 'Add one paper to your literature matrix.', target: '.paper-links', done: { click: '[data-action="to-matrix"]' } },
    { view: 'matrix', title: 'Literature matrix', learn: ['One row per paper: sample, method, finding, limitation, and how it relates to your study.', 'Paste a DOI or link to add a paper; the AI drafts reading notes from the abstract, marked “AI draft” until you edit them.', 'The notes on the right spot shared limitations and one-sided evidence: that is where gaps hide.'],
      try: 'Click a paper title to open its detail page.', target: '.paper-open', done: { click: '.paper-open' } },
    { view: 'ideas', title: 'Next steps & ideas', learn: ['A plan built from where your project is, with the one thing to do next at the top.', 'Below it, the AI can suggest research directions, each built on papers you found.'],
      try: 'Read the “Do this next” card. Click Next when you are ready.', target: '.next-card' },
    { view: 'design', title: 'Study design', learn: ['Describe your planned study before collecting data.', 'Arguo checks what reviewers always ask: controls, randomisation, sample size, confounders, ethics, preregistration and the right reporting guideline.', 'The AI can review the design and compare it with methods of similar studies.'],
      try: 'Change the study design type and watch the notes change.', target: '#g-type', done: { change: '#g-type' } },
    { view: 'outline', title: 'Argument thread', learn: ['Six nodes: question, gap, aim, method, result, conclusion. If they line up, every section knows its job.', 'The notes flag breaks, such as a causal conclusion from survey data.', 'Each node has an example from another topic, so you see the pattern without copying.'],
      try: 'The example conclusion says social media “causes” insomnia. Edit it and watch the note update.', target: '#f-conclusion', done: { input: '#f-conclusion' } },
    { view: 'cite', title: 'Citation check', learn: ['Every paper in your matrix appears here; paste any others.', '“Check references” verifies each one against Crossref and flags references that do not exist.', 'Choose your target journal and the list is formatted in its official style.'],
      try: 'Switch the reference style and see the entries reformat.', target: '#f-style', done: { change: '#f-style' } },
    { view: 'check', title: 'Consistency check', learn: ['Six tabs, one for each node of your argument thread. Paste the matching section of your manuscript.', 'Each tab shows what reviewers look for, a common structure and an example, and the AI can show how published papers do it.'],
      try: 'Open the Conclusion tab to see sentences flagged in the example discussion.', target: '.tabs', done: { click: '.tab[data-tab="conclusion"]' } },
    { view: 'review', title: 'Reviewer comments', learn: ['Paste comments from reviewers or your supervisor; they become a task list.', 'Must-fix and vague comments are flagged, and you write a plan for each one.'],
      try: 'Tick one task as addressed.', target: '.task-top', done: { change: '.task-top input[type=checkbox]' } },
    { view: 'submit', title: 'Submission checklist', learn: ['It adapts to your target journal and study design.', 'Items Arguo can verify are ticked automatically; a link takes you to fix any that fail.'],
      try: 'Tick one item you have done.', target: '.check-item input[type=checkbox]', done: { change: '.check-item input[type=checkbox]' } },
  ];
  const tour = { on: false, i: 0, done: {}, intent: 'sample', min: false };
  function tourSeen() { try { return localStorage.getItem('arguo.tour') === 'done'; } catch (e) { return true; } }
  function startTour(intent) {
    tour.on = true; tour.i = 0; tour.done = {}; tour.intent = intent;
    if (!state.sample) { state = S.sample.create(); syncRefs(); }
    save(); track('tour_start', intent);
    if (location.hash === '#' + TOUR[0].view) render(); else location.hash = TOUR[0].view;
  }
  function tourGo(i) {
    if (i < 0) return;
    if (i >= TOUR.length) { tour.i = TOUR.length; paintTour(); return; }
    tour.i = i; tour.min = false; track('tour_step', TOUR[i].view);
    if (location.hash === '#' + TOUR[i].view) render(); else location.hash = TOUR[i].view;
  }
  function endTour(blank) {
    tour.on = false;
    try { localStorage.setItem('arguo.tour', 'done'); } catch (e) { /* storage blocked */ }
    track('tour_end', tour.i >= TOUR.length ? 'finished' : 'skipped_' + tour.i);
    document.querySelectorAll('.tour-target').forEach((el) => el.classList.remove('tour-target'));
    if (blank) { state = S.sample.blank(); save(); location.hash = 'outline'; } else render();
    paintTour();
  }
  function paintTour() {
    let el = document.getElementById('tour');
    if (!el) { el = document.createElement('div'); el.id = 'tour'; document.body.appendChild(el); }
    document.body.classList.toggle('touring', tour.on);
    document.querySelectorAll('.tour-target').forEach((x) => x.classList.remove('tour-target'));
    if (!tour.on) { el.innerHTML = ''; return; }
    if (tour.i >= TOUR.length) {
      el.innerHTML = `<section class="tour-card" role="dialog" aria-label="Tour complete"><p class="tour-step">Tour complete</p><h3>You’ve seen every module.</h3>
        <p>Start your own paper whenever you are ready. You can replay this tour from the sidebar at any time.</p>
        <div class="tour-actions"><button class="btn grad" data-action="tour-finish" data-blank="1">Start my paper</button><button class="btn" data-action="tour-finish">Keep exploring the example</button></div></section>`;
      return;
    }
    const st = TOUR[tour.i];
    const here = current() === st.view || (st.view === 'matrix' && current() === 'paper');
    const ok = tour.done[tour.i];
    if (tour.min) {
      el.innerHTML = `<button class="tour-pill${ok ? ' ok' : ''}" data-action="tour-min" aria-label="Show the guide">${ok ? '✓' : '✦'} Step ${tour.i + 1}/${TOUR.length} · ${esc(st.try)}</button>`;
    } else el.innerHTML = `<section class="tour-card" role="dialog" aria-label="Guided tour">
      <div class="tour-top"><p class="tour-step">Step ${tour.i + 1} of ${TOUR.length}</p><span><button class="icon-btn" data-action="tour-min">Minimise</button><button class="icon-btn" data-action="tour-skip">Skip tour</button></span></div>
      <div class="tour-bar"><i style="width:${((tour.i + 1) / TOUR.length) * 100}%"></i></div>
      <h3>${st.title}</h3>
      <p class="tour-label">Learn</p><ul>${st.learn.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      <p class="tour-label">Try it</p><p class="tour-try${ok ? ' ok' : ''}">${ok ? '✓ ' : ''}${esc(st.try)}</p>
      ${here ? '' : '<button class="link-btn" data-action="tour-here">Go back to this step</button>'}
      <div class="tour-actions">${tour.i ? '<button class="btn" data-action="tour-back">Back</button>' : (tour.intent === 'blank' ? '<button class="btn" data-action="tour-finish" data-blank="1">Skip and start writing</button>' : '')}
        <button class="btn ${ok || !st.done ? 'grad' : ''}" data-action="tour-next">${tour.i === TOUR.length - 1 ? 'Finish' : 'Next'}</button></div>
    </section>`;
    if (here && st.target) {
      const t = document.querySelector(st.target);
      if (t) {
        t.classList.add('tour-target');
        // Keep the target in the top part of the screen, clear of the guide card.
        const top = t.getBoundingClientRect().top + window.scrollY - (window.innerWidth <= 760 ? 110 : 180);
        window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
      }
    }
  }
  function tourWatch(type, e) {
    if (!tour.on || tour.i >= TOUR.length) return;
    const d = TOUR[tour.i].done;
    if (d && d[type] && e.target.closest(d[type]) && !tour.done[tour.i]) { tour.done[tour.i] = true; setTimeout(paintTour, 0); }
  }
  ['click', 'change', 'input'].forEach((type) => document.addEventListener(type, (e) => tourWatch(type, e), true));
  const renderPage = render;
  // Re-rendering the same view keeps the reader where they were.
  let lastView = null;
  render = function () {
    const v = current();
    const y = v === lastView ? window.scrollY : 0;
    lastView = v;
    renderPage(); paintLayout(); autosizeAll(y); paintTour(); focusTarget();
  };

  let rz = null;
  window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (wide()) drawer = false; paintLayout(); autosizeAll(); }, 150); });
  window.addEventListener('hashchange', () => { pending = ''; drawer = false; window.scrollTo(0, 0); render(); });
  C.onChange((event) => {
    if (event === 'PASSWORD_RECOVERY') { acct.recovery = true; history.replaceState(null, '', '#account'); }
    if (event === 'SIGNED_IN' && /access_token|type=/.test(location.hash)) history.replaceState(null, '', '#account');
    acct.projects = null;
    render();
  });
  render();
  C.init().then(() => { render(); paintFeedback(); track('visit', current()); }, render);
  loadAnalytics();
})();
