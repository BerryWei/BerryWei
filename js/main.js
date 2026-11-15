/* Ting-Ju (Berry) Wei \u2014 site script (no dependencies) */
(function () {
  'use strict';
  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- theme toggle ---------- */
  var themeBtn = document.querySelector('.theme');
  function isDark() {
    var t = root.getAttribute('data-theme');
    if (t) return t === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  function syncThemeLabel() {
    if (themeBtn) themeBtn.setAttribute('aria-label', isDark() ? 'Switch to light mode' : 'Switch to dark mode');
  }
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var next = isDark() ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) {}
      syncThemeLabel();
      document.dispatchEvent(new Event('themechange'));
    });
  }
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
    syncThemeLabel(); document.dispatchEvent(new Event('themechange'));
  });
  syncThemeLabel();

  /* ---------- nav ---------- */
  var topbar = document.querySelector('.topbar');
  var toggle = document.querySelector('.nav__toggle');
  var list = document.getElementById('nav-list');
  if (toggle && list) {
    toggle.addEventListener('click', function () {
      var open = list.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    list.addEventListener('click', function (e) {
      if (e.target.closest('a')) { list.classList.remove('is-open'); toggle.setAttribute('aria-expanded', 'false'); }
    });
  }
  function onScroll() { if (topbar) topbar.classList.toggle('is-scrolled', window.scrollY > 8); }
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();

  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.nav a[href^="#"]'));
  if ('IntersectionObserver' in window && navLinks.length) {
    var byId = {};
    navLinks.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });
    var inBand = {};
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { inBand[en.target.id] = en.isIntersecting; });
      var current = null;
      Object.keys(inBand).forEach(function (id) { if (inBand[id] && byId[id]) current = id; });
      navLinks.forEach(function (a) { a.classList.remove('is-active'); a.removeAttribute('aria-current'); });
      if (current) { byId[current].classList.add('is-active'); byId[current].setAttribute('aria-current', 'true'); }
    }, { rootMargin: '-45% 0px -50% 0px' });
    ['about', 'beyond'].concat(Object.keys(byId)).forEach(function (id) { var s = document.getElementById(id); if (s) spy.observe(s); });
  }

  /* ---------- publication tabs ---------- */
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.tabs [role="tab"]'));
  function selectTab(tab, focus) {
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      var panel = document.getElementById(t.getAttribute('aria-controls'));
      if (panel) panel.hidden = !on;
    });
    if (focus) tab.focus();
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { selectTab(t); });
    t.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        selectTab(tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length], true);
      }
    });
  });

  /* ---------- reveal + autoplay videos ---------- */
  if ('IntersectionObserver' in window) {
    if (!reduceMotion) {
      var revealEls = document.querySelectorAll('.section__head, .axis, .project, .card, .pub, .news li, .honor, .timeline li');
      var rv = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('is-in'); rv.unobserve(en.target); } });
      }, { rootMargin: '0px 0px -8% 0px' });
      Array.prototype.forEach.call(revealEls, function (el) {
        if (el.getBoundingClientRect().top > window.innerHeight) { el.classList.add('reveal'); rv.observe(el); }
      });
    }
    var vids = document.querySelectorAll('video.autoplay');
    var vo = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var v = en.target;
        if (en.isIntersecting) {
          if (reduceMotion) { if (v.preload === 'none') v.preload = 'metadata'; return; }
          if (v.dataset.userPaused === '1') return;
          var p = v.play(); if (p && p.catch) p.catch(function () {});
        } else { v.pause(); }
      });
    }, { threshold: 0.25 });
    Array.prototype.forEach.call(vids, function (v) {
      if (reduceMotion) { v.controls = true; }
      else {
        // click / Enter toggles playback (WCAG 2.2.2); a paused video stays paused
        v.tabIndex = 0;
        v.setAttribute('title', 'Click to pause or play');
        var toggleVid = function () {
          if (v.paused) { v.dataset.userPaused = ''; var p = v.play(); if (p && p.catch) p.catch(function () {}); }
          else { v.dataset.userPaused = '1'; v.pause(); }
        };
        v.addEventListener('click', toggleVid);
        v.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleVid(); } });
      }
      vo.observe(v);
    });
  }

  /* ---------- figure lightbox (publication graphical abstracts) ---------- */
  var lb = document.querySelector('.lightbox');
  if (lb && lb.showModal) {
    var lbImg = lb.querySelector('img');
    Array.prototype.forEach.call(document.querySelectorAll('.pub__fig'), function (b) {
      b.addEventListener('click', function () {
        var im = b.querySelector('img');
        lbImg.src = b.getAttribute('data-full'); lbImg.alt = im ? im.alt : '';
        lb.showModal();
      });
    });
    lb.querySelector('.lightbox__close').addEventListener('click', function () { lb.close(); });
    lb.addEventListener('click', function (e) { if (e.target === lb) lb.close(); });
  } else {
    Array.prototype.forEach.call(document.querySelectorAll('.pub__fig'), function (b) {
      b.addEventListener('click', function () { window.open(b.getAttribute('data-full'), '_blank', 'noopener'); });
    });
  }

  var yr = document.getElementById('yr');
  if (yr) yr.textContent = String(new Date().getFullYear());

  /* =========================================================
     Hero: generative Deep Material Network
     A periodic Voronoi polycrystal on a voxel grid feeds the
     2^4 leaves of a binary tree. Each load increment runs one
     online constitutive update: downscale, local laws, residual,
     Newton step (repeated until ||r|| < tol), then upscale.
     ========================================================= */
  var canvas = document.getElementById('dmn-canvas');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var readout = document.getElementById('f11');

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  var rand = mulberry32(20260629);

  var DEPTH = 4, NLEAF = 1 << DEPTH;
  var NX = 24, NY = 24; // square RVE (voxel slice)

  // seeds (one grain per leaf), periodic Voronoi
  var seeds = [];
  for (var g = 0; g < NLEAF; g++) {
    seeds.push({ x: rand() * NX, y: rand() * NY, hue: rand(), sat: 0.55 + rand() * 0.35, n: 0 });
  }
  var owner = new Int16Array(NX * NY);
  for (var j = 0; j < NY; j++) {
    for (var i = 0; i < NX; i++) {
      var best = 1e9, bi = 0, cx = i + 0.5, cy = j + 0.5;
      for (var s = 0; s < NLEAF; s++) {
        var dx = Math.abs(cx - seeds[s].x); dx = Math.min(dx, NX - dx);
        var dy = Math.abs(cy - seeds[s].y); dy = Math.min(dy, NY - dy);
        var d = dx * dx + dy * dy * 1.0;
        if (d < best) { best = d; bi = s; }
      }
      owner[j * NX + i] = bi; seeds[bi].n++;
    }
  }
  // order leaves by seed x so connectors do not cross much
  var leafOrder = seeds.map(function (_, k) { return k; }).sort(function (a, b) { return seeds[a].x - seeds[b].x; });

  // tree nodes: level 0 = root ... level DEPTH = leaves
  var nodes = [];
  for (var L = 0; L <= DEPTH; L++) {
    var count = 1 << L;
    for (var k = 0; k < count; k++) {
      nodes.push({ L: L, k: k, theta: Math.round(rand() * 180), w: 0, grain: L === DEPTH ? leafOrder[k] : -1, x: 0, y: 0, r: 0 });
    }
  }
  function nodeAt(L, k) { return nodes[(1 << L) - 1 + k]; }
  for (var kk = 0; kk < NLEAF; kk++) { var lf = nodeAt(DEPTH, kk); lf.w = seeds[lf.grain].n / (NX * NY); }
  for (var L2 = DEPTH - 1; L2 >= 0; L2--) {
    for (var k2 = 0; k2 < (1 << L2); k2++) { nodeAt(L2, k2).w = nodeAt(L2 + 1, 2 * k2).w + nodeAt(L2 + 1, 2 * k2 + 1).w; }
  }

  var W = 0, H = 0, dpr = 1, colors = {}, grid = { x0: 0, y0: 0, cell: 0 }, band = 0;
  function readColors() {
    var cs = getComputedStyle(root);
    var dark = isDark();
    colors = {
      surface: cs.getPropertyValue('--surface').trim() || '#fff',
      text: cs.getPropertyValue('--text').trim() || '#1A1D21',
      muted: cs.getPropertyValue('--muted').trim() || '#5B6470',
      faint: cs.getPropertyValue('--faint').trim() || '#8A929C',
      rule: cs.getPropertyValue('--rule').trim() || '#E3E1DA',
      accent: cs.getPropertyValue('--accent').trim() || '#1F4E79',
      gold: cs.getPropertyValue('--gold').trim() || '#9A6A1E',
      dark: dark
    };
    seeds.forEach(function (sd) {
      // IPF-like colouring, softened to sit quietly behind the tree
      sd.h = Math.round(sd.hue * 360);
      sd.fS = dark ? sd.sat * 38 : sd.sat * 55; sd.fL = dark ? 30 : 80;   // voxel fill
      sd.sS = sd.sat * 60; sd.sL = dark ? 58 : 46;                        // leaf / accent
      sd.fill = 'hsl(' + sd.h + ',' + Math.round(sd.fS) + '%,' + sd.fL + '%)';
      sd.solid = 'hsl(' + sd.h + ',' + Math.round(sd.sS) + '%,' + sd.sL + '%)';
    });
  }

  function layout() {
    var rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = rect.width; H = rect.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    // tree + RVE live in the top W x 0.84W; the solver panel fills the band below
    var pad = W * 0.07;
    var top = W * 0.095, leafY = W * 0.35;
    for (var n = 0; n < nodes.length; n++) {
      var nd = nodes[n], cnt = 1 << nd.L;
      var span = W - 2 * pad;
      nd.x = pad + span * (nd.k + 0.5) / cnt;
      nd.y = top + (leafY - top) * (nd.L / DEPTH);
      nd.r = nd.L === DEPTH ? Math.max(3, Math.sqrt(nd.w) * W * 0.06) : Math.max(4.5, W * 0.013 + nd.w * W * 0.01);
    }
    // square RVE, centred; side leaves room for the stretch (F11 up to 1.4) and load arrows
    var side = W * 0.34;
    grid.cell = side / NX;
    grid.x0 = (W - side) / 2; grid.y0 = W * 0.445;
    band = Math.max(W * 0.845, H - W * 0.36);
  }

  function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }

  /* ---- online solve: one constitutive update per load increment ----
     step 0 = load increment, 1 downscale, 2 local laws, 3 residual,
     4 Newton step (1-4 repeated for k = 1..nk), 5 upscale, 6 hold.
     Loading increments are plastic and take 4 Newton iterations; unloading is
     nearly elastic and converges in 2.
     Schematic only: deformation is deliberately exaggerated (F11 up to 1.4). */
  var LEVELS = [1.05, 1.15, 1.3, 1.4, 1.3, 1.15], NINC = LEVELS.length;
  var TOL = 1e-6;
  var PLANS = {
    // res: ||r|| at iteration k; err: remaining |U - U*| before Newton step k (err[nk-1] = 0)
    4: { res: [1e-2, 2e-3, 6e-5, 1e-7], err: [1, 0.18, 0.012, 0],
         d: [[1.2, 0.55, 0.95, 0.6], [0.75, 0.4, 0.65, 0.45], [0.55, 0.3, 0.5, 0.35], [0.45, 0.25, 0.4, 0]] },
    2: { res: [3e-3, 2e-8], err: [1, 0],
         d: [[1.2, 0.55, 0.95, 0.6], [0.55, 0.3, 0.45, 0]] }
  };
  var INCS = [], PERIOD = 0;
  (function () {
    for (var n = 0; n < NINC; n++) {
      var Fp = LEVELS[(n + NINC - 1) % NINC], nk = LEVELS[n] > Fp ? 4 : 2, pl = PLANS[nk];
      var tl = [], sum = 0;
      tl.push({ s: 0, k: 0, d: 0.6 });
      for (var k = 1; k <= nk; k++) for (var s = 1; s <= 4; s++) if (pl.d[k - 1][s - 1]) tl.push({ s: s, k: k, d: pl.d[k - 1][s - 1] });
      tl.push({ s: 5, k: nk, d: 1.05 }); tl.push({ s: 6, k: nk, d: 0.75 });
      tl.forEach(function (p) { p.d *= 900; p.t0 = sum; sum += p.d; p.t1 = sum; });
      INCS.push({ nk: nk, pl: pl, tl: tl, t0: PERIOD, dur: sum });
      PERIOD += sum;
    }
  })();
  function resid(n, k) {
    var h = Math.sin(n * 12.9898 + k * 78.233) * 43758.5453; h -= Math.floor(h);
    return INCS[n].pl.res[k - 1] * (0.75 + 0.5 * h);
  }
  function solverState(t) {
    var x = (((t % 1) + 1) % 1) * PERIOD, n = NINC - 1;
    for (var m = 0; m < NINC; m++) if (x < INCS[m].t0 + INCS[m].dur) { n = m; break; }
    var inc = INCS[n], tau = x - inc.t0, TL = inc.tl, E = inc.pl.err, nk = inc.nk;
    var seg = TL[TL.length - 1];
    for (var i = 0; i < TL.length; i++) if (tau < TL[i].t1) { seg = TL[i]; break; }
    var u = clamp01((tau - seg.t0) / (seg.t1 - seg.t0));
    var Fp = LEVELS[(n + NINC - 1) % NINC], Fn = LEVELS[n];
    var s = seg.s, k = seg.k;
    var err = s === 0 ? 1 : (s === 4 ? E[k - 1] + (E[k] - E[k - 1]) * easeInOut(u) : (s >= 5 ? 0 : E[k - 1]));
    var r = [], dots = [], hist = 1, hn = n;
    if (s === 0) {
      // the previous increment's history fades out while the load advances
      hn = (n + NINC - 1) % NINC; hist = 1 - easeInOut(clamp01(u / 0.75));
    }
    var hk = INCS[hn].nk;
    for (var j = 1; j <= hk; j++) {
      r.push(resid(hn, j));
      var a = 0;
      if (s === 0 || s >= 5 || (s >= 1 && j < k)) a = 1;
      else if (j === k) a = s === 4 ? 1 : (s === 3 ? clamp01((u - 0.8) / 0.2) : 0);
      dots.push(a);
    }
    return { n: n, s: s, k: k, u: u, nk: nk, hk: hk, hist: hist, E: E,
      F: s === 0 ? Fp + (Fn - Fp) * easeInOut(u) : Fn, Fp: Fp, Fn: Fn, err: err, r: r, dots: dots };
  }
  var STEPS = [
    ['downscale', '\u03b5_i = \u03b5\u0304 + D_iU'],
    ['local laws', '(\u03c3_i, C_i) = f_i(\u03b5_i)'],
    ['residual', 'r = \u03a3 w_i\u200aD_i^T\u200a\u03c3_i'],
    ['Newton step', 'K \u0394U = \u2212r'],
    ['upscale', '\u03c3\u0304 = \u03a3 w_i\u03c3_i']
  ];
  var MONO = '"JetBrains Mono", ui-monospace, monospace';
  // tiny rich text: '_x' / '^x' (or '_{..}' / '^{..}') draw sub/superscripts.
  // Uses the current fillStyle; size fs; align 'left' or 'right' at x; baseline middle.
  function richText(str, x, y, fs, weight, align) {
    var parts = [], i = 0, buf = '';
    while (i < str.length) {
      var ch = str.charAt(i);
      if (ch === '\u200a') { // hair space: a fixed thin gap (mono fonts may give it a full cell)
        if (buf) { parts.push([buf, 0]); buf = ''; }
        parts.push(['', 0, fs * 0.18]); i++;
      } else if ((ch === '_' || ch === '^') && i + 1 < str.length) {
        if (buf) { parts.push([buf, 0]); buf = ''; }
        var body;
        if (str.charAt(i + 1) === '{') { var j = str.indexOf('}', i); body = str.slice(i + 2, j); i = j + 1; }
        else { body = str.charAt(i + 1); i += 2; }
        parts.push([body, ch === '_' ? 1 : -1]);
      } else { buf += ch; i++; }
    }
    if (buf) parts.push([buf, 0]);
    var c = ctx, total = 0, widths = [];
    parts.forEach(function (pt) {
      c.font = weight + ' ' + (pt[1] ? fs * 0.68 : fs) + 'px ' + MONO;
      var w = c.measureText(pt[0]).width + (pt[1] ? fs * 0.04 : 0) + (pt[2] || 0); widths.push(w); total += w;
    });
    var cx = align === 'right' ? x - total : x;
    c.textAlign = 'left'; c.textBaseline = 'middle';
    parts.forEach(function (pt, k) {
      c.font = weight + ' ' + (pt[1] ? fs * 0.68 : fs) + 'px ' + MONO;
      if (pt[0]) c.fillText(pt[0], cx, y + pt[1] * fs * 0.32);
      cx += widths[k];
    });
    return total;
  }

  var hover = null;
  function draw(t) {
    var c = ctx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);

    var st = solverState(t);
    var FMAX = 1.4;
    var F = st.F;
    if (readout) readout.textContent = F.toFixed(3);
    var e = F - 1;

    // local-law flash per grain (left-to-right wave over the leaves)
    var flash = new Float32Array(NLEAF), leafFlash = new Float32Array(NLEAF);
    if (st.s === 2) {
      for (var q0 = 0; q0 < NLEAF; q0++) {
        var fq = Math.sin(Math.PI * clamp01((st.u - 0.45 * q0 / NLEAF) / 0.55));
        leafFlash[q0] = fq; flash[nodeAt(DEPTH, q0).grain] = fq;
      }
    }
    var cellFill = seeds.map(function (sd, gi) {
      var f = flash[gi] * 0.45;
      if (f <= 0.001) return sd.fill;
      return 'hsl(' + sd.h + ',' + Math.round(sd.fS + (sd.sS - sd.fS) * f) + '%,' + Math.round(sd.fL + (sd.sL - sd.fL) * f) + '%)';
    });

    // ---- polycrystal under periodic boundary conditions ----
    // x = F.X + w(X): macroscopic stretch F11 (with lateral contraction) plus a
    // fluctuation w that is periodic in X, so opposite faces deform identically.
    var side = NX * grid.cell;
    var cxm = grid.x0 + side / 2, cym = grid.y0 + side / 2;
    var TAU = 2 * Math.PI;
    function map(x, y) {
      var X = x / NX, Y = y / NY;               // reference coords in [0,1]
      var u = X - 0.5, v = Y - 0.5;
      var wx = e * (0.045 * Math.sin(TAU * Y) + 0.03 * Math.sin(TAU * (X + Y) + 1.3) + 0.02 * Math.sin(TAU * (2 * X - Y)));
      var wy = e * (0.04 * Math.sin(TAU * X + 0.7) + 0.025 * Math.sin(TAU * (X - Y) + 2.1) + 0.02 * Math.sin(TAU * (X + 2 * Y)));
      return { x: cxm + (u * F + wx) * side, y: cym + (v / Math.sqrt(F) + wy) * side };
    }
    var P = new Array((NX + 1) * (NY + 1));
    for (var pj = 0; pj <= NY; pj++) for (var pi = 0; pi <= NX; pi++) P[pj * (NX + 1) + pi] = map(pi, pj);
    function pt(i, j) { return P[j * (NX + 1) + i]; }
    for (var j = 0; j < NY; j++) {
      for (var i = 0; i < NX; i++) {
        var a = pt(i, j), b = pt(i + 1, j), d = pt(i + 1, j + 1), f = pt(i, j + 1);
        c.fillStyle = cellFill[owner[j * NX + i]];
        c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.lineTo(d.x, d.y); c.lineTo(f.x, f.y); c.closePath();
        c.fill(); c.strokeStyle = c.fillStyle; c.lineWidth = 0.6; c.stroke();
      }
    }
    // voxel hint
    c.strokeStyle = colors.dark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.05)';
    c.lineWidth = 1;
    c.beginPath();
    for (var i3 = 1; i3 < NX; i3++) { c.moveTo(pt(i3, 0).x, pt(i3, 0).y); for (var j4 = 1; j4 <= NY; j4++) c.lineTo(pt(i3, j4).x, pt(i3, j4).y); }
    for (var j3 = 1; j3 < NY; j3++) { c.moveTo(pt(0, j3).x, pt(0, j3).y); for (var i4 = 1; i4 <= NX; i4++) c.lineTo(pt(i4, j3).x, pt(i4, j3).y); }
    c.stroke();
    // grain boundaries
    c.strokeStyle = colors.dark ? 'rgba(0,0,0,.6)' : 'rgba(255,255,255,.95)';
    c.lineWidth = 1.5;
    c.beginPath();
    for (var j2 = 0; j2 < NY; j2++) {
      for (var i2 = 0; i2 < NX; i2++) {
        var o = owner[j2 * NX + i2], q1, q2;
        if (i2 + 1 < NX && owner[j2 * NX + i2 + 1] !== o) { q1 = pt(i2 + 1, j2); q2 = pt(i2 + 1, j2 + 1); c.moveTo(q1.x, q1.y); c.lineTo(q2.x, q2.y); }
        if (j2 + 1 < NY && owner[(j2 + 1) * NX + i2] !== o) { q1 = pt(i2, j2 + 1); q2 = pt(i2 + 1, j2 + 1); c.moveTo(q1.x, q1.y); c.lineTo(q2.x, q2.y); }
      }
    }
    c.stroke();
    // outline
    c.strokeStyle = colors.muted; c.globalAlpha = 0.6; c.lineWidth = 1;
    c.beginPath(); c.moveTo(pt(0, 0).x, pt(0, 0).y);
    for (var ob = 1; ob <= NX; ob++) c.lineTo(pt(ob, 0).x, pt(ob, 0).y);
    for (ob = 1; ob <= NY; ob++) c.lineTo(pt(NX, ob).x, pt(NX, ob).y);
    for (ob = NX - 1; ob >= 0; ob--) c.lineTo(pt(ob, NY).x, pt(ob, NY).y);
    for (ob = NY - 1; ob >= 0; ob--) c.lineTo(pt(0, ob).x, pt(0, ob).y);
    c.stroke(); c.globalAlpha = 1;

    // loading arrows (grow with load)
    c.strokeStyle = colors.muted; c.fillStyle = colors.muted; c.lineWidth = 1.3;
    var lm = pt(0, NY / 2 | 0), rm = pt(NX, NY / 2 | 0), al = W * (0.03 + 0.05 * e / (FMAX - 1));
    [[lm.x - 4, lm.y, -1], [rm.x + 4, rm.y, 1]].forEach(function (a) {
      c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(a[0] + a[2] * al, a[1]); c.stroke();
      c.beginPath(); c.moveTo(a[0] + a[2] * (al + 6), a[1]); c.lineTo(a[0] + a[2] * al, a[1] - 4); c.lineTo(a[0] + a[2] * al, a[1] + 4); c.closePath(); c.fill();
    });

    function anchor(gi) { var sd = seeds[gi]; return map(sd.x, sd.y); }

    // pulse path coordinate sp: 0 = grain anchor, 1 = leaf, 1 + j = tree level DEPTH - j (root at SEG)
    var SEG = DEPTH + 1, sp = -1, pulseCol = colors.accent, ring = false;
    if (st.s === 1) { sp = SEG * (1 - easeInOut(st.u)); pulseCol = colors.gold; }
    else if (st.s === 3) { sp = 1 + (SEG - 1) * easeInOut(clamp01(st.u / 0.85)); ring = true; }
    else if (st.s === 5) { sp = 1 + (SEG - 1) * easeInOut(clamp01(st.u / 0.75)); }

    // ---- connectors leaf -> grain ----
    // drawn up to the RVE outline only; the part inside the grain map appears
    // while the strain is handed to the grains (downscale) and the local laws run
    var outline = [];
    for (var o1 = 0; o1 < NX; o1++) outline.push(pt(o1, 0));
    for (o1 = 0; o1 < NY; o1++) outline.push(pt(NX, o1));
    for (o1 = NX; o1 > 0; o1--) outline.push(pt(o1, NY));
    for (o1 = NY; o1 > 0; o1--) outline.push(pt(0, o1));
    function enterT(ax, ay, bx, by) {
      // first parameter t in [0,1] where segment a->b crosses the RVE outline
      var tb = 1, rx = bx - ax, ry = by - ay;
      for (var e1 = 0; e1 < outline.length; e1++) {
        var p1 = outline[e1], p2 = outline[(e1 + 1) % outline.length];
        var sx = p2.x - p1.x, sy = p2.y - p1.y, den = rx * sy - ry * sx;
        if (Math.abs(den) < 1e-9) continue;
        var tt = ((p1.x - ax) * sy - (p1.y - ay) * sx) / den, uu = ((p1.x - ax) * ry - (p1.y - ay) * rx) / den;
        if (tt >= 0 && tt <= tb && uu >= 0 && uu <= 1) tb = tt;
      }
      return tb;
    }
    var inner = 0;
    if (st.s === 1) inner = clamp01(1.6 - sp);
    else if (st.s === 2) inner = 1 - easeInOut(clamp01((st.u - 0.55) / 0.45));
    var outerA = (st.s === 1 || st.s === 2) ? 0.42 : 0.26;
    c.setLineDash([2, 3]); c.lineWidth = 1; c.strokeStyle = colors.muted;
    for (var q = 0; q < NLEAF; q++) {
      var lf = nodeAt(DEPTH, q), an = anchor(lf.grain);
      var ay0 = lf.y + lf.r, te = enterT(lf.x, ay0, an.x, an.y);
      var ex = lf.x + (an.x - lf.x) * te, ey = ay0 + (an.y - ay0) * te;
      c.globalAlpha = outerA;
      c.beginPath(); c.moveTo(lf.x, ay0); c.lineTo(ex, ey); c.stroke();
      if (inner > 0.01) {
        c.globalAlpha = 0.4 * inner;
        c.beginPath(); c.moveTo(ex, ey); c.lineTo(an.x, an.y); c.stroke();
      }
    }
    c.setLineDash([]); c.globalAlpha = 1;
    for (var q2 = 0; q2 < NLEAF; q2++) {
      var an2 = anchor(nodeAt(DEPTH, q2).grain), lfl = leafFlash[q2];
      if (lfl > 0.01) {
        c.strokeStyle = seeds[nodeAt(DEPTH, q2).grain].solid; c.globalAlpha = 0.85 * lfl; c.lineWidth = 1.2;
        c.beginPath(); c.arc(an2.x, an2.y, 3 + 6 * lfl, 0, 7); c.stroke(); c.globalAlpha = 1;
      }
      c.fillStyle = colors.surface; c.beginPath(); c.arc(an2.x, an2.y, 2.6, 0, 7); c.fill();
      c.strokeStyle = colors.text; c.globalAlpha = .6; c.lineWidth = 1; c.stroke(); c.globalAlpha = 1;
    }

    // ---- tree edges ----
    c.lineWidth = 1.2; c.strokeStyle = colors.muted; c.globalAlpha = 0.45;
    c.beginPath();
    for (var n = 1; n < nodes.length; n++) {
      var nd = nodes[n], p = nodeAt(nd.L - 1, nd.k >> 1);
      c.moveTo(p.x, p.y); c.bezierCurveTo(p.x, (p.y + nd.y) / 2, nd.x, (p.y + nd.y) / 2, nd.x, nd.y);
    }
    c.stroke(); c.globalAlpha = 1;

    // ---- pulses (drawn on top of the nodes) ----
    function drawPulses() {
    if (sp >= 0 && !(st.s === 5 && st.u >= 0.75) && !(st.s === 3 && st.u >= 0.85)) {
      var seg = Math.min(SEG - 1, Math.floor(sp)), vv = sp - seg;
      c.fillStyle = pulseCol; c.strokeStyle = pulseCol;
      for (var m = 0; m < NLEAF; m++) {
        var pp;
        if (seg === 0) {
          var lfm = nodeAt(DEPTH, m), anm = anchor(lfm.grain);
          pp = { x: anm.x + (lfm.x - anm.x) * vv, y: anm.y + (lfm.y - anm.y) * vv };
        } else {
          var Lc = DEPTH - seg + 1;
          var kc = m >> (DEPTH - Lc);
          if ((m & ((1 << (DEPTH - Lc)) - 1)) !== 0) continue; // one pulse per edge
          var ch2 = nodeAt(Lc, kc), pa = nodeAt(Lc - 1, kc >> 1);
          var my = (pa.y + ch2.y) / 2, iv = 1 - vv;
          // point on cubic bezier from child to parent
          pp = {
            x: iv * iv * iv * ch2.x + 3 * iv * iv * vv * ch2.x + 3 * iv * vv * vv * pa.x + vv * vv * vv * pa.x,
            y: iv * iv * iv * ch2.y + 3 * iv * iv * vv * my + 3 * iv * vv * vv * my + vv * vv * vv * pa.y
          };
        }
        if (ring) {
          c.fillStyle = colors.surface; c.beginPath(); c.arc(pp.x, pp.y, 3.6, 0, 7); c.fill(); c.fillStyle = pulseCol;
          c.lineWidth = 1.5; c.stroke(); c.beginPath(); c.arc(pp.x, pp.y, 1.3, 0, 7); c.fill();
        } else {
          c.globalAlpha = 0.22; c.beginPath(); c.arc(pp.x, pp.y, 7, 0, 7); c.fill();
          c.globalAlpha = 1; c.fillStyle = colors.surface; c.beginPath(); c.arc(pp.x, pp.y, 3.8, 0, 7); c.fill(); c.fillStyle = pulseCol;
          c.globalAlpha = 1; c.beginPath(); c.arc(pp.x, pp.y, 2.6, 0, 7); c.fill();
        }
      }
    }
    }

    // residual glow at the interaction nodes, proportional to log ||r||
    var rk = st.k >= 1 ? st.r[st.k - 1] : 0;
    var gk = rk ? Math.max(0.12, Math.min(1, (Math.log(rk) / Math.LN10 + 7.5) / 5.5)) : 0;
    var rootGlow = 0;
    if (st.s === 5) rootGlow = clamp01((st.u - 0.6) / 0.25);
    else if (st.s === 6) rootGlow = 1 - easeInOut(st.u);

    // ---- nodes ----
    for (var n2 = 0; n2 < nodes.length; n2++) {
      var nn = nodes[n2];
      var isLeaf = nn.L === DEPTH;
      if (!isLeaf && gk > 0 && (st.s === 3 || st.s === 4)) {
        // residual at this block: a halo whose size follows log ||r||, so it visibly
        // shrinks from k = 1 to the converged iterate
        var lvl = DEPTH - nn.L + 1;
        var amp = st.s === 3 ? clamp01((sp - lvl + 0.3) / 0.3) : 1 - easeInOut(clamp01(st.u / 0.5));
        if (st.s === 3 && st.u >= 0.85) amp = 1;
        if (amp > 0.01) {
          var rg = nn.r + 2 + 7.5 * gk;
          c.fillStyle = colors.accent; c.globalAlpha = (colors.dark ? 0.2 : 0.13) * amp;
          c.beginPath(); c.arc(nn.x, nn.y, rg, 0, 7); c.fill();
          c.strokeStyle = colors.accent; c.globalAlpha = 0.6 * amp; c.lineWidth = 1.1;
          c.stroke(); c.globalAlpha = 1;
        }
      }
      if (nn.L === 0 && rootGlow > 0) {
        c.fillStyle = colors.accent; c.globalAlpha = 0.2 * rootGlow;
        c.beginPath(); c.arc(nn.x, nn.y, nn.r + 9 * rootGlow, 0, 7); c.fill(); c.globalAlpha = 1;
      }
      if (isLeaf && leafFlash[nn.k] > 0.01) {
        var lf2 = leafFlash[nn.k];
        c.strokeStyle = seeds[nn.grain].solid; c.globalAlpha = 0.7 * lf2; c.lineWidth = 1.4;
        c.beginPath(); c.arc(nn.x, nn.y, nn.r + 2 + 5 * lf2, 0, 7); c.stroke(); c.globalAlpha = 1;
      }
      c.beginPath(); c.arc(nn.x, nn.y, nn.r, 0, 7);
      c.fillStyle = isLeaf ? seeds[nn.grain].solid : colors.surface; c.fill();
      c.lineWidth = hover === nn ? 2.2 : 1.3;
      c.strokeStyle = isLeaf ? colors.surface : (nn.L === 0 ? colors.accent : colors.text);
      c.stroke();
      if (!isLeaf) {
        // interaction direction a_p of this laminate; Newton steps rotate it towards
        // the converged state of the new load increment
        // (the per-increment change is exaggerated so the correction dU is visible)
        var sgn = nn.k % 2 ? 1 : -1, fac = 0.85 + 0.3 * ((n2 * 0.618034) % 1);
        var thOld = nn.theta + (st.Fp - 1) * 260 * fac * sgn, thNew = nn.theta + (st.Fn - 1) * 260 * fac * sgn;
        var thDeg = thNew - st.err * (thNew - thOld);
        var th = thDeg * Math.PI / 180, rr = nn.r * 0.72;
        var newton = st.s === 4 ? Math.min(1, 2.2 * Math.sin(Math.PI * st.u)) : 0;
        if (newton > 0.01) {
          var thPre = (thNew - st.E[st.k - 1] * (thNew - thOld)) * Math.PI / 180;
          var Rg = nn.r + 3.5;
          // ghost of the iterate before this step
          c.strokeStyle = colors.muted; c.globalAlpha = 0.55 * newton; c.lineWidth = 1; c.setLineDash([2, 2]);
          c.beginPath(); c.moveTo(nn.x - Math.cos(thPre) * Rg, nn.y - Math.sin(thPre) * Rg); c.lineTo(nn.x + Math.cos(thPre) * Rg, nn.y + Math.sin(thPre) * Rg); c.stroke();
          c.setLineDash([]);
          // correction dU: arcs with arrowheads from the old to the new direction
          if (Math.abs(th - thPre) > 0.02) {
            var Ra = nn.r + 6, dir = th > thPre ? 1 : -1;
            c.strokeStyle = colors.accent; c.fillStyle = colors.accent; c.globalAlpha = 0.9 * newton; c.lineWidth = 1.5;
            for (var hf = 0; hf < 2; hf++) {
              var a0 = thPre + hf * Math.PI, a1 = th + hf * Math.PI;
              c.beginPath(); c.arc(nn.x, nn.y, Ra, a0, a1, dir < 0); c.stroke();
              if (Math.abs(th - thPre) > 0.12) {
                var hx = nn.x + Math.cos(a1) * Ra, hy = nn.y + Math.sin(a1) * Ra;
                var tx2 = -Math.sin(a1) * dir, ty2 = Math.cos(a1) * dir, nx2 = Math.cos(a1), ny2 = Math.sin(a1);
                c.beginPath(); c.moveTo(hx + tx2 * 3.2, hy + ty2 * 3.2);
                c.lineTo(hx - tx2 * 2 + nx2 * 2.6, hy - ty2 * 2 + ny2 * 2.6);
                c.lineTo(hx - tx2 * 2 - nx2 * 2.6, hy - ty2 * 2 - ny2 * 2.6); c.closePath(); c.fill();
              }
            }
            c.globalAlpha = 1;
          }
          rr = nn.r * 0.72 + (Rg - nn.r * 0.72) * newton;
        }
        c.strokeStyle = (nn.L === 0 || newton > 0.01) ? colors.accent : colors.text; c.lineWidth = 1.2 + 0.8 * newton;
        c.beginPath(); c.moveTo(nn.x - Math.cos(th) * rr, nn.y - Math.sin(th) * rr); c.lineTo(nn.x + Math.cos(th) * rr, nn.y + Math.sin(th) * rr); c.stroke();
      }
    }
    drawPulses();

    // ---- labels ----
    var fsL = Math.max(10, W * 0.022);
    c.font = '500 ' + fsL + 'px ' + MONO;
    c.textBaseline = 'alphabetic';
    var rt = nodeAt(0, 0);
    c.textAlign = 'left';
    c.fillStyle = rootGlow > 0.05 ? colors.accent : colors.muted;
    c.fillText((W >= 420 ? 'macro ' : '') + '\u03c3\u0304, \u2102\u0304', rt.x + rt.r + 14, rt.y + 4);
    c.textAlign = 'right';
    c.fillStyle = st.s === 1 ? colors.gold : colors.muted;
    c.fillText('\u03b5\u0304' + (W >= 420 ? ' = ' + (F - 1).toFixed(2) : ''), rt.x - rt.r - 14, rt.y + 4);
    var labY = band - Math.max(8, W * 0.022);
    c.fillStyle = colors.muted;
    c.fillText('RVE \u00b7 ' + NLEAF + ' grains', W - W * 0.05, labY);
    c.textAlign = 'left';
    c.fillText('increment ' + (st.n + 1) + '/' + NINC, W * 0.05, labY);

    drawPanel(st);

    // ---- hover tooltip ----
    if (hover) {
      var label = hover.L === DEPTH
        ? 'grain ' + (hover.grain + 1) + ' \u00b7 w = ' + hover.w.toFixed(3)
        : (hover.L === 0 ? 'root \u00b7 homogenized RVE' : 'block L' + hover.L + ' \u00b7 \u03b8 = ' + hover.theta + '\u00b0 \u00b7 w = ' + hover.w.toFixed(3));
      c.font = '500 ' + Math.max(11, W * 0.022) + 'px ' + MONO;
      var tw = c.measureText(label).width + 14, th2 = Math.max(22, W * 0.045);
      var tx = Math.min(Math.max(hover.x - tw / 2, 6), W - tw - 6), ty = hover.y - hover.r - th2 - 8;
      if (ty < 4) ty = hover.y + hover.r + 8;
      c.fillStyle = colors.text; c.globalAlpha = 0.92;
      c.beginPath(); if (c.roundRect) c.roundRect(tx, ty, tw, th2, 5); else c.rect(tx, ty, tw, th2); c.fill();
      c.globalAlpha = 1; c.fillStyle = colors.surface; c.textAlign = 'left'; c.textBaseline = 'middle';
      c.fillText(label, tx + 7, ty + th2 / 2 + 1); c.textBaseline = 'alphabetic';
    }
  }

  // ---- solver panel: step list (left) + residual per iteration (right) ----
  function drawPanel(st) {
    var c = ctx;
    var x0 = W * 0.05, x1 = W * 0.95, y0 = band, y1 = H - Math.max(8, W * 0.03);
    var wide = W >= 430;
    var fs = Math.max(10, Math.min(13, W * 0.024));
    c.strokeStyle = colors.rule; c.lineWidth = 1;
    c.beginPath(); c.moveTo(x0, y0 + 0.5); c.lineTo(x1, y0 + 0.5); c.stroke();

    var top = y0 + fs * 0.5, rh = (y1 - top) / 6;
    var splitX = x0 + (x1 - x0) * (wide ? 0.6 : 0.56);
    c.textBaseline = 'middle';

    // title row
    c.font = '500 ' + (fs * 0.92) + 'px ' + MONO;
    c.textAlign = 'left'; c.fillStyle = colors.muted;
    c.fillText(wide ? 'one constitutive update' : 'update', x0, top + rh * 0.5);
    c.textAlign = 'right';
    var looping = st.s >= 1 && st.s <= 4;
    c.fillStyle = looping ? colors.accent : colors.muted;
    c.fillText(st.s === 0 ? 'new load' : 'k = ' + st.k, splitX - fs * 1.2, top + rh * 0.5);

    // step rows
    var xl = x0 + (wide ? fs * 0.9 : 0);
    var cr = fs * 0.62, xb = xl + cr * 0.4, xc = xl + fs * 1.55, xn = xc + cr + fs * 0.55;
    function rowY(i) { return top + rh * (i + 0.5); }
    // repeat bracket 4 -> 1
    c.strokeStyle = looping && st.k > 1 && st.s === 1 && st.u < 0.25 ? colors.accent : (looping ? colors.faint : colors.rule);
    c.lineWidth = 1.1;
    var ya = rowY(4), yb = rowY(1), xe = xc - cr - 2;
    c.beginPath(); c.moveTo(xe, ya); c.lineTo(xb, ya); c.lineTo(xb, yb); c.lineTo(xe - 2, yb); c.stroke();
    c.fillStyle = c.strokeStyle;
    c.beginPath(); c.moveTo(xe + 1, yb); c.lineTo(xe - 4, yb - 3); c.lineTo(xe - 4, yb + 3); c.closePath(); c.fill();
    if (wide) {
      // the slide's "repeat 1-4 until ||r|| < tol", set along the bracket
      c.save(); c.translate(xb - fs * 0.62, (ya + yb) / 2); c.rotate(-Math.PI / 2);
      c.font = '400 ' + Math.max(9, fs * 0.74) + 'px ' + MONO; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = looping ? colors.muted : colors.faint;
      c.fillText('until \u2016r\u2016 < tol', 0, 0);
      c.restore();
    }

    for (var i = 1; i <= 5; i++) {
      var y = rowY(i);
      var active = st.s === i || (st.s === 6 && i === 5);
      var doneNow = st.s > i && st.s <= 6 && st.s !== 0;
      if (active) {
        c.fillStyle = colors.accent; c.globalAlpha = colors.dark ? 0.14 : 0.08;
        var hx0 = xl + fs * 0.9, hw = splitX - fs * 0.6 - hx0;
        c.beginPath(); if (c.roundRect) c.roundRect(hx0, y - rh * 0.46, hw, rh * 0.92, 4); else c.rect(hx0, y - rh * 0.46, hw, rh * 0.92); c.fill();
        c.globalAlpha = 1;
      }
      c.beginPath(); c.arc(xc, y, cr, 0, 7);
      if (active) { c.fillStyle = colors.accent; c.fill(); }
      else { c.strokeStyle = doneNow ? colors.muted : colors.faint; c.lineWidth = 1; c.stroke(); }
      c.font = '500 ' + (fs * 0.78) + 'px ' + MONO; c.textAlign = 'center';
      c.fillStyle = active ? colors.surface : (doneNow ? colors.muted : colors.faint);
      c.fillText(String(i), xc, y + 0.5);
      c.font = (active ? '500 ' : '400 ') + fs + 'px ' + MONO; c.textAlign = 'left';
      c.fillStyle = active ? colors.text : (doneNow ? colors.muted : colors.faint);
      c.fillText(STEPS[i - 1][0], xn, y + 0.5);
      if (wide) {
        c.fillStyle = active ? colors.accent : colors.faint;
        richText(STEPS[i - 1][1], splitX - fs * 1.2, y + 0.5, fs * 0.95, '400', 'right');
      }
    }

    // residual plot
    var px0 = splitX + fs * 0.4;
    c.font = '500 ' + (fs * 0.92) + 'px ' + MONO; c.textAlign = 'left'; c.fillStyle = colors.muted;
    c.fillText('\u2016r\u2016' + (wide ? ' per iteration' : ''), px0, top + rh * 0.5);
    var hk = st.hk, conv = st.dots[hk - 1] > 0.5 && st.r[hk - 1] < TOL;
    var tickFs = Math.max(10, fs * 0.85);
    var ax0 = px0 + fs * 2.7, ax1 = x1 - fs * 0.3, ay0 = top + rh * 1.25, ay1 = y1 - fs * 1.5;
    function ly(v) { return ay1 - (Math.log(v) / Math.LN10 + 9) / 8 * (ay1 - ay0); }
    function lx(j) { return ax0 + (j - 0.5) / 4 * (ax1 - ax0); }
    c.strokeStyle = colors.rule; c.lineWidth = 1;
    c.beginPath(); c.moveTo(ax0, ay0); c.lineTo(ax0, ay1); c.lineTo(ax1, ay1); c.stroke();
    c.fillStyle = colors.muted;
    richText('10^{\u22122}', ax0 - fs * 0.35, ly(1e-2), tickFs, '400', 'right');
    richText('10^{\u22126}', ax0 - fs * 0.35, ly(1e-6), tickFs, '400', 'right');
    // tol line
    c.strokeStyle = colors.gold; c.globalAlpha = 0.8; c.setLineDash([3, 3]);
    c.beginPath(); c.moveTo(ax0, ly(TOL)); c.lineTo(ax1, ly(TOL)); c.stroke(); c.setLineDash([]); c.globalAlpha = 1;
    c.font = '400 ' + tickFs + 'px ' + MONO;
    c.fillStyle = colors.gold; c.textAlign = 'left'; c.textBaseline = 'bottom';
    c.fillText('tol', ax0 + fs * 0.4, ly(TOL) - 2);
    c.textBaseline = 'middle';
    // x ticks
    c.textAlign = 'center';
    for (var jx = 1; jx <= 4; jx++) {
      var cur = st.s >= 1 && st.s <= 4 && st.k === jx;
      c.fillStyle = cur ? colors.accent : colors.muted;
      c.font = (cur ? '500 ' : '400 ') + tickFs + 'px ' + MONO;
      c.fillText(String(jx), lx(jx), ay1 + fs * 0.8);
    }
    // residual history
    c.strokeStyle = colors.accent; c.lineWidth = 1.2;
    for (var jd = 2; jd <= hk; jd++) {
      var a2 = Math.min(st.dots[jd - 2], st.dots[jd - 1]) * st.hist;
      if (a2 <= 0) continue;
      c.globalAlpha = 0.7 * a2;
      c.beginPath(); c.moveTo(lx(jd - 1), ly(st.r[jd - 2])); c.lineTo(lx(jd), ly(st.r[jd - 1])); c.stroke();
    }
    c.fillStyle = colors.accent;
    for (var jp = 1; jp <= hk; jp++) {
      if (st.dots[jp - 1] * st.hist <= 0) continue;
      c.globalAlpha = st.dots[jp - 1] * st.hist;
      c.beginPath(); c.arc(lx(jp), ly(st.r[jp - 1]), Math.max(2.4, fs * 0.25), 0, 7); c.fill();
    }
    c.globalAlpha = 1;
    if (conv && st.hist > 0.01) {
      c.globalAlpha = st.hist;
      c.font = '500 ' + (fs * 0.92) + 'px ' + MONO; c.textAlign = 'left'; c.fillStyle = colors.accent;
      // left under the tol line after 4 iterations; right of the last dot when it came early
      var cx0 = hk >= 4 ? ax0 + fs * 0.5 : lx(hk) + fs * 0.7;
      c.fillText('converged', cx0, ly(TOL) + fs * 1.1);
      if (wide) { c.font = '400 ' + (fs * 0.82) + 'px ' + MONO; c.fillStyle = colors.muted; c.fillText('in ' + hk + ' iterations', cx0, ly(TOL) + fs * 2.3); }
      c.globalAlpha = 1;
    }
    c.textBaseline = 'alphabetic';
  }

  // static frame (reduced motion / first paint): converged, upscaling to the root
  var STATIC_T = (function () {
    var inc = INCS[2], sg = inc.tl[inc.tl.length - 2];
    return (inc.t0 + sg.t0 + 0.8 * sg.d) / PERIOD;
  })();
  var start = null, raf = 0, visible = true, lastT = STATIC_T;
  // debug hook: ?heroT=0..1 renders one fixed phase of the cycle and does not animate
  var fixedT = null;
  try {
    var qT = new URLSearchParams(window.location.search).get('heroT');
    if (qT !== null && qT !== '' && isFinite(+qT)) { fixedT = ((+qT % 1) + 1) % 1; lastT = fixedT; }
  } catch (e) {}
  function frame(ts) {
    if (start === null) start = ts - lastT * PERIOD; // resume where we paused
    lastT = ((ts - start) % PERIOD) / PERIOD;
    draw(lastT);
    raf = requestAnimationFrame(frame);
  }
  var userPaused = false;
  function play() { if (!raf && !reduceMotion && fixedT === null && !userPaused && visible && !document.hidden) raf = requestAnimationFrame(frame); }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }

  readColors(); layout(); draw(lastT);
  if ('ResizeObserver' in window) {
    new ResizeObserver(function () { layout(); draw(lastT); }).observe(canvas);
  } else {
    window.addEventListener('resize', function () { layout(); draw(lastT); });
  }
  document.addEventListener('themechange', function () { readColors(); draw(lastT); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (!raf) draw(lastT); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) { visible = en[0].isIntersecting; if (visible) play(); else stop(); }).observe(canvas);
  }
  document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else play(); });
  canvas.addEventListener('mousemove', function (e) {
    var r = canvas.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, found = null, bd = 1e9;
    for (var n = 0; n < nodes.length; n++) {
      var d = Math.hypot(nodes[n].x - mx, nodes[n].y - my);
      if (d < Math.max(12, nodes[n].r + 6) && d < bd) { bd = d; found = nodes[n]; }
    }
    if (found !== hover) { hover = found; canvas.style.cursor = found ? 'pointer' : 'default'; if (!raf) draw(lastT); }
  });
  canvas.addEventListener('mouseleave', function () { hover = null; if (!raf) draw(lastT); });
  var pauseBtn = document.querySelector('.hero__pause');
  if (pauseBtn) {
    if (reduceMotion || fixedT !== null) pauseBtn.hidden = true;
    pauseBtn.addEventListener('click', function () {
      userPaused = !userPaused;
      pauseBtn.setAttribute('aria-pressed', String(userPaused));
      pauseBtn.setAttribute('aria-label', userPaused ? 'Play animation' : 'Pause animation');
      if (userPaused) { stop(); start = null; } else play();
    });
  }
  play();
})();
