// Citation check: every reference must resolve to a real record in Crossref.
// Entries with a DOI are looked up directly; the rest by title. The record is
// compared with what the author typed (year, first author, title), and the
// bibliography is formatted from the verified record, never from guesses.
(function (root) {
  const S = root.Sigao = root.Sigao || {};

  const API = 'https://api.crossref.org/works';
  const DOI_RE = /10\.\d{4,9}\/[^\s"<>，。；]+/i;

  function cleanDoi(d) { return d.replace(/[.,;)\]]+$/, ''); }

  function parse(text) {
    return String(text || '').split(/\n+/).map((l) => l.trim()).filter((l) => l.length > 8).map((raw) => {
      const doi = raw.match(DOI_RE);
      const year = raw.match(/[(（]?\s*((?:19|20)\d{2})[a-z]?\s*[)）]?/);
      return { raw, doi: doi ? cleanDoi(doi[0]) : '', year: year ? Number(year[1]) : null };
    });
  }

  function words(s) {
    return String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
      .replace(/<[^>]+>/g, ' ').replace(/[‐-―]/g, '-').match(/[a-z0-9]{3,}|[一-鿿]/g) || [];
  }

  function titleMatch(title, raw) {
    const w = words(title);
    if (!w.length) return 0;
    const hay = new Set(words(raw));
    return w.filter((x) => hay.has(x)).length / w.length;
  }

  function fromCrossref(m) {
    const date = (m['published-print'] || m['published-online'] || m.issued || {})['date-parts'];
    const strip = (s) => String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    return {
      doi: m.DOI,
      title: strip((m.title || [])[0]),
      journal: strip((m['container-title'] || [])[0]),
      year: date && date[0] && date[0][0] ? date[0][0] : null,
      volume: m.volume || '',
      issue: m.issue || '',
      pages: m.page || m['article-number'] || '',
      authors: (m.author || []).map((a) => ({ family: a.family || a.name || '', given: a.given || '' })),
    };
  }

  // Compare what the author wrote against the verified record.
  function compare(entry, rec) {
    const issues = [];
    if (entry.year && rec.year && entry.year !== rec.year) issues.push(`Year given as ${entry.year}; the record says ${rec.year}`);
    const first = rec.authors[0] && rec.authors[0].family;
    if (first && !words(entry.raw).includes(words(first)[0] || '###')) issues.push(`First author should be ${first}`);
    if (titleMatch(rec.title, entry.raw) < 0.6) issues.push('Title differs substantially from the record');
    return issues;
  }

  async function getJson(url, fetchImpl) {
    const res = await fetchImpl(url, { headers: { Accept: 'application/json' } });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  async function verify(entry, fetchImpl) {
    fetchImpl = fetchImpl || (typeof fetch !== 'undefined' ? fetch.bind(root) : null);
    try {
      if (entry.doi) {
        const json = await getJson(`${API}/${encodeURIComponent(entry.doi)}`, fetchImpl);
        if (!json) return { status: 'notfound', note: `DOI ${entry.doi} does not exist in Crossref` };
        const rec = fromCrossref(json.message);
        const issues = compare(entry, rec);
        return { status: issues.length ? 'mismatch' : 'verified', record: rec, issues };
      }
      const q = entry.raw.replace(/https?:\/\/\S+/g, '').slice(0, 300);
      const json = await getJson(`${API}?rows=1&query.bibliographic=${encodeURIComponent(q)}`, fetchImpl);
      const item = json && json.message && json.message.items && json.message.items[0];
      if (!item) return { status: 'notfound', note: 'No matching record found' };
      const rec = fromCrossref(item);
      if (titleMatch(rec.title, entry.raw) < 0.7) {
        return { status: 'notfound', note: `No record with a matching title. The closest is "${rec.title}" (${rec.year || 'n.d.'}), which does not match. Check the original source.` };
      }
      const issues = compare(entry, rec);
      issues.unshift('No DOI given; matched by title');
      return { status: issues.length > 1 ? 'mismatch' : 'verified', record: rec, issues };
    } catch (e) {
      return { status: 'error', note: 'Could not reach Crossref. Preview environments block outside requests; this works once the site is deployed.' };
    }
  }

  function initials(given) {
    return String(given || '').split(/[\s.]+/).filter(Boolean)
      .map((p) => p.split('-').map((x) => x[0].toUpperCase() + '.').join('-')).join(' ');
  }
  const isCjk = (s) => /[一-鿿]/.test(s);

  const fullName = (a) => isCjk(a.family) ? a.family + a.given : [a.given, a.family].filter(Boolean).join(' ');
  const pagesEn = (p) => String(p || '').replace('-', '–');
  const doiUrl = (r) => `https://doi.org/${r.doi}`;

  function apa(r) {
    const names = r.authors.map((a) => isCjk(a.family) ? a.family + a.given : `${a.family}, ${initials(a.given)}`.replace(/,\s*$/, ''));
    const au = names.length <= 1 ? (names[0] || '')
      : names.length <= 20 ? names.slice(0, -1).join(', ') + ', & ' + names[names.length - 1]
        : names.slice(0, 19).join(', ') + ', ... ' + names[names.length - 1];
    const vol = r.volume ? `, ${r.volume}${r.issue ? `(${r.issue})` : ''}` : '';
    const pages = r.pages ? `, ${pagesEn(r.pages)}` : '';
    return `${au} (${r.year || 'n.d.'}). ${r.title}. ${r.journal}${vol}${pages}. ${doiUrl(r)}`;
  }

  // Vancouver (ICMJE/NLM): up to six authors, then "et al."; full journal
  // name, because Crossref does not give the NLM abbreviation.
  function vancouver(r) {
    const names = r.authors.map((a) => `${a.family} ${initials(a.given).replace(/[.\s-]/g, '')}`.trim());
    const au = names.length > 6 ? names.slice(0, 6).join(', ') + ', et al' : names.join(', ');
    const vol = r.volume ? `;${r.volume}${r.issue ? `(${r.issue})` : ''}` : '';
    const pages = r.pages ? `:${r.pages.replace('–', '-')}` : '';
    return `${au}. ${r.title}. ${r.journal}. ${r.year}${vol}${pages}. doi:${r.doi}`;
  }

  // Chicago author-date: first author inverted, the rest in natural order;
  // more than ten authors -> first seven and "et al."
  function chicago(r) {
    const list = r.authors.length > 10 ? r.authors.slice(0, 7) : r.authors;
    const names = list.map((a, i) => (i === 0 ? [a.family, a.given].filter(Boolean).join(', ') : fullName(a)));
    let au = names.length <= 1 ? (names[0] || '') : names.slice(0, -1).join(', ') + ', and ' + names[names.length - 1];
    if (r.authors.length > 10) au = names.join(', ') + ', et al';
    const vol = r.volume ? ` ${r.volume}${r.issue ? ` (${r.issue})` : ''}` : '';
    const pages = r.pages ? `: ${pagesEn(r.pages)}` : '';
    return `${au}. ${r.year || 'n.d.'}. "${r.title}." ${r.journal}${vol}${pages}. ${doiUrl(r)}.`;
  }

  const STYLES = { apa: { label: 'APA 7th', fn: apa }, vancouver: { label: 'Vancouver', fn: vancouver }, chicago: { label: 'Chicago author-date', fn: chicago } };

  function format(rec, style) { return (STYLES[style] || STYLES.apa).fn(rec); }

  S.cite = { parse, verify, compare, fromCrossref, format, titleMatch, STYLES };
})(typeof window !== 'undefined' ? window : globalThis);
