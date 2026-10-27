// UI: hash-routed views, two-way binding through data-bind paths, and a
// margin of notes beside each module that re-renders as you type.
(function () {
  const S = window.Sigao;
  const esc = S.text.escapeHtml;
  const app = document.getElementById('app');

  let state = S.store.load() || S.sample.create();
  let pending = '';
  let verifying = false;
  const ai = {}; // per view: { loading, notes, error, blocked }
  const AI_API = window.ARGUO_API || (window.ARGUO_CONFIG || {}).apiUrl || 'https://arguo-api.arguolucid.workers.dev';
  const C = S.cloud;
  const acct = { mode: 'signin', msg: '', err: '', busy: false, projects: null, recovery: false, confirmOpen: '' };
  let cloudState = ''; // '', 'saving', 'saved', 'error'

  const MODULES = [
    { id: 'overview', name: 'Overview', pain: 'Progress and next step' },
    { id: 'outline', name: 'Argument thread', pain: 'Sections that don’t line up · can’t get started' },
    { id: 'matrix', name: 'Literature matrix', pain: 'A review without an argument · no clear gap' },
    { id: 'cite', name: 'Citation check', pain: 'Wrong details · AI-invented references' },
    { id: 'check', name: 'Consistency check', pain: 'Discussion that outruns the results' },
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
    const checked = S.checklist.ALL.filter((i) => state.submit.checked[i.id]).length;
    const issues = (ns) => ns.filter((n) => n.level === 'issue').length;
    return {
      outline: { value: `${S.outline.filled(o)}/6 nodes`, issues: issues(oNotes), done: S.outline.filled(o) === 6 && !issues(oNotes) },
      matrix: { value: `${state.matrix.filter((r) => r.source.trim()).length} sources`, issues: 0, gaps: mNotes.filter((n) => n.level === 'gap').length },
      cite: { value: `${refs.filter((r) => r.status === 'verified').length}/${refs.length} verified`, issues: refs.filter((r) => r.status === 'mismatch' || r.status === 'notfound').length },
      check: { value: !state.check.results.trim() || !state.check.discussion.trim() ? 'Nothing pasted yet'
        : c.flagged.length ? `${c.flagged.length} sentences to review` : 'No problems found', issues: issues(c.notes) },
      review: { value: `${rs.done}/${rs.total} addressed`, issues: rs.majorOpen },
      submit: { value: `${checked}/${S.checklist.ALL.length} items`, issues: 0 },
    };
  }

  // ---------- AI feedback ----------
  function aiBlock(v) {
    const a = ai[v] || {};
    const body = a.loading ? '<p class="ai-status">Reading your text…</p>'
      : a.error ? `<p class="ai-status error">${esc(a.error)}</p>`
        : a.notes ? (a.notes.length ? a.notes.map(noteHtml).join('') : '<p class="ai-status">No further problems found.</p>')
          + (a.blocked ? `<p class="ai-status">${a.blocked} AI ${a.blocked === 1 ? 'note was' : 'notes were'} hidden because ${a.blocked === 1 ? 'it' : 'they'} repeated your wording.</p>` : '') : '';
    return `<section class="ai-box">
        <div class="ai-head"><h4>AI feedback</h4><button class="btn small-btn" data-action="ai" data-view="${v}"${a.loading ? ' disabled' : ''}>${a.notes || a.error ? 'Ask again' : 'Get AI feedback'}</button></div>
        <p class="ai-rule">This module’s text is sent to our AI provider, Groq, which does not train on it (<a href="#privacy">privacy</a>). The AI follows the same rule: diagnose, never write.</p>
        ${body}
      </section>`;
  }

  async function askAi(v) {
    const input = {
      outline: state.outline,
      check: { question: state.outline.question, method: state.outline.method, results: state.check.results, discussion: state.check.discussion },
      matrix: { rows: state.matrix },
      review: { comments: state.review.input },
    }[v];
    ai[v] = { loading: true };
    refreshNotes();
    try {
      const res = await fetch(AI_API + '/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: v === 'check' ? 'consistency' : v, input }) });
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
        <h2>Six modules, one line of argument</h2>
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
            <li>Invent or suggest references it cannot trace</li>
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
    return { main, notes: notesPanel(S.outline.check(state.outline), aiBlock('outline')) };
  }

  function matrix() {
    const cols = S.matrix.COLUMNS;
    const main = `<p class="intro">One row per paper, in your own words. Don’t paste abstracts: summarising yourself is how you see how the papers relate.</p>
      <div class="table-wrap"><table class="matrix">
        <thead><tr>${cols.map((c) => `<th scope="col">${c.label}</th>`).join('')}<th><span class="sr">Actions</span></th></tr></thead>
        <tbody>${state.matrix.map((r, i) => `<tr>${cols.map((c) => c.key === 'relation'
          ? `<td><label class="sr" for="m-${r.id}-relation">Relation to my study</label><select id="m-${r.id}-relation" data-bind="matrix.${i}.relation">
              <option value="">Choose</option>${S.matrix.RELATIONS.map((x) => `<option${r.relation === x ? ' selected' : ''}>${x}</option>`).join('')}</select></td>`
          : `<td><label class="sr" for="m-${r.id}-${c.key}">${c.label}</label><textarea id="m-${r.id}-${c.key}" rows="3" placeholder="${c.placeholder}" data-bind="matrix.${i}.${c.key}">${esc(r[c.key])}</textarea></td>`).join('')}
          <td><button class="icon-btn" data-action="del-row" data-index="${i}" aria-label="Delete row ${i + 1}">Delete</button></td></tr>`).join('')}</tbody>
      </table></div>
      <button class="btn" data-action="add-row">Add a paper</button>
      ${state.sample ? '<p class="fine">The papers in the example are real; the summaries are for demonstration only. Check the originals before citing them.</p>' : ''}`;
    return { main, notes: notesPanel(S.matrix.analyze(state.matrix), aiBlock('matrix')) };
  }

  const STATUS = {
    verified: ['Verified', 'ok'], mismatch: ['Mismatch', 'warn'], notfound: ['Not found', 'pen'], error: ['Connection failed', 'warn'], pending: ['Checking', 'accent'],
  };

  function citeList() {
    const res = state.refs.results || [];
    if (!res.length) return '<p class="empty">Paste your references and choose “Check references”. One per line; a DOI helps.</p>';
    return `<ol class="ref-list">${res.map((r) => {
      const [label, tone] = STATUS[r.status] || STATUS.pending;
      return `<li class="ref">
        <div class="ref-head"><span class="pill tone-${tone}">${label}</span>${r.doi ? `<code>${esc(r.doi)}</code>` : ''}</div>
        <p class="ref-raw">${esc(r.raw)}</p>
        ${(r.issues || []).length ? `<ul class="ref-issues">${r.issues.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
        ${r.note ? `<p class="ref-note">${esc(r.note)}</p>` : ''}
        ${r.record ? `<p class="ref-fixed"><span>Verified entry</span>${esc(S.cite.format(r.record, state.refs.style))}</p>` : ''}
      </li>`;
    }).join('')}</ol>`;
  }

  function bibliography() {
    return (state.refs.results || []).filter((r) => r.record).map((r) => S.cite.format(r.record, state.refs.style))
      .sort((a, b) => a.localeCompare(b)).join('\n');
  }

  function citeNotes() {
    const res = state.refs.results || [];
    const n = (s) => res.filter((r) => r.status === s).length;
    const plural = (k, one, many) => (k === 1 ? one : many);
    const notes = [];
    if (n('notfound')) notes.push({ level: 'issue', title: `${n('notfound')} ${plural(n('notfound'), 'reference', 'references')} not found`, why: 'The authors or title may be wrong, or the paper may not exist at all (for example, a reference invented by an AI tool).', how: 'Find the original and check it. If you cannot find the original, do not cite it.' });
    if (n('mismatch')) notes.push({ level: 'issue', title: `${n('mismatch')} ${plural(n('mismatch'), 'reference differs', 'references differ')} from the record`, why: 'A wrong year, author or title is easy for reviewers and editors to spot.', how: 'Use the verified entry, and fix the matching in-text citation too (for example the year).' });
    if (n('error')) notes.push({ level: 'tip', title: `${n('error')} could not be checked`, why: 'The connection failed.', how: 'Choose “Check references” again later.' });
    if (!notes.length && res.length) notes.push({ level: 'ok', title: 'All references verified', why: '', how: 'Make sure every in-text citation matches an entry in the list.' });
    notes.push({ level: 'tip', title: 'Arguo will not find or generate references for you', why: 'Every reference should be a paper you have read.', how: 'Read and summarise a paper in the literature matrix first, then cite it.' });
    return notes;
  }

  function cite() {
    const main = `<p class="intro">Paste one reference per line. Entries with a DOI are checked directly; others are searched by title. Records come from Crossref.</p>
      <label for="f-refs" class="sr">References</label>
      <textarea id="f-refs" class="mono" rows="7" data-bind="refs.input">${esc(state.refs.input)}</textarea>
      <div class="toolbar">
        <button class="btn primary" data-action="verify"${verifying ? ' disabled' : ''}>${verifying ? 'Checking…' : 'Check references'}</button>
        <label for="f-style">Style</label>
        <select id="f-style" data-bind="refs.style" data-rerender="cite-list">${Object.entries(S.cite.STYLES).map(([k, v]) => `<option value="${k}"${state.refs.style === k ? ' selected' : ''}>${v.label}</option>`).join('')}</select>
        <button class="btn" data-action="copy-bib">Copy verified references</button>
      </div>
      <div id="cite-list">${citeList()}</div>`;
    return { main, notes: notesPanel(citeNotes()) };
  }

  function checkResult() {
    return S.consistency.check({ question: state.outline.question, method: state.outline.method, ...state.check });
  }

  function flaggedList(flagged) {
    if (!flagged.length) return '';
    return `<div class="flagged"><h3>Sentences to review in the discussion</h3><ol>${flagged.map((f) => `<li><q>${esc(f.sentence)}</q><span>${f.reasons.map(esc).join('; ')}</span></li>`).join('')}</ol></div>`;
  }

  function check() {
    const r = checkResult();
    const main = `<p class="intro">Paste your Results and Discussion. They are checked against the research question and method in your argument thread.</p>
      <div class="readonly"><span>Research question (from the argument thread)</span><p>${esc(state.outline.question) || 'Not filled in yet.'}</p><a href="#outline">Edit</a></div>
      <label for="f-results">Results</label>
      <textarea id="f-results" rows="6" data-bind="check.results">${esc(state.check.results)}</textarea>
      <label for="f-discussion">Discussion</label>
      <textarea id="f-discussion" rows="8" data-bind="check.discussion">${esc(state.check.discussion)}</textarea>
      <div id="flagged">${flaggedList(r.flagged)}</div>`;
    return { main, notes: notesPanel(r.notes, aiBlock('check')) };
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
    const main = `<p class="intro">Go through each item before you submit. Your target journal’s Guide for Authors has the final say.</p>
      ${S.checklist.GROUPS.map((g) => `<fieldset class="checks"><legend>${g.name}</legend>${g.items.map(([id, label, how]) => `
        <div class="check-item"><input type="checkbox" id="c-${id}" data-bind="submit.checked.${id}" data-rerender="notes"${state.submit.checked[id] ? ' checked' : ''}>
        <label for="c-${id}">${label}${how ? `<small>${how}</small>` : ''}</label></div>`).join('')}</fieldset>`).join('')}`;
    const left = S.checklist.ALL.filter((i) => !state.submit.checked[i.id]);
    const notes = left.length
      ? [{ level: 'tip', title: `${left.length} ${left.length === 1 ? 'item' : 'items'} left to check`, why: left.slice(0, 6).map((i) => i.label).join('; ') + (left.length > 6 ? '…' : ''), how: 'Editors often return a manuscript straight away when statements or ethics details are missing.' }]
      : [{ level: 'ok', title: 'Checklist complete', why: '', how: 'Read your cover letter once more before you submit.' }];
    return { main, notes: notesPanel(notes) };
  }

  const VIEWS = { overview, outline, matrix, cite, check, review, submit };

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
    const m = MODULES.find((x) => x.id === v);
    const view = VIEWS[v]();
    app.innerHTML = `<div class="workspace wrap">
      <nav class="side" aria-label="Modules">${MODULES.map((x) => `<a href="#${x.id}"${x.id === v ? ' aria-current="page"' : ''}>
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
    if (v === 'check') document.getElementById('flagged').innerHTML = flaggedList(checkResult().flagged);
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
    if (form) { e.preventDefault(); accountSubmit(form); }
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
