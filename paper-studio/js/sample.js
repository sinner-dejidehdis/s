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
    'Zhang, W., & Li, M. (2021). Bedtime phone use and sleep quality among college students. Journal of Campus Sleep Studies, 12(3), 45–52.',
  ];

  function meta(r, type) {
    return { id: 'sample-' + r.doi, title: r.title, year: r.year, authors: r.authors.map((a) => `${a.given} ${a.family}`), venue: r.journal,
      type: type || 'article', cited: 0, doi: r.doi, url: `https://doi.org/${r.doi}`, oaUrl: '', abstract: '' };
  }
  const SCOTT = { doi: '10.1136/bmjopen-2019-031161', title: 'Social media use and adolescent sleep patterns: cross-sectional findings from the UK millennium cohort study',
    journal: 'BMJ Open', year: 2019, authors: [{ family: 'Scott', given: 'Holly' }, { family: 'Biello', given: 'Stephany M' }, { family: 'Woods', given: 'Heather Cleland' }] };

  function create() {
    const entries = S.cite.parse(REFS.join('\n'));
    return {
      version: 2,
      sample: true,
      title: 'Bedtime social media use and sleep quality in university students',
      outline: {
        question: 'Is bedtime social media use associated with sleep quality among university students, and does the association differ between passive scrolling and active interaction?',
        gap: 'Prior studies have mostly examined total screen time in adolescents; few have distinguished passive from active social media use, and evidence from university students remains limited.',
        aim: 'To estimate the association between bedtime social media use and sleep quality, and to compare passive scrolling with active interaction.',
        method: 'We surveyed 612 undergraduates at three universities, measured sleep quality with the Pittsburgh Sleep Quality Index (PSQI), and used multiple regression adjusting for gender, year of study and academic stress.',
        result: 'Longer bedtime social media use was associated with higher PSQI scores (poorer sleep); the association was stronger for passive scrolling than for active interaction.',
        conclusion: 'Social media use causes insomnia in university students, so universities should completely restrict night-time internet access.',
      },
      matrix: [
        { id: 'r1', meta: meta(REC.levenson), source: 'Levenson et al. (2016)', sample: 'US adults aged 19–32, national sample', method: 'Cross-sectional survey', finding: 'More frequent and higher-volume social media use went with more sleep disturbance', limitation: 'Cross-sectional design; self-report', relation: 'Supports' },
        { id: 'r2', meta: meta(REC.woods), source: 'Woods & Scott (2016)', sample: 'Secondary school pupils in Scotland', method: 'Cross-sectional survey', finding: 'Night-time use and emotional investment went with poorer sleep quality, anxiety and depression', limitation: 'Cross-sectional design; self-report; one region', relation: 'Supports' },
        { id: 'r3', meta: meta(REC.hale, 'review'), source: 'Hale & Guan (2015)', sample: 'School-aged children and adolescents', method: 'Systematic review', finding: 'Most included studies linked screen time to later bedtimes and shorter sleep', limitation: 'Included studies mostly cross-sectional design; mostly self-report', relation: 'Background' },
        { id: 'r4', meta: meta(SCOTT), source: 'Scott, Biello & Woods (2019)', sample: 'Adolescents in the UK Millennium Cohort Study', method: 'Cross-sectional analysis of cohort data', finding: 'More social media use went with later sleep onset and more night waking', limitation: 'Cross-sectional design (one wave); self-report', relation: 'Supports' },
      ],
      refs: {
        input: REFS.join('\n'),
        style: 'apa',
        results: [
          Object.assign({}, entries[0], { status: 'verified', record: REC.levenson, issues: [] }),
          Object.assign({}, entries[1], { status: 'mismatch', record: REC.woods, issues: ['Year given as 2018; the record says 2016'] }),
          Object.assign({}, entries[2], { status: 'verified', record: REC.hale, issues: ['No DOI given; matched by title'] }),
          Object.assign({}, entries[3], { status: 'notfound', note: 'No record with a matching title. This example entry is made up on purpose: never cite a paper you have not read or cannot trace.' }),
        ],
      },
      check: {
        question: 'Social media is now part of students’ bedtime routines. This study examines social media and sleep in university students.',
        gap: 'Many studies have linked screen time to poorer sleep in adolescents (Hale & Guan, 2015; Woods & Scott, 2016). Most measured total screen time.',
        aim: 'The relationship between bedtime social media use, type of use and sleep quality.',
        method: 'An online questionnaire measured sleep quality with the Pittsburgh Sleep Quality Index. Data were analysed with multiple regression adjusting for gender, year of study and academic stress.',
        results: 'After adjusting for gender, year of study and academic stress, each additional hour of bedtime social media use was associated with a 1.2-point increase in PSQI score (p < 0.01). The coefficient was larger in the passive-scrolling group than in the active-interaction group. Gender and year of study did not moderate the association.',
        discussion: 'We found that longer bedtime social media use was associated with poorer sleep quality, consistent with Levenson et al. (2016). The stronger association for passive scrolling may reflect longer, less intentional sessions. Our results also show that social media use damages students’ academic performance and friendships. This study proves that limiting phone use will completely solve students’ sleep problems.',
      },
      review: {
        input: 'Reviewer 1\n1. The sample is limited to three universities; the authors must discuss the generalizability of the findings.\n2. The methods section does not report the reliability or validity of the social media use measure.\n3. The discussion needs to be strengthened.\n4. Some typos in Table 2.\n\nReviewer 2\n1. The claim that social media "causes" insomnia is not supported by cross-sectional data.\n2. Please consider citing more recent literature from the last three years.',
        tasks: [],
      },
      submit: { checked: { scope: true, type: true, ethics: true } },
      design: { type: 'cross', question: '', variables: 'Exposure: minutes of social media use in the hour before bed (passive scrolling vs active interaction). Outcome: PSQI score. Covariates: gender, year of study, academic stress.',
        sample: '612 undergraduates at three universities, recruited by email.', procedure: 'Participants complete an online questionnaire once: demographics, bedtime social media use, PSQI, academic stress scale.',
        analysis: 'Multiple regression of PSQI on bedtime use, adjusting for covariates; interaction with use type.' },
      discover: {
        query: 'social media use and sleep quality', years: 0, sort: 'cited', oa: false, total: 0, sample: true,
        results: [REC.hale, REC.woods, REC.levenson].map((r, i) => ({
          id: 'sample-' + i, title: r.title, year: r.year, authors: r.authors.map((a) => `${a.given} ${a.family}`),
          venue: r.journal, type: i === 0 ? 'review' : 'article', cited: 0, doi: r.doi, url: `https://doi.org/${r.doi}`, oaUrl: '', abstract: '',
        })),
      },
    };
  }

  function blankDiscover() { return { query: '', years: 3, sort: 'relevance', oa: false, total: 0, sample: false, results: [] }; }

  function blank() {
    return { version: 2, sample: false, title: 'Untitled paper',
      outline: { question: '', gap: '', aim: '', method: '', result: '', conclusion: '' },
      matrix: [S.matrix.blankRow(), S.matrix.blankRow(), S.matrix.blankRow()],
      refs: { input: '', style: 'apa', results: [] },
      check: { question: '', gap: '', aim: '', method: '', results: '', discussion: '' },
      review: { input: '', tasks: [] },
      submit: { checked: {} }, discover: blankDiscover(), design: { type: '', question: '', variables: '', sample: '', procedure: '', analysis: '' } };
  }

  function withTasks(p) {
    if (!p.review.tasks.length && p.review.input) p.review.tasks = S.review.split(p.review.input);
    return p;
  }

  S.sample = { create: () => withTasks(create()), blank, blankDiscover };
})(typeof window !== 'undefined' ? window : globalThis);
