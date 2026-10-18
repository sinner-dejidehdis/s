// Our own schematic of one alliance's half of the REBUILT field (not to scale).
// Points are stored relative to the scouted robot's alliance: x 0–99 from its own wall to the
// center line, y 0–99 with that alliance's Outpost side at 0. The drawing turns 180° for the
// Blue alliance, because from a seat in the stands the Blue end is the Red end rotated.
var V2 = (globalThis.V2 = globalThis.V2 || {});

(function () {
  var W = 100, H = 60;

  function css(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888';
  }

  // alliance: 'r' | 'b' | '' (unknown). flip: the scout sits on the other side of the field.
  function rotated(alliance, flip) {
    return (alliance === 'b') !== !!flip;
  }

  function drawField(ctx, cw, ch, alliance, flip) {
    var sx = cw / W, sy = ch / H;
    var rot = rotated(alliance, flip);
    function box(x, y, w, h) {
      return rot ? [(W - x - w) * sx, (H - y - h) * sy, w * sx, h * sy] : [x * sx, y * sy, w * sx, h * sy];
    }
    function label(text, x, y, size) {
      var px = (rot ? W - x : x) * sx, py = (rot ? H - y : y) * sy;
      ctx.fillStyle = css('--ink-2');
      ctx.font = Math.max(10, (size || 3) * sy) + 'px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, px, py);
    }
    function rect(x, y, w, h, fill, text) {
      var b = box(x, y, w, h);
      ctx.fillStyle = fill;
      ctx.fillRect(b[0], b[1], b[2], b[3]);
      if (text) label(text, x + w / 2, y + h / 2);
    }
    ctx.clearRect(0, 0, cw, ch);
    var zone = alliance === 'r' ? '--zone-red' : alliance === 'b' ? '--zone-blue' : '--zone-us';
    rect(0, 0, 48, H, css(zone));
    rect(52, 0, 48, H, css('--zone-mid'));
    rect(0, 0, 3, H, css('--wall'));
    rect(3, 3, 6, 9, css('--fixture'), 'Outpost');
    rect(3, 25, 7, 10, css('--fixture'), 'Tower');
    rect(3, 46, 9, 11, css('--fixture'), 'Depot');
    rect(48, 0, 4, 11, css('--trench'), '');
    rect(48, 49, 4, 11, css('--trench'), '');
    rect(48, 14, 4, 11, css('--bump'), '');
    rect(48, 35, 4, 11, css('--bump'), '');
    rect(46, 26, 8, 8, css('--hub'), 'Hub');
    var name = alliance === 'r' ? 'Red alliance zone' : alliance === 'b' ? 'Blue alliance zone' : 'Alliance zone';
    label(name, 26, rot ? 56 : 4, 2.6);
    label('Neutral zone', 76, rot ? 56 : 4, 2.6);
    label('Trench', 50, 5.5, 2.4);
    label('Bump', 50, 19.5, 2.4);
  }

  function dot(ctx, cw, ch, p, rot, color, r) {
    var x = ((rot ? 99 - p[0] : p[0]) / 99) * cw;
    var y = ((rot ? 99 - p[1] : p[1]) / 99) * ch;
    ctx.beginPath();
    ctx.arc(x, y, r || 7, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = css('--surface');
    ctx.stroke();
  }

  function sized(canvas) {
    var cw = canvas.clientWidth || 340;
    var ch = Math.round(cw * (H / W));
    var dpr = window.devicePixelRatio || 1;
    canvas.width = cw * dpr;
    canvas.height = ch * dpr;
    canvas.style.height = ch + 'px';
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, cw: cw, ch: ch };
  }

  // Interactive picker. mode: 'single' | 'multi'. Calls onChange(points).
  function picker(points, mode, alliance, flip, onChange) {
    var h = V2.ui.h;
    var rot = rotated(alliance, flip);
    var canvas = h('canvas', { class: 'fieldcanvas', role: 'img', 'aria-label': 'Field map, tap to mark a spot' });
    var count = h('small', { class: 'muted' });
    function paint() {
      var c = sized(canvas);
      drawField(c.ctx, c.cw, c.ch, alliance, flip);
      points.forEach(function (p) { dot(c.ctx, c.cw, c.ch, p, rot, css('--accent'), mode === 'multi' ? 6 : 9); });
      count.textContent = !alliance ? 'Pick a station first so the map matches your alliance' :
        mode === 'multi' ? points.length + ' marked' : points.length ? 'Marked' : 'Tap the field';
    }
    canvas.addEventListener('click', function (e) {
      var b = canvas.getBoundingClientRect();
      var x = Math.round(((e.clientX - b.left) / b.width) * 99);
      var y = Math.round(((e.clientY - b.top) / b.height) * 99);
      if (rot) { x = 99 - x; y = 99 - y; }
      if (mode === 'single') points.splice(0, points.length, [x, y]);
      else points.push([x, y]);
      onChange(points);
      paint();
    });
    var undo = h('button', { type: 'button', class: 'btn small', onclick: function () { points.pop(); onChange(points); paint(); } }, 'Undo spot');
    function onResize() {
      if (!document.body.contains(canvas)) return window.removeEventListener('resize', onResize);
      paint();
    }
    setTimeout(paint, 0);
    window.addEventListener('resize', onResize);
    return h('div', { class: 'fieldwrap' }, canvas, h('div', { class: 'row between' }, count, undo));
  }

  // Heat map on the data page, drawn in the shared alliance-relative frame. sets: [{points, color}]
  function heat(sets) {
    var canvas = V2.ui.h('canvas', { class: 'fieldcanvas', role: 'img', 'aria-label': 'Shooting spots' });
    setTimeout(function () {
      var c = sized(canvas);
      drawField(c.ctx, c.cw, c.ch, '', false);
      c.ctx.globalAlpha = 0.65;
      sets.forEach(function (s) { s.points.forEach(function (p) { dot(c.ctx, c.cw, c.ch, p, false, s.color, 6); }); });
      c.ctx.globalAlpha = 1;
    }, 0);
    return canvas;
  }

  V2.field = { picker: picker, heat: heat, css: css, rotated: rotated };
})();
