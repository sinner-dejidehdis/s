// 审稿意见拆解: turn pasted reviewer or supervisor comments into a task list.
// Each task gets a category, a priority guess and a "vague" flag; the author
// writes the plan and the reply themselves.
(function (root) {
  const S = root.Sigao = root.Sigao || {};

  const CATEGORIES = [
    ['方法', /method|design|sampl|statist|analys|model|variable|measure|reliab|valid|方法|样本|设计|统计|模型|变量|测量|信度|效度|问卷/i],
    ['论证与讨论', /discussion|claim|argu|conclu|interpret|caus|limitation|generaliz|讨论|结论|论证|推论|解释|因果|局限|推广/i],
    ['数据与结果', /data|result|table|figure|fig\.|图|表|数据|结果/i],
    ['文献', /literature|reference|cite|citation|recent|文献|引用|参考/i],
    ['语言与格式', /language|grammar|typo|format|english|spell|word|语言|表达|格式|拼写|错别字|语法/i],
  ];
  const MAJOR = /must|essential|major|serious|not convinc|not support|unclear|fail|critical|必须|务必|严重|重大|关键|不清楚|无法|没有说明|不成立/i;
  const MINOR = /minor|typo|could|consider|might|suggest|optional|建议|可以|可考虑|小问题|笔误|错别字/i;
  const VAGUE_WORDS = /加强|完善|改进|提高|提升|深入|更多|再看看|不够|improve|strengthen|more|better|enhance|elaborate|clarify/i;

  const REVIEWER = /^\s*(审稿人|评审人|评审专家|审稿专家|导师|reviewer|referee|editor|编辑)\s*[#:：]?\s*([0-9一二三四五六七八九十]*)\s*[:：]?\s*$/i;
  const ITEM = /^\s*(?:\d{1,2}\s*[.)、．]|[（(]\d{1,2}[)）]|[-•*·]|comment\s*\d+\s*[:.]?|第[一二三四五六七八九十\d]+[条点][:：、]?)\s*/i;

  function categorize(text) {
    const hit = CATEGORIES.find(([, re]) => re.test(text));
    return hit ? hit[0] : '其他';
  }

  function priority(text) {
    if (MAJOR.test(text)) return '必改';
    if (MINOR.test(text)) return '建议';
    return '待判断';
  }

  function isVague(text) {
    const core = text.replace(/[\s，。,.;；:：!！?？]/g, '');
    const cjk = (core.match(/[一-鿿]/g) || []).length;
    const words = (text.match(/[a-z]+/gi) || []).length;
    const short = cjk ? cjk < 14 : words < 7;
    return short && VAGUE_WORDS.test(text);
  }

  function split(raw) {
    const lines = String(raw || '').replace(/\r/g, '').split('\n');
    const items = [];
    let reviewer = '';
    let cur = null;
    const push = () => { if (cur && cur.text.trim()) items.push(cur); cur = null; };

    lines.forEach((line) => {
      const head = line.match(REVIEWER);
      if (head) { push(); reviewer = line.trim().replace(/[:：]$/, ''); return; }
      if (!line.trim()) { push(); return; }
      if (ITEM.test(line)) { push(); cur = { reviewer, text: line.replace(ITEM, '').trim() }; return; }
      if (cur) cur.text += ' ' + line.trim();
      else cur = { reviewer, text: line.trim() };
    });
    push();

    // A single unnumbered paragraph: fall back to one task per sentence.
    if (items.length === 1 && !ITEM.test(String(raw).trim())) {
      const parts = items[0].text.split(/(?<=[。！？!?；;])|(?<=\.)\s+(?=[A-Z])/).map((x) => x.trim()).filter((x) => x.length > 3);
      if (parts.length > 1) return parts.map((text, i) => task(items[0].reviewer, text, i));
    }
    return items.map((it, i) => task(it.reviewer, it.text, i));
  }

  function task(reviewer, text, i) {
    return { id: 't' + i + Math.random().toString(36).slice(2, 6), reviewer: reviewer || '意见', text,
      category: categorize(text), priority: priority(text), vague: isVague(text), plan: '', where: '', done: false };
  }

  function summary(tasks) {
    const by = (p) => tasks.filter((t) => t.priority === p);
    return {
      total: tasks.length,
      done: tasks.filter((t) => t.done).length,
      major: by('必改').length,
      majorOpen: by('必改').filter((t) => !t.done).length,
      vague: tasks.filter((t) => t.vague && !t.plan.trim()).length,
      noPlan: tasks.filter((t) => !t.done && !t.plan.trim()).length,
    };
  }

  S.review = { split, categorize, priority, isVague, summary };
})(typeof window !== 'undefined' ? window : globalThis);
