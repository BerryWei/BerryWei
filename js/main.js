/* Ting-Ju (Berry) Wei — site script (no dependencies) */
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
  var NX = 40, NY = 17;

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
    var top = H * 0.13, leafY = H * 0.47;
    for (var n = 0; n < nodes.length; n++) {
      var nd = nodes[n], cnt = 1 << nd.L;
      var span = W - 2 * pad;
      nd.x = pad + span * (nd.k + 0.5) / cnt;
      nd.y = top + (leafY - top) * (nd.L / DEPTH);
      nd.r = nd.L === DEPTH ? Math.max(3, Math.sqrt(nd.w) * W * 0.06) : Math.max(4.5, W * 0.013 + nd.w * W * 0.01);
    }
    var gpad = W * 0.13; // leave room for the stretch (F11 up to 1.08) and load arrows
    grid.cell = (W - 2 * gpad) / NX;
    grid.x0 = gpad; grid.y0 = H * 0.585;
  }

  function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  var hover = null;
  function draw(t) {
    var c = ctx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);

    // cycle: 0-.45 up, .45-.55 hold at root, .55-1 down
    var F = 1 + 0.08 * (0.5 - 0.5 * Math.cos(2 * Math.PI * t));
    if (readout) readout.textContent = F.toFixed(3);

    // ---- polycrystal (stretched about its centre, volume preserving) ----
    var gw = NX * grid.cell, gh = NY * grid.cell;
    var cxm = grid.x0 + gw / 2, cym = grid.y0 + gh / 2;
    var sx = F, sy = 1 / Math.sqrt(F);
    var cw = grid.cell * sx, ch = grid.cell * sy;
    var gx0 = cxm - gw * sx / 2, gy0 = cym - gh * sy / 2;
    for (var j = 0; j < NY; j++) {
      for (var i = 0; i < NX; i++) {
        c.fillStyle = seeds[owner[j * NX + i]].fill;
        c.fillRect(gx0 + i * cw, gy0 + j * ch, cw + 0.6, ch + 0.6);
      }
    }
    // grain boundaries
    c.strokeStyle = colors.dark ? 'rgba(0,0,0,.55)' : 'rgba(255,255,255,.95)';
    c.lineWidth = 1.4;
    c.beginPath();
    for (var j2 = 0; j2 < NY; j2++) {
      for (var i2 = 0; i2 < NX; i2++) {
        var o = owner[j2 * NX + i2];
        if (i2 + 1 < NX && owner[j2 * NX + i2 + 1] !== o) { c.moveTo(gx0 + (i2 + 1) * cw, gy0 + j2 * ch); c.lineTo(gx0 + (i2 + 1) * cw, gy0 + (j2 + 1) * ch); }
        if (j2 + 1 < NY && owner[(j2 + 1) * NX + i2] !== o) { c.moveTo(gx0 + i2 * cw, gy0 + (j2 + 1) * ch); c.lineTo(gx0 + (i2 + 1) * cw, gy0 + (j2 + 1) * ch); }
      }
    }
    c.stroke();
    // voxel hint
    c.strokeStyle = colors.dark ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.035)';
    c.lineWidth = 1;
    c.beginPath();
    for (var i3 = 1; i3 < NX; i3++) { c.moveTo(gx0 + i3 * cw, gy0); c.lineTo(gx0 + i3 * cw, gy0 + NY * ch); }
    for (var j3 = 1; j3 < NY; j3++) { c.moveTo(gx0, gy0 + j3 * ch); c.lineTo(gx0 + NX * cw, gy0 + j3 * ch); }
    c.stroke();
    c.strokeStyle = colors.muted; c.globalAlpha = 0.5; c.lineWidth = 1;
    c.strokeRect(gx0, gy0, NX * cw, NY * ch);
    c.globalAlpha = 1;

    // loading arrows
    c.strokeStyle = colors.muted; c.fillStyle = colors.muted; c.lineWidth = 1.2;
    var ay = gy0 + NY * ch / 2, al = W * 0.035;
    [[gx0 - 4, -1], [gx0 + NX * cw + 4, 1]].forEach(function (a) {
      c.beginPath(); c.moveTo(a[0], ay); c.lineTo(a[0] + a[1] * al, ay); c.stroke();
      c.beginPath(); c.moveTo(a[0] + a[1] * (al + 5), ay); c.lineTo(a[0] + a[1] * al, ay - 3.5); c.lineTo(a[0] + a[1] * al, ay + 3.5); c.closePath(); c.fill();
    });

    // grain anchor positions (seed, stretched; use nearest periodic image inside box)
    function anchor(gi) {
      var sd = seeds[gi];
      return { x: gx0 + sd.x * cw, y: gy0 + sd.y * ch };
    }

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
        var th = (nn.theta + (F - 1) * 60 * (nn.k % 2 ? 1 : -1)) * Math.PI / 180, rr = nn.r * 0.72;
        c.strokeStyle = nn.L === 0 ? colors.accent : colors.text; c.lineWidth = 1.2;
        c.beginPath(); c.moveTo(nn.x - Math.cos(th) * rr, nn.y - Math.sin(th) * rr); c.lineTo(nn.x + Math.cos(th) * rr, nn.y + Math.sin(th) * rr); c.stroke();
      }
    }

    // ---- labels ----
    c.font = '500 ' + Math.max(10, W * 0.022) + 'px "JetBrains Mono", ui-monospace, monospace';
    c.fillStyle = colors.muted; c.textAlign = 'right';
    var rt = nodeAt(0, 0);
    c.fillText('macro  σ̄, ℂ̄', W - W * 0.04, rt.y + 4);
    c.fillText('RVE · ' + NLEAF + ' grains', W - W * 0.04, gy0 + NY * ch + Math.max(16, W * 0.04));
    c.textAlign = 'left';
    c.fillText(upward === false && phase >= 0 ? '↓ downscale' : (phase < 0 ? '● update' : '↑ homogenize'), W * 0.04, gy0 + NY * ch + Math.max(16, W * 0.04));

    // ---- hover tooltip ----
    if (hover) {
      var label = hover.L === DEPTH
        ? 'grain ' + (hover.grain + 1) + ' · w = ' + hover.w.toFixed(3)
        : (hover.L === 0 ? 'root · homogenized RVE' : 'block L' + hover.L + ' · θ = ' + hover.theta + '° · w = ' + hover.w.toFixed(3));
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
