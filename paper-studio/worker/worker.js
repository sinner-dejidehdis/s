// Arguo API: a Cloudflare Worker that asks Groq for feedback on one module
// and enforces the red line on the way back. The Groq key lives only in the
// Worker's secret GROQ_API_KEY; the page never sees it.
//
// POST /api/feedback  { task: "outline" | "consistency" | "matrix" | "review" | "survey" | "ideas" | "design" | "methods" | "paper" | "section"
// GET  /api/resolve?url=<article page>  (DOI and title from citation meta tags), input: {...} }
// GET  /api/search?url=<OpenAlex works URL>  (adds OPENALEX_API_KEY when set)
// -> { notes: [{ level, field?, title, why, how, example?, ask? }], blocked: n }

const MODEL = 'openai/gpt-oss-120b';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MAX_INPUT_CHARS = 16000; // about 4K tokens, so prompt + reply stay under the free tier's 8K tokens per minute

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
  survey: (i) => `The writer has chosen a topic and wants to know the current state of research on it.
Below are real search results, numbered. Using ONLY these results, write a research briefing as notes:
- 3 to 5 notes, each a theme, debate, method trend or open question in this body of work (level "gap" for open questions, otherwise "tip").
- "why": 2-3 sentences summarising what these papers found, in your own words.
- "how": which of the papers to read first for this theme, and why.
- "refs": an array with the numbers of the papers the note is based on. Every note must have refs.
Never mention a paper, finding or statistic that is not in the list. If abstracts are missing, say what can be inferred from titles only and that the reader should check the papers.

[topic] ${str(i.query)}

${(Array.isArray(i.papers) ? i.papers : []).slice(0, 12).map((p, n) => `[${n + 1}] ${str(p && p.title).slice(0, 300)} (${str(p && p.year).slice(0, 4)}; ${str(p && p.venue).slice(0, 120)}; cited ${Number(p && p.cited) || 0})\n${str(p && p.abstract).slice(0, 700) || '(no abstract)'}`).join('\n\n')}`,
  ideas: (i) => `The writer wants to know where their research could go next and what would be genuinely new.
Using ONLY the papers and limitations listed below, suggest 3 to 5 possible research directions:
- "title": the direction as a short question (under 14 words). Do not phrase it as a finished research question for the writer's paper.
- "why": what in these papers points to it (an open problem, a shared limitation, a conflict, an untested population, method or setting).
- "how": what kind of study would test it (design, data, comparison) and one first step the writer could take.
- "ask": one question that helps the writer judge whether this suits them (feasibility, data access, skills).
- "refs": the numbers of the papers it builds on; may be empty only if it rests on the listed limitations.
Use level "gap". Never invent papers, findings or statistics. Do not write any part of the writer's paper.

[topic] ${str(i.topic)}
[their current question] ${str(i.question)}
[their current gap] ${str(i.gap)}
[limitations noted in their literature matrix]
${(Array.isArray(i.limitations) ? i.limitations : []).slice(0, 10).map((l) => '- ' + str(l).slice(0, 300)).join('\n') || '(none)'}

${(Array.isArray(i.papers) ? i.papers : []).slice(0, 10).map((p, n) => `[${n + 1}] ${str(p && p.title).slice(0, 300)} (${str(p && p.year).slice(0, 4)})\n${str(p && p.abstract).slice(0, 450) || '(no abstract)'}`).join('\n\n')}`,
  design: (i) => `Critique this planned study design as a methods reviewer would, before any data are collected.
Look for: threats to validity (confounding, selection, measurement, attrition), a missing or weak comparison, sample size, order or carry-over effects, whether the analysis answers the question, ethics and feasibility.
Give advice and the reasoning; you may list concrete steps the researcher could add to the procedure. Do not write their methods section.

[design type] ${str(i.type)}
${['question', 'variables', 'sample', 'procedure', 'analysis'].map((k) => `[${k}]\n${str(i[k]).slice(0, 1500)}`).join('\n\n')}`,
  methods: (i) => `The researcher is planning a study and wants to learn from the methods of similar studies.
Using ONLY the papers below, describe 3 to 5 approaches these studies used (designs, samples, measures, procedures or analyses) and what the researcher could borrow or avoid.
- "title": the approach in under 12 words.
- "why": what the listed papers did, in your own words.
- "how": how this could inform the researcher's own procedure, as concrete steps or choices.
- "refs": the numbers of the papers it comes from. Every note must have refs.
If abstracts do not describe methods, say so and suggest which papers to open. Never invent details. Use level "tip".

[researcher's planned design] ${str(i.type)}: ${str(i.procedure).slice(0, 800)}

${(Array.isArray(i.papers) ? i.papers : []).slice(0, 10).map((p, n) => `[${n + 1}] ${str(p && p.title).slice(0, 300)} (${str(p && p.year).slice(0, 4)})\n${str(p && p.abstract).slice(0, 600) || '(no abstract)'}`).join('\n\n')}`,
  paper: (i) => `Read this paper's record and help a researcher decide how it relates to their work. You only have the metadata and abstract, not the full text; say so where it matters.
Return JSON: {"fields":{"sample":"","method":"","finding":"","limitation":""},"notes":[...]}
- "fields": short reading notes (under 30 words each) for a literature matrix: who or what was studied, the design and analysis, the main finding, limitations stated or evident. Use "" when the abstract does not say.
- "notes": 3 to 5 notes with levels "tip" (key point, method or strength), "gap" (limitation or open question) and "ask" (a question to keep in mind while reading the full paper). Include one note on how the paper relates to the researcher's question, if given.
Never invent findings or numbers that are not in the record.

[researcher's question] ${str(i.question)}
[title] ${str(i.title)}
[authors] ${str(i.authors).slice(0, 300)}
[year] ${str(i.year).slice(0, 4)}  [venue] ${str(i.venue).slice(0, 200)}  [type] ${str(i.type).slice(0, 30)}
[abstract]
${str(i.abstract) || '(no abstract available)'}`,
  section: (i) => `Review one section of a manuscript against the writer's argument thread, as a careful supervisor would.
Section: ${str(i.label).slice(0, 40)} (${str(i.section).slice(0, 80)}).
Check that it is consistent with the argument thread, does its job for this kind of section, and follows the conventions reviewers expect.
Return 3 to 5 notes. For each: "why" explains the problem precisely, quoting at most 6 words of the writer's text to locate it; "how" gives concrete steps to revise it.
For "example", show how published authors handle the same thing: describe or briefly quote (under 25 words) how one of the listed papers does it, and put its number in "refs". If no listed paper shows it, give an example on a clearly different topic instead (refs empty). Never write a replacement for the writer's own text and never invent papers.

[argument thread]
${['question', 'gap', 'aim', 'method', 'result', 'conclusion'].map((k) => `${k}: ${str(i.outline && i.outline[k]).slice(0, 400)}`).join('\n')}

[writer's ${str(i.label).slice(0, 40)} section]
${str(i.text).slice(0, 3500)}

[published papers on the topic, for examples]
${(Array.isArray(i.papers) ? i.papers : []).slice(0, 6).map((p, n) => `[${n + 1}] ${str(p && p.title).slice(0, 200)} (${str(p && p.year).slice(0, 4)})\n${str(p && p.abstract).slice(0, 500) || '(no abstract)'}`).join('\n\n') || '(none)'}`,
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
    refs: Array.isArray(note.refs) ? note.refs.map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 12) : undefined,
  };
}

