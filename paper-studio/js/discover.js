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

  S.discover = { SORTS, YEARS, buildUrl, parse, abstract, search, shortAuthors, toMatrixRow, toReference };
})(typeof window !== 'undefined' ? window : globalThis);
