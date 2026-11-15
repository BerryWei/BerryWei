/* Fig. 7 -- Endodontic irrigation: how a CFD pressure field becomes Gamma(z).
   Information flows field -> field -> field -> profile, left to right:
   A  local field: the ultrasonic file oscillates in the canal (standing
      wave, tip = antinode) and the live pressure-gradient magnitude
      ||grad p(x,t)|| glows in lobes at the tip and antinodes, on the side
      the file swings toward. A probe point traces ||grad p|| over one cycle
      on a small time ruler; its maximum is marked.
   B  max over the cycle: a second copy of the canal accumulates the running
      maximum over t of the field in A (pixels only get hotter), ending as
      ||grad p||_max(x).
   C  sigmoid: the max field is mapped through a sigmoid with threshold
      alpha into the bubble probability field Prob(x).
   D  integrate: a cross-section sweeps down C; each slice is integrated
      and divided by its area, depositing one point of Gamma(z) on the
      profile (shared vertical axis), then B-mode bubble intensity markers
      (mean +/- sd) line up with it.
   Four validation cases loop (6.5 s each). Within a case the file in A
   oscillates three times while B accumulates the running max over exactly
   one of those cycles. K2525-E1 and K3025-E1 give no bubbles; K2525-E4
   cavitates at the tip; the softer IRR2525 swings more and cavitates at the
   tip and antinodes. A is shown normalised per case with a sqrt display
   gamma so its lobes stay visible even in weak cases; B, C and D use one
   absolute scale. The sigmoid uses a steepness KS on the normalised field
   (the formula has unit slope in physical units). Schematic, not data. */
