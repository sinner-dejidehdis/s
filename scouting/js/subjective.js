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
      h('h2', null, 'Subjective scouting · whole alliance'),
      SC.ui.field('Event key', h('input', { value: r.ev, oninput: function (e) { r.ev = e.target.value.trim(); refresh(); } })),
      SC.ui.field('Qualification match', h('input', { type: 'number', inputmode: 'numeric', value: r.mt, oninput: function (e) { r.mt = e.target.value; refresh(); } })),
      SC.ui.field('Alliance', chips([{ value: 'R', label: 'Red' }, { value: 'B', label: 'Blue' }], r.al, function (v) { r.al = v; refresh(); render(); })),
      SC.ui.field('Teams', h('div', { class: 'row' }, inputs)),
      SC.ui.field('Scout', h('input', { value: r.sc, oninput: function (e) { r.sc = e.target.value.trim(); } })),
      h('button', { class: 'btn primary big', onclick: function () {
        r.mt = Number(r.mt);
        if (!r.ev || !(r.mt > 0) || !r.sc || r.teams.some(function (t) { return !(Number(t.tm) > 0); })) return SC.ui.toast('Fill in every field', 'err');
        r.teams.forEach(function (t) { t.tm = Number(t.tm); if (!Object.keys(t.tags).length) prefill(t); });
        S.step = 'sheet';
        render();
      } }, 'Start →')
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
          h('button', { class: 'btn small' + (t.mark ? ' active' : ''), title: 'Flag this match to review at the picklist meeting', onclick: function () { t.mark = !t.mark; render(); } }, t.mark ? '★ Flagged' : '☆ Flag'),
          h('button', { class: 'btn small' + (t.dnp ? ' danger' : ''), title: 'Do Not Pick', onclick: function () { t.dnp = !t.dnp; render(); } }, t.dnp ? '⊘ DNP' : 'DNP')
        )
      ),
      SC.ui.field('Auto contribution (share of alliance Auto Fuel)',
        h('div', { class: 'row' },
          h('input', { type: 'range', min: 0, max: 100, step: 10, value: t.ac == null ? 0 : t.ac, oninput: function (e) { t.ac = Number(e.target.value); e.target.nextSibling.textContent = t.ac + '%'; } }),
          h('b', null, t.ac == null ? 'not set' : t.ac + '%')
        )),
      SC.ui.field('Cycle route', h('div', { class: 'grid2' }, cyBox('to', 'Out · Trench'), cyBox('bo', 'Out · Bump'), cyBox('ti', 'Back · Trench'), cyBox('bi', 'Back · Bump'))),
      Object.keys(cats).map(function (c) {
        return h('div', { class: 'tagcat' }, h('small', { class: 'muted' }, c), h('div', { class: 'chips' }, cats[c].map(function (tag) { return tagControl(t, tag); })));
      }),
      h('textarea', { rows: 2, placeholder: 'Notes: why numbers may be high or low, strategy observations…', value: t.nt, oninput: function (e) { t.nt = e.target.value; } })
    );
  }

  function sheetView() {
    var r = S.rec;
    return h('section', null,
      h('div', { class: 'row between' },
        h('h2', null, 'Q' + r.mt + ' · ' + (r.al === 'R' ? 'Red' : 'Blue') + ' alliance'),
        h('button', { class: 'btn small', onclick: function () { r.teams.forEach(function (t) { t.tags = {}; }); render(); } }, 'Clear prefill')
      ),
      h('p', { class: 'muted' }, 'Tags are prefilled with each team\'s most common past values. Change only what is different. Levels 1–4: poor → great.'),
      r.teams.map(teamCard),
      h('button', { class: 'btn primary big', onclick: function () {
        r.ts = Date.now();
        r.teams.forEach(function (t) { if (!t.nt) delete t.nt; });
        SC.store.put(r);
        SC.store.addMine(SC.store.recordKey(r));
        S.step = 'qr';
        render();
      } }, 'Save and show QR code')
    );
  }

  function qrView() {
    var r = S.rec;
    var text = SC.codec.encode(r);
    return h('section', { class: 'card center' },
      h('h2', null, 'Q' + r.mt + ' ' + (r.al === 'R' ? 'Red' : 'Blue') + ' · show this to the data lead'),
      SC.ui.qr(text),
      h('p', { class: 'muted' }, text.length + ' bytes'),
      h('button', { class: 'btn primary big', onclick: function () { newSheet(r); render(); } }, 'Next match →')
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
