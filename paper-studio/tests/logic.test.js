// Run: node --test paper-studio/tests/*.test.js
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
for (const f of ['text', 'outline', 'matrix', 'consistency', 'review', 'cite', 'checklist', 'sample']) {
  require(path.join(__dirname, '..', 'js', f + '.js'));
}
const S = globalThis.Sigao;

test('Chinese input is still supported: terms are cut at function characters', () => {
  const t = S.text.terms('社交媒体使用会损害学业成绩');
  assert.ok(t.has('损害') && t.has('学业') && t.has('成绩'));
  assert.ok(!t.has('用会') && !t.has('会损'));
});

test('English terms share a stem across word forms', () => {
  const t = S.text.terms('students scrolling interaction');
  assert.ok(S.text.terms('student scroll interact').size === t.size && [...t].every((x) => S.text.terms('student scrolls interacting').has(x)));
});

test('outline flags causal conclusion on survey data and a missing field', () => {
  const p = S.sample.create();
  const titles = S.outline.check(p.outline).map((n) => n.title);
  assert.ok(titles.includes('A causal conclusion from cross-sectional data'));
  const blank = S.outline.check(Object.assign({}, p.outline, { gap: '' }));
  assert.ok(blank.some((n) => n.field === 'gap' && n.level === 'issue'));
});

test('matrix finds the repeated limitations as gap clues', () => {
  const notes = S.matrix.analyze(S.sample.create().matrix, 2026);
  const rep = notes.find((n) => n.title.startsWith('The same limitations'));
  assert.ok(rep && rep.why.includes('self-report'));
  assert.ok(notes.some((n) => n.title.includes('cross-sectional design')));
});

test('consistency flags unsupported, overclaiming and causal sentences, and missing limitations', () => {
  const p = S.sample.create();
  const r = S.consistency.check({ question: p.outline.question, method: p.outline.method, ...p.check });
  const flagged = r.flagged.map((f) => f.sentence);
  assert.ok(flagged.some((s) => s.includes('academic performance')));
  assert.ok(flagged.some((s) => s.includes('completely solve')));
  assert.ok(!flagged.some((s) => s.includes('Levenson')), 'sentences comparing with literature are skipped');
  assert.ok(r.notes.some((n) => n.title === 'The discussion has no limitations'));
  const withLimits = S.consistency.check({ ...p.check, discussion: p.check.discussion + ' A limitation is the cross-sectional design.' });
  assert.ok(!withLimits.notes.some((n) => n.title === 'The discussion has no limitations'));
});

test('review comments split by reviewer and number, with priority and vagueness', () => {
  const tasks = S.review.split(S.sample.create().review.input);
  assert.strictEqual(tasks.length, 6);
  assert.deepStrictEqual([...new Set(tasks.map((t) => t.reviewer))], ['Reviewer 1', 'Reviewer 2']);
  assert.strictEqual(tasks[0].priority, 'Must fix');
  assert.strictEqual(tasks[2].vague, true);
  assert.strictEqual(tasks[3].category, 'Language & format');
  const para = S.review.split('The discussion needs work. The methods do not justify the sample size.');
  assert.strictEqual(para.length, 2);
  const sections = S.review.split('Major comments\n1. Add a robustness analysis.\nMinor comments\n1. Shorten the title.');
  assert.deepStrictEqual(sections.map((t) => t.priority), ['Must fix', 'Suggested']);
  assert.strictEqual(S.review.split('1. 方法部分没有说明问卷的信度。')[0].category, 'Methods');
});

test('citation parse finds DOI and year', () => {
  const [a, b] = S.cite.parse('Woods, H. C. (2018). Title. https://doi.org/10.1016/j.adolescence.2016.05.008.\nHale, L. (2015). Screen time and sleep.');
  assert.strictEqual(a.doi, '10.1016/j.adolescence.2016.05.008');
  assert.strictEqual(a.year, 2018);
  assert.strictEqual(b.doi, '');
});

function fakeFetch(map) {
  return async (url) => {
    const key = Object.keys(map).find((k) => url.includes(k));
    if (!key) return { ok: false, status: 404 };
    return { ok: true, status: 200, json: async () => map[key] };
  };
}

