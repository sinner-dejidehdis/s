// Next steps: a rule-based plan from the state of the project, plus the input
// for the AI "possible directions" request (grounded in the papers found).
(function (root) {
  const S = root.Sigao = root.Sigao || {};

  // Ordered as a researcher would work: survey -> read -> argue -> write -> revise -> submit.
  function nextSteps(p) {
    const steps = [];
    const add = (title, why, href, done) => steps.push({ title, why, href, done: Boolean(done) });
    const d = p.discover || { results: [] };
    const rows = (p.matrix || []).filter((r) => String(r.source || '').trim());
    const read = rows.filter((r) => String(r.finding || '').trim() && String(r.limitation || '').trim());
    const o = p.outline || {};
    const refs = (p.refs && p.refs.results) || [];
    const tasks = (p.review && p.review.tasks) || [];

    add('Search the recent literature on your topic', 'See what has been published in the last few years before you settle the question.', 'discover', d.results.length && !d.sample);
    add('Read and summarise at least 5 key papers', `${read.length} of ${rows.length} papers in your matrix have findings and limitations filled in.`, 'matrix', read.length >= 5);
    add('Write the research gap in your own words', 'Use the limitations that recur in your matrix.', 'outline', String(o.gap || '').trim().length > 40);
    add('Fill in all six nodes of the argument thread', `${S.outline.filled(o)} of 6 filled.`, 'outline', S.outline.filled(o) === 6);
    add('Fix the problems flagged in the argument thread', 'Breaks in the thread spread to every section.', 'outline', !S.outline.check(o).some((n) => n.level === 'issue'));
    add('Verify every reference', `${refs.filter((r) => r.status === 'verified').length} of ${refs.length} verified.`, 'cite', refs.length && refs.every((r) => r.status === 'verified'));
    if (p.check && String(p.check.results || '').trim()) {
      const c = S.consistency.check({ question: o.question, method: o.method, ...p.check });
      add('Make the discussion match the results', `${c.flagged.length} sentences to review.`, 'check', !c.notes.some((n) => n.level === 'issue'));
    } else add('Check your results and discussion', 'Paste them into the consistency check once you have a draft.', 'check', false);
    if (tasks.length) add('Address the must-fix reviewer comments', `${tasks.filter((t) => t.done).length} of ${tasks.length} addressed.`, 'review', !tasks.some((t) => t.priority === 'Must fix' && !t.done));
    const left = S.checklist.build(p).flatMap((g) => g.items).filter((i) => !S.checklist.isDone(i, p)).length;
    add('Complete the submission checklist', `${left} items left.`, 'submit', left === 0);
    return steps;
  }

  function ideasInput(p) {
    const d = p.discover || { results: [] };
    return {
      topic: d.query || p.title || '',
      question: (p.outline || {}).question || '',
      gap: (p.outline || {}).gap || '',
      papers: d.results.slice(0, 10).map((r) => ({ title: r.title, year: r.year, abstract: String(r.abstract || '').slice(0, 450) })),
      limitations: (p.matrix || []).filter((r) => String(r.limitation || '').trim()).slice(0, 10).map((r) => `${r.source}: ${r.limitation}`),
    };
  }

  S.ideas = { nextSteps, ideasInput };
})(typeof window !== 'undefined' ? window : globalThis);
