// 分析页面：队伍总表、单队详情、选人名单、比赛预测。
var SC = (globalThis.SC = globalThis.SC || {});
SC.views = SC.views || {};

(function () {
  var h, fmt, pct;
  var sortKey = 'total', sortDir = -1;

  function load() {
    var s = SC.store.settings();
    var ev = s.event;
    var rows = SC.analysis.matchRows(ev, { calibrate: s.calibrate });
    var stats = SC.analysis.teamStats(rows, SC.store.list('s', ev), SC.store.list('p', ev));
    var by = {};
    stats.forEach(function (t) { by[t.tm] = t; });
    var pl = SC.store.picklist(ev);
    stats.forEach(function (t) { if (pl.dnp[t.tm]) t.dnp = true; });
    return { ev: ev, rows: rows, stats: stats, by: by, settings: s };
  }

  var COLS = [
    { k: 'tm', label: 'Team' },
    { k: 'n', label: 'M' },
    { k: 'total', label: 'Avg pts' },
    { k: 'fuelPts', label: 'Fuel' },
    { k: 'autoPts', label: 'Auto' },
    { k: 'towerPts', label: 'Climb' },
    { k: 'climbRate', label: 'Climb %', f: pct },
    { k: 'bps', label: 'Fuel/s', d: 2 },
    { k: 'ferrySec', label: 'Ferry s' },
    { k: 'defenseSec', label: 'Def. s' },
    { k: 'incapRate', label: 'Incap %', f: pct },
    { k: 'driver', label: 'Driver' },
    { k: 'sdTotal', label: 'Std dev' },
  ];

  SC.views.teams = function (root) {
    h = SC.ui.h; fmt = SC.ui.fmt; pct = SC.ui.pct;
    var D = load();
    var stats = D.stats.slice().sort(function (a, b) {
      var x = a[sortKey], y = b[sortKey];
      if (x == null) return 1;
      if (y == null) return -1;
      return (x - y) * sortDir;
    });
    var calib = D.rows.filter(function (r) { return r.calibrated; }).length;
    root.appendChild(h('section', null,
      h('h2', null, 'Teams · ' + (D.ev || 'no event set')),
      h('p', { class: 'muted' }, D.rows.length + ' match records, ' + calib + ' with Fuel calibrated by TBA. Click a header to sort, a team for details. ⊘ = DNP'),
      stats.length ? h('div', { class: 'scroll' }, h('table', { class: 'data' },
        h('thead', null, h('tr', null, COLS.map(function (c) {
          return h('th', { class: 'sort' + (sortKey === c.k ? ' on' : ''), onclick: function () {
            if (sortKey === c.k) sortDir = -sortDir;
            else { sortKey = c.k; sortDir = c.k === 'tm' ? 1 : -1; }
            root.textContent = '';
            SC.views.teams(root);
          } }, c.label + (sortKey === c.k ? (sortDir > 0 ? ' ▲' : ' ▼') : ''));
        }))),
        h('tbody', null, stats.map(function (t) {
          return h('tr', { class: t.dnp ? 'dnp' : '' }, COLS.map(function (c) {
            if (c.k === 'tm') return h('td', null, h('a', { href: '#team/' + t.tm }, (t.dnp ? '⊘ ' : '') + t.tm));
            return h('td', { class: 'num' }, c.f ? c.f(t[c.k]) : fmt(t[c.k], c.d));
          }));
        }))
      )) : h('p', { class: 'muted' }, 'No data yet. Import QR codes on the Data page.')
    ));
  };

  // ---------- 单队 ----------
  function tile(label, value, sub) {
    return h('div', { class: 'tile' }, h('small', null, label), h('b', null, value), sub ? h('small', { class: 'muted' }, sub) : null);
  }

  // 每场得分堆叠柱（Auto Fuel / Teleop Fuel / 爬塔）
  function matchChart(rows) {
    var played = rows.filter(function (r) { return !r.ns; });
    if (!played.length) return null;
    var series = [
      { k: 'autoFuel', label: 'Auto Fuel', cls: 's1' },
      { k: 'teleFuel', label: 'Teleop Fuel', cls: 's2' },
      { k: 'towerPts', label: 'Climb', cls: 's3' },
    ];
    // 按屏幕宽度画，手机上字不会被缩小
    var W = Math.max(300, Math.min(900, window.innerWidth - 64)), H = Math.round(Math.min(260, W * 0.45)), pad = { l: 34, r: 8, t: 10, b: 24 };
    var max = Math.max.apply(null, played.map(function (r) { return r.total; }).concat([10]));
    var step = Math.pow(10, Math.floor(Math.log10(max)));
    var top = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map(function (m) { return m * step; }).filter(function (v) { return v >= max; })[0];
    var bw = Math.min(36, (W - pad.l - pad.r) / played.length - 6);
    var x0 = function (i) { return pad.l + ((W - pad.l - pad.r) / played.length) * (i + 0.5) - bw / 2; };
    var y = function (v) { return pad.t + (H - pad.t - pad.b) * (1 - v / top); };
    var NS = 'http://www.w3.org/2000/svg';
    function s(tag, attrs, txt) {
      var el = document.createElementNS(NS, tag);
      Object.keys(attrs).forEach(function (k) { el.setAttribute(k, attrs[k]); });
      if (txt != null) el.textContent = txt;
      return el;
    }
    var svg = s('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'chart', role: 'img', 'aria-label': 'Points per match' });
    [0, 0.5, 1].forEach(function (f) {
      var v = Math.round(top * f);
      svg.appendChild(s('line', { x1: pad.l, x2: W - pad.r, y1: y(v), y2: y(v), class: 'grid' }));
      svg.appendChild(s('text', { x: pad.l - 6, y: y(v) + 4, class: 'axis', 'text-anchor': 'end' }, v));
    });
    var tip = h('div', { class: 'tip' });
    played.forEach(function (r, i) {
      var acc = 0;
      series.forEach(function (se) {
        var v = r[se.k];
        if (v <= 0) return;
        var y1 = y(acc + v), y2 = y(acc);
        var gap = acc > 0 ? 2 : 0; // 段间 2px 间隙
        svg.appendChild(s('rect', { x: x0(i), y: y1, width: bw, height: Math.max(0, y2 - y1 - gap), rx: 2, class: 'bar ' + se.cls }));
        acc += v;
      });
      svg.appendChild(s('text', { x: x0(i) + bw / 2, y: H - 8, class: 'axis', 'text-anchor': 'middle' }, 'Q' + r.mt));
      var hit = s('rect', { x: x0(i) - 3, y: pad.t, width: bw + 6, height: H - pad.t - pad.b, class: 'hit' });
      hit.addEventListener('mouseenter', function () {
        tip.textContent = 'Q' + r.mt + ': Auto Fuel ' + fmt(r.autoFuel) + ' · Teleop Fuel ' + fmt(r.teleFuel) + ' · Climb ' + r.towerPts + ' · Total ' + fmt(r.total) + (r.calibrated ? ' (calibrated)' : '');
        tip.style.visibility = 'visible';
      });
      hit.addEventListener('mouseleave', function () { tip.style.visibility = 'hidden'; });
      hit.addEventListener('click', function () {
        tip.textContent = 'Q' + r.mt + ': Auto Fuel ' + fmt(r.autoFuel) + ' · Teleop Fuel ' + fmt(r.teleFuel) + ' · Climb ' + r.towerPts + ' · Total ' + fmt(r.total);
        tip.style.visibility = 'visible';
      });
      svg.appendChild(hit);
    });
    var legend = h('div', { class: 'legend' }, series.map(function (se) { return h('span', null, h('i', { class: se.cls }), se.label); }));
    return h('div', { class: 'chartbox' }, h('h3', null, 'Points per match'), legend, svg, tip);
  }

  SC.views.team = function (root, tm) {
    h = SC.ui.h; fmt = SC.ui.fmt; pct = SC.ui.pct;
    var D = load();
    var t = D.by[tm];
    var pl = SC.store.picklist(D.ev);
    if (!t) {
      root.appendChild(h('p', null, 'No data for ' + tm + '.'));
      return;
    }
    var tagLabel = {};
    SC.GAME.postTags.concat(SC.GAME.subjectiveTags).forEach(function (x) { tagLabel[x.key] = x.label; });
    var pit = t.pit && t.pit.d ? t.pit.d : null;
    var photos = h('div', { class: 'row' });
    ['full', 'side'].forEach(function (slot) {
      SC.photos.get(D.ev + '|' + tm + '|' + slot).then(function (u) {
        if (u) photos.appendChild(h('img', { class: 'photo', src: u, alt: tm + ' ' + slot }));
      }).catch(function () {});
    });

    root.appendChild(h('section', null,
      h('div', { class: 'row between' },
        h('h2', null, (t.dnp ? '⊘ ' : '') + 'Team ' + tm),
        h('button', { class: 'btn small' + (pl.dnp[tm] ? ' danger' : ''), onclick: function () {
          if (pl.dnp[tm]) delete pl.dnp[tm];
          else pl.dnp[tm] = true;
          SC.store.savePicklist(D.ev, pl);
          root.textContent = '';
          SC.views.team(root, tm);
        } }, pl.dnp[tm] ? 'Remove DNP' : 'Mark DNP')),
      h('div', { class: 'tiles' },
        tile('Avg points', fmt(t.total), 'Best ' + fmt(t.maxTotal) + ' · ±' + fmt(t.sdTotal)),
        tile('Fuel / match', fmt(t.fuelPts), 'Auto ' + fmt(t.autoFuel) + ' · Teleop ' + fmt(t.teleFuel)),
        tile('Climb', fmt(t.towerPts) + ' pts', 'L1/L2/L3 = ' + t.climbLevels.slice(1).join('/') + ' · Auto L1 ' + pct(t.autoTowerRate)),
        tile('Shot rate', t.bps == null ? '–' : t.bps + ' Fuel/s', 'Scoring ' + fmt(t.scoreSec) + ' s/match'),
        tile('Reliability', pct(1 - t.incapRate), 'Incap ' + pct(t.incapRate) + ' · no-shows ' + t.noShow),
        tile('Other', 'Ferry ' + fmt(t.ferrySec) + 's', 'Defense ' + fmt(t.defenseSec) + 's · poach ' + fmt(t.poachSec) + 's')
      ),
      h('p', { class: 'muted' },
        t.n + ' matches · ' + pct(t.calibratedShare) + ' calibrated · climb starts with ' + fmt(t.climbLeft) + ' s left · Auto to neutral ' + pct(t.autoNeutralRate) +
        ' · Bump ' + t.bump + ' / Trench ' + t.trench + ' crossings' + (t.autoContrib != null ? ' · Auto share ' + t.autoContrib + '%' : '') +
        (t.inactiveScoreSec ? ' · shoots at inactive Hub ' + fmt(t.inactiveScoreSec) + ' s/match' : '')),
      matchChart(t.rows),
      h('div', { class: 'card' }, h('h3', null, 'Tags'),
        h('div', { class: 'chips' },
          Object.keys(t.tagCount).sort(function (a, b) { return t.tagCount[b] - t.tagCount[a]; }).map(function (k) { return h('span', { class: 'chip static' }, (tagLabel[k] || k) + ' ×' + t.tagCount[k]); }),
          Object.keys(t.levelAvg).map(function (k) { return h('span', { class: 'chip static' }, (tagLabel[k] || k) + ' ' + t.levelAvg[k] + '/4'); })
        ),
        t.marks.length ? h('p', null, '★ Flagged matches: ' + t.marks.map(function (m) { return 'Q' + m; }).join(', ')) : null),
      h('div', { class: 'card' }, h('h3', null, 'Match by match'),
        h('div', { class: 'scroll' }, h('table', { class: 'data' },
          h('thead', null, h('tr', null, ['Match', 'Station', 'Auto', 'Teleop', 'Climb', 'Total', 'Score s', 'Ferry s', 'Def. s', 'Incap s', 'Driver', 'Scout'].map(function (c) { return h('th', null, c); }))),
          h('tbody', null, t.rows.map(function (r) {
            if (r.ns) return h('tr', null, h('td', null, 'Q' + r.mt), h('td', null, r.st), h('td', { colspan: 10 }, 'No Show'));
            return h('tr', null,
              h('td', null, 'Q' + r.mt), h('td', null, r.st),
              h('td', { class: 'num' }, fmt(r.autoFuel) + (r.autoTower ? '+L1' : '')),
              h('td', { class: 'num' }, fmt(r.teleFuel) + (r.calibrated ? '' : '*')),
              h('td', { class: 'num' }, r.towerLevel ? 'L' + r.towerLevel : '–'),
              h('td', { class: 'num' }, fmt(r.total)),
              h('td', { class: 'num' }, fmt(r.scoreSecTotal)), h('td', { class: 'num' }, fmt(r.ferrySec)),
              h('td', { class: 'num' }, fmt(r.defenseSec)), h('td', { class: 'num' }, fmt(r.incapSec)),
              h('td', { class: 'num' }, fmt(r.driver)), h('td', null, r.sc));
          }))
        )),
        h('small', { class: 'muted' }, '* = scout estimate, not calibrated by TBA')),
      h('div', { class: 'card' }, h('h3', null, 'Notes'),
        t.notes.length ? h('ul', { class: 'notes' }, t.notes.map(function (n) { return h('li', null, h('b', null, 'Q' + n.mt + ' '), h('small', { class: 'muted' }, n.src + ': '), n.text); })) : h('p', { class: 'muted' }, 'None')),
      h('div', { class: 'card' }, h('h3', null, 'Pit info'),
        pit ? h('dl', { class: 'pit' }, SC.GAME.pitFields.map(function (f) {
          var v = pit[f.key];
          if (v == null || v === '') return null;
          return [h('dt', null, f.label), h('dd', null, Array.isArray(v) ? v.join(', ') : v === true ? 'Yes' : v === false ? 'No' : String(v))];
        })) : h('p', { class: 'muted' }, 'No pit data yet'),
        photos)
    ));
  };

  // ---------- 选人 ----------
  SC.views.pick = function (root) {
    h = SC.ui.h; fmt = SC.ui.fmt; pct = SC.ui.pct;
    var D = load();
    var pl = SC.store.picklist(D.ev);
    var presets = SC.GAME.pickPresets;
    var w = pl.weights || Object.assign({}, presets[Object.keys(presets)[0]]);
    var scores = SC.analysis.pickScores(D.stats, w);
    var scoreOf = {};
    scores.forEach(function (s) { scoreOf[s.tm] = s; });
    var ranked = scores.slice().sort(function (a, b) { return b.score - a.score; });
    // 名单里补上新出现的队伍
    D.stats.forEach(function (t) { if (pl.order.indexOf(t.tm) < 0) pl.order.push(t.tm); });

    function save() {
      pl.weights = w;
      SC.store.savePicklist(D.ev, pl);
    }
    function redraw() {
      save();
      root.textContent = '';
      SC.views.pick(root);
    }
    var labels = { fuel: 'Fuel', tower: 'Climb', auto: 'Auto', reliability: 'Reliability', defense: 'Defense', driving: 'Driving' };

    var dragFrom = null;
    var list = h('ol', { class: 'picklist' }, pl.order.map(function (tm, i) {
      var t = D.by[tm];
      var sc = scoreOf[tm];
      var li = h('li', { class: (pl.dnp[tm] ? 'dnp ' : '') + (pl.picked[tm] ? 'picked' : ''), draggable: 'true' },
        h('span', { class: 'rank' }, i + 1),
        h('a', { href: '#team/' + tm, class: 'tm' }, tm),
        h('span', { class: 'muted' }, sc ? 'score ' + sc.score : '', t ? ' · avg ' + fmt(t.total) + ' · climb ' + pct(t.climbRate) : ''),
        h('span', { class: 'acts' },
          h('button', { class: 'btn small', onclick: function () { if (i > 0) { pl.order.splice(i - 1, 0, pl.order.splice(i, 1)[0]); redraw(); } } }, '↑'),
          h('button', { class: 'btn small', onclick: function () { if (i < pl.order.length - 1) { pl.order.splice(i + 1, 0, pl.order.splice(i, 1)[0]); redraw(); } } }, '↓'),
          h('button', { class: 'btn small' + (pl.picked[tm] ? ' active' : ''), onclick: function () { pl.picked[tm] = !pl.picked[tm]; redraw(); } }, 'Picked'),
          h('button', { class: 'btn small' + (pl.dnp[tm] ? ' danger' : ''), onclick: function () { if (pl.dnp[tm]) delete pl.dnp[tm]; else pl.dnp[tm] = true; redraw(); } }, 'DNP')
        )
      );
      li.addEventListener('dragstart', function () { dragFrom = i; });
      li.addEventListener('dragover', function (e) { e.preventDefault(); });
      li.addEventListener('drop', function (e) {
        e.preventDefault();
        if (dragFrom == null || dragFrom === i) return;
        pl.order.splice(i, 0, pl.order.splice(dragFrom, 1)[0]);
        redraw();
      });
      return li;
    }));

    root.appendChild(h('section', null,
      h('h2', null, 'Picklist · ' + (D.ev || '')),
      h('div', { class: 'card' }, h('h3', null, '1. Pickability'),
        h('p', { class: 'muted' }, 'Each metric is scaled to the event best, then weighted. Max 100. Start from a preset, then tune for what our robot needs.'),
        SC.ui.chips(Object.keys(presets), '', function (k) { w = Object.assign({}, presets[k]); redraw(); }),
        h('div', { class: 'weights' }, Object.keys(labels).map(function (k) {
          return h('label', { class: 'wt' }, h('span', null, labels[k]),
            h('input', { type: 'range', min: 0, max: 1, step: 0.1, value: w[k] || 0, onchange: function (e) { w[k] = Number(e.target.value); redraw(); } }),
            h('b', null, (w[k] || 0).toFixed(1)));
        })),
        h('ol', { class: 'ranked' }, ranked.slice(0, 24).map(function (s) {
          return h('li', { class: pl.dnp[s.tm] ? 'dnp' : '' }, h('a', { href: '#team/' + s.tm }, s.tm), ' ', h('b', null, s.score));
        })),
        h('button', { class: 'btn', onclick: function () {
          SC.ui.ask('Replace the manual list below with this ranking?', 'Replace').then(function (ok) {
            if (!ok) return;
            pl.order = ranked.map(function (s) { return s.tm; });
            redraw();
          });
        } }, 'Build list from scores ↓')
      ),
      h('div', { class: 'card' }, h('h3', null, '2. Manual list (for the picklist meeting)'),
        h('p', { class: 'muted' }, 'Drag or use ↑↓ to reorder. During alliance selection, mark teams that get picked.'),
        list,
        h('button', { class: 'btn', onclick: function () {
          var lines = ['rank,team,score,avg,dnp,picked'].concat(pl.order.map(function (tm, i) {
            var t = D.by[tm];
            return [i + 1, tm, scoreOf[tm] ? scoreOf[tm].score : '', t ? t.total : '', pl.dnp[tm] ? 1 : 0, pl.picked[tm] ? 1 : 0].join(',');
          }));
          SC.ui.download('picklist_' + D.ev + '.csv', lines.join('\n'), 'text/csv');
        } }, 'Export CSV')
      )
    ));
    save();
  };

  // ---------- 预测 ----------
  var predMt = null;
  SC.views.predict = function (root) {
    h = SC.ui.h; fmt = SC.ui.fmt; pct = SC.ui.pct;
    var D = load();
    var sch = SC.store.schedule(D.ev).matches;
    var scouted = Math.max.apply(null, [0].concat(D.rows.map(function (r) { return r.mt; })));
    if (predMt == null) predMt = Math.min(scouted + 1, sch.length ? sch[sch.length - 1].mt : scouted + 1);
    var m = sch.filter(function (x) { return x.mt === predMt; })[0] || {};
    var inputs = {};
    ['R1', 'R2', 'R3', 'B1', 'B2', 'B3'].forEach(function (st) {
      inputs[st] = h('input', { type: 'number', inputmode: 'numeric', value: m[st] || '', placeholder: st });
    });

    var out = h('div');
    function run() {
      var red = ['R1', 'R2', 'R3'].map(function (s) { return Number(inputs[s].value); }).filter(Boolean);
      var blue = ['B1', 'B2', 'B3'].map(function (s) { return Number(inputs[s].value); }).filter(Boolean);
      var p = SC.analysis.predict(D.by, red, blue);
      out.textContent = '';
      out.appendChild(h('div', { class: 'predict' }, [['red', 'Red', p.red], ['blue', 'Blue', p.blue]].map(function (x) {
        var side = x[2];
        return h('div', { class: 'card side ' + x[0] },
          h('h3', null, x[1] + ' · predicted ' + fmt(side.total) + ' pts'),
          h('p', { class: 'muted' }, 'Fuel ' + fmt(side.fuel) + ' · Climb ' + fmt(side.tower) + ' · RP: ' +
            ([side.energized ? 'Energized' : null, side.supercharged ? 'Supercharged' : null, side.traversal ? 'Traversal' : null].filter(Boolean).join(' / ') || '–')),
          h('div', { class: 'scroll' }, h('table', { class: 'data' },
            h('thead', null, h('tr', null, ['Team', 'Avg', 'Fuel', 'Climb', 'Climb %', 'Auto L1', 'Def. s', 'Incap'].map(function (c) { return h('th', null, c); }))),
            h('tbody', null, side.rows.map(function (r) {
              var s = r.s;
              if (!s) return h('tr', null, h('td', null, r.tm), h('td', { colspan: 7, class: 'muted' }, 'No data'));
              return h('tr', { class: s.dnp ? 'dnp' : '' }, h('td', null, h('a', { href: '#team/' + r.tm }, r.tm)),
                h('td', { class: 'num' }, fmt(s.total)), h('td', { class: 'num' }, fmt(s.fuelPts)), h('td', { class: 'num' }, fmt(s.towerPts)),
                h('td', { class: 'num' }, pct(s.climbRate)), h('td', { class: 'num' }, pct(s.autoTowerRate)),
                h('td', { class: 'num' }, fmt(s.defenseSec)), h('td', { class: 'num' }, pct(s.incapRate)));
            }))
          )));
      })));
    }

    root.appendChild(h('section', null,
      h('h2', null, 'Match prediction'),
      h('div', { class: 'card' },
        SC.ui.field('Match (teams fill in from the schedule)', h('input', { type: 'number', value: predMt || '', oninput: function (e) {
          predMt = Number(e.target.value);
          var mm = sch.filter(function (x) { return x.mt === predMt; })[0] || {};
          Object.keys(inputs).forEach(function (st) { inputs[st].value = mm[st] || ''; });
          run();
        } })),
        h('div', { class: 'row' }, ['R1', 'R2', 'R3'].map(function (s) { return inputs[s]; })),
        h('div', { class: 'row' }, ['B1', 'B2', 'B3'].map(function (s) { return inputs[s]; })),
        h('button', { class: 'btn primary', onclick: run }, 'Predict')
      ),
      out,
      h('p', { class: 'muted' }, 'Prediction = sum of the three teams\' average points. RP thresholds are for district/regional events (Energized ' + SC.GAME.rp.energized + ' / Supercharged ' + SC.GAME.rp.supercharged + ' / Traversal ' + SC.GAME.rp.traversal + ').')
    ));
    run();
  };
})();
