// 主观 / 策略记录：一人看一个联盟的三台。
// 参考 1678 Subjective Scout（Auto 贡献%、往返路线）+ Stand Strategist（标签、DNP、标记）。
var SC = (globalThis.SC = globalThis.SC || {});
SC.views = SC.views || {};

(function () {
  var h, chips;
  var S = null;
  var root = null;

  function teamsFor(ev, mt, al) {
    var m = SC.store.schedule(ev).matches.filter(function (x) { return x.mt === Number(mt); })[0];
    return [1, 2, 3].map(function (i) { return (m && m[al + i]) || ''; });
  }

  function blankTeam(tm) {
    return { tm: tm, ac: null, cy: {}, tags: {}, dnp: false, mark: false, nt: '' };
  }

  function newSheet(prev) {
    var s = SC.store.settings();
    var mt = prev ? Number(prev.mt) + 1 : 1;
    var al = prev ? prev.al : (s.station || 'R')[0];
    S = { step: 'setup', rec: { k: 's', ev: s.event, mt: mt, al: al, sc: s.scout, ts: 0, teams: teamsFor(s.event, mt, al).map(blankTeam) } };
  }

  // 按这个队过去最常见的值预填（1678 Pre-Populating Tags）
  function prefill(t) {
    var hist = SC.store.list('s', S.rec.ev);
    var votes = {};
    hist.forEach(function (s) {
      (s.teams || []).forEach(function (x) {
        if (Number(x.tm) !== Number(t.tm) || s.mt === S.rec.mt) return;
        Object.keys(x.tags || {}).forEach(function (k) {
          var v = String(x.tags[k]);
          votes[k] = votes[k] || {};
          votes[k][v] = (votes[k][v] || 0) + 1;
        });
      });
    });
    Object.keys(votes).forEach(function (k) {
      var best = Object.keys(votes[k]).sort(function (a, b) { return votes[k][b] - votes[k][a]; })[0];
      t.tags[k] = best === 'true' ? true : Number(best);
    });
  }

  function render() {
    root.textContent = '';
    root.appendChild(S.step === 'setup' ? setupView() : S.step === 'sheet' ? sheetView() : qrView());
  }

  function setupView() {
    var r = S.rec;
    var inputs = r.teams.map(function (t, i) {
      return h('input', { type: 'number', inputmode: 'numeric', value: t.tm, placeholder: r.al + (i + 1), oninput: function (e) { t.tm = e.target.value; } });
    });
    function refresh() {
      teamsFor(r.ev, r.mt, r.al).forEach(function (tm, i) {
        if (tm) {
          r.teams[i].tm = tm;
          inputs[i].value = tm;
        }
      });
    }
    return h('section', { class: 'card' },
      h('h2', null, '主观记录 · 看整个联盟'),
      SC.ui.field('赛事代码', h('input', { value: r.ev, oninput: function (e) { r.ev = e.target.value.trim(); refresh(); } })),
      SC.ui.field('资格赛场次', h('input', { type: 'number', inputmode: 'numeric', value: r.mt, oninput: function (e) { r.mt = e.target.value; refresh(); } })),
      SC.ui.field('联盟', chips([{ value: 'R', label: '红' }, { value: 'B', label: '蓝' }], r.al, function (v) { r.al = v; refresh(); render(); })),
      SC.ui.field('三支队伍', h('div', { class: 'row' }, inputs)),
      SC.ui.field('记录员', h('input', { value: r.sc, oninput: function (e) { r.sc = e.target.value.trim(); } })),
      h('button', { class: 'btn primary big', onclick: function () {
        r.mt = Number(r.mt);
        if (!r.ev || !(r.mt > 0) || !r.sc || r.teams.some(function (t) { return !(Number(t.tm) > 0); })) return SC.ui.toast('信息没填全', 'err');
        r.teams.forEach(function (t) { t.tm = Number(t.tm); if (!Object.keys(t.tags).length) prefill(t); });
        S.step = 'sheet';
        render();
      } }, '开始 →')
    );
  }

  function tagControl(t, tag) {
    var v = t.tags[tag.key];
    if (tag.kind === 'bool') {
      return h('button', { type: 'button', class: 'chip' + (v ? ' on' : ''), onclick: function () {
        if (v) delete t.tags[tag.key];
        else t.tags[tag.key] = true;
        render();
      } }, tag.label);
    }
    return h('div', { class: 'lvl' }, h('small', null, tag.label),
      h('div', { class: 'chips small' }, [1, 2, 3, 4].map(function (n) {
        return h('button', { type: 'button', class: 'chip l' + n + (v === n ? ' on' : ''), onclick: function () {
          if (v === n) delete t.tags[tag.key];
          else t.tags[tag.key] = n;
          render();
        } }, n);
      }))
    );
  }

  function teamCard(t) {
    var cats = {};
    SC.GAME.subjectiveTags.forEach(function (tag) { (cats[tag.cat] = cats[tag.cat] || []).push(tag); });
    var cy = t.cy;
    function cyBox(key, label) {
      return h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!cy[key], onchange: function (e) { if (e.target.checked) cy[key] = 1; else delete cy[key]; } }), label);
    }
    return h('div', { class: 'card team-card' + (t.dnp ? ' dnp' : '') },
      h('div', { class: 'row between' },
        h('h3', null, h('span', { class: 'team ' + S.rec.al }, t.tm)),
        h('div', { class: 'row' },
          h('button', { class: 'btn small' + (t.mark ? ' active' : ''), title: '标记这场，选人会议时回看', onclick: function () { t.mark = !t.mark; render(); } }, t.mark ? '★ 已标记' : '☆ 标记'),
          h('button', { class: 'btn small' + (t.dnp ? ' danger' : ''), title: '不选 Do Not Pick', onclick: function () { t.dnp = !t.dnp; render(); } }, t.dnp ? '⊘ DNP' : 'DNP')
        )
      ),
      SC.ui.field('Auto 贡献（占本联盟 Auto Fuel 的比例）',
        h('div', { class: 'row' },
          h('input', { type: 'range', min: 0, max: 100, step: 10, value: t.ac == null ? 0 : t.ac, oninput: function (e) { t.ac = Number(e.target.value); e.target.nextSibling.textContent = t.ac + '%'; } }),
          h('b', null, t.ac == null ? '未填' : t.ac + '%')
        )),
      SC.ui.field('往返路线', h('div', { class: 'grid2' }, cyBox('to', '出 · Trench'), cyBox('bo', '出 · Bump'), cyBox('ti', '回 · Trench'), cyBox('bi', '回 · Bump'))),
      Object.keys(cats).map(function (c) {
        return h('div', { class: 'tagcat' }, h('small', { class: 'muted' }, c), h('div', { class: 'chips' }, cats[c].map(function (tag) { return tagControl(t, tag); })));
      }),
      h('textarea', { rows: 2, placeholder: '备注：数字可能偏高/偏低的原因、策略观察…', value: t.nt, oninput: function (e) { t.nt = e.target.value; } })
    );
  }

  function sheetView() {
    var r = S.rec;
    return h('section', null,
      h('div', { class: 'row between' },
        h('h2', null, 'Q' + r.mt + ' · ' + (r.al === 'R' ? '红' : '蓝') + '方联盟'),
        h('button', { class: 'btn small', onclick: function () { r.teams.forEach(function (t) { t.tags = {}; }); render(); } }, '清空预填')
      ),
      h('p', { class: 'muted' }, '标签已按该队以往最常见的值预填，只改不一样的。等级 1–4：差 → 好。'),
      r.teams.map(teamCard),
      h('button', { class: 'btn primary big', onclick: function () {
        r.ts = Date.now();
        r.teams.forEach(function (t) { if (!t.nt) delete t.nt; });
        SC.store.put(r);
        SC.store.addMine(SC.store.recordKey(r));
        S.step = 'qr';
        render();
      } }, '保存并生成二维码')
    );
  }

  function qrView() {
    var r = S.rec;
    var text = SC.codec.encode(r);
    return h('section', { class: 'card center' },
      h('h2', null, 'Q' + r.mt + ' ' + (r.al === 'R' ? '红' : '蓝') + '方 · 让数据负责人扫码'),
      SC.ui.qr(text),
      h('p', { class: 'muted' }, text.length + ' 字节'),
      h('button', { class: 'btn primary big', onclick: function () { newSheet(r); render(); } }, '下一场 →')
    );
  }

  SC.views.subj = function (el) {
    h = SC.ui.h;
    chips = SC.ui.chips;
    root = el;
    if (!S) newSheet(null);
    render();
  };
})();
