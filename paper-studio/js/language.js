// Language check: flags wording reviewers object to and explains how to
// revise it, with examples from other topics. It never rewrites the
// writer's sentence.
(function (root) {
  const S = root.Sigao = root.Sigao || {};

  const RULES = [
    { kind: 'overclaim', label: 'Overclaiming', re: /\b(prove[sd]?|proof|clearly|obvious(ly)?|undoubtedly|certainly|definitely|always|never|completely|all (students|people|participants|patients)|no one|everyone|revolutionar\w*|groundbreaking|for the first time)\b/gi,
      why: 'Absolute words claim more than one study can show; reviewers read them as overstatement.',
      how: 'Match the strength of the word to your evidence: say what your data show, for whom, and with what uncertainty.',
      example: '(Urban parks) Instead of "parks always cool cities", a calibrated version reads "in the three cities studied, larger parks were associated with lower surface temperatures".' },
    { kind: 'causal', label: 'Causal wording', re: /\b(causes?|caused|leads? to|led to|results? in|resulted in|due to|because of|effects? of|impacts? on|damages?|drives?|determines?)\b/gi,
      why: 'Causal verbs need a design that supports causation (randomisation, a natural experiment, strong longitudinal controls).',
      how: 'If your design is correlational, use associational verbs (is associated with, predicts, co-occurs with) and name the limitation.',
      example: '(Soil microbes) "Fungal diversity was associated with higher yield" rather than "fungal diversity increased yield", for a cross-sectional survey.' },
    { kind: 'vague', label: 'Vague wording', re: /\b(very|really|quite|a lot( of)?|lots of|things?|stuff|various|several|significant(ly)?|huge|big|nowadays|in recent years|etc\.?)\b/gi,
      why: 'Vague quantities and intensifiers leave the reader guessing; "significant" is also read as statistical significance.',
      how: 'Replace with a number, a range or a named example; keep "significant" for statistical tests and report the statistic.',
      example: '(Urban parks) "Many parks were cooler" becomes clearer as "84 of the 120 parks were cooler than their surroundings".' },
    { kind: 'informal', label: 'Informal register', re: /\b(don't|doesn't|can't|won't|isn't|aren't|it's|we've|got|gets?|kind of|sort of|pretty|a bit|okay|basically|actually|totally|tons? of)\b/gi,
      why: 'Contractions and conversational words read as informal in most journals.',
      how: 'Use full forms and precise academic verbs; check whether the word adds meaning at all.',
      example: '(Soil microbes) "It\'s pretty clear that tillage gets rid of fungi" reads as academic when the claim, the evidence and the verb are all precise.' },
    { kind: 'filler', label: 'Wordy phrase', re: /\b(in order to|due to the fact that|it is (important|interesting|worth noting) (to note )?that|the fact that|a (large|great) number of|in the event that|at this point in time|has the ability to|is able to|it should be noted that|plays an important role)\b/gi,
      why: 'Filler phrases add words without adding meaning and hide the main claim.',
      how: 'Cut the phrase or replace it with one precise word, then check the sentence still says what you mean.',
      example: '(Urban parks) "It is important to note that park size plays an important role in cooling" becomes sharper when it states the role: what changes, and by how much.' },
    { kind: 'hedge', label: 'Stacked hedges', re: /\b(may possibly|might perhaps|could potentially|may potentially|seems? to suggest|appears? to indicate|might possibly)\b/gi,
      why: 'Two hedges in a row make the claim sound unsure of itself.',
      how: 'Use one hedge that matches your evidence, and say where the uncertainty comes from.',
      example: '(Soil microbes) "The data may suggest" is enough; "may possibly suggest" weakens it twice.' },
    { kind: 'person', label: 'Mixed voice', re: /\b(I|me|my)\b/g,
      why: 'Many fields use "we" even for single authors; "I" is common in the humanities but check the journal.',
      how: 'Check the target journal\'s recent papers and use one convention throughout.',
      example: '' },
  ];

  function sentences(text) {
    return String(text || '').replace(/\s+/g, ' ').split(/(?<=[.!?])\s+(?=[A-Z("“])/).map((s) => s.trim()).filter(Boolean);
  }

  let memo = { text: null, result: null };
  function check(text) {
    if (memo.text === text) return memo.result;
    memo = { text, result: checkFresh(text) };
    return memo.result;
  }

  function checkFresh(text) {
    const sents = sentences(text);
    const hits = [];
    sents.forEach((s, i) => {
      RULES.forEach((r) => {
        const words = [...new Set((s.match(r.re) || []).map((w) => w.toLowerCase()))];
        if (words.length) hits.push({ i, kind: r.kind, label: r.label, words });
      });
      const n = s.split(/\s+/).length;
      if (n > 40) hits.push({ i, kind: 'long', label: 'Long sentence', words: [`${n} words`] });
      if ((s.match(/\b(was|were|is|are|been|being|be)\s+\w+ed\b/g) || []).length >= 2) hits.push({ i, kind: 'passive', label: 'Heavy passive', words: ['passive voice ×' + (s.match(/\b(was|were|is|are|been|being|be)\s+\w+ed\b/g) || []).length] });
    });
    return { sentences: sents, hits };
  }

  const EXTRA = {
    long: { why: 'Sentences over about 40 words are hard to follow; readers lose the subject before the verb.', how: 'Find the main claim, give it its own sentence, and move qualifications into a second sentence.',
      example: '(Urban parks) One sentence for the finding ("Larger parks were cooler"), a second for the condition ("The effect was strongest at night").' },
    passive: { why: 'Several passives in one sentence hide who did what, which matters most in methods and results.', how: 'Name the actor where it matters ("we measured…"), and keep passive only where the actor is unimportant.',
      example: '(Soil microbes) "Samples were collected and were analysed" is clearer as "We collected samples and analysed them by qPCR".' },
  };

  function notes(text) {
    const r = check(text);
    const by = {};
    r.hits.forEach((h) => { (by[h.kind] = by[h.kind] || []).push(h); });
    return Object.entries(by).map(([kind, hs]) => {
      const rule = RULES.find((x) => x.kind === kind) || EXTRA[kind];
      const words = [...new Set(hs.flatMap((h) => h.words))].slice(0, 8);
      return { level: ['overclaim', 'causal'].includes(kind) ? 'issue' : 'tip', title: `${hs[0].label}: ${hs.length} ${hs.length === 1 ? 'sentence' : 'sentences'}`,
        why: rule.why + (words.length ? ` Found: ${words.map((w) => `“${w}”`).join(', ')}.` : ''), how: rule.how, example: rule.example, sentences: [...new Set(hs.map((h) => h.i))] };
    }).sort((a, b) => (a.level === 'issue' ? -1 : 0) - (b.level === 'issue' ? -1 : 0));
  }

  S.language = { RULES, sentences, check, notes };
})(typeof window !== 'undefined' ? window : globalThis);
