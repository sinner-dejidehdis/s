// Study design: the researcher describes the planned study; rules check the
// basics every reviewer asks about. The AI adds design critique and a
// comparison with methods used in similar studies (from Discover results).
(function (root) {
  const S = root.Sigao = root.Sigao || {};

  const TYPES = {
    experiment: 'Randomised experiment or trial',
    quasi: 'Quasi-experiment (no random assignment)',
    cohort: 'Longitudinal or cohort study',
    cross: 'Cross-sectional survey or observational study',
    qual: 'Qualitative study (interviews, focus groups)',
    review: 'Systematic review or meta-analysis',
    lab: 'Laboratory or bench experiment',
  };
  const GUIDELINES = { experiment: 'CONSORT', quasi: 'TREND', cohort: 'STROBE', cross: 'STROBE', qual: 'COREQ or SRQR', review: 'PRISMA', lab: 'ARRIVE (animal work) or your field’s reporting standard' };

  const FIELDS = [
    { key: 'question', label: 'Question the study answers', hint: 'Taken from your argument thread unless you change it.' },
    { key: 'variables', label: 'Variables or concepts', hint: 'What you manipulate or compare, what you measure, and what you control for.' },
    { key: 'sample', label: 'Participants or samples', hint: 'Who or what, how many, how they are recruited or selected, inclusion and exclusion criteria.' },
    { key: 'procedure', label: 'Procedure', hint: 'The steps in order: what happens to each participant or sample, and when each measure is taken.' },
    { key: 'analysis', label: 'Analysis plan', hint: 'The main test or model for each question, and how you will handle missing data.' },
  ];

  const has = (t, re) => re.test(String(t || ''));

  function check(d) {
    d = d || {};
    const all = FIELDS.map((f) => d[f.key] || '').join(' ');
    const notes = [];
    const add = (level, title, why, how, ask) => notes.push({ level, title, why, how, ask });

    FIELDS.forEach((f) => { if (!String(d[f.key] || '').trim()) add('issue', `${f.label} is empty`, 'Reviewers judge a study by its design before its results.', f.hint); });
    if (!d.type) add('issue', 'Choose a study design', 'The design decides what your results can and cannot show.', 'Pick the closest type above; the checks adapt to it.');

    const comparative = ['experiment', 'quasi', 'lab'].includes(d.type);
    if (comparative && !has(all, /control|comparison|placebo|sham|baseline|waitlist|usual care|vehicle/i)) {
      add('issue', 'No control or comparison condition', 'Without a comparison you cannot tell whether the change came from your intervention.', 'Name the control (placebo, usual care, waitlist, vehicle, baseline) and how it differs from the treatment.');
    }
    if (d.type === 'experiment' && !has(all, /random/i)) add('issue', 'Random assignment is not described', 'Randomisation is what lets an experiment support causal claims.', 'Say how participants are allocated (e.g. computer-generated sequence, blocks or strata) and who conceals the allocation.');
    if (comparative && !has(all, /blind|mask/i)) add('tip', 'Blinding is not mentioned', 'Knowing the condition can bias participants, experimenters and assessors.', 'State who is blinded (participants, experimenters, outcome assessors), or why blinding is not possible.');
    if (d.type !== 'qual' && d.type !== 'review' && !has(all, /power|sample size|g\*power|effect size|precision|saturation/i)) {
      add('issue', 'The sample size is not justified', 'Reviewers ask how you chose the number; an underpowered study may miss real effects.', 'Report a power analysis (expected effect size, alpha, power) or another justification such as precision or available population.');
    }
    if (d.type === 'qual' && !has(all, /saturation|information power|purposive|theoretical sampling/i)) add('tip', 'Sampling logic is not explained', 'Qualitative reviewers look for why these participants and this number.', 'Describe purposive or theoretical sampling and how you will decide to stop (e.g. saturation or information power).');
    if (['cross', 'cohort', 'quasi'].includes(d.type) && !has(all, /confound|adjust|covariate|control for|matched|propensity/i)) {
      add('issue', 'Confounders are not addressed', 'Without random assignment, other variables can explain the association you find.', 'List the likely confounders and how you will adjust for them (covariates, matching, stratification).');
    }
    if (d.type === 'cross' && has(d.question, /\b(effect|impact|cause|improve|reduce|lead)\b|导致|影响/i)) add('tip', 'A causal question with a cross-sectional design', 'A single time point can show association, not effect.', 'Phrase the question as an association, or choose a longitudinal or experimental design.');
    if (!has(all, /valid|reliab|alpha|calibrat|standardi[sz]ed|pilot|instrument|scale|questionnaire|assay/i) && d.type !== 'review') {
      add('tip', 'Measurement quality is not described', 'Readers need to trust that your measures capture what you claim.', 'Name each instrument and cite evidence of its reliability and validity, or describe a pilot or calibration.');
    }
    if (d.type !== 'review' && d.type !== 'lab' && !has(all, /ethic|irb|consent|approval/i)) add('issue', 'Ethics approval and consent are not mentioned', 'Most journals will not review human research without them.', 'Plan to apply to your ethics committee (IRB) before recruiting, and describe how informed consent is obtained.');
    if (!has(all, /pre-?regist|osf|clinicaltrials|prospero|registered report/i)) add('tip', 'Consider preregistering', 'Registering hypotheses and the analysis plan before data collection makes results more credible.', d.type === 'experiment' ? 'Trials usually must be registered (e.g. ClinicalTrials.gov) before enrolment.' : d.type === 'review' ? 'Register the protocol on PROSPERO or OSF.' : 'Use OSF Registries or AsPredicted.');
    if (!has(d.analysis, /missing|imput|attrition|dropout|exclude/i) && String(d.analysis || '').trim()) add('tip', 'Missing data plan is absent', 'Dropout and missing answers can bias results.', 'Say how you will handle missing data (e.g. multiple imputation, sensitivity analysis) and report attrition.');
    if (d.type && GUIDELINES[d.type]) add('ask', `Follow the ${GUIDELINES[d.type]} reporting guideline`, 'Journals often require the checklist for your design, and it doubles as a design checklist.', 'Find it on the EQUATOR Network and check your plan against it now, before you collect data.');
    if (!notes.some((n) => n.level === 'issue')) notes.unshift({ level: 'ok', title: 'The basics are covered', why: 'The rule check found no missing essentials.', how: 'Ask the AI for a closer critique, and compare your plan with the methods of similar studies.' });
    return notes;
  }

  function blank() { return { type: '', question: '', variables: '', sample: '', procedure: '', analysis: '' }; }

  S.design = { TYPES, GUIDELINES, FIELDS, check, blank };
})(typeof window !== 'undefined' ? window : globalThis);
