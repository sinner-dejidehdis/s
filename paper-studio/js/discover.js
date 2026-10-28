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
      type: w.type || '',
      cited: w.cited_by_count || 0,
      doi,
      url: doi ? `https://doi.org/${doi}` : (loc.landing_page_url || w.id),
      oaUrl: (w.open_access && w.open_access.oa_url) || '',
      abstract: abstract(w.abstract_inverted_index, 900),
    };
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
    if (!res) throw new Error('Could not reach OpenAlex. Previews block outside requests; this works on the deployed site.');
    if (res.status === 429) throw new Error('The search service is busy. Try again in a few minutes.');
    if (!res.ok) throw new Error(`Search failed (${res.status}).`);
    const data = await res.json();
    return { total: (data.meta && data.meta.count) || 0, results: (data.results || []).map(parse) };
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
        : `${API}?search=${encodeURIComponent(id.title)}&per-page=1&select=${SELECT}`;
    let res;
    try { res = await f(url); } catch (e) { res = null; }
    if ((!res || res.status === 429 || res.status === 403) && opts.proxy) {
      try { res = await f(opts.proxy + '/api/search?url=' + encodeURIComponent(url)); } catch (e) { res = null; }
    }
    if (!res) throw new Error('Could not reach OpenAlex. Previews block outside requests; this works on the deployed site.');
    if (res.status === 404) throw new Error('No record found for that link. Check the DOI, or paste the title instead.');
    if (!res.ok) throw new Error(`Lookup failed (${res.status}).`);
    const data = await res.json();
    const w = data.results ? data.results[0] : data;
    if (!w || !w.id) throw new Error('No record found for that link.');
    return parse(w);
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
    if (!res || !res.ok) throw new Error('Could not search for that paper right now.');
    const all = ((await res.json()).results || []).map(parse);
    const named = all.filter((r) => r.authors.some((a) => a.toLowerCase().includes(c.author.toLowerCase())));
    return (named.length ? named : all).slice(0, 3);
  }

  S.discover = { citationsIn, inMatrix, findCited, SORTS, YEARS, buildUrl, parse, abstract, search, shortAuthors, toMatrixRow, toReference, idFromLink, lookup };
})(typeof window !== 'undefined' ? window : globalThis);
