// 客观比赛记录（一人盯一台机器人）。
// 参考 1678 Match Collection：区域按钮 + 按住计时的射球键 + 时间线 + Incap + 撤销/重做 + 二维码。
var SC = (globalThis.SC = globalThis.SC || {});
SC.views = SC.views || {};

(function () {
  var h, chips;
  var M = null; // 当前这场的状态，切换页面不丢
  var tick = null;
  var root = null;

  function now() {
    return M && M.t0 ? Math.round((performance.now() - M.t0) / 100) : 0;
  }
  function teleT() {
    return M.rec.te != null ? (now() - M.rec.te) / 10 : null;
  }

  function newMatch(prev) {
    var s = SC.store.settings();
    var mt = prev ? Number(prev.mt) + 1 : 1;
    var st = prev ? prev.st : s.station;
    M = {
      step: 'setup',
      rec: { k: 'm', ev: s.event, mt: mt, tm: lookupTeam(s.event, mt, st), st: st, sc: s.scout, ts: 0, a: [], cl: {}, tg: [] },
      zone: 'A',
      redo: [],
      def: null,
      inc: null,
      hold: null,
      lastShot: -1,
    };
  }

  function lookupTeam(ev, mt, st) {
    var m = SC.store.schedule(ev).matches.filter(function (x) { return x.mt === Number(mt); })[0];
    return m && m[st] ? m[st] : '';
  }

  function render() {
    if (!root) return;
    root.textContent = '';
    var step = M.step;
    root.appendChild(step === 'setup' ? setupView() : step === 'pre' ? preView() : step === 'live' ? liveView() : step === 'post' ? postView() : qrView());
  }

  // ---------- 1. 场次信息 ----------
  function setupView() {
    var r = M.rec;
    var teamInput = h('input', { type: 'number', inputmode: 'numeric', value: r.tm, oninput: function (e) { r.tm = e.target.value; } });
    function refreshTeam() {
      var t = lookupTeam(r.ev, r.mt, r.st);
      if (t) {
        r.tm = t;
        teamInput.value = t;
      }
    }
    return h(
      'section',
      { class: 'card' },
      h('h2', null, '比赛记录 · 场次信息'),
      SC.ui.field('赛事代码', h('input', { value: r.ev, placeholder: '如 2026cmptx', oninput: function (e) { r.ev = e.target.value.trim(); refreshTeam(); } })),
      SC.ui.field('资格赛场次', h('input', { type: 'number', inputmode: 'numeric', value: r.mt, oninput: function (e) { r.mt = e.target.value; refreshTeam(); } })),
      SC.ui.field(
        '位置',
        chips(['R1', 'R2', 'R3', 'B1', 'B2', 'B3'], r.st, function (v) {
          r.st = v;
          var s = SC.store.settings();
          s.station = v;
          SC.store.saveSettings(s);
          refreshTeam();
          render();
        }, 'stations')
      ),
      SC.ui.field('队号', teamInput, SC.store.schedule(r.ev).matches.length ? '已按赛程自动填写，可改' : '没有赛程：在「设置」里同步 TBA 或导入 CSV'),
      SC.ui.field('记录员', h('input', { value: r.sc, oninput: function (e) { r.sc = e.target.value.trim(); var s = SC.store.settings(); s.scout = r.sc; SC.store.saveSettings(s); } })),
      h('button', {
        class: 'btn primary big',
        onclick: function () {
          if (!r.ev || !(Number(r.mt) > 0) || !(Number(r.tm) > 0) || !r.sc) return SC.ui.toast('赛事、场次、队号、记录员都要填', 'err');
          r.mt = Number(r.mt);
          r.tm = Number(r.tm);
          M.step = 'pre';
          render();
        },
      }, '下一步 →')
    );
  }

  // ---------- 2. 赛前 ----------
  function preView() {
    var r = M.rec;
    return h(
      'section',
      { class: 'card' },
      h('h2', null, '第 ' + r.mt + ' 场 · ', h('span', { class: 'team ' + r.st[0] }, r.tm), ' · ' + r.st),
      SC.ui.field('起始位置（面向本方驾驶站）', chips(G().startPositions.map(function (p, i) { return { value: i, label: p }; }), r.sp, function (v) { r.sp = Number(v); render(); })),
      SC.ui.field('预装 Fuel', chips([{ value: 1, label: '有' }, { value: 0, label: '无' }], r.pl ? 1 : r.pl === 0 ? 0 : '', function (v) { r.pl = Number(v); render(); })),
      h('div', { class: 'row' },
        h('button', { class: 'btn', onclick: function () { M.step = 'setup'; render(); } }, '← 返回'),
        h('button', { class: 'btn warn', onclick: function () { r.ns = true; M.step = 'post'; render(); } }, '没上场 No Show'),
        h('button', { class: 'btn primary', onclick: function () { if (r.sp == null) return SC.ui.toast('先选起始位置', 'err'); M.step = 'live'; render(); } }, '准备好了 →')
      )
    );
  }

  function G() {
    return SC.GAME;
  }

  // ---------- 3. 比赛中 ----------
  function push(a) {
    M.rec.a.push(a);
    M.redo = [];
  }

  function liveView() {
    var r = M.rec;
    var s = SC.store.settings();
    var started = !!M.t0;
    var tele = r.te != null;
    var locked = !started || !!M.inc;

    var timer = h('div', { class: 'timer', id: 'mtimer' });
    var phase = h('div', { class: 'phase ' + (tele ? 'tele' : 'auto') }, tele ? 'TELEOP' : 'AUTO');
    var hubInfo = h('div', { class: 'hub', id: 'mhub' });

    var top = h('div', { class: 'livebar ' + r.st[0] }, h('div', null, h('b', null, r.tm), ' · Q' + r.mt + ' · ' + r.st), phase, timer, hubInfo);

    // 场地条：本方区 | 边界 | 中立区 | 边界 | 对方区
    var order = G().zoneOrder.slice();
    var flip = s.flip;
    if (flip) order.reverse();
    var strip = h('div', { class: 'fieldmap' });
    order.forEach(function (z, i) {
      strip.appendChild(
        h('button', {
          class: 'zone z' + z + (M.zone === z ? ' on' : ''),
          disabled: locked,
          onclick: function () { moveTo(z, ''); },
        }, G().zones[z].label)
      );
      if (i < order.length - 1) {
        var x = order[i], y = order[i + 1];
        strip.appendChild(
          h('div', { class: 'border' },
            ['t', 'b', 'b', 't'].map(function (via) {
              return h('button', {
                class: 'via ' + via, disabled: locked,
                onclick: function () { cross(x, y, via); },
              }, via === 't' ? 'Trench' : 'Bump');
            })
          )
        );
      }
    });

    var shootLabel = G().zones[M.zone].shoot;
    var holdBtn = h('button', { class: 'hold z' + M.zone, disabled: locked, id: 'mhold' }, h('span', null, '按住 · ' + shootLabel), h('small', { id: 'mholdt' }, '松开结束'));
    bindHold(holdBtn);

    var est = estimateBar();

    var tools = h('div', { class: 'tools' },
      h('button', { class: 'btn', disabled: locked, onclick: function () { push(['d', now()]); SC.ui.toast('掉球 +1'); render(); } }, '掉球/吐球'),
      h('button', { class: 'btn' + (M.def != null ? ' active' : ''), disabled: locked, onclick: toggleDef }, M.def != null ? '防守中…点停' : '防守'),
      h('button', { class: 'btn' + (M.inc != null ? ' danger' : ''), disabled: !started, onclick: toggleInc }, M.inc != null ? '故障中…点恢复' : '故障 Incap'),
      h('button', { class: 'btn', disabled: !started, onclick: undo }, '↶ 撤销'),
      h('button', { class: 'btn', disabled: !started || !M.redo.length, onclick: redo }, '↷ 重做')
    );

    var climb = climbPanel(locked, tele);

    var nav;
    if (!started) {
      nav = h('button', { class: 'btn primary big', onclick: start }, '▶ 比赛开始（AUTO 亮灯时按）');
    } else if (!tele) {
      nav = h('button', { class: 'btn primary', onclick: function () { toTeleop(now()); } }, '进入 TELEOP →');
    } else {
      nav = h('div', { class: 'row' },
        hubOrderPicker(),
        h('button', { class: 'btn primary', onclick: endMatch }, '比赛结束 →')
      );
    }

    var log = h('div', { class: 'log muted' }, lastActions());

    var wrap = h('section', { class: 'live' + (M.inc != null ? ' incap' : '') }, top, strip, holdBtn, est, tools, climb, nav, log);
    setTimeout(updateTimer, 0);
    return wrap;
  }

  function start() {
    M.t0 = performance.now();
    clearInterval(tick);
    tick = setInterval(updateTimer, 200);
    render();
  }

  function toTeleop(t) {
    M.rec.te = t;
    render();
  }

  function updateTimer() {
    if (!M || M.step !== 'live') return clearInterval(tick);
    var el = document.getElementById('mtimer');
    if (!el) return;
    var g = G();
    var t = now() / 10;
    var left, label = '';
    if (!M.t0) {
      el.textContent = '0:20';
      return;
    }
    if (M.rec.te == null) {
      left = g.autoSec - t;
      // 忘了按就在 AUTO 结束 3 秒后自动切
      if (t >= g.autoSec + 3 && !M.hold) return toTeleop(Math.round((g.autoSec + 3) * 10));
    } else {
      var tt = teleT();
      left = g.teleopSec - tt;
      var p = SC.analysis.periodOf(now(), M.rec.te);
      label = g.periods.filter(function (x) { return x.key === p; })[0].label;
      var hub = document.getElementById('mhub');
      if (hub) {
        var act = SC.analysis.hubActive(p, M.rec.hf === 'us' ? true : M.rec.hf === 'them' ? false : null);
        hub.textContent = label + (act == null ? '' : act ? ' · 本方 Hub 激活' : ' · 本方 Hub 关闭');
        hub.className = 'hub ' + (act === false ? 'off' : act ? 'on' : '');
      }
    }
    var l = Math.max(0, Math.ceil(left));
    el.textContent = Math.floor(l / 60) + ':' + String(l % 60).padStart(2, '0');
    if (M.hold) {
      var ht = document.getElementById('mholdt');
      if (ht) ht.textContent = ((performance.now() - M.hold.at) / 1000).toFixed(1) + ' 秒';
    }
  }

  function hubOrderPicker() {
    var r = M.rec;
    return h('div', { class: 'hubpick' },
      h('small', null, 'Shift 1 哪边 Hub 先关？'),
      chips([{ value: 'us', label: '本方' }, { value: 'them', label: '对方' }], r.hf || '', function (v) {
        r.hf = r.hf === v ? '' : v;
        render();
      })
    );
  }

  function moveTo(z, via) {
    if (z === M.zone && !via) return;
    push(['z', now(), z, via]);
    M.zone = z;
    render();
  }
  function cross(x, y, via) {
    var order = G().zoneOrder;
    var dest = M.zone === x ? y : M.zone === y ? x : Math.abs(order.indexOf(x) - order.indexOf(M.zone)) > Math.abs(order.indexOf(y) - order.indexOf(M.zone)) ? x : y;
    moveTo(dest, via);
  }

  function bindHold(btn) {
    function down(e) {
      if (btn.disabled || M.hold) return;
      e.preventDefault();
      try { btn.setPointerCapture(e.pointerId); } catch (x) { /* 旧浏览器 */ }
      M.hold = { t: now(), at: performance.now() };
      btn.classList.add('pressed');
      if (navigator.vibrate) navigator.vibrate(15);
    }
    function up() {
      if (!M.hold) return;
      var dur = Math.max(1, now() - M.hold.t);
      push(['s', M.hold.t, M.zone, dur, -1, 0]);
      M.lastShot = M.rec.a.length - 1;
      M.hold = null;
      render();
    }
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }

  // 松开后估计这一轮进了几个（可跳过）
  function estimateBar() {
    var a = M.rec.a[M.lastShot];
    if (!a || a[0] !== 's' || !SC.store.settings().askFuel) return null;
    var label = a[2] === 'A' ? '这轮大约进了几个？' : '这轮大约送出几个？';
    return h('div', { class: 'estimate' },
      h('small', null, label + '（' + (a[3] / 10).toFixed(1) + ' 秒）'),
      chips(G().fuelEstimateChips, a[4] >= 0 ? a[4] : '', function (v) { a[4] = a[4] === Number(v) ? -1 : Number(v); render(); }, 'small'),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!a[5], onchange: function (e) { a[5] = e.target.checked ? 1 : 0; } }), ' 边吸边射')
    );
  }

  function toggleDef() {
    if (M.def == null) M.def = now();
    else {
      push(['f', M.def, now() - M.def]);
      M.def = null;
    }
    render();
  }
  function toggleInc() {
    if (M.inc == null) {
      if (M.def != null) toggleDef();
      M.inc = now();
    } else {
      push(['i', M.inc, now() - M.inc]);
      M.inc = null;
    }
    render();
  }

  function recomputeZone() {
    M.zone = 'A';
    M.rec.a.forEach(function (a) {
      if (a[0] === 'z') M.zone = a[2];
    });
  }
  function undo() {
    if (M.def != null) { M.def = null; return render(); }
    if (M.inc != null) { M.inc = null; return render(); }
    var a = M.rec.a.pop();
    if (!a) return;
    M.redo.push(a);
    M.lastShot = -1;
    recomputeZone();
    SC.ui.toast('已撤销：' + describe(a));
    render();
  }
  function redo() {
    var a = M.redo.pop();
    if (!a) return;
    M.rec.a.push(a);
    recomputeZone();
    render();
  }

  function describe(a) {
    var z = G().zones;
    var t = (a[1] / 10).toFixed(0) + 's ';
    if (a[0] === 'z') return t + '→ ' + z[a[2]].label + (a[3] === 'b' ? '（Bump）' : a[3] === 't' ? '（Trench）' : '');
    if (a[0] === 's') return t + z[a[2]].shoot.split(' ')[0] + ' ' + (a[3] / 10).toFixed(1) + '秒' + (a[4] >= 0 ? ' ≈' + a[4] : '');
    if (a[0] === 'd') return t + '掉球';
    if (a[0] === 'f') return t + '防守 ' + (a[2] / 10).toFixed(0) + '秒';
    if (a[0] === 'i') return t + '故障 ' + (a[2] / 10).toFixed(0) + '秒';
    return t + a[0];
  }
  function lastActions() {
    return M.rec.a.slice(-4).reverse().map(describe).join(' · ') || '还没有动作';
  }

  function climbPanel(locked, tele) {
    var cl = M.rec.cl;
    var g = G();
    if (!tele) {
      return h('div', { class: 'climb' },
        h('small', null, 'AUTO 爬 L1：'),
        chips([{ value: 1, label: '成功' }, { value: 0, label: '没爬/失败' }], cl.ao === 1 ? 1 : cl.ao === 0 ? 0 : '', function (v) { cl.ao = Number(v); render(); }, 'small')
      );
    }
    var startBtn = cl.s == null
      ? h('button', { class: 'btn', disabled: locked, onclick: function () { cl.s = now(); render(); } }, '开始爬塔（记录剩余时间）')
      : h('small', null, '开始爬塔时剩 ' + Math.max(0, Math.round(g.teleopSec - (cl.s - M.rec.te) / 10)) + ' 秒 ',
          h('button', { class: 'link', onclick: function () { delete cl.s; render(); } }, '撤销'));
    return h('div', { class: 'climb' },
      startBtn,
      h('div', { class: 'row wrap' },
        h('small', null, '位置'),
        chips(g.climbPositions, cl.p || '', function (v) { cl.p = cl.p === v ? '' : v; render(); }, 'small'),
        h('small', null, '等级'),
        chips([1, 2, 3].map(function (l) { return { value: l, label: 'L' + l }; }), cl.l || '', function (v) { cl.l = cl.l === Number(v) ? 0 : Number(v); render(); }, 'small'),
        chips([{ value: 1, label: '成功' }, { value: 0, label: '失败' }], cl.o === 1 ? 1 : cl.o === 0 ? 0 : '', function (v) { cl.o = Number(v); render(); }, 'small')
      )
    );
  }

  function endMatch() {
    if (M.hold) return;
    if (M.def != null) toggleDef();
    if (M.inc != null) toggleInc();
    clearInterval(tick);
    M.step = 'post';
    render();
  }

  // ---------- 4. 赛后 ----------
  function postView() {
    var r = M.rec;
    var tags = r.tg;
    return h(
      'section',
      { class: 'card' },
      h('h2', null, '赛后 · ', h('span', { class: 'team ' + r.st[0] }, r.tm), r.ns ? '（No Show）' : ''),
      r.ns ? null : SC.ui.field('驾驶水平 1-5', chips([1, 2, 3, 4, 5], r.dr || '', function (v) { r.dr = Number(v); render(); })),
      r.ns ? null : SC.ui.field('防守质量（没防守就不选）', chips([1, 2, 3, 4, 5], r.df || '', function (v) { r.df = r.df === Number(v) ? undefined : Number(v); render(); })),
      r.ns ? null : SC.ui.field('情况', h('div', { class: 'chips' }, G().postTags.map(function (t) {
        var on = tags.indexOf(t.key) >= 0;
        return h('button', { type: 'button', class: 'chip' + (on ? ' on' : ''), onclick: function () {
          if (on) tags.splice(tags.indexOf(t.key), 1);
          else tags.push(t.key);
          render();
        } }, t.label);
      }))),
      SC.ui.field('备注', h('textarea', { rows: 3, value: r.nt || '', placeholder: '射得准不准、常去哪射、被防守时怎样…', oninput: function (e) { r.nt = e.target.value; } })),
      h('div', { class: 'row' },
        r.ns ? h('button', { class: 'btn', onclick: function () { r.ns = false; M.step = 'pre'; render(); } }, '← 其实上场了') : null,
        h('button', { class: 'btn primary big', onclick: save }, '保存并生成二维码')
      )
    );
  }

  function save() {
    var r = M.rec;
    r.ts = Date.now();
    if (!r.nt) delete r.nt;
    SC.store.put(r);
    SC.store.addMine(SC.store.recordKey(r));
    M.step = 'qr';
    render();
  }

  // ---------- 5. 二维码 ----------
  function qrView() {
    var r = M.rec;
    var d = SC.analysis.derive(r);
    var text = SC.codec.encode(r);
    return h(
      'section',
      { class: 'card center' },
      h('h2', null, 'Q' + r.mt + ' · ', h('span', { class: 'team ' + r.st[0] }, r.tm), ' · 让数据负责人扫码'),
      SC.ui.qr(text),
      h('p', { class: 'muted' },
        r.ns ? 'No Show' : '估计 Fuel ' + (d.autoFuel + d.teleFuel) + ' · 得分射球 ' + d.scoreSecTotal.toFixed(1) + ' 秒 · 爬塔 L' + d.towerLevel + ' · ' + text.length + ' 字节'),
      h('div', { class: 'row' },
        h('button', { class: 'btn', onclick: function () { SC.ui.download('Q' + r.mt + '_' + r.tm + '.txt', text); } }, '另存为文件'),
        h('button', { class: 'btn primary big', onclick: function () { newMatch(r); M.step = 'setup'; render(); } }, '下一场 →')
      )
    );
  }

  SC.views.match = function (el) {
    h = SC.ui.h;
    chips = SC.ui.chips;
    root = el;
    if (!M) newMatch(null);
    render();
  };
  SC.views.matchActive = function () {
    return !!(M && M.step === 'live' && M.t0);
  };
})();
