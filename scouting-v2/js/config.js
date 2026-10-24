// v2 form definition: every field the scouts fill in comes from here.
// Pages run in order; each field's `code` is its column key in the QR / TSV output.
var V2 = (globalThis.V2 = globalThis.V2 || {});

V2.CONFIG = {
  // The event every scout records for. The scouting lead sets it here once per event,
  // then redeploys / rebuilds the offline file. Scouts cannot change it in the app.
  // Use the TBA event key, e.g. '2026txhou'.
  event: '2026test',

  // Shown in the header
  team: { number: 9094, name: 'Earthquakers', logo: 'logo.png' },

  id: 'rebuilt2026-v2',
  title: 'REBUILT Scout',
  season: 2026,
  // Point values from the 2026 manual, Table 6-4
  points: { autoL1: 15, climb: { None: 0, L1: 10, L2: 20, L3: 30 } },

  // Offense index (0-100) for one match. Fuel is rated 1-10 per phase, so it is weighted by how
  // long each phase lasts; climbing (Auto L1 + Tower level, 45 points max) makes up the rest.
  offense: { auto: 0.2, teleop: 0.6, endgame: 0.2, scoring: 0.7, climb: 0.3 },

  // Automatic Offense / Defense split. A team counts as a defense robot when it played defense
  // in at least `share` of its matches, or averaged at least `seconds` of defense per match.
  roles: { share: 0.4, seconds: 20 },

  match: [
    {
      page: 'prematch', intro: 'Fill this in before the match starts. Pick your station first: the team number and the field map follow it.', title: 'Pre-match', short: 'Pre', fields: [
        { code: 's', hint: 'Your initials, e.g. SL. Remembered for next time.', name: 'Scout initials', type: 'text', max: 5, required: true, keep: true },
        { code: 'e', name: 'Event', type: 'event' },
        { code: 'l', hint: 'Quals for qualification matches, the usual ones. Semis/Finals only in playoffs.', name: 'Match level', type: 'radio', choices: { qm: 'Quals', sf: 'Semis', f: 'Finals' }, def: 'qm', required: true, keep: true },
        { code: 'm', hint: 'The match number on the field screen, e.g. 12 for Qualification 12.', name: 'Match #', type: 'match', required: true },
        { code: 'r', hint: 'Which robot you watch: Red 1–3 or Blue 1–3, as the scouting lead assigned you.', name: 'Station', type: 'station', required: true, keep: true },
        { code: 't', hint: "Fills in from the schedule. Check it against the robot's bumper number.", name: 'Team #', type: 'team', required: true },
        { code: 'sp', hint: 'Tap where the robot sits when the match starts. The map turns to match Red or Blue.', name: 'Starting position', type: 'field', mode: 'single' },
        { code: 'pl', hint: 'Yes if the robot starts holding Fuel.', name: 'Preloaded Fuel', type: 'bool' },
        { code: 'ns', hint: 'Yes only if the robot never came onto the field. Then skip to Finish.', name: 'No show', type: 'bool' },
      ],
    },
    {
      page: 'auto', intro: 'The first 20 seconds, robots drive themselves. Watch only your robot, then rate its Fuel on the 1–10 scale.', title: 'Auto', fields: [
        { code: 'af', hint: 'How much Fuel it got into the Hub in Auto, 1 = a few, 10 = a lot. None if it scored nothing.', name: 'Fuel scored (1–10)', type: 'rating', max: 10, none: 'None' },
        { code: 'am', hint: 'How much it missed in Auto, 1 = a few misses, 10 = a lot. None if it never missed.', name: 'Fuel missed (1–10)', type: 'rating', max: 10, none: 'None' },
        { code: 'an', hint: 'Yes if it drove past the Hub line into the middle of the field.', name: 'Went to neutral zone', type: 'bool' },
        { code: 'ai', hint: 'Where it picked up Fuel during Auto. Tap all that apply.', name: 'Collected from', type: 'multi', choices: { d: 'Depot', o: 'Outpost', n: 'Neutral zone' } },
        { code: 'as', hint: 'Tap each spot where it stopped to shoot. Several taps are fine.', name: 'Shooting spots', type: 'field', mode: 'multi' },
        { code: 'ac', hint: 'Climbed = it hung on Tower Level 1 by the end of Auto (15 points).', name: 'Tower Level 1', type: 'radio', choices: { n: 'No attempt', f: 'Failed', y: 'Climbed' }, def: 'n' },
      ],
    },
    {
      page: 'teleop', intro: 'Drivers take over for 2 minutes 20 seconds. Rate its Fuel for the whole period; start a timer when your robot breaks down or plays defense.', title: 'Teleop', fields: [
        { code: 'tf', hint: 'How much Fuel it got into the Hub in Teleop, 1 = a few, 10 = a lot. See the scale on the Guide tab.', name: 'Fuel scored (1–10)', type: 'rating', max: 10, none: 'None' },
        { code: 'tm', hint: 'How much it missed in Teleop, 1 = a few misses, 10 = a lot.', name: 'Fuel missed (1–10)', type: 'rating', max: 10, none: 'None' },
        { code: 'tp', hint: 'Fuel it pushed or shot from the middle back into its own zone for teammates. Not scoring.', name: 'Fuel ferried to our zone', type: 'counter', steps: [1, 5, 10] },
        { code: 'ts', hint: 'Tap the places it usually shoots from.', name: 'Shooting spots', type: 'field', mode: 'multi' },
        { code: 'tx', hint: 'How it moves between zones: over the Bump, under the Trench, or both.', name: 'Crossed through', type: 'multi', choices: { b: 'Bump', t: 'Trench' } },
        { code: 'tq', hint: "When its alliance's Hub is switched off, what does it mostly do?", name: 'Hub inactive, mostly', type: 'radio', choices: { c: 'Collected', f: 'Ferried', d: 'Defended', i: 'Idle' } },
        { code: 'tc', hint: 'Where it picks up Fuel. Tap all that apply.', name: 'Collected from', type: 'multi', choices: { g: 'Ground', o: 'Outpost', d: 'Depot' } },
        { code: 'ti', hint: 'Start when the robot stops moving or is broken; stop when it moves again.', name: 'Time incapacitated', type: 'timer' },
        { code: 'td', hint: 'Start when it blocks or pushes an opponent on purpose; stop when it goes back to scoring.', name: 'Time playing defense', type: 'timer' },
      ],
    },
    {
      page: 'endgame', intro: 'The last 30 seconds. Most robots keep shooting while others climb the Tower: rate the Fuel and record the climb.', title: 'Endgame', short: 'End', fields: [
        { code: 'gf', hint: 'How much Fuel it scored in the last 30 seconds, 1 = a few, 10 = a lot. Many robots keep shooting here.', name: 'Fuel scored (1–10)', type: 'rating', max: 10, none: 'None' },
        { code: 'gm', hint: 'How much it missed in the last 30 seconds, 1 = a few, 10 = a lot.', name: 'Fuel missed (1–10)', type: 'rating', max: 10, none: 'None' },
        { code: 'el', hint: 'Highest level it was hanging on when the match ended. L1 = 10, L2 = 20, L3 = 30 points.', name: 'Tower level', type: 'radio', choices: { None: 'None', L1: 'L1', L2: 'L2', L3: 'L3' }, def: 'None' },
        { code: 'ep', hint: 'Which part of the Tower it climbed, A to E from left to right as you see it.', name: 'Tower position', type: 'radio', choices: { A: 'A', B: 'B', C: 'C', D: 'D', E: 'E' } },
        { code: 'ef', hint: 'Yes if it tried to climb but fell off or ran out of time.', name: 'Climb attempted but failed', type: 'bool' },
        { code: 'et', hint: 'Start when it begins to climb, stop when it is hanging. Leave at 0 if it did not climb.', name: 'Time to climb', type: 'timer' },
      ],
    },
    {
      page: 'postmatch', intro: 'Right after the match, while it is fresh. Use the 1–5 scale on the Guide tab so everyone rates the same way.', title: 'Post-match', short: 'Post', fields: [
        { code: 'ds', hint: '1 = crashes and hesitates, 3 = normal, 5 = fast, smooth, avoids traffic.', name: 'Driver skill', type: 'rating', max: 5 },
        { code: 'dr', hint: 'Only if it blocked opponents. 1 = barely slowed them, 3 = cost them a few shots, 5 = shut a robot down.', name: 'Defense they played', type: 'rating', max: 5, none: 'Did not play defense' },
        { code: 'dd', hint: 'Only if an opponent blocked it. 1 = stopped scoring, 3 = slowed down, 5 = kept scoring anyway.', name: 'Handled being defended', type: 'rating', max: 5, none: 'Was not defended' },
        { code: 'sa', hint: 'Out of the shots it took, roughly how many went in.', name: 'Shooting accuracy', type: 'radio', choices: { l: '< 50%', m: '50–80%', h: '> 80%' } },
        { code: 'to', hint: 'Yes if it fell on its side.', name: 'Tipped over', type: 'bool' },
        { code: 'dk', hint: 'Yes if it stopped working for part of the match.', name: 'Died / disabled', type: 'bool' },
        { code: 'bf', hint: 'Yes if it got stuck on top of Fuel balls and could not drive.', name: 'Beached on Fuel', type: 'bool' },
        { code: 'cd', hint: 'Only if the referees showed a card to this team.', name: 'Card', type: 'radio', choices: { n: 'None', y: 'Yellow', r: 'Red' }, def: 'n' },
        { code: 'co', hint: 'Anything the numbers miss: great at X, broke Y, strategy notes.', name: 'Comments', type: 'textarea', max: 200 },
      ],
    },
  ],

  pit: [
    {
      page: 'pit', intro: "Walk to the team's pit before matches start and ask them. Write what they tell you; matches will show what is really true.", title: 'Pit', fields: [
        { code: 's', hint: 'Your initials.', name: 'Scout initials', type: 'text', max: 5, required: true, keep: true },
        { code: 'e', name: 'Event', type: 'event' },
        { code: 't', hint: 'The team you are interviewing.', name: 'Team #', type: 'number', required: true },
        { code: 'wt', hint: 'Ask for the robot weight without bumpers or battery, in pounds.', name: 'Weight (lb)', type: 'number' },
        { code: 'dt', hint: 'Swerve wheels turn in every direction; tank drives like a car; mecanum has angled rollers.', name: 'Drivetrain', type: 'radio', choices: { s: 'Swerve', t: 'Tank', m: 'Mecanum', o: 'Other' } },
        { code: 'cx', hint: 'Can the robot go over the Bump, under the Trench, or both?', name: 'Can cross', type: 'multi', choices: { b: 'Bump', t: 'Trench' } },
        { code: 'sh', hint: 'Turret spins to aim; adjustable hood changes the shot angle; fixed does neither.', name: 'Shooter', type: 'radio', choices: { t: 'Turret', h: 'Adjustable hood', f: 'Fixed', n: 'None' } },
        { code: 'hc', hint: 'How many Fuel it can hold at once.', name: 'Hopper capacity (Fuel)', type: 'number' },
        { code: 'in', hint: 'Where it can pick up Fuel.', name: 'Intake from', type: 'multi', choices: { g: 'Ground', o: 'Outpost', d: 'Depot' } },
        { code: 'ff', hint: 'Yes if it can score from far away, e.g. from the middle of the field.', name: 'Shoots from far away', type: 'bool' },
        { code: 'cl', hint: 'Which Tower levels they say it can climb.', name: 'Climb levels', type: 'multi', choices: { 1: 'L1', 2: 'L2', 3: 'L3' } },
        { code: 'a1', hint: 'Yes if it can climb Level 1 during Auto.', name: 'Auto L1 climb', type: 'bool' },
        { code: 'au', hint: 'Ask which Auto routines they have and where they start.', name: 'Auto routines', type: 'textarea', max: 200 },
        { code: 'co', hint: 'Anything else useful: strengths, known problems, what they need from partners.', name: 'Comments', type: 'textarea', max: 200 },
      ],
    },
  ],
};
