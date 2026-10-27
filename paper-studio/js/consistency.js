// 一致性检查: research questions -> results -> discussion. Flags discussion
// claims with little support in the results, overclaiming, causal language on
// correlational designs and a missing limitations paragraph.
(function (root) {
  const S = root.Sigao = root.Sigao || {};
  const T = S.text;

  const CLAIM = /表明|说明|证明|证实|发现|意味着|揭示|显示|可见|会|导致|suggest|show|demonstrat|indicat|prove|reveal|impl|cause|lead/i;
  const CITES = /(19|20)\d{2}[)）]|et al|等[（(]|\[\d+\]/i;
  const OVERCLAIM = /证明|证实|首次|完全|彻底|必然|全面|毫无疑问|一定|prove|proves|definitive|always|never|first to|conclusively/i;
  const CAUSAL = /导致|造成|引起|损害|决定|cause|causes|leads? to|results? in|damage/i;
  const LIMITS = /局限|不足之处|研究的不足|有待进一步|未来研究|今后研究|limitation|caveat|future research|should be interpreted with caution/i;

  function splitQuestions(q) {
    return String(q || '').split(/(?<=[？?])|\n+/).map((x) => x.trim()).filter((x) => x.length > 3);
  }

  function check(input) {
    const question = String(input.question || '');
    const results = String(input.results || '');
    const discussion = String(input.discussion || '');
    const method = String(input.method || '');
    const notes = [];
    const flagged = [];

    if (!results.trim() || !discussion.trim()) {
      notes.push({ level: 'tip', title: '先粘贴结果和讨论',
        why: '检查需要同时看到两部分，才能比对讨论里的结论在结果中有没有依据。',
        how: '把论文的「结果」和「讨论」分别粘贴到左边。' });
      return { notes, flagged };
    }

    const resultTerms = T.terms(results + ' ' + method);
    splitQuestions(question).forEach((q, i) => {
      if (T.coverage(q, results) < 0.25) {
        notes.push({ level: 'issue', title: `研究问题 ${i + 1} 在结果里找不到对应内容`,
          why: `「${q}」中的关键概念在结果部分很少出现。`,
          how: '为这个问题补一段对应的结果；如果数据回答不了它，就修改或删除这个问题。' });
      }
    });

    const support = new Set([...resultTerms, ...T.terms(question)]);
    T.sentences(discussion).forEach((s) => {
      if (CITES.test(s)) return;
      const reasons = [];
      if (CLAIM.test(s) && T.terms(s).size >= 4 && T.coverage(s, support) < 0.6) reasons.push('结果中找不到依据');
      if (OVERCLAIM.test(s)) reasons.push(`绝对化表述「${s.match(OVERCLAIM)[0]}」`);
      if (CAUSAL.test(s) && /问卷|横断|调查|相关|survey|cross-sectional|correlat|regression|回归/i.test(results + method)) {
        reasons.push(`相关数据写出了因果「${s.match(CAUSAL)[0]}」`);
      }
      if (reasons.length) flagged.push({ sentence: s, reasons });
    });

    const unsupported = flagged.filter((f) => f.reasons.includes('结果中找不到依据')).length;
    if (unsupported) {
      notes.push({ level: 'issue', title: `讨论里有 ${unsupported} 句结论在结果中找不到依据`,
        why: '讨论只能解释已经报告过的结果。新结论没有数据支撑，审稿人会要求删除或补充分析。',
        how: '逐句对照：能对上的，注明对应哪个结果；对不上的，补充分析、改成推测语气，或移到「未来研究」。',
        example: '（城市公园主题）结果只测了地表温度，讨论却写「公园降低了居民的中暑率」，这句就需要删掉，或改写为需要未来研究检验的推测。' });
    }
    if (flagged.some((f) => f.reasons.some((r) => r.startsWith('绝对化')))) {
      notes.push({ level: 'tip', title: '讨论里有绝对化表述',
        why: '一项研究很少能「证明」或「彻底」解决问题。',
        how: '用限定语说明范围：在什么样本、什么条件下，数据显示了什么。' });
    }
    if (flagged.some((f) => f.reasons.some((r) => r.startsWith('相关数据')))) {
      notes.push({ level: 'issue', title: '相关性结果被写成了因果',
        why: '问卷、横断面或回归分析只能说明关联，不能说明谁导致了谁。',
        how: '把因果动词换成「与……相关」，并在局限中说明因果方向未知，以及需要什么设计才能检验。' });
    }
    if (!LIMITS.test(discussion)) {
      notes.push({ level: 'issue', title: '讨论里没有局限性',
        why: '不写局限，审稿人会自己替你写，而且通常写得更严重。主动说明局限反而能增加可信度。',
        how: '按「局限是什么 → 可能怎样影响结果 → 未来研究怎么解决」三步，写 2～3 条最重要的局限。',
        example: '（城市公园主题）「本研究只使用了夏季白天的卫星影像，无法反映夜间降温效果；未来研究可结合地面气象站数据。」' });
    }
    if (!notes.length) {
      notes.push({ level: 'ok', title: '没有发现明显的不一致',
        why: '规则检查只能发现表面问题。', how: '最后请自己逐句核对一遍，或请同伴从审稿人的角度读一次。' });
    }
    return { notes, flagged };
  }

  S.consistency = { check, splitQuestions };
})(typeof window !== 'undefined' ? window : globalThis);
