// Run: node --test paper-studio/tests/*.test.js
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
for (const f of ['text', 'outline', 'matrix', 'consistency', 'review', 'cite', 'checklist', 'sample']) {
  require(path.join(__dirname, '..', 'js', f + '.js'));
}
const S = globalThis.Sigao;

test('Chinese terms are cut at function characters', () => {
  const t = S.text.terms('社交媒体使用会损害学业成绩');
  assert.ok(t.has('损害') && t.has('学业') && t.has('成绩'));
  assert.ok(!t.has('用会') && !t.has('会损'));
});

test('outline flags causal conclusion on survey data and a missing field', () => {
  const p = S.sample.create();
  const titles = S.outline.check(p.outline).map((n) => n.title);
  assert.ok(titles.includes('横断面数据写出了因果结论'));
  const blank = S.outline.check(Object.assign({}, p.outline, { gap: '' }));
  assert.ok(blank.some((n) => n.field === 'gap' && n.level === 'issue'));
});

test('matrix finds the repeated limitations as gap clues', () => {
  const notes = S.matrix.analyze(S.sample.create().matrix, 2026);
  const rep = notes.find((n) => n.title.startsWith('同样的局限'));
  assert.ok(rep && rep.why.includes('自我报告'));
  assert.ok(notes.some((n) => n.title.includes('横断面设计')));
});

test('consistency flags unsupported, overclaiming and causal sentences, and missing limitations', () => {
  const p = S.sample.create();
  const r = S.consistency.check({ question: p.outline.question, method: p.outline.method, ...p.check });
  const flagged = r.flagged.map((f) => f.sentence);
  assert.ok(flagged.some((s) => s.includes('学业成绩')));
  assert.ok(flagged.some((s) => s.includes('彻底')));
  assert.ok(!flagged.some((s) => s.includes('Levenson')), 'sentences comparing with literature are skipped');
  assert.ok(r.notes.some((n) => n.title === '讨论里没有局限性'));
  const withLimits = S.consistency.check({ ...p.check, discussion: p.check.discussion + '本研究的局限在于横断面设计。' });
  assert.ok(!withLimits.notes.some((n) => n.title === '讨论里没有局限性'));
});

test('review comments split by reviewer and number, with priority and vagueness', () => {
  const tasks = S.review.split(S.sample.create().review.input);
  assert.strictEqual(tasks.length, 6);
  assert.deepStrictEqual([...new Set(tasks.map((t) => t.reviewer))], ['审稿人 1', '审稿人 2']);
  assert.strictEqual(tasks[0].priority, '必改');
  assert.strictEqual(tasks[2].vague, true);
  assert.strictEqual(tasks[3].category, '数据与结果');
  const para = S.review.split('讨论需要加强。方法部分没有说明样本量的计算依据。');
  assert.strictEqual(para.length, 2);
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
  assert.deepStrictEqual(r.issues, ['年份写的是 2018，数据库记录是 2016']);
});

test('verify by title rejects a poor match and reports network failure', async () => {
  const entry = S.cite.parse(S.sample.create().refs.input)[3];
  const r = await S.cite.verify(entry, fakeFetch({ 'query.bibliographic': { message: { items: [WOODS] } } }));
  assert.strictEqual(r.status, 'notfound');
  const down = await S.cite.verify(entry, async () => { throw new TypeError('Failed to fetch'); });
  assert.strictEqual(down.status, 'error');
});

test('APA and GB/T formatting from a verified record', () => {
  const rec = S.cite.fromCrossref(WOODS);
  assert.strictEqual(S.cite.format(rec, 'apa'),
    'Woods, H. C., & Scott, H. (2016). #Sleepyteens: Social media use in adolescence is associated with poor sleep quality, anxiety, depression and low self‐esteem. Journal of Adolescence, 51(1), 41–49. https://doi.org/10.1016/j.adolescence.2016.05.008');
  assert.ok(S.cite.format(rec, 'gbt').startsWith('WOODS H C, SCOTT H. #Sleepyteens'));
  assert.ok(S.cite.format(rec, 'gbt').includes('[J]. Journal of Adolescence, 2016, 51(1): 41-49.'));
});

test('checklist ids are unique', () => {
  const ids = S.checklist.ALL.map((i) => i.id);
  assert.strictEqual(new Set(ids).size, ids.length);
});
