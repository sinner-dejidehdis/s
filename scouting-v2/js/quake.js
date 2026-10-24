// Earthquakers visual motif: seismograph traces drawn as inline SVG.
// strip(): the live trace in the header, which jolts when a scout taps a counter.
// seismogram(): one match's Fuel by phase, drawn as a reading on the QR page.
var V2 = (globalThis.V2 = globalThis.V2 || {});

(function () {
  var NS = 'http://www.w3.org/2000/svg';
  var reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function svg(tag, attrs) {
    var el = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    return el;
  }

  // Deterministic noise so the trace looks the same on every load
  function noise(seed) {
    var s = seed;
    return function () {
      s = (s * 16807) % 2147483647;
      return s / 2147483647 - 0.5;
    };
  }

  // Points for a trace: quiet baseline with a few tremors, plus an optional quake at `at`
  function trace(width, height, seed, quake) {
    var rnd = noise(seed);
    var mid = height / 2;
    var pts = [];
    for (var x = 0; x <= width; x += 4) {
      var amp = 1.2;
      [0.18, 0.46, 0.71].forEach(function (c) { amp += 7 * Math.exp(-Math.pow((x / width - c) * 18, 2)); });
      if (quake) amp += quake.size * Math.exp(-Math.pow((x - quake.at) / 18, 2));
      pts.push(x + ',' + (mid + rnd() * amp * 2).toFixed(1));
    }
    return pts.join(' ');
  }

  var stripLine = null, stripW = 600, stripH = 28, joltTimer = null;

  function strip(host) {
    var el = svg('svg', { viewBox: '0 0 ' + stripW + ' ' + stripH, preserveAspectRatio: 'none', class: 'quake', 'aria-hidden': 'true' });
    el.appendChild(svg('line', { x1: 0, x2: stripW, y1: stripH / 2, y2: stripH / 2, class: 'quake-base' }));
    stripLine = svg('polyline', { points: trace(stripW, stripH, 9094), class: 'quake-line' });
    el.appendChild(stripLine);
    host.appendChild(el);
  }

  // A small tremor on the header trace as tactile feedback for a tap
  function jolt(size) {
    if (!stripLine || reduce) return;
    var at = stripW * (0.55 + Math.random() * 0.4);
    stripLine.setAttribute('points', trace(stripW, stripH, 9094, { at: at, size: Math.min(13, 4 + (size || 1) * 0.9) }));
    stripLine.classList.add('hit');
    clearTimeout(joltTimer);
    joltTimer = setTimeout(function () {
      stripLine.setAttribute('points', trace(stripW, stripH, 9094));
      stripLine.classList.remove('hit');
    }, 420);
  }

  // phases: [{label, value}] → a seismogram whose bursts scale with each value
  function seismogram(phases) {
    var W = 320, H = 96, base = 58;
    var max = Math.max.apply(null, phases.map(function (p) { return p.value; }).concat([10]));
    var el = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'seismo', role: 'img',
      'aria-label': 'Fuel scored by phase: ' + phases.map(function (p) { return p.label + ' ' + p.value; }).join(', ') });
    el.appendChild(svg('line', { x1: 0, x2: W, y1: base, y2: base, class: 'quake-base' }));
    var rnd = noise(17);
    var seg = W / phases.length;
    var pts = [];
    phases.forEach(function (p, i) {
      var amp = 2 + (p.value / max) * 40;
      for (var x = 0; x <= seg; x += 3) {
        var env = Math.sin((x / seg) * Math.PI);
        pts.push((i * seg + x).toFixed(1) + ',' + (base + rnd() * 2 * amp * env).toFixed(1));
      }
      var cx = i * seg + seg / 2;
      var t = svg('text', { x: cx, y: H - 18, class: 'seismo-val', 'text-anchor': 'middle' });
      t.textContent = p.value;
      el.appendChild(t);
      var l = svg('text', { x: cx, y: H - 4, class: 'seismo-label', 'text-anchor': 'middle' });
      l.textContent = p.label;
      el.appendChild(l);
      if (i) el.appendChild(svg('line', { x1: i * seg, x2: i * seg, y1: 8, y2: H - 30, class: 'seismo-div' }));
    });
    el.appendChild(svg('polyline', { points: pts.join(' '), class: 'seismo-line' }));
    return el;
  }

  // Brand mark: a spike crossing a fault line, inside a rounded tile
  function mark() {
    var el = svg('svg', { viewBox: '0 0 48 48', class: 'mark', 'aria-hidden': 'true' });
    el.appendChild(svg('rect', { x: 1, y: 1, width: 46, height: 46, rx: 11, class: 'mark-tile' }));
    el.appendChild(svg('path', { d: 'M6 27 L15 27 L19 19 L24 36 L29 10 L33 27 L42 27', class: 'mark-wave' }));
    el.appendChild(svg('path', { d: 'M8 40 L20 33 L27 37 L40 30', class: 'mark-fault' }));
    return el;
  }

  V2.quake = { strip: strip, jolt: jolt, seismogram: seismogram, mark: mark };
})();
