// Run: node --test paper-studio/tests/*.test.js
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
for (const f of ['text', 'matrix', 'discover']) require(path.join(__dirname, '..', 'js', f + '.js'));
const D = globalThis.Sigao.discover;

const WORK = { id: 'https://openalex.org/W1', doi: 'https://doi.org/10.1/abc', title: 'Sleep <i>and</i> phones', publication_year: 2025, type: 'review',
  authorships: [{ author: { display_name: 'Ana Lima' } }, { author: { display_name: 'Ben Okafor' } }, { author: { display_name: 'C. Wu' } }],
  primary_location: { source: { display_name: 'Sleep Health' } }, cited_by_count: 12, open_access: { oa_url: 'https://x.org/pdf' },
  abstract_inverted_index: { Phones: [0], delay: [1], sleep: [2] } };

test('search URL carries topic, date range, open access and sort', () => {
  const u = D.buildUrl({ query: ' sleep phones ', years: 3, oa: true, sort: 'newest' }, new Date(2026, 9, 28));
  assert.ok(u.includes('search=sleep%20phones'));
  assert.ok(u.includes('from_publication_date:2023-10-01'));
  assert.ok(u.includes('is_oa:true') && u.includes('sort=publication_date:desc'));
  assert.ok(!D.buildUrl({ query: 'x', years: 0, sort: 'relevance' }).includes('from_publication_date'));
});

test('OpenAlex records become linked results with a rebuilt abstract', () => {
  const r = D.parse(WORK);
  assert.strictEqual(r.title, 'Sleep and phones');
  assert.strictEqual(r.url, 'https://doi.org/10.1/abc');
  assert.strictEqual(r.abstract, 'Phones delay sleep');
  assert.strictEqual(D.shortAuthors(r.authors), 'Ana Lima et al.');
  assert.strictEqual(D.toMatrixRow(r).source, 'Lima et al. (2025)');
  assert.ok(D.toReference(r).endsWith('Sleep Health. https://doi.org/10.1/abc'));
});

test('search falls back to the proxy when the browser is rate limited', async () => {
  const calls = [];
  const f = async (url) => { calls.push(url); return calls.length === 1 ? { status: 429, ok: false } : { status: 200, ok: true, json: async () => ({ meta: { count: 1 }, results: [WORK] }) }; };
  const r = await D.search({ query: 'sleep', years: 0, sort: 'relevance' }, { fetch: f, proxy: 'https://api.test' });
  assert.strictEqual(r.results.length, 1);
  assert.ok(calls[1].startsWith('https://api.test/api/search?url=https%3A%2F%2Fapi.openalex.org'));
});

test('next steps follow the project state', () => {
  for (const f of ['outline', 'consistency', 'review', 'cite', 'checklist', 'sample', 'ideas']) require(path.join(__dirname, '..', 'js', f + '.js'));
  const S = globalThis.Sigao;
  const steps = S.ideas.nextSteps(S.sample.create());
  assert.strictEqual(steps[0].done, false, 'example results do not count as your own search');
  assert.ok(steps.find((x) => x.href === 'outline' && x.title.startsWith('Fill in')).done);
  assert.strictEqual(S.ideas.ideasInput(S.sample.create()).limitations.length, 4);
});

test('design rules flag the sample study\'s gaps and accept a complete experiment', () => {
  require(path.join(__dirname, '..', 'js', 'design.js'));
  const S = globalThis.Sigao;
  const titles = S.design.check(S.sample.create().design).map((n) => n.title);
  assert.ok(titles.includes('The sample size is not justified'));
  assert.ok(titles.includes('Ethics approval and consent are not mentioned'));
  assert.ok(!titles.includes('Confounders are not addressed'));
  const good = S.design.check({ type: 'experiment', question: 'Does a 30-minute screen curfew improve sleep quality?',
    variables: 'Condition: curfew vs usual use (control). Outcome: PSQI, actigraphy.', sample: '120 students; power analysis (d = 0.5, alpha .05, power .80).',
    procedure: 'Randomised by computer in blocks; assessors blinded; validated PSQI; ethics approval and consent; preregistered on OSF.', analysis: 'ANCOVA; missing data by multiple imputation.' });
  assert.ok(!good.some((n) => n.level === 'issue'));
});

test('pasted links are recognised as DOI, arXiv, OpenAlex, page or title', () => {
  assert.deepStrictEqual(D.idFromLink('https://doi.org/10.1016/j.ypmed.2016.01.001'), { doi: '10.1016/j.ypmed.2016.01.001' });
  assert.deepStrictEqual(D.idFromLink('https://onlinelibrary.wiley.com/doi/full/10.1111/jsr.13000'), { doi: '10.1111/jsr.13000' });
  assert.deepStrictEqual(D.idFromLink('https://arxiv.org/abs/2401.01234v2'), { doi: '10.48550/arxiv.2401.01234' });
  assert.deepStrictEqual(D.idFromLink('https://openalex.org/W2741809807'), { openalex: 'W2741809807' });
  assert.deepStrictEqual(D.idFromLink('https://pubmed.ncbi.nlm.nih.gov/26791323/'), { page: 'https://pubmed.ncbi.nlm.nih.gov/26791323/' });
  assert.deepStrictEqual(D.idFromLink('Screen time and sleep among school-aged children'), { title: 'Screen time and sleep among school-aged children' });
});

test('lookup reads a page link through the server, then OpenAlex by DOI', async () => {
  const urls = [];
  const f = async (u) => { urls.push(u); return u.includes('/api/resolve') ? { ok: true, json: async () => ({ doi: '10.1/abc' }) } : { ok: true, status: 200, json: async () => WORK }; };
  const r = await D.lookup('https://pubmed.ncbi.nlm.nih.gov/1/', { fetch: f, proxy: 'https://api.test' });
  assert.strictEqual(r.doi, '10.1/abc');
  assert.ok(urls[1].includes('/works/doi:10.1%2Fabc'));
});
