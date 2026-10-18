// v2 form definition: every field the scouts fill in comes from here.
// Pages run in order; each field's `code` is its column key in the QR / TSV output.
var V2 = (globalThis.V2 = globalThis.V2 || {});

V2.CONFIG = {
  // The event every scout records for. The scouting lead sets it here once per event,
  // then redeploys / rebuilds the offline file. Scouts cannot change it in the app.
  // Use the TBA event key, e.g. '2026txhou'.
  event: '2026test',

  // Shown in the header
  team: { number: 9094, name: 'Earthquakers' },

  id: 'rebuilt2026-v2',
  title: 'REBUILT Scout',
  season: 2026,
  // Point values from the 2026 manual, Table 6-4
  points: { fuel: 1, autoL1: 15, climb: { None: 0, L1: 10, L2: 20, L3: 30 } },

  match: [
    {
      page: 'prematch', title: 'Pre-match', short: 'Pre', fields: [
        { code: 's', name: 'Scout initials', type: 'text', max: 5, required: true, keep: true },
        { code: 'e', name: 'Event', type: 'event' },
        { code: 'l', name: 'Match level', type: 'radio', choices: { qm: 'Quals', sf: 'Semis', f: 'Finals' }, def: 'qm', required: true, keep: true },
        { code: 'm', name: 'Match #', type: 'match', required: true },
        { code: 'r', name: 'Station', type: 'station', required: true, keep: true },
        { code: 't', name: 'Team #', type: 'team', required: true },
        { code: 'sp', name: 'Starting position', type: 'field', mode: 'single' },
        { code: 'pl', name: 'Preloaded Fuel', type: 'bool' },
        { code: 'ns', name: 'No show', type: 'bool' },
      ],
    },
    {
      page: 'auto', title: 'Auto', fields: [
        { code: 'af', name: 'Fuel scored', type: 'counter', steps: [1, 5, 10] },
        { code: 'am', name: 'Fuel missed', type: 'counter', steps: [1, 5] },
        { code: 'an', name: 'Went to neutral zone', type: 'bool' },
        { code: 'ai', name: 'Collected from', type: 'multi', choices: { d: 'Depot', o: 'Outpost', n: 'Neutral zone' } },
        { code: 'as', name: 'Shooting spots', type: 'field', mode: 'multi' },
        { code: 'ac', name: 'Tower Level 1', type: 'radio', choices: { n: 'No attempt', f: 'Failed', y: 'Climbed' }, def: 'n' },
      ],
    },
    {
      page: 'teleop', title: 'Teleop', fields: [
        { code: 'tf', name: 'Fuel scored', type: 'counter', steps: [1, 5, 10] },
        { code: 'tm', name: 'Fuel missed', type: 'counter', steps: [1, 5] },
        { code: 'tp', name: 'Fuel ferried to our zone', type: 'counter', steps: [1, 5, 10] },
        { code: 'ts', name: 'Shooting spots', type: 'field', mode: 'multi' },
        { code: 'tx', name: 'Crossed through', type: 'multi', choices: { b: 'Bump', t: 'Trench' } },
        { code: 'tq', name: 'Hub inactive, mostly', type: 'radio', choices: { c: 'Collected', f: 'Ferried', d: 'Defended', i: 'Idle' } },
        { code: 'tc', name: 'Collected from', type: 'multi', choices: { g: 'Ground', o: 'Outpost', d: 'Depot' } },
        { code: 'ti', name: 'Time incapacitated', type: 'timer' },
        { code: 'td', name: 'Time playing defense', type: 'timer' },
      ],
    },
    {
      page: 'endgame', title: 'Endgame', short: 'End', fields: [
        { code: 'gf', name: 'Fuel scored', type: 'counter', steps: [1, 5, 10] },
        { code: 'gm', name: 'Fuel missed', type: 'counter', steps: [1, 5] },
        { code: 'el', name: 'Tower level', type: 'radio', choices: { None: 'None', L1: 'L1', L2: 'L2', L3: 'L3' }, def: 'None' },
        { code: 'ep', name: 'Tower position', type: 'radio', choices: { A: 'A', B: 'B', C: 'C', D: 'D', E: 'E' } },
        { code: 'ef', name: 'Climb attempted but failed', type: 'bool' },
        { code: 'et', name: 'Time to climb', type: 'timer' },
      ],
    },
    {
      page: 'postmatch', title: 'Post-match', short: 'Post', fields: [
        { code: 'ds', name: 'Driver skill', type: 'rating', max: 5 },
        { code: 'dr', name: 'Defense they played', type: 'rating', max: 5, none: 'Did not play defense' },
        { code: 'dd', name: 'Handled being defended', type: 'rating', max: 5, none: 'Was not defended' },
        { code: 'sa', name: 'Shooting accuracy', type: 'radio', choices: { l: '< 50%', m: '50–80%', h: '> 80%' } },
        { code: 'to', name: 'Tipped over', type: 'bool' },
        { code: 'dk', name: 'Died / disabled', type: 'bool' },
        { code: 'bf', name: 'Beached on Fuel', type: 'bool' },
        { code: 'cd', name: 'Card', type: 'radio', choices: { n: 'None', y: 'Yellow', r: 'Red' }, def: 'n' },
        { code: 'co', name: 'Comments', type: 'textarea', max: 200 },
      ],
    },
  ],

  pit: [
    {
      page: 'pit', title: 'Pit', fields: [
        { code: 's', name: 'Scout initials', type: 'text', max: 5, required: true, keep: true },
        { code: 'e', name: 'Event', type: 'event' },
        { code: 't', name: 'Team #', type: 'number', required: true },
        { code: 'wt', name: 'Weight (lb)', type: 'number' },
        { code: 'dt', name: 'Drivetrain', type: 'radio', choices: { s: 'Swerve', t: 'Tank', m: 'Mecanum', o: 'Other' } },
        { code: 'cx', name: 'Can cross', type: 'multi', choices: { b: 'Bump', t: 'Trench' } },
        { code: 'sh', name: 'Shooter', type: 'radio', choices: { t: 'Turret', h: 'Adjustable hood', f: 'Fixed', n: 'None' } },
        { code: 'hc', name: 'Hopper capacity (Fuel)', type: 'number' },
        { code: 'in', name: 'Intake from', type: 'multi', choices: { g: 'Ground', o: 'Outpost', d: 'Depot' } },
        { code: 'ff', name: 'Shoots from far away', type: 'bool' },
        { code: 'cl', name: 'Climb levels', type: 'multi', choices: { 1: 'L1', 2: 'L2', 3: 'L3' } },
        { code: 'a1', name: 'Auto L1 climb', type: 'bool' },
        { code: 'au', name: 'Auto routines', type: 'textarea', max: 200 },
        { code: 'co', name: 'Comments', type: 'textarea', max: 200 },
      ],
    },
  ],
};
