// Data lead page: import scanned rows, team table, shooting heat map, CSV/TSV export.
var V2 = (globalThis.V2 = globalThis.V2 || {});

(function () {
  var h;
  var sortKey = 'points', heatTeam = null;

  function records() {
    var all = V2.ui.get('records', {});
    return Object.keys(all).map(function (k) { return all[k]; });
  }

  function importText(text) {
    var all = V2.ui.get('records', {});
    var added = 0, same = 0, bad = 0;
    String(text).split(/\r?\n/).forEach(function (line) {
      if (!line.trim()) return;
      var d = V2.codec.decode(line);
      if (!d) return bad++;
      var k = V2.codec.key(d.kind, d.values);
      if (all[k]) same++;
      else added++;
      all[k] = { kind: d.kind, values: d.values, ts: Date.now() };
    });
    V2.ui.set('records', all);
    V2.ui.toast(added + ' added, ' + same + ' already had' + (bad ? ', ' + bad + ' not recognized' : ''), bad ? 'err' : 'ok');
  }

  function rowsOf(kind, ev) {
    return records().filter(function (r) { return r.kind === kind && (!ev || r.values.e === ev); }).map(function (r) { return r.values; });
  }

  function tsv(kind, ev) {
    return [V2.codec.header(kind)].concat(rowsOf(kind, ev).map(function (v) { return V2.codec.encode(kind, v); })).join('\n');
  }

  function render(root) {
    h = V2.ui.h;
    var ev = V2.CONFIG.event;
    var rows = rowsOf('match', ev);
    var pits = rowsOf('pit', ev);
    var stats = V2.stats.teams(rows).sort(function (a, b) {
      var x = a[sortKey], y = b[sortKey];
      return sortKey === 't' ? x - y : (y == null ? -1 : y) - (x == null ? -1 : x);
    });
    var redraw = function () { root.textContent = ''; render(root); };

    var paste = h('textarea', { id: 'paste', rows: 4, placeholder: 'Click here, then scan QR codes with a USB scanner. Or paste rows (one per line).' });
    paste.addEventListener('keydown', function (e) {
      // Most USB scanners end each code with Enter: import as soon as a full row arrives
      if (e.key === 'Enter' && !e.shiftKey && paste.value.trim()) {
        e.preventDefault();
        importText(paste.value);
        paste.value = '';
        redraw();
        setTimeout(function () { var p = document.getElementById('paste'); if (p) p.focus(); }, 0);
      }
    });

    var COLS = [
      ['t', 'Team'], ['n', 'M'], ['points', 'Avg pts'], ['best', 'Best'], ['autoFuel', 'Auto Fuel'], ['teleFuel', 'Tele Fuel'], ['endFuel', 'End Fuel'],
      ['ferried', 'Ferried'], ['accuracy', 'Acc %'], ['climbPts', 'Climb pts'], ['autoL1', 'Auto L1 %'], ['incap', 'Incap s'],
      ['defense', 'Def. s'], ['defRating', 'Def. rating'], ['driver', 'Driver'], ['problems', 'Issues'],
    ];

    var topPts = Math.max.apply(null, stats.map(function (s) { return s.points; }).concat([1]));
    var table = stats.length ? h('div', { class: 'scroll' }, h('table', { class: 'data' },
      h('thead', null, h('tr', null, COLS.map(function (c) {
        return h('th', { class: 'sort' + (sortKey === c[0] ? ' on' : ''), onclick: function () { sortKey = c[0]; redraw(); } }, c[1]);
      }))),
      h('tbody', null, stats.map(function (s) {
        return h('tr', { class: heatTeam === s.t ? 'sel' : '' }, COLS.map(function (c) {
          if (c[0] === 't') return h('td', null, h('button', { type: 'button', class: 'link', onclick: function () { heatTeam = s.t; redraw(); } }, s.t));
          var v = s[c[0]];
          if (c[0] === 'points') {
            // Bar length = share of the event's best average, so strong teams stand out at a glance
            return h('td', { class: 'num barcell' }, h('span', { class: 'bar', style: 'width:' + Math.round((v / topPts) * 100) + '%' }), h('span', { class: 'barval' }, v));
          }
          return h('td', { class: 'num' }, v == null ? '–' : v);
        }));
      }))
    )) : h('p', { class: 'muted' }, 'No match data for ' + ev + ' yet. Scan or paste rows above.');

    var detail = null;
    var t = stats.filter(function (s) { return s.t === heatTeam; })[0];
    if (t) {
      var mine = rows.filter(function (v) { return v.t === t.t; });
      var auto = [], tele = [];
      mine.forEach(function (v) { auto = auto.concat(v.as || []); tele = tele.concat(v.ts || []); });
      var pit = pits.filter(function (v) { return v.t === t.t; })[0];
      detail = h('section', { class: 'card' },
        h('h3', null, 'Team ' + t.t),
        h('p', { class: 'muted' }, t.n + ' matches · climbs L1/L2/L3: ' + t.levels.L1 + '/' + t.levels.L2 + '/' + t.levels.L3 + ' · no-shows ' + t.noShow +
          ' · played defense in ' + t.playedDefense + ' · was defended in ' + t.wasDefended + (t.defendedRating != null ? ' (handled it ' + t.defendedRating + '/5)' : '')),
        h('div', { class: 'legend' }, h('span', null, h('i', { class: 'k-auto' }), 'Auto shots (' + auto.length + ')'), h('span', null, h('i', { class: 'k-tele' }), 'Teleop shots (' + tele.length + ')')),
        h('small', { class: 'muted' }, 'Drawn from the robot\'s own alliance end, with its own wall on the left.'),
        V2.field.heat([{ points: auto, color: V2.field.css('--s1') }, { points: tele, color: V2.field.css('--s2') }]),
        pit ? h('div', null, h('h4', null, 'Pit'), h('dl', { class: 'pit' }, V2.codec.fields('pit').filter(function (f) { return ['s', 'e', 't'].indexOf(f.code) < 0; }).map(function (f) {
          var v = pit[f.code];
          if (v == null || v === '' || (Array.isArray(v) && !v.length)) return null;
          var shown = f.choices ? (Array.isArray(v) ? v : [v]).map(function (k) { return f.choices[k] || k; }).join(', ') : v === true ? 'Yes' : v === false ? 'No' : v;
          return [h('dt', null, f.name), h('dd', null, String(shown))];
        }))) : null,
        t.comments.length ? h('div', null, h('h4', null, 'Comments'), h('ul', { class: 'notes' }, t.comments.map(function (c) { return h('li', null, h('b', null, 'Q' + c.m + ' '), c.text, h('small', { class: 'muted' }, ' — ' + c.s)); }))) : null
      );
    }

    var out = h('textarea', { class: 'raw', rows: 4, readonly: true, 'aria-label': 'Export' });
    root.appendChild(h('div', { class: 'datapage' },
      h('h2', null, 'Data · ' + ev),
      h('section', { class: 'card' }, h('h3', null, 'Import'), paste,
        h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn primary', onclick: function () { importText(paste.value); paste.value = ''; redraw(); } }, 'Import'),
          h('small', { class: 'muted' }, records().length + ' records on this device'))),
      h('section', { class: 'card' }, h('h3', null, 'Teams'), h('p', { class: 'muted' }, 'Tap a team number for its shooting map, pit info and comments.'), table),
      detail,
      h('section', { class: 'card' }, h('h3', null, 'Export'),
        h('p', { class: 'muted' }, 'Tab-separated with a header row. Paste into Google Sheets or Excel.'),
        h('div', { class: 'row wrap' },
          h('button', { type: 'button', class: 'btn', onclick: function () { out.value = tsv('match', ev); out.select(); V2.ui.copy(out.value); } }, 'Copy match data'),
          h('button', { type: 'button', class: 'btn', onclick: function () { out.value = tsv('pit', ev); out.select(); V2.ui.copy(out.value); } }, 'Copy pit data'),
          h('button', { type: 'button', class: 'btn danger', onclick: function () {
            V2.ui.ask('Delete all records on this device? Copy the data out first.', 'Delete all').then(function (ok) {
              if (!ok) return;
              V2.ui.set('records', {});
              redraw();
            });
          } }, 'Delete all')),
        out)
    ));
  }

  V2.data = { render: render, importText: importText };
})();
