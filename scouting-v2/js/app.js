// Tabs + settings page.
var V2 = (globalThis.V2 = globalThis.V2 || {});

(function () {
  var h = V2.ui.h;
  qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];

  var TABS = { scout: 'Match', pit: 'Pit', data: 'Data' };

  // Schedule + field-map setting, shown on the Data tab for the scouting lead
  function scheduleCard(redraw) {
    var s = V2.ui.get('settings', {});
    var csv = h('textarea', { id: 'sched', rows: 4, placeholder: 'date,match,R1,R2,R3,B1,B2,B3\n2026-10-24,1,254,1678,971,118,148,2056\n(the date column is optional)' });
    var ev = V2.CONFIG.event;
    var sch = (V2.ui.get('schedule', {})[ev] || []).length;
    return h('section', { class: 'card c-sched' },
      h('h3', null, 'Match schedule'),
      h('p', { class: 'muted' }, sch ? sch + ' matches loaded. Date + match number pick the teams on the Match tab.' : 'Paste the schedule so the Match tab shows each match\'s team numbers.'),
      csv,
      h('button', { type: 'button', class: 'btn', onclick: function () {
        var rows = [];
        csv.value.split(/\r?\n/).forEach(function (l) {
          var c = l.split(/[,\t;]/).map(function (x) { return x.trim(); });
          var d = '';
          if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(c[0])) { // optional date column first: 2026-10-24
            var p = c.shift().split('-');
            d = p[0] + '-' + ('0' + p[1]).slice(-2) + '-' + ('0' + p[2]).slice(-2);
          }
          if (c.length < 7 || !/^\d+$/.test(c[0])) return;
          rows.push({ d: d, m: Number(c[0]), R1: +c[1], R2: +c[2], R3: +c[3], B1: +c[4], B2: +c[5], B3: +c[6] });
        });
        if (!rows.length) return V2.ui.toast('No matches found. Format: date,match,R1,R2,R3,B1,B2,B3 (date optional)', 'err');
        var all = V2.ui.get('schedule', {});
        all[ev] = rows;
        V2.ui.set('schedule', all);
        V2.ui.toast(rows.length + ' matches loaded', 'ok');
        redraw();
      } }, 'Load schedule'),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', id: 'set-flip', checked: !!s.flip, onchange: function (e) { s.flip = e.target.checked; V2.ui.set('settings', s); } }),
        ' Flip the field map (our alliance on the right, as seen from your seat)'));
  }

  var OFFLINE_FILE = 'rebuilt-scout-v2-offline.html';

  // One-file copy of the whole app that runs from the device's storage with no network
  function offlineCard() {
    if (V2.OFFLINE_BUILD) {
      return h('section', { class: 'card c-offline' }, h('h3', null, 'Offline copy'),
        h('p', { class: 'muted' }, 'You are using the offline file. It needs no internet. Keep it on this device and open it from the same place each time, so your records stay with it.'));
    }
    var status = h('small', { class: 'muted' });
    var btn = h('button', { type: 'button', class: 'btn primary', onclick: function () {
      status.textContent = 'Preparing…';
      fetch(OFFLINE_FILE).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      }).then(function (html) {
        var viaClaude = globalThis.claude && typeof claude.use === 'function' ? claude.use('downloads') : Promise.resolve(null);
        return viaClaude.then(function (d) {
          if (d) return d.save({ filename: OFFLINE_FILE, data: html }).then(function () { status.textContent = 'Saved.'; });
          var a = h('a', { href: URL.createObjectURL(new Blob([html], { type: 'text/html' })), download: OFFLINE_FILE });
          document.body.appendChild(a);
          a.click();
          setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
          status.textContent = 'Downloaded. Open the file in Chrome or Edge.';
        });
      }).catch(function (e) {
        status.textContent = 'Could not download: ' + e.message;
      });
    } }, 'Download offline file');
    return h('section', { class: 'card c-offline' }, h('h3', null, 'Offline copy'),
      h('p', { class: 'muted' }, 'One HTML file with the whole app. Save it to a phone, tablet or laptop and open it in a browser with no internet. ' +
        (navigator.serviceWorker && location.protocol.indexOf('http') === 0 ? 'This page also keeps working offline after you have opened it once.' : '')),
      h('div', { class: 'row wrap' }, btn, status));
  }

  function route() {
    if (V2.data.stopCamera) V2.data.stopCamera();
    var tab = location.hash.replace('#', '');
    if (!TABS[tab]) tab = 'scout';
    document.querySelectorAll('.tabs a').forEach(function (a) { a.classList.toggle('on', a.getAttribute('href') === '#' + tab); });
    document.body.setAttribute('data-tab', tab); // desktop layout differs per tab
    var root = document.getElementById('app');
    root.textContent = '';
    if (tab === 'scout') V2.form.render(root, 'match');
    else if (tab === 'pit') V2.form.render(root, 'pit');
    else V2.data.render(root);
  }

  V2.setup = { scheduleCard: scheduleCard, offlineCard: offlineCard };

  var T = V2.CONFIG.team;
  document.getElementById('teamname').textContent = T.name;
  document.getElementById('teamsub').textContent = 'FRC ' + T.number + ' · REBUILT Scout';
  document.getElementById('eventchip').textContent = V2.CONFIG.event;
  // Team logo (the offline file carries it inline as V2.LOGO_SRC); fall back to the seismograph mark
  var logoSrc = V2.LOGO_SRC || T.logo;
  if (V2.LOGO_SRC) document.head.appendChild(h('link', { rel: 'icon', href: V2.LOGO_SRC }));
  document.getElementById('mark').appendChild(logoSrc
    ? h('img', { src: logoSrc, alt: T.name + ' logo', class: 'teamlogo', width: 44, height: 44 })
    : V2.quake.mark());
  V2.quake.strip(document.getElementById('quake'));

  var nav = document.getElementById('tabs');
  Object.keys(TABS).forEach(function (k) { nav.appendChild(h('a', { href: '#' + k }, TABS[k])); });
  window.addEventListener('hashchange', route);
  route();

  if (!V2.OFFLINE_BUILD && 'serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    navigator.serviceWorker.register('sw.js').catch(function () { /* not allowed here: online only */ });
  }
})();