function cors(origin, env) {
  const allowed = (env.ALLOWED_ORIGINS || '*').split(',').map((s) => s.trim());
  const ok = allowed.includes('*') || allowed.includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? (allowed.includes('*') ? '*' : origin) : 'null',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}

// Relays an OpenAlex works search for visitors whose own budget ran out.
async function search(url, env, headers) {
  const target = url.searchParams.get('url') || '';
  if (!/^https:\/\/api\.openalex\.org\/(works|sources)[?/]/.test(target)) return json({ error: 'Only OpenAlex work requests are allowed.' }, 400, headers);
  const u = new URL(target);
  if (env.OPENALEX_API_KEY) u.searchParams.set('api_key', env.OPENALEX_API_KEY);
  const res = await fetch(u.toString(), { headers: { 'User-Agent': 'Arguo (academic writing feedback)' } });
  return new Response(res.body, { status: res.status, headers: { 'Content-Type': 'application/json', ...headers } });
}

// Finds the DOI and title of an article page whose link has no DOI in it,
// from the citation meta tags most publishers include.
async function resolve(url, headers) {
  let target;
  try { target = new URL(url.searchParams.get('url') || ''); } catch { return json({ error: 'That is not a valid link.' }, 400, headers); }
  if (target.protocol !== 'https:' && target.protocol !== 'http:') return json({ error: 'Use an http or https link.' }, 400, headers);
  if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(target.hostname) || /^172\.(1[6-9]|2\d|3[01])\./.test(target.hostname)) return json({ error: 'That link is not allowed.' }, 400, headers);
  let html = '';
  try {
    const res = await fetch(target.toString(), { headers: { 'User-Agent': 'Mozilla/5.0 (Arguo citation lookup)', Accept: 'text/html' }, redirect: 'follow', cf: { cacheTtl: 3600 } });
    html = (await res.text()).slice(0, 400000);
  } catch { return json({ error: 'Could not open that page.' }, 502, headers); }
  const meta = (names) => {
    for (const n of names) {
      const m = html.match(new RegExp(`<meta[^>]+(?:name|property)=["']${n}["'][^>]*content=["']([^"']+)["']`, 'i')) || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:name|property)=["']${n}["']`, 'i'));
      if (m) return m[1].trim();
    }
    return '';
  };
  const doiInPage = (html.match(/\b10\.\d{4,9}\/[^\s"'<>]+/) || [''])[0];
  const doi = (meta(['citation_doi', 'dc.identifier', 'DC.Identifier', 'prism.doi']) || doiInPage).replace(/^doi:/i, '').replace(/^https?:\/\/(dx\.)?doi\.org\//i, '');
  const title = meta(['citation_title', 'dc.title', 'DC.title', 'og:title']);
  return json({ doi: /^10\./.test(doi) ? doi : '', title }, 200, headers);
}

// Daily AI checks per visitor, counted by IP address in the LIMITS KV
// namespace. DAILY_LIMIT (default 10) is set in the Worker's variables.
// Without a LIMITS binding there is no per-visitor limit.
async function takeQuota(request, env) {
  const limit = Number(env.DAILY_LIMIT) || 10;
  if (!env.LIMITS) return { ok: true, remaining: null, limit };
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const key = `ai:${new Date().toISOString().slice(0, 10)}:${ip}`;
  const used = Number(await env.LIMITS.get(key)) || 0;
  if (used >= limit) return { ok: false, remaining: 0, limit };
  await env.LIMITS.put(key, String(used + 1), { expirationTtl: 60 * 60 * 48 });
  return { ok: true, remaining: limit - used - 1, limit };
}

export default {
  async fetch(request, env) {
    const headers = cors(request.headers.get('Origin') || '', env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    const url = new URL(request.url);
    if (url.pathname === '/api/search' && request.method === 'GET') return search(url, env, headers);
    if (url.pathname === '/api/resolve' && request.method === 'GET') return resolve(url, headers);
    if (url.pathname !== '/api/feedback' || request.method !== 'POST') return json({ error: 'Not found' }, 404, headers);
    if (!env.GROQ_API_KEY) return json({ error: 'The server is missing GROQ_API_KEY.' }, 500, headers);

    let body;
    try { body = await request.json(); } catch { return json({ error: 'Send JSON.' }, 400, headers); }
    const build = TASKS[body && body.task];
    if (!build || typeof body.input !== 'object') return json({ error: 'Unknown task.' }, 400, headers);
    const prompt = build(body.input);
    if (prompt.length > MAX_INPUT_CHARS) return json({ error: 'Too much text at once. Check one section at a time.' }, 413, headers);

    const quota = await takeQuota(request, env);
    if (!quota.ok) return json({ error: `You have used today’s ${quota.limit} free AI checks. They reset at midnight UTC.`, remaining: 0, limit: quota.limit }, 429, headers);

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
    let fields = null;
    try {
      const data = await res.json();
      const parsed = JSON.parse(data.choices[0].message.content);
      notes = parsed.notes || [];
      if (body.task === 'paper' && parsed.fields && typeof parsed.fields === 'object') {
        fields = {};
        ['sample', 'method', 'finding', 'limitation'].forEach((k) => { fields[k] = typeof parsed.fields[k] === 'string' ? parsed.fields[k].slice(0, 300) : ''; });
      }
    } catch { return json({ error: 'The AI reply could not be read. Try again.' }, 502, headers); }

    // A survey summarises other people's papers, so only the user's own query counts as their text,
    // and every note must cite results that were actually sent.
    const survey = body.task === 'survey';
    const ideas = body.task === 'ideas';
    const methods = body.task === 'methods';
    const section = body.task === 'section';
    const sent = survey && Array.isArray(body.input.papers) ? Math.min(body.input.papers.length, 12) : 0;
    const userText = section ? str(body.input.text) : body.task === 'paper' ? str(body.input.question) : survey ? str(body.input.query) : methods ? str(body.input.procedure) : ideas ? [body.input.question, body.input.gap].map(str).join(' ') : JSON.stringify(body.input).replace(/\\n|[{}\[\]":,]/g, ' ');
    const kept = notes.slice(0, 5).map(clean)
      .map((n) => (section ? Object.assign(n, { refs: (n.refs || []).filter((r) => r <= Math.min((body.input.papers || []).length, 6)) }) : n))
      .map((n) => (survey || ideas || methods ? Object.assign(n, { refs: (n.refs || []).filter((r) => r <= (survey ? sent : Math.min((body.input.papers || []).length, 10))) }) : n))
      .filter((n) => !copiesUser(n, userText) && (!(survey || methods) || n.refs.length));
    return json({ notes: kept, fields, blocked: Math.min(notes.length, 5) - kept.length, remaining: quota.remaining, limit: quota.limit }, 200, headers);
  },
};

export { copiesUser, clean };
