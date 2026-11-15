/* Fig. 2 \u2014 PDMN schematic (sibling of Fig. 0 / Fig. 1).
   Left: a periodic two-phase piezoelectric RVE (soft PVDF-like matrix +
   stiff poled inclusions with polarization P) between two electrodes
   (+ / -). Field lines E run from + to -, bending into the higher-
   permittivity inclusions. Under a ramp-hold-unload strain the cell
   stretches affinely (periodic copies stay compatible) while the stiff
   inclusions barely deform: the matrix takes most of the strain.
   Middle: a depth-3 PDMN; leaves alternate the two phases. Every edge is a
   pair of strands \u2014 mechanical (accent) and electrical (gold) \u2014 and
   every internal node is a coupled laminate building block: a laminate
   tick plus a gold rim arc (traction + normal-D continuity). Pulses climb
   both strands together and leave the root on a split rail.
   Right: homogenized stress (relaxing during the hold) and electric
   displacement trace in real time above the applied strain history.
   Abstract: magnitudes exaggerated. */
(function () {
  'use strict';
  if (!window.FigKit) return;
  FigKit.register('pdmn', function (api) {
    var ctx = api.ctx, DEPTH = 3, NLEAF = 1 << DEPTH, D2R = Math.PI / 180;
    api.period = 10000;
    api.staticT = 0.47;                                               // stretched, stress already relaxed

    // ---- tree nodes ----
    var rand = api.rand(2207), nodes = [];
    for (var L = 0; L <= DEPTH; L++) for (var k = 0; k < (1 << L); k++) {
      nodes.push({ L: L, k: k, theta: (25 + rand() * 130) * D2R, x: 0, y: 0, r: 0 });
    }
    function nodeAt(L, k) { return nodes[(1 << L) - 1 + k]; }

    // ---- RVE (unit-cell coords; sizes in units of the reference width) ----
    var INC = [
      { x: 0.33, y: 0.27, rx: 0.17, ry: 0.13, a: 15 * D2R },
      { x: 0.68, y: 0.55, rx: 0.15, ry: 0.12, a: -25 * D2R },
      { x: 0.30, y: 0.80, rx: 0.15, ry: 0.11, a: 50 * D2R },
      { x: 0.97, y: 0.06, rx: 0.13, ry: 0.10, a: 0 }                  // wraps across the corner: 4 pieces
    ];
    var ASP = 1.4;                                                    // cell height / width
    // field lines: x(y) bent toward inclusions (periodic in y), sampled once
    var NLINE = 5, NSEG = 40, LINES = [];
    (function () {
      for (var i = 0; i < NLINE; i++) {
        var x0 = (i + 0.5) / NLINE, pts = [];
        for (var j = 0; j <= NSEG; j++) {
          var y = j / NSEG, dx = 0;
          INC.forEach(function (q) {
            for (var ox = -1; ox <= 1; ox++) for (var oy = -1; oy <= 1; oy++) {
              var cx = q.x + ox, cy = q.y + oy, s = (q.rx + q.ry) * 0.75;
              var ddx = x0 - cx, ddy = (y - cy) * ASP, g = Math.exp(-(ddx * ddx + ddy * ddy) / (2 * s * s));
              dx += -ddx * 0.55 * g;
            }
          });
          pts.push(x0 + dx, y);
        }
        LINES.push(pts);
      }
    })();

    // ---- loading history on the trace clock u in [0,1]: ramp, hold, unload, rest ----
    var NS = 400, SIG = new Float32Array(NS + 1), DD = new Float32Array(NS + 1);
    function epsOf(u) { return u < 0.18 ? u / 0.18 : u < 0.6 ? 1 : u < 0.76 ? 1 - (u - 0.6) / 0.16 : 0; }
    (function () {                                                    // standard linear solid + piezo coupling
      var q = 0, tau = 0.12, Einf = 0.5, E1 = 0.5, du = 1 / NS, ep = 0;
      for (var i = 0; i <= NS; i++) {
        var e = epsOf(i / NS);
        q = (q + E1 * (e - ep)) * Math.exp(-du / tau); ep = e;
        SIG[i] = Einf * e + q; DD[i] = 0.4 * e + 0.3 * q;
      }
    })();
    function sample(arr, u) { var f = Math.max(0, Math.min(1, u)) * NS, i = Math.min(NS - 1, f | 0), r = f - i; return arr[i] * (1 - r) + arr[i + 1] * r; }

    var col = {};
    function theme() {
      col.mat = api.grainFill(0.11, 0.25); col.matS = api.grainFill(0.11, 0.3, true);
      col.inc = api.grainFill(0.36, 0.75); col.incS = api.grainFill(0.36, 0.75, true);
    }
    theme();

    // ---- layout: node positions + two offset strands per edge, sampled once ----
    var G = {}, EDGES = [], NE = 24;
    function strand(pts, d, pxc) {                                    // offset polyline along its normal;
      var out = [];                                                   // pinches toward the parent so sibling
      for (var i = 0; i < pts.length; i += 2) {                       // strands never cross
        var a = Math.max(0, i - 2), b = Math.min(pts.length - 2, i + 2);
        var tx = pts[b] - pts[a], ty = pts[b + 1] - pts[a + 1], l = Math.hypot(tx, ty) || 1;
        var m = pxc === undefined ? d : (d < 0 ? -1 : 1) * Math.min(Math.abs(d), 0.42 * Math.abs(pts[i] - pxc));
        out.push(pts[i] - ty / l * m, pts[i + 1] + tx / l * m);
      }
      return out;
    }
    function layout(W, H) {
      var x0 = W * 0.33, x1 = W * 0.68, top = H * 0.13, leafY = H * 0.71;
      G.small = W < 480;
      nodes.forEach(function (nd) {
        nd.x = x0 + (x1 - x0) * (nd.k + 0.5) / (1 << nd.L);
        nd.y = top + (leafY - top) * nd.L / DEPTH;
        nd.r = Math.max(G.small ? 6 : 4.5, W * (0.016 - nd.L * 0.0015));
      });
      G.leaf = Math.max(5, W * 0.0115);
      G.d = Math.max(2.6, W * 0.0058);                                // strand half-separation
      G.fs = Math.max(10, W * 0.021);
      var rw = W * 0.18, rh = Math.min(rw * ASP, H * 0.44);
      G.rve = { cx: W * 0.175, cy: H * 0.46, w: rw, h: rh };
      G.plot = { x0: W * 0.755, x1: W * 0.95, y0: H * 0.15, y1: H * 0.6, s0: H * 0.67, s1: H * 0.79 };
      EDGES = [];
      for (var n = 1; n < nodes.length; n++) {                        // child -> parent, vertical tangents
        var ch = nodes[n], pa = nodeAt(ch.L - 1, ch.k >> 1), my = (pa.y + ch.y) / 2, pts = [];
        for (var i = 0; i <= NE; i++) {
          var u = i / NE, iv = 1 - u;
          pts.push((iv * iv * iv + 3 * iv * iv * u) * ch.x + (3 * iv * u * u + u * u * u) * pa.x,
                   iv * iv * iv * ch.y + 3 * iv * iv * u * my + 3 * iv * u * u * my + u * u * u * pa.y);
        }
        EDGES[n] = { m: strand(pts, -G.d, pa.x), e: strand(pts, G.d, pa.x) };
      }
      // root -> plot rail (horizontal tangents), split into two strands
      var r = nodeAt(0, 0), P = G.plot, rx0 = r.x + r.r * 0.6, ry0 = r.y, ex = P.x0 - W * 0.03, ey = (P.y0 + P.y1) / 2, mx = (rx0 + ex) / 2, rp = [];
      for (var j = 0; j <= NE; j++) {
        var v = j / NE, w = 1 - v;
        rp.push(w * w * w * rx0 + 3 * w * w * v * mx + 3 * w * v * v * mx + v * v * v * ex,
                (w * w * w + 3 * w * w * v) * ry0 + (3 * w * v * v + v * v * v) * ey);
      }
      G.rail = { m: strand(rp, -G.d), e: strand(rp, G.d) };
    }
    api.onResize(layout);

    function clamp(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
    function at(pl, u) {                                              // point on sampled polyline
      var f = clamp(u) * (pl.length / 2 - 1), i = Math.min(pl.length / 2 - 2, f | 0), r = f - i;
      return { x: pl[2 * i] * (1 - r) + pl[2 * i + 2] * r, y: pl[2 * i + 1] * (1 - r) + pl[2 * i + 3] * r };
    }
    function polyline(pl) { ctx.moveTo(pl[0], pl[1]); for (var i = 2; i < pl.length; i += 2) ctx.lineTo(pl[i], pl[i + 1]); }
    function pulse(x, y, color, a) {
      ctx.fillStyle = color; ctx.globalAlpha = 0.2 * a; ctx.beginPath(); ctx.arc(x, y, G.d * 1.15, 0, 7); ctx.fill();
      ctx.globalAlpha = a; ctx.beginPath(); ctx.arc(x, y, Math.max(1.9, api.W * 0.0034), 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    }

    // ---- RVE ----
    function drawRVE(t, e) {
      var c = api.colors, R = G.rve, sx = 1 + 0.1 * e, sy = 1 - 0.045 * e;
      var w = R.w * sx, h = R.h * sy, X = R.cx - w / 2, Y = R.cy - h / 2, S = R.w;
      var ix = 1 + 0.3 * (sx - 1), iy = 1 + 0.3 * (sy - 1);          // stiff inclusions: ~0.3x the strain
      ctx.fillStyle = col.mat; ctx.fillRect(X, Y, w, h);
      ctx.save(); ctx.beginPath(); ctx.rect(X, Y, w, h); ctx.clip();
      INC.forEach(function (q) {
        for (var ox = -1; ox <= 1; ox++) for (var oy = -1; oy <= 1; oy++) {
          var px = q.x + ox, py = q.y + oy;
          if (px + 0.25 < 0 || px - 0.25 > 1 || py + 0.2 < 0 || py - 0.2 > 1) continue;
          ctx.save(); ctx.translate(X + px * w, Y + py * h); ctx.scale(ix, iy); ctx.rotate(q.a);
          ctx.beginPath(); ctx.ellipse(0, 0, q.rx * S, q.ry * S, 0, 0, 7); ctx.restore();
          ctx.fillStyle = col.inc; ctx.fill(); ctx.strokeStyle = col.incS; ctx.lineWidth = 1.1; ctx.stroke();
        }
      });
      // field lines (+ bottom -> - top), bent into the inclusions; chevrons drift upward
      ctx.strokeStyle = c.muted; ctx.globalAlpha = 0.4; ctx.lineWidth = 1; ctx.beginPath();
      var nl = G.small ? 4 : NLINE, li, j;
      for (li = 0; li < NLINE; li++) {
        if (G.small && li === 2) continue;
        var pl = LINES[li];
        for (j = 0; j < pl.length; j += 2) { var lx = X + pl[j] * w, ly = Y + pl[j + 1] * h; if (j) ctx.lineTo(lx, ly); else ctx.moveTo(lx, ly); }
      }
      ctx.stroke();
      var NC = 3, cs = Math.max(2.6, S * 0.032);
      ctx.strokeStyle = c.muted; ctx.lineWidth = 1.2;
      for (li = 0; li < NLINE; li++) {
        if (G.small && li === 2) continue;
        for (j = 0; j < NC; j++) {
          var s = ((j + 0.5 + li * 0.37 + t * 3) / NC) % 1, yy = 1 - s;   // 3 spacings per loop: seamless
          var f = yy * NSEG, i0 = Math.min(NSEG - 1, f | 0), rr = f - i0, P = LINES[li];
          var cx = X + w * (P[2 * i0] * (1 - rr) + P[2 * i0 + 2] * rr), cy = Y + h * yy;
          var dx = (P[2 * i0 + 2] - P[2 * i0]) * w, dy = h / NSEG, l = Math.hypot(dx, dy);
          var ux = -dx / l, uy = -dy / l;                             // upward unit tangent
          ctx.globalAlpha = 0.75 * Math.sin(Math.PI * s);
          ctx.beginPath();
          ctx.moveTo(cx - ux * cs + uy * cs, cy - uy * cs - ux * cs); ctx.lineTo(cx, cy);
          ctx.lineTo(cx - ux * cs - uy * cs, cy - uy * cs + ux * cs); ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      ctx.restore();
      // polarization arrows (primary copies)
      var pl2 = S * (0.15 + 0.02 * e);
      INC.forEach(function (q, k) {
        if (k === 3) return;
        var ax = X + q.x * w, ay = Y + q.y * h;
        api.arrow(ax, ay + pl2 / 2, ax, ay - pl2 / 2, { color: c.text, width: 1.4, head: Math.max(4.5, S * 0.06) });
      });
      ctx.strokeStyle = c.muted; ctx.lineWidth = 1; ctx.strokeRect(X, Y, w, h);
      // electrodes: - on top, + at the bottom (E and P point up)
      var ew = Math.max(2.5, S * 0.028), fs = G.fs * 0.9;
      ctx.fillStyle = c.muted; ctx.globalAlpha = 0.75;
      ctx.fillRect(X - 2, Y - ew - 2, w + 4, ew); ctx.fillRect(X - 2, Y + h + 2, w + 4, ew); ctx.globalAlpha = 1;
      api.label('\u2212', X + w + 5, Y - 2 - ew / 2, { size: fs, baseline: 'middle', color: c.text });
      api.label('+', X + w + 5, Y + h + 2 + ew / 2, { size: fs, baseline: 'middle', color: c.text });
      // load arrows
      if (e > 0.02) {
        var al = api.W * (0.012 + 0.016 * e), gap = Math.max(3, api.W * 0.006), hd = Math.max(5, api.W * 0.01);
        ctx.globalAlpha = Math.min(1, e * 3);
        api.arrow(X - gap, R.cy, X - gap - al, R.cy, { color: c.muted, width: 1.6, head: hd });
        api.arrow(X + w + gap, R.cy, X + w + gap + al, R.cy, { color: c.muted, width: 1.6, head: hd });
        ctx.globalAlpha = 1;
      }
      api.label('\u03b5, E', R.cx, R.cy + R.h / 2 + ew + 2 + G.fs * 1.6, { align: 'center', size: G.fs });
    }

    function draw(t) {
      var c = api.colors, W = api.W, P = G.plot;
      var u = clamp(t / 0.85), e = epsOf(u);
      var fade = t < 0.85 ? 1 : t < 0.93 ? 1 - api.ease((t - 0.85) / 0.08) : 0;
      if (t >= 0.85) e = 0;

      drawRVE(t, e);

      // strands: tree edges + split rail (mechanical left, electrical right)
      ctx.lineWidth = 1.1;
      [['m', c.accent, 0.42], ['e', c.gold, 0.5]].forEach(function (s) {
        ctx.strokeStyle = s[1]; ctx.globalAlpha = s[2]; ctx.beginPath();
        for (var n = 1; n < nodes.length; n++) polyline(EDGES[n][s[0]]);
        ctx.stroke();
        ctx.setLineDash([2, 3]); ctx.beginPath(); polyline(G.rail[s[0]]); ctx.stroke(); ctx.setLineDash([]);
        var pl = G.rail[s[0]], m = pl.length, ex = pl[m - 2], ey = pl[m - 1], hl = Math.max(4, W * 0.008);
        ctx.globalAlpha = 0.85; ctx.fillStyle = s[1]; ctx.beginPath();
        ctx.moveTo(ex + hl * 0.9, ey); ctx.lineTo(ex, ey - hl * 0.5); ctx.lineTo(ex, ey + hl * 0.5); ctx.fill();
      });
      ctx.globalAlpha = 1;

      // coupled pulses: 5 Newton increments per loop, both channels together
      var NW = 5, w = (t * NW) % 1, a = Math.sin(Math.PI * w);
      ['m', 'e'].forEach(function (key, ci) {
        var color = ci ? c.gold : c.accent;
        if (w < 0.72) {
          var segF = w / 0.72 * DEPTH, sg = Math.min(DEPTH - 1, Math.floor(segF)), uu = segF - sg, Lc = DEPTH - sg;
          for (var m = 0; m < (1 << Lc); m++) {
            var pp = at(EDGES[(1 << Lc) - 1 + m][key], uu);
            pulse(pp.x, pp.y, color, a * clamp((1 - uu) / 0.2) * clamp(uu / 0.12));   // absorbed / re-emitted at nodes
          }
        } else {
          var rp = at(G.rail[key], (w - 0.72) / 0.28);
          pulse(rp.x, rp.y, color, a * clamp((w - 0.72) / 0.03));
        }
      });

      // internal nodes (drawn over the pulses): laminate tick + gold rim arc
      nodes.forEach(function (nd) {
        if (nd.L === DEPTH) return;
        var cl = nd.L === 0 ? c.accent : c.muted, rr = nd.r * 0.62, ct = Math.cos(nd.theta), st = Math.sin(nd.theta);
        ctx.beginPath(); ctx.arc(nd.x, nd.y, nd.r, 0, 7); ctx.fillStyle = c.surface; ctx.fill();
        ctx.lineWidth = 1.3; ctx.strokeStyle = cl; ctx.stroke();
        ctx.lineWidth = G.small ? 1.5 : 1.3; ctx.beginPath();
        ctx.moveTo(nd.x - ct * rr, nd.y - st * rr); ctx.lineTo(nd.x + ct * rr, nd.y + st * rr); ctx.stroke();
        ctx.strokeStyle = c.gold; ctx.lineWidth = G.small ? 2.4 : 2.2; ctx.beginPath();
        ctx.arc(nd.x, nd.y, nd.r, -0.95, 0.95); ctx.stroke();
      });

      // leaves: two phases alternating
      for (var q = 0; q < NLEAF; q++) {
        var nl = nodeAt(DEPTH, q), s = G.leaf, inc = q % 2 === 1;
        ctx.fillStyle = inc ? col.inc : col.mat; ctx.fillRect(nl.x - s, nl.y - s, 2 * s, 2 * s);
        ctx.strokeStyle = inc ? col.incS : col.matS; ctx.lineWidth = 1.2; ctx.strokeRect(nl.x - s, nl.y - s, 2 * s, 2 * s);
      }
      api.label('PDMN', (nodeAt(DEPTH, 0).x + nodeAt(DEPTH, NLEAF - 1).x) / 2, nodeAt(DEPTH, 0).y + G.leaf + G.fs * 1.8, { align: 'center', size: G.fs, color: c.text });

      // ---- response plot ----
      var ymin = -0.3, ymax = 0.9;
      function px(v) { return P.x0 + (P.x1 - P.x0) * v; }
      function py(v) { return P.y1 - (P.y1 - P.y0) * (v - ymin) / (ymax - ymin); }
      ctx.strokeStyle = c.muted; ctx.lineWidth = 1.1; ctx.beginPath();
      ctx.moveTo(P.x0, P.y0 - 4); ctx.lineTo(P.x0, P.y1); ctx.lineTo(P.x1 + 4, P.y1); ctx.stroke();
      ctx.strokeStyle = c.rule; ctx.beginPath(); ctx.moveTo(P.x0, py(0)); ctx.lineTo(P.x1, py(0)); ctx.stroke();
      // input strip: applied strain history
      var sy = function (v) { return P.s1 - (P.s1 - P.s0) * v; };
      ctx.strokeStyle = c.muted; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(P.x0, P.s0 - 2); ctx.lineTo(P.x0, P.s1); ctx.lineTo(P.x1 + 4, P.s1); ctx.stroke();
      ctx.strokeStyle = c.faint; ctx.setLineDash([3, 3]); ctx.lineWidth = 1.1; ctx.beginPath();
      [[0, 0], [0.18, 1], [0.6, 1], [0.76, 0], [1, 0]].forEach(function (pt, j) { var X = px(pt[0]), Y = sy(pt[1]); if (j) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); });
      ctx.stroke(); ctx.setLineDash([]);
      if (t < 0.85) { ctx.fillStyle = c.muted; ctx.beginPath(); ctx.arc(px(u), sy(e), Math.max(1.8, W * 0.003), 0, 7); ctx.fill(); }
      api.label('\u03b5\u0304', P.x0 - 5, (P.s0 + P.s1) / 2, { align: 'right', baseline: 'middle', size: G.fs * 0.9, color: c.faint });
      api.label('t', P.x1 + 2, P.s1 + G.fs * 1.25, { align: 'right', size: G.fs });
      // traced curves
      if (fade > 0) {
        var steps = Math.max(1, Math.round(u * 120));
        [[SIG, c.accent], [DD, c.gold]].forEach(function (cv) {
          ctx.strokeStyle = cv[1]; ctx.lineWidth = 1.8; ctx.globalAlpha = fade; ctx.beginPath();
          for (var j = 0; j <= steps; j++) { var v = u * j / steps, X = px(v), Y = py(sample(cv[0], v)); if (j) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); }
          ctx.stroke(); ctx.globalAlpha = 1;
          if (t < 0.85) pulse(px(u), py(sample(cv[0], u)), cv[1], clamp(t / 0.03));
        });
        ctx.globalAlpha = fade * clamp((u - 0.3) / 0.1);
        api.label('\u03c3\u0304', px(0.42), py(0.68) + G.fs * 0.35, { align: 'center', size: G.fs, color: c.accent });
        api.label('D\u0304', px(0.42), py(0.36) + G.fs * 1.2, { align: 'center', size: G.fs, color: c.gold });
        ctx.globalAlpha = 1;
      }
    }

    return { draw: draw, theme: theme };
  });
})();
