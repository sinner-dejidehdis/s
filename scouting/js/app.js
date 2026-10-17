// 路由 + 启动。
var SC = (globalThis.SC = globalThis.SC || {});

(function () {
  qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];

  var ROUTES = {
    match: { label: '比赛', group: '记录' },
    subj: { label: '主观', group: '记录' },
    pit: { label: 'Pit', group: '记录' },
    data: { label: '数据', group: '汇总' },
    teams: { label: '队伍', group: '分析' },
    pick: { label: '选人', group: '分析' },
    predict: { label: '预测', group: '分析' },
    settings: { label: '设置', group: '' },
  };
  var current = null;

  function route() {
    var hash = location.hash.replace(/^#/, '') || 'match';
    var parts = hash.split('/');
    var name = ROUTES[parts[0]] || parts[0] === 'team' ? parts[0] : 'match'; // (已知路由或 team/N) 否则回比赛页
    if (current === 'data' && name !== 'data' && SC.views.dataLeave) SC.views.dataLeave();
    current = name;

    document.querySelectorAll('nav a').forEach(function (a) {
      a.classList.toggle('on', a.getAttribute('href') === '#' + (name === 'team' ? 'teams' : name));
    });
    var el = document.getElementById('view');
    el.textContent = '';
    window.scrollTo(0, 0);
    if (name === 'team') SC.views.team(el, Number(parts[1]));
    else SC.views[name](el);
  }

  function nav() {
    var h = SC.ui.h;
    var n = document.getElementById('nav');
    Object.keys(ROUTES).forEach(function (k) {
      n.appendChild(h('a', { href: '#' + k, class: 'g-' + (ROUTES[k].group || 'none') }, ROUTES[k].label));
    });
  }

  window.addEventListener('hashchange', route);
  window.addEventListener('beforeunload', function (e) {
    if (SC.views.matchActive && SC.views.matchActive()) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  nav();
  var s = SC.store.settings();
  if (!s.scout || !s.event) location.hash = '#settings';
  route();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
})();
