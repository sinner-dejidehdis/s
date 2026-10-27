// Text helpers shared by the checkers: term extraction for Chinese and English,
// sentence splitting and overlap scores. Rule-based on purpose: the prototype
// runs without any AI backend.
(function (root) {
  const S = root.Sigao = root.Sigao || {};

  // Single characters that carry no topic meaning; Chinese runs are cut at them
  // before taking bigrams, so "使用会损害" yields 使用 / 损害 instead of 用会 / 会损.
  const STOP_CHARS = new Set('的了和与在是会对及等也都而或被把这那其之于以为个种可将并且就还又很更最所此该从到由向给让着过吗呢吧啊有没'.split(''));
  const STOP_BIGRAMS = new Set([
    '研究', '本研', '我们', '本文', '结果', '表明', '发现', '说明', '显示', '可能', '进一', '一步', '通过',
    '进行', '具有', '一个', '这些', '其中', '因此', '但是', '可以', '认为', '方面', '情况', '分析', '数据',
    '问题', '如何', '什么', '是否', '哪些', '为什', '之间', '关系', '相关', '提出', '证明', '意味', '影响',
    '不同', '已有', '较少', '缺少', '主要', '我的', '目前', '需要', '能够', '应当', '如果', '虽然', '由于',
  ]);
  const EN_STOP = new Set(('the and for with that this these those from into are was were been being has have had our ' +
    'their its not but can may might than then also which who what how why whether does did study studies result ' +
    'results show shows showed shown suggest suggests suggested finding findings between among effect effects ' +
    'relationship research data paper using used based such more most less other there here they them we you your ' +
    'about over under within without across per each both all any some only very much many will would should could ' +
    'one two three first second however therefore thus while when where whose authors author please').split(' '));

  function stem(w) {
    if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
    if (w.length > 5 && w.endsWith('ing')) return w.slice(0, -3);
    if (w.length > 4 && w.endsWith('ed')) return w.slice(0, -2);
    if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
    return w;
  }

  function terms(text) {
    const out = new Set();
    const s = String(text || '');
    (s.toLowerCase().match(/[a-z][a-z-]{2,}/g) || []).forEach((raw) => {
      const w = stem(raw.replace(/-/g, ''));
      if (w.length >= 3 && !EN_STOP.has(w)) out.add(w);
    });
    (s.match(/[一-鿿]+/g) || []).forEach((run) => {
      let seg = '';
      const flush = () => {
        for (let i = 0; i + 1 < seg.length; i++) {
          const b = seg.slice(i, i + 2);
          if (!STOP_BIGRAMS.has(b)) out.add(b);
        }
        seg = '';
      };
      for (const ch of run) {
        if (STOP_CHARS.has(ch)) flush(); else seg += ch;
      }
      flush();
    });
    return out;
  }

  // Share of a's terms that also appear in b (0..1). Empty a counts as fully covered.
  function coverage(a, b) {
    const ta = a instanceof Set ? a : terms(a);
    const tb = b instanceof Set ? b : terms(b);
    if (!ta.size) return 1;
    let hit = 0;
    ta.forEach((t) => { if (tb.has(t)) hit++; });
    return hit / ta.size;
  }

  function sentences(text) {
    return String(text || '')
      .split(/(?<=[。！？!?；;])|\n+|(?<=[a-z0-9)]\.)\s+(?=[A-Z])/)
      .map((x) => x.trim())
      .filter((x) => x.length > 1);
  }

  function has(text, re) { return re.test(String(text || '')); }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  S.text = { terms, coverage, sentences, has, escapeHtml, stem };
})(typeof window !== 'undefined' ? window : globalThis);
