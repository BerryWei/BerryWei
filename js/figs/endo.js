/* Fig. 3 \u2014 Endodontic irrigation schematic (sibling of Figs. 0-2).
   Left: a root canal with an ultrasonic file oscillating as a standing wave
   (tip = antinode; nodes and antinodes ~3.4 mm apart, shown in very slow
   motion). Counter-rotating acoustic-streaming cells line the file, the
   pressure gradient glows at the tip and antinodes, and cavitation bubbles
   appear there when the gradient is high enough.
   Middle: the post-processing that makes CFD dimensionless: max over one
   cycle of |grad p| -> sigmoid bubble probability (threshold alpha) ->
   integrated over each cross-section and divided by its area = Gamma.
   Right: Gamma along the file (position from tip, tip near the bottom,
   aligned with the canal on the left) draws itself, then B-mode bubble
   intensity markers (mean +/- sd) line up with it.
   Four validation cases loop (4 s each): K2525-E1 and K3025-E1 give no
   bubbles and Gamma = 0; K2525-E4 cavitates at the tip; the softer IRR2525
   file swings more and cavitates strongest, at the tip and antinodes.
   Abstract: shapes and magnitudes are schematic, not data. */
(function () {
  'use strict';
  if (!window.FigKit) return;
  FigKit.register('endo', function (api) {
    var ctx = api.ctx, NC = 4, HALF = 3.4, PI = Math.PI;
    api.period = 16000;
    api.staticT = 0.70;                                               // IRR2525 case: profile + markers shown

    function clamp(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
    function lerp(a, b, f) { return a + (b - a) * f; }
    function gauss(x, m, s) { var d = (x - m) / s; return Math.exp(-0.5 * d * d); }
    function sig(x) { return 1 / (1 + Math.exp(-(x - 0.58) * 16)); } // threshold alpha at 0.58

    // ---- the four validation cases (thesis order a-d) ----
    // amp: file swing, g: max|grad p| level fed to the sigmoid, glow: per-antinode weight (tip first)
    var CASES = [
      { name: 'K2525 \u00b7 E1', amp: 0.55, g: 0.30, glow: [0.45, 0.25, 0.25], bub: [] },
      { name: 'K2525 \u00b7 E4', amp: 0.78, g: 0.68, glow: [1.0, 0.35, 0.4], bub: [6, 1, 0] },
      { name: 'IRR2525 \u00b7 E1', amp: 1.0, g: 0.86, glow: [1.0, 0.9, 1.0], bub: [7, 5, 6] },
      { name: 'K3025 \u00b7 E1', amp: 0.34, g: 0.18, glow: [0.3, 0.15, 0.15], bub: [] }
    ];
    var P0 = -3, P1 = 9, NP = 121, NM = 20, rand = api.rand(3025);
    CASES.forEach(function (cs, ci) {
      cs.G = new Float32Array(NP); cs.M = [];
      for (var i = 0; i < NP; i++) {
        var p = P0 + (P1 - P0) * i / (NP - 1), v = 0;
        if (ci === 1) v = 0.52 * gauss(p, 0.05, 0.3) + 0.05 * gauss(p, 6.8, 0.3) + (p > -0.3 && p < 8 ? 0.04 : 0);
        if (ci === 2) v = 0.78 * gauss(p, 0.05, 0.3) + 0.72 * gauss(p, 3.4, 0.3) + 0.9 * gauss(p, 6.8, 0.32) + (p > -0.2 && p < 8 ? 0.03 : 0);
        cs.G[i] = v;
      }
      for (var m = 0; m < NM; m++) {
        var q = -2.7 + m * 0.6, val, err;
        if (ci === 0 || ci === 3) { cs.M.push({ p: q, v: 0, e: 0, z: 1 }); continue; }      // B-mode: nothing seen
        if (ci === 1) { val = 0.1 + 0.4 * gauss(q, 0.05, 0.5) - 0.05 * clamp((q - 3) / 6) + (rand() - 0.5) * 0.04; err = 0.05 + rand() * 0.05; }
        else { val = 0.07 + 0.7 * gauss(q, 0, 0.45) + 0.6 * gauss(q, 3.4, 0.5) + 0.76 * gauss(q, 6.6, 0.55) + (rand() - 0.5) * 0.05; err = 0.04 + rand() * 0.06; }
        val = Math.max(0.02, Math.min(0.92, val));
        cs.M.push({ p: q, v: val, e: Math.min(err, 0.98 - val), z: 0 });
      }
      cs.B = [];                                                      // bubbles near antinodes 0, 3.4, 6.8 mm
      cs.bub.forEach(function (n, k) {
        for (var j = 0; j < n; j++) {
          var sd = rand() < 0.5 ? -1 : 1;
          cs.B.push({ p: k * HALF + (rand() - 0.5) * (k ? 0.8 : 1.1) - (k ? 0 : 0.25), dx: sd * (0.3 + rand() * 0.4),
                      r: 0.6 + rand() * 0.5, t0: 0.14 + rand() * 0.45, f: rand() * 6.28 });
        }
      });
    });
    var RANK = [['IRR2525-E1', 2], [' > ', -1], ['K2525-E4', 1], [' > ', -1], ['K2525-E1', 0], [' = ', -1], ['K3025-E1', 3], [' = 0', -1]];

    // ---- colours ----
    var col = {};
    function rgb(s) {
      s = (s || '').trim();
      if (s[0] === '#') {
        if (s.length === 4) s = '#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
        var n = parseInt(s.slice(1, 7), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255];
      }
      var m = s.match(/[\d.]+/g); return m ? [+m[0], +m[1], +m[2]] : [31, 78, 121];
    }
    function rgba(a, al) { return 'rgba(' + a[0] + ',' + a[1] + ',' + a[2] + ',' + al + ')'; }
    function theme() { col.acc = rgb(api.colors.accent); col.gold = rgb(api.colors.gold); }
    theme();

    // ---- layout ----
    var G = {};
    function layout(W, H) {
      G.fs = Math.max(10, W * 0.021);
      G.cx = W * 0.17; G.yTop = H * 0.08; G.yb = H * 0.78; G.hwT = W * 0.07; G.hwB = W * 0.048; G.dw = W * 0.024;
      G.yTip = H * 0.64; G.yFile = H * 0.05;
      G.y0 = W < 560 ? Math.max(H * 0.1, 50) : H * 0.1;
      G.mm = (G.yTip - G.y0) / P1;                                   // px per mm, shared by canal and plot
      G.y1 = G.yTip - P0 * G.mm;
      G.x0 = W * 0.68; G.x1 = W * 0.93;
      G.pTop = (G.yTip - G.yTop) / G.mm;
      G.Apx = W * 0.022; G.pFile = (G.yTip - G.yFile) / G.mm;
      G.mx = W * 0.465; G.bw = W * 0.15; G.bh = H * 0.17; G.by = H * 0.29;
      G.rD = Math.min(W * 0.04, H * 0.065); G.yD = H * 0.53 + G.rD + 2;
      G.dash = Math.max(4, W * 0.012);
    }
    api.onResize(layout);

    function Y(p) { return G.yTip - p * G.mm; }
    function hw(y) { return G.hwT + (G.hwB - G.hwT) * clamp((y - G.yTop) / (G.yb - G.yTop)); }
    function canalPath(o, top) {
      ctx.beginPath(); ctx.moveTo(G.cx - G.hwT - o, top);
      ctx.lineTo(G.cx - G.hwB - o, G.yb); ctx.arc(G.cx, G.yb, G.hwB + o, PI, 0, true); ctx.lineTo(G.cx + G.hwT + o, top);
    }
    function disp(p, A, s) {                                         // damped above the canal mouth (clamped root)
      var dmp = p > G.pTop ? 1 - 0.85 * clamp((p - G.pTop) / (G.pFile - G.pTop)) : 1;
      return G.Apx * A * Math.cos(PI * p / HALF) * (1 - 0.025 * p) * s * dmp;
    }
    function tri(x, y, s) { ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s * 0.9, y + s * 0.6); ctx.lineTo(x - s * 0.9, y + s * 0.6); ctx.closePath(); ctx.fill(); }

    function draw(t) {
      var c = api.colors, W = api.W, H = api.H, fs = G.fs;
      var ft = t * NC, ci = Math.floor(ft) % NC, u = ft - Math.floor(ft), cs = CASES[ci], pv = CASES[(ci + NC - 1) % NC];
      var mix = api.ease(clamp(u / 0.12)), amp = lerp(pv.amp, cs.amp, mix), gl = lerp(pv.g, cs.g, mix);
      var sw = Math.sin(2 * PI * 4 * u), fade = clamp(u / 0.06) * clamp((1 - u) / 0.06);
      var draw0 = clamp((u - 0.12) / 0.36), pf = P0 + (P1 - P0) * draw0;   // profile front (mm)

      // ---- canal: root silhouette + canal lumen ----
      canalPath(G.dw, G.yTop - G.dw * 0.6); ctx.fillStyle = c.alt; ctx.fill(); ctx.fillStyle = rgba(col.acc, c.dark ? 0.06 : 0.03); ctx.fill();
      ctx.strokeStyle = c.rule; ctx.globalAlpha = c.dark ? 1 : 0.9; ctx.lineWidth = 1; ctx.stroke(); ctx.globalAlpha = 1;
      canalPath(0, G.yTop); ctx.fillStyle = c.surface; ctx.fill();
      ctx.save(); ctx.clip();
      ctx.fillStyle = rgba(col.acc, c.dark ? 0.07 : 0.05); ctx.fillRect(0, 0, W * 0.4, H);
      // pressure-gradient hot spots at the antinodes (tip first)
      for (var k = 0; k * HALF < G.pTop - 0.3; k++) {
        var wk = lerp(pv.glow[Math.min(k, 2)], cs.glow[Math.min(k, 2)], mix) * (k > 2 ? 0.6 : 1);
        var ya = Y(k * HALF), R = hw(ya) * 1.15, al = wk * wk * (0.5 + 0.5 * Math.abs(sw)) * (c.dark ? 0.6 : 0.45);
        var gr = ctx.createRadialGradient(G.cx, ya, 0, G.cx, ya, R);
        gr.addColorStop(0, rgba(col.acc, al)); gr.addColorStop(1, rgba(col.acc, 0));
        ctx.fillStyle = gr; ctx.fillRect(G.cx - R, ya - R, 2 * R, 2 * R);
      }
      // acoustic-streaming cells: counter-rotating, between node and antinode
      var P = G.dash * 3.2, narrow = W < 460;
      ctx.setLineDash([G.dash * 1.6, G.dash * 1.6]); ctx.lineWidth = 1; ctx.strokeStyle = c.accent;
      ctx.globalAlpha = 0.18 + 0.5 * amp;
      for (var j = -1; (j + 1) * HALF / 2 < G.pTop - 0.2; j++) {
        var pc = j < 0 ? -0.75 : (j + 0.5) * HALF / 2, yc = Y(pc), h = hw(yc);
        if (narrow && pc > 2.5 && j % 2) continue;
        var ry = (j < 0 ? 0.5 : 0.7) * G.mm, rx = h * (j < 0 ? 0.36 : 0.24), xo = h * (j < 0 ? 0.45 : 0.64);
        for (var sd = -1; sd <= 1; sd += 2) {
          ctx.lineDashOffset = ((j + 2) % 2 ? 1 : -1) * sd * P * 20 * t;
          ctx.beginPath(); ctx.ellipse(G.cx + sd * xo, yc, rx, ry, 0, 0, 2 * PI); ctx.stroke();
        }
      }
      ctx.setLineDash([]); ctx.lineDashOffset = 0; ctx.globalAlpha = 1;
      // cross-section sweep while Gamma is being integrated
      if (draw0 > 0 && draw0 < 1) {
        ctx.strokeStyle = c.accent; ctx.globalAlpha = 0.55 * Math.sin(PI * draw0); ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(0, Y(pf)); ctx.lineTo(W * 0.4, Y(pf)); ctx.stroke(); ctx.globalAlpha = 1;
      }
      // cavitation bubbles
      var br = Math.max(1.8, W * 0.0042);
      ctx.lineWidth = 1; ctx.strokeStyle = c.gold; ctx.fillStyle = c.goldTint;
      cs.B.forEach(function (b) {
        var a = clamp((u - b.t0) / 0.05) * clamp((1 - u) / 0.07);
        if (a <= 0) return;
        var yb = Y(b.p) - (u - b.t0) * G.mm * 0.6, x = G.cx + disp(b.p, amp, sw) * 0.5 + b.dx * hw(yb) + Math.sin(u * 40 + b.f) * 0.8;
        var r = br * b.r * (0.6 + 0.4 * clamp((u - b.t0) / 0.12)) * (1 + 0.15 * Math.sin(2 * PI * 8 * u + b.f));
        var lim = hw(yb) - r - 1.5; x = Math.max(G.cx - lim, Math.min(G.cx + lim, x));
        ctx.globalAlpha = a; ctx.beginPath(); ctx.arc(x, yb, r, 0, 2 * PI); ctx.fill(); ctx.stroke();
      });
      ctx.globalAlpha = 1;
      ctx.restore();
      canalPath(0, G.yTop); ctx.strokeStyle = c.muted; ctx.lineWidth = 1.1; ctx.stroke();

      // ---- the oscillating file (standing wave) ----
      var NF = 48, pFile = G.pFile, i, p, x;
      var tT = Math.max(1.7, W * 0.0036), L = [], Rr = [];
      for (i = 0; i <= NF; i++) {
        p = pFile * i / NF; x = G.cx + disp(p, amp, sw); var th = 0.5 + (tT - 0.5) * i / NF;
        L.push(x - th, Y(p)); Rr.push(x + th, Y(p));
      }
      ctx.beginPath(); ctx.moveTo(L[0], L[1]);
      for (i = 2; i < L.length; i += 2) ctx.lineTo(L[i], L[i + 1]);
      for (i = Rr.length - 2; i >= 0; i -= 2) ctx.lineTo(Rr[i], Rr[i + 1]);
      ctx.closePath(); ctx.fillStyle = c.muted; ctx.fill();
      // nodes: small rings on the rest axis
      ctx.strokeStyle = c.muted; ctx.lineWidth = 1;
      for (k = 0; (k + 0.5) * HALF < pFile - 0.3; k++) {
        if ((k + 0.5) * HALF > G.pTop) break;
        ctx.beginPath(); ctx.arc(G.cx, Y((k + 0.5) * HALF), Math.max(2.2, W * 0.0045), 0, 2 * PI); ctx.stroke();
      }

      // ---- middle: max|grad p| -> sigmoid -> Gamma ----
      var mx = G.mx, sz = fs * 0.92;
      ctx.font = api.font(sz); var wA = ctx.measureText('max |\u2207p|').width, yA = H * 0.17;
      api.label('max |\u2207p|', mx, yA, { align: 'center', baseline: 'middle', size: sz, color: c.text });
      api.arrow(G.cx + hw(yA) + G.dw + 4, yA, mx - wA / 2 - 6, yA, { color: c.faint, width: 1, head: 5 });
      api.arrow(mx, yA + sz * 0.8, mx, G.by - 3, { color: c.faint, width: 1, head: 5 });
      var bx = mx - G.bw / 2, by = G.by, bw = G.bw, bh = G.bh;
      ctx.strokeStyle = c.muted; ctx.lineWidth = 1; ctx.beginPath();
      ctx.moveTo(bx, by); ctx.lineTo(bx, by + bh); ctx.lineTo(bx + bw, by + bh); ctx.stroke();
      var xa = bx + bw * 0.58;
      ctx.strokeStyle = c.faint; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(xa, by); ctx.lineTo(xa, by + bh); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = c.muted; ctx.lineWidth = 1.2; ctx.beginPath();
      for (i = 0; i <= 40; i++) { var sx = i / 40, X = bx + bw * sx, Yv = by + bh * (1 - 0.92 * sig(sx)); if (i) ctx.lineTo(X, Yv); else ctx.moveTo(X, Yv); }
      ctx.stroke();
      var pr = sig(gl), dx0 = bx + bw * gl, dy0 = by + bh * (1 - 0.92 * pr);
      ctx.strokeStyle = c.accent; ctx.globalAlpha = 0.45; ctx.lineWidth = 1; ctx.beginPath();
      ctx.moveTo(dx0, by + bh); ctx.lineTo(dx0, dy0); ctx.lineTo(bx, dy0); ctx.stroke(); ctx.globalAlpha = 1;
      ctx.fillStyle = c.accent; ctx.beginPath(); ctx.arc(dx0, dy0, Math.max(2.6, W * 0.005), 0, 2 * PI); ctx.fill();
      api.label('\u03b1', xa, by + bh + sz * 1.05, { align: 'center', size: sz, color: c.muted });
      api.arrow(mx, by + bh + sz * 1.4, mx, G.yD - G.rD - 3, { color: c.faint, width: 1, head: 5 });
      // cross-section: lumen filled by probability, square file section in the middle
      ctx.beginPath(); ctx.arc(mx, G.yD, G.rD, 0, 2 * PI);
      var rg = ctx.createRadialGradient(mx, G.yD, G.rD * 0.15, mx, G.yD, G.rD);
      rg.addColorStop(0, rgba(col.acc, 0.06 + 0.55 * pr)); rg.addColorStop(1, rgba(col.acc, 0.03 + 0.1 * pr));
      ctx.fillStyle = rg; ctx.fill(); ctx.strokeStyle = c.muted; ctx.lineWidth = 1; ctx.stroke();
      var sq = G.rD * 0.3; ctx.fillStyle = c.muted; ctx.fillRect(mx - sq / 2 + disp(0, amp, sw) * 0.25, G.yD - sq / 2, sq, sq);
      api.label('\u0393 = \u222b Prob dA / A', mx, G.yD + G.rD + sz * 1.25, { align: 'center', size: sz, color: c.accent });
      api.arrow(mx + G.rD + 5, G.yD, G.x0 - fs * 2.4, G.yD, { color: c.faint, width: 1, head: 5 });

      // ---- right: Gamma vs position from tip, with B-mode intensity ----
      var x0 = G.x0, x1 = G.x1, y0 = G.y0, y1 = G.y1, sc = (x1 - x0) * 0.9, gx = 2.5;
      ctx.strokeStyle = c.muted; ctx.lineWidth = 1.1; ctx.beginPath();
      ctx.moveTo(x0, y0 - 4); ctx.lineTo(x0, y1); ctx.lineTo(x1 + 4, y1); ctx.stroke();
      ctx.strokeStyle = c.rule; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(x0, Y(0)); ctx.lineTo(x1, Y(0)); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = c.muted; ctx.beginPath();
      for (k = 0; k <= 3; k++) { ctx.moveTo(x0 - 3, Y(k * 3)); ctx.lineTo(x0, Y(k * 3)); }
      ctx.stroke();
      ctx.save(); ctx.translate(x0 - fs * 0.75, (y0 + y1) / 2); ctx.rotate(-PI / 2);
      api.label('position from tip', 0, 0, { align: 'center', size: sz * 0.92, color: c.muted }); ctx.restore();
      var yl = y1 + fs * 1.45;
      var ll = fs * 1.1;
      ctx.strokeStyle = c.accent; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(x0, yl - fs * 0.33); ctx.lineTo(x0 + ll, yl - fs * 0.33); ctx.stroke();
      api.label('\u0393', x0 + ll + fs * 0.35, yl, { align: 'left', size: fs, color: c.accent });
      ctx.font = api.font(sz * 0.92); var wI = ctx.measureText('intensity').width, ts = Math.max(3, fs * 0.3);
      api.label('intensity', x1, yl, { align: 'right', size: sz * 0.92, color: c.gold });
      ctx.fillStyle = c.gold; tri(x1 - wI - ts * 1.6, yl - fs * 0.33, ts);
      // Gamma profile drawing itself from below the tip upward
      ctx.globalAlpha = fade; ctx.strokeStyle = c.accent; ctx.lineWidth = 1.8; ctx.beginPath();
      var nI = Math.round(draw0 * (NP - 1));
      for (i = 0; i <= nI; i++) { var X2 = x0 + gx + sc * cs.G[i], Y2 = Y(P0 + (P1 - P0) * i / (NP - 1)); if (i) ctx.lineTo(X2, Y2); else ctx.moveTo(X2, Y2); }
      if (nI > 0) ctx.stroke();
      if (draw0 > 0 && draw0 < 1) {
        ctx.fillStyle = c.accent; ctx.beginPath(); ctx.arc(x0 + gx + sc * cs.G[nI], Y(pf), Math.max(2.4, W * 0.0045), 0, 2 * PI); ctx.fill();
      }
      // experimental markers line up
      var ms = Math.max(2.4, W * 0.0052);
      cs.M.forEach(function (m, n) {
        var a = clamp((u - 0.5 - 0.2 * n / NM) / 0.05) * fade;
        if (a <= 0 || (narrow && n % 2)) return;
        var X3 = x0 + gx + sc * m.v, Y3 = Y(m.p), e = sc * m.e;
        if (m.z) { ctx.globalAlpha = a * 0.85; ctx.fillStyle = c.gold; tri(X3 + ms * 0.6, Y3, ms * 0.8); return; }
        ctx.globalAlpha = a * 0.55; ctx.strokeStyle = c.gold; ctx.lineWidth = 1; ctx.beginPath();
        ctx.moveTo(X3 - e, Y3); ctx.lineTo(X3 + e, Y3); ctx.moveTo(X3 - e, Y3 - ms * 0.5); ctx.lineTo(X3 - e, Y3 + ms * 0.5);
        ctx.moveTo(X3 + e, Y3 - ms * 0.5); ctx.lineTo(X3 + e, Y3 + ms * 0.5); ctx.stroke();
        ctx.globalAlpha = a; ctx.fillStyle = c.gold; tri(X3, Y3, ms);
      });
      if (cs.M[0].z) {
        ctx.globalAlpha = clamp((u - 0.5) / 0.08) * fade;
        api.label('no bubbles', x0 + fs * 1.5, Y(4.5), { align: 'left', size: sz * 0.92, color: c.faint });
      }
      ctx.globalAlpha = 1;

      // ---- case label + ranking strip ----
      ctx.globalAlpha = fade;
      api.label(cs.name, W * 0.04, H * 0.95, { align: 'left', size: fs, weight: 600, color: c.text });
      ctx.globalAlpha = 1;
      if (W >= 560) {
        var rs = fs * 0.78, rx0 = W * 0.33; ctx.font = api.font(rs);
        var reset = ci === NC - 1 ? clamp((1 - u) / 0.06) : 1;           // all but the first case go faint before the seam
        RANK.forEach(function (r) {
          if (r[1] < 0) { ctx.globalAlpha = 0.8; api.label(r[0], rx0, H * 0.95, { size: rs, color: c.faint }); }
          else {
            var on = r[1] <= ci ? (r[1] === 0 ? 1 : reset) : 0, cur = r[1] === ci ? fade : 0;
            ctx.globalAlpha = 1; api.label(r[0], rx0, H * 0.95, { size: rs, color: c.faint });
            if (on > 0) { ctx.globalAlpha = on; api.label(r[0], rx0, H * 0.95, { size: rs, color: c.muted }); }
            if (cur > 0) { ctx.globalAlpha = cur; api.label(r[0], rx0, H * 0.95, { size: rs, color: c.text }); }
          }
          ctx.font = api.font(rs); rx0 += ctx.measureText(r[0]).width;
        });
        ctx.globalAlpha = 1;
      }
    }

    return { draw: draw, theme: theme };
  });
})();
