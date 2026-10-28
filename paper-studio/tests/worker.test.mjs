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
