// 文献矩阵: one row per paper. The analysis does not write the review; it
// points at patterns (repeated limitations, one dominant method, no dissent)
// and asks the questions that turn a pile of summaries into a gap.
(function (root) {
  const S = root.Sigao = root.Sigao || {};
  const T = S.text;

  const COLUMNS = [
    { key: 'source', label: '文献', placeholder: '作者 (年份)' },
    { key: 'sample', label: '样本与情境', placeholder: '谁、在哪、多少人' },
    { key: 'method', label: '方法', placeholder: '设计与分析方法' },
    { key: 'finding', label: '主要发现', placeholder: '用你自己的话概括' },
    { key: 'limitation', label: '局限', placeholder: '作者承认的或你发现的' },
    { key: 'relation', label: '与我的研究', placeholder: '' },
  ];
  const RELATIONS = ['支持', '矛盾', '方法参考', '背景'];

  const DESIGNS = [
    ['横断面', /横断|cross-sectional|问卷|survey|questionnaire/i],
    ['纵向/队列', /纵向|追踪|队列|longitudinal|cohort|panel/i],
    ['实验/干预', /实验|干预|随机|experiment|trial|intervention|rct/i],
    ['综述/元分析', /综述|元分析|meta|review/i],
    ['质性', /访谈|质性|扎根|interview|qualitative|ethnograph/i],
  ];

  function blankRow() {
    return { id: 'r' + Math.random().toString(36).slice(2, 8), source: '', sample: '', method: '', finding: '', limitation: '', relation: '' };
  }

  function yearOf(row) {
    const m = String(row.source || '').match(/(19|20)\d{2}/);
    return m ? Number(m[0]) : null;
  }

  // Clauses (split at punctuation) that recur across rows, as [clause, rowCount].
  function repeatedClauses(cells) {
    const perRow = cells.map((c) => String(c || '').split(/[；;，,、。.]+/).map((x) => x.trim()).filter((x) => T.terms(x).size));
    const seen = [];
    perRow.forEach((clauses, i) => clauses.forEach((c) => {
      if (seen.some(([s]) => T.coverage(c, s) >= 0.5 || T.coverage(s, c) >= 0.5)) return;
      const n = 1 + perRow.filter((other, j) => j !== i && other.some((o) => T.coverage(c, o) >= 0.5)).length;
      if (n >= 2) seen.push([c, n]);
    }));
    return seen.sort((a, b) => b[1] - a[1]).slice(0, 4);
  }

  function analyze(rows, now) {
    rows = (rows || []).filter((r) => COLUMNS.some((c) => String(r[c.key] || '').trim()));
    now = now || new Date().getFullYear();
    const notes = [];

    if (rows.length < 3) {
      notes.push({ level: 'tip', title: `目前只有 ${rows.length} 篇文献`,
        why: '少于 3 篇时，看不出共同点和分歧，也就很难判断缺口。',
        how: '先把和你研究问题最相关的 5～10 篇填进来，每篇只填一行。' });
      return notes;
    }

    const empty = rows.filter((r) => !String(r.limitation || '').trim()).length;
    if (empty) {
      notes.push({ level: 'tip', title: `${empty} 篇文献还没有填「局限」`,
        why: '缺口最常藏在前人的局限里。', how: '回到原文的讨论和局限部分，记下作者自己承认的不足。' });
    }

    const designCount = DESIGNS.map(([name, re]) => [name, rows.filter((r) => re.test(r.method || '')).length]);
    const top = designCount.slice().sort((a, b) => b[1] - a[1])[0];
    if (top[1] >= Math.ceil(rows.length * 0.6)) {
      const missing = designCount.filter(([, n]) => n === 0).map(([name]) => name);
      notes.push({ level: 'gap', title: `${top[1]}/${rows.length} 篇用的是${top[0]}设计`,
        why: '同一种设计占多数时，它的共同弱点就是整个领域的弱点。',
        how: `考虑你的研究能否在设计上补一块，例如：${missing.slice(0, 3).join('、') || '换一种数据来源'}。`,
        ask: `${top[0]}设计回答不了的问题是什么？你的研究能回答吗？` });
    }

    const repeated = repeatedClauses(rows.map((r) => r.limitation));
    if (repeated.length) {
      notes.push({ level: 'gap', title: '同样的局限在多篇文献里反复出现',
        why: `${repeated.map(([c, n]) => `「${c}」${n} 篇`).join('，')}。一个被多次承认却没人解决的局限，往往就是缺口。`,
        how: '把这些局限归成一两类，写成「已有研究多……，较少……」的句式，填回论证主线的「研究缺口」。',
        ask: '这个局限是因为做不到，还是因为没人去做？' });
    }

    const rel = (name) => rows.filter((r) => r.relation === name).length;
    if (rel('矛盾') && rel('支持')) {
      notes.push({ level: 'gap', title: `有 ${rel('矛盾')} 篇文献和其他结论相反`,
        why: '结论相互矛盾，说明有条件在起作用，这是写出有论点的综述的好材料。',
        how: '对比矛盾双方的样本、测量和情境，看差异能否解释分歧。综述里按「分歧及其原因」组织，而不是按文献逐篇罗列。',
        ask: '什么条件下结论成立，什么条件下不成立？' });
    } else if (rows.length >= 3 && !rel('矛盾')) {
      notes.push({ level: 'tip', title: '所有文献的结论方向一致',
        why: '一边倒的文献可能是真实共识，也可能是你还没检索到不同的声音，或者存在发表偏倚。',
        how: '用「null result」「no association」「不显著」等词再检索一次。',
        ask: '有没有研究发现相反或不显著的结果？' });
    }

    const years = rows.map(yearOf).filter(Boolean);
    if (years.length && Math.max(...years) <= now - 4) {
      notes.push({ level: 'tip', title: `最新的一篇是 ${Math.max(...years)} 年`,
        why: '审稿人常要求补充近三年的文献，否则会质疑缺口是否已经被别人补上。',
        how: '按年份倒序检索近三年的研究，确认缺口仍然存在。' });
    }

    const samples = rows.map((r) => r.sample).filter((x) => String(x || '').trim());
    if (samples.length >= 3) {
      notes.push({ level: 'ask', title: '对照一下样本与情境',
        why: `已有样本：${samples.map((x) => '「' + x + '」').join('；')}。`,
        how: '看看哪类人群、地区或场景没有被研究过。',
        ask: '你的样本和这些研究相比，新在哪里？' });
    }
    return notes;
  }

  S.matrix = { COLUMNS, RELATIONS, blankRow, analyze };
})(typeof window !== 'undefined' ? window : globalThis);
