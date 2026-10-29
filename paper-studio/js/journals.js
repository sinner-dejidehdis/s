// Journal finder: searches for published papers like the writer's (by
// meaning), then lists the journals that published them, with open-access,
// fee and size details from OpenAlex. Every suggestion links to real papers.
(function (root) {
  const S = root.Sigao = root.Sigao || {};
  const SOURCES = 'https://api.openalex.org/sources';

  // Groups papers by journal; journals with more matching papers come first.
  function group(papers) {
    const by = new Map();
    papers.forEach((p) => {
      if (!p.sourceId || (p.sourceType && p.sourceType !== 'journal')) return;
      const g = by.get(p.sourceId) || { id: p.sourceId, name: p.venue, papers: [] };
      g.papers.push(p);
      by.set(p.sourceId, g);
    });
    return [...by.values()].sort((a, b) => b.papers.length - a.papers.length || b.papers[0].cited - a.papers[0].cited);
  }

  async function details(ids, opts) {
    const f = opts.fetch || (typeof fetch !== 'undefined' ? fetch.bind(root) : null);
    const url = `${SOURCES}?filter=openalex:${ids.map((id) => id.split('/').pop()).join('|')}&per-page=${ids.length}&select=id,display_name,homepage_url,host_organization_name,is_oa,is_in_doaj,apc_usd,works_count,summary_stats`;
    let res;
    try { res = await f(url); } catch (e) { res = null; }
    if ((!res || res.status === 429 || res.status === 403) && opts.proxy) {
      try { res = await f(opts.proxy + '/api/search?url=' + encodeURIComponent(url)); } catch (e) { res = null; }
    }
    if (!res || !res.ok) return {};
    const out = {};
    ((await res.json()).results || []).forEach((j) => {
      out[j.id] = { homepage: j.homepage_url || '', publisher: j.host_organization_name || '', isOa: Boolean(j.is_oa), doaj: Boolean(j.is_in_doaj),
        apc: j.apc_usd == null ? null : j.apc_usd, works: j.works_count || 0, hIndex: (j.summary_stats && j.summary_stats.h_index) || null };
    });
    return out;
  }

  async function suggest(text, opts) {
    opts = opts || {};
    if (!String(text || '').trim()) throw new Error('Fill in your research question or aim first.');
    const r = await S.discover.smartSearch({ query: String(text).slice(0, 400), years: 5, sort: 'relevance' }, opts);
    const groups = group(r.results).slice(0, 8);
    if (!groups.length) throw new Error('No journals found for this topic. Try rewording your research question.');
    const ox = groups.map((g) => g.id).filter((id) => /openalex\.org/.test(id));
    const info = ox.length ? await details(ox, opts) : {};
    return { queries: r.queries || [], journals: groups.map((g) => Object.assign(g, { info: info[g.id] || null })) };
  }

  S.journals = { group, suggest };
})(typeof window !== 'undefined' ? window : globalThis);
