// 二维码 / 文本载荷编码。格式：FRCS1 + JSON（短键名，紧凑）。
var SC = (globalThis.SC = globalThis.SC || {});

(function () {
  var TAG = 'FRCS1';

  SC.codec = {
    encode: function (rec) {
      return TAG + JSON.stringify(rec);
    },
    // 解析一段文本，里面可以有多条载荷（扫码枪每条一行，或 JSON 备份）
    decodeMany: function (text) {
      var out = [];
      var errors = 0;
      String(text || '')
        .split(/\r?\n/)
        .forEach(function (line) {
          line = line.trim();
          if (!line) return;
          var i = line.indexOf(TAG);
          if (i < 0) {
            errors++;
            return;
          }
          try {
            var r = JSON.parse(line.slice(i + TAG.length));
            if (SC.codec.valid(r)) out.push(r);
            else errors++;
          } catch (e) {
            errors++;
          }
        });
      return { records: out, errors: errors };
    },
    valid: function (r) {
      if (!r || typeof r !== 'object' || !r.ev) return false;
      if (r.k === 'm') return Number(r.mt) > 0 && Number(r.tm) > 0 && Array.isArray(r.a);
      if (r.k === 's') return Number(r.mt) > 0 && Array.isArray(r.teams);
      if (r.k === 'p') return Number(r.tm) > 0;
      return false;
    },
  };
})();
