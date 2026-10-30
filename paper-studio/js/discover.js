// Discover: find recent and influential work on a topic through OpenAlex,
// a free index of 250M+ scholarly works. Every result is a real record with
// a link; the AI summary (via the Worker) may only cite these results.
(function (root) {
  const S = root.Sigao = root.Sigao || {};

  const API = 'https://api.openalex.org/works';
  const SELECT = 'id,doi,title,publication_year,publication_date,authorships,primary_location,cited_by_count,open_access,type,abstract_inverted_index';
  const SORTS = { relevance: 'Most relevant', newest: 'Newest first', cited: 'Most cited' };
  const YEARS = { 1: 'Last 12 months', 3: 'Last 3 years', 5: 'Last 5 years', 0: 'Any time' };

  function buildUrl(o, now) {
    now = now || new Date();
    const filters = ['type:article|review|preprint'];
    if (Number(o.years)) filters.push(`from_publication_date:${now.getFullYear() - Number(o.years)}-${String(now.getMonth() + 1).padStart(2, '0')}-01`);
    if (o.oa) filters.push('is_oa:true');
    const sort = { newest: '&sort=publication_date:desc', cited: '&sort=cited_by_count:desc' }[o.sort] || '';
    // Precise mode (used by the meaning search) matches titles and abstracts only;
    // the default full-text search also matches papers that mention a word once.
    if (o.precise) return `${API}?filter=${filters.concat('title_and_abstract.search:' + encodeURIComponent(o.query.trim().replace(/[,:|]/g, ' '))).join(',')}${sort}&per-page=25&select=${SELECT}`;
    return `${API}?search=${encodeURIComponent(o.query.trim())}&filter=${filters.join(',')}${sort}&per-page=20&select=${SELECT}`;
  }

  function abstract(inv, max) {
    if (!inv) return '';
    const words = [];
    Object.entries(inv).forEach(([w, pos]) => pos.forEach((p) => { words[p] = w; }));
    const text = words.filter(Boolean).join(' ');
    return text.length > max ? text.slice(0, max).replace(/\s+\S*$/, '') + '…' : text;
  }

  function parse(w) {
    const loc = w.primary_location || {};
    const authors = (w.authorships || []).map((a) => (a.author && a.author.display_name) || '').filter(Boolean);
    const doi = w.doi ? w.doi.replace(/^https?:\/\/doi\.org\//i, '') : '';
    return {
      id: w.id,
      title: String(w.title || 'Untitled').replace(/<[^>]+>/g, ''),
      year: w.publication_year || null,
      date: w.publication_date || '',
      authors,
      venue: (loc.source && loc.source.display_name) || '',
      sourceId: (loc.source && loc.source.id) || '',
      sourceType: (loc.source && loc.source.type) || '',
      type: w.type || '',
      cited: w.cited_by_count || 0,
      doi,
      url: doi ? `https://doi.org/${doi}` : (loc.landing_page_url || w.id),
      oaUrl: (w.open_access && w.open_access.oa_url) || '',
      abstract: abstract(w.abstract_inverted_index, 900),
    };
  }

  // Crossref: the fallback when OpenAlex is out of budget. No key needed,
  // 150M+ records, but no open-access filter and fewer abstracts.
  const CR = 'https://api.crossref.org/works';
  const CR_SELECT = 'DOI,title,author,issued,container-title,is-referenced-by-count,abstract,type,ISSN';
  function parseCrossref(it) {
    const parts = (it.issued && it.issued['date-parts'] && it.issued['date-parts'][0]) || [];
    const doi = String(it.DOI || '');
    return {
      id: 'doi:' + doi.toLowerCase(),
      title: String((it.title || [])[0] || 'Untitled').replace(/<[^>]+>/g, ''),
      year: parts[0] || null,
      date: parts.length ? parts.map((x) => String(x).padStart(2, '0')).join('-') : '',
      authors: (it.author || []).map((a) => [a.given, a.family].filter(Boolean).join(' ') || a.name || '').filter(Boolean),
      venue: (it['container-title'] || [])[0] || '',
      sourceId: (it.ISSN || [])[0] ? 'issn:' + it.ISSN[0] : '',
      sourceType: it.type === 'journal-article' ? 'journal' : it.type || '',
      type: it.type === 'journal-article' ? 'article' : it.type || '',
      cited: it['is-referenced-by-count'] || 0,
      doi,
      url: `https://doi.org/${doi}`,
      oaUrl: '',
      abstract: String(it.abstract || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 900),
    };
  }
  async function crossref(params, f) {
    let res;
    try { res = await f(`${CR}?${params}&select=${CR_SELECT}&mailto=hello@arguo.app`); } catch (e) { res = null; }
    if (!res || !res.ok) return null;
    const data = await res.json();
    return { total: (data.message && data.message['total-results']) || 0, results: ((data.message && data.message.items) || []).map(parseCrossref) };
  }
  function crossrefSearch(o, f, now) {
    now = now || new Date();
    const filters = ['type:journal-article'];
    if (Number(o.years)) filters.push(`from-pub-date:${now.getFullYear() - Number(o.years)}-${String(now.getMonth() + 1).padStart(2, '0')}-01`);
    // Crossref's own date and citation sorts ignore relevance, so take the most
    // relevant 40 and order those.
    return crossref(`query.bibliographic=${encodeURIComponent(o.query.trim())}&filter=${filters.join(',')}&rows=40`, f).then((r) => {
      if (!r) return r;
      if (o.sort === 'newest') r.results.sort((a, b) => String(b.date).localeCompare(String(a.date)));
      else if (o.sort === 'cited') r.results.sort((a, b) => b.cited - a.cited);
      r.results = r.results.slice(0, 20);
      return r;
    });
  }

  // Tries the browser first (each visitor has their own free OpenAlex budget),
  // then the site's server, which can use an OpenAlex key.
  async function search(o, opts) {
    opts = opts || {};
    const f = opts.fetch || (typeof fetch !== 'undefined' ? fetch.bind(root) : null);
    if (!String(o.query || '').trim()) throw new Error('Type your topic first.');
    const url = buildUrl(o, opts.now);
    let res;
    try { res = await f(url); } catch (e) { res = null; }
    if ((!res || res.status === 429 || res.status === 403) && opts.proxy) {
      try { res = await f(opts.proxy + '/api/search?url=' + encodeURIComponent(url)); } catch (e) { res = null; }
    }
    if (!res || !res.ok) {
      const cr = await crossrefSearch(o, f, opts.now);
      if (cr) return Object.assign(cr, { source: 'crossref' });
      if (!res) throw new Error('Could not reach the search services. Check your connection and try again.');
      throw new Error(res.status === 429 ? 'Both search services are busy. Try again in a few minutes.' : `Search failed (${res.status}).`);
    }
    const data = await res.json();
    return { total: (data.meta && data.meta.count) || 0, results: (data.results || []).map(parse), source: 'openalex' };
  }

  // Searches by meaning: the Worker turns the question into several keyword
  // searches (synonyms, field terms, English), the results are merged by
  // reciprocal rank, and the AI reorders them by how well they answer the
  // question. Falls back to a plain keyword search if the AI is unavailable.
  async function smartSearch(o, opts) {
    opts = opts || {};
    const f = opts.fetch || (typeof fetch !== 'undefined' ? fetch.bind(root) : null);
    if (!String(o.query || '').trim()) throw new Error('Type your topic first.');
    const post = async (path, body) => {
      try {
        const res = await f(opts.proxy + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        return res.ok ? await res.json() : null;
      } catch (e) { return null; }
    };
    // The AI provider allows a few requests a minute; wait and try once more.
    const wait = (ms) => new Promise((r) => setTimeout(r, opts.retryMs == null ? ms : opts.retryMs));
    let u = opts.proxy ? await post('/api/understand', { question: o.query }) : null;
    if (opts.proxy && (!u || !u.queries)) { await wait(6000); u = await post('/api/understand', { question: o.query }); }
    if (!u || !u.queries || !u.queries.length) return Object.assign(await search(o, opts), { queries: [], plain: Boolean(opts.proxy) });
    const runs = await Promise.all(u.queries.map((q) => search(Object.assign({}, o, { query: q, sort: 'relevance', precise: true }), opts).catch(() => null)));
    const ok = runs.filter(Boolean);
    if (!ok.length) return Object.assign(await search(o, opts), { queries: [] });
    let lists = ok.map((r) => r.results);
    // Few candidates: add a wider full-text search for the main queries, and let the AI sort them out.
    if (merge(lists).length < 15) {
      const wide = await Promise.all(u.queries.slice(0, 3).map((q) => search(Object.assign({}, o, { query: q, sort: 'relevance' }), opts).catch(() => null)));
      lists = lists.concat(wide.filter(Boolean).map((r) => r.results));
    }
    // Records whose "title" is a name or a fragment are not papers.
    const merged = merge(lists).filter((p) => String(p.title).trim().split(/\s+/).length >= 4);
    // The AI drops off-topic papers and orders the rest by relevance; the
    // chosen sort (newest, most cited) is then applied to the relevant ones.
    let results = merged.slice(0, 40);
    const rankBody = { question: o.query, subject: u.subject || [], papers: results.map((p) => ({ title: p.title, abstract: p.abstract })) };
    let r = await post('/api/rank', rankBody);
    if (!r) { await wait(6000); r = await post('/api/rank', rankBody); }
    // Papers on the question's own subject come first; general-mechanism
    // papers follow as background. The chosen sort applies within each group.
    const sortIn = (list) => {
      if (o.sort === 'newest') list.sort((a, b) => String(b.date).localeCompare(String(a.date)));
      else if (o.sort === 'cited') list.sort((a, b) => b.cited - a.cited);
      return list;
    };
    if (r && (Array.isArray(r.direct) || Array.isArray(r.order))) {
      const direct = (r.direct || r.order).map((n) => results[n]).filter(Boolean).map((p) => Object.assign({}, p, { background: false }));
      const bg = (r.background || []).map((n) => results[n]).filter(Boolean).map((p) => Object.assign({}, p, { background: true }));
      results = sortIn(direct).slice(0, 20).concat(sortIn(bg));
    } else results = sortIn(results).slice(0, 20);
    return { total: merged.length, results, queries: u.queries, subject: u.subject || [], unranked: !r, source: ok.some((r) => r.source === 'crossref') ? 'crossref' : 'openalex' };
  }

  // Reciprocal rank fusion: papers found by several searches, and high up, come first.
  function merge(lists) {
    const by = new Map();
    lists.forEach((list) => list.forEach((p, i) => {
      const e = by.get(p.id) || { p, score: 0 };
      e.score += 1 / (60 + i);
      by.set(p.id, e);
    }));
    return [...by.values()].sort((a, b) => b.score - a.score).map((e) => e.p);
  }

  function shortAuthors(a) {
    if (!a.length) return 'Unknown authors';
    if (a.length === 1) return a[0];
    if (a.length === 2) return `${a[0]} & ${a[1]}`;
    return `${a[0]} et al.`;
  }

  function lastName(full) { const parts = String(full).trim().split(/\s+/); return parts[parts.length - 1] || full; }

  function toMatrixRow(r) {
    const a = r.authors;
    const src = !a.length ? 'Unknown' : a.length === 1 ? lastName(a[0]) : a.length === 2 ? `${lastName(a[0])} & ${lastName(a[1])}` : `${lastName(a[0])} et al.`;
    return { source: `${src} (${r.year || 'n.d.'})`, sample: '', method: '', finding: '', limitation: '', relation: '' };
  }

  function toReference(r) {
    const a = r.authors.length ? r.authors.join(', ') : 'Unknown authors';
    return `${a} (${r.year || 'n.d.'}). ${r.title}. ${r.venue || ''}${r.doi ? `. https://doi.org/${r.doi}` : ''}`.replace(/\.\s*\./g, '.');
  }

  // What a pasted link points to: a DOI, an arXiv id, an OpenAlex work, or an
  // ordinary web page that the Worker has to read.
  function idFromLink(link) {
    const s = decodeURIComponent(String(link || '').trim());
    const ox = s.match(/openalex\.org\/(?:works\/)?(W\d+)/i);
    if (ox) return { openalex: ox[1] };
    const ax = s.match(/arxiv\.org\/(?:abs|pdf)\/(\d{4}\.\d{4,5})(?:v\d+)?/i) || s.match(/^arxiv:\s*(\d{4}\.\d{4,5})/i);
    if (ax) return { doi: `10.48550/arxiv.${ax[1]}` };
    const doi = s.match(/\b(10\.\d{4,9}\/[^\s?#"<>]+)/);
    if (doi) return { doi: doi[1].replace(/[.,;)\]]+$/, '').replace(/\/(full|abstract|pdf|epdf)$/i, '') };
    if (/^https?:\/\//i.test(s)) return { page: s };
    return s.length > 10 ? { title: s } : null;
  }

  // For a title search: the result whose title matches best, if it is close enough.
  const norm = (t) => String(t || '').toLowerCase().replace(/<[^>]+>/g, '').replace(/[^a-z0-9\u00c0-\u024f\u4e00-\u9fff]+/g, ' ').trim();
  function titleScore(a, b) {
    const x = norm(a).split(' ').filter(Boolean), y = norm(b).split(' ').filter(Boolean);
    if (!x.length || !y.length) return 0;
    if (norm(a) === norm(b)) return 1;
    // Word pairs keep word order, so "Is attention all you need?" does not match "Attention is all you need".
    const pairs = (w) => new Set(w.length > 1 ? w.slice(1).map((v, i) => w[i] + ' ' + v) : w);
    const px = pairs(x), py = pairs(y);
    return [...px].filter((w) => py.has(w)).length / Math.max(px.size, py.size);
  }
  function bestTitle(list, title) {
    const scored = (list || []).map((p) => ({ p, s: titleScore(p.title, title) })).sort((a, b) => b.s - a.s);
    return scored[0] && scored[0].s >= 0.6 ? scored[0].p : null;
  }

  // Resolves a pasted link to one OpenAlex record.
  async function lookup(link, opts) {
    opts = opts || {};
    const f = opts.fetch || (typeof fetch !== 'undefined' ? fetch.bind(root) : null);
    let id = idFromLink(link);
    if (!id) throw new Error('Paste a DOI, a link to the article, or its title.');
    if (id.page) {
      if (!opts.proxy) throw new Error('This link needs the Arguo server to read the page.');
      let r;
      try { r = await f(opts.proxy + '/api/resolve?url=' + encodeURIComponent(id.page)); } catch (e) { r = null; }
      const info = r && r.ok ? await r.json() : {};
      if (info.doi) id = { doi: info.doi };
      else if (info.title) id = { title: info.title };
      else throw new Error('Could not find the article details on that page. Try its DOI or title instead.');
    }
    const url = id.openalex ? `${API}/${id.openalex}?select=${SELECT}`
      : id.doi ? `${API}/doi:${encodeURIComponent(id.doi)}?select=${SELECT}`
        : `${API}?search=${encodeURIComponent(id.title)}&per-page=5&select=${SELECT}`;
    let res;
    try { res = await f(url); } catch (e) { res = null; }
    if ((!res || res.status === 429 || res.status === 403) && opts.proxy) {
      try { res = await f(opts.proxy + '/api/search?url=' + encodeURIComponent(url)); } catch (e) { res = null; }
    }
    if ((!res || (!res.ok && res.status !== 404)) && !id.openalex) {
      if (id.doi) {
        let r2;
        try { r2 = await f(`${CR}/${encodeURIComponent(id.doi)}?mailto=hello@arguo.app`); } catch (e) { r2 = null; }
        if (r2 && r2.ok) return parseCrossref((await r2.json()).message);
      } else {
        const cr = await crossref(`query.bibliographic=${encodeURIComponent(id.title)}&rows=10`, f);
        const best = cr && bestTitle(cr.results, id.title);
        if (best) return best;
        if (cr) throw new Error('No paper with that title was found. Check the spelling, or paste its DOI or link.');
      }
    }
    if (!res) throw new Error('Could not reach the search services. Check your connection and try again.');
    if (res.status === 404) throw new Error('No record found for that link. Check the DOI, or paste the title instead.');
    if (!res.ok) throw new Error(`Lookup failed (${res.status}).`);
    const data = await res.json();
    if (data.results) {
      const best = bestTitle(data.results.map(parse), id.title || '');
      if (!best) throw new Error('No paper with that title was found. Check the spelling, or paste its DOI or link.');
      return best;
    }
    if (!data.id) throw new Error('No record found for that link.');
    return parse(data);
  }

  // Author-year citations written in the user's own text, e.g. "Levenson et
  // al. (2016)", "(Woods & Scott, 2016)" or "Hale and Guan 2015".
  function citationsIn(text) {
    const out = [];
    const re = /\b([A-Z][A-Za-z'\u00C0-\u017F-]+)(?:\s+(?:et\s+al\.?|(?:and|&)\s+[A-Z][A-Za-z'\u00C0-\u017F-]+))?,?\s*\(?((?:19|20)\d{2})[a-z]?\)?/g;
    const STOP = /^(In|The|This|These|Since|From|By|Until|Before|After|During|Between|Of|And|Our|We|Table|Figure|Fig|Section|Study|Studies|January|February|March|April|May|June|July|August|September|October|November|December|Spring|Summer|Autumn|Fall|Winter)$/;
    let m;
    while ((m = re.exec(String(text || '')))) {
      if (STOP.test(m[1])) continue;
      const key = m[1].toLowerCase() + m[2];
      if (!out.some((c) => c.key === key)) out.push({ key, author: m[1], year: Number(m[2]), text: m[0].replace(/[()]/g, '').trim() });
    }
    return out;
  }

  function inMatrix(c, rows) {
    return (rows || []).some((r) => {
      const hay = (String(r.source || '') + ' ' + ((r.meta && r.meta.authors) || []).join(' ')).toLowerCase();
      const year = (r.meta && r.meta.year) || Number((String(r.source).match(/(19|20)\d{2}/) || [])[0]);
      return hay.includes(c.author.toLowerCase()) && year === c.year;
    });
  }

  // Candidates for a citation: works from that year whose authors include the name.
  async function findCited(c, topic, opts) {
    opts = opts || {};
    const f = opts.fetch || (typeof fetch !== 'undefined' ? fetch.bind(root) : null);
    const url = `${API}?search=${encodeURIComponent((c.author + ' ' + (topic || '')).trim())}&filter=publication_year:${c.year}&per-page=10&select=${SELECT}`;
    let res;
    try { res = await f(url); } catch (e) { res = null; }
    if ((!res || res.status === 429 || res.status === 403) && opts.proxy) {
      try { res = await f(opts.proxy + '/api/search?url=' + encodeURIComponent(url)); } catch (e) { res = null; }
    }
    let all;
    if (res && res.ok) all = ((await res.json()).results || []).map(parse);
    else {
      const cr = await crossref(`query.author=${encodeURIComponent(c.author)}&query.bibliographic=${encodeURIComponent(topic || '')}&filter=from-pub-date:${c.year},until-pub-date:${c.year}&rows=10`, f);
      if (!cr) throw new Error('Could not search for that paper right now. Try again in a minute.');
      all = cr.results;
    }
    const named = all.filter((r) => r.authors.some((a) => a.toLowerCase().includes(c.author.toLowerCase())));
    return (named.length ? named : all).slice(0, 3);
  }

  S.discover = { smartSearch, merge, titleScore, bestTitle, citationsIn, inMatrix, findCited, SORTS, YEARS, buildUrl, parse, abstract, search, shortAuthors, toMatrixRow, toReference, idFromLink, lookup };
})(typeof window !== 'undefined' ? window : globalThis);
