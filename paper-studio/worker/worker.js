// Arguo API: a Cloudflare Worker that asks Groq for feedback on one module
// and enforces the red line on the way back. The Groq key lives only in the
// Worker's secret GROQ_API_KEY; the page never sees it.
//
// POST /api/feedback  { task: "outline" | "consistency" | "matrix" | "review", input: {...} }
// -> { notes: [{ level, field?, title, why, how, example?, ask? }], blocked: n }

const MODEL = 'openai/gpt-oss-120b';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MAX_INPUT_CHARS = 12000; // keeps one request under the free tier's 8K tokens per minute

const RULES = `You are Arguo, a feedback tool for academic writers. You never write the user's paper.
Hard rules:
- Diagnose problems, explain why they matter, and explain how to fix them.
- Never rewrite, paraphrase, continue or complete the user's text. Never give a replacement sentence about the user's own topic.
- When an example helps, use a clearly different topic (for example urban parks and heat, or soil microbes), never the user's topic.
- You may ask one short question that helps the writer think.
- Never invent references, statistics or findings.
Reply with JSON only: {"notes":[{"level":"issue|tip|gap|ask|ok","field":"<optional key>","title":"<under 12 words>","why":"<1-2 sentences>","how":"<1-2 sentences>","example":"<optional, other topic>","ask":"<optional question>"}]}
Give at most 5 notes, most important first. Use "issue" only for problems a reviewer would ask to fix.`;

const TASKS = {
  outline: (i) => `Check this argument thread. Field keys: question, gap, aim, method, result, conclusion.
Look for: nodes that do not line up, a gap that does not say what earlier work did, concepts in the question that the method does not measure, conclusions beyond the results, causal claims from correlational designs.

${['question', 'gap', 'aim', 'method', 'result', 'conclusion'].map((k) => `[${k}]\n${str(i[k])}`).join('\n\n')}`,
  consistency: (i) => `Check whether this discussion stays within these results.
Look for: claims with no supporting result, causal language on correlational data, absolute wording, research questions without a result, missing limitations.

[research question]\n${str(i.question)}\n\n[method]\n${str(i.method)}\n\n[results]\n${str(i.results)}\n\n[discussion]\n${str(i.discussion)}`,
  matrix: (i) => `Help the writer find a research gap in this literature matrix (one paper per row).
Look for: limitations several papers share, one design or population dominating, conflicting findings and what might explain them, missing recent work.
Point at patterns and ask questions. Do not write the gap statement or the literature review.

${(Array.isArray(i.rows) ? i.rows : []).slice(0, 15).map((r, n) => `[paper ${n + 1}] ${['source', 'sample', 'method', 'finding', 'limitation', 'relation'].map((k) => `${k}: ${str(r && r[k]).slice(0, 300)}`).join(' | ')}`).join('\n')}`,
  review: (i) => `Help the writer plan a revision from these reviewer comments.
For each important comment: say what the reviewer most likely wants, whether it is a must-fix, and what kind of change or evidence would answer it. For vague comments, give two or three possible readings. Do not draft the response letter or any reply text.

${str(i.comments)}`,
};

function str(v) { return String(v || '').slice(0, 4000); }

// Red line on the output: drop any note that copies a long run of the user's
// words, which is what a rewrite or continuation looks like.
function words(s) { return String(s || '').toLowerCase().match(/[a-z0-9一-鿿]+/g) || []; }
function copiesUser(note, userText, n = 8) {
  const grams = new Set();
  const u = words(userText);
  for (let i = 0; i + n <= u.length; i++) grams.add(u.slice(i, i + n).join(' '));
  const out = words([note.title, note.how, note.example].join(' '));
  for (let i = 0; i + n <= out.length; i++) if (grams.has(out.slice(i, i + n).join(' '))) return true;
  return false;
}

const LEVELS = new Set(['issue', 'tip', 'gap', 'ask', 'ok']);
function clean(note) {
  const pick = (k, max) => (typeof note[k] === 'string' ? note[k].slice(0, max) : undefined);
  return {
    level: LEVELS.has(note.level) ? note.level : 'tip',
    field: pick('field', 20), title: pick('title', 140) || 'Note', why: pick('why', 600),
    how: pick('how', 600), example: pick('example', 600), ask: pick('ask', 300),
  };
}

function cors(origin, env) {
  const allowed = (env.ALLOWED_ORIGINS || '*').split(',').map((s) => s.trim());
  const ok = allowed.includes('*') || allowed.includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? (allowed.includes('*') ? '*' : origin) : 'null',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}

export default {
  async fetch(request, env) {
    const headers = cors(request.headers.get('Origin') || '', env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    const url = new URL(request.url);
    if (url.pathname !== '/api/feedback' || request.method !== 'POST') return json({ error: 'Not found' }, 404, headers);
    if (!env.GROQ_API_KEY) return json({ error: 'The server is missing GROQ_API_KEY.' }, 500, headers);

    let body;
    try { body = await request.json(); } catch { return json({ error: 'Send JSON.' }, 400, headers); }
    const build = TASKS[body && body.task];
    if (!build || typeof body.input !== 'object') return json({ error: 'Unknown task.' }, 400, headers);
    const prompt = build(body.input);
    if (prompt.length > MAX_INPUT_CHARS) return json({ error: 'Too much text at once. Check one section at a time.' }, 413, headers);

    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'system', content: RULES }, { role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        reasoning_effort: 'medium',
        max_completion_tokens: 2500,
      }),
    });
    if (res.status === 429) return json({ error: 'The free AI quota is used up for now. Try again in a minute, or tomorrow.' }, 429, headers);
    if (!res.ok) return json({ error: `AI service error (${res.status}).` }, 502, headers);

    let notes = [];
    try {
      const data = await res.json();
      notes = JSON.parse(data.choices[0].message.content).notes || [];
    } catch { return json({ error: 'The AI reply could not be read. Try again.' }, 502, headers); }

    const userText = JSON.stringify(body.input).replace(/\\n|[{}\[\]":,]/g, ' ');
    const kept = notes.slice(0, 5).map(clean).filter((n) => !copiesUser(n, userText));
    return json({ notes: kept, blocked: Math.min(notes.length, 5) - kept.length }, 200, headers);
  },
};

export { copiesUser, clean };
