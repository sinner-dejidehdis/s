// Consistency check: research questions -> results -> discussion. Flags
// discussion claims with little support in the results, overclaiming, causal
// language on correlational designs and a missing limitations paragraph.
(function (root) {
  const S = root.Sigao = root.Sigao || {};
  const T = S.text;

  const CLAIM = /\b(show|shows|showed|shown|suggest\w*|demonstrat\w*|indicat\w*|prove\w*|reveal\w*|impl(y|ies|ied)|means?|confirm\w*|establish\w*|cause\w*|leads?|damages?|improves?|reduces?)\b|表明|说明|证明|证实|意味着|揭示|导致/i;
  const CITES = /(19|20)\d{2}[a-z]?[)）]|et al|等[（(]|\[\d+(,\s*\d+)*\]/i;
  const OVERCLAIM = /\b(proves?|proved|proven|proof|definitive(ly)?|conclusively|always|never|first to|completely|entirely|undoubtedly|eliminat\w*)\b|证明|证实|首次|完全|彻底|必然/i;
  const CAUSAL = /\b(causes?|caused|causing|leads? to|led to|results? in|drives?|impairs?|damages?|harms?|improves?|reduces?)\b|导致|造成|引起|损害/i;
  const CORRELATIONAL = /survey|cross-sectional|correlat|regression|questionnaire|observational|问卷|横断|调查|回归/i;
  const LIMITS = /limitation|caveat|future research|future studies|should be interpreted with caution|局限|不足之处|未来研究/i;

  function splitQuestions(q) {
    return String(q || '').split(/(?<=[？?])|\n+|,\s*and\s+(?=(does|do|is|are|how|what|whether)\b)/i)
      .filter((x) => x && !/^(does|do|is|are|how|what|whether)$/i.test(x))
      .map((x) => x.trim()).filter((x) => x.length > 3);
  }

  function check(input) {
    const question = String(input.question || '');
    const results = String(input.results || '');
    const discussion = String(input.discussion || '');
    const method = String(input.method || '');
    const notes = [];
    const flagged = [];

    if (!results.trim() || !discussion.trim()) {
      notes.push({ level: 'tip', title: 'Paste your results and discussion first',
        why: 'The check needs both sections to see whether each claim in the discussion is backed by a result.',
        how: 'Paste the Results and Discussion of your manuscript into the two boxes.' });
      return { notes, flagged };
    }

    splitQuestions(question).forEach((q, i) => {
      if (T.coverage(q, results) < 0.25) {
        notes.push({ level: 'issue', title: `Research question ${i + 1} has no matching result`,
          why: `Few key concepts from "${q}" appear in the results.`,
          how: 'Add a result for this question. If your data cannot answer it, revise or drop the question.' });
      }
    });

    const support = new Set([...T.terms(results + ' ' + method), ...T.terms(question)]);
    T.sentences(discussion).forEach((s) => {
      if (CITES.test(s)) return;
      const reasons = [];
      if (CLAIM.test(s) && T.terms(s).size >= 4 && T.coverage(s, support) < 0.6) reasons.push('no supporting result');
      if (OVERCLAIM.test(s)) reasons.push(`absolute wording "${s.match(OVERCLAIM)[0]}"`);
      if (CAUSAL.test(s) && CORRELATIONAL.test(results + ' ' + method)) reasons.push(`causal claim "${s.match(CAUSAL)[0]}" from correlational data`);
      if (reasons.length) flagged.push({ sentence: s, reasons });
    });

    const has = (prefix) => flagged.filter((f) => f.reasons.some((r) => r.startsWith(prefix))).length;
    const unsupported = has('no supporting');
    if (unsupported) {
      notes.push({ level: 'issue', title: `${unsupported} ${unsupported === 1 ? 'claim' : 'claims'} in the discussion ${unsupported === 1 ? 'has' : 'have'} no supporting result`,
        why: 'The discussion can only interpret results you have reported. A new claim without data will be cut or questioned by reviewers.',
        how: 'Go sentence by sentence. Where a claim matches a result, note which one. Where it does not, add the analysis, soften it to a hypothesis, or move it to future research.',
        example: '(Urban parks study) The results only measured surface temperature, but the discussion says "parks reduced heatstroke among residents". That sentence should go, or become a hypothesis for future work.' });
    }
    if (has('absolute')) {
      notes.push({ level: 'tip', title: 'Absolute wording in the discussion',
        why: 'A single study rarely "proves" anything or "completely" solves a problem.',
        how: 'Qualify the claim: in which sample and under which conditions did your data show what.' });
    }
    if (has('causal')) {
      notes.push({ level: 'issue', title: 'Correlational results written as causal',
        why: 'Surveys, cross-sectional designs and regression on observational data show association, not which variable causes which.',
        how: 'Replace causal verbs with "is associated with", and say in the limitations that the direction is unknown and what design could test it.' });
    }
    if (!LIMITS.test(discussion)) {
      notes.push({ level: 'issue', title: 'The discussion has no limitations',
        why: 'If you do not state the limitations, reviewers will, and usually more harshly. Stating them yourself builds credibility.',
        how: 'For the 2–3 most important limitations, write: what it is, how it might affect the results, and how future work could address it.',
        example: '(Urban parks study) "We used daytime summer images only, so night-time cooling is not captured; future studies could add ground weather-station data."' });
    }
    if (!notes.length) {
      notes.push({ level: 'ok', title: 'No obvious inconsistencies',
        why: 'A rule check only catches surface problems.', how: 'Read it once more sentence by sentence, or ask a peer to read it as a reviewer would.' });
    }
    return { notes, flagged };
  }

  S.consistency = { check, splitQuestions };
})(typeof window !== 'undefined' ? window : globalThis);
