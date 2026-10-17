// Tabs + settings page.
var V2 = (globalThis.V2 = globalThis.V2 || {});

(function () {
  var h = V2.ui.h;
  qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];

  var TABS = { scout: 'Match', pit: 'Pit', data: 'Data', settings: 'Settings' };

  function settingsPage(root) {
    var s = V2.ui.get('settings', {});
    function save() { V2.ui.set('settings', s); }
    var csv = h('textarea', { id: 'sched', rows: 4, placeholder: 'match,R1,R2,R3,B1,B2,B3\n1,254,1678,971,118,148,2056' });
    var sch = (V2.ui.get('schedule', {})[s.event] || []).length;
    root.appendChild(h('div', { class: 'settings' },
      h('h2', null, 'Settings'),
      h('section', { class: 'card' },
        h('label', { class: 'iname', for: 'set-ev' }, 'Event key'),
        h('input', { id: 'set-ev', value: s.event || '', placeholder: '2026txhou', oninput: function (e) { s.event = e.target.value.trim().toLowerCase(); save(); } }),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', id: 'set-flip', checked: !!s.flip, onchange: function (e) { s.flip = e.target.checked; save(); } }),
          ' Flip the field map (our alliance on the right, as seen from your seat)')),
      h('section', { class: 'card' },
        h('h3', null, 'Match schedule'),
        h('p', { class: 'muted' }, sch ? sch + ' matches loaded for ' + s.event + '. Team numbers fill in from the station.' : 'Paste the schedule so team numbers fill in automatically.'),
        csv,
        h('button', { type: 'button', class: 'btn', onclick: function () {
          var rows = [];
          csv.value.split(/\r?\n/).forEach(function (l) {
            var c = l.split(/[,\t;]/).map(function (x) { return x.trim(); });
            if (c.length < 7 || !/^\d+$/.test(c[0])) return;
            rows.push({ m: Number(c[0]), R1: +c[1], R2: +c[2], R3: +c[3], B1: +c[4], B2: +c[5], B3: +c[6] });
          });
          if (!s.event) return V2.ui.toast('Set the event key first', 'err');
          if (!rows.length) return V2.ui.toast('No matches found. Format: match,R1,R2,R3,B1,B2,B3', 'err');
          var all = V2.ui.get('schedule', {});
          all[s.event] = rows;
          V2.ui.set('schedule', all);
          V2.ui.toast(rows.length + ' matches loaded', 'ok');
          root.textContent = '';
          settingsPage(root);
        } }, 'Load schedule')),
      h('p', { class: 'muted small' }, 'REBUILT Scout v2 · ' + V2.CONFIG.season + ' · fields are defined in js/config.js')
    ));
  }

  function route() {
    var tab = location.hash.replace('#', '');
    if (!TABS[tab]) tab = 'scout';
    document.querySelectorAll('.tabs a').forEach(function (a) { a.classList.toggle('on', a.getAttribute('href') === '#' + tab); });
    var root = document.getElementById('app');
    root.textContent = '';
    if (tab === 'scout') V2.form.render(root, 'match');
    else if (tab === 'pit') V2.form.render(root, 'pit');
    else if (tab === 'data') V2.data.render(root);
    else settingsPage(root);
  }

  var nav = document.getElementById('tabs');
  Object.keys(TABS).forEach(function (k) { nav.appendChild(h('a', { href: '#' + k }, TABS[k])); });
  window.addEventListener('hashchange', route);
  route();
})();
