// 引用验证: every reference must resolve to a real record in Crossref.
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
    if (entry.year && rec.year && entry.year !== rec.year) issues.push(`年份写的是 ${entry.year}，数据库记录是 ${rec.year}`);
    const first = rec.authors[0] && rec.authors[0].family;
    if (first && !words(entry.raw).includes(words(first)[0] || '###')) issues.push(`第一作者应为 ${first}`);
    if (titleMatch(rec.title, entry.raw) < 0.6) issues.push('标题和数据库记录差别较大');
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
        if (!json) return { status: 'notfound', note: `DOI ${entry.doi} 在 Crossref 中不存在` };
        const rec = fromCrossref(json.message);
        const issues = compare(entry, rec);
        return { status: issues.length ? 'mismatch' : 'verified', record: rec, issues };
      }
      const q = entry.raw.replace(/https?:\/\/\S+/g, '').slice(0, 300);
      const json = await getJson(`${API}?rows=1&query.bibliographic=${encodeURIComponent(q)}`, fetchImpl);
      const item = json && json.message && json.message.items && json.message.items[0];
      if (!item) return { status: 'notfound', note: '数据库里查不到这篇文献' };
      const rec = fromCrossref(item);
      if (titleMatch(rec.title, entry.raw) < 0.7) {
        return { status: 'notfound', note: `查不到标题匹配的文献。最接近的是「${rec.title}」(${rec.year || '年份不详'})，但标题不一致，请核对原文。` };
      }
      const issues = compare(entry, rec);
      issues.unshift('原文没有 DOI，已按标题找到');
      return { status: issues.length > 1 ? 'mismatch' : 'verified', record: rec, issues };
    } catch (e) {
      return { status: 'error', note: '无法连接 Crossref。预览环境会拦截外部请求；部署到网站后即可查询。' };
    }
  }

  function initials(given) {
    return String(given || '').split(/[\s.]+/).filter(Boolean)
      .map((p) => p.split('-').map((x) => x[0].toUpperCase() + '.').join('-')).join(' ');
  }
  const isCjk = (s) => /[一-鿿]/.test(s);

  function apa(r) {
    const names = r.authors.map((a) => isCjk(a.family) ? a.family + a.given : `${a.family}, ${initials(a.given)}`.replace(/,\s*$/, ''));
    let au = names.length <= 1 ? (names[0] || '')
      : names.length <= 20 ? names.slice(0, -1).join(', ') + ', & ' + names[names.length - 1]
        : names.slice(0, 19).join(', ') + ', ... ' + names[names.length - 1];
    const vol = r.volume ? `, ${r.volume}${r.issue ? `(${r.issue})` : ''}` : '';
    const pages = r.pages ? `, ${r.pages.replace('-', '–')}` : '';
    return `${au} (${r.year || 'n.d.'}). ${r.title}. ${r.journal}${vol}${pages}. https://doi.org/${r.doi}`;
  }

  function gbt(r) {
    const names = r.authors.map((a) => isCjk(a.family) ? a.family + a.given
      : `${a.family.toUpperCase()} ${initials(a.given).replace(/\./g, '').replace(/-/g, ' ')}`.trim());
    const etal = isCjk(r.title) ? ', 等' : ', et al';
    const au = names.length > 3 ? names.slice(0, 3).join(', ') + etal : names.join(', ');
    const vol = r.volume ? `, ${r.volume}${r.issue ? `(${r.issue})` : ''}` : '';
    const pages = r.pages ? `: ${r.pages.replace('–', '-')}` : '';
    return `${au}. ${r.title}[J]. ${r.journal}, ${r.year}${vol}${pages}. DOI:${r.doi}.`;
  }

  const STYLES = { apa: { label: 'APA 第 7 版', fn: apa }, gbt: { label: 'GB/T 7714-2015', fn: gbt } };

  function format(rec, style) { return (STYLES[style] || STYLES.apa).fn(rec); }

  S.cite = { parse, verify, compare, fromCrossref, format, titleMatch, STYLES };
})(typeof window !== 'undefined' ? window : globalThis);
