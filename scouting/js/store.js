// 本地存储：记录用 localStorage，照片用 IndexedDB。
var SC = (globalThis.SC = globalThis.SC || {});

(function () {
  var PREFIX = 'frcscout.v1.';
  var mem = {}; // localStorage 不可用时（如隐私模式）退回内存

  function lsGet(k, def) {
    try {
      var v = localStorage.getItem(PREFIX + k);
      return v == null ? def : JSON.parse(v);
    } catch (e) {
      return k in mem ? mem[k] : def;
    }
  }
  function lsSet(k, v) {
    mem[k] = v;
    try {
      localStorage.setItem(PREFIX + k, JSON.stringify(v));
    } catch (e) {
      /* 内存兜底 */
    }
  }

  function recordKey(r) {
    if (r.k === 'm') return ['m', r.ev, r.mt, r.tm, r.sc].join('|');
    if (r.k === 's') return ['s', r.ev, r.mt, r.al, r.sc].join('|');
    if (r.k === 'p') return ['p', r.ev, r.tm].join('|');
    return 'x|' + r.ts;
  }

  SC.store = {
    recordKey: recordKey,

    settings: function () {
      return Object.assign(
        {
          event: '',
          tbaKey: '',
          scout: '',
          station: 'R1',
          flip: false,
          askFuel: true,
          calibrate: true,
        },
        lsGet('settings', {})
      );
    },
    saveSettings: function (s) {
      lsSet('settings', s);
    },

    records: function () {
      return lsGet('records', {});
    },
    // 合并一条记录；同 key 保留更新的（ts 大的）。返回 'new' | 'updated' | 'same'
    put: function (r) {
      var all = this.records();
      var key = recordKey(r);
      var old = all[key];
      var res = !old ? 'new' : (r.ts || 0) > (old.ts || 0) ? 'updated' : 'same';
      if (res !== 'same') {
        all[key] = r;
        lsSet('records', all);
      }
      return res;
    },
    remove: function (key) {
      var all = this.records();
      delete all[key];
      lsSet('records', all);
    },
    list: function (kind, ev) {
      var all = this.records();
      return Object.keys(all)
        .map(function (k) {
          return all[k];
        })
        .filter(function (r) {
          return (!kind || r.k === kind) && (!ev || r.ev === ev);
        });
    },
    clearAll: function () {
      lsSet('records', {});
      lsSet('mine', []);
    },

    // 本机生成过的记录 key（用于"历史二维码"）
    mine: function () {
      return lsGet('mine', []);
    },
    addMine: function (key) {
      var m = this.mine().filter(function (k) {
        return k !== key;
      });
      m.unshift(key);
      lsSet('mine', m.slice(0, 300));
    },

    // 赛程：{ ev: { teams: [..], matches: [{mt, R1..B3}] } }
    schedule: function (ev) {
      return lsGet('schedule', {})[ev] || { teams: [], matches: [] };
    },
    saveSchedule: function (ev, sch) {
      var all = lsGet('schedule', {});
      all[ev] = sch;
      lsSet('schedule', all);
    },

    // TBA 比赛结果（score_breakdown 精简后）：{ ev: { 'qm12': {...} } }
    tbaResults: function (ev) {
      return lsGet('tba', {})[ev] || {};
    },
    saveTbaResults: function (ev, res) {
      var all = lsGet('tba', {});
      all[ev] = res;
      lsSet('tba', all);
    },

    // 选人名单：{ ev: { order: [team...], dnp: {team:true}, picked: {team:true}, weights: {...} } }
    picklist: function (ev) {
      return Object.assign({ order: [], dnp: {}, picked: {}, weights: null }, lsGet('picklist', {})[ev] || {});
    },
    savePicklist: function (ev, pl) {
      var all = lsGet('picklist', {});
      all[ev] = pl;
      lsSet('picklist', all);
    },
  };

  // ---------- 照片（IndexedDB） ----------
  var dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise(function (res, rej) {
      if (typeof indexedDB === 'undefined') return rej(new Error('no indexedDB'));
      var req = indexedDB.open('frcscout-photos', 1);
      req.onupgradeneeded = function () {
        req.result.createObjectStore('photos');
      };
      req.onsuccess = function () {
        res(req.result);
      };
      req.onerror = function () {
        rej(req.error);
      };
    });
    return dbp;
  }
  function tx(mode, fn) {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var t = d.transaction('photos', mode);
        var out = fn(t.objectStore('photos'));
        t.oncomplete = function () {
          res(out && out.result);
        };
        t.onerror = function () {
          rej(t.error);
        };
      });
    });
  }

  SC.photos = {
    // key: ev|team|slot
    put: function (key, dataUrl) {
      return tx('readwrite', function (s) {
        s.put(dataUrl, key);
      });
    },
    get: function (key) {
      return tx('readonly', function (s) {
        return s.get(key);
      });
    },
    all: function () {
      return db().then(function (d) {
        return new Promise(function (res, rej) {
          var out = {};
          var req = d.transaction('photos').objectStore('photos').openCursor();
          req.onsuccess = function () {
            var c = req.result;
            if (!c) return res(out);
            out[c.key] = c.value;
            c.continue();
          };
          req.onerror = function () {
            rej(req.error);
          };
        });
      });
    },
  };
})();
