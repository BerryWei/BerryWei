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
     2^4 leaves of a binary tree. Pulses travel up (homogenize)
     and back down (downscale) while the RVE is stretched.
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

  var W = 0, H = 0, dpr = 1, colors = {}, grid = { x0: 0, y0: 0, cell: 0 };
  function readColors() {
    var cs = getComputedStyle(root);
    var dark = isDark();
    colors = {
      surface: cs.getPropertyValue('--surface').trim() || '#fff',
      text: cs.getPropertyValue('--text').trim() || '#1A1D21',
      muted: cs.getPropertyValue('--muted').trim() || '#5B6470',
      rule: cs.getPropertyValue('--rule').trim() || '#E3E1DA',
      accent: cs.getPropertyValue('--accent').trim() || '#1F4E79',
      gold: cs.getPropertyValue('--gold').trim() || '#9A6A1E',
      dark: dark
    };
    seeds.forEach(function (sd) {
      // IPF-like colouring, softened to sit quietly behind the tree
      var h = Math.round(sd.hue * 360);
      sd.fill = dark ? 'hsl(' + h + ',' + Math.round(sd.sat * 38) + '%,30%)' : 'hsl(' + h + ',' + Math.round(sd.sat * 55) + '%,80%)';
      sd.solid = dark ? 'hsl(' + h + ',' + Math.round(sd.sat * 60) + '%,58%)' : 'hsl(' + h + ',' + Math.round(sd.sat * 60) + '%,46%)';
    });
  }

  function layout() {
    var rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = rect.width; H = rect.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    var pad = W * 0.07;
    var top = H * 0.10, leafY = H * 0.40;
    for (var n = 0; n < nodes.length; n++) {
      var nd = nodes[n], cnt = 1 << nd.L;
      var span = W - 2 * pad;
      nd.x = pad + span * (nd.k + 0.5) / cnt;
      nd.y = top + (leafY - top) * (nd.L / DEPTH);
      nd.r = nd.L === DEPTH ? Math.max(3, Math.sqrt(nd.w) * W * 0.06) : Math.max(4.5, W * 0.013 + nd.w * W * 0.01);
    }
    // square RVE, centred; side leaves room for the stretch (F11 up to 1.08) and labels
    var side = Math.min(H * 0.36, W * 0.46); // room for F11 up to 1.4 plus load arrows
    grid.cell = side / NX;
    grid.x0 = (W - side) / 2; grid.y0 = H * 0.52;
  }

  function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  var hover = null;
  function draw(t) {
    var c = ctx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);

    // cycle: 0-.45 up, .45-.55 hold at root, .55-1 down
    // Schematic only: deformation is deliberately exaggerated (F11 up to FMAX).
    var FMAX = 1.4;
    var F = 1 + (FMAX - 1) * (0.5 - 0.5 * Math.cos(2 * Math.PI * t));
    if (readout) readout.textContent = F.toFixed(3);
    var e = F - 1;

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
        c.fillStyle = seeds[owner[j * NX + i]].fill;
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
    var gy0 = Math.max(pt(0, NY).y, pt(NX, NY).y);

    function anchor(gi) { var sd = seeds[gi]; return map(sd.x, sd.y); }

    // ---- connectors leaf -> grain ----
    c.setLineDash([2, 3]); c.lineWidth = 1;
    for (var q = 0; q < NLEAF; q++) {
      var lf = nodeAt(DEPTH, q), an = anchor(lf.grain);
      c.strokeStyle = colors.muted; c.globalAlpha = 0.35;
      c.beginPath(); c.moveTo(lf.x, lf.y + lf.r); c.lineTo(an.x, an.y); c.stroke();
    }
    c.setLineDash([]); c.globalAlpha = 1;
    for (var q2 = 0; q2 < NLEAF; q2++) {
      var an2 = anchor(nodeAt(DEPTH, q2).grain);
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

    // ---- pulses ----
    // segments: s=0 grain->leaf, s=1..DEPTH level DEPTH-s+1 -> DEPTH-s
    var SEG = DEPTH + 1;
    var phase, upward;
    if (t < 0.45) { phase = t / 0.45; upward = true; }
    else if (t < 0.55) { phase = -1; }
    else { phase = (t - 0.55) / 0.45; upward = false; }
    var rootGlow = 0;
    if (phase >= 0) {
      var segF = phase * SEG, seg = Math.floor(segF), u = easeInOut(segF - seg);
      if (!upward) { seg = SEG - 1 - seg; u = 1 - u; }
      c.fillStyle = upward ? colors.accent : colors.gold;
      for (var m = 0; m < NLEAF; m++) {
        var pt;
        if (seg === 0) {
          var lfm = nodeAt(DEPTH, m), anm = anchor(lfm.grain);
          pt = { x: anm.x + (lfm.x - anm.x) * u, y: anm.y + (lfm.y - anm.y) * u };
        } else {
          var Lc = DEPTH - seg + 1; if (Lc < 1) continue;
          var kc = m >> (DEPTH - Lc);
          if ((m & ((1 << (DEPTH - Lc)) - 1)) !== 0) continue; // one pulse per edge
          var ch2 = nodeAt(Lc, kc), pa = nodeAt(Lc - 1, kc >> 1);
          var my = (pa.y + ch2.y) / 2, v = u, iv = 1 - v;
          // point on cubic bezier from child to parent
          var bx = iv * iv * iv * ch2.x + 3 * iv * iv * v * ch2.x + 3 * iv * v * v * pa.x + v * v * v * pa.x;
          var by = iv * iv * iv * ch2.y + 3 * iv * iv * v * my + 3 * iv * v * v * my + v * v * v * pa.y;
          pt = { x: bx, y: by };
        }
        c.globalAlpha = 0.18; c.beginPath(); c.arc(pt.x, pt.y, 7, 0, 7); c.fill();
        c.globalAlpha = 1; c.beginPath(); c.arc(pt.x, pt.y, 2.6, 0, 7); c.fill();
      }
    } else {
      rootGlow = Math.sin(((t - 0.45) / 0.1) * Math.PI);
    }

    // ---- nodes ----
    for (var n2 = 0; n2 < nodes.length; n2++) {
      var nn = nodes[n2];
      var isLeaf = nn.L === DEPTH;
      if (nn.L === 0 && rootGlow > 0) {
        c.fillStyle = colors.accent; c.globalAlpha = 0.18 * rootGlow;
        c.beginPath(); c.arc(nn.x, nn.y, nn.r + 12 * rootGlow, 0, 7); c.fill(); c.globalAlpha = 1;
      }
      c.beginPath(); c.arc(nn.x, nn.y, nn.r, 0, 7);
      c.fillStyle = isLeaf ? seeds[nn.grain].solid : colors.surface; c.fill();
      c.lineWidth = hover === nn ? 2.2 : 1.3;
      c.strokeStyle = isLeaf ? colors.surface : (nn.L === 0 ? colors.accent : colors.text);
      c.stroke();
      if (!isLeaf) {
        // laminate direction of this building block (rotates slightly with load)
        var th = (nn.theta + (F - 1) * 70 * (nn.k % 2 ? 1 : -1)) * Math.PI / 180, rr = nn.r * 0.72;
        c.strokeStyle = nn.L === 0 ? colors.accent : colors.text; c.lineWidth = 1.2;
        c.beginPath(); c.moveTo(nn.x - Math.cos(th) * rr, nn.y - Math.sin(th) * rr); c.lineTo(nn.x + Math.cos(th) * rr, nn.y + Math.sin(th) * rr); c.stroke();
      }
    }

    // ---- labels ----
    c.font = '500 ' + Math.max(10, W * 0.022) + 'px "JetBrains Mono", ui-monospace, monospace';
    c.fillStyle = colors.muted; c.textAlign = 'left';
    var rt = nodeAt(0, 0);
    c.fillText('macro \u03c3\u0304, \u2102\u0304', rt.x + rt.r + 10, rt.y + 4);
    c.textAlign = 'right';
    var labY = H - Math.max(10, W * 0.03);
    c.fillText('RVE \u00b7 ' + NLEAF + ' grains', W - W * 0.04, labY);
    c.textAlign = 'left';
    c.fillText(upward === false && phase >= 0 ? '\u2193 downscale' : (phase < 0 ? '\u25cf update' : '\u2191 homogenize'), W * 0.04, labY);

    // ---- hover tooltip ----
    if (hover) {
      var label = hover.L === DEPTH
        ? 'grain ' + (hover.grain + 1) + ' \u00b7 w = ' + hover.w.toFixed(3)
        : (hover.L === 0 ? 'root \u00b7 homogenized RVE' : 'block L' + hover.L + ' \u00b7 \u03b8 = ' + hover.theta + '\u00b0 \u00b7 w = ' + hover.w.toFixed(3));
      c.font = '500 ' + Math.max(11, W * 0.022) + 'px "JetBrains Mono", ui-monospace, monospace';
      var tw = c.measureText(label).width + 14, th2 = Math.max(22, W * 0.045);
      var tx = Math.min(Math.max(hover.x - tw / 2, 6), W - tw - 6), ty = hover.y - hover.r - th2 - 8;
      if (ty < 4) ty = hover.y + hover.r + 8;
      c.fillStyle = colors.text; c.globalAlpha = 0.92;
      c.beginPath(); if (c.roundRect) c.roundRect(tx, ty, tw, th2, 5); else c.rect(tx, ty, tw, th2); c.fill();
      c.globalAlpha = 1; c.fillStyle = colors.surface; c.textAlign = 'left'; c.textBaseline = 'middle';
      c.fillText(label, tx + 7, ty + th2 / 2 + 1); c.textBaseline = 'alphabetic';
    }
  }

  var PERIOD = 9000, start = null, raf = 0, visible = true, lastT = 0.32;
  function frame(ts) {
    if (start === null) start = ts - lastT * PERIOD; // resume where we paused
    lastT = ((ts - start) % PERIOD) / PERIOD;
    draw(lastT);
    raf = requestAnimationFrame(frame);
  }
  var userPaused = false;
  function play() { if (!raf && !reduceMotion && !userPaused && visible && !document.hidden) raf = requestAnimationFrame(frame); }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }

  readColors(); layout(); draw(lastT);
  if ('ResizeObserver' in window) {
    new ResizeObserver(function () { layout(); draw(lastT); }).observe(canvas);
  } else {
    window.addEventListener('resize', function () { layout(); draw(lastT); });
  }
  document.addEventListener('themechange', function () { readColors(); draw(lastT); });
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
    if (reduceMotion) pauseBtn.hidden = true;
    pauseBtn.addEventListener('click', function () {
      userPaused = !userPaused;
      pauseBtn.setAttribute('aria-pressed', String(userPaused));
      pauseBtn.setAttribute('aria-label', userPaused ? 'Play animation' : 'Pause animation');
      if (userPaused) { stop(); start = null; } else play();
    });
  }
  play();
})();
