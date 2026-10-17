// Pit 记录：练习日逐队采集机器人信息和照片（参考 1678 Pit Collection）。
var SC = (globalThis.SC = globalThis.SC || {});
SC.views = SC.views || {};

(function () {
  var h, chips;
  var root = null;
  var cur = null; // 正在编辑的队伍

  function ev() {
    return SC.store.settings().event;
  }
  function pitOf(tm) {
    return SC.store.list('p', ev()).filter(function (p) { return Number(p.tm) === Number(tm); })[0];
  }
  function status(p) {
    if (!p) return 'none';
    var need = SC.GAME.pitFields.filter(function (f) { return f.key !== 'notes'; });
    var have = need.filter(function (f) { var v = p.d && p.d[f.key]; return v != null && v !== '' && !(Array.isArray(v) && !v.length); });
    return have.length === need.length ? 'done' : 'part';
  }

  function render() {
    root.textContent = '';
    root.appendChild(cur ? formView() : listView());
  }

  function listView() {
    var teams = SC.store.schedule(ev()).teams.slice();
    SC.store.list('p', ev()).forEach(function (p) { if (teams.indexOf(Number(p.tm)) < 0) teams.push(Number(p.tm)); });
    teams.sort(function (a, b) { return a - b; });
    var add = h('input', { type: 'number', inputmode: 'numeric', placeholder: 'Team' });
    var done = teams.filter(function (t) { return status(pitOf(t)) === 'done'; }).length;
    return h('section', null,
      h('h2', null, 'Pit scouting · ' + (ev() || 'no event set')),
      h('p', { class: 'muted' }, 'Green = done, blue = partly done. ' + (teams.length ? done + ' / ' + teams.length + ' done' : 'Sync TBA in Settings to list every team.')),
      h('div', { class: 'row' }, add, h('button', { class: 'btn', onclick: function () { if (Number(add.value) > 0) open(Number(add.value)); } }, 'Scout this team')),
      h('div', { class: 'teamgrid' }, teams.map(function (t) {
        return h('button', { class: 'tchip ' + status(pitOf(t)), onclick: function () { open(t); } }, t);
      }))
    );
  }

  function open(tm) {
    if (!ev()) return SC.ui.toast('Set the event key in Settings first', 'err');
    var p = pitOf(tm);
    cur = p ? JSON.parse(JSON.stringify(p)) : { k: 'p', ev: ev(), tm: tm, sc: SC.store.settings().scout, ts: 0, d: {} };
    render();
  }

  function input(f, d) {
    var v = d[f.key];
    if (f.type === 'number') return h('input', { type: 'number', inputmode: 'decimal', value: v == null ? '' : v, oninput: function (e) { d[f.key] = e.target.value === '' ? null : Number(e.target.value); } });
    if (f.type === 'text') return h('textarea', { rows: 2, value: v || '', oninput: function (e) { d[f.key] = e.target.value; } });
    if (f.type === 'bool') return chips([{ value: 1, label: 'Yes' }, { value: 0, label: 'No' }], v === true ? 1 : v === false ? 0 : '', function (x) { d[f.key] = x === 1; render(); });
    if (f.type === 'select') return chips(f.options, v || '', function (x) { d[f.key] = d[f.key] === x ? null : x; render(); });
    if (f.type === 'multi') {
      var arr = v || [];
      return h('div', { class: 'chips' }, f.options.map(function (o) {
        var on = arr.indexOf(o) >= 0;
        return h('button', { type: 'button', class: 'chip' + (on ? ' on' : ''), onclick: function () {
          d[f.key] = on ? arr.filter(function (x) { return x !== o; }) : arr.concat([o]);
          render();
        } }, o);
      }));
    }
  }

  function photoSlot(slot, label) {
    var key = cur.ev + '|' + cur.tm + '|' + slot;
    var img = h('img', { class: 'photo', alt: label });
    SC.photos.get(key).then(function (u) { if (u) img.src = u; }).catch(function () {});
    var file = h('input', { type: 'file', accept: 'image/*', capture: 'environment', style: { display: 'none' }, onchange: function (e) {
      var f = e.target.files[0];
      if (!f) return;
      SC.ui.shrinkImage(f).then(function (u) {
        img.src = u;
        return SC.photos.put(key, u);
      }).then(function () { SC.ui.toast(label + ' saved'); }, function () { SC.ui.toast('Could not save the photo', 'err'); });
    } });
    return h('div', { class: 'photobox' }, img, file, h('button', { class: 'btn small', onclick: function () { file.click(); } }, 'Take ' + label));
  }

  function formView() {
    var d = cur.d;
    return h('section', { class: 'card' },
      h('div', { class: 'row between' }, h('h2', null, 'Pit · ' + cur.tm), h('button', { class: 'btn small', onclick: function () { cur = null; render(); } }, '← Team list')),
      SC.GAME.pitFields.map(function (f) { return SC.ui.field(f.label, input(f, d)); }),
      h('div', { class: 'row' }, photoSlot('full', 'full photo'), photoSlot('side', 'side photo')),
      h('button', { class: 'btn primary big', onclick: save }, 'Save and show QR code')
    );
  }

  function save() {
    cur.ts = Date.now();
    SC.store.put(cur);
    SC.store.addMine(SC.store.recordKey(cur));
    var text = SC.codec.encode(cur);
    root.textContent = '';
    root.appendChild(h('section', { class: 'card center' },
      h('h2', null, 'Pit · ' + cur.tm + ' saved'),
      SC.ui.qr(text),
      h('p', { class: 'muted' }, 'Photos are not in the QR code. Export JSON (with photos) from the Data page to send them.'),
      h('button', { class: 'btn primary big', onclick: function () { cur = null; render(); } }, 'Back to list')
    ));
  }

  SC.views.pit = function (el) {
    h = SC.ui.h;
    chips = SC.ui.chips;
    root = el;
    render();
  };
})();
