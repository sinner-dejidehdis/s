// The manuscript as a paper: its real sections (abstract to conclusion), a
// check of each section for the job it does in a paper, and a whole-paper
// check across sections. Diagnoses only; the writer revises the text.
(function (root) {
  const S = root.Sigao = root.Sigao || {};
  const T = S.text;

  const SECTIONS = [
    { key: 'abstract', label: 'Abstract', role: 'A stand-alone summary: why, what was done, what was found, what it means.',
      look: ['Background, aim, method, main result (with numbers) and conclusion are all present', 'Usually 150–300 words, or the journal’s limit', 'Every number also appears in the results', 'No citations or abbreviations that are not explained'],
      pattern: 'Background (1–2 sentences) → aim → method → main results with numbers → conclusion and implication',
      example: '(Urban parks) "Urban heat is rising… We examined whether park size predicts surface temperature. Using Landsat images of 120 parks in three cities, we found each hectare was associated with 0.12 °C lower temperature within 500 m (95% CI 0.08–0.16). Larger parks may help cool dense districts."' },
    { key: 'introduction', label: 'Introduction', role: 'Why the question matters, what is unknown, and what this study asks.',
      look: ['Moves from the broad problem to the specific gap', 'Names the gap with a clear “however” and citations', 'States the research question or aim explicitly near the end', 'Says why answering it matters'],
      pattern: 'Context → what is known (cited) → what is missing → why it matters → “This study asks / aims to …”',
      example: '(Urban parks) "…Studies in temperate cities report 1–2 °C of cooling [refs]. However, few have compared vegetation types in dense subtropical cities. This study asks whether park size and vegetation type predict surface temperature."' },
    { key: 'background', label: 'Background / Literature review', role: 'What earlier work found, organised by theme, leading to the gap.',
      look: ['Organised by themes or debates, not paper by paper', 'Each claim about earlier work is cited', 'Compares and evaluates studies, not only summarises them', 'Ends by pointing to the gap your study fills'],
      pattern: 'Theme 1 (studies agree / disagree, why) → Theme 2 → what none of them did → your study',
      example: '(Urban parks) "Two lines of work exist: remote-sensing studies of whole cities [refs] and field studies of single parks [refs]. The first lacks detail on vegetation; the second cannot generalise. Neither…"' },
    { key: 'methods', label: 'Methods', role: 'How the study was done, in enough detail to repeat it.',
      look: ['Design, setting and dates are stated', 'Sample: who or what, how many, how chosen', 'Every variable has a named measure', 'The analysis for each question is stated', 'Ethics approval and consent for research with people'],
      pattern: 'Design → participants/samples → measures → procedure → analysis → ethics',
      example: '(Urban parks) "We used 12 cloud-free Landsat 8 summer scenes (2019–2023). Park area and vegetation type came from the city land-use map. We fitted mixed models with city as a random effect."' },
    { key: 'results', label: 'Results', role: 'What was found, reported without interpretation.',
      look: ['One result per question, in the same order as the questions', 'Effects with size and uncertainty (estimate, 95% CI), not only p values', 'No explanations or speculation', 'Numbers match tables and figures'],
      pattern: 'Descriptives → result for question 1 (estimate, CI) → question 2 → secondary analyses',
      example: '(Urban parks) "Each additional hectare was associated with 0.12 °C lower surface temperature within 500 m (95% CI 0.08–0.16). Tree-dominated parks were 0.6 °C cooler than lawn-dominated parks of similar size."' },
    { key: 'analysis', label: 'Analysis', role: 'How the data were analysed, or further analyses that test the main results.',
      look: ['Each test or model is named, with the software', 'Assumptions were checked and how', 'Robustness or sensitivity analyses are reported', 'Missing data and how they were handled'],
      pattern: 'Main model → assumptions checked → sensitivity analyses → missing data',
      example: '(Urban parks) "Residuals were checked for spatial autocorrelation (Moran’s I). Results were unchanged when parks under 0.5 ha were excluded."' },
    { key: 'discussion', label: 'Discussion', role: 'What the results mean, compared with earlier work, with limitations.',
      look: ['Opens by answering the research question in plain words', 'Compares the findings with earlier studies (cited)', 'Explains possible reasons, labelled as possible', 'States limitations and how they affect the conclusions', 'No new results'],
      pattern: 'Main answer → comparison with literature → explanations → limitations → implications',
      example: '(Urban parks) "Larger parks were associated with cooler surroundings, consistent with temperate-city studies [refs]. Because we used daytime images only, night-time cooling remains unknown."' },
    { key: 'conclusion', label: 'Conclusion', role: 'The take-home message and where it applies.',
      look: ['Restates the main finding without new data or citations', 'Claims stay within the results and the design', 'Says for whom or where it applies', 'Points to the most useful next step'],
      pattern: 'Main finding → why it matters → scope → next step',
      example: '(Urban parks) "In three subtropical cities, larger and tree-dominated parks were associated with cooler surroundings. Planners could weigh park size and vegetation together; long-term ground measurements are needed."' },
  ];
  const KEYS = SECTIONS.map((x) => x.key);

  const blank = () => Object.fromEntries(KEYS.concat('references').map((k) => [k, '']));

  // Splits pasted or imported text into the sections above.
  function fromText(text) {
    const sec = S.manuscript.split(text);
    const out = blank();
    const put = (k, v) => { if (v) out[k] = out[k] ? out[k] + '\n\n' + v : v; };
    put('abstract', sec.abstract);
    put('introduction', sec.introduction);
    put('background', sec.literature);
    put('methods', sec.methods);
    put('results', sec.results);
    put('analysis', sec.analysis);
    put('discussion', sec.discussion);
    put('conclusion', sec.conclusion);
    put('references', sec.references);
    if (!Object.values(out).some(Boolean)) out.introduction = String(text || '').trim();
    return out;
  }
  const whole = (p) => KEYS.map((k) => p[k]).filter(Boolean).join('\n\n');

  const words = (t) => String(t || '').split(/\s+/).filter(Boolean).length;
  const cites = (t) => (S.discover ? S.discover.citationsIn(t).length : 0) + (String(t).match(/\[\d+(?:\s*[,–-]\s*\d+)*\]/g) || []).length;
  const STATS = /\bp\s*[<=>]|\bci\b|confidence interval|\bβ|\bb\s*=|\bor\s*=|\brr\s*=|\bd\s*=|\br\s*=|\bf\s*\(|\bt\s*\(|χ2|chi-square|odds ratio|%|\d+\.\d+/i;
  const INTERPRET = /\b(suggest\w*|indicat\w*|implies|imply|because|due to|this means|may reflect|likely|probably|demonstrat\w*)\b/i;
  const AIM = /\b(aims? (of|to)|objectives?|purpose of this|this (study|paper|article) (aims|asks|examines|investigates|tests)|we (aim|ask|examine|investigate|test|hypothesi[sz]e))\b/i;
  const QUESTION = /[?？]|\b(whether|to what extent|research question|we ask|this study asks)\b/i;
  const GAP = /\b(however|few|little|lack|no stud|not yet|rarely|unclear|limited|remains?|unknown|unexplored|gap)\b/i;
  const LIMITS = /limitation|caveat|future research|future studies|interpreted with caution|局限/i;
  const ANALYSIS = /regress|anova|t-test|chi-square|model|correlat|test\b|analys|coded|thematic|meta-analy|bayes|estimat/i;

  // Checks one section for the job it does in a paper.
  function sectionNotes(key, text, paper, outline) {
    text = String(text || '');
    paper = paper || {};
    const notes = [];
    const add = (level, title, why, how) => notes.push({ level, title, why, how });
    const s = SECTIONS.find((x) => x.key === key);
    if (!text.trim()) return [{ level: 'tip', title: `Paste your ${s.label.toLowerCase()}`, why: s.role, how: 'Paste the section, or import the whole manuscript in Full paper review.' }];
    const n = words(text);
    const sents = T.sentences(text);
    if (key === 'abstract') {
      if (n > 350) add('issue', `The abstract is long (${n} words)`, 'Most journals allow 150–300 words.', 'Keep one sentence per element (background, aim, method, result, conclusion) and check the journal’s limit.');
      if (n < 100) add('tip', `The abstract is short (${n} words)`, 'Readers decide from the abstract whether to read on.', 'Make sure aim, method, main result with numbers and conclusion are all there.');
      if (!AIM.test(text) && !QUESTION.test(text)) add('issue', 'The aim is not stated', 'Without it the reader cannot judge the results.', 'Add one sentence saying what the study set out to do.');
      if (!/\d/.test(text)) add('issue', 'No numbers in the abstract', 'The main result should be concrete.', 'Report the main estimate (with its uncertainty) or the sample size.');
      if (cites(text)) add('tip', 'Citations in the abstract', 'Most journals do not allow them.', 'Remove citations from the abstract; keep them in the introduction.');
    }
    if (key === 'introduction') {
      if (!QUESTION.test(text) && !AIM.test(text)) add('issue', 'No research question or aim is stated', 'Readers should not have to infer what the study answers.', 'Near the end of the introduction, state the question or aim in one sentence.');
      if (!GAP.test(text)) add('issue', 'The gap is not named', 'Without a clear “however”, the introduction reads as a summary.', 'Say what is missing in earlier work, with a contrast such as “However, few studies have …”.');
      if (cites(text) < 2) add('issue', 'Few or no citations', 'Claims about what is known need sources.', 'Cite the key studies for each claim about earlier work.');
      if (!/\b(important|matters|because|crucial|need|risk|implication|consequen|cost|burden)/i.test(text)) add('tip', 'Why it matters is not said', 'Reviewers ask “so what?”.', 'Add one sentence on what is at stake for theory, practice or policy.');
    }
    if (key === 'background') {
      if (cites(text) < 3) add('issue', 'Few citations for a literature review', 'A review is judged by the work it covers.', 'Cite the studies behind each claim, and the main reviews in the field.');
      const perPaper = sents.filter((x) => /^[A-Z][a-z]+ (et al\.|and [A-Z][a-z]+)?\s*\(\d{4}\)/.test(x)).length;
      if (perPaper >= 4) add('tip', 'The review goes paper by paper', `${perPaper} sentences open with an author and year.`, 'Group studies by theme or finding, and compare them: where they agree, disagree and why.');
      if (!GAP.test(text)) add('tip', 'The review does not end on a gap', 'The review should lead to why your study is needed.', 'Close by naming what earlier work has not done.');
    }
    if (key === 'methods') {
      if (!/\b\d{2,}\b/.test(text)) add('issue', 'No sample size', 'Readers need to know how many participants or samples.', 'Report how many, how they were chosen, and why that number.');
      if (!ANALYSIS.test(text) && !String(paper.analysis || '').trim()) add('issue', 'The analysis is not described', 'Results cannot be judged without knowing how they were produced.', 'Name the main test or model for each question, and the software.');
      if (!/ethic|irb|consent|approval|committee/i.test(text) && !/lab|cell|simulation|satellite|corpus|archival|secondary data/i.test(text)) add('tip', 'Ethics approval is not mentioned', 'Journals require it for research with people.', 'Name the committee and approval number, and how consent was obtained.');
      const present = (text.match(/\bwe (use|measure|collect|analy[sz]e|recruit|survey|apply|conduct)\b/gi) || []).length;
      if (present >= 2) add('tip', 'Methods in the present tense', 'Methods describe what was done, usually in the past tense.', 'Check the tense of each step; journals in some fields differ, so follow recent papers in your target journal.');
      (S.consistency ? S.consistency.splitQuestions(outline && outline.question) : []).forEach((q, i) => {
        if (T.coverage(q, text + ' ' + (paper.analysis || '')) < 0.3) add('issue', `Research question ${i + 1} has no measure`, `Key concepts from "${q}" are not measured or analysed here.`, 'Name the measure and analysis for each concept in this question.');
      });
    }
    if (key === 'results') {
      if (!STATS.test(text)) add('issue', 'No estimates or statistics', 'Results need numbers readers can judge.', 'Report effect sizes with uncertainty (estimate and 95% CI) alongside any p values.');
      if (/\bp\s*[<=]/i.test(text) && !/\bci\b|confidence interval|±|\[\s*\d/i.test(text)) add('tip', 'p values without effect sizes or intervals', 'A p value says little about how large or precise an effect is.', 'Add the estimate and its 95% confidence interval.');
      const interp = sents.filter((x) => INTERPRET.test(x)).length;
      if (interp) add('tip', `${interp} ${interp === 1 ? 'sentence interprets' : 'sentences interpret'} the results`, 'Interpretation belongs in the discussion.', 'Move explanations (“suggests”, “because”, “this means”) to the discussion.');
      (S.consistency ? S.consistency.splitQuestions(outline && outline.question) : []).forEach((q, i) => {
        if (T.coverage(q, text) < 0.3) add('issue', `No result for research question ${i + 1}`, `The results barely mention "${q}".`, 'Report the result for this question, in the same order as the questions.');
      });
    }
    if (key === 'analysis') {
      if (!ANALYSIS.test(text)) add('issue', 'No test or model is named', 'Readers need to know exactly how the data were analysed.', 'Name each test or model and the software used.');
      if (!/assumption|normal|residual|heterosced|collinear|diagnostic/i.test(text)) add('tip', 'Assumption checks are not reported', 'Reviewers ask whether the model’s assumptions hold.', 'Say which assumptions were checked and how.');
      if (!/sensitiv|robust|alternative specification|excluding|subgroup/i.test(text)) add('tip', 'No sensitivity analysis', 'Readers want to know whether results hold under other choices.', 'Report at least one robustness check, or say why none was needed.');
      if (!/missing/i.test(text)) add('tip', 'Missing data are not addressed', 'Missing data can bias results.', 'Report how much was missing and how it was handled.');
    }
    if (key === 'discussion') {
      const r = S.consistency ? S.consistency.check({ question: outline && outline.question, method: paper.methods, results: [paper.results, paper.analysis].filter(Boolean).join('\n'), discussion: text }) : { notes: [] };
      r.notes.filter((x) => x.level !== 'ok' && !/Paste your/.test(x.title)).forEach((x) => notes.push(x));
      if (cites(text) < 2) add('issue', 'The findings are not compared with earlier studies', 'Reviewers expect the discussion to place the results in the literature.', 'For each main finding, say which studies it agrees or disagrees with, and why that might be.');
      const newStats = sents.filter((x) => /\bp\s*[<=]|95% ci|\bβ\s*=|\bor\s*=/i.test(x)).length;
      if (newStats) add('tip', 'Statistics in the discussion', 'New numbers in the discussion can look like new results.', 'Report statistics in the results; in the discussion refer to them in words.');
      if (!/implication|practice|policy|suggest that|recommend|future/i.test(text)) add('tip', 'No implications', 'Readers want to know what the findings mean for practice, policy or theory.', 'Add what follows from your findings, within the limits of your design.');
    }
    if (key === 'conclusion') {
      if (n > 400) add('tip', `The conclusion is long (${n} words)`, 'A conclusion is a short take-home message.', 'Keep the main finding, its scope and the next step; move the rest to the discussion.');
      if (cites(text)) add('tip', 'Citations in the conclusion', 'New sources in the conclusion distract from your message.', 'Keep comparisons with other work in the discussion.');
      if (/\b(prove[sd]?|definitive(ly)?|conclusively|always|never|completely)\b/i.test(text)) add('issue', 'Absolute claims', 'One study rarely proves anything.', 'Say what your data show, in which sample and under which conditions.');
      if (S.consistency && /\b(causes?|leads? to|results? in|damages?|improves?)\b/i.test(text) && /survey|cross-sectional|correlat|regression|observational/i.test([paper.methods, paper.analysis].join(' '))) add('issue', 'Causal conclusion from correlational data', 'The design shows association, not cause.', 'Use associational wording and name the design limitation.');
    }
    if (!notes.length) notes.push({ level: 'ok', title: 'No problems found by the rules', why: 'Rule checks only catch surface problems.', how: 'Ask the AI for a closer review, and read it once as a reviewer would.' });
    return notes;
  }

  // Numbers that identify a result or a sample: decimals, percentages, and integers of 2+ digits (not years).
  function keyNumbers(t) {
    return [...new Set((String(t).match(/\b\d+(?:\.\d+)?%?/g) || []).filter((x) => /\.|%/.test(x) || (x.length >= 2 && !/^(19|20)\d{2}$/.test(x))))];
  }
  function sampleSizes(t) {
    const out = [];
    const re = /\b(?:n\s*=\s*(\d[\d,]*)|(\d[\d,]{1,})\s+(participants|students|patients|respondents|adults|children|subjects|individuals|people|women|men|households|schools|undergraduates|cases))/gi;
    let m;
    while ((m = re.exec(String(t)))) out.push(Number((m[1] || m[2]).replace(/,/g, '')));
    return out;
  }

  // Whole-paper check: structure and consistency across sections.
  function review(paper, outline) {
    const p = Object.assign(blank(), paper || {});
    const notes = [];
    const add = (level, title, why, how, where) => notes.push({ level, title, why, how, where });
    const present = KEYS.filter((k) => p[k].trim());
    const body = whole(p);
    if (!present.length) return { notes: [{ level: 'tip', title: 'Paste or import your manuscript', why: 'The whole-paper review needs your sections.', how: 'Import a .docx or .pdf, or paste the full text with its headings.' }], sections: {}, present, words: 0 };

    // 1. Structure
    const missing = ['abstract', 'introduction', 'methods', 'results', 'discussion'].filter((k) => !p[k].trim());
    if (missing.length) add('issue', `Missing: ${missing.map((k) => SECTIONS.find((x) => x.key === k).label).join(', ')}`, 'Most journals expect Abstract, Introduction, Methods, Results and Discussion (IMRaD).', 'Add the missing sections, or check that their headings are standard so they are recognised.', 'structure');
    if (!p.conclusion.trim() && !/in conclusion|to conclude|conclusions?:/i.test(p.discussion)) add('tip', 'No conclusion', 'Readers look for a short take-home message.', 'End the discussion with a concluding paragraph, or add a Conclusion section if the journal uses one.', 'structure');
    if (!p.references.trim()) add('tip', 'No reference list found', 'The citations in the text cannot be checked without it.', 'Include the References section when you paste or import.', 'structure');

    // 2. Proportions
    const total = words(body);
    const share = (k) => words(p[k]) / Math.max(total, 1);
    if (p.results.trim() && p.discussion.trim() && words(p.discussion) < 0.5 * words(p.results)) add('tip', 'The discussion is short compared with the results', `Discussion ${words(p.discussion)} words, results ${words(p.results)} words.`, 'Make sure each main result is interpreted, compared with earlier studies and qualified by limitations.', 'discussion');
    if (share('introduction') + share('background') > 0.4 && total > 1500) add('tip', 'The introduction and background take up much of the paper', `${Math.round((share('introduction') + share('background')) * 100)}% of the words.`, 'Keep the background to what the reader needs to understand the gap and the question.', 'introduction');

    // 3. Abstract against the body
    if (p.abstract.trim()) {
      const rest = [p.methods, p.results, p.analysis, p.discussion].join(' ');
      const orphan = keyNumbers(p.abstract).filter((x) => !rest.includes(x.replace(/%$/, '')));
      if (orphan.length) add('issue', `${orphan.length} ${orphan.length === 1 ? 'number' : 'numbers'} in the abstract ${orphan.length === 1 ? 'does' : 'do'} not appear in the body`, `Not found in methods, results or discussion: ${orphan.slice(0, 6).join(', ')}.`, 'Every number in the abstract should match one reported in the paper. Check for rounding or outdated values.', 'abstract');
      if (p.results.trim() && T.coverage(p.abstract, p.results + ' ' + p.methods) < 0.25) add('tip', 'The abstract and the results use different terms', 'Readers match the abstract to the paper by its key terms.', 'Use the same names for variables, groups and outcomes in both.', 'abstract');
    }

    // 4. Sample size consistency
    const sizes = [...new Set(KEYS.flatMap((k) => sampleSizes(p[k]).map((n) => n)))];
    if (sizes.length > 1) add('issue', 'Different sample sizes are reported', `Found: ${sizes.join(', ')}.`, 'If the numbers differ for a reason (exclusions, missing data, subgroups), say so where each appears; otherwise correct them.', 'methods');

    // 5. Aim to conclusion
    const intro = p.introduction + ' ' + p.background;
    const aimSent = T.sentences(intro).filter((x) => AIM.test(x) || QUESTION.test(x));
    const ending = p.conclusion || p.discussion;
    if (aimSent.length && ending.trim() && T.coverage(aimSent.join(' '), ending) < 0.3) add('issue', 'The conclusion does not answer the stated aim', 'Few of the key terms of your aim or question appear in the conclusion.', 'Open the conclusion (or the first paragraph of the discussion) by answering the aim in its own terms.', 'conclusion');
    if (!aimSent.length && intro.trim()) add('issue', 'No aim or question in the introduction', 'Every later section is judged against it.', 'State the aim or research question near the end of the introduction.', 'introduction');

    // 6. Citations against the reference list
    if (S.cite && S.cite.crossCheck && p.references.trim()) {
      const x = S.cite.crossCheck(body, p.references);
      if (x.missing.length) add('issue', `${x.missing.length} ${x.missing.length === 1 ? 'citation is' : 'citations are'} missing from the reference list`, x.missing.slice(0, 6).map((c) => c.text).join('; '), 'Add a full entry for each, or correct the author or year in the text.', 'references');
      if (x.uncited.length && (x.mode === 'numeric' || x.cited)) add('tip', `${x.uncited.length} ${x.uncited.length === 1 ? 'reference is' : 'references are'} never cited`, x.uncited.slice(0, 3).map((e) => e.raw.slice(0, 80)).join(' · '), 'Cite each one where it supports a claim, or remove it.', 'references');
    }

    // 7. Wording across the paper
    if (S.language) {
      const lang = S.language.notes(body).filter((x) => x.level === 'issue');
      lang.forEach((x) => add('tip', `Whole paper · ${x.title}`, x.why, x.how + ' Open Language check to see each sentence.', 'language'));
    }

    const sections = {};
    KEYS.forEach((k) => { if (p[k].trim()) sections[k] = sectionNotes(k, p[k], p, outline).filter((x) => x.level !== 'ok'); });
    return { notes, sections, present, words: total };
  }

  S.paper = { SECTIONS, KEYS, blank, fromText, whole, sectionNotes, review, keyNumbers, sampleSizes };
})(typeof window !== 'undefined' ? window : globalThis);
