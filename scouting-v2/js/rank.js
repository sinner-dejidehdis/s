// Rank tab: teams split into offense and defense robots, each ranked; tap a team for its averages.
var V2 = (globalThis.V2 = globalThis.V2 || {});

(function () {
  var h;
  var group = 'offense', open = null; // open: team number shown in detail

  function data() {
    var all = V2.ui.get('records', {});
    var ev = V2.CONFIG.event;
    var rows = [], pits = [];
    Object.keys(all).forEach(function (k) {
      var r = all[k];
      if (r.values.e && r.values.e !== ev) return;
      (r.kind === 'pit' ? pits : rows).push(r.values);
    });
    var stats = V2.stats.teams(rows);
    return { ranked: V2.stats.rank(stats), stats: stats, pits: pits };
  }

  function fmt(v, unit) {
    return v == null ? '–' : v + (unit || '');
  }

  function listView(root, D, redraw) {
    var list = D.ranked[group];
    var isOff = group === 'offense';
    var R = V2.CONFIG.roles;
    root.appendChild(h('div', { class: 'rankpage' },
      h('h2', null, 'Rankings'),
      h('div', { class: 'seg roleswitch', role: 'tablist' },
        [['offense', 'Offense robots', D.ranked.offense.length], ['defense', 'Defense robots', D.ranked.defense.length]].map(function (o) {
          return h('button', { type: 'button', role: 'tab', 'aria-selected': group === o[0] ? 'true' : 'false', class: 'opt' + (group === o[0] ? ' on' : ''), onclick: function () { group = o[0]; redraw(); } }, o[1] + ' (' + o[2] + ')');
        })),
      h('p', { class: 'muted small' }, isOff
        ? 'Score = average points by scout counts (Fuel + climb), scaled so the best team is 100.'
        : 'Score = 50% defense rating, 30% time spent defending (60 s per match = full), 20% reliability. A team is a defense robot when it defended in at least ' +
          Math.round(R.share * 100) + '% of its matches or ' + R.seconds + ' s per match.'),
      list.length ? h('ol', { class: 'ranklist' }, list.map(function (s, i) {
        var score = isOff ? s.offenseScore : s.defenseScore;
        return h('li', null, h('button', { type: 'button', class: 'rankrow', onclick: function () { open = s.t; redraw(); window.scrollTo(0, 0); } },
          h('span', { class: 'pos' }, i + 1),
          h('span', { class: 'who' }, h('b', null, s.t), h('small', null, s.n + (s.n === 1 ? ' match' : ' matches'))),
          h('span', { class: 'meter', 'aria-hidden': 'true' }, h('i', { style: 'width:' + score + '%' })),
          h('span', { class: 'score' }, score),
          h('span', { class: 'facts' }, isOff
            ? fmt(s.points) + ' pts · climb ' + fmt(s.climbPts) + ' · acc ' + fmt(s.accuracy, '%')
            : 'rating ' + fmt(s.defRating, '/5') + ' · ' + fmt(s.defense, ' s') + ' · ' + fmt(s.points) + ' pts')));
      })) : h('p', { class: 'muted' }, 'No ' + group + ' robots yet. Import match data on the Data page.')));
  }

  function tile(label, value, sub) {
    return h('div', { class: 'tile' }, h('small', null, label), h('b', null, value), sub ? h('span', { class: 'muted' }, sub) : null);
  }

  function detailView(root, D, redraw) {
    var s = D.stats.filter(function (x) { return x.t === open; })[0];
    if (!s) { open = null; return listView(root, D, redraw); }
    var list = D.ranked[s.role];
    var pos = list.indexOf(s) + 1;
    var rows = V2.stats.mergeDuplicates(s.rows).sort(function (a, b) { return a.m - b.m; });
    var auto = [], tele = [];
    rows.forEach(function (v) { if (!v.ns) { auto = auto.concat(v.as || []); tele = tele.concat(v.ts || []); } });
    var pit = D.pits.filter(function (v) { return Number(v.t) === s.t; })[0];
    var pitFields = V2.codec.fields('pit').filter(function (f) { return ['s', 'e', 't'].indexOf(f.code) < 0; });

    root.appendChild(h('div', { class: 'rankpage' },
      h('button', { type: 'button', class: 'btn small back', onclick: function () { open = null; redraw(); } }, '← Rankings'),
      h('div', { class: 'teamhead' },
        h('h2', null, 'Team ' + s.t),
        h('span', { class: 'rolechip ' + s.role }, (s.role === 'offense' ? 'Offense' : 'Defense') + ' #' + pos + ' of ' + list.length)),
      h('p', { class: 'muted small' }, s.roleReason + '. All numbers are averages over ' + s.n + (s.n === 1 ? ' match' : ' matches') +
        '; when two scouts watched the same match, their numbers were averaged first.'),
      h('div', { class: 'tiles' },
        tile('Avg points', fmt(s.points), 'best ' + fmt(s.best)),
        tile('Offense score', s.offenseScore, 'of 100'),
        tile('Defense score', s.defenseScore, 'of 100'),
        tile('Accuracy', fmt(s.accuracy, '%'), 'made / attempted'),
        tile('Fuel / match', fmt(Math.round((s.autoFuel + s.teleFuel + s.endFuel) * 10) / 10), 'A ' + s.autoFuel + ' · T ' + s.teleFuel + ' · E ' + s.endFuel),
        tile('Climb', fmt(s.climbPts) + ' pts', 'L1 ' + s.levels.L1 + ' · L2 ' + s.levels.L2 + ' · L3 ' + s.levels.L3),
        tile('Auto L1', fmt(s.autoL1, '%'), 'of matches'),
        tile('Ferried', fmt(s.ferried), 'Fuel per match'),
        tile('Defense', fmt(s.defense, ' s'), 'rating ' + fmt(s.defRating, '/5') + ' · in ' + Math.round(s.defenseShare * 100) + '% of matches'),
        tile('When defended', fmt(s.defendedRating, '/5'), 'defended in ' + s.wasDefended + ' matches'),
        tile('Driver', fmt(s.driver, '/5'), 'scout rating'),
        tile('Reliability', s.reliability + '%', 'incap ' + fmt(s.incap, ' s') + ' · issues ' + s.problems + ' · no-shows ' + s.noShow)),
      h('section', { class: 'card' }, h('h3', null, 'Shooting spots'),
        h('div', { class: 'legend' }, h('span', null, h('i', { class: 'k-auto' }), 'Auto (' + auto.length + ')'), h('span', null, h('i', { class: 'k-tele' }), 'Teleop (' + tele.length + ')')),
        V2.field.heat([{ points: auto, color: V2.field.css('--s1') }, { points: tele, color: V2.field.css('--s2') }]),
        h('small', { class: 'muted' }, 'Drawn from the robot\'s own alliance end, with its own wall on the left.')),
      h('section', { class: 'card' }, h('h3', null, 'Match by match'),
        h('div', { class: 'scroll' }, h('table', { class: 'data' },
          h('thead', null, h('tr', null, ['Match', 'Pts', 'Auto', 'Tele', 'End', 'Climb', 'Def. s', 'Def.', 'Driver', 'Scout'].map(function (c) { return h('th', null, c); }))),
          h('tbody', null, rows.map(function (v) {
            if (v.ns) return h('tr', null, h('td', null, 'Q' + v.m), h('td', { colspan: 9, class: 'muted' }, 'No show'));
            return h('tr', null,
              h('td', null, 'Q' + v.m), h('td', { class: 'num' }, V2.stats.rowPoints(v)), h('td', { class: 'num' }, v.af || 0),
              h('td', { class: 'num' }, v.tf || 0), h('td', { class: 'num' }, v.gf || 0), h('td', null, v.el || 'None'),
              h('td', { class: 'num' }, v.td || 0), h('td', { class: 'num' }, typeof v.dr === 'number' ? v.dr : '–'),
              h('td', { class: 'num' }, v.ds || '–'), h('td', null, v.s + (v.scouts > 1 ? ' (avg)' : '')));
          }))))),
      pit ? h('section', { class: 'card' }, h('h3', null, 'Pit'), h('dl', { class: 'pit' }, pitFields.map(function (f) {
        var v = pit[f.code];
        if (v == null || v === '' || (Array.isArray(v) && !v.length)) return null;
        var shown = f.choices ? (Array.isArray(v) ? v : [v]).map(function (k) { return f.choices[k] || k; }).join(', ') : v === true ? 'Yes' : v === false ? 'No' : v;
        return [h('dt', null, f.name), h('dd', null, String(shown))];
      }))) : null,
      s.comments.length ? h('section', { class: 'card' }, h('h3', null, 'Comments'),
        h('ul', { class: 'notes' }, s.comments.map(function (c) { return h('li', null, h('b', null, 'Q' + c.m + ' '), c.text, h('small', { class: 'muted' }, ' — ' + c.s)); }))) : null));
  }

  function render(root) {
    h = V2.ui.h;
    var redraw = function () { root.textContent = ''; render(root); };
    var D = data();
    if (open != null) detailView(root, D, redraw);
    else listView(root, D, redraw);
  }

  V2.rank = { render: render };
})();
