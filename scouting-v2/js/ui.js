// DOM helpers and local storage. User text always goes through textContent.
var V2 = (globalThis.V2 = globalThis.V2 || {});

(function () {
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v == null || v === false) return;
        if (k === 'class') el.className = v;
        else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
        else if (k === 'value') el.value = v;
        else if (k === 'checked') el.checked = !!v;
        else el.setAttribute(k, v === true ? '' : v);
      });
    }
    (function add(kids) {
      kids.forEach(function (c) {
        if (c == null || c === false) return;
        if (Array.isArray(c)) return add(c);
        el.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
      });
    })(Array.prototype.slice.call(arguments, 2));
    return el;
  }

  var P = 'rbscout.v2.';
  var mem = {};
  function get(k, d) {
    try {
      var v = localStorage.getItem(P + k);
      return v == null ? d : JSON.parse(v);
    } catch (e) {
      return k in mem ? mem[k] : d;
    }
  }
  function set(k, v) {
    mem[k] = v;
    try { localStorage.setItem(P + k, JSON.stringify(v)); } catch (e) { /* memory only */ }
  }

  var tt = null;
  function toast(msg, kind) {
    var el = document.getElementById('toast');
    el.textContent = msg;
    el.className = 'toast show ' + (kind || '');
    clearTimeout(tt);
    tt = setTimeout(function () { el.className = 'toast'; }, 2400);
  }

  function qr(text) {
    var q = qrcode(0, 'L');
    q.addData(text, 'Byte');
    q.make();
    var box = h('div', { class: 'qr' });
    box.innerHTML = q.createSvgTag({ cellSize: 4, margin: 4, scalable: true }); // library-generated SVG only
    return box;
  }

  function copy(text) {
    var p = navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject();
    return p.then(function () { toast('Copied', 'ok'); }, function () { toast('Copy failed. Select the text and copy it manually.', 'err'); });
  }

  // In-page confirm (window.confirm is blocked in embedded viewers)
  function ask(msg, ok) {
    return new Promise(function (res) {
      var box = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' },
        h('div', { class: 'modal-card' }, h('p', null, msg),
          h('div', { class: 'row between' },
            h('button', { type: 'button', class: 'btn', onclick: function () { box.remove(); res(false); } }, 'Cancel'),
            h('button', { type: 'button', class: 'btn danger', onclick: function () { box.remove(); res(true); } }, ok || 'OK'))));
      document.body.appendChild(box);
    });
  }

  V2.ui = { h: h, get: get, set: set, toast: toast, qr: qr, copy: copy, ask: ask };
})();
