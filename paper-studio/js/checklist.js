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

  S.checklist = { GROUPS, ALL };
})(typeof window !== 'undefined' ? window : globalThis);
