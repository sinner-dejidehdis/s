// Literature matrix: one row per paper. The analysis does not write the review;
// it points at patterns (repeated limitations, one dominant design, no dissent)
// and asks the questions that turn a pile of summaries into a gap.
(function (root) {
  const S = root.Sigao = root.Sigao || {};
  const T = S.text;

  const COLUMNS = [
    { key: 'source', label: 'Source', placeholder: 'Author (year)' },
    { key: 'sample', label: 'Sample & setting', placeholder: 'Who, where, how many' },
    { key: 'method', label: 'Method', placeholder: 'Design and analysis' },
    { key: 'finding', label: 'Main finding', placeholder: 'In your own words' },
    { key: 'limitation', label: 'Limitations', placeholder: 'Stated by the authors or noticed by you' },
    { key: 'relation', label: 'Relation to my study', placeholder: '' },
  ];
  const RELATIONS = ['Supports', 'Contradicts', 'Method reference', 'Background'];

  const DESIGNS = [
    ['cross-sectional', /cross-sectional|survey|questionnaire|横断|问卷/i],
    ['longitudinal or cohort', /longitudinal|cohort|panel|follow-up|纵向|追踪|队列/i],
    ['experimental', /experiment|trial|intervention|randomi[sz]ed|rct|实验|干预/i],
    ['review or meta-analysis', /review|meta-analy|综述|元分析/i],
    ['qualitative', /interview|qualitative|ethnograph|focus group|访谈|质性/i],
  ];

  function blankRow() {
    return { id: 'r' + Math.random().toString(36).slice(2, 8), source: '', sample: '', method: '', finding: '', limitation: '', relation: '' };
  }

  function yearOf(row) {
    const m = String(row.source || '').match(/(19|20)\d{2}/);
    return m ? Number(m[0]) : null;
  }

  // Clauses (split at punctuation) that recur across rows, as [clause, rowCount].
  function repeatedClauses(cells) {
    const perRow = cells.map((c) => String(c || '').split(/[；;，,、。]+|\.\s+|\(|\)/).map((x) => x.trim()).filter((x) => T.terms(x).size));
    const seen = [];
    perRow.forEach((clauses, i) => clauses.forEach((c) => {
      if (seen.some(([s]) => T.coverage(c, s) >= 0.5 || T.coverage(s, c) >= 0.5)) return;
      const n = 1 + perRow.filter((other, j) => j !== i && other.some((o) => T.coverage(c, o) >= 0.5)).length;
      if (n >= 2) seen.push([c, n]);
    }));
    return seen.sort((a, b) => b[1] - a[1]).slice(0, 4);
  }

  function analyze(rows, now) {
    rows = (rows || []).filter((r) => COLUMNS.some((c) => String(r[c.key] || '').trim()));
    now = now || new Date().getFullYear();
    const notes = [];

    if (rows.length < 3) {
      notes.push({ level: 'tip', title: `Only ${rows.length} ${rows.length === 1 ? 'source' : 'sources'} so far`,
        why: 'With fewer than three papers you cannot see agreements or disagreements, so a gap is hard to judge.',
        how: 'Add the 5–10 papers closest to your research question, one row each.' });
      return notes;
    }

    const empty = rows.filter((r) => !String(r.limitation || '').trim()).length;
    if (empty) {
      notes.push({ level: 'tip', title: `${empty} ${empty === 1 ? 'paper has' : 'papers have'} no limitations filled in`,
        why: 'Gaps most often hide in the limitations of earlier work.',
        how: 'Go back to each paper’s discussion and note the limitations the authors admit.' });
    }

    const designCount = DESIGNS.map(([name, re]) => [name, rows.filter((r) => re.test(r.method || '')).length]);
    const top = designCount.slice().sort((a, b) => b[1] - a[1])[0];
    if (top[1] >= Math.ceil(rows.length * 0.6)) {
      const missing = designCount.filter(([, n]) => n === 0).map(([name]) => name);
      notes.push({ level: 'gap', title: `${top[1]} of ${rows.length} papers use a ${top[0]} design`,
        why: 'When one design dominates, its shared weakness becomes the weakness of the whole field.',
        how: `Consider whether your study can add a different design, for example ${missing.slice(0, 3).join(', ') || 'a different data source'}.`,
        ask: `What question can a ${top[0]} design not answer? Can your study answer it?` });
    }

    const repeated = repeatedClauses(rows.map((r) => r.limitation));
    if (repeated.length) {
      notes.push({ level: 'gap', title: 'The same limitations recur across papers',
        why: `${repeated.map(([c, n]) => `"${c}" (${n} papers)`).join(', ')}. A limitation many authors admit but nobody addresses is often a gap.`,
        how: 'Group these limitations into one or two themes and phrase them as "Earlier work has mostly …; few studies …". Then add that to the research gap in your argument thread.',
        ask: 'Is this limitation there because it cannot be done, or because nobody has done it?' });
    }

    const rel = (name) => rows.filter((r) => r.relation === name).length;
    if (rel('Contradicts') && rel('Supports')) {
      notes.push({ level: 'gap', title: `${rel('Contradicts')} ${rel('Contradicts') === 1 ? 'paper contradicts' : 'papers contradict'} the others`,
        why: 'Conflicting findings suggest that some condition matters. That is good material for a review with an argument.',
        how: 'Compare the samples, measures and settings on each side to see whether they explain the disagreement. Organise the review around the disagreement and its causes, not paper by paper.',
        ask: 'Under what conditions does the finding hold, and when does it not?' });
    } else if (!rel('Contradicts')) {
      notes.push({ level: 'tip', title: 'All papers point the same way',
        why: 'Agreement can be a real consensus, a sign you have not found dissenting work yet, or publication bias.',
        how: 'Search again with terms such as "null result", "no association" or "non-significant".',
        ask: 'Has any study found the opposite, or no effect?' });
    }

    const years = rows.map(yearOf).filter(Boolean);
    if (years.length && Math.max(...years) <= now - 4) {
      notes.push({ level: 'tip', title: `The most recent paper is from ${Math.max(...years)}`,
        why: 'Reviewers often ask for work from the last three years; otherwise they may doubt the gap is still open.',
        how: 'Search for the last three years sorted by date and confirm the gap still exists.' });
    }

    const samples = rows.map((r) => r.sample).filter((x) => String(x || '').trim());
    if (samples.length >= 3) {
      notes.push({ level: 'ask', title: 'Compare the samples and settings',
        why: `Samples so far: ${samples.map((x) => `"${x}"`).join('; ')}.`,
        how: 'Look for populations, regions or settings nobody has studied.',
        ask: 'What is new about your sample compared with these?' });
    }
    return notes;
  }

  S.matrix = { COLUMNS, RELATIONS, blankRow, analyze };
})(typeof window !== 'undefined' ? window : globalThis);
