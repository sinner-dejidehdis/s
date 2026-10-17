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
    SC.ui.toast('新增 ' + c.new + '，更新 ' + c.updated + '，重复 ' + c.same + (out.errors ? '，无法识别 ' + out.errors : ''), out.errors ? 'err' : 'ok');
    return c;
  }
  function importJson(text) {
    var j = JSON.parse(text);
    var c = importRecords((j.records || []).filter(SC.codec.valid));
    var photos = j.photos || {};
    var ps = Object.keys(photos).map(function (k) { return SC.photos.put(k, photos[k]); });
    return Promise.all(ps).then(function () {
      SC.ui.toast('新增 ' + c.new + '，更新 ' + c.updated + '，照片 ' + ps.length, 'ok');
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
      if (!out.records.length) return (statusEl.textContent = '这个二维码不是本系统的');
      var c = importRecords(out.records);
      var r = out.records[0];
      statusEl.textContent = (c.new ? '✓ 新增 ' : c.updated ? '✓ 更新 ' : '已有 ') + (r.k === 'p' ? 'Pit ' + r.tm : 'Q' + r.mt + ' ' + (r.tm || (r.al === 'R' ? '红方' : '蓝方')));
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
    if (!rows.length) return h('p', { class: 'muted' }, '导入赛程后这里会显示每场哪些位置已经收到数据。');
    var st = ['R1', 'R2', 'R3', 'B1', 'B2', 'B3'];
    return h('div', { class: 'scroll' }, h('table', { class: 'cov' },
      h('thead', null, h('tr', null, h('th', null, '场'), st.map(function (s) { return h('th', { class: s[0] }, s); }), h('th', null, '主观'))),
      h('tbody', null, rows.slice().reverse().map(function (m) {
        return h('tr', null, h('td', null, m.mt), st.map(function (s) {
          var n = have[m.mt + '|' + m[s]] || 0;
          return h('td', { class: n ? 'ok' : 'miss', title: String(m[s]) }, n ? (n > 1 ? '✓' + n : '✓') : m[s]);
        }), h('td', null, (sHave[m.mt + '|R'] ? '红' : '') + (sHave[m.mt + '|B'] ? '蓝' : '')));
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
        scanBtn.textContent = '打开摄像头扫码';
        video.style.display = 'none';
        return;
      }
      video.style.display = 'block';
      scanBtn.textContent = '停止扫码';
      startScan(video, status, function () { covBox.textContent = ''; covBox.appendChild(coverage(ev)); })
        .then(function (sc) { scan = sc; })
        .catch(function (e) { status.textContent = '打不开摄像头：' + e.message + '（需要 https 或 localhost）'; });
    } }, '打开摄像头扫码');
    video.style.display = 'none';

    var paste = h('textarea', { rows: 3, placeholder: '扫码枪对准这里扫，或粘贴 FRCS1… 文本（可多行）' });
    var fileIn = h('input', { type: 'file', multiple: true, accept: '.json,.txt', onchange: function (e) {
      Array.prototype.forEach.call(e.target.files, function (f) {
        SC.ui.readFile(f).then(function (t) {
          return t.trim()[0] === '{' ? importJson(t) : importText(t);
        }).catch(function (err) { SC.ui.toast(f.name + ' 导入失败：' + err.message, 'err'); });
      });
    } });

    var mine = SC.store.mine();
    var recs = SC.store.records();

    root.appendChild(h('section', null,
      h('h2', null, '数据汇总 · ' + (ev || '未设置赛事')),
      h('p', { class: 'muted' }, '本机共有：比赛 ' + count.m + ' 条 · 主观 ' + count.s + ' 条 · Pit ' + count.p + ' 队'),
      h('div', { class: 'card' }, h('h3', null, '扫码导入'), scanBtn, video, status),
      h('div', { class: 'card' }, h('h3', null, '扫码枪 / 粘贴 / 文件'), paste,
        h('div', { class: 'row' }, h('button', { class: 'btn', onclick: function () { importText(paste.value); paste.value = ''; } }, '导入文本'), fileIn)),
      h('div', { class: 'card' }, h('h3', null, '覆盖情况'), covBox),
      h('div', { class: 'card' }, h('h3', null, '导出'),
        h('div', { class: 'row wrap' },
          h('button', { class: 'btn', onclick: function () {
            SC.photos.all().catch(function () { return {}; }).then(function (photos) {
              SC.ui.download('scouting_' + (ev || 'all') + '_' + Date.now() + '.json', JSON.stringify({ app: 'frcscout', v: 1, records: SC.store.list(null, null), photos: photos }), 'application/json');
            });
          } }, '全部备份 JSON（含照片）'),
          h('button', { class: 'btn', onclick: function () {
            SC.ui.download('scouting_' + (ev || 'all') + '_nophoto.json', JSON.stringify({ app: 'frcscout', v: 1, records: SC.store.list(null, null) }), 'application/json');
          } }, 'JSON（不含照片）'),
          h('button', { class: 'btn', onclick: function () {
            SC.ui.download('matches_' + ev + '.csv', '﻿' + SC.analysis.toCsv(SC.analysis.matchRows(ev, { calibrate: s.calibrate })), 'text/csv');
          } }, '每场 CSV（Excel 可开）')
        ),
        h('p', { class: 'muted' }, '多台负责人设备之间：导出 JSON 再在另一台「文件」导入，会自动合并去重。')),
      h('div', { class: 'card' }, h('h3', null, '本机记录过的二维码'),
        mine.length ? h('ul', { class: 'history' }, mine.filter(function (k) { return recs[k]; }).slice(0, 60).map(function (k) {
          var r = recs[k];
          var label = r.k === 'm' ? 'Q' + r.mt + ' · ' + r.tm + ' · ' + r.st : r.k === 's' ? 'Q' + r.mt + ' · 主观 ' + (r.al === 'R' ? '红' : '蓝') : 'Pit · ' + r.tm;
          var box = h('div');
          return h('li', null,
            h('div', { class: 'row between' }, h('span', null, label),
              h('span', null,
                h('button', { class: 'btn small', onclick: function () { box.textContent = ''; box.appendChild(SC.ui.qr(SC.codec.encode(r))); } }, '显示二维码'),
                h('button', { class: 'btn small', onclick: function () { SC.ui.ask('删除这条记录？', '删除').then(function (ok) { if (ok) { SC.store.remove(k); root.textContent = ''; SC.views.data(root); } }); } }, '删除'))),
            box);
        })) : h('p', { class: 'muted' }, '还没有'))
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
      if (!s.event || !s.tbaKey) return SC.ui.toast('先填赛事代码和 TBA Key', 'err');
      tbaBtn.disabled = true;
      tbaBtn.textContent = '同步中…';
      SC.tba.sync(s.event, s.tbaKey).then(function (r) {
        SC.ui.toast('队伍 ' + r.teams + ' · 赛程 ' + r.matches + ' 场 · 已有比分 ' + r.results + ' 场', 'ok');
        root.textContent = '';
        SC.views.settings(root);
      }).catch(function (e) {
        SC.ui.toast('同步失败：' + e.message, 'err');
        tbaBtn.disabled = false;
        tbaBtn.textContent = '从 TBA 同步';
      });
    } }, '从 TBA 同步');

    root.appendChild(h('section', null,
      h('h2', null, '设置'),
      h('div', { class: 'card' },
        SC.ui.field('我的名字', h('input', { value: s.scout, oninput: function (e) { set('scout', e.target.value.trim()); } })),
        SC.ui.field('赛事代码（TBA event key）', h('input', { value: s.event, placeholder: '2026cmptx', oninput: function (e) { set('event', e.target.value.trim().toLowerCase()); } })),
        SC.ui.field('默认位置', SC.ui.chips(['R1', 'R2', 'R3', 'B1', 'B2', 'B3'], s.station, function (v) { set('station', v); root.textContent = ''; SC.views.settings(root); }, 'stations')),
        toggle('flip', '场地左右翻转（坐在另一侧看台时打开）'),
        toggle('askFuel', '松开射球键后询问大约进了几个'),
        toggle('calibrate', '分析时用 TBA 比分校准 Fuel（1678 方法，联盟三台都记了才生效）')
      ),
      h('div', { class: 'card' }, h('h3', null, '赛程与比分'),
        h('p', { class: 'muted' }, '当前赛事：赛程 ' + sch.matches.length + ' 场，队伍 ' + sch.teams.length + ' 支，TBA 比分 ' + tbaRes + ' 场'),
        SC.ui.field('TBA Read API Key', h('input', { type: 'password', value: s.tbaKey, oninput: function (e) { set('tbaKey', e.target.value.trim()); } }), '在 thebluealliance.com/account 申请；只存在本机'),
        tbaBtn,
        SC.ui.field('没网时：粘贴赛程 CSV', csv),
        h('button', { class: 'btn', onclick: function () {
          var p = SC.tba.parseScheduleCsv(csv.value);
          if (!p.matches.length) return SC.ui.toast('没读到赛程，格式：场次,R1,R2,R3,B1,B2,B3', 'err');
          SC.store.saveSchedule(s.event, p);
          SC.ui.toast('导入 ' + p.matches.length + ' 场', 'ok');
          root.textContent = '';
          SC.views.settings(root);
        } }, '导入赛程')
      ),
      h('div', { class: 'card' }, h('h3', null, '危险操作'),
        h('button', { class: 'btn danger', onclick: function () {
          SC.ui.ask('清空本机所有记录？无法恢复，建议先在「数据」页导出备份。', '清空').then(function (ok) {
            if (!ok) return;
            SC.store.clearAll();
            SC.ui.toast('已清空');
          });
        } }, '清空本机记录')
      ),
      h('p', { class: 'muted' }, '赛季：' + SC.GAME.name + ' · 字段在 js/config.js 修改')
    ));
  };
})();
