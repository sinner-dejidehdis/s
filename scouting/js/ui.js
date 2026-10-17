// 小型 DOM 工具。用户输入的文字一律走 textContent，不拼 HTML。
var SC = (globalThis.SC = globalThis.SC || {});

(function () {
  function h(tag, attrs) {
    var el = document.createElement(tag);
    var kids = Array.prototype.slice.call(arguments, 2);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v == null || v === false) return;
        if (k === 'class') el.className = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
        else if (k === 'value') el.value = v;
        else if (k === 'checked') el.checked = !!v;
        else el.setAttribute(k, v === true ? '' : v);
      });
    }
    append(el, kids);
    return el;
  }
  function append(el, kids) {
    kids.forEach(function (c) {
      if (c == null || c === false) return;
      if (Array.isArray(c)) return append(el, c);
      el.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
    });
  }

  // 单选 chip 组
  function chips(options, value, onPick, cls) {
    return h(
      'div',
      { class: 'chips ' + (cls || '') },
      options.map(function (o) {
        var val = typeof o === 'object' ? o.value : o;
        var label = typeof o === 'object' ? o.label : o;
        return h(
          'button',
          {
            type: 'button',
            class: 'chip' + (String(val) === String(value) ? ' on' : ''),
            onclick: function () {
              onPick(val);
            },
          },
          label
        );
      })
    );
  }

  var toastTimer = null;
  function toast(msg, kind) {
    var el = document.getElementById('toast');
    el.textContent = msg;
    el.className = 'toast show ' + (kind || '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.className = 'toast';
    }, 2600);
  }

  function qr(text) {
    var q = qrcode(0, 'L');
    q.addData(text, 'Byte');
    q.make();
    var box = h('div', { class: 'qr' });
    box.innerHTML = q.createSvgTag({ cellSize: 4, margin: 4, scalable: true }); // 库生成的 SVG，不含用户文字
    return box;
  }

  function download(name, text, type) {
    var blob = new Blob([text], { type: type || 'text/plain' });
    var a = h('a', { href: URL.createObjectURL(blob), download: name });
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 1000);
  }

  function readFile(file) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () {
        res(r.result);
      };
      r.onerror = function () {
        rej(r.error);
      };
      r.readAsText(file);
    });
  }

  // 压缩照片到最长边 900px 的 JPEG
  function shrinkImage(file) {
    return new Promise(function (res, rej) {
      var img = new Image();
      img.onload = function () {
        var s = Math.min(1, 900 / Math.max(img.width, img.height));
        var c = document.createElement('canvas');
        c.width = Math.round(img.width * s);
        c.height = Math.round(img.height * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(img.src);
        res(c.toDataURL('image/jpeg', 0.75));
      };
      img.onerror = rej;
      img.src = URL.createObjectURL(file);
    });
  }

  function field(label, input, hint) {
    return h('label', { class: 'field' }, h('span', { class: 'flabel' }, label), input, hint ? h('small', { class: 'muted' }, hint) : null);
  }

  function fmt(v, d) {
    if (v == null || (typeof v === 'number' && isNaN(v))) return '–';
    if (typeof v === 'number') return SC.analysis.round(v, d == null ? 1 : d);
    return v;
  }
  function pct(v) {
    return v == null ? '–' : Math.round(v * 100) + '%';
  }

  SC.ui = { h: h, chips: chips, toast: toast, qr: qr, download: download, readFile: readFile, shrinkImage: shrinkImage, field: field, fmt: fmt, pct: pct };
})();
