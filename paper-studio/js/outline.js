// 论证主线: the six-node argument thread and the rules that check it.
// Notes only diagnose and explain; examples use a different topic on purpose
// (urban parks and heat) so they show the pattern without being pasteable.
(function (root) {
  const S = root.Sigao = root.Sigao || {};
  const T = S.text;

  const FIELDS = [
    { key: 'question', label: '研究问题', hint: '你想回答的那个问题，写成问句。它应该能被你的方法直接回答。',
      example: '城市公园的面积与周边 500 米内夏季地表温度之间有什么关系？这种关系是否因公园的植被类型而不同？' },
    { key: 'gap', label: '研究缺口', hint: '前人已经做到哪里，还缺什么，这个缺口为什么值得补。',
      example: '已有研究多在单个城市测量公园的降温范围，较少比较不同植被结构的差异，也缺少高密度亚热带城市的观测。' },
    { key: 'aim', label: '研究目标', hint: '用动词写你要做的事（检验、比较、估计、解释），并和研究问题一一对应。',
      example: '估计公园面积与周边地表温度的关系，并比较乔木为主与草坪为主两类公园的降温效果。' },
    { key: 'method', label: '方法', hint: '数据从哪来、样本多大、用什么测量、怎么分析。',
      example: '选取 3 座城市的 120 个公园，用夏季卫星影像反演地表温度，用多元回归控制建筑密度与距水体距离。' },
    { key: 'result', label: '主要结果', hint: '只写数据告诉你的事，不加解释。还没做完可以先写预期结果。',
      example: '公园面积与周边地表温度负相关；乔木为主的公园降温幅度大于草坪为主的公园。' },
    { key: 'conclusion', label: '结论', hint: '回答研究问题，并说明适用范围。不超出结果能支持的程度。',
      example: '在所研究的亚热带城市中，较大的、以乔木为主的公园与更低的周边地表温度相关；这一结论还需要在其他气候区验证。' },
  ];

  const QUESTION_WORDS = /[？?]|是否|如何|为什么|什么|哪些|多大|怎样|how|what|why|whether|does|do |is |are |to what extent/i;
  const LITERATURE_WORDS = /已有|现有|以往|前人|既往|文献|研究|studies|literature|previous|prior|existing/i;
  const MISSING_WORDS = /较少|很少|尚未|未能|没有|缺乏|缺少|空白|不足|忽视|little|few|lack|no stud|not yet|overlook|unclear|limited/i;
  const CROSS_SECTIONAL = /问卷|横断|相关分析|调查|survey|cross-sectional|correlation|questionnaire/i;
  const CAUSAL = /导致|造成|引起|使得|决定了|cause|causes|caused|leads? to|results? in/i;
  const OVERCLAIM = /证明|证实|首次|完全|彻底|必然|全面|毫无疑问|一定|prove|proves|definitive|always|never|first to|conclusively/i;

  function field(key) { return FIELDS.find((f) => f.key === key); }

  function check(o) {
    o = o || {};
    const notes = [];
    const add = (n) => notes.push(n);

    FIELDS.forEach((f) => {
      if (!String(o[f.key] || '').trim()) {
        add({ level: 'issue', field: f.key, title: `「${f.label}」还没有填写`,
          why: '主线上缺一个节点，后面的章节就没有东西可以对齐。', how: f.hint, example: f.example });
      }
    });

    const q = String(o.question || '');
    if (q.trim()) {
      if (!QUESTION_WORDS.test(q)) {
        add({ level: 'tip', field: 'question', title: '研究问题还不是一个问句',
          why: '陈述句容易写成研究主题，读者看不出你到底要回答什么。',
          how: '把主题改写成一个能用数据回答的问题，通常以「是否」「如何」「多大程度上」开头或以问号结尾。',
          example: field('question').example });
      }
      const marks = (q.match(/[？?]/g) || []).length;
      if (marks >= 3) {
        add({ level: 'tip', field: 'question', title: `一共有 ${marks} 个研究问题`,
          why: '问题越多，每个问题都需要对应的方法、结果和讨论，篇幅和论证都会被摊薄。',
          how: '确认每个问题都有对应的方法和结果；次要的问题可以合并或者移到讨论里。',
          ask: '如果只能保留一个问题，你会留哪一个？' });
      }
    }

    const gap = String(o.gap || '');
    if (gap.trim()) {
      if (!LITERATURE_WORDS.test(gap)) {
        add({ level: 'issue', field: 'gap', title: '缺口没有说明前人做到了哪里',
          why: '审稿人判断缺口是否成立，先要知道已有研究的边界。',
          how: '先用一句话概括已有研究做了什么，再说明缺了什么。可以到「文献矩阵」里找依据。',
          example: field('gap').example });
      } else if (!MISSING_WORDS.test(gap)) {
        add({ level: 'tip', field: 'gap', title: '缺口里看不出「缺」的是什么',
          why: '只描述已有研究，读者不知道你要补哪一块。',
          how: '明确写出缺的是样本、情境、方法还是变量，例如「较少区分……」「缺少针对……的数据」。' });
      }
    }

    const pairs = [
      ['aim', 'question', 0.25, 'issue', '研究目标和研究问题对不上',
        '目标里的关键概念在研究问题中找不到，读者会怀疑你到底在回答哪个问题。',
        '让每个目标对应一个研究问题，用同样的关键词描述同一个概念。'],
      ['method', 'question', 0.12, 'tip', '方法里没有出现研究问题中的关键概念',
        '读者需要看到每个核心变量是怎么测量的。',
        '检查研究问题里的每个关键概念，在方法里写明它用什么工具或指标测量。'],
      ['result', 'question', 0.2, 'issue', '主要结果没有回答研究问题',
        '结果里的关键概念和研究问题重合太少，可能结果在回答另一个问题。',
        '逐个研究问题写出对应的结果；没有对应结果的问题，要么补分析，要么删掉问题。'],
    ];
    pairs.forEach(([a, b, min, level, title, why, how]) => {
      if (String(o[a] || '').trim() && String(o[b] || '').trim() && T.coverage(o[a], o[b]) < min) {
        add({ level, field: a, title, why, how });
      }
    });

    const c = String(o.conclusion || '');
    if (c.trim()) {
      if (CAUSAL.test(c) && CROSS_SECTIONAL.test(o.method || '')) {
        add({ level: 'issue', field: 'conclusion', title: '横断面数据写出了因果结论',
          why: `方法是问卷或横断面设计，只能说明变量之间相关；结论里的「${c.match(CAUSAL)[0]}」是因果表述。`,
          how: '把因果动词换成相关表述（如「与……相关」「与……有关联」），并在局限中说明为什么不能推出因果。',
          example: field('conclusion').example });
      }
      if (OVERCLAIM.test(c)) {
        add({ level: 'tip', field: 'conclusion', title: `结论用了绝对化的词「${c.match(OVERCLAIM)[0]}」`,
          why: '绝对化表述超出了一项研究能支撑的范围，审稿人通常会要求删掉。',
          how: '写明结论适用的样本和情境，用「在……中」「本研究的数据显示」限定范围。' });
      }
      if (String(o.result || '').trim() && T.coverage(c, String(o.result) + String(o.question)) < 0.35) {
        add({ level: 'issue', field: 'conclusion', title: '结论里有结果中没有的内容',
          why: '结论里的很多关键概念在结果和研究问题中都找不到，可能引入了新的主张。',
          how: '把结论里的每个主张和一条结果对应起来；找不到对应的主张，删掉或移到「未来研究」。',
          ask: '结论中的哪一句，是你的数据直接支持的？' });
      }
    }

    if (!notes.length) {
      notes.push({ level: 'ok', title: '主线六个节点都对上了',
        why: '规则检查没有发现明显断点。', how: '接下来到「一致性检查」里，用正文的结果和讨论再核对一遍。' });
    }
    return notes;
  }

  function filled(o) { return FIELDS.filter((f) => String((o || {})[f.key] || '').trim()).length; }

  S.outline = { FIELDS, check, filled };
})(typeof window !== 'undefined' ? window : globalThis);
