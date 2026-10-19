// Guide tab: everything a first-time scout needs, in the order they will need it.
var V2 = (globalThis.V2 = globalThis.V2 || {});

(function () {
  var h;

  function steps(items) {
    return h('ol', { class: 'gsteps' }, items.map(function (t) { return h('li', null, t); }));
  }
  function section(id, title, kids) {
    return h('section', { class: 'card guide', id: 'g-' + id }, h('h3', null, title), kids);
  }
  function table(head, rows) {
    return h('div', { class: 'scroll' }, h('table', { class: 'data gtable' },
      h('thead', null, h('tr', null, head.map(function (c) { return h('th', null, c); }))),
      h('tbody', null, rows.map(function (r) { return h('tr', null, r.map(function (c) { return h('td', null, c); })); }))));
  }

  function render(root) {
    h = V2.ui.h;
    var R = V2.CONFIG.roles, P = V2.CONFIG.points;
    var toc = [
      ['start', 'First time here'], ['match', 'Scouting a match'], ['send', 'Handing in your data'],
      ['scale', 'Rating scale'], ['lead', 'For the data lead'], ['rank', 'How rankings work'], ['words', 'Game words'],
    ];
    root.appendChild(h('div', { class: 'guidepage' },
      h('h2', null, 'Guide'),
      h('p', { class: 'muted' }, 'Two minutes to read. Every question in the form also has a short tip under it.'),
      h('nav', { class: 'toc' }, toc.map(function (t) {
        return h('button', { type: 'button', class: 'opt', onclick: function () {
          var el = document.getElementById('g-' + t[0]);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } }, t[1]);
      })),

      section('start', 'First time here', [
        h('p', null, 'You watch one robot for a whole match and record what it does. The app works with no internet; your records stay on this device until you hand them in.'),
        steps([
          'Open the Match tab.',
          'Type your initials, the match number, and tap the station the lead gave you (for example Red 2). The team number fills in by itself; check it against the robot\'s bumpers.',
          'Tap Next to move through Auto, Teleop, Endgame and Post-match while the match plays.',
          'At the end you get a QR code. Show it to the data lead, then tap Next match.',
        ]),
        h('p', { class: 'muted' }, 'Made a mistake? Tap ← Prev to go back to any page and fix it before you finish.'),
      ]),

      section('match', 'Scouting a match, page by page', [
        table(['Page', 'When', 'What you do'], [
          ['Pre-match', 'Before the start', 'Initials, match number, station, starting spot on the map, preload. Mark No show if the robot never comes out.'],
          ['Auto', 'First 20 s', 'Tap +1 for every Fuel that goes in the Hub; +5 / +10 when it dumps a load. Tap the map where it shoots. Climbed if it hangs on Tower Level 1.'],
          ['Teleop', 'Next 2 min 20 s', 'Keep counting Fuel. Start the Incap timer when it breaks down, and the Defense timer when it blocks opponents; stop them when that ends.'],
          ['Endgame', 'Last 30 s', 'Keep counting Fuel, then record the highest Tower level it was hanging on at the buzzer.'],
          ['Post-match', 'Right after', 'Rate driver and defense with the 1–5 scale below, tick any problems, add a comment.'],
        ]),
        h('p', null, h('b', null, 'Counting tips: '), 'Watch only your robot. If you lose count, make your best guess and say so in Comments; a close guess is far more useful than a blank.'),
        h('p', null, h('b', null, 'The field map: '), 'it turns to match Red or Blue once you pick a station. If it looks mirrored from where you sit, turn on Flip the field map on the Setup tab.'),
      ]),

      section('send', 'Handing in your data', [
        h('p', null, 'After each match: show the QR code on the last page to the data lead.'),
        h('p', null, 'Several matches at once:'),
        steps([
          'Open the Data tab, find Send records by QR.',
          'Choose Not sent yet (or a match range) and tap Show QR codes.',
          'Hold your screen up for the lead. After each code is scanned, tap Next QR.',
          'When the last one is scanned, tap Done, all scanned.',
        ]),
        h('p', { class: 'muted' }, 'Scanning the same code twice never creates duplicates, so if you are unsure whether one was scanned, just show it again.'),
      ]),

      section('scale', 'Rating scale (1–5)', [
        h('p', null, 'Everyone uses the same scale so ratings can be compared. 3 is a normal robot; save 1 and 5 for the clearly worst and best.'),
        h('div', { class: 'scales' },
          [['Driver skill', ['Crashes, gets stuck, hesitates', 'Slow, wastes time', 'Normal, no big mistakes', 'Quick and confident', 'Fast, smooth, avoids traffic']],
           ['Defense they played', ['Barely slowed anyone', 'Got in the way now and then', 'Cost opponents a few shots', 'Clearly reduced their scoring', 'Shut a robot down']],
           ['Handled being defended', ['Stopped scoring', 'Lost a lot of shots', 'Slowed down', 'Lost only a little', 'Kept scoring anyway']]].map(function (sc) {
            return h('div', { class: 'scale' }, h('h4', null, sc[0]),
              h('ol', { class: 'scalelist' }, sc[1].map(function (t, i) { return h('li', null, h('b', null, i + 1), h('span', null, t)); })));
          })),
        h('p', { class: 'muted' }, 'Did not play defense / Was not defended are separate answers, not a 0. They do not pull a team\'s average down.'),
      ]),

      section('lead', 'For the data lead', [
        steps([
          'Before the event: put the event code in js/config.js and share the new offline file. Load the match schedule on the Setup tab so team numbers fill in.',
          'During matches: on the Data tab tap Scan with phone camera (or click the Import box and use a USB scanner). Every code imports; batch codes import all their matches.',
          'Check the Teams table on the Data tab, or open the Rank tab for offense and defense rankings.',
          'To share or back up: Copy match data and paste it into Google Sheets.',
        ]),
      ]),

      section('rank', 'How rankings work', [
        h('p', null, 'Every number is an average over all of a team\'s matches. If two scouts watched the same robot in the same match, their two records are averaged first, so that match counts once.'),
        table(['', 'How it is worked out'], [
          ['Points per match', 'Fuel scored (Auto + Teleop + Endgame) × ' + P.fuel + ', + ' + P.autoL1 + ' for an Auto Level 1 climb, + Tower level at the end (L1 ' + P.climb.L1 + ', L2 ' + P.climb.L2 + ', L3 ' + P.climb.L3 + ').'],
          ['Defense robot', 'Played defense in at least ' + Math.round(R.share * 100) + '% of its matches, or ' + R.seconds + ' s or more of defense per match. Everyone else is an offense robot.'],
          ['Offense score', 'Average points ÷ the best team\'s average points × 100. The top offense robot is 100.'],
          ['Defense score', '50% defense rating (5/5 = full) + 30% time defending (60 s per match = full) + 20% reliability (no breakdowns, no-shows).'],
          ['Accuracy', 'Fuel scored ÷ (Fuel scored + Fuel missed).'],
          ['Reliability', 'Share of matches without tipping, dying, getting beached, or not showing up.'],
        ]),
        h('p', { class: 'muted' }, 'Tap any team in the Rank tab to see all of its averages, its shooting map and each match.'),
      ]),

      section('words', 'Game words', [
        table(['Word', 'Meaning'], [
          ['Fuel', 'The foam balls. The only thing robots score with.'],
          ['Hub', 'The goal in front of each alliance zone. Fuel counts only while that alliance\'s Hub is lit (active).'],
          ['Active / inactive', 'After Auto the two Hubs take turns being switched off. A robot whose Hub is off usually collects or ferries Fuel instead.'],
          ['Ferry', 'Moving Fuel from the middle of the field back to your own zone for teammates.'],
          ['Tower', 'The climbing structure. Levels L1, L2, L3 are worth ' + P.climb.L1 + ', ' + P.climb.L2 + ' and ' + P.climb.L3 + ' points at the end.'],
          ['Bump / Trench', 'Two ways between zones: over the Bump, or under the low Trench.'],
          ['Outpost / Depot', 'Where Fuel is fed in by the human player (Outpost) or stored on the floor (Depot).'],
          ['Auto / Teleop / Endgame', 'First 20 s robots drive themselves; then drivers take over; the last 30 s is Endgame.'],
          ['Incap', 'Incapacitated: the robot stopped working or got stuck.'],
          ['No show', 'The robot was not on the field for that match.'],
        ]),
      ])
    ));
  }

  // One-time welcome card at the top of the Match tab
  function welcome() {
    if (V2.ui.get('welcomed', false)) return null;
    h = V2.ui.h;
    var card = h('section', { class: 'welcome' },
      h('div', null, h('b', null, 'New to scouting?'), h('p', null, 'Read the 2-minute Guide first. Every question also has a tip under it.')),
      h('div', { class: 'row' },
        h('a', { class: 'btn primary', href: '#guide', onclick: function () { V2.ui.set('welcomed', true); } }, 'Open the Guide'),
        h('button', { type: 'button', class: 'btn', onclick: function () { V2.ui.set('welcomed', true); card.remove(); } }, 'Got it')));
    return card;
  }

  V2.guide = { render: render, welcome: welcome };
})();
