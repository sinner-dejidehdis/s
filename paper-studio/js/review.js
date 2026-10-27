// Reviewer comments: turn pasted reviewer or supervisor comments into a task
// list. Each task gets a category, a priority guess and a "vague" flag; the
// author writes the plan and the reply themselves.
(function (root) {
  const S = root.Sigao = root.Sigao || {};

  const CATEGORIES = [
    ['Methods', /method|design|sampl|statist|analys|model|variable|measure|reliab|valid|instrument|方法|样本|设计|统计|模型|变量|测量|信度|效度|问卷/i],
    ['Argument & discussion', /discussion|claim|argu|conclu|interpret|caus|limitation|generaliz|generalis|讨论|结论|论证|推论|解释|因果|局限|推广/i],
    ['Language & format', /language|grammar|typo|\bformat|english|spell|wording|proofread|语言|表达|格式|拼写|语法/i],
    ['Literature', /literature|reference|cite|citing|citation|recent work|recent stud|文献|引用|参考/i],
    ['Data & results', /data|result|table|figure|fig\.|数据|结果|图|表/i],
  ];
  const PRIORITIES = ['Must fix', 'Suggested', 'Unclear'];
  const MAJOR = /\bmust\b|essential|major|serious|not convinc|not support|unclear|does not|do not|fails?|missing|lack|critical|必须|务必|严重|重大|关键|不清楚|无法|没有说明|不成立/i;
  const MINOR = /minor|typo|could|consider|might|suggest|optional|perhaps|建议|可以|可考虑|小问题|笔误|错别字/i;
  const VAGUE_WORDS = /improve|strengthen|more|better|enhance|elaborate|clarify|rework|polish|加强|完善|改进|提高|提升|深入|更多/i;

  const REVIEWER = /^\s*(reviewer|referee|editor|supervisor|advisor|审稿人|评审人|评审专家|导师|编辑)\s*#?\s*([0-9a-z一二三四五六七八九十]*)\s*[:：]?\s*(comments?)?\s*[:：]?\s*$/i;
  const SECTION = /^\s*(major|minor)\s+(comments?|issues?|points?|concerns?|revisions?)\s*[:：]?\s*$/i;
  const ITEM = /^\s*(?:\d{1,2}\s*[.)、．:]|[（(]\d{1,2}[)）]|[-•*·]|comment\s*\d+\s*[:.)]?|point\s*\d+\s*[:.)]?)\s*/i;

  function categorize(text) {
    const hit = CATEGORIES.find(([, re]) => re.test(text));
    return hit ? hit[0] : 'Other';
  }

  function priority(text, section) {
    if (MAJOR.test(text)) return 'Must fix';
    if (MINOR.test(text)) return 'Suggested';
    if (section === 'major') return 'Must fix';
    if (section === 'minor') return 'Suggested';
    return 'Unclear';
  }

  function isVague(text) {
    const core = text.replace(/[\s，。,.;；:：!！?？]/g, '');
    const cjk = (core.match(/[一-鿿]/g) || []).length;
    const words = (text.match(/[a-z]+/gi) || []).length;
    const short = cjk ? cjk < 14 : words < 9;
    return short && VAGUE_WORDS.test(text);
  }

  function split(raw) {
    const lines = String(raw || '').replace(/\r/g, '').split('\n');
    const items = [];
    let reviewer = '';
    let section = '';
    let cur = null;
    const push = () => { if (cur && cur.text.trim()) items.push(cur); cur = null; };

    lines.forEach((line) => {
      if (REVIEWER.test(line)) { push(); reviewer = line.trim().replace(/[:：]$/, ''); section = ''; return; }
      const sec = line.match(SECTION);
      if (sec) { push(); section = sec[1].toLowerCase(); return; }
      if (!line.trim()) { push(); return; }
      if (ITEM.test(line)) { push(); cur = { reviewer, section, text: line.replace(ITEM, '').trim() }; return; }
      if (cur) cur.text += ' ' + line.trim();
      else cur = { reviewer, section, text: line.trim() };
    });
    push();

    // A single unnumbered paragraph: fall back to one task per sentence.
    if (items.length === 1 && !ITEM.test(String(raw).trim())) {
      const parts = items[0].text.split(/(?<=[。！？!?；;])|(?<=[a-z)]\.)\s+(?=[A-Z])/).map((x) => x.trim()).filter((x) => x.length > 3);
      if (parts.length > 1) return parts.map((text, i) => task(items[0].reviewer, items[0].section, text, i));
    }
    return items.map((it, i) => task(it.reviewer, it.section, it.text, i));
  }

  function task(reviewer, section, text, i) {
    return { id: 't' + i + Math.random().toString(36).slice(2, 6), reviewer: reviewer || 'Comments', text,
      category: categorize(text), priority: priority(text, section), vague: isVague(text), plan: '', where: '', done: false };
  }

  function summary(tasks) {
    const by = (p) => tasks.filter((t) => t.priority === p);
    return {
      total: tasks.length,
      done: tasks.filter((t) => t.done).length,
      major: by('Must fix').length,
      majorOpen: by('Must fix').filter((t) => !t.done).length,
      vague: tasks.filter((t) => t.vague && !t.plan.trim()).length,
      noPlan: tasks.filter((t) => !t.done && !t.plan.trim()).length,
    };
  }

  S.review = { split, categorize, priority, isVague, summary, PRIORITIES };
})(typeof window !== 'undefined' ? window : globalThis);
