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
      h('h2', null, 'Match scouting · setup'),
      SC.ui.field('Event key', h('input', { value: r.ev, placeholder: 'e.g. 2026cmptx', oninput: function (e) { r.ev = e.target.value.trim(); refreshTeam(); } })),
      SC.ui.field('Qualification match', h('input', { type: 'number', inputmode: 'numeric', value: r.mt, oninput: function (e) { r.mt = e.target.value; refreshTeam(); } })),
      SC.ui.field(
        'Station',
        chips(['R1', 'R2', 'R3', 'B1', 'B2', 'B3'], r.st, function (v) {
          r.st = v;
          var s = SC.store.settings();
          s.station = v;
          SC.store.saveSettings(s);
          refreshTeam();
          render();
        }, 'stations')
      ),
      SC.ui.field('Team', teamInput, SC.store.schedule(r.ev).matches.length ? 'Filled in from the schedule. You can change it.' : 'No schedule yet: sync TBA or import a CSV in Settings.'),
      SC.ui.field('Scout', h('input', { value: r.sc, oninput: function (e) { r.sc = e.target.value.trim(); var s = SC.store.settings(); s.scout = r.sc; SC.store.saveSettings(s); } })),
      h('button', {
        class: 'btn primary big',
        onclick: function () {
          if (!r.ev || !(Number(r.mt) > 0) || !(Number(r.tm) > 0) || !r.sc) return SC.ui.toast('Fill in event, match, team and scout', 'err');
          r.mt = Number(r.mt);
          r.tm = Number(r.tm);
          M.step = 'pre';
          render();
        },
      }, 'Next →')
    );
  }

  // ---------- 2. 赛前 ----------
  function preView() {
    var r = M.rec;
    return h(
      'section',
      { class: 'card' },
      h('h2', null, 'Q' + r.mt + ' · ', h('span', { class: 'team ' + r.st[0] }, r.tm), ' · ' + r.st),
      SC.ui.field('Starting position (facing our driver station)', chips(G().startPositions.map(function (p, i) { return { value: i, label: p }; }), r.sp, function (v) { r.sp = Number(v); render(); })),
      SC.ui.field('Preloaded Fuel', chips([{ value: 1, label: 'Yes' }, { value: 0, label: 'No' }], r.pl ? 1 : r.pl === 0 ? 0 : '', function (v) { r.pl = Number(v); render(); })),
      h('div', { class: 'row' },
        h('button', { class: 'btn', onclick: function () { M.step = 'setup'; render(); } }, '← Back'),
        h('button', { class: 'btn warn', onclick: function () { r.ns = true; M.step = 'post'; render(); } }, 'No show'),
        h('button', { class: 'btn primary', onclick: function () { if (r.sp == null) return SC.ui.toast('Pick a starting position first', 'err'); M.step = 'live'; render(); } }, 'Ready →')
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
    var holdBtn = h('button', { class: 'hold z' + M.zone, disabled: locked, id: 'mhold' }, h('span', null, 'Hold · ' + shootLabel), h('small', { id: 'mholdt' }, 'Release to stop'));
    bindHold(holdBtn);

    var est = estimateBar();

    var tools = h('div', { class: 'tools' },
      h('button', { class: 'btn', disabled: locked, onclick: function () { push(['d', now()]); SC.ui.toast('Drop +1'); render(); } }, 'Drop / outtake'),
      h('button', { class: 'btn' + (M.def != null ? ' active' : ''), disabled: locked, onclick: toggleDef }, M.def != null ? 'Defending… tap to stop' : 'Defense'),
      h('button', { class: 'btn' + (M.inc != null ? ' danger' : ''), disabled: !started, onclick: toggleInc }, M.inc != null ? 'Incap… tap to resume' : 'Incap'),
      h('button', { class: 'btn', disabled: !started, onclick: undo }, '↶ Undo'),
      h('button', { class: 'btn', disabled: !started || !M.redo.length, onclick: redo }, '↷ Redo')
    );

    var climb = climbPanel(locked, tele);

    var nav;
    if (!started) {
      nav = h('button', { class: 'btn primary big', onclick: start }, '▶ Start match (tap when AUTO starts)');
    } else if (!tele) {
      nav = h('button', { class: 'btn primary', onclick: function () { toTeleop(now()); } }, 'Start TELEOP →');
    } else {
      nav = h('div', { class: 'row' },
        hubOrderPicker(),
        h('button', { class: 'btn primary', onclick: endMatch }, 'Match over →')
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
        hub.textContent = label + (act == null ? '' : act ? ' · our Hub ACTIVE' : ' · our Hub INACTIVE');
        hub.className = 'hub ' + (act === false ? 'off' : act ? 'on' : '');
      }
    }
    var l = Math.max(0, Math.ceil(left));
    el.textContent = Math.floor(l / 60) + ':' + String(l % 60).padStart(2, '0');
    if (M.hold) {
      var ht = document.getElementById('mholdt');
      if (ht) ht.textContent = ((performance.now() - M.hold.at) / 1000).toFixed(1) + ' s';
    }
  }

  function hubOrderPicker() {
    var r = M.rec;
    return h('div', { class: 'hubpick' },
      h('small', null, 'Whose Hub is inactive in Shift 1?'),
      chips([{ value: 'us', label: 'Ours' }, { value: 'them', label: 'Theirs' }], r.hf || '', function (v) {
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
    var label = a[2] === 'A' ? 'About how many went in?' : 'About how many were sent?';
    return h('div', { class: 'estimate' },
      h('small', null, label + ' (' + (a[3] / 10).toFixed(1) + ' s)'),
      chips(G().fuelEstimateChips, a[4] >= 0 ? a[4] : '', function (v) { a[4] = a[4] === Number(v) ? -1 : Number(v); render(); }, 'small'),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!a[5], onchange: function (e) { a[5] = e.target.checked ? 1 : 0; } }), ' Intaking while shooting')
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
    SC.ui.toast('Undid: ' + describe(a));
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
    if (a[0] === 'z') return t + '→ ' + z[a[2]].label + (a[3] === 'b' ? ' (Bump)' : a[3] === 't' ? ' (Trench)' : '');
    if (a[0] === 's') return t + z[a[2]].shoot + ' ' + (a[3] / 10).toFixed(1) + 's' + (a[4] >= 0 ? ' ≈' + a[4] : '');
    if (a[0] === 'd') return t + 'Drop';
    if (a[0] === 'f') return t + 'Defense ' + (a[2] / 10).toFixed(0) + 's';
    if (a[0] === 'i') return t + 'Incap ' + (a[2] / 10).toFixed(0) + 's';
    return t + a[0];
  }
  function lastActions() {
    return M.rec.a.slice(-4).reverse().map(describe).join(' · ') || 'No actions yet';
  }

  function climbPanel(locked, tele) {
    var cl = M.rec.cl;
    var g = G();
    if (!tele) {
      return h('div', { class: 'climb' },
        h('small', null, 'AUTO L1 climb:'),
        chips([{ value: 1, label: 'Success' }, { value: 0, label: 'None / failed' }], cl.ao === 1 ? 1 : cl.ao === 0 ? 0 : '', function (v) { cl.ao = Number(v); render(); }, 'small')
      );
    }
    var startBtn = cl.s == null
      ? h('button', { class: 'btn', disabled: locked, onclick: function () { cl.s = now(); render(); } }, 'Climb started (records time left)')
      : h('small', null, 'Climb started with ' + Math.max(0, Math.round(g.teleopSec - (cl.s - M.rec.te) / 10)) + ' s left ',
          h('button', { class: 'link', onclick: function () { delete cl.s; render(); } }, 'Undo'));
    return h('div', { class: 'climb' },
      startBtn,
      h('div', { class: 'row wrap' },
        h('small', null, 'Position'),
        chips(g.climbPositions, cl.p || '', function (v) { cl.p = cl.p === v ? '' : v; render(); }, 'small'),
        h('small', null, 'Level'),
        chips([1, 2, 3].map(function (l) { return { value: l, label: 'L' + l }; }), cl.l || '', function (v) { cl.l = cl.l === Number(v) ? 0 : Number(v); render(); }, 'small'),
        chips([{ value: 1, label: 'Success' }, { value: 0, label: 'Failed' }], cl.o === 1 ? 1 : cl.o === 0 ? 0 : '', function (v) { cl.o = Number(v); render(); }, 'small')
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
      h('h2', null, 'Post-match · ', h('span', { class: 'team ' + r.st[0] }, r.tm), r.ns ? ' (no show)' : ''),
      r.ns ? null : SC.ui.field('Driver skill 1–5', chips([1, 2, 3, 4, 5], r.dr || '', function (v) { r.dr = Number(v); render(); })),
      r.ns ? null : SC.ui.field('Defense quality (leave blank if no defense)', chips([1, 2, 3, 4, 5], r.df || '', function (v) { r.df = r.df === Number(v) ? undefined : Number(v); render(); })),
      r.ns ? null : SC.ui.field('What happened', h('div', { class: 'chips' }, G().postTags.map(function (t) {
        var on = tags.indexOf(t.key) >= 0;
        return h('button', { type: 'button', class: 'chip' + (on ? ' on' : ''), onclick: function () {
          if (on) tags.splice(tags.indexOf(t.key), 1);
          else tags.push(t.key);
          render();
        } }, t.label);
      }))),
      SC.ui.field('Notes', h('textarea', { rows: 3, value: r.nt || '', placeholder: 'Accuracy, favorite shooting spots, how they handle defense…', oninput: function (e) { r.nt = e.target.value; } })),
      h('div', { class: 'row' },
        r.ns ? h('button', { class: 'btn', onclick: function () { r.ns = false; M.step = 'pre'; render(); } }, '← They did play') : null,
        h('button', { class: 'btn primary big', onclick: save }, 'Save and show QR code')
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
      h('h2', null, 'Q' + r.mt + ' · ', h('span', { class: 'team ' + r.st[0] }, r.tm), ' · show this to the data lead'),
      SC.ui.qr(text),
      h('p', { class: 'muted' },
        r.ns ? 'No Show' : 'Est. Fuel ' + (d.autoFuel + d.teleFuel) + ' · scoring time ' + d.scoreSecTotal.toFixed(1) + ' s · climb L' + d.towerLevel + ' · ' + text.length + ' bytes'),
      h('div', { class: 'row' },
        h('button', { class: 'btn', onclick: function () { SC.ui.download('Q' + r.mt + '_' + r.tm + '.txt', text); } }, 'Save as file'),
        h('button', { class: 'btn primary big', onclick: function () { newMatch(r); M.step = 'setup'; render(); } }, 'Next match →')
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
