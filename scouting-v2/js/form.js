// Paged scouting form built from config.js: one page at a time, Prev / Next, QR at the end.
var V2 = (globalThis.V2 = globalThis.V2 || {});

(function () {
  var h;
  var state = {}; // kind -> { page, values, timers }

  function st(kind) {
    if (!state[kind]) state[kind] = { page: 0, values: defaults(kind, {}), timers: {} };
    return state[kind];
  }

  function defaults(kind, prev) {
    var v = {};
    V2.codec.fields(kind).forEach(function (f) {
      if (f.keep && prev[f.code] != null) v[f.code] = prev[f.code];
      else if (f.def != null) v[f.code] = f.def;
      else if (f.type === 'counter' || f.type === 'timer') v[f.code] = 0;
      else if (f.type === 'multi' || f.type === 'field') v[f.code] = [];
      else if (f.type === 'bool') v[f.code] = false;
      else v[f.code] = '';
    });
    if (kind === 'match') {
      var saved = V2.ui.get('scout', {});
      ['s', 'e', 'r'].forEach(function (k) { if (!v[k] && saved[k]) v[k] = saved[k]; });
      if (!v.e) v.e = V2.ui.get('settings', {}).event || '';
      if (prev.m) v.m = Number(prev.m) + 1;
      fillTeam(v);
    } else if (!v.e) v.e = V2.ui.get('settings', {}).event || '';
    return v;
  }

  function fillTeam(v) {
    var sch = V2.ui.get('schedule', {})[v.e] || [];
    var m = sch.filter(function (x) { return x.m === Number(v.m); })[0];
    var key = { r1: 'R1', r2: 'R2', r3: 'R3', b1: 'B1', b2: 'B2', b3: 'B3' }[v.r];
    if (m && key && m[key]) v.t = m[key];
  }

  var STATIONS = { r1: 'Red 1', r2: 'Red 2', r3: 'Red 3', b1: 'Blue 1', b2: 'Blue 2', b3: 'Blue 3' };

  function control(kind, f, v, rerender) {
    var val = v[f.code];
    var id = kind + '-' + f.code;
    function setv(x) { v[f.code] = x; }
    switch (f.type) {
      case 'text':
      case 'event':
        return h('input', { id: id, value: val, maxlength: f.max || 40, placeholder: f.type === 'event' ? '2026txhou' : '', oninput: function (e) {
          setv(f.type === 'event' ? e.target.value.trim().toLowerCase() : e.target.value);
        } });
      case 'number':
      case 'match':
      case 'team':
        return h('input', { id: id, type: 'number', inputmode: 'numeric', value: val, oninput: function (e) {
          setv(e.target.value === '' ? '' : Number(e.target.value));
          if (f.type === 'match') { fillTeam(v); var t = document.getElementById(kind + '-t'); if (t) t.value = v.t || ''; }
        } });
      case 'textarea':
        return h('textarea', { id: id, rows: 3, maxlength: f.max || 200, value: val, oninput: function (e) { setv(e.target.value); } });
      case 'bool':
        return h('button', { type: 'button', id: id, class: 'toggle' + (val ? ' on' : ''), 'aria-pressed': val ? 'true' : 'false', onclick: function () { setv(!val); rerender(); } }, val ? 'Yes' : 'No');
      case 'station':
      case 'radio':
        var choices = f.type === 'station' ? STATIONS : f.choices;
        return h('div', { class: 'seg' + (f.type === 'station' ? ' stations' : ''), role: 'radiogroup', id: id }, Object.keys(choices).map(function (k) {
          return h('button', { type: 'button', role: 'radio', 'aria-checked': val === k ? 'true' : 'false', class: 'opt' + (val === k ? ' on' : '') + (f.type === 'station' ? ' ' + k[0] : ''), onclick: function () {
            setv(val === k && !f.required ? '' : k);
            if (f.type === 'station') fillTeam(v);
            rerender();
          } }, choices[k]);
        }));
      case 'multi':
        return h('div', { class: 'seg', id: id }, Object.keys(f.choices).map(function (k) {
          var on = val.indexOf(k) >= 0;
          return h('button', { type: 'button', 'aria-pressed': on ? 'true' : 'false', class: 'opt' + (on ? ' on' : ''), onclick: function () {
            setv(on ? val.filter(function (x) { return x !== k; }) : val.concat([k]));
            rerender();
          } }, f.choices[k]);
        }));
      case 'rating':
        return h('div', { class: 'seg', id: id }, Array.from({ length: f.max }, function (_, i) { return i + 1; }).map(function (n) {
          return h('button', { type: 'button', class: 'opt' + (val === n ? ' on' : ''), onclick: function () { setv(val === n ? '' : n); rerender(); } }, n);
        }));
      case 'counter':
        var show = h('output', { class: 'count', id: id }, val);
        function bump(d) { v[f.code] = Math.max(0, (v[f.code] || 0) + d); show.textContent = v[f.code]; if (navigator.vibrate) navigator.vibrate(10); }
        return h('div', { class: 'counter' },
          h('button', { type: 'button', class: 'btn minus', 'aria-label': 'minus 1', onclick: function () { bump(-1); } }, '−'),
          show,
          f.steps.map(function (s) { return h('button', { type: 'button', class: 'btn plus', onclick: function () { bump(s); } }, '+' + s); }));
      case 'timer':
        var T = st(kind).timers;
        var out = h('output', { class: 'count', id: id }, (val || 0).toFixed(1) + ' s');
        var btn = h('button', { type: 'button', class: 'btn' + (T[f.code] ? ' running' : '') }, T[f.code] ? 'Stop' : 'Start');
        btn.addEventListener('click', function () {
          if (T[f.code]) {
            v[f.code] = (v[f.code] || 0) + (performance.now() - T[f.code]) / 1000;
            delete T[f.code];
          } else T[f.code] = performance.now();
          rerender();
        });
        if (T[f.code]) {
          var iv = setInterval(function () {
            if (!document.body.contains(out) || !T[f.code]) return clearInterval(iv);
            out.textContent = ((v[f.code] || 0) + (performance.now() - T[f.code]) / 1000).toFixed(1) + ' s';
          }, 100);
        }
        return h('div', { class: 'counter' }, btn, out,
          h('button', { type: 'button', class: 'btn small', onclick: function () { v[f.code] = 0; delete T[f.code]; rerender(); } }, 'Reset'));
      case 'field':
        return V2.field.picker(val, f.mode, !!V2.ui.get('settings', {}).flip, function (pts) { setv(pts); });
    }
  }

  function missing(kind) {
    var v = st(kind).values;
    return V2.codec.fields(kind).filter(function (f) { return f.required && (v[f.code] === '' || v[f.code] == null); });
  }

  function stopTimers(kind) {
    var s = st(kind);
    Object.keys(s.timers).forEach(function (k) {
      s.values[k] = (s.values[k] || 0) + (performance.now() - s.timers[k]) / 1000;
    });
    s.timers = {};
  }

  function render(root, kind) {
    h = V2.ui.h;
    var s = st(kind);
    var pages = V2.CONFIG[kind];
    var last = s.page >= pages.length;
    var rerender = function () { root.textContent = ''; render(root, kind); };
    function go(d) {
      if (d > 0 && s.page === 0) {
        var miss = missing(kind);
        if (miss.length) return V2.ui.toast('Fill in: ' + miss.map(function (f) { return f.name; }).join(', '), 'err');
        if (kind === 'match') V2.ui.set('scout', { s: s.values.s, e: s.values.e, r: s.values.r });
      }
      if (d > 0 && s.page === pages.length - 1) stopTimers(kind);
      s.page = Math.max(0, Math.min(pages.length, s.page + d));
      rerender();
      window.scrollTo(0, 0);
    }

    var steps = h('ol', { class: 'steps' }, pages.map(function (p, i) {
      return h('li', { class: i === s.page ? 'on' : i < s.page ? 'done' : '' }, p.title);
    }).concat(kind === 'match' || pages.length > 1 ? [h('li', { class: last ? 'on' : '' }, 'QR')] : []));
    var nav = h('div', { class: 'pager' },
      h('button', { type: 'button', class: 'btn', disabled: s.page === 0, onclick: function () { go(-1); } }, '← Prev'),
      last ? null : h('button', { type: 'button', class: 'btn primary', onclick: function () { go(1); } }, s.page === pages.length - 1 ? 'Finish →' : 'Next →'));

    var body;
    if (!last) {
      var p = pages[s.page];
      body = h('section', { class: 'page ph-' + p.page },
        h('h2', null, p.title),
        p.fields.map(function (f) {
          return h('div', { class: 'item' + (f.type === 'field' ? ' wide' : '') },
            h('label', { class: 'iname', for: kind + '-' + f.code }, f.name, f.required ? h('span', { class: 'req' }, ' *') : null),
            control(kind, f, s.values, rerender));
        }));
    } else {
      var row = V2.codec.encode(kind, s.values);
      if (!s.saved) {
        var all = V2.ui.get('records', {});
        all[V2.codec.key(kind, s.values)] = { kind: kind, values: s.values, ts: Date.now() };
        V2.ui.set('records', all);
        s.saved = true;
      }
      var label = kind === 'match' ? 'Q' + s.values.m + ' · ' + s.values.t + ' · ' + (STATIONS[s.values.r] || '') : 'Pit · ' + s.values.t;
      body = h('section', { class: 'page ph-qr' },
        h('h2', null, label),
        h('p', { class: 'muted' }, 'Show this to the data lead. Points by your counts: ' + (kind === 'match' ? V2.stats.rowPoints(s.values) : '–')),
        V2.ui.qr(row),
        h('textarea', { class: 'raw', rows: 3, readonly: true, value: row, 'aria-label': 'Data row' }),
        h('div', { class: 'row' },
          h('button', { type: 'button', class: 'btn', onclick: function () { V2.ui.copy(row); } }, 'Copy data'),
          h('button', { type: 'button', class: 'btn primary', onclick: function () {
            state[kind] = { page: 0, values: defaults(kind, s.values), timers: {} };
            rerender();
          } }, kind === 'match' ? 'Next match →' : 'Next team →')));
    }
    root.appendChild(h('div', { class: 'form' }, steps, body, nav));
  }

  V2.form = { render: render };
})();
