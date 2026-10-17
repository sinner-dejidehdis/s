// Our own schematic of one alliance's half of the REBUILT field (not to scale).
// Coordinates are stored 0–99 across (x: our wall → center line) and 0–99 down.
var V2 = (globalThis.V2 = globalThis.V2 || {});

(function () {
  var W = 100, H = 60;

  function css(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888';
  }

  function drawField(ctx, cw, ch, flip) {
    var sx = cw / W, sy = ch / H;
    function X(x) { return (flip ? W - x : x) * sx; }
    function rect(x, y, w, h, fill, label) {
      var x0 = flip ? X(x + w) : X(x);
      ctx.fillStyle = fill;
      ctx.fillRect(x0, y * sy, w * sx, h * sy);
      if (label) {
        ctx.fillStyle = css('--ink-2');
        ctx.font = Math.max(10, 3 * sy) + 'px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, x0 + (w * sx) / 2, (y + h / 2) * sy);
      }
    }
    ctx.clearRect(0, 0, cw, ch);
    rect(0, 0, 48, H, css('--zone-us'));
    rect(52, 0, 48, H, css('--zone-mid'));
    rect(0, 0, 3, H, css('--wall'));
    rect(3, 25, 7, 10, css('--fixture'), 'Tower');
    rect(3, 46, 9, 11, css('--fixture'), 'Depot');
    rect(3, 3, 6, 9, css('--fixture'), 'Outpost');
    rect(48, 0, 4, 11, css('--trench'), '');
    rect(48, 49, 4, 11, css('--trench'), '');
    rect(48, 14, 4, 11, css('--bump'), '');
    rect(48, 35, 4, 11, css('--bump'), '');
    rect(46, 26, 8, 8, css('--hub'), 'Hub');
    ctx.fillStyle = css('--ink-2');
    ctx.font = Math.max(10, 2.6 * sy) + 'px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Our alliance zone', X(24), 4 * sy);
    ctx.fillText('Neutral zone', X(76), 4 * sy);
    ctx.fillText('Trench', X(50), 8.5 * sy);
    ctx.fillText('Bump', X(50), 19.5 * sy);
  }

  function dot(ctx, cw, ch, p, flip, color, r) {
    var x = ((flip ? 99 - p[0] : p[0]) / 99) * cw;
    var y = (p[1] / 99) * ch;
    ctx.beginPath();
    ctx.arc(x, y, r || 7, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = css('--surface');
    ctx.stroke();
  }

  // Interactive picker. mode: 'single' | 'multi'. Calls onChange(points).
  function picker(points, mode, flip, onChange) {
    var h = V2.ui.h;
    var canvas = h('canvas', { class: 'fieldcanvas', role: 'img', 'aria-label': 'Field map, tap to mark a spot' });
    function paint() {
      var cw = canvas.clientWidth || 340;
      var ch = Math.round(cw * (H / W));
      var dpr = window.devicePixelRatio || 1;
      canvas.width = cw * dpr;
      canvas.height = ch * dpr;
      canvas.style.height = ch + 'px';
      var ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawField(ctx, cw, ch, flip);
      points.forEach(function (p, i) { dot(ctx, cw, ch, p, flip, css('--accent'), mode === 'multi' ? 6 : 9); });
      count.textContent = mode === 'multi' ? points.length + ' marked' : points.length ? 'Marked' : 'Tap the field';
    }
    canvas.addEventListener('click', function (e) {
      var b = canvas.getBoundingClientRect();
      var x = Math.round(((e.clientX - b.left) / b.width) * 99);
      var y = Math.round(((e.clientY - b.top) / b.height) * 99);
      if (flip) x = 99 - x;
      if (mode === 'single') points.splice(0, points.length, [x, y]);
      else points.push([x, y]);
      onChange(points);
      paint();
    });
    var count = h('small', { class: 'muted' });
    var undo = h('button', { type: 'button', class: 'btn small', onclick: function () { points.pop(); onChange(points); paint(); } }, 'Undo spot');
    var wrap = h('div', { class: 'fieldwrap' }, canvas, h('div', { class: 'row between' }, count, undo));
    function onResize() {
      if (!document.body.contains(canvas)) return window.removeEventListener('resize', onResize);
      paint();
    }
    setTimeout(paint, 0);
    window.addEventListener('resize', onResize);
    return wrap;
  }

  // Static heat map for the data page. sets: [{points, color}]
  function heat(sets, flip) {
    var canvas = V2.ui.h('canvas', { class: 'fieldcanvas', role: 'img', 'aria-label': 'Shooting spots' });
    setTimeout(function () {
      var cw = canvas.clientWidth || 340;
      var ch = Math.round(cw * (H / W));
      var dpr = window.devicePixelRatio || 1;
      canvas.width = cw * dpr;
      canvas.height = ch * dpr;
      canvas.style.height = ch + 'px';
      var ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawField(ctx, cw, ch, flip);
      ctx.globalAlpha = 0.65;
      sets.forEach(function (s) { s.points.forEach(function (p) { dot(ctx, cw, ch, p, flip, s.color, 6); }); });
      ctx.globalAlpha = 1;
    }, 0);
    return canvas;
  }

  V2.field = { picker: picker, heat: heat, css: css };
})();
