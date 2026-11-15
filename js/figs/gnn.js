/* Fig. 3 \u2014 TACS\u2013GNN\u2013ODMN (schematic).
   One periodic RVE, seen twice (same tile, same size, left column):
   Top (GNN): the RVE as a grain graph (periodic: edges that cross the box leave
   one side and re-enter on the other). Two rounds of graph-attention message
   passing: each node in turn receives comets from its neighbours (directed
   attention = width of the incoming edge), its halo pulses as it aggregates and
   its fill drifts from grain colour to a learned embedding colour. A readout
   pools every node into one point on the box edge; one fat comet carries it to
   the latent vector, which then fans out to all internal ODMN nodes and sets
   their interface directions (ticks).
   Bottom (TACS): the same tile as an EBSD IPF-Z orientation map (saturated
   colours, intra-grain noise, black boundaries) is raster-scanned; sampled
   orientations fly into the IPF standard triangle as a diffuse cloud, which
   k-means (3 visible iterations) carves into exactly 2^N = 4 weighted
   orientations that become the tree leaves. The tree then evaluates (pulses).
   Two RVEs with different textures alternate every half loop: no retraining.
   Idle stretches keep a low attention shimmer, halo breathing and a flash that
   ties the same grain in both views. */
(function () {
  'use strict';
  if (!window.FigKit) return;
  FigKit.register('gnn', function (api) {
    var N = 24, NG = 17, NC = 4, NB = 5, SG = 2, NSR = N / SG;      // grid, grains, clusters, latent cells, sample stride
    var TW = Math.tan(Math.PI / 8);                                  // stereographic x of 101
    api.period = 13000;
    api.staticT = 0.36;

    function clamp(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
    function seg(h, a, b) { return clamp((h - a) / (b - a)); }
    function es(h, a, b) { return api.ease(seg(h, a, b)); }
    function lerp(a, b, s) { return a + (b - a) * s; }

    /* ---- orientation helpers (sample direction in crystal frame, cubic symmetry) ---- */
    function nrm(d) { var l = Math.sqrt(d[0] * d[0] + d[1] * d[1] + d[2] * d[2]) || 1; return [d[0] / l, d[1] / l, d[2] / l]; }
    function fold(d) {                                   // into the standard triangle: z >= x >= y >= 0
      var a = [Math.abs(d[0]), Math.abs(d[1]), Math.abs(d[2])].sort(function (p, q) { return p - q; });
      return nrm([a[1], a[0], a[2]]);
    }
    function dirOf(X, Y) { var s = 1 + X * X + Y * Y; return [2 * X / s, 2 * Y / s, (1 - X * X - Y * Y) / s]; }
    function stereo(d) { return [d[0] / (1 + d[2]), d[1] / (1 + d[2])]; }
    function ipfRGB(d) {                                 // IPF key: 001 red, 101 green, 111 blue
      var r = d[2] - d[0], g = d[0] - d[1], b = d[1] * 1.7320508, m = Math.max(r, g, b) || 1;
      return [Math.pow(r / m, 0.6), Math.pow(g / m, 0.6), Math.pow(b / m, 0.6)];
    }
    function hueSat(rgb) {
      var r = rgb[0], g = rgb[1], b = rgb[2], mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, h = 0;
      if (d > 1e-6) {
        if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
        h /= 6; if (h < 0) h += 1;
      }
      return [h, 0.35 + 0.6 * d];
    }
    function mix(a, b, k) { return [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)]; }
    function rgbStr(c, k, a) {
      return 'rgba(' + Math.round(255 * clamp(c[0] * k)) + ',' + Math.round(255 * clamp(c[1] * k)) + ',' + Math.round(255 * clamp(c[2] * k)) + ',' + (a === undefined ? 1 : a) + ')';
    }
    function parseCol(s, dk) {
      s = (s || '').trim(); var m;
      if (s.charAt(0) === '#') {
        if (s.length === 4) s = '#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
        return [parseInt(s.substr(1, 2), 16) / 255, parseInt(s.substr(3, 2), 16) / 255, parseInt(s.substr(5, 2), 16) / 255];
      }
      m = s.match(/rgba?\(([^)]+)\)/);
      if (m) { var p = m[1].split(',').map(parseFloat); return [p[0] / 255, p[1] / 255, p[2] / 255]; }
      return dk ? [0.1, 0.11, 0.12] : [1, 1, 1];
    }

    /* ---- one periodic microstructure + everything derived from it ----
       modes: [[X, Y] (stereographic, inside the triangle), share, spread]; the rest is random texture */
    function build(seed, modes, theta, bar) {
      var r = api.rand(seed), gs = [], own = new Int16Array(N * N), i, j, k, q;
      function gauss() { return (r() + r() + r() + r() - 2) * 1.22; }
      function jit(d, s) { return fold([d[0] + gauss() * s, d[1] + gauss() * s, d[2] + gauss() * s]); }
      function pdx(a) { return a > N / 2 ? a - N : a < -N / 2 ? a + N : a; }
      while (gs.length < NG) {                                        // well-spaced generators (periodic distance)
        var bx = 0, by = 0, bd = -1;
        for (var m = 0; m < 16; m++) {
          var x = 0.9 + r() * (N - 1.8), y = 0.9 + r() * (N - 1.8), dm = 1e9;
          gs.forEach(function (g) { var dx = pdx(g.x - x), dy = pdx(g.y - y); dm = Math.min(dm, dx * dx + dy * dy); });
          if (dm > bd) { bd = dm; bx = x; by = y; }
        }
        var u = r(), acc = 0, d = null;
        for (q = 0; q < modes.length; q++) {
          acc += modes[q][1];
          if (u < acc) { d = jit(dirOf(modes[q][0][0], modes[q][0][1]), modes[q][2]); break; }
        }
        if (!d) d = fold([gauss(), gauss(), gauss()]);
        gs.push({ x: bx, y: by, d: d, gr: [gauss() * 0.35, gauss() * 0.35], rgb: ipfRGB(d), n: 0, emb: r(), ph: r() });
      }
      for (j = 0; j < N; j++) for (i = 0; i < N; i++) {              // periodic Voronoi
        var best = 1e9, bi = 0;
        for (q = 0; q < NG; q++) {
          var ddx = pdx(i + 0.5 - gs[q].x), ddy = pdx(j + 0.5 - gs[q].y), dd = ddx * ddx + ddy * ddy;
          if (dd < best) { best = dd; bi = q; }
        }
        own[j * N + i] = bi; gs[bi].n++;
      }
      // EBSD pixels: grain orientation + intra-grain misorientation noise
      var prgb = [], pdir = [];
      for (k = 0; k < N * N; k++) { var gg = gs[own[k]], pd = jit([gg.d[0] + gg.gr[0] * ((k % N) - gg.x) / N, gg.d[1] + gg.gr[1] * (Math.floor(k / N) - gg.y) / N, gg.d[2]], 0.06); pdir.push(pd); prgb.push(ipfRGB(pd)); }
      // periodic grain graph
      var key = {}, edges = [], indeg = gs.map(function () { return 0; });
      function link(a, b) {
        if (a === b) return;
        var kk = a < b ? a + '_' + b : b + '_' + a;
        if (key[kk]) return;
        key[kk] = 1;
        var rx = gs[b].x - gs[a].x, ry = gs[b].y - gs[a].y, dx = pdx(rx), dy = pdx(ry);
        edges.push({ a: a, b: b, dx: dx, dy: dy, wrap: dx !== rx || dy !== ry, ph: r(), aw: 0 });
        indeg[a]++; indeg[b]++;
      }
      for (j = 0; j < N; j++) for (i = 0; i < N; i++) {
        var o = own[j * N + i];
        link(o, own[j * N + (i + 1) % N]); link(o, own[((j + 1) % N) * N + i]);
      }
      // directed edges with per-round softmax attention over each target's neighbours
      var de = [];
      edges.forEach(function (e, n) {
        de.push({ a: e.a, b: e.b, e: n, sg: 1, j: [r() * 0.07, r() * 0.07] });
        de.push({ a: e.b, b: e.a, e: n, sg: -1, j: [r() * 0.07, r() * 0.07] });
      });
      var ap = [0, 1].map(function () {
        var sc = de.map(function () { return Math.exp(1.3 * gauss()); }), Z = gs.map(function () { return 0; });
        de.forEach(function (d, n) { Z[d.b] += sc[n]; });
        return de.map(function (d, n) { return Math.max(0.25, Math.min(2.2, sc[n] / Z[d.b] * indeg[d.b])); });
      });
      de.forEach(function (d, n) { d.ap = [ap[0][n], ap[1][n]]; edges[d.e].aw += 0.25 * (ap[0][n] + ap[1][n]); });
      var phi = [0, 1].map(function () {                              // order in which nodes aggregate in each round
        var ids = gs.map(function (g, n) { return n; }), out = [];
        for (k = ids.length - 1; k > 0; k--) { q = Math.floor(r() * (k + 1)); var t = ids[k]; ids[k] = ids[q]; ids[q] = t; }
        ids.forEach(function (g, n) { out[g] = 0.55 * n / (NG - 1); });
        return out;
      });
      // TACS samples: NSR x NSR raster on the map
      var samples = [];
      for (j = 0; j < NSR; j++) for (i = 0; i < NSR; i++) {
        var pi = i * SG + 1, pj = j * SG + 1, kk2 = pj * N + pi, st = stereo(pdir[kk2]);
        samples.push({ i: pi, j: pj, r: j, c: i, X: st[0], Y: st[1], rgb: prgb[kk2] });
      }
      // k-means in IPF (stereographic) coords, from a poor central init so iterations are visible
      var cs = [[[0.13, 0.03], [0.2, 0.09], [0.26, 0.04], [0.27, 0.15]]], asg = [], cnt = [];
      function assign(C) {
        return samples.map(function (s) {
          var bc = 0, bdd = 1e9;
          C.forEach(function (c, n) { var dx = s.X - c[0], dy = s.Y - c[1], d2 = dx * dx + dy * dy; if (d2 < bdd) { bdd = d2; bc = n; } });
          return bc;
        });
      }
      var C = cs[0];
      for (var it = 0; it < 30; it++) {
        var A = assign(C), sm = C.map(function () { return [0, 0, 0]; });
        A.forEach(function (c, n) { sm[c][0] += samples[n].X; sm[c][1] += samples[n].Y; sm[c][2]++; });
        if (it < 3) { asg.push(A); cnt.push(sm.map(function (v) { return v[2] / samples.length; })); }
        C = C.map(function (c, n) { return sm[n][2] ? [sm[n][0] / sm[n][2], sm[n][1] / sm[n][2]] : c; });
        C.forEach(function (c, n) {                                   // empty cluster: reseed at the worst-fitting sample
          if (sm[n][2]) return;
          var fw = 0, fd = -1;
          samples.forEach(function (s, m) { var cc = C[A[m]], dx = s.X - cc[0], dy = s.Y - cc[1], d2 = dx * dx + dy * dy; if (d2 > fd) { fd = d2; fw = m; } });
          C[n] = [samples[fw].X, samples[fw].Y];
        });
        if (it < 2) cs.push(C);
      }
      cs.push(C);
      var Af = assign(C), wf = C.map(function () { return 0; });
      Af.forEach(function (c) { wf[c] += 1 / samples.length; });
      cnt.push(wf);
      // leaf order along 001 -> 101 -> 111
      var ids2 = [0, 1, 2, 3].sort(function (a, b) { return (C[a][0] + 2 * C[a][1]) - (C[b][0] + 2 * C[b][1]); }), slot = [];
      ids2.forEach(function (id, n) { slot[id] = n; });
      function re(arr) { var out = []; arr.forEach(function (v, n) { out[slot[n]] = v; }); return out; }
      cs = cs.map(re); cnt = cnt.map(re); asg = asg.map(function (A2) { return A2.map(function (c) { return slot[c]; }); });
      var cl = C.map(function (c, n) {
        var rgb = ipfRGB(dirOf(c[0], c[1])), hs = hueSat(rgb);
        return { X: c[0], Y: c[1], wt: wf[n], rgb: rgb, hue: hs[0], sat: hs[1] };
      });
      cl = re(cl);
      // the grain that is flashed in both views (connector across the gap)
      var tie = 0, tb = -1;
      gs.forEach(function (g, n) { var sc2 = g.n * (g.x > 0.42 * N && g.x < 0.88 * N ? 1 : 0.2) * (g.y > 0.45 * N ? 1 : 0.3); if (sc2 > tb) { tb = sc2; tie = n; } });
      var tseg = [];
      for (j = 0; j < N; j++) for (i = 0; i < N; i++) {
        if (own[j * N + i] !== tie) continue;
        if (i === 0 || own[j * N + i - 1] !== tie) tseg.push([i, j, i, j + 1]);
        if (i === N - 1 || own[j * N + i + 1] !== tie) tseg.push([i + 1, j, i + 1, j + 1]);
        if (j === 0 || own[(j - 1) * N + i] !== tie) tseg.push([i, j, i + 1, j]);
        if (j === N - 1 || own[(j + 1) * N + i] !== tie) tseg.push([i, j + 1, i + 1, j + 1]);
      }
      return { own: own, prgb: prgb, gs: gs, edges: edges, de: de, phi: phi, samples: samples,
        cs: cs, asg: asg, cnt: cnt, cl: cl, tie: tie, tseg: tseg, theta: theta, bar: bar, cv: null, mv: null };
    }
    var RVE = [
      build(17, [[[0.02, 0.01], 0.3, 0.14], [[0.34, 0.32], 0.24, 0.14], [[0.38, 0.06], 0.16, 0.1]], [25, 120, 60], [0.9, 0.35, 0.7, 0.5, 0.8]),
      build(44, [[[0.39, 0.03], 0.32, 0.14], [[0.18, 0.03], 0.2, 0.12], [[0.33, 0.2], 0.18, 0.12]], [150, 40, 105], [0.45, 0.85, 0.3, 0.95, 0.6])
    ];

    /* ---- layout ---- */
    var o = {};
    function lay() {
      var W = api.W, H = api.H;
      o.W = W; o.H = H; o.fs = Math.max(10, W * 0.021); o.big = W >= 440;
      o.s = H * 0.40; o.gx = W * 0.04; o.gy = H * 0.05; o.cell = o.s / N;   // graph RVE (top) and EBSD map (bottom): same tile, same size
      o.mx = o.gx; o.my = H * 0.555;
      o.tw = W * 0.19; o.A = [W * 0.355, H * 0.86];                          // IPF triangle (001 corner)
      o.ty = [H * 0.12, H * 0.40, H * 0.68]; o.tx0 = W * 0.62; o.tx1 = W * 0.95;  // tree rows (even spacing)
      o.bc = Math.max(8, W * 0.03); o.bg = o.bc * 0.3; o.bh = NB * o.bc + (NB - 1) * o.bg;
      o.bx = W * 0.465; o.yc = o.gy + o.s / 2; o.by = o.yc - o.bh / 2;      // latent vector
      o.P = [o.gx + o.s, o.yc];                                              // readout pool point on the RVE edge
      o.nr = Math.max(3.4, W * 0.0115); o.ir = Math.max(5.5, W * 0.018);
      o.dr = Math.max(1.3, W * 0.0033);
      o.yb = o.ty[2] + W * 0.046;                                            // leaf bracket
      RVE.forEach(function (R) { R.cv = R.mv = null; });
      o.tri = null;
    }
    api.onResize(lay);
    function tn(L, k) { return { x: o.tx0 + (o.tx1 - o.tx0) * (k + 0.5) / (1 << L), y: o.ty[L] }; }
    function gp(R, g) { return [o.gx + R.gs[g].x * o.cell, o.gy + R.gs[g].y * o.cell]; }
    function tp(X, Y) { return [o.A[0] + X / TW * o.tw, o.A[1] - Y / TW * o.tw]; }
    function mp(i, j) { return [o.mx + (i + 0.5) * o.cell, o.my + (j + 0.5) * o.cell]; }
    function leafR(w) { return o.W * (0.006 + 0.03 * Math.sqrt(w)); }
    function lerpAng(a, b, s) { var d = ((b - a) % 180 + 270) % 180 - 90; return a + d * s; }
    function pieces(R, a, dx, dy, b, wrap) {            // a -> b in pixels; periodic edges give two clipped stubs
      var pa = gp(R, a), k = o.cell, out = [[pa[0], pa[1], pa[0] + dx * k, pa[1] + dy * k]];
      if (wrap) { var pb = gp(R, b); out.push([pb[0] - dx * k, pb[1] - dy * k, pb[0], pb[1]]); }
      return out;
    }

    /* ---- cached static layers ---- */
    var surf = [1, 1, 1];
    function layer(R) {                                 // soft voxel grains of the graph RVE (same hues as the map)
      if (R.cv) return R.cv;
      var cv = document.createElement('canvas'), d = api.dpr, k = o.cell, i, j, dk = api.colors.dark;
      cv.width = cv.height = Math.ceil(o.s * d);
      var c = cv.getContext('2d'); c.scale(d, d);
      var fills = R.gs.map(function (g) { return dk ? rgbStr(mix(g.rgb, surf, 0.58), 0.95) : rgbStr(mix(g.rgb, surf, 0.6), 1); });
      for (j = 0; j < N; j++) for (i = 0; i < N; i++) { c.fillStyle = fills[R.own[j * N + i]]; c.fillRect(i * k - 0.3, j * k - 0.3, k + 0.6, k + 0.6); }
      c.strokeStyle = dk ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.04)'; c.lineWidth = 1; c.beginPath();
      for (i = 1; i < N; i++) { c.moveTo(i * k, 0); c.lineTo(i * k, o.s); c.moveTo(0, i * k); c.lineTo(o.s, i * k); }
      c.stroke();
      c.strokeStyle = dk ? 'rgba(0,0,0,.55)' : 'rgba(255,255,255,.95)'; c.lineWidth = 1.4; c.beginPath();
      for (j = 0; j < N; j++) for (i = 0; i < N; i++) {
        var w = R.own[j * N + i];
        if (i + 1 < N && R.own[j * N + i + 1] !== w) { c.moveTo((i + 1) * k, j * k); c.lineTo((i + 1) * k, (j + 1) * k); }
        if (j + 1 < N && R.own[(j + 1) * N + i] !== w) { c.moveTo(i * k, (j + 1) * k); c.lineTo((i + 1) * k, (j + 1) * k); }
      }
      c.stroke();
      return (R.cv = cv);
    }
    function mapLayer(R) {                              // EBSD IPF-Z map: saturated, pixelated, noisy, black GBs
      if (R.mv) return R.mv;
      var cv = document.createElement('canvas'), d = api.dpr, k = o.cell, i, j, dk = api.colors.dark;
      cv.width = cv.height = Math.ceil(o.s * d);
      var c = cv.getContext('2d'); c.scale(d, d);
      for (j = 0; j < N; j++) for (i = 0; i < N; i++) {
        c.fillStyle = rgbStr(R.prgb[j * N + i], dk ? 0.8 : 0.95);
        c.fillRect(i * k - 0.2, j * k - 0.2, k + 0.4, k + 0.4);
      }
      c.strokeStyle = 'rgba(0,0,0,.7)'; c.lineWidth = Math.max(1, o.W * 0.0016); c.beginPath();
      for (j = 0; j < N; j++) for (i = 0; i < N; i++) {
        var w = R.own[j * N + i];
        if (i + 1 < N && R.own[j * N + i + 1] !== w) { c.moveTo((i + 1) * k, j * k); c.lineTo((i + 1) * k, (j + 1) * k); }
        if (j + 1 < N && R.own[(j + 1) * N + i] !== w) { c.moveTo(i * k, (j + 1) * k); c.lineTo((i + 1) * k, (j + 1) * k); }
      }
      c.stroke();
      return (R.mv = cv);
    }
    function triLayer() {                               // IPF colour key over the true stereographic standard triangle
      if (o.tri) return o.tri;
      var d = api.dpr, x0 = o.A[0], y0 = o.A[1] - o.tw * 0.884 - 1, w = o.tw + 2, h = o.tw * 0.884 + 2, dk = api.colors.dark;
      var cv = document.createElement('canvas'); cv.width = Math.ceil(w * d); cv.height = Math.ceil(h * d);
      var c = cv.getContext('2d'), img = c.createImageData(cv.width, cv.height), D = img.data, a = dk ? 0.5 : 0.24;
      for (var py = 0; py < cv.height; py++) for (var px = 0; px < cv.width; px++) {
        var X = (x0 + (px + 0.5) / d - o.A[0]) / o.tw * TW, Y = (o.A[1] - (y0 + (py + 0.5) / d)) / o.tw * TW;
        if (Y < 0 || Y > X) continue;
        var dd = dirOf(X, Y);
        if (dd[0] > dd[2]) continue;
        var col = ipfRGB(dd), n = (py * cv.width + px) * 4;
        if (dk) col = mix(col, [1, 1, 1], 0.38);
        D[n] = 255 * col[0]; D[n + 1] = 255 * col[1]; D[n + 2] = 255 * col[2]; D[n + 3] = 255 * a;
      }
      c.putImageData(img, 0, 0);
      var arc = [];
      for (var s = 0; s <= 14; s++) { var st = stereo(nrm([1, s / 14, 1])); arc.push(tp(st[0], st[1])); }
      return (o.tri = { cv: cv, x: x0, y: y0, w: cv.width / d, h: cv.height / d, arc: arc });
    }

    /* ---- small drawing helpers ---- */
    function comet(x1, y1, x2, y2, u, color, wd, cx, cy) {     // bright dash travelling along a line / quadratic
      if (u <= 0 || u >= 1) return;
      var c = api.ctx, p = api.ease(u), q = Math.max(0, p - 0.28), n = 6;
      c.globalAlpha *= Math.sin(Math.PI * u); c.strokeStyle = color; c.lineWidth = wd || 2.2; c.lineCap = 'round';
      c.beginPath();
      for (var s = 0; s <= n; s++) {
        var v = q + (p - q) * s / n, iv = 1 - v, X, Y;
        if (cx === undefined) { X = x1 + (x2 - x1) * v; Y = y1 + (y2 - y1) * v; }
        else { X = iv * iv * x1 + 2 * iv * v * cx + v * v * x2; Y = iv * iv * y1 + 2 * iv * v * cy + v * v * y2; }
        if (s) c.lineTo(X, Y); else c.moveTo(X, Y);
      }
      c.stroke(); c.lineCap = 'butt';
    }
    function qpt(x1, y1, cx, cy, x2, y2, v) { var iv = 1 - v; return [iv * iv * x1 + 2 * iv * v * cx + v * v * x2, iv * iv * y1 + 2 * iv * v * cy + v * v * y2]; }
    function head(x, y, ang, hl, color) {
      var c = api.ctx; c.fillStyle = color; c.beginPath(); c.moveTo(x, y);
      c.lineTo(x - hl * Math.cos(ang - 0.45), y - hl * Math.sin(ang - 0.45));
      c.lineTo(x - hl * Math.cos(ang + 0.45), y - hl * Math.sin(ang + 0.45)); c.closePath(); c.fill();
    }
    function bezT(ch, pa, u) {                          // point on a tree edge (parent pa -> child ch), u from parent
      var my = (pa.y + ch.y) / 2, iv = 1 - u;
      return { x: (iv * iv * iv + 3 * iv * iv * u) * pa.x + (3 * iv * u * u + u * u * u) * ch.x,
               y: iv * iv * iv * pa.y + 3 * iv * iv * u * my + 3 * iv * u * u * my + u * u * u * ch.y };
    }

    /* ---- timeline (h = phase within a half loop; the outgoing RVE is drawn at h + 1) ---- */
    var RS = [0.03, 0.25], RL = 0.22, MT = 0.3;          // message rounds; message travel (in round units)
    var S0 = 0.04, SD = 0.46, FL = 0.06;                 // EBSD scan window, orientation flight time
    var K0 = 0.56, K1 = 0.72;                            // k-means (3 iterations)
    function sampleTime(s) { return S0 + SD * (s.r + (s.c + 0.5) / NSR) / NSR; }
    function idleAmp(h) { return es(h, 0.58, 0.7); }

    /* GNN branch on the graph RVE */
    function drawGraph(R, alpha, h) {
      var c = api.ctx, col = api.colors, W = o.W, k, r, idle = idleAmp(h);
      c.save(); c.beginPath(); c.rect(o.gx, o.gy, o.s, o.s); c.clip();
      c.globalAlpha = alpha; c.drawImage(layer(R), o.gx, o.gy, o.s, o.s);
      // base edges (periodic ones leave the box and re-enter on the other side)
      c.strokeStyle = col.text; c.globalAlpha = alpha * 0.38; c.lineWidth = 1; c.beginPath();
      R.edges.forEach(function (e) {
        pieces(R, e.a, e.dx, e.dy, e.b, e.wrap).forEach(function (p) { c.moveTo(p[0], p[1]); c.lineTo(p[2], p[3]); });
      });
      c.stroke();
      if (idle > 0.01) {                                  // idle: low attention shimmer
        c.strokeStyle = col.accent; c.lineCap = 'round';
        R.edges.forEach(function (e) {
          var w = e.aw * (0.5 + 0.5 * Math.sin(2 * Math.PI * (3 * h + e.ph)));
          c.globalAlpha = alpha * idle * (0.08 + 0.22 * w); c.lineWidth = 0.6 + idle * w * Math.max(1.4, W * 0.0035);
          c.beginPath();
          pieces(R, e.a, e.dx, e.dy, e.b, e.wrap).forEach(function (p) { c.moveTo(p[0], p[1]); c.lineTo(p[2], p[3]); });
          c.stroke();
        });
        c.lineCap = 'butt';
      }
      // message passing: each target node in turn receives from its neighbours (width = its attention)
      var hb = Math.max(2.1, W * 0.004), hw = Math.max(1.6, W * 0.0045), act = [];
      for (r = 0; r < 2; r++) {
        var hr = (h - RS[r]) / RL;
        if (hr <= 0 || hr >= 1) continue;
        R.de.forEach(function (d) {
          var st = R.phi[r][d.b] + d.j[r], u = (hr - st) / MT;
          if (u > 0 && u < 1) act.push([d, u, d.ap[r]]);
        });
      }
      c.strokeStyle = col.accent; c.lineCap = 'round';
      act.forEach(function (m) {
        var d = m[0], e = R.edges[d.e], env = Math.sin(Math.PI * m[1]);
        c.globalAlpha = alpha * env * (0.12 + 0.2 * m[2]); c.lineWidth = 0.8 + m[2] * hw * env;
        c.beginPath();
        pieces(R, d.a, e.dx * d.sg, e.dy * d.sg, d.b, e.wrap).forEach(function (p) { c.moveTo(p[0], p[1]); c.lineTo(p[2], p[3]); });
        c.stroke();
      });
      c.lineCap = 'butt';
      act.forEach(function (m) {
        var d = m[0], e = R.edges[d.e], wd = hb * (0.45 + 0.4 * m[2]), p = api.ease(m[1]);
        pieces(R, d.a, e.dx * d.sg, e.dy * d.sg, d.b, e.wrap).forEach(function (q) {
          c.globalAlpha = alpha * 0.9; comet(q[0], q[1], q[2], q[3], m[1], col.accent, wd * 0.9);
          var x = lerp(q[0], q[2], p), y = lerp(q[1], q[3], p);
          c.globalAlpha = alpha * Math.min(1, 3 * Math.sin(Math.PI * m[1])); c.fillStyle = col.accent;
          c.beginPath(); c.arc(x, y, wd + 0.5, 0, 7); c.fill();
          c.strokeStyle = col.surface; c.lineWidth = 1; c.stroke();
        });
      });
      // nodes: halo when they aggregate, fill drifts grain -> embedding colour
      var nr = o.nr;
      for (k = 0; k < R.gs.length; k++) {
        var q = gp(R, k), g = R.gs[k], e2 = 0;
        for (r = 0; r < 2; r++) {
          var hr2 = (h - RS[r]) / RL, a0 = R.phi[r][k] + MT + 0.02;
          e2 += 0.5 * es(hr2, a0, a0 + 0.1);
          var hu = seg(hr2, a0, a0 + 0.16);
          if (hu > 0 && hu < 1) {
            c.globalAlpha = alpha * (1 - hu) * 0.9; c.strokeStyle = col.accent; c.lineWidth = 1.6;
            c.beginPath(); c.arc(q[0], q[1], nr * (1.15 + 1.7 * api.ease(hu)), 0, 7); c.stroke();
            c.globalAlpha = alpha * (1 - hu) * 0.18; c.fillStyle = col.accent; c.fill();
          }
        }
        if (idle > 0.01) {                                // idle: halo breathing
          var br = 0.5 + 0.5 * Math.sin(2 * Math.PI * (2 * h + g.ph));
          c.globalAlpha = alpha * idle * (0.15 + 0.3 * br); c.strokeStyle = col.accent; c.lineWidth = 1.1;
          c.beginPath(); c.arc(q[0], q[1], nr * (1.35 + 0.35 * br), 0, 7); c.stroke();
        }
        c.globalAlpha = alpha; c.fillStyle = grainCol[R === RVE[0] ? 0 : 1][k];
        c.beginPath(); c.arc(q[0], q[1], nr, 0, 7); c.fill();
        if (e2 > 0) { c.globalAlpha = alpha * e2; c.fillStyle = embCol[k % embCol.length]; c.fill(); }
        c.globalAlpha = alpha; c.strokeStyle = col.surface; c.lineWidth = 1.2; c.stroke();
      }
      // readout: every node sends its embedding to one pool point on the box edge
      if (h > 0.46 && h < 0.6) for (k = 0; k < R.gs.length; k++) {
        var p0 = gp(R, k), stt = 0.465 + 0.04 * (1 - R.gs[k].x / N);
        c.globalAlpha = alpha * 0.95;
        comet(p0[0], p0[1], o.P[0], o.P[1], seg(h, stt, stt + 0.07), col.accent, Math.max(1.5, W * 0.003));
      }
      c.restore();
      c.globalAlpha = alpha * 0.6; c.strokeStyle = col.muted; c.lineWidth = 1;
      c.strokeRect(o.gx, o.gy, o.s, o.s);
      var pr = o.nr * 1.1 * (es(h, 0.49, 0.56) - es(h, 0.565, 0.6));   // pooled vector gathers on the edge
      if (pr > 0.3) { c.globalAlpha = alpha; c.fillStyle = col.accent; c.beginPath(); c.arc(o.P[0], o.P[1], pr, 0, 7); c.fill(); }
      c.globalAlpha = 1;
    }

    /* TACS branch: EBSD raster scan -> IPF cloud -> k-means into 2^N */
    function drawMap(R, alpha, h, full) {
      var c = api.ctx, col = api.colors, mv = mapLayer(R), sc = mv.width / o.s, hb = SG * o.cell;
      var u = full ? 1 : seg(h, S0, S0 + SD), rows = u * NSR, rr = Math.floor(rows), fx = rows - rr;
      c.globalAlpha = alpha;
      if (rr > 0) c.drawImage(mv, 0, 0, mv.width, Math.min(NSR, rr) * hb * sc, o.mx, o.my, o.s, Math.min(NSR, rr) * hb);
      if (rr < NSR && fx > 0) c.drawImage(mv, 0, rr * hb * sc, fx * o.s * sc, hb * sc, o.mx, o.my + rr * hb, fx * o.s, hb);
      if (!full && u < 1 && h > S0) {                            // scan band + probe
        var py = o.my + (rr + 0.5) * hb, pxx = o.mx + fx * o.s, pr = Math.max(3.5, o.W * 0.009);
        c.globalAlpha = alpha * 0.16; c.fillStyle = col.accent; c.fillRect(o.mx, o.my + rr * hb, o.s, hb);
        c.globalAlpha = alpha * 0.95; c.strokeStyle = col.accent; c.lineWidth = 1.4; c.beginPath(); c.arc(pxx, py, pr, 0, 7);
        c.moveTo(pxx - pr * 1.9, py); c.lineTo(pxx - pr * 0.5, py); c.moveTo(pxx + pr * 0.5, py); c.lineTo(pxx + pr * 1.9, py);
        c.moveTo(pxx, py - pr * 1.9); c.lineTo(pxx, py - pr * 0.5); c.moveTo(pxx, py + pr * 0.5); c.lineTo(pxx, py + pr * 1.9);
        c.stroke();
      }
      if (!full) {                                               // recently sampled pixels: small crosses that fade
        var cr = Math.max(1.4, o.W * 0.0032);
        c.strokeStyle = col.dark ? '#fff' : '#111'; c.lineWidth = 1;
        R.samples.forEach(function (s) {
          var a = 1 - seg(h, sampleTime(s), sampleTime(s) + 0.07);
          if (h < sampleTime(s) || a <= 0) return;
          var p = mp(s.i, s.j);
          c.globalAlpha = alpha * a * 0.85; c.beginPath();
          c.moveTo(p[0] - cr, p[1] - cr); c.lineTo(p[0] + cr, p[1] + cr); c.moveTo(p[0] - cr, p[1] + cr); c.lineTo(p[0] + cr, p[1] - cr); c.stroke();
        });
      }
      c.globalAlpha = 1;
    }
    function drawCloud(R, alpha, h) {
      var c = api.ctx, col = api.colors, kc = es(h, K0 - 0.02, K0 + 0.025);
      var sp = seg(h, K0, K1) * 3, si = Math.min(2, Math.floor(sp)), fr = h >= K1 ? 1 : sp - si, mv = es(fr, 0.35, 0.9);
      var cen = [0, 1, 2, 3].map(function (n) { var a = R.cs[si][n], b = R.cs[si + 1][n]; return tp(lerp(a[0], b[0], mv), lerp(a[1], b[1], mv)); });
      var lk = h < K1 ? Math.sin(Math.PI * Math.min(1, fr / 0.95)) : 0;
      if (lk > 0.01) {                                           // k-means assignment lines, each iteration
        c.globalAlpha = alpha * lk * 0.55; c.strokeStyle = col.muted; c.lineWidth = 0.9; c.beginPath();
        R.samples.forEach(function (s, n) { var p = tp(s.X, s.Y), q = cen[R.asg[si][n]]; c.moveTo(p[0], p[1]); c.lineTo(q[0], q[1]); });
        c.stroke();
      }
      var pull = 0.15 * es(h, K1 - 0.04, K1 + 0.04);
      R.samples.forEach(function (s, n) {
        var t0 = sampleTime(s), f = seg(h, t0, t0 + FL);
        if (f <= 0) return;
        var a = mp(s.i, s.j), b = tp(s.X, s.Y), fc = rgbStr(s.rgb, col.dark ? 0.9 : 0.85), x, y;
        if (f < 1) {                                             // in flight, with a short tail
          var cx = (a[0] + b[0]) / 2, cy = Math.min(a[1], b[1]) - o.H * 0.07, v = api.ease(f);
          c.globalAlpha = alpha * 0.45; comet(a[0], a[1], b[0], b[1], f, fc, o.dr * 0.9, cx, cy);
          var pt = qpt(a[0], a[1], cx, cy, b[0], b[1], v); x = pt[0]; y = pt[1];
          c.globalAlpha = alpha; c.fillStyle = fc; c.beginPath(); c.arc(x, y, o.dr * 1.25, 0, 7); c.fill();
          return;
        }
        var q = tp(R.cs[3][R.asg[2][n]][0], R.cs[3][R.asg[2][n]][1]);
        x = lerp(b[0], q[0], pull); y = lerp(b[1], q[1], pull);
        c.globalAlpha = alpha * (1 - 0.3 * kc); c.fillStyle = fc;
        c.beginPath(); c.arc(x, y, o.dr, 0, 7); c.fill();
      });
      if (kc > 0) {                                              // 2^N representative orientations, size = weight
        var br = 1 + 0.07 * es(h, 0.8, 0.86) * Math.sin(2 * Math.PI * 3 * h);
        for (var n = 0; n < NC; n++) {
          var w = lerp(R.cnt[si][n], R.cnt[si + 1][n], mv), q2 = cen[n], rad = Math.max(3, leafR(w) * 0.72) * (0.5 + 0.5 * kc) * br;
          var dd = R.cs[si][n], dn = R.cs[si + 1][n], rgb = ipfRGB(dirOf(lerp(dd[0], dn[0], mv), lerp(dd[1], dn[1], mv))), hs = hueSat(rgb);
          var fc2 = api.grainFill(hs[0], hs[1], true);
          c.globalAlpha = alpha * kc * 0.3; c.fillStyle = fc2; c.beginPath(); c.arc(q2[0], q2[1], rad, 0, 7); c.fill();
          c.globalAlpha = alpha * kc; c.strokeStyle = fc2; c.lineWidth = Math.max(1.6, o.W * 0.0034); c.stroke();
          c.fillStyle = col.text; c.beginPath(); c.arc(q2[0], q2[1], Math.max(1.3, o.W * 0.0028), 0, 7); c.fill();
        }
      }
      c.globalAlpha = 1;
    }
    function drawLatent(R, alpha, h, full) {
      var c = api.ctx, col = api.colors;
      for (var i = 0; i < NB; i++) {
        var y = o.by + i * (o.bc + o.bg), f = full ? 1 : es(h, 0.6 + 0.012 * i, 0.625 + 0.012 * i);
        if (f > 0) { c.globalAlpha = alpha * f * (0.25 + 0.75 * R.bar[i]); c.fillStyle = col.accent; c.fillRect(o.bx - o.bc / 2, y, o.bc, o.bc); }
      }
      c.globalAlpha = 1;
    }
    function fanPaths() {                               // latent -> every internal ODMN node
      var x0 = o.bx + o.bc / 2 + o.W * 0.012, y0 = o.yc, ir = o.ir + 3, out = [];
      [[0, 0, 0.66, 0.25], [1, 0, 0.62, 0.27], [1, 1, 0.79, 0.25]].forEach(function (s) {
        var q = tn(s[0], s[1]), cx = o.W * s[2], cy = o.H * s[3], a = Math.atan2(q.y - cy, q.x - cx);
        out.push([x0, y0, cx, cy, q.x - Math.cos(a) * ir, q.y - Math.sin(a) * ir, a]);
      });
      return out;
    }
    function drawTie(R, h) {                            // same grain flashed in both views
      var u = seg(h, 0.8, 0.98);
      if (u <= 0 || u >= 1) return;
      var c = api.ctx, col = api.colors, a = Math.sin(Math.PI * u), k = o.cell, g = R.gs[R.tie];
      c.strokeStyle = col.gold; c.lineWidth = Math.max(1.4, o.W * 0.003); c.globalAlpha = a;
      [[o.gx, o.gy], [o.mx, o.my]].forEach(function (b) {
        c.beginPath();
        R.tseg.forEach(function (sg) { c.moveTo(b[0] + sg[0] * k, b[1] + sg[1] * k); c.lineTo(b[0] + sg[2] * k, b[1] + sg[3] * k); });
        c.stroke();
      });
      var x = o.gx + g.x * k;
      c.setLineDash([2, 3]); c.lineWidth = 1.2; c.beginPath(); c.moveTo(x, o.gy + o.s + 3); c.lineTo(x, o.my - 3); c.stroke(); c.setLineDash([]);
      c.globalAlpha = 1;
    }

    var embCol = [], grainCol = [[], []];
    function theme() {
      var col = api.colors, dk = col.dark;
      surf = parseCol(col.surface, dk);
      embCol = [];
      for (var n = 0; n < NG; n++) {
        var hh = 196 + ((n * 37) % 50), ll = dk ? 58 + (n * 13) % 14 : 34 + (n * 11) % 16;
        embCol.push('hsl(' + hh + ',' + (dk ? 55 : 50) + '%,' + ll + '%)');
      }
      grainCol = RVE.map(function (R) { return R.gs.map(function (g) { return rgbStr(mix(g.rgb, surf, dk ? 0.3 : 0.12), dk ? 0.95 : 0.9); }); });
      RVE.forEach(function (R) { R.cv = R.mv = null; });
      o.tri = null;
    }
    theme();

    return {
      theme: theme,
      draw: function (t) {
        if (o.W !== api.W || o.H !== api.H) lay();
        var c = api.ctx, col = api.colors, fs = o.fs, W = o.W, H = o.H, k;
        var half = t < 0.5 ? 0 : 1, h = (t * 2) % 1, cur = RVE[half], prev = RVE[1 - half];
        var f = es(h, 0, 0.06);                                    // crossfade to the new RVE
        var s = es(h, 0.69, 0.76);                                 // GNN sets the interface ticks
        var s2 = es(h, 0.76, 0.82);                                // TACS sets the leaves
        var glow = Math.sin(Math.PI * seg(h, 0.68, 0.86));
        var hd = Math.max(5, W * 0.011);

        // ---- left top: graph RVE (GNN) ----
        if (f < 1) drawGraph(prev, 1 - f, 1 + h);
        drawGraph(cur, f, h);

        // ---- left bottom: EBSD map; middle: IPF triangle (TACS) ----
        c.fillStyle = col.alt; c.fillRect(o.mx, o.my, o.s, o.s);
        if (f < 1) drawMap(prev, 1 - f, 1, true);
        drawMap(cur, 1, h, false);
        c.globalAlpha = 0.6; c.strokeStyle = col.muted; c.lineWidth = 1; c.strokeRect(o.mx, o.my, o.s, o.s); c.globalAlpha = 1;
        drawTie(cur, h);
        var T = triLayer(), B = tp(TW, 0), Cc = tp(0.366, 0.366);
        c.drawImage(T.cv, T.x, T.y, T.w, T.h);
        c.strokeStyle = col.muted; c.globalAlpha = 0.75; c.lineWidth = 1.1; c.beginPath();
        c.moveTo(Cc[0], Cc[1]); c.lineTo(o.A[0], o.A[1]); c.lineTo(B[0], B[1]);
        T.arc.forEach(function (p) { c.lineTo(p[0], p[1]); });
        c.stroke(); c.globalAlpha = 1;
        if (o.big) {
          var cf = Math.max(9, fs * 0.72);
          api.label('001', o.A[0], o.A[1] + cf * 1.25, { size: cf, align: 'center', color: col.faint });
          api.label('101', B[0], B[1] + cf * 1.25, { size: cf, align: 'center', color: col.faint });
          api.label('111', Cc[0], Cc[1] - cf * 0.55, { size: cf, align: 'center', color: col.faint });
          api.label('IPF-Z', Cc[0] + cf * 0.9, Cc[1] + cf * 0.9, { size: cf, color: col.faint });
        }
        if (f < 1) drawCloud(prev, 1 - f, 1 + h);
        drawCloud(cur, 1, h);

        // ---- readout -> latent vector -> fan to every internal node (GNN, accent) ----
        var lx1 = o.bx - o.bc / 2 - W * 0.012, px1 = o.P[0] + W * 0.012;
        c.globalAlpha = 0.5; api.arrow(px1, o.yc, lx1, o.yc, { color: col.accent, head: Math.max(4, hd * 0.8), width: 1 }); c.globalAlpha = 1;
        comet(o.P[0], o.yc, lx1, o.yc, seg(h, 0.56, 0.615), col.accent, Math.max(2.8, W * 0.0065));
        c.globalAlpha = 1;
        c.strokeStyle = col.muted; c.globalAlpha = 0.5; c.lineWidth = 1;
        for (k = 0; k < NB; k++) c.strokeRect(o.bx - o.bc / 2 + 0.5, o.by + k * (o.bc + o.bg) + 0.5, o.bc - 1, o.bc - 1);
        c.globalAlpha = 1;
        if (f < 1) drawLatent(prev, 1 - f, 1, true);
        drawLatent(cur, 1, h, false);
        fanPaths().forEach(function (p, n) {
          c.globalAlpha = 0.45; c.strokeStyle = col.accent; c.lineWidth = 1; c.setLineDash([3, 3]);
          c.beginPath(); c.moveTo(p[0], p[1]); c.quadraticCurveTo(p[2], p[3], p[4], p[5]); c.stroke(); c.setLineDash([]);
          c.globalAlpha = 0.8; head(p[4], p[5], p[6], Math.max(4, hd * 0.75), col.accent);
          c.globalAlpha = 1; comet(p[0], p[1], p[4], p[5], seg(h, 0.635 + 0.015 * n, 0.705 + 0.015 * n), col.accent, Math.max(2.4, W * 0.005), p[2], p[3]);
        });
        c.globalAlpha = 1;

        // ---- TACS -> all leaves (bracket) ----
        var l0 = tn(2, 0), l3 = tn(2, 3), bx0 = B[0] + W * 0.02;
        c.strokeStyle = col.faint; c.globalAlpha = 0.85; c.lineWidth = 1; c.beginPath();
        c.moveTo(bx0, o.yb); c.lineTo(l3.x, o.yb); c.stroke();
        for (k = 0; k < NC; k++) { var lk = tn(2, k); api.arrow(lk.x, o.yb, lk.x, o.yb - H * 0.025, { color: col.faint, head: Math.max(3.5, hd * 0.6), width: 1 }); }
        c.globalAlpha = 1;
        cur.cl.forEach(function (C, n) {                           // each centroid flies to its leaf
          var a = tp(C.X, C.Y), lf = tn(2, n), st = 0.72 + n * 0.012;
          c.globalAlpha = 1;
          comet(a[0], a[1], lf.x, lf.y, seg(h, st, st + 0.08), api.grainFill(C.hue, C.sat, true), Math.max(2.4, W * 0.0055), (a[0] + lf.x) / 2, Math.min(a[1], lf.y) - H * 0.12);
        });
        c.globalAlpha = 1;

        // ---- right: ODMN tree (root, 2 blocks, 4 leaves) ----
        c.strokeStyle = col.muted; c.globalAlpha = 0.45; c.lineWidth = 1.2; c.beginPath();
        for (var L = 1; L <= 2; L++) for (k = 0; k < (1 << L); k++) {
          var ch = tn(L, k), pa = tn(L - 1, k >> 1), my = (ch.y + pa.y) / 2;
          c.moveTo(pa.x, pa.y); c.bezierCurveTo(pa.x, my, ch.x, my, ch.x, ch.y);
        }
        c.stroke(); c.globalAlpha = 1;
        [0.82, 0.9].forEach(function (w0) {                        // evaluation pulses once both branches delivered
          var u = seg(h, w0, w0 + 0.09);
          if (u <= 0 || u >= 1) return;
          var Ls = u < 0.5 ? 1 : 2, v = u < 0.5 ? u * 2 : u * 2 - 1, fade = Math.sin(Math.PI * u) * 0.6 + 0.4;
          c.fillStyle = col.accent;
          for (var m = 0; m < (1 << Ls); m++) {
            var pp = bezT(tn(Ls, m), tn(Ls - 1, m >> 1), v);
            c.globalAlpha = 0.18 * fade; c.beginPath(); c.arc(pp.x, pp.y, Math.max(4.5, W * 0.01), 0, 7); c.fill();
            c.globalAlpha = fade; c.beginPath(); c.arc(pp.x, pp.y, Math.max(2.2, W * 0.0042), 0, 7); c.fill();
          }
          c.globalAlpha = 1;
        });
        for (k = 0; k < NC; k++) {                                 // leaves = TACS orientations, size = weight
          var lf = tn(2, k), Cp = prev.cl[k], Cn = cur.cl[k], rad = leafR(Cp.wt + (Cn.wt - Cp.wt) * s2);
          c.beginPath(); c.arc(lf.x, lf.y, rad, 0, 7);
          if (s2 < 1) { c.globalAlpha = 1; c.fillStyle = api.grainFill(Cp.hue, Cp.sat, true); c.fill(); }
          c.globalAlpha = s2; c.fillStyle = api.grainFill(Cn.hue, Cn.sat, true); c.fill(); c.globalAlpha = 1;
        }
        [[0, 0], [1, 0], [1, 1]].forEach(function (lk2, n) {       // internal nodes: GNN-inferred interface ticks
          var q = tn(lk2[0], lk2[1]), ir = o.ir, th = lerpAng(prev.theta[n], cur.theta[n], s) * Math.PI / 180;
          if (glow > 0) { c.strokeStyle = col.gold; c.globalAlpha = glow * 0.8; c.lineWidth = 1.6; c.beginPath(); c.arc(q.x, q.y, ir + 2 + 2.5 * glow, 0, 7); c.stroke(); c.globalAlpha = 1; }
          c.fillStyle = col.surface; c.beginPath(); c.arc(q.x, q.y, ir, 0, 7); c.fill();
          c.strokeStyle = col.accent; c.lineWidth = 1.4; c.stroke();
          c.strokeStyle = col.text; c.lineWidth = 1.4; c.beginPath();
          c.moveTo(q.x - Math.cos(th) * ir * 0.7, q.y - Math.sin(th) * ir * 0.7);
          c.lineTo(q.x + Math.cos(th) * ir * 0.7, q.y + Math.sin(th) * ir * 0.7); c.stroke();
        });

        // ---- labels ----
        var rt = tn(0, 0), bot = H * 0.95;
        api.label('ODMN', rt.x - o.ir - 6.5 - W * 0.012, rt.y + fs * 0.36, { size: fs, align: 'right', color: col.text });
        api.label('GNN', o.bx, o.by + o.bh + fs * 1.3, { size: fs, align: 'center', color: col.accent });
        api.label('EBSD', o.mx, o.my - fs * 0.5, { size: fs });
        c.font = api.font(fs); var tw1 = c.measureText('TACS \u00b7 2').width, tw2 = c.measureText('N').width * 0.65;
        var tx = o.A[0] + o.tw * 0.5 - (tw1 + tw2) / 2;
        api.label('TACS \u00b7 2', tx, bot, { size: fs });
        api.label('N', tx + tw1 + 0.5, bot - fs * 0.42, { size: fs * 0.65 });
        var la = h < 0.06 ? 1 - 0.55 * h / 0.06 : h < 0.78 ? 0.45 : h < 0.86 ? 0.45 + 0.55 * (h - 0.78) / 0.08 : 1;
        c.globalAlpha = la;
        api.label('no retraining', o.tx1, bot, { size: fs, align: 'right', color: col.gold });
        c.globalAlpha = 1;
      }
    };
  });
})();
