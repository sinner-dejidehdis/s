// Argument thread: the six nodes of a paper and the rules that check them.
// Notes only diagnose and explain; examples use a different topic on purpose
// (urban parks and heat) so they show the pattern without being pasteable.
(function (root) {
  const S = root.Sigao = root.Sigao || {};
  const T = S.text;

  const FIELDS = [
    { key: 'question', label: 'Research question', hint: 'The question you set out to answer, written as a question your method can actually answer.',
      example: 'Is the size of an urban park associated with summer land-surface temperature within 500 m of it, and does this differ by vegetation type?' },
    { key: 'gap', label: 'Research gap', hint: 'What earlier work has done, what is still missing, and why that matters.',
      example: 'Earlier work has mostly measured park cooling in single cities; few studies compare vegetation structures, and dense subtropical cities remain under-studied.' },
    { key: 'aim', label: 'Aim', hint: 'What you will do, with a verb (estimate, compare, test, explain). Each aim should map to a research question.',
      example: 'To estimate the association between park size and nearby surface temperature, and to compare tree-dominated with lawn-dominated parks.' },
    { key: 'method', label: 'Method', hint: 'Where the data come from, sample size, how each key concept is measured, and how you analyse it.',
      example: 'We sampled 120 parks in three cities, derived surface temperature from summer satellite images, and used multiple regression adjusting for building density and distance to water.' },
    { key: 'result', label: 'Main result', hint: 'Only what the data show, without interpretation. If you have no data yet, write the expected result.',
      example: 'Larger parks were associated with lower nearby surface temperatures; tree-dominated parks showed more cooling than lawn-dominated parks.' },
    { key: 'conclusion', label: 'Conclusion', hint: 'Answer the research question and state where it applies. Do not go beyond what the results support.',
      example: 'In the subtropical cities studied, larger tree-dominated parks were associated with cooler surroundings; this needs testing in other climates.' },
  ];

  const QUESTION_WORDS = /[？?]|^\s*(how|what|why|whether|does|do|is|are|can|which|to what extent)\b|是否|如何|为什么|什么|哪些|多大/i;
  const LITERATURE_WORDS = /prior|previous|earlier|existing|literature|studies|research has|work has|has been|have been|已有|现有|以往|前人|文献|研究/i;
  const MISSING_WORDS = /\bfew\b|little|lack|no stud|not yet|rarely|seldom|overlook|unclear|limited|remain|gap|unexplored|unknown|under-studied|较少|很少|尚未|缺乏|缺少|空白|忽视/i;
  const CROSS_SECTIONAL = /survey|cross-sectional|correlation|questionnaire|observational|regression|问卷|横断|调查/i;
  const CAUSAL = /\b(causes?|caused|causing|leads? to|led to|results? in|drives?|impairs?|damages?|harms?)\b|导致|造成|引起/i;
  const OVERCLAIM = /\b(proves?|proved|proven|proof|definitive(ly)?|conclusively|always|never|first to|completely|entirely|undoubtedly|eliminat\w*)\b|证明|证实|首次|完全|彻底|必然|全面/i;

  function field(key) { return FIELDS.find((f) => f.key === key); }

  function check(o) {
    o = o || {};
    const notes = [];
    const add = (n) => notes.push(n);

    FIELDS.forEach((f) => {
      if (!String(o[f.key] || '').trim()) {
        add({ level: 'issue', field: f.key, title: `${f.label} is empty`,
          why: 'With a node missing, the chapters that depend on it have nothing to line up with.', how: f.hint, example: f.example });
      }
    });

    const q = String(o.question || '');
    if (q.trim()) {
      if (!QUESTION_WORDS.test(q)) {
        add({ level: 'tip', field: 'question', title: 'The research question is not phrased as a question',
          why: 'A statement tends to describe a topic, so readers cannot tell what you will actually answer.',
          how: 'Rewrite the topic as a question your data can answer, usually starting with "Is", "How" or "To what extent", and ending with a question mark.',
          example: field('question').example });
      }
      const marks = (q.match(/[？?]/g) || []).length;
      if (marks >= 3) {
        add({ level: 'tip', field: 'question', title: `There are ${marks} research questions`,
          why: 'Each question needs its own method, result and discussion; too many thin out the argument.',
          how: 'Check that every question has a matching method and result. Merge minor questions or move them to the discussion.',
          ask: 'If you could keep only one question, which would it be?' });
      }
    }

    const gap = String(o.gap || '');
    if (gap.trim()) {
      if (!LITERATURE_WORDS.test(gap)) {
        add({ level: 'issue', field: 'gap', title: 'The gap does not say what earlier work has done',
          why: 'Reviewers judge whether a gap is real by first seeing where existing research stops.',
          how: 'Start with one sentence summarising what earlier studies did, then say what is missing. The literature matrix can give you the evidence.',
          example: field('gap').example });
      } else if (!MISSING_WORDS.test(gap)) {
        add({ level: 'tip', field: 'gap', title: 'It is not clear what is missing',
          why: 'Describing existing work alone does not tell readers which piece you will add.',
          how: 'Name the missing piece: a population, a setting, a method or a variable (for example "few studies distinguish…", "evidence from … remains limited").' });
      }
    }

    const pairs = [
      ['aim', 'question', 0.25, 'issue', 'The aim does not match the research question',
        'Key concepts in the aim do not appear in the research question, so readers may wonder which question you are answering.',
        'Map each aim to one research question, and use the same words for the same concept in both.'],
      ['method', 'question', 0.3, 'tip', 'The method does not say how every key concept is measured',
        'Readers need to see how each core variable in the research question was measured.',
        'Go through the key concepts in your research question and name the instrument or indicator for each in the method.'],
      ['result', 'question', 0.2, 'issue', 'The main result does not answer the research question',
        'The result shares few key concepts with the research question; it may be answering a different question.',
        'Write a result for each research question. For a question with no result, add the analysis or drop the question.'],
    ];
    pairs.forEach(([a, b, min, level, title, why, how]) => {
      if (String(o[a] || '').trim() && String(o[b] || '').trim() && T.coverage(o[b], o[a]) < min) {
        add({ level, field: a, title, why, how });
      }
    });

    const c = String(o.conclusion || '');
    if (c.trim()) {
      if (CAUSAL.test(c) && CROSS_SECTIONAL.test(o.method || '')) {
        add({ level: 'issue', field: 'conclusion', title: 'A causal conclusion from cross-sectional data',
          why: `Your method is a survey or cross-sectional design, which can only show an association. "${c.match(CAUSAL)[0]}" claims cause.`,
          how: 'Replace causal verbs with associational ones ("is associated with", "is linked to"), and explain in the limitations why causality cannot be inferred.',
          example: field('conclusion').example });
      }
      if (OVERCLAIM.test(c)) {
        add({ level: 'tip', field: 'conclusion', title: `Absolute wording: "${c.match(OVERCLAIM)[0]}"`,
          why: 'Absolute claims go beyond what a single study can support; reviewers usually ask for them to be removed.',
          how: 'State the sample and setting the conclusion applies to, for example "in this sample" or "our data suggest".' });
      }
      if (String(o.result || '').trim() && T.coverage(c, String(o.result) + ' ' + String(o.question)) < 0.5) {
        add({ level: 'issue', field: 'conclusion', title: 'The conclusion contains claims the results do not cover',
          why: 'Many key concepts in the conclusion appear in neither the result nor the research question; it may introduce new claims.',
          how: 'Pair each claim in the conclusion with a result. Drop claims without one, or move them to future research.',
          ask: 'Which sentence of your conclusion do your data directly support?' });
      }
    }

    if (!notes.length) {
      notes.push({ level: 'ok', title: 'All six nodes line up',
        why: 'The rule check found no obvious breaks.', how: 'Next, run the consistency check on the results and discussion of your manuscript.' });
    }
    return notes;
  }

  function filled(o) { return FIELDS.filter((f) => String((o || {})[f.key] || '').trim()).length; }

  S.outline = { FIELDS, check, filled };
})(typeof window !== 'undefined' ? window : globalThis);