const WOODS = { DOI: '10.1016/j.adolescence.2016.05.008', title: ['#Sleepyteens: Social media use in adolescence is associated with poor sleep quality, anxiety, depression and low self‐esteem'],
  'container-title': ['Journal of Adolescence'], volume: '51', issue: '1', page: '41-49', issued: { 'date-parts': [[2016, 8]] },
  author: [{ family: 'Woods', given: 'Heather Cleland' }, { family: 'Scott', given: 'Holly' }] };

test('verify reports a year mismatch against the Crossref record', async () => {
  const entry = S.cite.parse(S.sample.create().refs.input)[1];
  const r = await S.cite.verify(entry, fakeFetch({ 'adolescence.2016.05.008': { message: WOODS } }));
  assert.strictEqual(r.status, 'mismatch');
  assert.deepStrictEqual(r.issues, ['Year given as 2018; the record says 2016']);
});

test('verify by title rejects a poor match and reports network failure', async () => {
  const entry = S.cite.parse(S.sample.create().refs.input)[3];
  const r = await S.cite.verify(entry, fakeFetch({ 'query.bibliographic': { message: { items: [WOODS] } } }));
  assert.strictEqual(r.status, 'notfound');
  const down = await S.cite.verify(entry, async () => { throw new TypeError('Failed to fetch'); });
  assert.strictEqual(down.status, 'error');
});

test('APA, Vancouver and Chicago formatting from a verified record', () => {
  const rec = S.cite.fromCrossref(WOODS);
  assert.strictEqual(S.cite.format(rec, 'apa'),
    'Woods, H. C., & Scott, H. (2016). #Sleepyteens: Social media use in adolescence is associated with poor sleep quality, anxiety, depression and low self‐esteem. Journal of Adolescence, 51(1), 41–49. https://doi.org/10.1016/j.adolescence.2016.05.008');
  assert.ok(S.cite.format(rec, 'vancouver').startsWith('Woods HC, Scott H. #Sleepyteens'));
  assert.ok(S.cite.format(rec, 'vancouver').endsWith('Journal of Adolescence. 2016;51(1):41-49. doi:10.1016/j.adolescence.2016.05.008'));
  assert.ok(S.cite.format(rec, 'chicago').startsWith('Woods, Heather Cleland, and Holly Scott. 2016. "#Sleepyteens'));
  assert.ok(S.cite.format(rec, 'chicago').includes('Journal of Adolescence 51 (1): 41–49.'));
});

test('checklist ids are unique', () => {
  const ids = S.checklist.ALL.map((i) => i.id);
  assert.strictEqual(new Set(ids).size, ids.length);
});

test('a corrected outline passes all outline rules', () => {
  const o = S.sample.create().outline;
  const fixed = Object.assign({}, o, {
    method: o.method + ' Bedtime social media use was self-reported as minutes of passive scrolling and active interaction.',
    conclusion: 'Among the university students studied, longer bedtime social media use was associated with poorer sleep quality, particularly for passive scrolling.',
  });
  assert.deepStrictEqual(S.outline.check(fixed).map((n) => n.level), ['ok']);
});

test('each consistency tab checks its own section against the argument thread', () => {
  require(path.join(__dirname, '..', 'js', 'discover.js'));
  const p = S.sample.create();
  const t = (k, f) => S.consistency.sectionCheck(k, p.check[f], p.outline).map((n) => n.title);
  assert.ok(t('question', 'question').includes('No explicit question in this section'));
  assert.ok(t('gap', 'gap').includes('The missing piece is not named'));
  assert.ok(t('aim', 'aim').includes('No action verb in the aims'));
  assert.ok(t('method', 'method').includes('No sample size is given'));
  assert.ok(t('result', 'results').some((x) => x.startsWith('p values without')));
  assert.strictEqual(S.consistency.TABS.length, 6);
  const good = S.consistency.sectionCheck('gap', 'Earlier work linked screen time to poorer sleep (Hale & Guan, 2015; Woods & Scott, 2016). However, few studies distinguish passive from active social media use among university students, which matters because interventions target specific behaviours.', p.outline);
  assert.deepStrictEqual(good.map((n) => n.level), ['ok']);
});
