// 数据汇总（负责人用）：扫码导入、粘贴/文件导入、覆盖情况、导出；以及设置页。
var SC = (globalThis.SC = globalThis.SC || {});
SC.views = SC.views || {};

(function () {
  var h;
  var scan = null; // { stream, stop }

  function importRecords(recs) {
    var c = { new: 0, updated: 0, same: 0 };
    recs.forEach(function (r) { c[SC.store.put(r)]++; });
    return c;
  }
  function importText(text) {
    var out = SC.codec.decodeMany(text);
    var c = importRecords(out.records);
    SC.ui.toast(c.new + ' new, ' + c.updated + ' updated, ' + c.same + ' duplicate' + (out.errors ? ', ' + out.errors + ' unreadable' : ''), out.errors ? 'err' : 'ok');
    return c;
  }
  function importJson(text) {
    var j = JSON.parse(text);
    var c = importRecords((j.records || []).filter(SC.codec.valid));
    var photos = j.photos || {};
    var ps = Object.keys(photos).map(function (k) { return SC.photos.put(k, photos[k]); });
    return Promise.all(ps).then(function () {
      SC.ui.toast(c.new + ' new, ' + c.updated + ' updated, ' + ps.length + ' photos', 'ok');
    });
  }

  // ---------- 摄像头扫码 ----------
  function loadJsQR() {
    if (globalThis.jsQR) return Promise.resolve();
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = 'vendor/jsQR.js';
      s.onload = res;
      s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  function startScan(video, statusEl, onDone) {
    var last = '', lastAt = 0, stopped = false;
    var detector = 'BarcodeDetector' in globalThis ? new BarcodeDetector({ formats: ['qr_code'] }) : null;
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    function handle(text) {
      if (!text || (text === last && Date.now() - lastAt < 4000)) return;
      last = text;
      lastAt = Date.now();
      var out = SC.codec.decodeMany(text);
      if (!out.records.length) return (statusEl.textContent = 'This QR code is not from this app');
      var c = importRecords(out.records);
      var r = out.records[0];
      statusEl.textContent = (c.new ? '✓ Added ' : c.updated ? '✓ Updated ' : 'Already have ') + (r.k === 'p' ? 'Pit ' + r.tm : 'Q' + r.mt + ' ' + (r.tm || (r.al === 'R' ? 'Red' : 'Blue')));
      if (navigator.vibrate) navigator.vibrate(60);
      onDone && onDone();
    }
    function loop() {
      if (stopped) return;
      if (video.readyState >= 2) {
        if (detector) {
          detector.detect(video).then(function (codes) {
            if (codes[0]) handle(codes[0].rawValue);
          }).catch(function () {});
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
    }
    return (detector ? Promise.resolve() : loadJsQR())
      .then(function () { return navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }); })
      .then(function (stream) {
        video.srcObject = stream;
        video.play();
        loop();
        return { stop: function () { stopped = true; stream.getTracks().forEach(function (t) { t.stop(); }); } };
      });
  }
  function stopScan() {
    if (scan) scan.stop();
    scan = null;
  }

  // 每场 6 个位置的覆盖情况
  function coverage(ev) {
    var sch = SC.store.schedule(ev).matches;
    var recs = SC.store.list('m', ev);
    var subj = SC.store.list('s', ev);
    var have = {};
    recs.forEach(function (r) { have[r.mt + '|' + r.tm] = (have[r.mt + '|' + r.tm] || 0) + 1; });
    var sHave = {};
    subj.forEach(function (s) { sHave[s.mt + '|' + s.al] = 1; });
    var maxMt = Math.max.apply(null, [0].concat(recs.map(function (r) { return r.mt; })));
    var rows = sch.length ? sch.filter(function (m) { return m.mt <= Math.max(maxMt, 1); }) : [];
    if (!rows.length) return h('p', { class: 'muted' }, 'Import a schedule to see which stations have data for each match.');
    var st = ['R1', 'R2', 'R3', 'B1', 'B2', 'B3'];
    return h('div', { class: 'scroll' }, h('table', { class: 'cov' },
      h('thead', null, h('tr', null, h('th', null, 'Match'), st.map(function (s) { return h('th', { class: s[0] }, s); }), h('th', null, 'Subj.'))),
      h('tbody', null, rows.slice().reverse().map(function (m) {
        return h('tr', null, h('td', null, m.mt), st.map(function (s) {
          var n = have[m.mt + '|' + m[s]] || 0;
          return h('td', { class: n ? 'ok' : 'miss', title: String(m[s]) }, n ? (n > 1 ? '✓' + n : '✓') : m[s]);
        }), h('td', null, [sHave[m.mt + '|R'] ? 'R' : '', sHave[m.mt + '|B'] ? 'B' : ''].filter(Boolean).join(' ')));
      }))
    ));
  }

  SC.views.data = function (root) {
    h = SC.ui.h;
    var s = SC.store.settings();
    var ev = s.event;
    var all = SC.store.list(null, ev);
    var count = { m: 0, s: 0, p: 0 };
    all.forEach(function (r) { count[r.k]++; });

    var video = h('video', { class: 'scanvideo', playsinline: true, muted: true });
    var status = h('div', { class: 'scanstatus' }, '');
    var covBox = h('div', null, coverage(ev));
    var scanBtn = h('button', { class: 'btn primary', onclick: function () {
      if (scan) {
        stopScan();
        scanBtn.textContent = 'Scan with camera';
        video.style.display = 'none';
        return;
      }
      video.style.display = 'block';
      scanBtn.textContent = 'Stop scanning';
      startScan(video, status, function () { covBox.textContent = ''; covBox.appendChild(coverage(ev)); })
        .then(function (sc) { scan = sc; })
        .catch(function (e) { status.textContent = 'Could not open the camera: ' + e.message + ' (needs https or localhost)'; });
    } }, 'Scan with camera');
    video.style.display = 'none';

    var paste = h('textarea', { rows: 3, placeholder: 'Click here and scan with a USB scanner, or paste FRCS1… text (one per line)' });
    var fileIn = h('input', { type: 'file', multiple: true, accept: '.json,.txt', onchange: function (e) {
      Array.prototype.forEach.call(e.target.files, function (f) {
        SC.ui.readFile(f).then(function (t) {
          return t.trim()[0] === '{' ? importJson(t) : importText(t);
        }).catch(function (err) { SC.ui.toast('Could not import ' + f.name + ': ' + err.message, 'err'); });
      });
    } });

    var mine = SC.store.mine();
    var recs = SC.store.records();

    root.appendChild(h('section', null,
      h('h2', null, 'Data · ' + (ev || 'no event set')),
      h('p', { class: 'muted' }, 'On this device: ' + count.m + ' match · ' + count.s + ' subjective · ' + count.p + ' pit records'),
      h('div', { class: 'card' }, h('h3', null, 'Scan QR codes'), scanBtn, video, status),
      h('div', { class: 'card' }, h('h3', null, 'USB scanner / paste / file'), paste,
        h('div', { class: 'row' }, h('button', { class: 'btn', onclick: function () { importText(paste.value); paste.value = ''; } }, 'Import text'), fileIn)),
      h('div', { class: 'card' }, h('h3', null, 'Coverage'), covBox),
      h('div', { class: 'card' }, h('h3', null, 'Export'),
        h('div', { class: 'row wrap' },
          h('button', { class: 'btn', onclick: function () {
            SC.photos.all().catch(function () { return {}; }).then(function (photos) {
              SC.ui.download('scouting_' + (ev || 'all') + '_' + Date.now() + '.json', JSON.stringify({ app: 'frcscout', v: 1, records: SC.store.list(null, null), photos: photos }), 'application/json');
            });
          } }, 'Full backup JSON (with photos)'),
          h('button', { class: 'btn', onclick: function () {
            SC.ui.download('scouting_' + (ev || 'all') + '_nophoto.json', JSON.stringify({ app: 'frcscout', v: 1, records: SC.store.list(null, null) }), 'application/json');
          } }, 'JSON (no photos)'),
          h('button', { class: 'btn', onclick: function () {
            SC.ui.download('matches_' + ev + '.csv', '﻿' + SC.analysis.toCsv(SC.analysis.matchRows(ev, { calibrate: s.calibrate })), 'text/csv');
          } }, 'Per-match CSV (opens in Excel)')
        ),
        h('p', { class: 'muted' }, 'To sync two lead devices: export JSON on one and import the file on the other. Records are merged and de-duplicated.')),
      h('div', { class: 'card' }, h('h3', null, 'QR codes made on this device'),
        mine.length ? h('ul', { class: 'history' }, mine.filter(function (k) { return recs[k]; }).slice(0, 60).map(function (k) {
          var r = recs[k];
          var label = r.k === 'm' ? 'Q' + r.mt + ' · ' + r.tm + ' · ' + r.st : r.k === 's' ? 'Q' + r.mt + ' · Subjective ' + (r.al === 'R' ? 'Red' : 'Blue') : 'Pit · ' + r.tm;
          var box = h('div');
          return h('li', null,
            h('div', { class: 'row between' }, h('span', null, label),
              h('span', null,
                h('button', { class: 'btn small', onclick: function () { box.textContent = ''; box.appendChild(SC.ui.qr(SC.codec.encode(r))); } }, 'Show QR'),
                h('button', { class: 'btn small', onclick: function () { SC.ui.ask('Delete this record?', 'Delete').then(function (ok) { if (ok) { SC.store.remove(k); root.textContent = ''; SC.views.data(root); } }); } }, 'Delete'))),
            box);
        })) : h('p', { class: 'muted' }, 'None yet'))
    ));
  };
  SC.views.dataLeave = stopScan;

  // ---------- 设置 ----------
  SC.views.settings = function (root) {
    h = SC.ui.h;
    var s = SC.store.settings();
    function set(k, v) {
      s[k] = v;
      SC.store.saveSettings(s);
    }
    function toggle(k, label) {
      return h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!s[k], onchange: function (e) { set(k, e.target.checked); } }), ' ' + label);
    }
    var sch = SC.store.schedule(s.event);
    var tbaRes = Object.keys(SC.store.tbaResults(s.event)).length;
    var csv = h('textarea', { rows: 3, placeholder: 'match,R1,R2,R3,B1,B2,B3\n1,254,1678,971,118,148,2056' });
    var tbaBtn = h('button', { class: 'btn primary', onclick: function () {
      if (!s.event || !s.tbaKey) return SC.ui.toast('Enter the event key and TBA key first', 'err');
      tbaBtn.disabled = true;
      tbaBtn.textContent = 'Syncing…';
      SC.tba.sync(s.event, s.tbaKey).then(function (r) {
        SC.ui.toast(r.teams + ' teams · ' + r.matches + ' matches · ' + r.results + ' with scores', 'ok');
        root.textContent = '';
        SC.views.settings(root);
      }).catch(function (e) {
        SC.ui.toast('Sync failed: ' + e.message, 'err');
        tbaBtn.disabled = false;
        tbaBtn.textContent = 'Sync from TBA';
      });
    } }, 'Sync from TBA');

    root.appendChild(h('section', null,
      h('h2', null, 'Settings'),
      h('div', { class: 'card' },
        SC.ui.field('Your name', h('input', { value: s.scout, oninput: function (e) { set('scout', e.target.value.trim()); } })),
        SC.ui.field('Event key (TBA)', h('input', { value: s.event, placeholder: '2026cmptx', oninput: function (e) { set('event', e.target.value.trim().toLowerCase()); } })),
        SC.ui.field('Default station', SC.ui.chips(['R1', 'R2', 'R3', 'B1', 'B2', 'B3'], s.station, function (v) { set('station', v); root.textContent = ''; SC.views.settings(root); }, 'stations')),
        toggle('flip', 'Flip field left/right (turn on when sitting on the other side)'),
        toggle('askFuel', 'Ask for a Fuel estimate after each shot'),
        toggle('calibrate', 'Calibrate Fuel with TBA scores (1678 method; needs all 3 robots of an alliance scouted)')
      ),
      h('div', { class: 'card' }, h('h3', null, 'Schedule and scores'),
        h('p', { class: 'muted' }, 'This event: ' + sch.matches.length + ' matches, ' + sch.teams.length + ' teams, ' + tbaRes + ' TBA scores'),
        SC.ui.field('TBA Read API Key', h('input', { type: 'password', value: s.tbaKey, oninput: function (e) { set('tbaKey', e.target.value.trim()); } }), 'Get one at thebluealliance.com/account. Stored on this device only.'),
        tbaBtn,
        SC.ui.field('Offline: paste schedule CSV', csv),
        h('button', { class: 'btn', onclick: function () {
          var p = SC.tba.parseScheduleCsv(csv.value);
          if (!p.matches.length) return SC.ui.toast('No matches found. Format: match,R1,R2,R3,B1,B2,B3', 'err');
          SC.store.saveSchedule(s.event, p);
          SC.ui.toast('Imported ' + p.matches.length + ' matches', 'ok');
          root.textContent = '';
          SC.views.settings(root);
        } }, 'Import schedule')
      ),
      h('div', { class: 'card' }, h('h3', null, 'Danger zone'),
        h('button', { class: 'btn danger', onclick: function () {
          SC.ui.ask('Delete all records on this device? This cannot be undone. Export a backup from the Data page first.', 'Delete all').then(function (ok) {
            if (!ok) return;
            SC.store.clearAll();
            SC.ui.toast('All records deleted');
          });
        } }, 'Delete all records')
      ),
      h('p', { class: 'muted' }, 'Season: ' + SC.GAME.name + ' · fields are set in js/config.js')
    ));
  };
})();
