// Zotero / EndNote / Mendeley exchange: reads BibTeX and RIS into paper
// records (the same shape Discover uses) and writes them back out.
(function (root) {
  const S = root.Sigao = root.Sigao || {};

  const clean = (s) => String(s || '').replace(/[{}]/g, '').replace(/\\["'`^~=.]?/g, '').replace(/\s+/g, ' ').trim();
  const doiOf = (s) => (String(s || '').match(/10\.\d{4,9}\/\S+/) || [''])[0].replace(/[.,;]$/, '');

  // BibTeX author "Last, First and First Last" -> ["First Last", ...]
  function bibAuthors(s) {
    return clean(s).split(/\s+and\s+/i).filter(Boolean).map((a) => (a.includes(',') ? a.split(',').map((x) => x.trim()).reverse().join(' ') : a).trim());
  }

  function fields(body) {
    const out = {};
    const re = /([a-zA-Z_-]+)\s*=\s*/g;
    let m;
    while ((m = re.exec(body))) {
      let i = re.lastIndex, val = '';
      if (body[i] === '{') {
        let depth = 0, j = i;
        for (; j < body.length; j++) { if (body[j] === '{') depth++; else if (body[j] === '}' && --depth === 0) break; }
        val = body.slice(i + 1, j); re.lastIndex = j + 1;
      } else if (body[i] === '"') {
        const j = body.indexOf('"', i + 1); val = body.slice(i + 1, j); re.lastIndex = j + 1;
      } else {
        const j = body.slice(i).search(/[,\n}]/); val = body.slice(i, j < 0 ? undefined : i + j); re.lastIndex = i + Math.max(j, 0);
      }
      out[m[1].toLowerCase()] = val;
    }
    return out;
  }

  function record(f, type) {
    const doi = doiOf(f.doi) || doiOf(f.url);
    const title = clean(f.title);
    if (!title && !doi) return null;
    return { id: doi ? 'doi:' + doi.toLowerCase() : 'bib:' + title.toLowerCase().slice(0, 80), title: title || 'Untitled', year: Number(String(f.year || '').slice(0, 4)) || null,
      authors: f.authors || [], venue: clean(f.venue), type: type || 'article', cited: 0, doi,
      url: doi ? `https://doi.org/${doi}` : clean(f.url), oaUrl: '', abstract: clean(f.abstract).slice(0, 900) };
  }

  function parseBibtex(text) {
    const out = [];
    const re = /@(\w+)\s*\{\s*[^,]*,/g;
    let m;
    const starts = [];
    while ((m = re.exec(text))) starts.push({ i: m.index, type: m[1].toLowerCase(), body: re.lastIndex });
    starts.forEach((s, k) => {
      if (/^(comment|string|preamble)$/.test(s.type)) return;
      const f = fields(text.slice(s.body, k + 1 < starts.length ? starts[k + 1].i : text.length));
      const r = record({ title: f.title, year: f.year || (f.date || '').slice(0, 4), doi: f.doi, url: f.url, abstract: f.abstract,
        venue: f.journal || f.journaltitle || f.booktitle || f.publisher, authors: bibAuthors(f.author || '') }, s.type === 'article' ? 'article' : s.type);
      if (r) out.push(r);
    });
    return out;
  }

  function parseRis(text) {
    const out = [];
    let cur = null;
    String(text).split(/\r?\n/).forEach((line) => {
      const m = line.match(/^([A-Z][A-Z0-9])\s{1,2}-\s?(.*)$/);
      if (!m) return;
      const [, tag, val] = m;
      if (tag === 'TY') { cur = { authors: [], type: val.trim() }; return; }
      if (!cur) return;
      if (tag === 'ER') { const r = record(cur, /JOUR/.test(cur.type) ? 'article' : 'other'); if (r) out.push(r); cur = null; return; }
      if (tag === 'AU' || tag === 'A1') cur.authors.push(val.includes(',') ? val.split(',').map((x) => x.trim()).reverse().join(' ') : val.trim());
      else if ((tag === 'TI' || tag === 'T1') && !cur.title) cur.title = val;
      else if ((tag === 'PY' || tag === 'Y1' || tag === 'DA') && !cur.year) cur.year = (val.match(/\d{4}/) || [''])[0];
      else if ((tag === 'JO' || tag === 'T2' || tag === 'JF') && !cur.venue) cur.venue = val;
      else if (tag === 'DO') cur.doi = val;
      else if (tag === 'UR' && !cur.url) cur.url = val;
      else if (tag === 'AB') cur.abstract = val;
    });
    return out;
  }

  function parse(text) {
    text = String(text || '');
    if (/^\s*TY\s{1,2}-/m.test(text)) return parseRis(text);
    if (/@\w+\s*\{/.test(text)) return parseBibtex(text);
    return [];
  }

  function key(p, used) {
    const last = String((p.authors[0] || 'anon').split(' ').pop()).toLowerCase().replace(/[^a-z]/g, '') || 'anon';
    let k = last + (p.year || ''), n = 0;
    while (used.has(k + (n ? String.fromCharCode(96 + n) : ''))) n++;
    k += n ? String.fromCharCode(96 + n) : '';
    used.add(k);
    return k;
  }
  const brace = (s) => String(s || '').replace(/[{}]/g, '');

  function toBibtex(papers) {
    const used = new Set();
    return papers.map((p) => {
      const f = [['title', `{${brace(p.title)}}`], ['author', p.authors.map((a) => { const parts = a.split(' '); const last = parts.pop(); return parts.length ? `${last}, ${parts.join(' ')}` : last; }).join(' and ')],
        ['journal', p.venue], ['year', p.year], ['doi', p.doi], ['url', p.doi ? '' : p.url]].filter(([, v]) => v);
      return `@article{${key(p, used)},\n${f.map(([k, v]) => `  ${k} = {${brace(v)}}`).join(',\n')}\n}`;
    }).join('\n\n') + '\n';
  }

  function toRis(papers) {
    return papers.map((p) => ['TY  - JOUR', `TI  - ${p.title}`, ...p.authors.map((a) => { const parts = a.split(' '); const last = parts.pop(); return `AU  - ${parts.length ? `${last}, ${parts.join(' ')}` : last}`; }),
      p.year ? `PY  - ${p.year}` : '', p.venue ? `JO  - ${p.venue}` : '', p.doi ? `DO  - ${p.doi}` : '', p.url ? `UR  - ${p.url}` : '', 'ER  - '].filter(Boolean).join('\r\n')).join('\r\n\r\n') + '\r\n';
  }

  S.bib = { parse, parseBibtex, parseRis, toBibtex, toRis };
})(typeof window !== 'undefined' ? window : globalThis);
