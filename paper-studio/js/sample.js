// The example project shown on first visit. The four English references are
// real papers checked against Crossref; their matrix summaries are short
// paraphrases for demonstration. The Zhang & Li entry is made up on purpose
// to show what an unverifiable citation looks like.
(function (root) {
  const S = root.Sigao = root.Sigao || {};

  const REC = {
    levenson: { doi: '10.1016/j.ypmed.2016.01.001', title: 'The association between social media use and sleep disturbance among young adults',
      journal: 'Preventive Medicine', year: 2016, volume: '85', issue: '', pages: '36-41',
      authors: [['Levenson', 'Jessica C.'], ['Shensa', 'Ariel'], ['Sidani', 'Jaime E.'], ['Colditz', 'Jason B.'], ['Primack', 'Brian A.']] },
    woods: { doi: '10.1016/j.adolescence.2016.05.008', title: '#Sleepyteens: Social media use in adolescence is associated with poor sleep quality, anxiety, depression and low self-esteem',
      journal: 'Journal of Adolescence', year: 2016, volume: '51', issue: '1', pages: '41-49',
      authors: [['Woods', 'Heather Cleland'], ['Scott', 'Holly']] },
    hale: { doi: '10.1016/j.smrv.2014.07.007', title: 'Screen time and sleep among school-aged children and adolescents: A systematic literature review',
      journal: 'Sleep Medicine Reviews', year: 2015, volume: '21', issue: '', pages: '50-58',
      authors: [['Hale', 'Lauren'], ['Guan', 'Stanford']] },
  };
  Object.values(REC).forEach((r) => { r.authors = r.authors.map(([family, given]) => ({ family, given })); });

  const REFS = [
    'Levenson, J. C., Shensa, A., Sidani, J. E., Colditz, J. B., & Primack, B. A. (2016). The association between social media use and sleep disturbance among young adults. Preventive Medicine, 85, 36–41. https://doi.org/10.1016/j.ypmed.2016.01.001',
    'Woods, H. C., & Scott, H. (2018). #Sleepyteens: Social media use in adolescence is associated with poor sleep quality, anxiety, depression and low self-esteem. Journal of Adolescence, 51, 41–49. https://doi.org/10.1016/j.adolescence.2016.05.008',
    'Hale, L., & Guan, S. (2015). Screen time and sleep among school-aged children and adolescents: A systematic literature review. Sleep Medicine Reviews, 21, 50–58.',
    'Zhang, W., & Li, M. (2021). Bedtime phone use and sleep quality among Chinese college students. Journal of Campus Sleep Studies, 12(3), 45–52.',
  ];

  function create() {
    const entries = S.cite.parse(REFS.join('\n'));
    return {
      version: 1,
      sample: true,
      title: '睡前社交媒体使用与大学生睡眠质量',
      outline: {
        question: '大学生睡前使用社交媒体的时长与睡眠质量之间有什么关系？这种关系是否因使用方式（被动浏览或主动互动）而不同？',
        gap: '已有研究多关注青少年的总屏幕时间，较少区分社交媒体的使用方式，也缺少针对中国大学生的数据。',
        aim: '检验睡前社交媒体使用时长与睡眠质量的关联，并比较被动浏览与主动互动两种使用方式的差异。',
        method: '对 3 所高校 612 名本科生进行问卷调查，用匹兹堡睡眠质量指数（PSQI）测量睡眠质量，用多元回归控制性别、年级和学业压力。',
        result: '睡前社交媒体使用时长与 PSQI 得分正相关；被动浏览的关联强于主动互动。',
        conclusion: '社交媒体使用会导致大学生失眠，高校应全面限制夜间网络。',
      },
      matrix: [
        { id: 'r1', source: 'Levenson 等 (2016)', sample: '美国 19–32 岁成年人，全国性样本', method: '横断面问卷调查', finding: '社交媒体使用量和使用频率越高，睡眠障碍越多', limitation: '横断面设计，无法判断因果；自我报告', relation: '支持' },
        { id: 'r2', source: 'Woods & Scott (2016)', sample: '苏格兰中学生', method: '横断面问卷调查', finding: '夜间使用和情感投入与较差的睡眠质量、焦虑和抑郁相关', limitation: '横断面设计；自我报告；单一地区样本', relation: '支持' },
        { id: 'r3', source: 'Hale & Guan (2015)', sample: '学龄儿童与青少年', method: '系统综述', finding: '多数研究发现屏幕时间与入睡推迟、睡眠时间缩短相关', limitation: '纳入研究多为横断面设计；多依赖自我报告', relation: '背景' },
        { id: 'r4', source: 'Scott, Biello & Woods (2019)', sample: '英国千禧队列中的青少年', method: '横断面分析（队列数据）', finding: '社交媒体使用越多，入睡越晚、夜间醒来越多', limitation: '只分析了一个时间点，属横断面设计；自我报告', relation: '支持' },
      ],
      refs: {
        input: REFS.join('\n'),
        style: 'apa',
        results: [
          Object.assign({}, entries[0], { status: 'verified', record: REC.levenson, issues: [] }),
          Object.assign({}, entries[1], { status: 'mismatch', record: REC.woods, issues: ['年份写的是 2018，数据库记录是 2016'] }),
          Object.assign({}, entries[2], { status: 'verified', record: REC.hale, issues: ['原文没有 DOI，已按标题找到'] }),
          Object.assign({}, entries[3], { status: 'notfound', note: '查不到标题匹配的文献。这是示例里故意放的一条虚构引用：不要引用你没有读过、查不到出处的文献。' }),
        ],
      },
      check: {
        results: '回归分析显示，控制性别、年级和学业压力后，睡前社交媒体使用时长每增加 1 小时，PSQI 得分平均升高 1.2 分（p < 0.01）。被动浏览组的回归系数高于主动互动组。性别和年级的调节作用不显著。',
        discussion: '本研究发现睡前社交媒体使用时长与睡眠质量下降相关，这与 Levenson 等（2016）的结果一致。被动浏览的关联更强，可能是因为被动浏览更容易延长使用时间。结果还表明，社交媒体使用会损害大学生的学业成绩和人际关系。本研究证明了限制手机使用可以彻底解决大学生的睡眠问题。',
      },
      review: {
        input: '审稿人 1\n1. The sample is limited to three universities; the authors must discuss the generalizability of the findings.\n2. 方法部分没有说明问卷的信度和效度，请补充。\n3. 讨论部分需要加强。\n4. Some typos in Table 2.\n\n审稿人 2\n1. The claim that social media "causes" insomnia is not supported by cross-sectional data.\n2. 建议补充近三年的相关文献。',
        tasks: [],
      },
      submit: { checked: { scope: true, type: true, ethics: true } },
    };
  }

  function blank() {
    return { version: 1, sample: false, title: '未命名论文',
      outline: { question: '', gap: '', aim: '', method: '', result: '', conclusion: '' },
      matrix: [S.matrix.blankRow(), S.matrix.blankRow(), S.matrix.blankRow()],
      refs: { input: '', style: 'apa', results: [] },
      check: { results: '', discussion: '' },
      review: { input: '', tasks: [] },
      submit: { checked: {} } };
  }

  function withTasks(p) {
    if (!p.review.tasks.length && p.review.input) p.review.tasks = S.review.split(p.review.input);
    return p;
  }

  S.sample = { create: () => withTasks(create()), blank };
})(typeof window !== 'undefined' ? window : globalThis);
