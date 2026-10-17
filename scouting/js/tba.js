// The Blue Alliance：拉队伍列表、资格赛赛程和比分明细（需要在设置里填 TBA Read API Key）。
var SC = (globalThis.SC = globalThis.SC || {});

(function () {
  var BASE = 'https://www.thebluealliance.com/api/v3';

  function get(path, key) {
    return fetch(BASE + path, { headers: { 'X-TBA-Auth-Key': key } }).then(function (r) {
      if (!r.ok) throw new Error('TBA ' + r.status + ' ' + path);
      return r.json();
    });
  }

  function num(k) {
    return Number(String(k).replace('frc', ''));
  }

  SC.tba = {
    // 返回 { teams, matches, results }，并写入本地
    sync: function (ev, key) {
      return Promise.all([get('/event/' + ev + '/teams/simple', key), get('/event/' + ev + '/matches', key)]).then(function (res) {
        var teams = res[0].map(function (t) { return t.team_number; }).sort(function (a, b) { return a - b; });
        var quals = res[1].filter(function (m) { return m.comp_level === 'qm'; });
        var matches = quals
          .map(function (m) {
            var row = { mt: m.match_number };
            ['red', 'blue'].forEach(function (c) {
              (m.alliances[c].team_keys || []).forEach(function (k, i) {
                row[(c === 'red' ? 'R' : 'B') + (i + 1)] = num(k);
              });
            });
            return row;
          })
          .sort(function (a, b) { return a.mt - b.mt; });
        var results = {};
        quals.forEach(function (m) {
          if (m.score_breakdown) results['qm' + m.match_number] = SC.analysis.slimTbaMatch(m);
        });
        SC.store.saveSchedule(ev, { teams: teams, matches: matches });
        SC.store.saveTbaResults(ev, results);
        return { teams: teams.length, matches: matches.length, results: Object.keys(results).length };
      });
    },

    // 离线导入赛程 CSV：match,R1,R2,R3,B1,B2,B3（第一行可以是表头）
    parseScheduleCsv: function (text) {
      var matches = [];
      var teams = {};
      String(text)
        .split(/\r?\n/)
        .forEach(function (line) {
          var c = line.split(/[,\t;]/).map(function (s) { return s.trim(); });
          if (c.length < 7 || !/^\d+$/.test(c[0])) return;
          var row = { mt: Number(c[0]) };
          ['R1', 'R2', 'R3', 'B1', 'B2', 'B3'].forEach(function (st, i) {
            row[st] = Number(c[i + 1]) || 0;
            if (row[st]) teams[row[st]] = 1;
          });
          matches.push(row);
        });
      return {
        teams: Object.keys(teams).map(Number).sort(function (a, b) { return a - b; }),
        matches: matches,
      };
    },
  };
})();
