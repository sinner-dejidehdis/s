// Run: node --test paper-studio/tests/*.test.*
import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
const src = fs.readFileSync(new URL('../worker/worker.js', import.meta.url), 'utf8');
const mod = await import('data:text/javascript,' + encodeURIComponent(src));
const worker = mod.default;

function call(body, reply, env = { GROQ_API_KEY: 'k' }) {
  globalThis.fetch = async () => reply;
  return worker.fetch(new Request('https://x.dev/api/feedback', { method: 'POST', body: JSON.stringify(body) }), env);
}
const groq = (notes) => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ notes }) } }] }));

test('notes that copy the user\'s wording are dropped', async () => {
  const user = 'Social media use causes insomnia in university students so universities should restrict night time internet access';
  const res = await call({ task: 'outline', input: { conclusion: user } }, groq([
    { level: 'issue', title: 'Causal claim', how: 'Use associational wording.' },
    { level: 'tip', title: 'Rewrite', how: 'Write: social media use causes insomnia in university students so universities should consider it' },
  ]));
  const data = await res.json();
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(data.notes.map((n) => n.title), ['Causal claim']);
  assert.strictEqual(data.blocked, 1);
});

test('rejects unknown tasks, missing key and quota errors cleanly', async () => {
  assert.strictEqual((await call({ task: 'write', input: {} }, groq([]))).status, 400);
  assert.strictEqual((await call({ task: 'outline', input: {} }, groq([]), {})).status, 500);
  assert.strictEqual((await call({ task: 'outline', input: {} }, new Response('', { status: 429 }))).status, 429);
});

test('matrix and review tasks are accepted', async () => {
  const ok = groq([{ level: 'gap', title: 'Shared limitation' }]);
  assert.strictEqual((await call({ task: 'matrix', input: { rows: [{ source: 'A (2020)', limitation: 'self-report' }] } }, ok)).status, 200);
  assert.strictEqual((await call({ task: 'review', input: { comments: '1. Strengthen the discussion.' } }, groq([]))).status, 200);
});

test('survey notes must cite papers that were sent', async () => {
  const res = await call({ task: 'survey', input: { query: 'sleep', papers: [{ title: 'A' }, { title: 'B' }] } }, groq([
    { level: 'tip', title: 'Theme one', why: 'x', refs: [1, 2] },
    { level: 'tip', title: 'Invented', why: 'y', refs: [7] },
    { level: 'gap', title: 'No refs', why: 'z' },
  ]));
  const data = await res.json();
  assert.deepStrictEqual(data.notes.map((n) => [n.title, n.refs]), [['Theme one', [1, 2]]]);
});

test('search relay only forwards OpenAlex work searches', async () => {
  const env = { GROQ_API_KEY: 'k', OPENALEX_API_KEY: 'oa' };
  let seen = '';
  globalThis.fetch = async (u) => { seen = u; return new Response('{"results":[]}'); };
  const ok = await worker.fetch(new Request('https://x.dev/api/search?url=' + encodeURIComponent('https://api.openalex.org/works?search=a')), env);
  assert.strictEqual(ok.status, 200);
  assert.ok(seen.includes('api_key=oa'));
  const bad = await worker.fetch(new Request('https://x.dev/api/search?url=' + encodeURIComponent('https://evil.example/')), env);
  assert.strictEqual(bad.status, 400);
});

test('ideas notes may only cite papers that were sent', async () => {
  const res = await call({ task: 'ideas', input: { topic: 't', papers: [{ title: 'A' }], limitations: ['X: self-report'] } }, groq([
    { level: 'gap', title: 'Use objective sleep measures?', refs: [1, 5] },
  ]));
  const data = await res.json();
  assert.deepStrictEqual(data.notes[0].refs, [1]);
});

test('methods notes need refs; design notes do not', async () => {
  const m = await (await call({ task: 'methods', input: { procedure: 'p', papers: [{ title: 'A' }] } }, groq([{ title: 'Actigraphy', refs: [1] }, { title: 'No ref' }]))).json();
  assert.deepStrictEqual(m.notes.map((n) => n.title), ['Actigraphy']);
  const d = await (await call({ task: 'design', input: { type: 'cross', procedure: 'p' } }, groq([{ level: 'issue', title: 'Confounding' }]))).json();
  assert.strictEqual(d.notes.length, 1);
});

test('paper analysis returns matrix fields and notes', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ fields: { sample: '1,788 US adults', method: 'Survey', finding: 'More use, more sleep disturbance', limitation: 42 }, notes: [{ level: 'gap', title: 'Cross-sectional' }] }) } }] }));
  const res = await worker.fetch(new Request('https://x.dev/api/feedback', { method: 'POST', body: JSON.stringify({ task: 'paper', input: { title: 'T', abstract: 'A' } }) }), { GROQ_API_KEY: 'k' });
  const data = await res.json();
  assert.deepStrictEqual(data.fields, { sample: '1,788 US adults', method: 'Survey', finding: 'More use, more sleep disturbance', limitation: '' });
  assert.strictEqual(data.notes.length, 1);
});

test('resolve reads citation_doi from an article page and refuses private hosts', async () => {
  globalThis.fetch = async () => new Response('<html><head><meta name="citation_doi" content="10.1016/j.ypmed.2016.01.001"><meta name="citation_title" content="The association"></head></html>');
  const ok = await (await worker.fetch(new Request('https://x.dev/api/resolve?url=' + encodeURIComponent('https://pubmed.ncbi.nlm.nih.gov/1/')), {})).json();
  assert.deepStrictEqual(ok, { doi: '10.1016/j.ypmed.2016.01.001', title: 'The association' });
  assert.strictEqual((await worker.fetch(new Request('https://x.dev/api/resolve?url=' + encodeURIComponent('http://127.0.0.1/admin')), {})).status, 400);
});
