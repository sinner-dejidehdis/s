// Data lead page: import scanned rows, team table, shooting heat map, CSV/TSV export.
var V2 = (globalThis.V2 = globalThis.V2 || {});

(function () {
  var h;
  var sortKey = 'offense', heatTeam = null;

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
      all[k] = { kind: d.kind, values: d.values, ts: Date.now(), sent: true };
    });
    V2.ui.set('records', all);
    V2.ui.toast(added + ' added, ' + same + ' already had' + (bad ? ', ' + bad + ' not recognized' : ''), bad ? 'err' : 'ok');
    return { added: added, same: same, bad: bad };
  }

  // ---------- Send several records as a sequence of QR codes ----------
  var sendScope = 'unsent', sendFrom = '', sendTo = '', show = null; // show: { keys, codes, i, auto }

  function pickForSend(ev) {
    var all = V2.ui.get('records', {});
    return Object.keys(all).filter(function (k) {
      var r = all[k], v = r.values;
      if (v.e && v.e !== ev) return false;
      if (sendScope === 'unsent') return r.sent === false;
      if (sendScope === 'range') {
        if (r.kind !== 'match') return false;
        var lo = Number(sendFrom) || 1, hi = Number(sendTo) || 999;
        return v.m >= lo && v.m <= hi;
      }
      return true;
    }).sort(function (a, b) {
      var x = all[a], y = all[b];
      return (x.kind === y.kind ? 0 : x.kind === 'match' ? -1 : 1) || (x.values.m || 0) - (y.values.m || 0) || (x.values.t || 0) - (y.values.t || 0);
    });
  }

  function sendCard(redraw, ev) {
    var all = V2.ui.get('records', {});
    if (show) {
      var code = show.codes[show.i];
      var n = code.split('\n').length;
      var go = function (d) { show.i = Math.max(0, Math.min(show.codes.length - 1, show.i + d)); redraw(); };
      var timer = null;
      if (show.auto && show.i < show.codes.length - 1) timer = setTimeout(function () { if (show && show.auto) go(1); }, 2500);
      return h('section', { class: 'card sendcard' },
        h('div', { class: 'row between' },
          h('h3', null, 'QR ' + (show.i + 1) + ' of ' + show.codes.length),
          h('small', { class: 'muted' }, n + (n === 1 ? ' record' : ' records') + ' in this code')),
        h('div', { class: 'dots', 'aria-hidden': 'true' }, show.codes.map(function (_, i) { return h('i', { class: i === show.i ? 'on' : i < show.i ? 'done' : '' }); })),
        V2.ui.qr(code),
        h('div', { class: 'row' },
          h('button', { type: 'button', class: 'btn', disabled: show.i === 0, onclick: function () { clearTimeout(timer); go(-1); } }, '← Prev'),
          h('button', { type: 'button', class: 'btn primary', disabled: show.i === show.codes.length - 1, onclick: function () { clearTimeout(timer); go(1); } }, 'Next QR →')),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!show.auto, onchange: function (e) { show.auto = e.target.checked; redraw(); } }), ' Advance automatically every 2.5 s (for camera scanning)'),
        h('div', { class: 'row between' },
          h('button', { type: 'button', class: 'btn', onclick: function () { clearTimeout(timer); show = null; redraw(); } }, 'Cancel'),
          h('button', { type: 'button', class: 'btn primary', onclick: function () {
            clearTimeout(timer);
            var cur = V2.ui.get('records', {});
            show.keys.forEach(function (k) { if (cur[k]) cur[k].sent = true; });
            V2.ui.set('records', cur);
            V2.ui.toast(show.keys.length + ' records marked as sent', 'ok');
            show = null;
            redraw();
          } }, 'Done, all scanned')));
    }
    var keys = pickForSend(ev);
    var unsent = Object.keys(all).filter(function (k) { return all[k].sent === false; }).length;
    var from = h('input', { id: 'send-from', type: 'number', inputmode: 'numeric', placeholder: 'From', value: sendFrom, oninput: function (e) { sendFrom = e.target.value; } });
    var to = h('input', { id: 'send-to', type: 'number', inputmode: 'numeric', placeholder: 'To', value: sendTo, oninput: function (e) { sendTo = e.target.value; } });
    return h('section', { class: 'card sendcard' },
      h('h3', null, 'Send records by QR'),
      h('p', { class: 'muted' }, 'Hand over many matches at once. The records are split into a few QR codes; the data lead scans them one after another.'),
      h('div', { class: 'seg' },
        [['unsent', 'Not sent yet (' + unsent + ')'], ['all', 'All on this device'], ['range', 'Match range']].map(function (o) {
          return h('button', { type: 'button', class: 'opt' + (sendScope === o[0] ? ' on' : ''), onclick: function () { sendScope = o[0]; redraw(); } }, o[1]);
        })),
      sendScope === 'range' ? h('div', { class: 'row' }, from, h('span', { class: 'muted' }, 'to'), to,
        h('button', { type: 'button', class: 'btn', onclick: redraw }, 'Apply')) : null,
      h('button', { type: 'button', class: 'btn primary', disabled: !keys.length, onclick: function () {
        var rows = keys.map(function (k) { return V2.codec.encode(all[k].kind, all[k].values); });
        show = { keys: keys, codes: V2.codec.chunk(rows), i: 0, auto: false };
        redraw();
      } }, keys.length ? 'Show QR codes for ' + keys.length + (keys.length === 1 ? ' record' : ' records') : 'Nothing to send'));
  }

  // ---------- Phone camera scanning ----------
  // Uses the browser's built-in BarcodeDetector when present, otherwise the bundled jsQR.
  // A code that holds several rows (batch export) imports every row.
  var cam = null; // { stream, stopped }
  function stopCamera() {
    if (!cam) return;
    cam.stopped = true;
    cam.stream.getTracks().forEach(function (t) { t.stop(); });
    cam = null;
  }
  function startCamera(video, status, onImport) {
    var detector = 'BarcodeDetector' in globalThis ? new BarcodeDetector({ formats: ['qr_code'] }) : null;
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    var last = '', lastAt = 0;
    function handle(text) {
      if (!text || (text === last && Date.now() - lastAt < 4000)) return;
      last = text;
      lastAt = Date.now();
      var res = importText(text);
      status.textContent = res.added || res.same ? '✓ ' + res.added + ' added, ' + res.same + ' already had' + (res.bad ? ', ' + res.bad + ' not recognized' : '') : 'Not a REBUILT Scout code';
      if (navigator.vibrate) navigator.vibrate(60);
      onImport();
    }
    return navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(function (stream) {
      cam = { stream: stream, stopped: false };
      var me = cam;
      video.srcObject = stream;
      video.play();
      (function loop() {
        if (me.stopped) return;
        if (video.readyState >= 2) {
          if (detector) {
            detector.detect(video).then(function (codes) { if (codes[0]) handle(codes[0].rawValue); }).catch(function () {});
          } else if (globalThis.jsQR) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);
            var img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            var code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
            if (code) handle(code.data);
          }
        }
        setTimeout(loop, 250);
      })();
    });
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
    // The import box is built once per visit and never replaced, so a scanner typing many rows
    // in a burst keeps its focus; only the parts around it are refreshed after each row.
    var top = h('div'), bottom = h('div');
    var count = h('small', { class: 'muted' });
    function redraw() {
      top.textContent = '';
      top.appendChild(sendCard(redraw, ev));
      bottom.textContent = '';
      bottom.appendChild(analysis(redraw, ev));
      count.textContent = records().length + ' records on this device';
    }

    var paste = h('textarea', { id: 'paste', rows: 4, placeholder: 'Click here, then scan QR codes with a USB scanner. Or paste rows (one per line).' });
    paste.addEventListener('keydown', function (e) {
      // Scanners type the tabs between columns as Tab key presses: keep them in the box
      if (e.key === 'Tab') {
        e.preventDefault();
        var a = paste.selectionStart, b = paste.selectionEnd;
        paste.value = paste.value.slice(0, a) + '\t' + paste.value.slice(b);
        paste.selectionStart = paste.selectionEnd = a + 1;
        return;
      }
      // Most USB scanners end each line with Enter: import as soon as a full row arrives
      if (e.key === 'Enter' && !e.shiftKey && paste.value.trim()) {
        e.preventDefault();
        importText(paste.value);
        paste.value = '';
        redraw();
      }
    });

    var video = h('video', { class: 'camview', playsinline: true, muted: true, hidden: true });
    var camStatus = h('div', { class: 'camstatus', role: 'status' });
    var camBtn = h('button', { type: 'button', class: 'btn primary', onclick: function () {
      if (cam) {
        stopCamera();
        video.hidden = true;
        camBtn.textContent = 'Scan with phone camera';
        return;
      }
      video.hidden = false;
      camBtn.textContent = 'Stop camera';
      camStatus.textContent = 'Point the camera at a QR code';
      startCamera(video, camStatus, redraw).catch(function (e) {
        video.hidden = true;
        camBtn.textContent = 'Scan with phone camera';
        camStatus.textContent = 'Could not open the camera (' + e.name + '). Allow camera access, or use the box below with a USB scanner.';
      });
    } }, 'Scan with phone camera');

    root.appendChild(h('div', { class: 'datapage' },
      h('h2', null, 'Data · ' + ev),
      top,
      h('section', { class: 'card' }, h('h3', null, 'Import'), camBtn, video, camStatus, paste,
        h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn primary', onclick: function () { importText(paste.value); paste.value = ''; redraw(); } }, 'Import'), count)),
      bottom));
    redraw();
  }

  // Team table, team detail and export
  function analysis(redraw, ev) {
    var rows = rowsOf('match', ev);
    var pits = rowsOf('pit', ev);
    var stats = V2.stats.teams(rows).sort(function (a, b) {
      var x = a[sortKey], y = b[sortKey];
      return sortKey === 't' ? x - y : (y == null ? -1 : y) - (x == null ? -1 : x);
    });

    var COLS = [
      ['t', 'Team'], ['n', 'M'], ['offense', 'Offense'], ['best', 'Best'], ['autoFuel', 'Auto 1–10'], ['teleFuel', 'Tele 1–10'], ['endFuel', 'End 1–10'],
      ['missed', 'Miss 1–10'], ['ferried', 'Ferried'], ['accuracy', 'Acc ≈%'], ['climbPts', 'Climb pts'], ['autoL1', 'Auto L1 %'], ['incap', 'Incap s'],
      ['defense', 'Def. s'], ['defRating', 'Def. rating'], ['driver', 'Driver'], ['problems', 'Issues'],
    ];

    var topPts = 100; // offense index is already 0-100
    var table = stats.length ? h('div', { class: 'scroll' }, h('table', { class: 'data' },
      h('thead', null, h('tr', null, COLS.map(function (c) {
        return h('th', { class: 'sort' + (sortKey === c[0] ? ' on' : ''), onclick: function () { sortKey = c[0]; redraw(); } }, c[1]);
      }))),
      h('tbody', null, stats.map(function (s) {
        return h('tr', { class: heatTeam === s.t ? 'sel' : '' }, COLS.map(function (c) {
          if (c[0] === 't') return h('td', null, h('button', { type: 'button', class: 'link', onclick: function () { heatTeam = s.t; redraw(); } }, s.t));
          var v = s[c[0]];
          if (c[0] === 'offense') {
            // Bar length = offense index out of 100, so strong teams stand out at a glance
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
    return h('div', null,
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
        out));
  }

  V2.data = { render: render, importText: importText, stopCamera: stopCamera };
})();
