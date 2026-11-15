/* FigKit \u2014 tiny helper for the site's generative, code-drawn figures.
   Each figure registers itself with FigKit.register(name, factory) and is
   mounted on every element  <div class="figcanvas" data-fig="name"><canvas></canvas></div>.

   factory(api) must return { draw(t) } where t \u2208 [0,1) is the loop phase.
   api gives: ctx, W, H (CSS px, updated on resize), colors (theme tokens),
   rand(seed), voronoi(...), grainFill(...), ease(t), label(...), arrow(...),
   onResize(fn), hover {x,y,inside}.  Animation pauses off-screen, on hidden
   tabs, under prefers-reduced-motion (static frame at api.staticT), and via
   the figure's own pause button.  No dependencies. */
(function () {
  'use strict';
  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var registry = {};
  // ?figt=0.4 renders every figure as a static frame at that phase (for screenshots/tests)
  var forcedT = NaN;
  try { forcedT = parseFloat(new URLSearchParams(location.search).get('figt')); } catch (e) {}
  if (!isNaN(forcedT)) reduce = true;

  function isDark() {
    var t = root.getAttribute('data-theme');
    if (t) return t === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  function readColors() {
    var cs = getComputedStyle(root);
    function v(n, d) { return (cs.getPropertyValue(n) || '').trim() || d; }
    return {
      dark: isDark(),
      bg: v('--bg', '#FAF9F6'), surface: v('--surface', '#fff'), alt: v('--alt', '#F3F1EC'),
      text: v('--text', '#1A1D21'), muted: v('--muted', '#5B6470'), faint: v('--faint', '#8A929C'),
      rule: v('--rule', '#E3E1DA'), accent: v('--accent', '#1F4E79'), accentTint: v('--accent-tint', '#E8EEF5'),
      gold: v('--gold', '#9A6A1E'), goldTint: v('--gold-tint', '#F6F0E2')
    };
  }

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /* Periodic Voronoi on an NX\u00d7NY voxel grid. Returns {owner:Int16Array, seeds:[{x,y,hue,sat,n}]} */
  function voronoi(NX, NY, n, seed) {
    var r = mulberry32(seed || 1), seeds = [], owner = new Int16Array(NX * NY);
    for (var g = 0; g < n; g++) seeds.push({ x: r() * NX, y: r() * NY, hue: r(), sat: 0.55 + r() * 0.35, n: 0 });
    for (var j = 0; j < NY; j++) for (var i = 0; i < NX; i++) {
      var best = 1e9, bi = 0, cx = i + 0.5, cy = j + 0.5;
      for (var s = 0; s < n; s++) {
        var dx = Math.abs(cx - seeds[s].x); dx = Math.min(dx, NX - dx);
        var dy = Math.abs(cy - seeds[s].y); dy = Math.min(dy, NY - dy);
        var d = dx * dx + dy * dy; if (d < best) { best = d; bi = s; }
      }
      owner[j * NX + i] = bi; seeds[bi].n++;
    }
    return { owner: owner, seeds: seeds };
  }

  /* Soft IPF-like grain colours matching Fig. 0. hue/sat in [0,1]. */
  function grainFill(hue, sat, dark, strong) {
    var h = Math.round(hue * 360);
    if (strong) return dark ? 'hsl(' + h + ',' + Math.round(sat * 60) + '%,58%)' : 'hsl(' + h + ',' + Math.round(sat * 60) + '%,46%)';
    return dark ? 'hsl(' + h + ',' + Math.round(sat * 38) + '%,30%)' : 'hsl(' + h + ',' + Math.round(sat * 55) + '%,80%)';
  }

  function ease(t) { t = Math.max(0, Math.min(1, t)); return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  function mount(el) {
    var name = el.getAttribute('data-fig');
    var factory = registry[name];
    if (!factory || el.__figMounted) return;
    el.__figMounted = true;
    var canvas = el.querySelector('canvas');
    var ctx = canvas.getContext('2d');
    var resizeFns = [];
    var api = {
      ctx: ctx, W: 0, H: 0, dpr: 1, colors: readColors(), staticT: 0.35, period: 9000,
      rand: mulberry32, voronoi: voronoi, ease: ease,
      grainFill: function (h, s, strong) { return grainFill(h, s, api.colors.dark, strong); },
      onResize: function (fn) { resizeFns.push(fn); },
      hover: { x: -1, y: -1, inside: false },
      font: function (px, weight) { return (weight || 500) + ' ' + Math.round(px) + 'px "JetBrains Mono", ui-monospace, monospace'; },
      label: function (text, x, y, opt) {
        opt = opt || {};
        ctx.font = api.font(opt.size || Math.max(10, api.W * 0.021), opt.weight);
        ctx.fillStyle = opt.color || api.colors.muted; ctx.textAlign = opt.align || 'left'; ctx.textBaseline = opt.baseline || 'alphabetic';
        ctx.fillText(text, x, y); ctx.textBaseline = 'alphabetic';
      },
      arrow: function (x1, y1, x2, y2, opt) {
        opt = opt || {};
        var a = Math.atan2(y2 - y1, x2 - x1), hl = opt.head || 6;
        ctx.strokeStyle = ctx.fillStyle = opt.color || api.colors.muted; ctx.lineWidth = opt.width || 1.3;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2 - Math.cos(a) * hl * 0.8, y2 - Math.sin(a) * hl * 0.8); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - hl * Math.cos(a - 0.45), y2 - hl * Math.sin(a - 0.45));
        ctx.lineTo(x2 - hl * Math.cos(a + 0.45), y2 - hl * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
      }
    };
    // ---- LaTeX: draw a pre-rendered MathJax SVG (window.TEX_SVG[key]) ----
    // api.tex(key, x, y, {size: font px, color, align: 'left'|'center'|'right',
    //                     baseline: 'alphabetic'|'middle'|'top'}) -> {w, h}
    var texCache = {};
    api.tex = function (key, x, y, opt) {
      opt = opt || {};
      var T = (window.TEX_SVG || {})[key];
      if (!T) return { w: 0, h: 0 };
      var size = opt.size || Math.max(11, api.W * 0.024), k = size * 0.442;   // px per ex
      var w = T.wEx * k, h = T.hEx * k, depth = -T.vaEx * k;
      var color = opt.color || api.colors.text;
      var pw = Math.max(1, Math.round(w * api.dpr)), ph = Math.max(1, Math.round(h * api.dpr));
      var ck = key + '|' + color + '|' + pw + 'x' + ph, im = texCache[ck];
      if (!im) {
        im = new Image();
        var svg = T.svg.replace(/currentColor/g, color)
          .replace(/width="[^"]*ex"/, 'width="' + pw + '"').replace(/height="[^"]*ex"/, 'height="' + ph + '"');
        im.onload = function () { if (!raf) render(lastT); };
        im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
        texCache[ck] = im;
      }
      var x0 = opt.align === 'center' ? x - w / 2 : opt.align === 'right' ? x - w : x;
      var y0 = opt.baseline === 'middle' ? y - h / 2 : opt.baseline === 'top' ? y : y - (h - depth);
      if (im.complete && im.naturalWidth) ctx.drawImage(im, x0, y0, w, h);
      return { w: w, h: h };
    };
    var fig = factory(api) || {};
    if (!isNaN(forcedT)) api.staticT = forcedT;
    var lastT = api.staticT, start = null, raf = 0, visible = false, userPaused = false;

    function layout() {
      var r = canvas.getBoundingClientRect();
      api.dpr = Math.min(window.devicePixelRatio || 1, 2);
      api.W = r.width; api.H = r.height;
      canvas.width = Math.max(1, Math.round(r.width * api.dpr)); canvas.height = Math.max(1, Math.round(r.height * api.dpr));
      resizeFns.forEach(function (fn) { fn(api.W, api.H); });
    }
    function render(t) {
      if (!api.W) return;
      ctx.setTransform(api.dpr, 0, 0, api.dpr, 0, 0);
      ctx.clearRect(0, 0, api.W, api.H);
      ctx.globalAlpha = 1; ctx.setLineDash([]);
      if (fig.draw) fig.draw(t);
    }
    function frame(ts) {
      if (start === null) start = ts - lastT * api.period;
      lastT = ((ts - start) % api.period) / api.period;
      render(lastT);
      raf = requestAnimationFrame(frame);
    }
    function play() { if (!raf && !reduce && !userPaused && visible && !document.hidden) raf = requestAnimationFrame(frame); }
    function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; start = null; }

    layout(); render(lastT);
    if ('ResizeObserver' in window) new ResizeObserver(function () { layout(); render(lastT); }).observe(canvas);
    else window.addEventListener('resize', function () { layout(); render(lastT); });
    document.addEventListener('themechange', function () { api.colors = readColors(); if (fig.theme) fig.theme(); render(lastT); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { visible = en[0].isIntersecting; if (visible) play(); else stop(); }, { rootMargin: '80px' }).observe(el);
    } else { visible = true; }
    document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else play(); });
    canvas.addEventListener('mousemove', function (e) {
      var r = canvas.getBoundingClientRect(); api.hover.x = e.clientX - r.left; api.hover.y = e.clientY - r.top; api.hover.inside = true;
      if (!raf) render(lastT);
    });
    canvas.addEventListener('mouseleave', function () { api.hover.inside = false; api.hover.x = api.hover.y = -1; if (!raf) render(lastT); });

    var btn = el.querySelector('.fig-pause');
    if (btn) {
      if (reduce) btn.hidden = true;
      btn.addEventListener('click', function () {
        userPaused = !userPaused;
        btn.setAttribute('aria-pressed', String(userPaused));
        btn.setAttribute('aria-label', userPaused ? 'Play animation' : 'Pause animation');
        if (userPaused) stop(); else play();
      });
    }
    play();
  }

  window.FigKit = {
    register: function (name, factory) {
      registry[name] = factory;
      var els = document.querySelectorAll('.figcanvas[data-fig="' + name + '"]');
      Array.prototype.forEach.call(els, mount);
    },
    _readColors: readColors
  };
})();