(function () {
  'use strict';
  if (!window.FigKit) return;
  FigKit.register('endo', function (api) {
    var ctx = api.ctx, NC = 4, HALF = 3.4, PI = Math.PI;
    var PT = 9.4, PB = -1.6, AF = 0.32, TH = 0.07, ALPHA = 0.58, KS = 16;
    var NX = 44, NY = 116, NT = 40;
    // per-case timeline (u in [0,1)): sweep one cycle, sigmoid, integrate, markers, fade
    var S0 = 0.04, S1 = S0 + 1 / 3, C1 = 0.47, I1 = 0.70, M0 = 0.70, F0 = 0.94;
    api.period = 26000;
    api.staticT = (2 + 0.79) / 4;                                    // IRR2525: full pipeline, file at max swing

    function clamp(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
    function lerp(a, b, f) { return a + (b - a) * f; }
    function frac(x) { return x - Math.floor(x); }
    function gauss(x, m, s) { var d = (x - m) / s; return Math.exp(-0.5 * d * d); }
    function sig(v) { return 1 / (1 + Math.exp(-(v - ALPHA) * KS)); }
    function win(u, a, b) { return clamp((u - a) / 0.02) * clamp((b - u) / 0.02); }

    var CASES = [
      { name: 'K2525 \u00b7 E1', amp: 0.55, g: 0.30, glow: [0.55, 0.25, 0.25] },
      { name: 'K2525 \u00b7 E4', amp: 0.78, g: 0.68, glow: [1.0, 0.35, 0.4] },
      { name: 'IRR2525 \u00b7 E1', amp: 1.0, g: 0.86, glow: [1.0, 0.9, 1.0] },
      { name: 'K3025 \u00b7 E1', amp: 0.34, g: 0.18, glow: [0.3, 0.15, 0.15] }
    ];
    var RANK = [['IRR2525-E1', 2], ['gt', -1], ['K2525-E4', 1], ['gt', -1], ['K2525-E1', 0], ['eq', -1], ['K3025-E1', 3], ['gzero', -1]];
    function smooth(x) { x = clamp(x); return x * x * (3 - 2 * x); }

    // ---- the time-harmonic field  ||grad p(x,t)||  (s: across, top half-width = 1; p: mm from tip) ----
    function xfile(cs, p, sn) { p = Math.max(0, p); return AF * cs.amp * Math.cos(PI * p / HALF) * (1 - 0.025 * p) * sn; }
    function field(cs, s, p, ph, r) {
      var sn = Math.sin(ph), dx = s - xfile(cs, p, sn), d;
      d = p >= 0 ? Math.abs(dx) - TH : Math.sqrt(dx * dx + p * p * r * r) - TH;
      var e = Math.exp(-Math.max(0, d) / 0.33), front = 0.42 + 0.58 * smooth(0.5 + dx * sn / 0.3);
      var w = 0.1 + cs.glow[0] * gauss(p, 0, 1) + cs.glow[1] * gauss(p, HALF, 1) + cs.glow[2] * gauss(p, 2 * HALF, 1);
      return cs.g * w * Math.abs(sn) * e * front;
    }

    // ---- colours + colormap ----
    var col = {}, LUT = new Uint8ClampedArray(256 * 3);
    function rgb(s) {
      s = (s || '').trim();
      if (s[0] === '#') {
        if (s.length === 4) s = '#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
        var n = parseInt(s.slice(1, 7), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255];
      }
      var m = s.match(/[\d.]+/g); return m ? [+m[0], +m[1], +m[2]] : [31, 78, 121];
    }
    function rgba(a, al) { return 'rgba(' + Math.round(a[0]) + ',' + Math.round(a[1]) + ',' + Math.round(a[2]) + ',' + al + ')'; }
    function mixc(a, b, f) { return [lerp(a[0], b[0], f), lerp(a[1], b[1], f), lerp(a[2], b[2], f)]; }
    function theme() {
      var c = api.colors;
      col.acc = rgb(c.accent); col.gold = rgb(c.gold); col.surf = rgb(c.surface);
      var hot = c.dark ? mixc(col.gold, [255, 236, 190], 0.25) : mixc(col.acc, [8, 16, 40], 0.45);   // light: deep blue, no muddy blend
      var stops = [[0, col.surf], [0.22, mixc(col.surf, col.acc, 0.18)], [0.5, mixc(col.surf, col.acc, c.dark ? 0.62 : 0.55)],
                   [0.74, col.acc], [0.9, mixc(col.acc, hot, c.dark ? 0.6 : 0.55)], [1, hot]];
      for (var i = 0; i < 256; i++) {
        var v = i / 255, k = 0;
        while (k < stops.length - 2 && v > stops[k + 1][0]) k++;
        var f = (v - stops[k][0]) / (stops[k + 1][0] - stops[k][0]), q = mixc(stops[k][1], stops[k + 1][1], api.ease(f) * 0.4 + f * 0.6);
        LUT[i * 3] = q[0]; LUT[i * 3 + 1] = q[1]; LUT[i * 3 + 2] = q[2];
      }
    }
    theme();

    // ---- layout + precomputed coarse fields ----
    var G = {}, SL = [], GM = [], GAM = [], GMAX = 1, MK = [], TR = [], TRM = [], AMAX = [], ASC = [], IN, ROWP, PKEY = '';
    var cvs = [0, 1, 2].map(function () { var cv = document.createElement('canvas'); cv.width = NX; cv.height = NY; return cv; });
    var imgs = cvs.map(function (cv) { return cv.getContext('2d').createImageData(NX, NY); });
    var bufA = new Float32Array(NX * NY), bufB = new Float32Array(NX * NY), bufC = new Float32Array(NX * NY);

    function layout(W, H) {
      G.narrow = W < 460;
      G.fs = Math.max(10, W * 0.021);
      G.yW = H * 0.06; G.yT = G.narrow ? H * 0.085 : H * 0.125;
      G.top = G.narrow ? H * 0.17 : H * 0.2; G.apex = H * 0.8;
      G.mm = (G.apex - G.top) / (PT - PB); G.yTip = G.top + PT * G.mm;
      G.sx = W * 0.05; G.hb = 0.62 * G.sx; G.yc = G.apex - G.hb; G.dw = W * 0.016;
      G.cx = [W * 0.115, W * 0.325, W * 0.535];
      G.x0 = W * 0.7; G.x1 = W * 0.925;
      G.yArr = Y(1.5 * HALF);
      precompute();
    }
    function Y(p) { return G.yTip - p * G.mm; }
    function hwAt(y) { return y <= G.yc ? lerp(G.sx, G.hb, clamp((y - G.top) / (G.yc - G.top))) : Math.sqrt(Math.max(0, G.hb * G.hb - (y - G.yc) * (y - G.yc))); }

    function precompute() {                                         // depends only on the aspect ratio r: skip if unchanged
      var r = G.mm / G.sx, i, j, k, n, ci, key = r.toFixed(3);
      if (key === PKEY) return; PKEY = key;
      IN = new Uint8Array(NX * NY); ROWP = new Float32Array(NY);
      for (j = 0; j < NY; j++) {
        var y = G.top + (j + 0.5) * (G.apex - G.top) / NY, h = hwAt(y) / G.sx;
        ROWP[j] = (G.yTip - y) / G.mm;
        for (i = 0; i < NX; i++) IN[j * NX + i] = Math.abs(((i + 0.5) / NX) * 2 - 1) <= h ? 1 : 0;
      }
      GMAX = 1e-6;
      for (ci = 0; ci < NC; ci++) {
        var cs = CASES[ci], sl = [], acc = new Float32Array(NX * NY), am = 1e-6;
        for (k = 0; k < NT; k++) {
          var f = new Float32Array(NX * NY), ph = 2 * PI * k / NT;
          for (j = 0; j < NY; j++) for (i = 0; i < NX; i++) {
            n = j * NX + i; f[n] = field(cs, ((i + 0.5) / NX) * 2 - 1, ROWP[j], ph, r);
            if (f[n] > acc[n]) acc[n] = f[n];
          }
          sl.push(f);
        }
        for (n = 0; n < NX * NY; n++) if (acc[n] > am) am = acc[n];
        SL[ci] = sl; GM[ci] = acc; AMAX[ci] = am; ASC[ci] = 0.45 + 0.55 * cs.g / 0.86;   // A: weak cases stay paler
        var gam = new Float32Array(NY);                               // Gamma(z) = (1/A) int_A Prob dA, slice by slice
        for (j = 0; j < NY; j++) {
          var sum = 0, cnt = 0;
          for (i = 0; i < NX; i++) { n = j * NX + i; if (IN[n]) { sum += sig(acc[n]); cnt++; } }
          gam[j] = cnt ? sum / cnt : 0; if (gam[j] > GMAX) GMAX = gam[j];
        }
        GAM[ci] = gam;
        // probe trace (tip lobe, swing side +) over one cycle
        var tr = new Float32Array(97), ps = 0.45, pp = 0.35;
        var tm = 1e-6;
        for (k = 0; k <= 96; k++) { tr[k] = field(cs, ps, pp, 2 * PI * k / 96, r); if (tr[k] > tm) tm = tr[k]; }
        TR[ci] = tr; TRM[ci] = tm;
      }
      // B-mode markers: schematic, follow each case's Gamma with scatter
      var rand = api.rand(3025);
      for (ci = 0; ci < NC; ci++) {
        var mk = [];
        for (k = 0; k < 20; k++) {
          var q = PT - 0.4 - k * (PT - PB - 0.8) / 19, jj = Math.max(0, Math.min(NY - 1, Math.round((PT - q) / (PT - PB) * NY - 0.5)));
          var g = GAM[ci][jj] / GMAX, v = 0.05 + 0.88 * g + (rand() - 0.5) * 0.05, e = 0.04 + rand() * 0.05;
          if (ci === 0 || ci === 3) mk.push({ p: q, v: 0, e: 0, z: 1 });
          else mk.push({ p: q, v: Math.max(0.03, Math.min(0.94, v)), e: e, z: 0 });
        }
        MK[ci] = mk;
      }
    }
    api.onResize(layout);

    function paint(n, buf, al) {                                     // value buffer -> colormapped offscreen canvas
      var D = imgs[n].data;
      for (var q = 0; q < NX * NY; q++) {
        var v = Math.round(clamp(buf[q]) * 255) * 3, o = q * 4;
        D[o] = LUT[v]; D[o + 1] = LUT[v + 1]; D[o + 2] = LUT[v + 2]; D[o + 3] = 255;
      }
      cvs[n].getContext('2d').putImageData(imgs[n], 0, 0);
    }
    function canalPath(cx, o, top) {
      var hb = G.hb + o;
      ctx.beginPath(); ctx.moveTo(cx - G.sx - o, top); ctx.lineTo(cx - hb, G.yc);
      ctx.arc(cx, G.yc, hb, PI, 0, true); ctx.lineTo(cx + G.sx + o, top);
    }
    function panel(n, al, cx) {
      var c = api.colors;
      canalPath(cx, G.dw, G.top - G.dw * 0.5); ctx.fillStyle = c.alt; ctx.fill();
      ctx.strokeStyle = c.rule; ctx.lineWidth = 1; ctx.stroke();
      canalPath(cx, 0, G.top); ctx.closePath(); ctx.fillStyle = c.surface; ctx.fill();
      if (al > 0) {
        ctx.save(); ctx.clip(); ctx.globalAlpha = al; ctx.imageSmoothingEnabled = true;
        ctx.drawImage(cvs[n], cx - G.sx, G.top, 2 * G.sx, G.apex - G.top); ctx.restore(); ctx.globalAlpha = 1;
      }
      canalPath(cx, 0, G.top); ctx.strokeStyle = c.muted; ctx.lineWidth = 1.1; ctx.stroke();
    }
    function fileShape(cx, cs, amp, sn, fill, alpha) {
      var NF = 44, i, p, x, L = [], R = [], tT = Math.max(1.6, api.W * 0.0034), pTop = (G.yTip - (G.top - api.H * 0.035)) / G.mm;
      for (i = 0; i <= NF; i++) {
        p = pTop * i / NF; var dmp = p > PT ? 1 - 0.8 * clamp((p - PT) / (pTop - PT)) : 1;
        x = cx + G.sx * AF * amp * Math.cos(PI * p / HALF) * (1 - 0.025 * p) * sn * dmp;
        var th = 0.6 + (tT - 0.6) * i / NF; L.push(x - th, Y(p)); R.push(x + th, Y(p));
      }
      ctx.beginPath(); ctx.moveTo(L[0], L[1]);
      for (i = 2; i < L.length; i += 2) ctx.lineTo(L[i], L[i + 1]);
      for (i = R.length - 2; i >= 0; i -= 2) ctx.lineTo(R[i], R[i + 1]);
      ctx.closePath(); ctx.globalAlpha = alpha; ctx.fillStyle = fill; ctx.fill(); ctx.globalAlpha = 1;
    }
    function dots(x1, y1, x2, y2, a, sp, t) {                        // pulses flowing along an arrow
      if (a <= 0) return;
      var r = Math.max(1.7, api.W * 0.0036);
      for (var i = 0; i < 3; i++) {
        var f = frac(t * sp + i / 3), x = lerp(x1, x2, f), y = lerp(y1, y2, f);
        ctx.globalAlpha = a * Math.sin(PI * f); ctx.fillStyle = api.colors.accent;
        ctx.beginPath(); ctx.arc(x, y, r * 2.2, 0, 7); ctx.globalAlpha *= 0.25; ctx.fill();
        ctx.globalAlpha = a * Math.sin(PI * f); ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    function tri(x, y, s) { ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s * 0.9, y + s * 0.6); ctx.lineTo(x - s * 0.9, y + s * 0.6); ctx.closePath(); ctx.fill(); }

    function draw(t) {
      var c = api.colors, W = api.W, H = api.H, fs = G.fs, nar = G.narrow, q, j;
      var ft = t * NC, ci = Math.floor(ft) % NC, u = ft - Math.floor(ft), cs = CASES[ci], pv = CASES[(ci + NC - 1) % NC];
      var mix = api.ease(clamp(u / 0.08)), amp = lerp(pv.amp, cs.amp, mix);
      var cyc = frac(3 * (u - S0)), ph = 2 * PI * cyc, sn = Math.sin(ph);
      var sw = clamp((u - S0) / (S1 - S0)), fade = clamp((1 - u) / (1 - F0));
      var tx = api.tex, hs = nar ? fs * 0.95 : fs * 0.98;

      // ---- A: live local field ----
      var kf = cyc * NT, k0 = Math.floor(kf) % NT, k1 = (k0 + 1) % NT, kr = kf - Math.floor(kf);
      var a0 = SL[ci][k0], a1 = SL[ci][k1], b0 = SL[(ci + NC - 1) % NC][k0], b1 = SL[(ci + NC - 1) % NC][k1];
      var pci = (ci + NC - 1) % NC, iA = 1 / AMAX[ci], iP = 1 / AMAX[pci];
      for (q = 0; q < NX * NY; q++) bufA[q] = lerp(ASC[pci] * Math.sqrt(lerp(b0[q], b1[q], kr) * iP), ASC[ci] * Math.sqrt(lerp(a0[q], a1[q], kr) * iA), mix);
      paint(0, bufA); panel(0, 1, G.cx[0]);
      fileShape(G.cx[0], cs, amp, sn, c.muted, 1);
      // ---- B: running max over t ----
      var ks = Math.min(NT - 1, Math.floor(sw * NT)), sl = SL[ci], kk, v;
      if (sw >= 1) bufB.set(GM[ci]);
      else for (q = 0; q < NX * NY; q++) {
        v = u >= S0 ? lerp(a0[q], a1[q], kr) : 0;
        for (kk = 0; kk <= ks; kk++) if (sl[kk][q] > v) v = sl[kk][q];
        bufB[q] = v;
      }
      var aB = u < S0 ? 0 : fade;
      paint(1, bufB); panel(1, aB, G.cx[1]);
      fileShape(G.cx[1], cs, cs.amp, 0, c.faint, 0.55);
      // ---- C: sigmoid -> Prob ----
      var aC = clamp((u - S1) / 0.035) * fade, mC = api.ease(clamp((u - S1 - 0.03) / 0.07)), gm = GM[ci];
      for (q = 0; q < NX * NY; q++) bufC[q] = lerp(gm[q], sig(gm[q]), mC);
      paint(2, bufC); panel(2, aC, G.cx[2]);
      fileShape(G.cx[2], cs, cs.amp, 0, c.faint, 0.55);

      // probe ring (A and B)
      var px = G.cx[0] + 0.45 * G.sx, py = Y(0.35), pr = Math.max(2.6, W * 0.0055);
      if (!nar) {
        ctx.strokeStyle = c.text; ctx.lineWidth = 1; ctx.globalAlpha = 0.8;
        ctx.beginPath(); ctx.arc(px, py, pr, 0, 7); ctx.stroke();
        ctx.globalAlpha = 0.8 * aB; ctx.beginPath(); ctx.arc(px + G.cx[1] - G.cx[0], py, pr, 0, 7); ctx.stroke();
        ctx.globalAlpha = 0.5; ctx.strokeStyle = c.muted; ctx.setLineDash([2, 3]); ctx.beginPath();   // leader: probe -> its trace
        ctx.moveTo(px, py + pr + 1); ctx.lineTo(px, H * 0.89 - H * 0.06 - 3); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
      }

      // ---- headers ----
      var hy = G.yT;
      if (!nar) {
        var wsz = fs * 0.8;
        api.label('local field', G.cx[0], G.yW, { align: 'center', size: wsz, color: c.muted });
        api.label('max over cycle', G.cx[1], G.yW, { align: 'center', size: wsz, color: c.muted });
        api.label('sigmoid', G.cx[2], G.yW, { align: 'center', size: wsz, color: c.muted });
      }
      tx('grad', G.cx[0], hy, { size: hs, align: 'center', baseline: 'middle', color: c.text });
      tx(nar ? 'maxshort' : 'maxt', G.cx[1], hy, { size: hs, align: 'center', baseline: 'middle', color: c.text });
      tx('probshort', G.cx[2], hy, { size: hs, align: 'center', baseline: 'middle', color: c.text });
      if (nar) tx('Gammaz', G.x0, hy, { size: hs, align: 'left', baseline: 'middle', color: c.accent });
      else tx('gamma', G.x0 - fs * 0.6, hy, { size: fs * 0.92, align: 'left', baseline: 'middle', color: c.accent });

      // ---- arrows + flowing pulses ----
      var ya = G.yArr, g0 = W * 0.012;
      var e01 = [G.cx[0] + G.sx + G.dw + g0, G.cx[1] - G.sx - G.dw - g0], e12 = [G.cx[1] + G.sx + G.dw + g0, G.cx[2] - G.sx - G.dw - g0];
      var e23 = [G.cx[2] + G.sx + G.dw + g0, G.x0 - (nar ? g0 : fs * 1.5)];
      [e01, e12, e23].forEach(function (e) { api.arrow(e[0], ya, e[1], ya, { color: c.faint, width: 1, head: 5 }); });
      dots(e01[0], ya, e01[1] - 4, ya, win(u, S0, S1), 9, t * NC);
      dots(e12[0], ya, e12[1] - 4, ya, win(u, S1, C1 + 0.02), 9, t * NC);
      dots(e23[0], ya, e23[1] - 4, ya, win(u, C1, I1) * 0.6, 9, t * NC);

      // sigmoid glyph between B and C (wide only)
      if (!nar) {
      var gx0 = e12[0] + (e12[1] - e12[0]) * 0.08, gw = (e12[1] - e12[0]) * 0.84, gh = Math.min(H * 0.075, gw * 0.75), gy = ya - fs * 1.5 - gh;
      ctx.strokeStyle = c.muted; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(gx0, gy); ctx.lineTo(gx0, gy + gh); ctx.lineTo(gx0 + gw, gy + gh); ctx.stroke();
      var gxa = gx0 + gw * ALPHA;
      ctx.strokeStyle = c.faint; ctx.setLineDash([2, 2]); ctx.beginPath(); ctx.moveTo(gxa, gy); ctx.lineTo(gxa, gy + gh); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = c.accent; ctx.lineWidth = 1.3; ctx.beginPath();
      for (j = 0; j <= 30; j++) { var sv = j / 30, X = gx0 + gw * sv, Yv = gy + gh * (1 - 0.92 * sig(sv)); if (j) ctx.lineTo(X, Yv); else ctx.moveTo(X, Yv); }
      ctx.stroke();
      var bc = win(u, S1, C1 + 0.02);
      if (bc > 0) {
        var sv2 = frac((u - S1) * 22), dX = gx0 + gw * sv2, dY = gy + gh * (1 - 0.92 * sig(sv2));
        ctx.globalAlpha = bc; ctx.fillStyle = c.accent; ctx.beginPath(); ctx.arc(dX, dY, Math.max(2, W * 0.004), 0, 7); ctx.fill(); ctx.globalAlpha = 1;
      }
      tx('alpha', gxa, gy + gh + 2, { size: fs * 0.85, align: 'center', baseline: 'top', color: c.muted });
      }

      // ---- B, C: name the fields + shared colour scale (wide only) ----
      if (!nar) {
        var yF = G.apex + H * 0.05, aBC = Math.max(aB, 0);
        ctx.globalAlpha = aBC; tx('gradmaxs', G.cx[1], yF, { size: fs * 0.72, align: 'center', baseline: 'middle', color: c.muted });
        ctx.globalAlpha = aC; tx('prob', G.cx[2], yF, { size: fs * 0.62, align: 'center', baseline: 'middle', color: c.muted });
        ctx.globalAlpha = aBC;
        var cbL = G.cx[1] - G.sx * 0.9, cbR = G.cx[2] + G.sx * 0.9, cbY = G.apex + H * 0.1, cbH = Math.max(3, H * 0.011), NB = 48;
        for (j = 0; j < NB; j++) {
          var li = Math.round(j / (NB - 1) * 255) * 3;
          ctx.fillStyle = 'rgb(' + LUT[li] + ',' + LUT[li + 1] + ',' + LUT[li + 2] + ')';
          ctx.fillRect(cbL + (cbR - cbL) * j / NB, cbY - cbH / 2, (cbR - cbL) / NB + 0.6, cbH);
        }
        ctx.strokeStyle = c.rule; ctx.lineWidth = 1; ctx.strokeRect(cbL, cbY - cbH / 2, cbR - cbL, cbH);
        tx('zero', cbL - 4, cbY, { size: fs * 0.72, align: 'right', baseline: 'middle', color: c.muted });
        tx('one', cbR + 4, cbY, { size: fs * 0.72, align: 'left', baseline: 'middle', color: c.muted });
        ctx.globalAlpha = 1;
      }

      // ---- A: time ruler + probe trace ----
      var tw = G.sx * 2.6, tL = G.cx[0] - tw / 2, tB = H * (nar ? 0.875 : 0.89), th = nar ? 0 : H * 0.06, tr = TR[ci], tmax = 0, km = 0;
      ctx.strokeStyle = c.muted; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(tL, tB); ctx.lineTo(tL + tw, tB);
      ctx.moveTo(tL, tB - 3); ctx.lineTo(tL, tB + 3); ctx.moveTo(tL + tw, tB - 3); ctx.lineTo(tL + tw, tB + 3); ctx.stroke();
      tx('t', tL + tw + 5, tB + 1, { size: fs * 0.85, align: 'left', baseline: 'middle', color: c.muted });
      if (!nar) {
        var lim = u < S0 ? -1 : sw >= 1 ? 96 : Math.floor(sw * 96), sc0 = th * 0.95, itm = 1 / TRM[ci];
        ctx.strokeStyle = c.accent; ctx.lineWidth = 1.3; ctx.beginPath();
        for (j = 0; j <= lim; j++) {
          var X1 = tL + tw * j / 96, Y1 = tB - sc0 * Math.sqrt(tr[j] * itm);
          if (j) ctx.lineTo(X1, Y1); else ctx.moveTo(X1, Y1);
          if (tr[j] > tmax) { tmax = tr[j]; km = j; }
        }
        if (lim > 0) { ctx.globalAlpha = fade; ctx.stroke(); }
        if (lim > 0 && tmax > 0.01) {
          var yM = tB - sc0 * Math.sqrt(tmax * itm);
          ctx.strokeStyle = c.gold; ctx.setLineDash([2, 2]); ctx.beginPath(); ctx.moveTo(tL, yM); ctx.lineTo(tL + tw, yM); ctx.stroke(); ctx.setLineDash([]);
          ctx.fillStyle = c.gold; ctx.beginPath(); ctx.arc(tL + tw * km / 96, yM, Math.max(2.2, W * 0.0042), 0, 7); ctx.fill();
          tx('maxshort', tL + tw + 4, yM, { size: fs * 0.62, align: 'left', baseline: 'middle', color: c.gold });
        }
        ctx.globalAlpha = 1;
      }
      var cxr = tL + tw * cyc;                                        // cursor: current t in the cycle
      ctx.strokeStyle = c.text; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(cxr, tB + 3); ctx.lineTo(cxr, tB - Math.max(th, 5)); ctx.stroke();

      // ---- D: Gamma(z) built slice by slice ----
      var x0 = G.x0, x1 = G.x1, y0 = G.top, y1 = G.apex, sc = (x1 - x0) * 0.9 / GMAX, gam = GAM[ci], gxo = 2;
      ctx.strokeStyle = c.muted; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(x0, y0 - 4); ctx.lineTo(x0, y1); ctx.lineTo(x1 + 4, y1); ctx.stroke();
      if (!nar) { ctx.strokeStyle = c.rule; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(x0, Y(0)); ctx.lineTo(x1, Y(0)); ctx.stroke(); ctx.setLineDash([]); }
      api.arrow(x0, y1, x0, y0 - fs * 0.5, { color: c.muted, width: 1.1, head: 5 });
      tx('z', x0 - 5, y0 - fs * 0.2, { size: fs * 0.95, align: 'right', baseline: 'middle', color: c.muted });
      if (!nar) api.label('tip', x0 - 4, Y(0), { align: 'right', baseline: 'middle', size: fs * 0.72, color: c.faint });
      var ig = clamp((u - C1) / (I1 - C1)), nI = Math.round(ig * (NY - 1));
      if (u >= C1) {
        ctx.globalAlpha = fade; ctx.strokeStyle = c.accent; ctx.lineWidth = 1.8; ctx.beginPath();
        for (j = 0; j <= nI; j++) { var X2 = x0 + gxo + sc * gam[j], Y2 = Y(ROWP[j]); if (j) ctx.lineTo(X2, Y2); else ctx.moveTo(X2, Y2); }
        if (nI > 0) ctx.stroke();
        ctx.globalAlpha = 1;
      }
      if (ig > 0 && ig < 1) {                                         // the sweeping cross-section
        var ys = Y(ROWP[nI]), hs2 = hwAt(ys), al2 = Math.sin(PI * ig) * 0.5 + 0.5, gX = x0 + gxo + sc * gam[nI];
        ctx.strokeStyle = c.text; ctx.lineWidth = 2; ctx.globalAlpha = 0.85;
        ctx.beginPath(); ctx.moveTo(G.cx[2] - hs2, ys); ctx.lineTo(G.cx[2] + hs2, ys); ctx.stroke();
        ctx.strokeStyle = c.accent; ctx.lineWidth = 1; ctx.globalAlpha = 0.45 * al2; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(G.cx[2] + hs2 + 3, ys); ctx.lineTo(gX, ys); ctx.stroke(); ctx.setLineDash([]);
        dots(G.cx[2] + hs2 + 3, ys, gX, ys, 0.9, 7, t * NC);
        ctx.globalAlpha = 1; ctx.fillStyle = c.accent; ctx.beginPath(); ctx.arc(gX, ys, Math.max(2.4, W * 0.0045), 0, 7); ctx.fill();
      }
      // B-mode markers
      var ms = Math.max(2.4, W * 0.005), mk = MK[ci];
      mk.forEach(function (m, n) {
        var a = clamp((u - M0 - 0.08 * n / mk.length) / 0.03) * fade;
        if (a <= 0 || (nar && n % 2)) return;
        var X3 = x0 + gxo + (x1 - x0) * 0.9 * m.v, Y3 = Y(m.p), e = (x1 - x0) * 0.9 * m.e;
        if (m.z) {                                                    // zero intensity: hollow, set off the axis
          ctx.globalAlpha = a * 0.9; tri(X3 + ms * 1.8, Y3, ms * 0.85); ctx.strokeStyle = c.gold; ctx.lineWidth = 1.1; ctx.stroke(); return;
        }
        ctx.globalAlpha = a * 0.55; ctx.strokeStyle = c.gold; ctx.lineWidth = 1; ctx.beginPath();
        ctx.moveTo(X3 - e, Y3); ctx.lineTo(X3 + e, Y3); ctx.moveTo(X3 - e, Y3 - ms * 0.5); ctx.lineTo(X3 - e, Y3 + ms * 0.5);
        ctx.moveTo(X3 + e, Y3 - ms * 0.5); ctx.lineTo(X3 + e, Y3 + ms * 0.5); ctx.stroke();
        ctx.globalAlpha = a; ctx.fillStyle = c.gold; tri(X3, Y3, ms);
      });
      if (mk[0].z) {
        ctx.globalAlpha = clamp((u - M0) / 0.05) * fade;
        api.label('no bubbles', x0 + fs * 1.4, Y(4.6), { align: 'left', size: fs * 0.82, color: c.faint });
      }
      ctx.globalAlpha = 1;
      // legend
      var yl = y1 + fs * 1.5, ll = fs * 1.1;
      ctx.strokeStyle = c.accent; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(x0, yl); ctx.lineTo(x0 + ll, yl); ctx.stroke();
      tx('Gamma', x0 + ll + 4, yl, { size: fs * 0.95, align: 'left', baseline: 'middle', color: c.accent });
      var lsz = fs * (nar ? 0.8 : 0.78), ltxt = nar ? 'B-mode' : 'B-mode int.';
      ctx.font = api.font(lsz); var wI = ctx.measureText(ltxt).width, ts = Math.max(3, fs * 0.3);
      api.label(ltxt, x1, yl, { align: 'right', size: lsz, baseline: 'middle', color: c.gold });
      ctx.fillStyle = c.gold; tri(x1 - wI - ts * 1.7, yl, ts);

      // ---- case label + ranking strip ----
      var yb = H * 0.955;
      ctx.globalAlpha = Math.min(clamp(u / 0.04), fade);
      api.label(cs.name, W * 0.04, yb, { align: 'left', size: fs, weight: 600, color: c.text });
      ctx.globalAlpha = 1;
      if (W >= 560) {
        var rs = fs * 0.74, rx0 = W * 0.33; ctx.font = api.font(rs);
        var reset = ci === NC - 1 ? fade : 1, rf = Math.min(clamp(u / 0.04), fade), yr = yb - rs * 0.35, gap = rs * 0.45;
        RANK.forEach(function (r) {
          if (r[1] < 0) {                                             // relation symbols in LaTeX
            ctx.globalAlpha = 0.85;
            var d = tx(r[0], rx0 + gap, yr + rs * 0.12, { size: rs * 1.05, align: 'left', baseline: 'middle', color: c.faint });
            rx0 += d.w + 2 * gap; return;
          }
          var on = r[1] === ci ? rf : r[1] < ci ? reset : 0;          // current case bold, seen cases muted
          ctx.globalAlpha = 1; api.label(r[0], rx0, yb, { size: rs, color: c.faint, baseline: 'middle' });
          if (on > 0) { ctx.globalAlpha = on; api.label(r[0], rx0, yb, { size: rs, baseline: 'middle', color: r[1] === ci ? c.text : c.muted }); }
          ctx.font = api.font(rs); rx0 += ctx.measureText(r[0]).width;
        });
        ctx.globalAlpha = 1;
      }
    }

    return { draw: draw, theme: theme };
  });
})();
