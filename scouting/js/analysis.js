// 数据计算：单场推导 → TBA 校准 → 队伍汇总 → 选人分数 / 比赛预测。
// 全部是纯函数，tests/analysis.test.js 用 node 直接跑。
var SC = (globalThis.SC = globalThis.SC || {});

(function () {
  var G = function () {
    return SC.GAME;
  };
  var PERIOD_KEYS = ['auto', 'transition', 'shift1', 'shift2', 'shift3', 'shift4', 'endgame'];

  function round(x, d) {
    var p = Math.pow(10, d == null ? 1 : d);
    return Math.round(x * p) / p;
  }
  function mean(arr) {
    return arr.length ? arr.reduce(function (a, b) { return a + b; }, 0) / arr.length : 0;
  }
  function sd(arr) {
    if (arr.length < 2) return 0;
    var m = mean(arr);
    return Math.sqrt(mean(arr.map(function (x) { return (x - m) * (x - m); })));
  }
  function zeroPeriods() {
    var o = {};
    PERIOD_KEYS.forEach(function (k) { o[k] = 0; });
    return o;
  }

  // t: 距比赛开始的 0.1 秒；te: 进入 TELEOP 时的 t
  function periodOf(t, te) {
    if (t < te) return 'auto';
    var s = (t - te) / 10;
    var ps = G().periods;
    for (var i = 0; i < ps.length; i++) if (s < ps[i].end) return ps[i].key;
    return 'endgame';
  }

  // 本联盟 Hub 在该时段是否激活。inactiveFirst: true/false/null（未知）
  function hubActive(period, inactiveFirst) {
    if (period === 'auto') return true;
    var p = G().periods.filter(function (x) { return x.key === period; })[0];
    if (!p || !p.alt) return true;
    if (inactiveFirst == null) return null;
    return p.alt === 'first' ? !inactiveFirst : inactiveFirst;
  }

  // 单条客观记录 → 统计量
  function derive(r) {
    var g = G();
    var te = r.te != null ? r.te : g.autoSec * 10;
    var inactiveFirst = r.hf === 'us' ? true : r.hf === 'them' ? false : null;
    var d = {
      key: SC.store ? SC.store.recordKey(r) : '',
      ev: r.ev, mt: Number(r.mt), tm: Number(r.tm), st: r.st || '', sc: r.sc || '',
      color: (r.st || 'R')[0], ns: !!r.ns,
      scoreSec: zeroPeriods(), estFuel: zeroPeriods(), estKnown: zeroPeriods(),
      ferrySec: 0, poachSec: 0, inactiveScoreSec: 0,
      drops: 0, incapSec: 0, defenseSec: 0, bump: 0, trench: 0, autoNeutral: false, shootIntake: 0,
      sp: r.sp, pl: !!r.pl,
      inactiveFirst: inactiveFirst,
      climbAttempt: false, climbPos: '', climbLeft: null,
      autoTower: 0, towerLevel: 0,
      driver: r.dr || null, defenseRating: r.df || null, tags: r.tg || [], notes: r.nt || '',
      calibrated: false, towerFromTba: false,
    };
    var zone = 'A';
    (r.a || []).forEach(function (a) {
      var type = a[0], t = a[1];
      var per = periodOf(t, te);
      if (type === 'z') {
        if (a[3] === 'b') d.bump++;
        if (a[3] === 't') d.trench++;
        zone = a[2];
        if (per === 'auto' && zone === 'N') d.autoNeutral = true;
      } else if (type === 's') {
        var z = a[2], sec = (a[3] || 0) / 10, est = a[4];
        if (a[5]) d.shootIntake++;
        if (z === 'A') {
          d.scoreSec[per] += sec;
          if (est != null && est >= 0) {
            d.estFuel[per] += est;
            d.estKnown[per] += sec;
          }
          if (hubActive(per, inactiveFirst) === false) d.inactiveScoreSec += sec;
        } else if (z === 'N') d.ferrySec += sec;
        else if (z === 'O') d.poachSec += sec;
      } else if (type === 'd') d.drops++;
      else if (type === 'i') d.incapSec += (a[2] || 0) / 10;
      else if (type === 'f') d.defenseSec += (a[2] || 0) / 10;
    });

    var cl = r.cl || {};
    if (cl.ao) d.autoTower = 1;
    if (cl.s != null || cl.l) {
      d.climbAttempt = true;
      d.climbPos = cl.p || '';
      if (cl.s != null) d.climbLeft = Math.max(0, round(g.teleopSec - (cl.s - te) / 10, 0));
      if (cl.o && cl.l) d.towerLevel = cl.l;
    }
    finishFuel(d);
    return d;
  }

  // 用估计球数算 Fuel（未校准时）：Hub 关闭的时段不计分
  function finishFuel(d) {
    var auto = 0, tele = 0;
    PERIOD_KEYS.forEach(function (k) {
      var v = d.estFuel[k];
      if (hubActive(k, d.inactiveFirst) === false) v = 0;
      if (k === 'auto') auto += v;
      else tele += v;
    });
    d.autoFuel = auto;
    d.teleFuel = tele;
    finishPoints(d);
  }

  function finishPoints(d) {
    var P = G().points;
    d.fuelPts = (d.autoFuel + d.teleFuel) * P.fuelActive;
    d.towerPts = d.autoTower * P.autoTowerL1 + (P.tower[d.towerLevel] || 0);
    d.autoPts = d.autoFuel * P.fuelActive + d.autoTower * P.autoTowerL1;
    d.total = d.fuelPts + d.towerPts;
    d.scoreSecTotal = PERIOD_KEYS.reduce(function (s, k) { return s + d.scoreSec[k]; }, 0);
  }

  // 同一场同一队有多名记录员时取平均（数值）/ 第一条（其余）
  function mergeDuplicates(list) {
    var groups = {};
    list.forEach(function (d) {
      var k = d.ev + '|' + d.mt + '|' + d.tm;
      (groups[k] = groups[k] || []).push(d);
    });
    return Object.keys(groups).map(function (k) {
      var g = groups[k];
      if (g.length === 1) return g[0];
      var m = JSON.parse(JSON.stringify(g[0]));
      m.sc = g.map(function (x) { return x.sc; }).join('/');
      ['ferrySec', 'poachSec', 'inactiveScoreSec', 'drops', 'incapSec', 'defenseSec', 'bump', 'trench'].forEach(function (f) {
        m[f] = mean(g.map(function (x) { return x[f]; }));
      });
      ['scoreSec', 'estFuel', 'estKnown'].forEach(function (f) {
        PERIOD_KEYS.forEach(function (p) {
          m[f][p] = mean(g.map(function (x) { return x[f][p]; }));
        });
      });
      m.notes = g.map(function (x) { return x.notes; }).filter(Boolean).join(' / ');
      finishFuel(m);
      return m;
    });
  }

  // 1678 式校准：用 TBA 每个时段的 Hub 分数，按各机器人在该时段的得分射球时长分配。
  // 需要同一联盟 3 台都有记录；Auto 优先用主观记录员给的 Auto 贡献百分比。
  // tba: { qm12: { red: {teams:[...], hub:{auto:..}, autoTower:[..], endTower:[..]}, blue: {...} } }
  function calibrate(derived, tba, subjective) {
    var G2 = G();
    var byMatch = {};
    derived.forEach(function (d) {
      (byMatch['qm' + d.mt] = byMatch['qm' + d.mt] || []).push(d);
    });
    var acMap = {}; // mt|team -> auto contribution %
    (subjective || []).forEach(function (s) {
      (s.teams || []).forEach(function (t) {
        if (t.ac != null) acMap[s.mt + '|' + t.tm] = t.ac;
      });
    });

    Object.keys(byMatch).forEach(function (mk) {
      var m = tba && tba[mk];
      if (!m) return;
      var redAuto = (m.red && m.red.hub && m.red.hub.auto) || 0;
      var blueAuto = (m.blue && m.blue.hub && m.blue.hub.auto) || 0;
      ['red', 'blue'].forEach(function (col) {
        var al = m[col];
        if (!al || !al.teams) return;
        var other = col === 'red' ? blueAuto : redAuto;
        var mine = col === 'red' ? redAuto : blueAuto;
        var inactiveFirst = mine === other ? null : mine > other;
        var robots = al.teams.map(function (tm, i) {
          var d = byMatch[mk].filter(function (x) { return x.tm === tm; })[0];
          if (d) {
            // 爬塔用 TBA 的真实结果
            if (al.autoTower) d.autoTower = al.autoTower[i] >= 1 ? 1 : 0;
            if (al.endTower) d.towerLevel = al.endTower[i] || 0;
            if (al.autoTower || al.endTower) d.towerFromTba = true;
            if (inactiveFirst != null) d.inactiveFirst = inactiveFirst;
          }
          return d;
        });
        var complete = robots.every(Boolean);
        if (complete && al.hub) {
          var alloc = robots.map(function () { return zeroPeriods(); });
          PERIOD_KEYS.forEach(function (p) {
            var pts = al.hub[p] || 0;
            if (!pts) return;
            var w = robots.map(function (d) { return d.ns ? 0 : d.scoreSec[p]; });
            if (p === 'auto') {
              var ac = robots.map(function (d) { return acMap[d.mt + '|' + d.tm]; });
              if (ac.every(function (x) { return x != null; }) && ac.some(function (x) { return x > 0; })) w = ac;
            }
            var sum = w.reduce(function (a, b) { return a + b; }, 0);
            if (sum <= 0) return; // 没人在射：可能是人类玩家，不分配
            robots.forEach(function (d, i) {
              alloc[i][p] = (pts * w[i]) / sum / G2.points.fuelActive;
            });
          });
          robots.forEach(function (d, i) {
            d.autoFuel = alloc[i].auto;
            d.teleFuel = PERIOD_KEYS.slice(1).reduce(function (s, p) { return s + alloc[i][p]; }, 0);
            d.calibrated = true;
            finishPoints(d);
          });
        } else {
          robots.forEach(function (d) {
            if (d) finishFuel(d);
          });
        }
      });
    });
    return derived;
  }

  // 精简 TBA 比赛对象
  function slimTbaMatch(m) {
    var cfg = G().tba;
    var out = {};
    ['red', 'blue'].forEach(function (col) {
      var sb = m.score_breakdown && m.score_breakdown[col];
      var teams = ((m.alliances && m.alliances[col] && m.alliances[col].team_keys) || []).map(function (k) {
        return Number(String(k).replace('frc', ''));
      });
      var a = { teams: teams, score: m.alliances && m.alliances[col] ? m.alliances[col].score : null };
      if (sb) {
        a.hub = {};
        Object.keys(cfg.hubPeriods).forEach(function (p) {
          a.hub[p] = (sb.hubScore && sb.hubScore[cfg.hubPeriods[p]]) || 0;
        });
        a.autoTower = [1, 2, 3].map(function (i) { return cfg.towerLevel[sb['autoTowerRobot' + i]] || 0; });
        a.endTower = [1, 2, 3].map(function (i) { return cfg.towerLevel[sb['endGameTowerRobot' + i]] || 0; });
        a.total = sb.totalPoints;
      }
      out[col] = a;
    });
    return out;
  }

  // 全部数据 → 每场推导列表（已去重 + 校准）
  function matchRows(ev, opts) {
    opts = opts || {};
    var recs = SC.store.list('m', ev);
    var list = mergeDuplicates(recs.map(derive));
    if (opts.calibrate !== false) calibrate(list, SC.store.tbaResults(ev), SC.store.list('s', ev));
    return list.sort(function (a, b) { return a.mt - b.mt || a.tm - b.tm; });
  }

  // 队伍汇总
  function teamStats(rows, subjective, pits) {
    var teams = {};
    function T(tm) {
      return (teams[tm] = teams[tm] || { tm: tm, rows: [], subj: [], pit: null, notes: [], dnp: false, marks: [] });
    }
    rows.forEach(function (d) { T(d.tm).rows.push(d); });
    (subjective || []).forEach(function (s) {
      (s.teams || []).forEach(function (t) {
        if (!t.tm) return;
        var x = T(Number(t.tm));
        x.subj.push(Object.assign({ mt: s.mt, sc: s.sc }, t));
        if (t.dnp) x.dnp = true;
        if (t.mark) x.marks.push(s.mt);
        if (t.nt) x.notes.push({ mt: s.mt, src: '主观 ' + (s.sc || ''), text: t.nt });
      });
    });
    (pits || []).forEach(function (p) {
      T(Number(p.tm)).pit = p;
    });

    return Object.keys(teams).map(function (k) {
      var x = teams[k];
      var played = x.rows.filter(function (d) { return !d.ns; });
      var n = x.rows.length;
      var col = function (f) { return played.map(function (d) { return d[f]; }); };
      var totals = col('total');
      var climbs = played.filter(function (d) { return d.climbAttempt || d.towerLevel; });
      var lv = [0, 0, 0, 0];
      played.forEach(function (d) { lv[d.towerLevel]++; });
      x.rows.forEach(function (d) {
        if (d.notes) x.notes.push({ mt: d.mt, src: '客观 ' + d.sc, text: d.notes });
      });
      var tagCount = {};
      x.rows.forEach(function (d) {
        d.tags.forEach(function (t) { tagCount[t] = (tagCount[t] || 0) + 1; });
      });
      var levelTags = {};
      x.subj.forEach(function (s) {
        Object.keys(s.tags || {}).forEach(function (t) {
          var v = s.tags[t];
          if (v === true) tagCount[t] = (tagCount[t] || 0) + 1;
          else if (typeof v === 'number') (levelTags[t] = levelTags[t] || []).push(v);
        });
      });
      var levelAvg = {};
      Object.keys(levelTags).forEach(function (t) { levelAvg[t] = round(mean(levelTags[t]), 2); });
      var broken = x.rows.filter(function (d) {
        return d.tags.indexOf('broke') >= 0 || d.tags.indexOf('disc') >= 0 || d.tags.indexOf('tip') >= 0;
      }).length;
      var drivers = x.rows.map(function (d) { return d.driver; }).filter(Boolean);
      var defs = x.rows.map(function (d) { return d.defenseRating; }).filter(Boolean);
      var acs = x.subj.map(function (s) { return s.ac; }).filter(function (v) { return v != null; });
      var shootSec = sumBy(played, 'scoreSecTotal');
      var fuelSum = sumBy(played, 'autoFuel') + sumBy(played, 'teleFuel');

      return {
        tm: x.tm,
        n: n,
        noShow: n - played.length,
        autoFuel: round(mean(col('autoFuel'))),
        teleFuel: round(mean(col('teleFuel'))),
        fuelPts: round(mean(col('fuelPts'))),
        towerPts: round(mean(col('towerPts'))),
        autoPts: round(mean(col('autoPts'))),
        total: round(mean(totals)),
        maxTotal: round(totals.length ? Math.max.apply(null, totals) : 0),
        sdTotal: round(sd(totals)),
        scoreSec: round(mean(col('scoreSecTotal'))),
        bps: shootSec > 0 ? round(fuelSum / shootSec, 2) : null,
        ferrySec: round(mean(col('ferrySec'))),
        poachSec: round(mean(col('poachSec'))),
        defenseSec: round(mean(col('defenseSec'))),
        inactiveScoreSec: round(mean(col('inactiveScoreSec'))),
        drops: round(mean(col('drops'))),
        incapRate: n ? round(x.rows.filter(function (d) { return d.incapSec > 0; }).length / n, 2) : 0,
        incapSec: round(mean(col('incapSec'))),
        brokenRate: n ? round(broken / n, 2) : 0,
        autoTowerRate: played.length ? round(mean(col('autoTower')), 2) : 0,
        autoNeutralRate: played.length ? round(played.filter(function (d) { return d.autoNeutral; }).length / played.length, 2) : 0,
        climbRate: played.length ? round(played.filter(function (d) { return d.towerLevel > 0; }).length / played.length, 2) : 0,
        climbLevels: lv,
        climbLeft: round(mean(climbs.map(function (d) { return d.climbLeft; }).filter(function (v) { return v != null; }))),
        bump: sumBy(played, 'bump'),
        trench: sumBy(played, 'trench'),
        driver: drivers.length ? round(mean(drivers), 2) : null,
        defenseRating: defs.length ? round(mean(defs), 2) : null,
        autoContrib: acs.length ? round(mean(acs)) : null,
        tagCount: tagCount,
        levelAvg: levelAvg,
        calibratedShare: played.length ? round(played.filter(function (d) { return d.calibrated; }).length / played.length, 2) : 0,
        dnp: x.dnp,
        marks: x.marks,
        notes: x.notes.sort(function (a, b) { return a.mt - b.mt; }),
        pit: x.pit,
        rows: x.rows,
      };
    });
  }

  function sumBy(list, f) {
    return list.reduce(function (s, d) { return s + (d[f] || 0); }, 0);
  }

  // 选人分数：各项按全场最大值归一化后加权，0-100
  function pickMetrics(t) {
    var defense = t.levelAvg.defense != null ? t.levelAvg.defense / 4 : t.defenseRating != null ? t.defenseRating / 5 : 0;
    var driving = t.levelAvg.agility != null ? t.levelAvg.agility / 4 : t.driver != null ? t.driver / 5 : 0;
    var rel = 1 - Math.min(1, (t.n ? t.noShow / t.n : 0) + t.incapRate * 0.6 + t.brokenRate * 0.4);
    return { fuel: t.fuelPts, tower: t.towerPts, auto: t.autoPts, reliability: rel, defense: defense, driving: driving };
  }
  function pickScores(stats, weights) {
    var ms = stats.map(pickMetrics);
    var keys = Object.keys(weights);
    var max = {};
    keys.forEach(function (k) {
      max[k] = Math.max.apply(null, ms.map(function (m) { return m[k]; }).concat([1e-9]));
    });
    var wsum = keys.reduce(function (s, k) { return s + Math.max(0, weights[k]); }, 0) || 1;
    return stats.map(function (t, i) {
      var s = keys.reduce(function (acc, k) {
        var v = max[k] > 0 ? Math.max(0, ms[i][k]) / max[k] : 0;
        return acc + Math.max(0, weights[k]) * v;
      }, 0);
      return { tm: t.tm, score: round((s / wsum) * 100), metrics: ms[i] };
    });
  }

  // 比赛预测：联盟三队平均得分相加
  function predict(statsByTeam, red, blue) {
    function side(teams) {
      var rows = teams.map(function (tm) {
        var s = statsByTeam[tm];
        return { tm: tm, s: s || null };
      });
      var fuel = 0, tower = 0, total = 0;
      rows.forEach(function (r) {
        if (!r.s) return;
        fuel += r.s.fuelPts;
        tower += r.s.towerPts;
        total += r.s.total;
      });
      var rp = SC.GAME.rp;
      return {
        rows: rows,
        fuel: round(fuel),
        tower: round(tower),
        total: round(total),
        energized: fuel >= rp.energized,
        supercharged: fuel >= rp.supercharged,
        traversal: tower >= rp.traversal,
      };
    }
    return { red: side(red), blue: side(blue) };
  }

  // 每场一行的 CSV
  function toCsv(rows) {
    var cols = ['mt', 'tm', 'st', 'sc', 'ns', 'autoFuel', 'teleFuel', 'fuelPts', 'autoTower', 'towerLevel', 'towerPts', 'total',
      'scoreSecTotal', 'ferrySec', 'poachSec', 'inactiveScoreSec', 'defenseSec', 'incapSec', 'drops', 'bump', 'trench',
      'autoNeutral', 'climbPos', 'climbLeft', 'driver', 'defenseRating', 'calibrated', 'tags', 'notes'];
    var esc = function (v) {
      if (v == null) return '';
      if (Array.isArray(v)) v = v.join(';');
      if (typeof v === 'number') v = round(v, 2);
      v = String(v);
      return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    };
    return [cols.join(',')]
      .concat(rows.map(function (r) { return cols.map(function (c) { return esc(r[c]); }).join(','); }))
      .join('\n');
  }

  SC.analysis = {
    PERIOD_KEYS: PERIOD_KEYS,
    periodOf: periodOf,
    hubActive: hubActive,
    derive: derive,
    mergeDuplicates: mergeDuplicates,
    calibrate: calibrate,
    slimTbaMatch: slimTbaMatch,
    matchRows: matchRows,
    teamStats: teamStats,
    pickMetrics: pickMetrics,
    pickScores: pickScores,
    predict: predict,
    toCsv: toCsv,
    round: round,
  };
})();
