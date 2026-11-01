// Published examples: open-access papers on a similar topic, split into the
// same sections as the writer's paper, so a section can be read side by side
// with how published authors wrote theirs. Every excerpt carries its source
// (title, authors, journal, year, DOI, licence). Sources: Europe PMC
// open-access full texts; published abstracts from OpenAlex as a fallback.
(function (root) {
  const S = root.Sigao = root.Sigao || {};
  const EPMC = 'https://www.ebi.ac.uk/europepmc/webservices/rest';

  // Maps a section heading in a published paper to one of our section keys.
  const HEAD = [
    ['background', /literature review|related work|theoretical (background|framework)|conceptual framework/i],
    ['introduction', /^\s*(\d+(\.\d+)*\.?\s*)?(introduction|background|rationale)/i],
    ['methods', /method|materials|study design|participants|experimental (section|procedures)|data and/i],
    ['analysis', /^\s*(\d+(\.\d+)*\.?\s*)?(statistical )?analys[ie]s/i],
    ['results', /^\s*(\d+(\.\d+)*\.?\s*)?(results?|findings)/i],
    ['discussion', /discussion/i],
    ['conclusion', /conclusion|concluding/i],
  ];
  const keyOf = (title) => { const h = HEAD.find(([, re]) => re.test(title || '')); return h ? h[0] : ''; };

  const clip = (t, n) => (t.length > n ? t.slice(0, n).replace(/\s+\S*$/, '') + '…' : t);
  const textOf = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');

  async function get(url, opts, asText) {
    const f = opts.fetch || (typeof fetch !== 'undefined' ? fetch.bind(root) : null);
    let res;
    try { res = await f(url); } catch (e) { res = null; }
    if ((!res || !res.ok) && opts.proxy) { try { res = await f(opts.proxy + '/api/search?url=' + encodeURIComponent(url)); } catch (e) { res = null; } }
    if (!res || !res.ok) return null;
    return asText ? res.text() : res.json();
  }

  // The licence as a link when it names a Creative Commons licence, otherwise a short label.
  function licence(lic) {
    if (!lic) return '';
    const attr = [...lic.attributes].find((a) => /href$/.test(a.name));
    const url = (attr && attr.value) || (textOf(lic).match(/https?:\/\/creativecommons\.org\/[a-z/.-]*\d\.\d\/?/i) || [])[0];
    if (url) return url;
    return /open[- ]access/i.test(textOf(lic)) ? 'Open access' : textOf(lic).slice(0, 80);
  }

  // Parses a JATS full text into sections plus its citation details.
  function parseJats(xml) {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const meta = doc.querySelector('front article-meta') || doc;
    const q = (sel) => meta.querySelector(sel);
    const doi = textOf([...meta.querySelectorAll('article-id')].find((x) => x.getAttribute('pub-id-type') === 'doi'));
    const names = [...meta.querySelectorAll('contrib name')];
    const authors = names.map((n) => [textOf(n.querySelector('given-names')), textOf(n.querySelector('surname'))].filter(Boolean).join(' ')).filter(Boolean);
    const lead = textOf(names[0] && names[0].querySelector('surname'));
    const year = textOf([...meta.querySelectorAll('pub-date year')][0]);
    const lic = doc.querySelector('license');
    const sections = {};
    const abs = q('abstract');
    if (abs) sections.abstract = clip(textOf(abs), 2500);
    [...doc.querySelectorAll('body > sec')].forEach((sec) => {
      const k = keyOf(textOf(sec.querySelector(':scope > title')));
      if (!k) return;
      const paras = [...sec.querySelectorAll('p')].map(textOf).filter(Boolean).join('\n\n');
      if (paras) sections[k] = clip(sections[k] ? sections[k] + '\n\n' + paras : paras, 6000);
    });
    return {
      title: textOf(q('title-group article-title')),
      journal: textOf(doc.querySelector('journal-title')),
      publisher: textOf(doc.querySelector('publisher-name')),
      year, authors, doi, lead,
      license: licence(lic),
      sections,
    };
  }

  // Finds up to `max` open-access papers with full text on the topic.
  async function find(query, opts) {
    opts = opts || {};
    const q = `(${String(query || '').replace(/[()"]/g, ' ').trim()}) AND OPEN_ACCESS:y AND HAS_FT:y`;
    const list = await get(`${EPMC}/search?query=${encodeURIComponent(q)}&resultType=lite&format=json&pageSize=12`, opts);
    const hits = ((list && list.resultList && list.resultList.result) || []).filter((r) => r.pmcid).slice(0, opts.max || 5);
    const papers = await Promise.all(hits.map(async (h) => {
      const xml = await get(`${EPMC}/${h.pmcid}/fullTextXML`, opts, true);
      if (!xml) return null;
      try {
        const p = parseJats(xml);
        return Object.assign(p, {
          id: h.pmcid,
          title: p.title || h.title,
          journal: p.journal || h.journalTitle || '',
          year: p.year || h.pubYear || '',
          authors: p.authors.length ? p.authors : String(h.authorString || '').split(',').map((x) => x.trim()).filter(Boolean),
          lead: p.lead || String(h.authorString || '').split(/[ ,]/)[0] || '',
          doi: p.doi || h.doi || '',
          url: p.doi || h.doi ? `https://doi.org/${p.doi || h.doi}` : `https://europepmc.org/article/PMC/${h.pmcid}`,
          source: 'Europe PMC (open access)',
        });
      } catch (e) { return null; }
    }));
    return papers.filter((p) => p && Object.keys(p.sections).length >= 2);
  }

  // Published abstracts (OpenAlex) to compare an abstract with, when no full texts are found.
  function fromAbstracts(results) {
    return (results || []).filter((r) => r.abstract && r.abstract.length > 300).slice(0, 5).map((r) => ({
      id: r.id, title: r.title, journal: r.venue, year: r.year, authors: r.authors, lead: String((r.authors || [])[0] || '').split(' ').pop(), doi: r.doi, url: r.url,
      license: '', source: 'OpenAlex (abstract only)', sections: { abstract: r.abstract },
    }));
  }

  // Simple measures to put side by side.
  function measures(text) {
    const t = String(text || '');
    const sents = S.text ? S.text.sentences(t) : t.split(/(?<=[.!?])\s+/);
    const words = t.split(/\s+/).filter(Boolean).length;
    const cites = (S.discover ? S.discover.citationsIn(t).length : 0) + (t.match(/\[\d+(?:\s*[,–-]\s*\d+)*\]/g) || []).length;
    return {
      words,
      paragraphs: t.split(/\n\s*\n/).filter((x) => x.trim()).length,
      sentenceLength: sents.length ? Math.round(words / sents.length) : 0,
      citations: cites,
      numbers: (t.match(/\b\d+(\.\d+)?%?/g) || []).length,
      hedges: (t.match(/\b(may|might|could|suggests?|possibly|likely|appears?)\b/gi) || []).length,
    };
  }

  const cite = (p) => `${(p.authors || []).slice(0, 3).join(', ')}${(p.authors || []).length > 3 ? ' et al.' : ''} (${p.year || 'n.d.'}). ${p.title}. ${p.journal || ''}`.trim();

  S.exemplars = { find, fromAbstracts, parseJats, measures, keyOf, cite };
})(typeof window !== 'undefined' ? window : globalThis);
