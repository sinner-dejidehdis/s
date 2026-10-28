// Submission checklist: what international journals commonly ask for before
// a manuscript goes out. Items follow common ICMJE / COPE practice.
(function (root) {
  const S = root.Sigao = root.Sigao || {};

  const GROUPS = [
    { name: 'Journal fit', items: [
      ['scope', 'The topic fits the journal’s Aims & Scope', 'Read the Aims & Scope, then check whether 5 recent articles are close to your study.'],
      ['type', 'The article type is right (research article, short communication, review)', 'Each type has its own length and structure rules.'],
      ['length', 'Word count, abstract length and number of keywords meet the Guide for Authors', ''],
      ['recent', 'You cite relevant work from the last three years, including in this journal', 'Reviewers use this to judge whether you know the current literature.'],
      ['predatory', 'The journal is legitimate', 'Check it is indexed (e.g. DOAJ, Web of Science, Scopus) and listed by its publisher. Be wary of unsolicited invitations.'],
    ] },
    { name: 'Manuscript', items: [
      ['thread', 'Research question, methods, results and conclusion line up', 'Run the argument thread and the consistency check.'],
      ['limits', 'The discussion states the limitations', 'Stating them yourself is better than a reviewer pointing them out.'],
      ['refs', 'Every reference is verified, and in-text citations match the reference list', 'Use the citation check on each entry.'],
      ['figures', 'Figures and tables are numbered, cited in the text and at the required resolution (often 300 dpi or more)', ''],
      ['reporting', 'You followed the reporting guideline for your design, if one applies', 'For example CONSORT for trials, STROBE for observational studies, PRISMA for systematic reviews (see the EQUATOR Network).'],
    ] },
    { name: 'Statements & ethics', items: [
      ['ethics', 'Ethics approval (IRB or ethics committee) name and number', 'Usually needed for human or animal research, including surveys.'],
      ['consent', 'How informed consent was obtained', ''],
      ['data', 'Data availability statement', 'Say where the data are deposited, or why they cannot be shared.'],
      ['coi', 'Competing interests statement', 'If there are none, say so.'],
      ['funding', 'Funding sources and grant numbers', 'Use the format the funder requires.'],
      ['credit', 'Author contributions (e.g. CRediT roles), agreed by all authors', ''],
      ['ai', 'AI use disclosure', 'Most journals ask whether and how AI tools were used. Check your journal’s policy.'],
    ] },
    { name: 'Files & submission', items: [
      ['similarity', 'Self-check for text overlap', 'Quote and cite others’ ideas; do not rely on paraphrasing to lower similarity scores.'],
      ['cover', 'Cover letter', 'State the research question, the main finding, and why it suits this journal.'],
      ['format', 'Reference style matches the journal', 'Export it in the right style from the citation check.'],
      ['blind', 'For double-blind review, author details are removed from the manuscript', 'Including file properties.'],
      ['authors', 'Every author’s name, affiliation, email and ORCID iD are confirmed', ''],
      ['reviewers', 'Suggested and opposed reviewers, if the journal asks', 'Avoid recent co-authors and colleagues at your institution.'],
    ] },
  ];

  const ALL = GROUPS.flatMap((g) => g.items.map(([id, label, how]) => ({ id, label, how, group: g.name })));

  // The checklist for this project: wording follows the target journal and
  // study design, items that do not apply are dropped, and items Arguo can
  // verify from the project are checked automatically.
  function build(p) {
    const j = (p.refs && p.refs.journal) || null;
    const info = (j && j.info) || null;
    const type = (p.design && p.design.type) || '';
    const guide = S.design && S.design.GUIDELINES[type];
    const human = !['review', 'lab'].includes(type);
    const jt = j ? j.title : 'the journal';
    const q = encodeURIComponent((j ? j.title : '') + ' guide for authors');
    const guideLink = j ? [{ href: info && info.homepage ? info.homepage : `https://www.google.com/search?q=${q}`, text: info && info.homepage ? `${jt} website` : `Find the ${jt} guide for authors` }] : [];

    const o = p.outline || {};
    const refs = (p.refs && p.refs.results) || [];
    const auto = {};
    if (S.outline) auto.thread = S.outline.filled(o) === 6 && !S.outline.check(o).some((n) => n.level === 'issue');
    if (S.consistency && p.check && String(p.check.discussion || '').trim()) auto.limits = !S.consistency.check({ question: o.question, method: o.method, ...p.check }).notes.some((n) => n.title === 'The discussion has no limitations');
    if (refs.length) auto.refs = refs.every((r) => r.status === 'verified');
    if (j && refs.length) auto.format = refs.every((r) => !r.doi || r.formattedStyle === j.style);
    if (S.design && type && p.design) {
      const all = Object.values(p.design).join(' ');
      if (type === 'experiment') auto.registered = /clinicaltrials|isrctn|registered|registration|pre-?regist/i.test(all) || null;
    }

    const groups = GROUPS.map((g) => ({ name: g.name, items: g.items.map(([id, label, how]) => ({ id, label, how, links: [] })) }));
    const find = (id) => groups.flatMap((g) => g.items).find((i) => i.id === id);
    const set = (id, patch) => { const it = find(id); if (it) Object.assign(it, patch); };

    set('scope', { label: `The topic fits ${jt}’s Aims & Scope`, links: guideLink });
    set('length', { label: `Word count, abstract and keywords meet ${j ? jt + '’s' : 'the'} Guide for Authors`, links: guideLink });
    set('recent', { label: j ? `You cite recent work, including from ${jt} itself` : 'You cite relevant work from the last three years' });
    if (info) {
      set('predatory', { label: `${jt} is a legitimate journal`, how: [info.publisher && `Published by ${info.publisher}.`, info.doaj ? 'Listed in DOAJ.' : info.isOa ? 'Open access but not listed in DOAJ: check it carefully.' : '', info.works ? `${info.works.toLocaleString()} articles indexed in OpenAlex.` : ''].filter(Boolean).join(' '), auto: info.works > 500 ? true : null });
    }
    set('format', { label: j ? `References are in ${jt}’s style` : 'Reference style matches the journal', how: j ? `Format them in the citation check (${j.style} style).` : 'Choose your target journal in the citation check.' });
    if (guide) set('reporting', { label: `You followed ${guide}`, how: `The reporting guideline for your design. Many journals ask you to upload the completed checklist; see the EQUATOR Network.` });
    if (!human) {
      groups.forEach((g) => { g.items = g.items.filter((i) => !['ethics', 'consent'].includes(i.id) || (type === 'lab' && i.id === 'ethics')); });
      if (type === 'lab') set('ethics', { label: 'Animal or biosafety approval, if your work needs it', how: 'Name the committee and approval number.' });
    }
    const extra = [];
    if (type === 'experiment') extra.push({ id: 'registered', label: 'The trial was registered before enrolment', how: 'Give the registry and number (e.g. ClinicalTrials.gov, ISRCTN). Most medical journals refuse unregistered trials.', links: [{ href: 'https://clinicaltrials.gov', text: 'ClinicalTrials.gov' }] });
    if (type === 'review') extra.push({ id: 'prospero', label: 'The review protocol was registered', how: 'PROSPERO for health-related reviews, or OSF.', links: [{ href: 'https://www.crd.york.ac.uk/prospero/', text: 'PROSPERO' }] });
    if (info && info.isOa) extra.push({ id: 'apc', label: info.apc ? `You can cover the article processing charge (about US$${info.apc.toLocaleString()})` : 'You know whether there is an article processing charge', how: 'Check for waivers or institutional agreements that cover the fee.', links: guideLink });
    if (extra.length) groups[0].items.push(...extra.filter((e) => e.id === 'apc')), groups[2].items.push(...extra.filter((e) => e.id !== 'apc'));

    groups.forEach((g) => g.items.forEach((i) => {
      if (i.auto === undefined) i.auto = auto[i.id] === undefined ? null : auto[i.id];
      if (i.auto === false) { i.fix = { thread: 'outline', limits: 'check', refs: 'cite', format: 'cite' }[i.id] || ''; i.autoNote = 'Arguo found problems here'; }
    }));
    return groups;
  }

  function isDone(item, p) { return item.auto === true || Boolean(p.submit && p.submit.checked[item.id]); }

  S.checklist = { GROUPS, ALL, build, isDone };
})(typeof window !== 'undefined' ? window : globalThis);
