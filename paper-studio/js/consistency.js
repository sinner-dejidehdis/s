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

  // ---- the six sections, one per node of the argument thread ----
  const TABS = [
    { key: 'question', node: 'question', field: 'question', label: 'Research question', section: 'Introduction (where you state the question)',
      look: ['The question is stated explicitly, near the end of the introduction', 'It uses the same key concepts as your argument thread', 'It can be answered by your design', 'Each sub-question is listed once, in a fixed order'],
      pattern: 'Context → problem → "This study asks whether / to what extent …"',
      example: '(Urban parks) "…it remains unclear how much cooling small parks provide. This study asks whether park size is associated with land-surface temperature within 500 m, and whether this differs by vegetation type."' },
    { key: 'gap', node: 'gap', field: 'gap', label: 'Research gap', section: 'Literature review or introduction',
      look: ['What is known is summarised with citations', 'What is missing is named precisely (population, setting, method or variable)', 'Why the missing piece matters is explained', 'The gap leads directly to your question'],
      pattern: 'Known (with citations) → unknown → why it matters → therefore this study',
      example: '(Urban parks) "Studies in temperate cities report cooling of 1–2 °C [refs]. Few have compared vegetation types, and none have examined dense subtropical cities, where heat risk is highest."' },
    { key: 'aim', node: 'aim', field: 'aim', label: 'Aim', section: 'Aims or objectives paragraph',
      look: ['Each aim starts with an action verb (estimate, compare, test)', 'There is one aim per research question', 'The aims do not promise more than the method can deliver', 'Hypotheses, if any, are stated with their direction'],
      pattern: '"We aimed to (1) estimate …, and (2) compare …"',
      example: '(Urban parks) "We aimed to (1) estimate the association between park area and surrounding surface temperature and (2) compare tree-dominated with lawn-dominated parks."' },
    { key: 'method', node: 'method', field: 'method', label: 'Method', section: 'Methods',
      look: ['Every concept in the question has a named measure', 'The sample, its size and how it was chosen are clear', 'The analysis for each question is stated', 'Ethics approval and consent are reported for human research', 'Someone could repeat the study from this section'],
      pattern: 'Design → participants/samples → measures → procedure → analysis → ethics',
      example: '(Urban parks) "Land-surface temperature was derived from Landsat 8 band 10 for 12 cloud-free summer scenes (2019–2023). Park area and vegetation type were taken from the city land-use map."' },
    { key: 'result', node: 'result', field: 'results', label: 'Result', section: 'Results',
      look: ['Each research question gets a result, in the same order', 'Effects are reported with size and uncertainty (e.g. estimates and 95% CIs), not only p values', 'Results are reported without interpretation', 'Numbers match tables and figures'],
      pattern: 'Question → what was tested → estimate (CI) → direction in plain words',
      example: '(Urban parks) "Each additional hectare of park area was associated with a 0.12 °C lower surface temperature within 500 m (95% CI 0.08–0.16)."' },
    { key: 'conclusion', node: 'conclusion', field: 'discussion', label: 'Conclusion', section: 'Discussion and conclusion',
      look: ['Opens by answering the research question', 'Every claim matches a reported result', 'Associations are not written as causes', 'Findings are compared with earlier studies', 'Limitations and their effect on the conclusions are stated', 'The conclusion states where it applies'],
      pattern: 'Answer → compare with literature → explain → limitations → implications and scope',
      example: '(Urban parks) "Larger, tree-dominated parks were associated with cooler surroundings, consistent with temperate-city studies [refs]. Because we used daytime images only, night-time cooling remains unknown."' },
  ];

  const ACTION_VERBS = /\b(estimate|compare|test|examine|assess|determine|evaluate|investigate|identify|explore|quantify|describe|explain|measure)\b/i;
  const STATS = /\bp\s*[<=>]|\bci\b|confidence interval|\bβ|\bb\s*=|\bor\s*=|\brr\s*=|\bd\s*=|\br\s*=|\bf\s*\(|\bt\s*\(|χ2|chi-square|odds ratio|%|\d+\.\d+/i;
  const INTERPRET = /\b(suggest\w*|indicat\w*|implies|imply|because|due to|this means|may reflect|likely|probably|demonstrat\w*)\b/i;

  function sectionCheck(tab, text, o) {
    o = o || {};
    const t = TABS.find((x) => x.key === tab);
    const notes = [];
    const add = (level, title, why, how) => notes.push({ level, title, why, how });
    const node = String(o[t.node] || '');
    if (!String(text || '').trim()) {
      return [{ level: 'tip', title: `Paste your ${t.section}`, why: `This tab checks that section against the ${t.label.toLowerCase()} in your argument thread.`, how: 'Paste the paragraphs, then read the notes and the guide below.' }];
    }
    if (!node.trim()) add('issue', `The ${t.label.toLowerCase()} in your argument thread is empty`, 'There is nothing to check this section against.', 'Fill in that node of the argument thread first.');
    else if (T.coverage(node, text) < 0.4) add('issue', `This section drifts from your ${t.label.toLowerCase()}`, `Fewer than half of the key concepts in your argument thread’s ${t.label.toLowerCase()} appear here.`, 'Use the same key terms in both places, or update the argument thread if your thinking has changed.');

    if (tab === 'question') {
      if (!/[?？]|\b(whether|to what extent|asks|ask|question)\b/i.test(text)) add('issue', 'No explicit question in this section', 'Readers should not have to infer what the study answers.', 'Add one sentence that states the question, such as "This study asks whether …".');
      if ((text.match(/[?？]/g) || []).length > 3) add('tip', 'Many questions in the introduction', 'Rhetorical questions dilute the one you will answer.', 'Keep only the questions your study answers, and state them once.');
    }
    if (tab === 'gap') {
      const cites = S.discover ? S.discover.citationsIn(text).length + (String(text).match(/\[\d+(?:[,–-]\s*\d+)*\]/g) || []).length : 0;
      if (cites < 2) add('issue', 'The gap rests on few or no citations', 'A gap is only convincing when the reader sees what has already been done.', 'Cite the key studies for each claim about what is known.');
      if (!/\bfew\b|little|lack|no stud|not yet|rarely|unclear|limited|remain|unknown|unexplored|gap|however/i.test(text)) add('issue', 'The missing piece is not named', 'Without a clear "but", the review reads as a summary.', 'State what is missing with a contrast: "However, few studies have …".');
      if (!/\b(important|matters|because|crucial|need|risk|implication|consequen)/i.test(text)) add('tip', 'Why the gap matters is not said', 'Reviewers ask "so what?".', 'Add one sentence on the cost of not knowing: for theory, practice or policy.');
    }
    if (tab === 'aim') {
      if (!ACTION_VERBS.test(text)) add('issue', 'No action verb in the aims', 'Aims phrased as topics ("the relationship between…") are hard to check against results.', 'Start each aim with a verb such as estimate, compare or test.');
      const qs = splitQuestions(o.question).length;
      const aims = (String(text).match(/\(\d\)|\b(first|second|third)\b|;\s|\band (to )?(compare|test|estimate|examine)/gi) || []).length + 1;
      if (qs > 1 && aims < qs) add('tip', `${qs} questions but fewer separate aims`, 'Each question should have its own aim.', 'Number the aims so each one maps to a question.');
    }
    if (tab === 'method') {
      splitQuestions(o.question).forEach((q, i) => {
        if (T.coverage(q, text) < 0.35) add('issue', `Research question ${i + 1} is not covered by the method`, `Key concepts from "${q}" are not measured or analysed here.`, 'Name the measure and the analysis for each concept in this question.');
      });
      if (!/\b\d{2,}\b/.test(text)) add('tip', 'No sample size is given', 'Readers need the number of participants or samples.', 'Report how many, how they were selected, and why that number.');
      if (!/ethic|irb|consent|approval/i.test(text) && !/lab|cell|simulation|satellite|corpus/i.test(text)) add('tip', 'Ethics approval is not mentioned', 'Journals require it for research with people.', 'Name the committee and approval number, and how consent was obtained.');
      if (!/regress|anova|t-test|model|test|analys|coded|thematic|meta-analy/i.test(text)) add('issue', 'The analysis is not described', 'Readers cannot judge the results without knowing how they were produced.', 'State the main test or model for each question and the software used.');
    }
    if (tab === 'result') {
      splitQuestions(o.question).forEach((q, i) => {
        if (T.coverage(q, text) < 0.3) add('issue', `No result for research question ${i + 1}`, `The results barely mention "${q}".`, 'Report the result for this question, in the same order as the questions.');
      });
      if (!STATS.test(text)) add('tip', 'No estimates or statistics reported', 'Results need numbers readers can judge.', 'Report effect sizes with uncertainty (estimate and 95% CI) alongside any p values.');
      if (/\bp\s*[<=]/i.test(text) && !/\bci\b|confidence interval|±|\[\s*\d/i.test(text)) add('tip', 'p values without effect sizes or intervals', 'A p value says little about how large or precise an effect is.', 'Add the estimate and its 95% confidence interval.');
      const interp = T.sentences(text).filter((x) => INTERPRET.test(x));
      if (interp.length) add('tip', `${interp.length} ${interp.length === 1 ? 'sentence interprets' : 'sentences interpret'} the results`, 'Interpretation belongs in the discussion; mixing it in makes results harder to check.', 'Move explanations ("suggests", "because", "this means") to the discussion.');
    }
    if (!notes.length) notes.push({ level: 'ok', title: 'No problems found by the rules', why: 'Rule checks only catch surface problems.', how: 'Ask the AI for a closer review with examples from published papers.' });
    return notes;
  }

  S.consistency = { check, splitQuestions, TABS, sectionCheck };
})(typeof window !== 'undefined' ? window : globalThis);
