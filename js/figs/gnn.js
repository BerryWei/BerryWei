/* Fig. 3 \u2014 TACS\u2013GNN\u2013ODMN (schematic).
   Left: an unseen voxel polycrystal with its grain graph (node per grain, edge per
   shared boundary); messages spread outward in two rounds (GNN).
   Two branches meet at the ODMN tree: the GNN sets the interface directions (ticks
   on the internal nodes, blue arrow); TACS clusters the orientations (dots in an
   abstract orientation disk) into 2^N = 4 leaf orientations (grey arrow).
   Two RVEs with deliberately different textures alternate every half loop. */
(function () {
  'use strict';
  if (!window.FigKit) return;
  FigKit.register('gnn', function (api) {
    var NX = 18, NY = 18, NG = 11, NC = 4;
    api.staticT = 0.36;

    function clamp(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
    function seg(h, a, b) { return clamp((h - a) / (b - a)); }

    /* ---- one microstructure + everything derived from it ----
       modes: [hue, share] dominant texture components (rest is random) */
    function build(seed, modes, theta) {
      var r = api.rand(seed), gs = [], own = new Int16Array(NX * NY), i, j, o, q;
      while (gs.length < NG) {                      // well-spaced generators
        var bx = 0, by = 0, bd = -1;
        for (var m = 0; m < 14; m++) {
          var x = 1.2 + r() * (NX - 2.4), y = 1.2 + r() * (NY - 2.4), dm = 1e9;
          gs.forEach(function (g) { dm = Math.min(dm, (g.x - x) * (g.x - x) + (g.y - y) * (g.y - y)); });
          if (dm > bd) { bd = dm; bx = x; by = y; }
        }
        var u = r(), acc = 0, hue = r();               // texture: pick a mode by its share
        for (q = 0; q < modes.length; q++) { acc += modes[q][1]; if (u < acc) { hue = modes[q][0] + (r() - 0.5) * 0.07; break; } }
        gs.push({ x: bx, y: by, hue: (hue + 1) % 1, sat: 0.65 + r() * 0.3, n: 0 });
      }
      for (j = 0; j < NY; j++) for (i = 0; i < NX; i++) {   // plain Voronoi on voxels
        var best = 1e9, bi = 0;
        for (q = 0; q < NG; q++) {
          var ddx = i + 0.5 - gs[q].x, ddy = j + 0.5 - gs[q].y, dd = ddx * ddx + ddy * ddy;
          if (dd < best) { best = dd; bi = q; }
        }
        own[j * NX + i] = bi; gs[bi].n++;
      }
      var key = {}, edges = [], nb = gs.map(function () { return []; });
      function link(a, b) {
        if (a === b) return;
        var k = a < b ? a + '_' + b : b + '_' + a;
        if (key[k]) return;
        key[k] = 1; edges.push([a, b]); nb[a].push(b); nb[b].push(a);
      }
      for (j = 0; j < NY; j++) for (i = 0; i < NX; i++) {
        o = own[j * NX + i];
        if (i + 1 < NX) link(o, own[j * NX + i + 1]);
        if (j + 1 < NY) link(o, own[(j + 1) * NX + i]);
      }
      // message rounds: BFS from two far-apart source grains; edge (a\u2192b) fires in round lv[a]
      var lv = gs.map(function () { return 9; }), s0 = 0, s1 = 0, front = [];
      gs.forEach(function (g, k) { if (g.x + g.y < gs[s0].x + gs[s0].y) s0 = k; if (g.x + g.y > gs[s1].x + gs[s1].y) s1 = k; });
      lv[s0] = lv[s1] = 0; front = [s0, s1];
      for (var d = 1; front.length; d++) {
        var nx = [];
        front.forEach(function (a) { nb[a].forEach(function (b) { if (lv[b] === 9) { lv[b] = Math.min(d, 2); nx.push(b); } }); });
        front = nx;
      }
      var msgs = [];
      edges.forEach(function (e) {
        if (lv[e[0]] < lv[e[1]] && lv[e[0]] < 2) msgs.push([e[0], e[1], lv[e[0]]]);
        else if (lv[e[1]] < lv[e[0]] && lv[e[1]] < 2) msgs.push([e[1], e[0], lv[e[1]]]);
      });
      // TACS: 1-D k-means on hue (cut the circle at its largest gap) into NC clusters
      var ord = gs.map(function (_, k) { return k; }).sort(function (a, b) { return gs[a].hue - gs[b].hue; });
      var gap = -1, cut = 0;
      ord.forEach(function (g, k) { var nh = gs[ord[(k + 1) % NG]].hue + (k === NG - 1 ? 1 : 0), dg = nh - gs[g].hue; if (dg > gap) { gap = dg; cut = (k + 1) % NG; } });
      ord = ord.slice(cut).concat(ord.slice(0, cut));
      var uh = ord.map(function (g, k) { return gs[g].hue + (k > 0 && gs[g].hue < gs[ord[0]].hue ? 1 : 0); });
      var cen = [], cOf = [], it, c;
      for (c = 0; c < NC; c++) cen.push(uh[Math.floor((c + 0.5) * NG / NC)]);
      for (it = 0; it < 12; it++) {
        var sm = [0, 0, 0, 0], cn = [0, 0, 0, 0];
        uh.forEach(function (v, k) {
          var bc = 0; for (c = 1; c < NC; c++) if (Math.abs(v - cen[c]) < Math.abs(v - cen[bc])) bc = c;
          cOf[ord[k]] = bc; sm[bc] += v; cn[bc]++;
        });
        for (c = 0; c < NC; c++) if (cn[c]) cen[c] = sm[c] / cn[c];
      }
      var cl = cen.map(function (hc) { return { hue: hc % 1, w: 0, sat: 0, m: 0, cx: 0, cy: 0 }; });
      var dots = [];
      gs.forEach(function (g, k) {
        var C = cl[cOf[k]];
        C.w += g.n / (NX * NY); C.sat += g.sat; C.m++;
        for (var dd2 = 0; dd2 < 2; dd2++) {          // 2 orientation dots per grain
          var a = (g.hue + (r() - 0.5) * 0.05) * 2 * Math.PI, rad = 0.3 + 0.6 * r();
          dots.push({ x: Math.cos(a) * rad, y: Math.sin(a) * rad, g: k, c: cOf[k] });
        }
      });
      cl.forEach(function (C) {                      // centroid at the cluster's mean orientation
        C.sat = C.m ? C.sat / C.m : 0.7;
        var a = C.hue * 2 * Math.PI; C.cx = Math.cos(a) * 0.6; C.cy = Math.sin(a) * 0.6;
      });
      return { own: own, gs: gs, edges: edges, msgs: msgs, lv: lv, dots: dots, cl: cl, theta: theta, cv: null };
    }
    var RVE = [build(17, [[0.60, 0.45], [0.07, 0.25], [0.78, 0.18]], [25, 120, 60]),  // blue / orange / violet texture
               build(44, [[0.33, 0.45], [0.86, 0.25], [0.14, 0.2]], [150, 40, 105])]; // green, magenta, gold

    /* ---- layout ---- */
    var o = {};
    function lay() {
      var W = api.W, H = api.H;
      o.W = W; o.H = H; o.side = Math.min(W * 0.40, H * 0.68);
      o.x0 = W * 0.05; o.y0 = H * 0.50 - o.side / 2; o.cell = o.side / NX;
      var nar = W < 420 ? 0.02 : 0;                      // narrow: keep ODMN label clear of the pause button
      o.ty = [H * 0.22, H * 0.45, H * 0.70]; o.tx0 = W * (0.69 - nar); o.tx1 = W * (0.95 - nar);  // tree rows
      o.dx = W * 0.55; o.dy = o.ty[2]; o.dr = W * 0.062;                         // TACS disk at leaf row
      o.nr = Math.max(3.6, W * 0.012); o.ir = Math.max(5, W * 0.018); o.wide = W >= 420;
      o.fs = Math.max(10, W * 0.021);
      RVE.forEach(function (R) { R.cv = null; });
    }
    api.onResize(lay);
    function tn(L, k) { return { x: o.tx0 + (o.tx1 - o.tx0) * (k + 0.5) / (1 << L), y: o.ty[L] }; }
    function gp(R, g) { return [o.x0 + R.gs[g].x * o.cell, o.y0 + R.gs[g].y * o.cell]; }

    // static layer (grains, voxel grid, boundaries, graph edges) cached offscreen per RVE
    function layer(R) {
      if (R.cv) return R.cv;
      var cv = document.createElement('canvas'), d = api.dpr, k = o.cell, i, j, dk = api.colors.dark;
      cv.width = Math.ceil(o.side * d); cv.height = cv.width;
      var c = cv.getContext('2d'); c.scale(d, d);
      for (j = 0; j < NY; j++) for (i = 0; i < NX; i++) {
        var g = R.gs[R.own[j * NX + i]];
        c.fillStyle = api.grainFill(g.hue, g.sat); c.fillRect(i * k - 0.3, j * k - 0.3, k + 0.6, k + 0.6);
      }
      c.strokeStyle = dk ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.05)'; c.lineWidth = 1; c.beginPath();
      for (i = 1; i < NX; i++) { c.moveTo(i * k, 0); c.lineTo(i * k, o.side); c.moveTo(0, i * k); c.lineTo(o.side, i * k); }
      c.stroke();
      c.strokeStyle = dk ? 'rgba(0,0,0,.6)' : 'rgba(255,255,255,.95)'; c.lineWidth = 1.5; c.beginPath();
      for (j = 0; j < NY; j++) for (i = 0; i < NX; i++) {
        var w = R.own[j * NX + i];
        if (i + 1 < NX && R.own[j * NX + i + 1] !== w) { c.moveTo((i + 1) * k, j * k); c.lineTo((i + 1) * k, (j + 1) * k); }
        if (j + 1 < NY && R.own[(j + 1) * NX + i] !== w) { c.moveTo(i * k, (j + 1) * k); c.lineTo((i + 1) * k, (j + 1) * k); }
      }
      c.stroke();
      c.globalAlpha = 0.55; c.strokeStyle = api.colors.text; c.lineWidth = 1; c.beginPath();
      R.edges.forEach(function (e) { var a = R.gs[e[0]], b = R.gs[e[1]]; c.moveTo(a.x * k, a.y * k); c.lineTo(b.x * k, b.y * k); });
      c.stroke();
      return (R.cv = cv);
    }

    // per-frame graph: comets along the firing edges, then nodes whose accent ring lights on arrival
    var R0 = 0.12, RD = 0.13;                            // round r runs over h \u2208 [R0 + r\u00b7RD, R0 + (r+1)\u00b7RD]
    function drawNodes(R, alpha, h) {
      var c = api.ctx, col = api.colors, nr = o.nr;
      if (h < 1) R.msgs.forEach(function (m) {
        var u = seg(h, R0 + m[2] * RD, R0 + (m[2] + 1) * RD);
        if (u <= 0 || u >= 1) return;
        var a = gp(R, m[0]), b = gp(R, m[1]), p = api.ease(u), q = Math.max(0, p - 0.35);
        c.globalAlpha = alpha * Math.sin(Math.PI * u); c.strokeStyle = col.accent; c.lineWidth = Math.max(2, o.W * 0.0042); c.lineCap = 'round';
        c.beginPath(); c.moveTo(a[0] + (b[0] - a[0]) * q, a[1] + (b[1] - a[1]) * q);
        c.lineTo(a[0] + (b[0] - a[0]) * p, a[1] + (b[1] - a[1]) * p); c.stroke(); c.lineCap = 'butt';
      });
      R.gs.forEach(function (g, k) {
        var q = gp(R, k), th = g.hue * Math.PI, ta = R0 + R.lv[k] * RD;   // lit when the message arrives
        var lit = R.lv[k] === 0 ? seg(h, R0 - 0.04, R0) : seg(h, ta - 0.02, ta + 0.03);
        c.globalAlpha = alpha;
        c.fillStyle = o.wide ? (lit > 0.5 ? col.accentTint : col.surface) : api.grainFill(g.hue, g.sat, true);
        c.beginPath(); c.arc(q[0], q[1], nr, 0, 7); c.fill();
        c.strokeStyle = lit > 0.5 ? col.accent : col.muted; c.lineWidth = 1 + lit * 0.9; c.stroke();
        if (o.wide) {
          c.strokeStyle = col.text; c.lineWidth = 1.3; c.beginPath();
          c.moveTo(q[0] - Math.cos(th) * nr * 0.65, q[1] - Math.sin(th) * nr * 0.65);
          c.lineTo(q[0] + Math.cos(th) * nr * 0.65, q[1] + Math.sin(th) * nr * 0.65); c.stroke();
        }
      });
      c.globalAlpha = 1;
    }

    // TACS disk: dots slide to their cluster centroid (k \u2208 [0,1]); cluster discs fade in
    function drawTACS(R, alpha, k) {
      if (alpha <= 0) return;
      var c = api.ctx, e = api.ease(k), dr = Math.max(1.8, o.W * 0.005);
      R.dots.forEach(function (d) {
        var C = R.cl[d.c], g = R.gs[d.g];
        c.globalAlpha = alpha * (1 - 0.75 * e); c.fillStyle = api.grainFill(g.hue, g.sat, true);
        c.beginPath(); c.arc(o.dx + (d.x + (C.cx - d.x) * e) * o.dr, o.dy + (d.y + (C.cy - d.y) * e) * o.dr, dr, 0, 7); c.fill();
      });
      R.cl.forEach(function (C) {
        if (!C.m || e <= 0) return;
        var rr = (0.6 + 0.4 * e) * leafR(C.w) * 0.8;
        c.globalAlpha = alpha * e; c.fillStyle = api.grainFill(C.hue, C.sat, true);
        c.beginPath(); c.arc(o.dx + C.cx * o.dr, o.dy + C.cy * o.dr, rr, 0, 7); c.fill();
      });
      c.globalAlpha = 1;
    }
    function leafR(w) { return o.W * (0.007 + 0.034 * Math.sqrt(w)); }
    function lerpAng(a, b, s) { var d = ((b - a) % 180 + 270) % 180 - 90; return a + d * s; }
    function comet(x1, y1, x2, y2, u, color) {                 // short bright dash travelling along an arrow
      if (u <= 0 || u >= 1) return;
      var c = api.ctx, p = api.ease(u), q = Math.max(0, p - 0.3);
      c.globalAlpha = Math.sin(Math.PI * u); c.strokeStyle = color; c.lineWidth = 2.4; c.lineCap = 'round';
      c.beginPath(); c.moveTo(x1 + (x2 - x1) * q, y1 + (y2 - y1) * q); c.lineTo(x1 + (x2 - x1) * p, y1 + (y2 - y1) * p);
      c.stroke(); c.lineCap = 'butt'; c.globalAlpha = 1;
    }

    return {
      theme: function () { RVE.forEach(function (R) { R.cv = null; }); },
      draw: function (t) {
        if (o.W !== api.W) lay();
        var c = api.ctx, col = api.colors, fs = o.fs;
        var half = t < 0.5 ? 0 : 1, h = (t * 2) % 1, cur = RVE[half], prev = RVE[1 - half];
        var f = api.ease(seg(h, 0, 0.1));                       // crossfade to the new RVE
        var kC = seg(h, 0.12, 0.38);                            // TACS clustering (parallel to GNN)
        var uA = seg(h, 0.38, 0.47);                            // both branches deliver to the tree
        var s = api.ease(seg(h, 0.46, 0.58));                   // tree parameters settle \u2192 hold \u2248 1.9 s
        var glow = Math.sin(Math.PI * seg(h, 0.44, 0.68));

        // ---- left: microstructure + grain graph ----
        if (f < 1) { c.drawImage(layer(prev), o.x0, o.y0, o.side, o.side); drawNodes(prev, 1 - f, 1); }
        c.globalAlpha = f; c.drawImage(layer(cur), o.x0, o.y0, o.side, o.side); c.globalAlpha = 1;
        drawNodes(cur, f, h);
        c.strokeStyle = col.muted; c.globalAlpha = 0.6; c.lineWidth = 1;
        c.strokeRect(o.x0, o.y0, o.side, o.side); c.globalAlpha = 1;

        // ---- middle: orientation disk (TACS) ----
        c.strokeStyle = col.rule; c.lineWidth = 1;
        c.beginPath(); c.arc(o.dx, o.dy, o.dr * 1.1, 0, 7); c.stroke();
        drawTACS(prev, 1 - f, 1); drawTACS(cur, f, kC);

        // ---- two branches meet at the ODMN tree ----
        var hd = Math.max(5, o.W * 0.011), xe = o.x0 + o.side + o.W * 0.018;
        var n1 = tn(1, 0), gy = n1.y;                           // GNN \u2192 internal nodes (accent)
        var gx1 = n1.x - o.ir - o.W * 0.012;
        api.arrow(xe, gy, gx1, gy, { color: col.accent, head: hd, width: 1.4 });
        comet(xe, gy, gx1, gy, uA, col.accent);
        var l0 = tn(2, 0), lr0 = leafR(prev.cl[0].w + (cur.cl[0].w - prev.cl[0].w) * s);
        var tx1 = o.dx + o.dr * 1.1 + o.W * 0.012, tx2 = l0.x - lr0 - o.W * 0.01;   // TACS \u2192 leaves
        if (tx2 - tx1 > 10) { api.arrow(tx1, o.dy, tx2, o.dy, { color: col.faint, head: hd }); comet(tx1, o.dy, tx2, o.dy, uA, col.muted); }
        var ix1 = o.x0 + o.side + o.W * 0.006, ix2 = o.dx - o.dr * 1.1 - o.W * 0.006;  // RVE orientations \u2192 disk
        if (ix2 - ix1 > 12) api.arrow(ix1, o.dy, ix2, o.dy, { color: col.faint, head: Math.max(4, hd * 0.8), width: 1 });

        // ---- right: ODMN tree (root, 2 blocks, 4 leaves) ----
        c.strokeStyle = col.muted; c.globalAlpha = 0.45; c.lineWidth = 1.2; c.beginPath();
        for (var L = 1; L <= 2; L++) for (var k = 0; k < (1 << L); k++) {
          var ch = tn(L, k), pa = tn(L - 1, k >> 1), my = (ch.y + pa.y) / 2;
          c.moveTo(pa.x, pa.y); c.bezierCurveTo(pa.x, my, ch.x, my, ch.x, ch.y);
        }
        c.stroke(); c.globalAlpha = 1;
        for (k = 0; k < NC; k++) {                              // leaves = TACS cluster orientations / fractions
          var lf = tn(2, k), Cp = prev.cl[k], Cc = cur.cl[k], rad = leafR(Cp.w + (Cc.w - Cp.w) * s);
          c.beginPath(); c.arc(lf.x, lf.y, rad, 0, 7);
          if (s < 1) { c.fillStyle = api.grainFill(Cp.hue, Cp.sat, true); c.fill(); }
          c.globalAlpha = s; c.fillStyle = api.grainFill(Cc.hue, Cc.sat, true); c.fill(); c.globalAlpha = 1;
        }
        [[0, 0], [1, 0], [1, 1]].forEach(function (lk, n) {    // internal nodes: GNN-inferred interface ticks
          var q = tn(lk[0], lk[1]), ir = o.ir, th = lerpAng(prev.theta[n], cur.theta[n], s) * Math.PI / 180;
          if (glow > 0) { c.strokeStyle = col.gold; c.globalAlpha = glow * 0.8; c.lineWidth = 1.6; c.beginPath(); c.arc(q.x, q.y, ir + 2 + 2.5 * glow, 0, 7); c.stroke(); c.globalAlpha = 1; }
          c.fillStyle = col.surface; c.beginPath(); c.arc(q.x, q.y, ir, 0, 7); c.fill();
          c.strokeStyle = col.accent; c.lineWidth = 1.4; c.stroke();
          c.strokeStyle = col.text; c.lineWidth = 1.4; c.beginPath();
          c.moveTo(q.x - Math.cos(th) * ir * 0.7, q.y - Math.sin(th) * ir * 0.7);
          c.lineTo(q.x + Math.cos(th) * ir * 0.7, q.y + Math.sin(th) * ir * 0.7); c.stroke();
        });

        // ---- labels (5) ----
        var top = o.y0 - fs * 0.7, bot = Math.min(o.H * 0.95, o.dy + o.dr * 1.1 + fs * 1.5);
        api.label('unseen RVE', o.x0, top, { size: fs });
        api.label('ODMN', tn(0, 0).x, top, { size: fs, align: 'center', color: col.text });
        api.label('GNN', (xe + gx1) / 2, gy - fs * 0.6, { size: fs, align: 'center', color: col.accent });
        api.label('TACS \u00b7 2\u1d3a', o.dx, bot, { size: fs, align: 'center' });
        var la = h < 0.1 ? 1 - 0.6 * h / 0.1 : h < 0.5 ? 0.4 : h < 0.58 ? 0.4 + 0.6 * (h - 0.5) / 0.08 : 1;
        c.globalAlpha = la;
        api.label('no retraining', o.tx1, bot, { size: fs, align: 'right', color: la > 0.9 ? col.gold : col.muted });
        c.globalAlpha = 1;
      }
    };
  });
})();
