// Per-team summary of match rows (pure, tested in tests/v2.test.js).
var V2 = (globalThis.V2 = globalThis.V2 || {});

(function () {
  function avg(a) {
    return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : 0;
  }
  function r1(x) {
    return Math.round(x * 10) / 10;
  }

  // Two scouts on the same robot in the same match: average their numbers into one row first,
  // so every match counts once in the team averages.
  function mergeDuplicates(rows) {
    var groups = {}, order = [];
    rows.forEach(function (v) {
      var k = v.t + '|' + (v.l || 'qm') + '|' + v.m;
      if (!groups[k]) { groups[k] = []; order.push(k); }
      groups[k].push(v);
    });
    return order.map(function (k) {
      var g = groups[k];
      if (g.length === 1) return g[0];
      var out = Object.assign({}, g[0]);
      Object.keys(out).forEach(function (f) {
        var vals = g.map(function (v) { return v[f]; });
        if (vals.every(function (x) { return typeof x === 'number'; })) out[f] = r1(avg(vals));
        else if (vals.every(function (x) { return typeof x === 'boolean'; })) out[f] = vals.filter(Boolean).length * 2 > vals.length;
        else if (vals.every(Array.isArray) && f !== 'ai' && f !== 'tx' && f !== 'tc') out[f] = [].concat.apply([], vals);
        else if (f === 'co') out[f] = vals.filter(Boolean).join(' / ');
        else if (f === 's') out[f] = vals.join('/');
      });
      out.scouts = g.length;
      return out;
    });
  }

  // A 1-10 rating as a number; 'None' (n) and blank count as 0
  function lvl(x) {
    return typeof x === 'number' ? x : 0;
  }

  // Climb points the robot earned: Auto Level 1 plus its Tower level at the end
  function climbPoints(v) {
    var P = V2.CONFIG.points;
    return (v.ac === 'y' ? P.autoL1 : 0) + (P.climb[v.el] || 0);
  }

  // Offense index 0-100 for one match: phase-weighted Fuel ratings plus climbing (see config.offense)
  function matchIndex(v) {
    if (v.ns) return 0;
    var O = V2.CONFIG.offense, P = V2.CONFIG.points;
    var scoring = (lvl(v.af) * O.auto + lvl(v.tf) * O.teleop + lvl(v.gf) * O.endgame) / 10;
    var climb = Math.min(1, climbPoints(v) / (P.autoL1 + P.climb.L3));
    return Math.round(100 * (O.scoring * scoring + O.climb * climb));
  }

  function teams(rows) {
    rows = mergeDuplicates(rows);
    var by = {};
    rows.forEach(function (v) {
      (by[v.t] = by[v.t] || []).push(v);
    });
    return Object.keys(by).map(function (t) {
      var all = by[t];
      var rs = all.filter(function (v) { return !v.ns; });
      var col = function (k) { return rs.map(function (v) { return lvl(v[k]); }); };
      // Shooting accuracy comes from the post-match estimate: midpoints of < 50%, 50-80%, > 80%
      var acc = rs.map(function (v) { return { l: 35, m: 65, h: 90 }[v.sa]; }).filter(function (x) { return x != null; });
      var lv = { None: 0, L1: 0, L2: 0, L3: 0 };
      rs.forEach(function (v) { lv[v.el || 'None']++; });
      // 'n' = did not play defense / was not defended: left out of the average, counted separately
      var ratings = function (k) { var a = rs.map(function (v) { return v[k]; }).filter(function (x) { return typeof x === 'number' && x > 0; }); return a.length ? r1(avg(a)) : null; };
      var idx = rs.map(matchIndex);
      return {
        t: Number(t),
        n: all.length,
        noShow: all.length - rs.length,
        autoFuel: r1(avg(col('af'))),
        teleFuel: r1(avg(col('tf'))),
        endFuel: r1(avg(col('gf'))),
        missed: r1(avg(rs.map(function (v) { return (lvl(v.am) + lvl(v.tm) + lvl(v.gm)) / 3; }))),
        ferried: r1(avg(col('tp'))),
        accuracy: acc.length ? Math.round(avg(acc)) : null,
        autoL1: rs.length ? Math.round((rs.filter(function (v) { return v.ac === 'y'; }).length / rs.length) * 100) : 0,
        levels: lv,
        climbPts: r1(avg(rs.map(function (v) { return V2.CONFIG.points.climb[v.el] || 0; }))),
        offense: r1(avg(idx)),
        best: idx.length ? Math.max.apply(null, idx) : 0,
        incap: r1(avg(col('ti'))),
        defense: r1(avg(col('td'))),
        driver: ratings('ds'),
        defRating: ratings('dr'),
        defendedRating: ratings('dd'),
        playedDefense: rs.filter(function (v) { return typeof v.dr === 'number' && v.dr > 0; }).length,
        wasDefended: rs.filter(function (v) { return typeof v.dd === 'number' && v.dd > 0; }).length,
        problems: all.filter(function (v) { return v.to || v.dk || v.bf; }).length,
        defenseShare: rs.length ? r1(rs.filter(function (v) { return (typeof v.dr === 'number' && v.dr > 0) || (v.td || 0) > 0; }).length / rs.length * 100) / 100 : 0,
        rows: all,
        comments: all.filter(function (v) { return v.co; }).map(function (v) { return { m: v.m, s: v.s, text: v.co }; }),
      };
    });
  }

  // Splits teams into offense and defense robots and gives each a 0-100 score within its group.
  // Offense score: the team's average offense index (0-100).
  // Defense score: 50% defense rating, 30% time spent defending (60 s = full), 20% reliability.
  function rank(stats) {
    var R = V2.CONFIG.roles;
    var out = { offense: [], defense: [] };
    stats.forEach(function (s) {
      var isDef = s.defenseShare >= R.share || s.defense >= R.seconds;
      var reliability = s.n ? 1 - Math.min(1, (s.problems + s.noShow) / s.n) : 0;
      s.role = isDef ? 'defense' : 'offense';
      s.roleReason = isDef
        ? 'Played defense in ' + Math.round(s.defenseShare * 100) + '% of matches, ' + s.defense + ' s per match on average'
        : 'Played defense in ' + Math.round(s.defenseShare * 100) + '% of matches';
      s.reliability = Math.round(reliability * 100);
      s.offenseScore = Math.round(s.offense);
      s.defenseScore = Math.round(((s.defRating || 0) / 5 * 0.5 + Math.min(1, s.defense / 60) * 0.3 + reliability * 0.2) * 100);
      out[s.role].push(s);
    });
    out.offense.sort(function (a, b) { return b.offenseScore - a.offenseScore || b.climbPts - a.climbPts; });
    out.defense.sort(function (a, b) { return b.defenseScore - a.defenseScore || b.offense - a.offense; });
    return out;
  }

  V2.stats = { matchIndex: matchIndex, climbPoints: climbPoints, teams: teams, mergeDuplicates: mergeDuplicates, rank: rank };
})();
