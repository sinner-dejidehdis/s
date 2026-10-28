// Journal styles: the Citation Style Language registry lists 10,000+
// journals. A journal's style is usually a "dependent" style that points to
// a parent (e.g. Preventive Medicine -> Elsevier Harvard). Crossref formats a
// DOI in any parent style, so references come out exactly as CSL defines.
(function (root) {
  const S = root.Sigao = root.Sigao || {};
  const LIST = 'https://www.zotero.org/styles-files/styles.json';
  const STYLE = 'https://www.zotero.org/styles/';
  const CROSSREF = 'https://api.crossref.org/works/';

  let list = null;
  const getFetch = (o) => (o && o.fetch) || (typeof fetch !== 'undefined' ? fetch.bind(root) : null);

  async function load(opts) {
    if (list) return list;
    const res = await getFetch(opts)(LIST);
    if (!res.ok) throw new Error('Could not load the journal list.');
    list = (await res.json()).map((x) => ({ title: x.title, short: x.titleShort || '', name: x.name, dependent: Boolean(x.dependent), format: (x.categories && x.categories.format) || '' }));
    return list;
  }

  function search(styles, q, max) {
    q = String(q || '').trim().toLowerCase();
    if (q.length < 2) return [];
    const score = (x) => {
      const t = x.title.toLowerCase();
      const s = x.short.toLowerCase();
      if (t === q || s === q) return 0;
      if (t.startsWith(q) || s.startsWith(q)) return 1;
      if (t.includes(q) || s.includes(q)) return 2;
      return 9;
    };
    return styles.map((x) => [score(x), x]).filter(([n]) => n < 9).sort((a, b) => a[0] - b[0] || a[1].title.length - b[1].title.length).slice(0, max || 8).map(([, x]) => x);
  }

  async function parentOf(style, opts) {
    if (!style.dependent) return style.name;
    const res = await getFetch(opts)(STYLE + style.name);
    if (!res.ok) throw new Error('Could not load that journal’s style.');
    const xml = await res.text();
    const m = xml.match(/<link[^>]+href="https?:\/\/www\.zotero\.org\/styles\/([^"]+)"[^>]+rel="independent-parent"/) || xml.match(/<link[^>]+rel="independent-parent"[^>]+href="https?:\/\/www\.zotero\.org\/styles\/([^"]+)"/);
    if (!m) throw new Error('That journal’s style has no parent style.');
    return m[1];
  }

  // One reference in a CSL style, formatted by Crossref from its DOI record.
  async function formatDoi(doi, style, opts) {
    const res = await getFetch(opts)(CROSSREF + encodeURIComponent(doi) + '/transform', { headers: { Accept: `text/x-bibliography; style=${style}; locale=en-US` } });
    if (!res.ok) throw new Error('format ' + res.status);
    return (await res.text()).replace(/\s+/g, ' ').trim().replace(/^\[?\d+\]?\.?\s*(?=\S)/, '');
  }

  // The built-in formatter closest to a style, for references without a DOI.
  function fallback(format) { return format === 'numeric' ? 'vancouver' : format === 'note' ? 'chicago' : 'apa'; }

  S.styles = { load, search, parentOf, formatDoi, fallback };
})(typeof window !== 'undefined' ? window : globalThis);
