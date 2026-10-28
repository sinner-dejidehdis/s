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
