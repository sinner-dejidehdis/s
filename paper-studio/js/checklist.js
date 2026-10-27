// 投稿清单: what journals commonly ask for before a manuscript goes out.
(function (root) {
  const S = root.Sigao = root.Sigao || {};

  const GROUPS = [
    { name: '期刊匹配', items: [
      ['scope', '研究主题在期刊的目标与范围（Aims & Scope）之内', '读期刊官网的 Aims & Scope，再看近一年发表的 5 篇文章是否和你的研究相近。'],
      ['type', '文章类型符合要求（研究论文、短篇通讯、综述）', '不同类型有不同的字数和结构要求。'],
      ['length', '字数、摘要字数、关键词数量符合作者指南', '作者指南（Guide for Authors）里通常写明上限。'],
      ['recent', '引用了该期刊或该领域近三年的相关研究', '审稿人常以此判断你是否了解最新进展。'],
    ] },
    { name: '稿件内容', items: [
      ['thread', '研究问题、方法、结果、结论在同一条线上', '用「论证主线」和「一致性检查」各过一遍。'],
      ['limits', '讨论里写了局限性', '主动说明比被审稿人指出更好。'],
      ['refs', '所有参考文献都已核实，正文引用和文末列表一一对应', '用「引用验证」逐条查一次。'],
      ['figures', '图表编号连续，正文都有引用，分辨率达到要求（通常 300 dpi 以上）', ''],
    ] },
    { name: '声明与伦理', items: [
      ['ethics', '涉及人或动物的研究有伦理审批编号', '写明审批机构和编号；问卷研究也通常需要。'],
      ['consent', '说明了知情同意的获取方式', ''],
      ['data', '数据可用性声明（Data Availability Statement）', '说明数据存放位置，或无法公开的原因。'],
      ['coi', '利益冲突声明', '没有冲突也要写明「无」。'],
      ['funding', '经费来源和项目编号', '按资助方要求的格式写。'],
      ['credit', '作者贡献声明（如 CRediT 分类）', '每位作者的贡献要真实，并经全体作者确认。'],
      ['ai', 'AI 工具使用声明', '多数期刊要求说明是否以及如何使用了 AI 工具。'],
    ] },
    { name: '文件与提交', items: [
      ['similarity', '自查文字重复率', '引用他人观点要标注出处，不要只靠改写降低重复率。'],
      ['cover', '投稿信（Cover Letter）', '说明研究问题、主要发现，以及为什么适合这本期刊。'],
      ['format', '参考文献格式符合期刊要求', '在「引用验证」里按期刊格式导出。'],
      ['blind', '双盲审稿时，正文已去除作者信息', '包括文件属性里的作者名。'],
      ['authors', '所有作者的姓名、单位、邮箱和 ORCID 已确认', ''],
    ] },
  ];

  const ALL = GROUPS.flatMap((g) => g.items.map(([id, label, how]) => ({ id, label, how, group: g.name })));

  S.checklist = { GROUPS, ALL };
})(typeof window !== 'undefined' ? window : globalThis);
