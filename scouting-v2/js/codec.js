// One tab-separated row per record, so a USB scanner can type it straight into a spreadsheet.
// Column 1 is a format tag; the rest follow the field order in config.js.
var V2 = (globalThis.V2 = globalThis.V2 || {});

(function () {
  // Bump the tag whenever columns change, so rows from an older build are rejected
  var TAGS = { match: 'RB26M3', pit: 'RB26P3' };

  function fields(kind) {
    var out = [];
    V2.CONFIG[kind].forEach(function (p) {
      p.fields.forEach(function (f) { out.push(f); });
    });
    return out;
  }

  function clean(s) {
    return String(s == null ? '' : s).replace(/[\t\r\n]+/g, ' ').trim();
  }

  function cell(f, v) {
    if (f.type === 'event') return clean(v || V2.CONFIG.event);
    if (v == null || v === '') return '';
    switch (f.type) {
      case 'bool': return v ? '1' : '0';
      case 'multi': return Object.keys(f.choices).filter(function (k) { return v.indexOf(k) >= 0; }).join('');
      case 'field': return v.map(function (p) { return p[0] + ',' + p[1]; }).join(';');
      case 'timer': return String(Math.round(v * 10) / 10);
      default: return clean(v);
    }
  }

  function parseCell(f, s) {
    if (s === '' || s == null) return f.type === 'bool' ? false : f.type === 'multi' || f.type === 'field' ? [] : null;
    switch (f.type) {
      case 'bool': return s === '1';
      case 'rating': return s === 'n' ? 'n' : Number(s);
      case 'counter': case 'number': case 'match': case 'team': case 'timer': return Number(s);
      case 'multi': return s.split('');
      case 'field': return s.split(';').map(function (p) { return p.split(',').map(Number); });
      default: return s;
    }
  }

  V2.codec = {
    TAGS: TAGS,
    fields: fields,
    header: function (kind) {
      return ['fmt'].concat(fields(kind).map(function (f) { return f.name; })).join('\t');
    },
    encode: function (kind, values) {
      return [TAGS[kind]].concat(fields(kind).map(function (f) { return cell(f, values[f.code]); })).join('\t');
    },
    // Returns { kind, values } or null when the row is not one of ours
    decode: function (row) {
      var cols = String(row).replace(/\r?\n$/, '').split('\t');
      var kind = Object.keys(TAGS).filter(function (k) { return TAGS[k] === cols[0].trim(); })[0];
      if (!kind) return null;
      var fs = fields(kind);
      if (cols.length !== fs.length + 1) return null;
      var values = {};
      fs.forEach(function (f, i) { values[f.code] = parseCell(f, cols[i + 1]); });
      return { kind: kind, values: values };
    },
    // Groups rows into QR-sized blocks (one row per line). Rows are never split, so a USB scanner
    // that presses Enter after each line imports every row whole. A small limit keeps each code
    // sparse enough to scan quickly off a phone screen.
    chunk: function (rows, maxChars) {
      maxChars = maxChars || 650;
      var out = [], cur = [], len = 0;
      rows.forEach(function (r) {
        if (cur.length && len + r.length + 1 > maxChars) {
          out.push(cur.join('\n'));
          cur = [];
          len = 0;
        }
        cur.push(r);
        len += r.length + 1;
      });
      if (cur.length) out.push(cur.join('\n'));
      return out;
    },
    // Key that identifies a record, so re-scanning the same QR does not duplicate it
    key: function (kind, v) {
      return kind === 'pit' ? ['p', v.e, v.t].join('|') : ['m', v.e, v.l, v.m, v.t, v.s].join('|');
    },
  };
})();
