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
