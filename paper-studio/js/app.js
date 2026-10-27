// UI: hash-routed views, two-way binding through data-bind paths, and a
// margin of notes ("批注") beside each module that re-renders as you type.
(function () {
  const S = window.Sigao;
  const esc = S.text.escapeHtml;
  const app = document.getElementById('app');

  let state = S.store.load() || S.sample.create();
  let pending = '';
  let verifying = false;

  const MODULES = [
    { id: 'overview', name: '项目概览', pain: '整体进度和下一步' },
    { id: 'outline', name: '论证主线', pain: '结构不一致 · 开不了头' },
    { id: 'matrix', name: '文献矩阵', pain: '综述没论点 · 找不到缺口' },
    { id: 'cite', name: '引用验证', pain: '引用出错 · AI 编造文献' },
    { id: 'check', name: '一致性检查', pain: '讨论和结果对不上' },
    { id: 'review', name: '审稿意见', pain: '大修拆不成任务' },
    { id: 'submit', name: '投稿清单', pain: '投稿前漏东西' },
  ];

  const LEVEL = {
    issue: ['需修改', 'pen'], tip: ['建议', 'warn'], gap: ['可能的缺口', 'accent'], ask: ['追问', 'accent'], ok: ['通过', 'ok'],
  };

  // ---------- helpers ----------
  function getPath(obj, path) { return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj); }
  function setPath(obj, path, val) {
    const keys = path.split('.');
    const last = keys.pop();
    const target = keys.reduce((o, k) => (o[k] == null ? (o[k] = {}) : o[k]), obj);
    target[last] = val;
  }
  function save() { S.store.save(state); }
  function fieldLabel(key) { const f = S.outline.FIELDS.find((x) => x.key === key); return f ? f.label : ''; }

  function toast(msg) {
    let t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  function noteHtml(n) {
    const [tag, tone] = LEVEL[n.level] || LEVEL.tip;
    return `<article class="note tone-${tone}">
      <header><span class="note-tag">${tag}</span>${n.field ? `<button class="note-field" data-action="focus" data-target="f-${n.field}">${esc(fieldLabel(n.field))}</button>` : ''}</header>
      <h4>${esc(n.title)}</h4>
      ${n.why ? `<p class="note-why">${esc(n.why)}</p>` : ''}
      ${n.how ? `<p class="note-how"><b>怎么改</b>${esc(n.how)}</p>` : ''}
      ${n.example ? `<details class="note-example"><summary>看一个其他主题的例子</summary><p>${esc(n.example)}</p></details>` : ''}
      ${n.ask ? `<p class="note-ask"><b>想一想</b>${esc(n.ask)}</p>` : ''}
    </article>`;
  }

  function notesPanel(notes, extra) {
    const count = notes.filter((n) => n.level === 'issue').length;
    return `<div class="notes-head">
        <h3>批注</h3>
        <span class="count">${count ? `${count} 处需修改` : '无必改项'}</span>
      </div>
      <p class="notes-rule">只指出问题、说明改法、举其他主题的例子。修改由你自己完成。</p>
      ${extra || ''}
      <div class="notes-list">${notes.map(noteHtml).join('')}</div>`;
  }

  // ---------- module status (used by overview and sidebar) ----------
  function status() {
    const o = state.outline;
    const oNotes = S.outline.check(o);
    const mNotes = S.matrix.analyze(state.matrix);
    const refs = state.refs.results || [];
    const c = S.consistency.check({ question: o.question, method: o.method, ...state.check });
    const rs = S.review.summary(state.review.tasks);
    const checked = S.checklist.ALL.filter((i) => state.submit.checked[i.id]).length;
    const issues = (ns) => ns.filter((n) => n.level === 'issue').length;
    return {
      outline: { value: `${S.outline.filled(o)}/6 个节点`, issues: issues(oNotes), done: S.outline.filled(o) === 6 && !issues(oNotes) },
      matrix: { value: `${state.matrix.filter((r) => r.source.trim()).length} 篇文献`, issues: 0, gaps: mNotes.filter((n) => n.level === 'gap').length },
      cite: { value: `${refs.filter((r) => r.status === 'verified').length}/${refs.length} 条已核实`, issues: refs.filter((r) => r.status === 'mismatch' || r.status === 'notfound').length },
      check: { value: !state.check.results.trim() || !state.check.discussion.trim() ? '还没粘贴正文'
        : c.flagged.length ? `${c.flagged.length} 句待核对` : '未发现问题', issues: issues(c.notes) },
      review: { value: `${rs.done}/${rs.total} 条已处理`, issues: rs.majorOpen },
      submit: { value: `${checked}/${S.checklist.ALL.length} 项`, issues: 0 },
    };
  }

  // ---------- views ----------
  function home() {
    const rows = [
      ['论证主线', '研究问题、缺口、目标、方法、结果、结论六个节点连成一条线，哪里断了就标出来。', '结构不一致 · 开不了头'],
      ['文献矩阵', '每篇文献一行，系统找出反复出现的局限、单一的方法和缺失的样本，帮你看见缺口。', '读了很多却写不出有论点的综述'],
      ['引用验证', '每条引用都到 Crossref 核对作者、年份和标题。查不到的引用会被标出来。', '怕引用出错 · 怕 AI 编造文献'],
      ['一致性检查', '逐句对照讨论和结果，找出没有依据的结论、因果误用和缺失的局限。', '讨论里出现结果中没有的结论'],
      ['审稿意见', '把导师和审稿人的意见拆成任务，标出必改项和含糊的意见，逐条追踪。', '「大修」拆不成可执行的任务'],
      ['投稿清单', '期刊匹配、伦理、数据、经费、作者声明，投稿前逐项核对。', '投稿前不知道漏了什么'],
    ];
    return `<section class="hero wrap">
        <p class="eyebrow">学术写作工作台 · 原型</p>
        <h1>帮你想清楚，<br>不替你写。</h1>
        <p class="lede">从读文献到投稿，思稿在每一步指出问题、讲清改法、给出其他主题的例子。每一个字仍然由你自己写。</p>
        <div class="hero-actions">
          <button class="btn primary" data-action="open-sample">打开示例项目</button>
          <button class="btn" data-action="new-blank">新建空白项目</button>
        </div>
        <p class="fine">数据只保存在你自己的浏览器里。</p>
      </section>
      <section class="wrap modules-list">
        <h2>六个模块，一条论证线</h2>
        <ol class="flow">${rows.map(([n, d, p]) => `<li><div><h3>${n}</h3><p>${d}</p></div><span class="pain">解决：${p}</span></li>`).join('')}</ol>
      </section>
      <section class="wrap redline">
        <h2>AI 红线</h2>
        <div class="redline-grid">
          <div><h3>我们做</h3><ul>
            <li>指出问题在哪里、为什么是问题</li>
            <li>说明修改的方法和步骤</li>
            <li>用其他主题的例子演示写法</li>
            <li>追问，帮你把想法想清楚</li>
            <li>核实引用，排版参考文献</li></ul></div>
          <div class="no"><h3>我们不做</h3><ul>
            <li>改写或续写你的段落</li>
            <li>生成整段、整章或整篇</li>
            <li>一键润色、降 AI 率</li>
            <li>编造或推荐查不到出处的文献</li>
            <li>代写审稿回复信</li></ul></div>
        </div>
      </section>
      <section class="wrap roadmap">
        <h2>规划中</h2>
        <p>写作过程记录（用于证明原创）、期刊匹配、语言问题标注、写作进度与同伴互评、结果图表的叙述指导、Word / LaTeX / Zotero 接入。</p>
      </section>`;
  }

  function overview() {
    const st = status();
    const next = MODULES.slice(1).find((m) => st[m.id] && st[m.id].issues);
    const confirmBar = pending ? `<div class="confirm" role="alert">
        <span>${pending === 'reset' ? '恢复示例项目会覆盖当前所有内容。' : '清空后当前所有内容都会删除。'}</span>
        <button class="btn danger" data-action="confirm">确认</button><button class="btn" data-action="cancel">取消</button></div>` : '';
    const main = `<div class="title-row">
        <label for="f-title" class="sr">论文标题</label>
        <input id="f-title" class="title-input" data-bind="title" value="${esc(state.title)}">
        ${state.sample ? '<span class="sample-chip">示例项目</span>' : ''}
      </div>
      ${confirmBar}
      <div class="status-grid">${MODULES.slice(1).map((m) => {
        const s = st[m.id];
        return `<a class="status-card" href="#${m.id}">
          <span class="status-name">${m.name}</span>
          <span class="status-value">${esc(s.value)}</span>
          ${s.issues ? `<span class="pill tone-pen">${s.issues} 处待处理</span>` : s.gaps ? `<span class="pill tone-accent">${s.gaps} 个缺口线索</span>` : '<span class="pill tone-ok">暂无问题</span>'}
          <span class="status-pain">${m.pain}</span></a>`;
      }).join('')}</div>
      <div class="project-actions">
        <button class="btn" data-action="ask-reset">恢复示例项目</button>
        <button class="btn" data-action="ask-clear">清空，开始我的论文</button>
      </div>`;
    const notes = [];
    if (next) notes.push({ level: 'ask', title: `下一步：处理「${next.name}」`, why: `这里还有 ${st[next.id].issues} 处问题。`, how: '按主线顺序处理：先主线，再文献和引用，最后一致性和投稿。' });
    else notes.push({ level: 'ok', title: '各模块都没有待处理的问题', why: '', how: '投稿前到「投稿清单」逐项核对。' });
    if (state.sample) notes.push({ level: 'tip', title: '你正在看示例项目', why: '示例内容里故意留了一些问题，方便你看到每个模块会给出什么批注。', how: '看完后点「清空，开始我的论文」。' });
    return { main, notes: notesPanel(notes) };
  }

  function outline() {
    const main = `<p class="intro">先用一两句话填完六个节点，不求完美。主线清楚了，每一章都知道自己要写什么。</p>
      <div class="thread">${S.outline.FIELDS.map((f) => `<div class="node">
        <label for="f-${f.key}">${f.label}</label>
        <p class="hint">${f.hint}</p>
        <textarea id="f-${f.key}" rows="3" data-bind="outline.${f.key}">${esc(state.outline[f.key])}</textarea>
        <details class="pattern"><summary>看一个其他主题的写法</summary><p>${esc(f.example)}</p></details>
      </div>`).join('')}</div>`;
    return { main, notes: notesPanel(S.outline.check(state.outline)) };
  }

  function matrix() {
    const cols = S.matrix.COLUMNS;
    const main = `<p class="intro">每篇文献一行，用你自己的话填。不要复制摘要：用自己的话概括，才能看出文献之间的关系。</p>
      <div class="table-wrap"><table class="matrix">
        <thead><tr>${cols.map((c) => `<th scope="col">${c.label}</th>`).join('')}<th><span class="sr">操作</span></th></tr></thead>
        <tbody>${state.matrix.map((r, i) => `<tr>${cols.map((c) => c.key === 'relation'
          ? `<td><label class="sr" for="m-${r.id}-relation">与我的研究</label><select id="m-${r.id}-relation" data-bind="matrix.${i}.relation">
              <option value="">选择</option>${S.matrix.RELATIONS.map((x) => `<option${r.relation === x ? ' selected' : ''}>${x}</option>`).join('')}</select></td>`
          : `<td><label class="sr" for="m-${r.id}-${c.key}">${c.label}</label><textarea id="m-${r.id}-${c.key}" rows="3" placeholder="${c.placeholder}" data-bind="matrix.${i}.${c.key}">${esc(r[c.key])}</textarea></td>`).join('')}
          <td><button class="icon-btn" data-action="del-row" data-index="${i}" aria-label="删除第 ${i + 1} 行">删除</button></td></tr>`).join('')}</tbody>
      </table></div>
      <button class="btn" data-action="add-row">添加一篇文献</button>
      ${state.sample ? '<p class="fine">示例中的文献都是真实论文，概括只用于演示，引用前请以原文为准。</p>' : ''}`;
    return { main, notes: notesPanel(S.matrix.analyze(state.matrix)) };
  }

  const STATUS = {
    verified: ['已核实', 'ok'], mismatch: ['有出入', 'warn'], notfound: ['查不到', 'pen'], error: ['连接失败', 'warn'], pending: ['查询中', 'accent'],
  };

  function citeList() {
    const res = state.refs.results || [];
    if (!res.length) return '<p class="empty">粘贴参考文献后点「验证引用」。每行一条，有 DOI 最好。</p>';
    return `<ol class="ref-list">${res.map((r) => {
      const [label, tone] = STATUS[r.status] || STATUS.pending;
      return `<li class="ref">
        <div class="ref-head"><span class="pill tone-${tone}">${label}</span>${r.doi ? `<code>${esc(r.doi)}</code>` : ''}</div>
        <p class="ref-raw">${esc(r.raw)}</p>
        ${(r.issues || []).length ? `<ul class="ref-issues">${r.issues.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
        ${r.note ? `<p class="ref-note">${esc(r.note)}</p>` : ''}
        ${r.record ? `<p class="ref-fixed"><span>核实后的条目</span>${esc(S.cite.format(r.record, state.refs.style))}</p>` : ''}
      </li>`;
    }).join('')}</ol>`;
  }

  function bibliography() {
    return (state.refs.results || []).filter((r) => r.record).map((r) => S.cite.format(r.record, state.refs.style))
      .sort((a, b) => a.localeCompare(b)).join('\n');
  }

  function citeNotes() {
    const res = state.refs.results || [];
    const n = (s) => res.filter((r) => r.status === s).length;
    const notes = [];
    if (n('notfound')) notes.push({ level: 'issue', title: `${n('notfound')} 条引用查不到`, why: '可能是作者、标题写错了，也可能这篇文献根本不存在（例如 AI 编造的引用）。', how: '找到原文核对。找不到原文的文献，不要引用。' });
    if (n('mismatch')) notes.push({ level: 'issue', title: `${n('mismatch')} 条引用与数据库记录有出入`, why: '年份、作者或标题写错，审稿人和编辑很容易发现。', how: '以「核实后的条目」为准，同时修改正文里对应的引用（例如年份）。' });
    if (n('error')) notes.push({ level: 'tip', title: `${n('error')} 条暂时无法查询`, why: '网络连接失败。', how: '稍后重新点「验证引用」。' });
    if (!notes.length && res.length) notes.push({ level: 'ok', title: '所有引用都已核实', why: '', how: '记得核对正文中的引用和文末列表是否一一对应。' });
    notes.push({ level: 'tip', title: '思稿不会替你找或生成引用', why: '每条引用都应当是你读过的文献。', how: '先在「文献矩阵」里读懂一篇，再引用它。' });
    return notes;
  }

  function cite() {
    const main = `<p class="intro">每行粘贴一条参考文献。有 DOI 的直接核对，没有 DOI 的按标题检索。数据来自 Crossref。</p>
      <label for="f-refs" class="sr">参考文献</label>
      <textarea id="f-refs" class="mono" rows="7" data-bind="refs.input">${esc(state.refs.input)}</textarea>
      <div class="toolbar">
        <button class="btn primary" data-action="verify"${verifying ? ' disabled' : ''}>${verifying ? '正在验证…' : '验证引用'}</button>
        <label for="f-style">格式</label>
        <select id="f-style" data-bind="refs.style" data-rerender="cite-list">${Object.entries(S.cite.STYLES).map(([k, v]) => `<option value="${k}"${state.refs.style === k ? ' selected' : ''}>${v.label}</option>`).join('')}</select>
        <button class="btn" data-action="copy-bib">复制已核实的参考文献</button>
      </div>
      <div id="cite-list">${citeList()}</div>`;
    return { main, notes: notesPanel(citeNotes()) };
  }

  function checkResult() {
    return S.consistency.check({ question: state.outline.question, method: state.outline.method, ...state.check });
  }

  function flaggedList(flagged) {
    if (!flagged.length) return '';
    return `<div class="flagged"><h3>讨论中需要核对的句子</h3><ol>${flagged.map((f) => `<li><q>${esc(f.sentence)}</q><span>${f.reasons.map(esc).join('；')}</span></li>`).join('')}</ol></div>`;
  }

  function check() {
    const r = checkResult();
    const main = `<p class="intro">粘贴论文的结果和讨论。检查会对照「论证主线」里的研究问题和方法。</p>
      <div class="readonly"><span>研究问题（来自论证主线）</span><p>${esc(state.outline.question) || '还没有填写。'}</p><a href="#outline">去修改</a></div>
      <label for="f-results">结果</label>
      <textarea id="f-results" rows="6" data-bind="check.results">${esc(state.check.results)}</textarea>
      <label for="f-discussion">讨论</label>
      <textarea id="f-discussion" rows="8" data-bind="check.discussion">${esc(state.check.discussion)}</textarea>
      <div id="flagged">${flaggedList(r.flagged)}</div>`;
    return { main, notes: notesPanel(r.notes) };
  }

  const LETTER = `<details class="guide" open><summary>回复信的结构</summary>
      <ol><li>开头感谢编辑和审稿人，一两句即可。</li>
      <li>逐条列出：<b>原意见</b> → <b>你的回复</b> → <b>修改位置</b>（页码、行号）。</li>
      <li>同意的意见：说明改了什么。不同意的意见：礼貌地给出理由和证据。</li>
      <li>含糊的意见：写出你的理解，再说明按这个理解做了什么。</li></ol>
      <p class="guide-example"><b>其他主题的例子</b>（城市公园研究）意见：「样本只覆盖三座城市。」回复：「感谢指出。我们在讨论第 4.3 节补充了样本城市的气候范围，并说明结论只适用于亚热带城市（第 15 页第 8–14 行）。」</p></details>`;

  function reviewTasks() {
    const tasks = state.review.tasks;
    if (!tasks.length) return '<p class="empty">粘贴意见后点「拆分成任务」。</p>';
    let last = null;
    return tasks.map((t, i) => {
      const head = t.reviewer !== last ? `<h3 class="reviewer">${esc(t.reviewer)}</h3>` : '';
      last = t.reviewer;
      return `${head}<div class="task${t.done ? ' done' : ''}">
        <div class="task-top">
          <input type="checkbox" id="t-${t.id}-done" data-bind="review.tasks.${i}.done" data-rerender="all"${t.done ? ' checked' : ''}>
          <label for="t-${t.id}-done" class="task-text">${esc(t.text)}</label>
        </div>
        <div class="task-meta">
          <span class="pill tone-accent">${esc(t.category)}</span>
          <label class="sr" for="t-${t.id}-pri">优先级</label>
          <select id="t-${t.id}-pri" data-bind="review.tasks.${i}.priority" data-rerender="notes">${['必改', '建议', '待判断'].map((p) => `<option${t.priority === p ? ' selected' : ''}>${p}</option>`).join('')}</select>
          ${t.vague ? '<span class="pill tone-warn">意见含糊</span>' : ''}
        </div>
        ${t.vague ? '<p class="task-vague">这条意见没有说具体改什么。可以先问清楚；问不到的话，写下你对它的两三种理解，选一种在回复里说明。</p>' : ''}
        <label for="t-${t.id}-plan" class="small">修改方案（自己写）</label>
        <textarea id="t-${t.id}-plan" rows="2" data-bind="review.tasks.${i}.plan" placeholder="打算怎么改？需要补什么分析或文献？">${esc(t.plan)}</textarea>
        <label for="t-${t.id}-where" class="small">修改位置</label>
        <input id="t-${t.id}-where" data-bind="review.tasks.${i}.where" value="${esc(t.where)}" placeholder="如：第 8 页第 12–20 行">
      </div>`;
    }).join('');
  }

  function reviewNotes() {
    const s = S.review.summary(state.review.tasks);
    const notes = [];
    if (!s.total) return [{ level: 'tip', title: '还没有任务', why: '', how: '粘贴意见后点「拆分成任务」。' }];
    notes.push({ level: s.majorOpen ? 'issue' : 'ok', title: s.majorOpen ? `${s.majorOpen} 条必改意见还没处理` : '必改意见都已处理',
      why: `共 ${s.total} 条意见，已处理 ${s.done} 条。`, how: '先处理必改项，尤其是方法和论证类的意见，它们可能牵动多个章节。' });
    if (s.vague) notes.push({ level: 'tip', title: `${s.vague} 条意见比较含糊`, why: '「需要加强」「请完善」这类意见没有说具体改什么。', how: '先列出你的理解，再决定怎么改，并在回复中写明你的理解。' });
    if (s.noPlan) notes.push({ level: 'tip', title: `${s.noPlan} 条还没有写修改方案`, why: '', how: '每条写一句话：改什么、在哪改、需要补什么。' });
    return notes;
  }

  function review() {
    const main = `<p class="intro">粘贴导师或审稿人的意见，按「审稿人 1」「1.」这样的格式效果最好。</p>
      <label for="f-review" class="sr">审稿意见</label>
      <textarea id="f-review" rows="6" data-bind="review.input">${esc(state.review.input)}</textarea>
      <div class="toolbar"><button class="btn primary" data-action="split-review">${state.review.tasks.length ? '重新拆分（会覆盖当前任务）' : '拆分成任务'}</button></div>
      <div id="tasks">${reviewTasks()}</div>`;
    return { main, notes: notesPanel(reviewNotes(), LETTER) };
  }

  function submit() {
    const main = `<p class="intro">投稿前逐项核对。具体要求以目标期刊的作者指南为准。</p>
      ${S.checklist.GROUPS.map((g) => `<fieldset class="checks"><legend>${g.name}</legend>${g.items.map(([id, label, how]) => `
        <div class="check-item"><input type="checkbox" id="c-${id}" data-bind="submit.checked.${id}" data-rerender="notes"${state.submit.checked[id] ? ' checked' : ''}>
        <label for="c-${id}">${label}${how ? `<small>${how}</small>` : ''}</label></div>`).join('')}</fieldset>`).join('')}`;
    const left = S.checklist.ALL.filter((i) => !state.submit.checked[i.id]);
    const notes = left.length
      ? [{ level: 'tip', title: `还有 ${left.length} 项没有核对`, why: left.slice(0, 6).map((i) => i.label).join('；') + (left.length > 6 ? '……' : ''), how: '「声明与伦理」中的项目缺失时，编辑通常会直接退回稿件。' }]
      : [{ level: 'ok', title: '清单全部核对完成', why: '', how: '提交前再通读一遍投稿信。' }];
    return { main, notes: notesPanel(notes) };
  }

  const VIEWS = { overview, outline, matrix, cite, check, review, submit };

  // ---------- render ----------
  function current() { const v = location.hash.slice(1); return v === 'home' || VIEWS[v] ? v : 'home'; }

  function render() {
    const v = current();
    document.querySelectorAll('.top-nav a').forEach((a) => a.classList.toggle('active', (a.getAttribute('href') === '#home') === (v === 'home')));
    if (v === 'home') { app.innerHTML = home(); return; }
    const st = status();
    const m = MODULES.find((x) => x.id === v);
    const view = VIEWS[v]();
    app.innerHTML = `<div class="workspace wrap">
      <nav class="side" aria-label="模块">${MODULES.map((x) => `<a href="#${x.id}"${x.id === v ? ' aria-current="page"' : ''}>
        <span>${x.name}</span>${st[x.id] && st[x.id].issues ? `<b>${st[x.id].issues}</b>` : ''}</a>`).join('')}</nav>
      <section class="module">
        <header class="module-head"><h1>${m.name}</h1><p>${m.pain}</p></header>
        <div class="module-body"><div class="editor">${view.main}</div><aside class="notes" id="notes">${view.notes}</aside></div>
      </section></div>`;
  }

  function refreshNotes() {
    const v = current();
    if (!VIEWS[v]) return;
    const view = VIEWS[v]();
    const notes = document.getElementById('notes');
    if (notes) notes.innerHTML = view.notes;
    if (v === 'check') document.getElementById('flagged').innerHTML = flaggedList(checkResult().flagged);
    const st = status();
    document.querySelectorAll('.side a').forEach((a) => {
      const id = a.getAttribute('href').slice(1);
      const n = st[id] && st[id].issues;
      let b = a.querySelector('b');
      if (n && !b) { b = document.createElement('b'); a.appendChild(b); }
      if (b) { if (n) b.textContent = n; else b.remove(); }
    });
  }

  let timer = null;
  function onEdit(e) {
    const el = e.target.closest('[data-bind]');
    if (!el) return;
    const path = el.dataset.bind;
    setPath(state, path, el.type === 'checkbox' ? el.checked : el.value);
    save();
    const re = el.dataset.rerender;
    if (re === 'all') { render(); return; }
    if (re === 'cite-list') { document.getElementById('cite-list').innerHTML = citeList(); return; }
    clearTimeout(timer);
    timer = setTimeout(refreshNotes, re === 'notes' ? 0 : 250);
  }
  const isChoice = (el) => el.matches('select, input[type=checkbox]');
  app.addEventListener('input', (e) => { if (!isChoice(e.target)) onEdit(e); });
  app.addEventListener('change', (e) => { if (isChoice(e.target)) onEdit(e); });

  async function verifyAll() {
    verifying = true;
    state.refs.results = S.cite.parse(state.refs.input).map((e) => Object.assign(e, { status: 'pending' }));
    render();
    for (const entry of state.refs.results) {
      Object.assign(entry, await S.cite.verify(entry));
      document.getElementById('cite-list') && (document.getElementById('cite-list').innerHTML = citeList());
    }
    verifying = false;
    save();
    if (current() === 'cite') render();
  }

  function copy(text) {
    const done = () => toast('已复制');
    const fallback = () => {
      const ta = document.createElement('textarea');
      ta.value = text; ta.className = 'copy-fallback'; ta.setAttribute('aria-label', '参考文献');
      document.querySelector('#cite-list').prepend(ta); ta.focus(); ta.select();
      toast('请按 Ctrl+C / ⌘C 复制选中的文字');
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
    else fallback();
  }

  const ACTIONS = {
    'open-sample': () => { if (!state.sample) state = S.sample.create(); save(); location.hash = 'overview'; },
    'new-blank': () => { state = S.sample.blank(); save(); location.hash = 'outline'; },
    'ask-reset': () => { pending = 'reset'; render(); },
    'ask-clear': () => { pending = 'clear'; render(); },
    cancel: () => { pending = ''; render(); },
    confirm: () => {
      state = pending === 'reset' ? S.sample.create() : S.sample.blank();
      pending = ''; save(); render(); toast(state.sample ? '已恢复示例项目' : '已清空，可以开始了');
    },
    'add-row': () => { state.matrix.push(S.matrix.blankRow()); save(); render(); },
    'del-row': (el) => { state.matrix.splice(Number(el.dataset.index), 1); save(); render(); },
    verify: () => { if (!verifying) verifyAll(); },
    'copy-bib': () => { const b = bibliography(); if (b) copy(b); else toast('还没有已核实的条目'); },
    'split-review': () => { state.review.tasks = S.review.split(state.review.input); save(); render(); toast(`拆分出 ${state.review.tasks.length} 条任务`); },
    focus: (el) => { const t = document.getElementById(el.dataset.target); if (t) { t.focus(); t.scrollIntoView({ block: 'center', behavior: 'smooth' }); } },
  };
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (el && ACTIONS[el.dataset.action]) { e.preventDefault(); ACTIONS[el.dataset.action](el); }
  });

  window.addEventListener('hashchange', () => { pending = ''; render(); window.scrollTo(0, 0); });
  render();
})();
