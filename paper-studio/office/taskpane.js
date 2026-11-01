// Arguo for Word: reads the open document, runs the same checks as the
// workspace, and can mark problems as Word comments. It never changes the
// writer's text. Outside Word the pane works on pasted text, for testing.
(function () {
  const S = window.Sigao;
  const esc = S.text.escapeHtml;
  const API = window.ARGUO_API || (window.ARGUO_CONFIG || {}).apiUrl || 'https://arguo-api.arguolucid.workers.dev';
  const SITE = 'https://arguolucid.arguolucid.workers.dev/';
  const pane = document.getElementById('pane');
  const ui = { inWord: false, busy: '', err: '', text: '', report: null, refs: null, ai: null, msg: '' };

  // ---------- Word ----------
  const word = (fn) => window.Word.run(fn);
  async function readDocument() {
    return word(async (ctx) => { const b = ctx.document.body; b.load('text'); await ctx.sync(); return b.text; });
  }
  async function readSelection() {
    return word(async (ctx) => { const r = ctx.document.getSelection(); r.load('text'); await ctx.sync(); return r.text; });
  }
  // Word searches up to 255 characters; the start of a sentence is enough to find it.
  const probe = (sentence) => sentence.replace(/\s+/g, ' ').trim().slice(0, 120).replace(/\s+\S*$/, '');
  async function selectSentence(sentence) {
    return word(async (ctx) => {
      const found = ctx.document.body.search(probe(sentence), { matchCase: true });
      found.load('items');
      await ctx.sync();
      if (!found.items.length) return false;
      found.items[0].select();
      await ctx.sync();
      return true;
    });
  }
  // Adds one comment per flagged sentence, anchored on the flagged word.
  async function addComments(items) {
    return word(async (ctx) => {
      let added = 0;
      for (const it of items) {
        const found = ctx.document.body.search(probe(it.sentence), { matchCase: true });
        found.load('items');
        await ctx.sync();
        if (!found.items.length) continue;
        let anchor = found.items[0];
        if (it.word) {
          const inner = anchor.search(it.word, { matchCase: false, matchWholeWord: true });
          inner.load('items');
          await ctx.sync();
          if (inner.items.length) anchor = inner.items[0];
        }
        anchor.insertComment(`Arguo · ${it.label}: ${it.why} How to fix: ${it.how}`);
        added++;
      }
      await ctx.sync();
      return added;
    });
  }

  // ---------- checks ----------
  function analyse(raw) {
    const text = String(raw || '').replace(/\r\n?/g, '\n').replace(/\u000b/g, '\n');
    const sec = S.manuscript.split(text);
    const pr = S.manuscript.toProject(sec);
    const body = pr.body || text;
    const lang = S.language.check(body);
    const notes = S.language.notes(body);
    const refsText = pr.refs.join('\n');
    const cross = S.cite.crossCheck(body, refsText);
    const words = body.split(/\s+/).filter(Boolean).length;
    return { sec, pr, body, lang, notes, refsText, cross, words };
  }

  function commentItems(r) {
    const out = [];
    const rules = Object.fromEntries(S.language.notes(r.body).map((n) => [n.title.split(':')[0], n]));
    r.lang.hits.forEach((h) => {
      const n = rules[h.label];
      if (!n || out.some((o) => o.i === h.i && o.label === h.label)) return;
      out.push({ i: h.i, sentence: r.lang.sentences[h.i], word: /\d+ words|passive/.test(h.words[0]) ? '' : h.words[0], label: h.label, why: n.why.replace(/ Found: .*$/, ''), how: n.how });
    });
    return out.slice(0, 40);
  }

  async function checkDocument() {
    ui.busy = 'doc'; ui.err = ''; ui.msg = ''; ui.refs = null; paint();
    try {
      const text = ui.inWord ? await readDocument() : document.getElementById('paste').value;
      if (!text.trim()) throw new Error(ui.inWord ? 'The document is empty.' : 'Paste some text first.');
      ui.text = text;
      ui.report = analyse(text);
    } catch (e) { ui.err = e.message || 'Could not read the document.'; }
    ui.busy = ''; paint();
  }

  async function verifyRefs() {
    const r = ui.report;
    const entries = S.cite.parse(r.refsText).slice(0, 60);
    ui.refs = entries.map((e) => Object.assign(e, { status: 'pending' }));
    ui.busy = 'refs'; paint();
    for (const e of ui.refs) { Object.assign(e, await S.cite.verify(e)); paint(); }
    ui.busy = ''; paint();
  }

  async function aiSelection() {
    ui.busy = 'ai'; ui.err = ''; ui.ai = null; paint();
    try {
      const text = ui.inWord ? await readSelection() : (window.getSelection().toString() || document.getElementById('paste').value);
      if (!text || text.trim().length < 40) throw new Error('Select a paragraph or more in your document first.');
      const res = await fetch(API + '/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ task: 'language', input: { text: text.slice(0, 4000) } }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status}).`);
      ui.ai = { notes: data.notes || [], remaining: data.remaining, limit: data.limit };
    } catch (e) { ui.err = e.message === 'Failed to fetch' ? 'Could not reach the Arguo server.' : e.message; }
    ui.busy = ''; paint();
  }

  async function comment() {
    ui.busy = 'comments'; ui.err = ''; paint();
    try {
      const n = await addComments(commentItems(ui.report));
      ui.msg = n ? `${n} comments added. Your text was not changed; delete the comments when you are done.` : 'No matching sentences were found in the document.';
    } catch (e) { ui.err = 'Comments need Word 2019 or later, or Word on the web. ' + (e.message || ''); }
    ui.busy = ''; paint();
  }

  // ---------- view ----------
  const note = (n, i) => `<article class="note tone-${n.level === 'issue' ? 'pen' : 'warn'}"><header><span class="note-tag">${n.level === 'issue' ? 'Fix' : 'Suggestion'}</span></header>
    <h4>${esc(n.title)}</h4>${n.why ? `<p>${esc(n.why)}</p>` : ''}<p><b>How to fix</b> ${esc(n.how || '')}</p>
    ${n.example ? `<details><summary>Example from another topic</summary><p>${esc(n.example)}</p></details>` : ''}
    ${ui.inWord && n.sentences ? `<button class="link-btn" data-act="show" data-i="${i}">Show in document</button>` : ''}</article>`;

  function report() {
    const r = ui.report;
    if (!r) return '';
    const found = r.pr.found.length ? r.pr.found.join(', ') : 'none (no standard headings)';
    const x = r.cross;
    const refs = ui.refs ? `<ol class="pane-refs">${ui.refs.map((e) => `<li><span class="pill ${e.status === 'verified' ? 'tone-ok' : e.status === 'pending' ? '' : 'tone-pen'}">${{ verified: 'Verified', mismatch: 'Details differ', notfound: 'Not found', pending: 'Checking…', error: 'Error' }[e.status] || e.status}</span> ${esc(e.raw.slice(0, 110))}${e.issues && e.issues.length ? `<small>${esc(e.issues.join('; '))}</small>` : e.note ? `<small>${esc(e.note)}</small>` : ''}</li>`).join('')}</ol>` : '';
    return `<section class="pane-card"><h3>Your document</h3><p class="fine">${r.words.toLocaleString()} words · sections found: ${esc(found)} · ${r.pr.refs.length} references</p></section>
      <section class="pane-card"><div class="pane-row"><h3>Wording</h3>${ui.inWord && r.notes.length ? `<button class="btn small-btn" data-act="comments"${ui.busy ? ' disabled' : ''}>${ui.busy === 'comments' ? 'Adding…' : 'Add as Word comments'}</button>` : ''}</div>
        ${r.notes.length ? r.notes.map(note).join('') : '<p class="fine">No overclaiming, causal, vague or informal wording found.</p>'}</section>
      <section class="pane-card"><h3>Citations</h3>
        ${x.mode === 'author-year' && !x.cited ? '<p class="fine">No in-text citations found.</p>'
          : `${x.missing.length ? `<p><b>Cited but not in the reference list (${x.missing.length}):</b> ${x.missing.map((c) => esc(c.text)).join('; ')}</p>` : ''}
             ${x.uncited.length ? `<p><b>In the list but never cited (${x.uncited.length}):</b></p><ul>${x.uncited.slice(0, 10).map((e) => `<li>${esc(e.raw.slice(0, 110))}</li>`).join('')}</ul>` : ''}
             ${!x.missing.length && !x.uncited.length ? '<p class="fine">Every citation has a matching entry.</p>' : ''}`}
        ${r.pr.refs.length ? `<button class="btn small-btn" data-act="verify"${ui.busy ? ' disabled' : ''}>${ui.busy === 'refs' ? 'Checking…' : 'Check every reference against Crossref'}</button>` : '<p class="fine">No “References” heading found, so the list was not checked.</p>'}
        ${refs}</section>`;
  }

  function paint() {
    pane.innerHTML = `
      ${ui.inWord ? '' : `<p class="fine pane-demo">Not running inside Word: paste text to try the checks. <a href="./">How to add Arguo to Word</a></p>
        <label for="paste" class="sr">Your text</label><textarea id="paste" rows="8" placeholder="Paste your manuscript, with its headings (Introduction, Methods, Results, Discussion, References)">${esc(ui.text)}</textarea>`}
      <div class="pane-actions">
        <button class="btn grad" data-act="doc"${ui.busy ? ' disabled' : ''}>${ui.busy === 'doc' ? 'Reading…' : ui.inWord ? 'Check this document' : 'Check this text'}</button>
        <button class="btn" data-act="ai"${ui.busy ? ' disabled' : ''}>${ui.busy === 'ai' ? 'Asking the AI…' : 'AI feedback on the selection'}</button>
      </div>
      <p class="fine">Arguo points out problems and explains fixes. It never changes your text.</p>
      ${ui.err ? `<p class="acct-msg error">${esc(ui.err)}</p>` : ''}${ui.msg ? `<p class="acct-msg">${esc(ui.msg)}</p>` : ''}
      ${ui.ai ? `<section class="pane-card ai-box"><h3>AI feedback on your selection</h3>${ui.ai.notes.length ? ui.ai.notes.map(note).join('') : '<p class="fine">No problems found.</p>'}${ui.ai.limit ? `<p class="fine">${ui.ai.remaining} of ${ui.ai.limit} free AI checks left today.</p>` : ''}</section>` : ''}
      ${report()}
      <p class="fine pane-foot"><a href="${SITE}#overview" target="_blank" rel="noopener">Open the full Arguo workspace</a> for literature search, the argument thread, journal styles and the submission checklist.</p>`;
  }

  pane.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'doc') checkDocument();
    else if (act === 'ai') aiSelection();
    else if (act === 'verify') verifyRefs();
    else if (act === 'comments') comment();
    else if (act === 'show') {
      const n = ui.report.notes[Number(b.dataset.i)];
      const s = n && ui.report.lang.sentences[n.sentences[0]];
      if (s && !(await selectSentence(s).catch(() => false))) { ui.msg = 'That sentence could not be found; it may have changed since the check.'; paint(); }
    }
  });
  pane.addEventListener('input', (e) => { if (e.target.id === 'paste') ui.text = e.target.value; });

  if (window.Office && window.Office.onReady) {
    window.Office.onReady((info) => { ui.inWord = Boolean(info && info.host === window.Office.HostType.Word && window.Word); paint(); });
    setTimeout(() => { if (!pane.innerHTML) paint(); }, 1500); // Office.js loaded outside Office
  } else paint();
})();
