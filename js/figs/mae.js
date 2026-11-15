/* Fig. 4 \u2014 Masked-autoencoder pretraining on microstructure (schematic).
   A voxel polycrystal tile is cut into 4\u00d74 patches and pulled apart; most
   patches are hatched out (masked). The few visible patches fly off and
   dive into the encoder, which squeezes them into a swelling latent code.
   The decoder fans back out: the masked patches first appear as a blurry
   guess, then sharpen, and the tile snaps back together (reconstruction).
   Only then (a separate fine-tune stage) the decoder dims and the encoder's
   latent feeds two downstream heads: effective stiffness C\u0304 and DMN \u03b8, w.
   Each loop half uses its own seeded mask; both halves start and end at the
   same state (input whole, output empty). Motion is deliberately exaggerated. */
(function () {
  'use strict';
  if (!window.FigKit) return;
  FigKit.register('mae', function (api) {
    var ctx = api.ctx, NC = 16, NP = 4, NZ = 6;                       // cells, patches per side, latent cells
    var vor = api.voronoi(NC, NC, 10, 4127), owner = vor.owner, seeds = vor.seeds;
    api.period = 12000;
    api.staticT = 0.34;                                               // mid-reconstruction: blurry guesses + sharp patches

    // two seeded mask patterns (one per loop half): 11 of 16 patches masked (~70 %)
    var masks = [0, 1].map(function (h) {
      var r = api.rand(901 + h * 37), ids = [], k;
      for (k = 0; k < 16; k++) ids.push(k);
      for (k = 15; k > 0; k--) { var q = Math.floor(r() * (k + 1)), tmp = ids[k]; ids[k] = ids[q]; ids[q] = tmp; }
      var m = [], order = [];
      for (k = 0; k < 16; k++) { m[ids[k]] = k < 11; order[ids[k]] = k < 11 ? k / 10 : 0; }
      var vis = ids.slice(11);
      var fly = vis.slice().sort(function (a, b) { return (b % NP) - (a % NP) || a - b; });   // rightmost leave first
      var slot = vis.slice().sort(function (a, b) { return a - b; });                         // mouth position by row
      return { m: m, order: order, fly: fly, slot: slot };
    });

    var g = {}, col = {}, sharp = document.createElement('canvas'), blur = document.createElement('canvas');
    // pre-render the tile once (sharp voxels + grain boundaries) and a blurry "first guess" version
    function rebuild() {
      if (!api.W) return;
      var px = Math.max(16, Math.round(g.s * api.dpr)), c = px / NC, x;
      sharp.width = sharp.height = blur.width = blur.height = px;
      x = sharp.getContext('2d');
      for (var j = 0; j < NC; j++) for (var i = 0; i < NC; i++) {
        x.fillStyle = col.fills[owner[j * NC + i]]; x.fillRect(Math.floor(i * c), Math.floor(j * c), Math.ceil(c) + 1, Math.ceil(c) + 1);
      }
      x.strokeStyle = col.gb; x.lineWidth = Math.max(1, api.W * 0.0022) * api.dpr; x.beginPath();
      for (j = 0; j < NC; j++) for (i = 0; i < NC; i++) {
        var o = owner[j * NC + i];
        if (i + 1 < NC && owner[j * NC + i + 1] !== o) { x.moveTo((i + 1) * c, j * c); x.lineTo((i + 1) * c, (j + 1) * c); }
        if (j + 1 < NC && owner[(j + 1) * NC + i] !== o) { x.moveTo(i * c, (j + 1) * c); x.lineTo((i + 1) * c, (j + 1) * c); }
      }
      x.stroke();
      var vox = document.createElement('canvas'), tiny = document.createElement('canvas'), vx, tx;
      vox.width = vox.height = NC; tiny.width = tiny.height = NC / 2;  // 1 px per voxel \u2192 exact 2\u00d72 averages
      vx = vox.getContext('2d'); for (j = 0; j < NC; j++) for (i = 0; i < NC; i++) { vx.fillStyle = col.fills[owner[j * NC + i]]; vx.fillRect(i, j, 1, 1); }
      tx = tiny.getContext('2d'); tx.imageSmoothingEnabled = true; tx.drawImage(vox, 0, 0, NC / 2, NC / 2);
      x = blur.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.drawImage(tiny, 0, 0, px, px);
    }
    function theme() {
      var c = api.colors;
      col.fills = seeds.map(function (s) { return api.grainFill(s.hue, s.sat); });
      col.gb = c.dark ? 'rgba(0,0,0,.6)' : 'rgba(255,255,255,.95)';
      col.hBg = c.dark ? c.alt : c.rule; col.hLn = c.dark ? c.muted : c.faint;   // dark: hatch darker than grains, lines brighter
      rebuild();
    }
    function layout() {
      var W = api.W, H = api.H, s = W * 0.28;
      g = { s: s, ps: s / NP, cy: H * 0.585, lx: W * 0.06, rx: W * 0.94 - s,
        e0: W * 0.39, e1: W * 0.47, d0: W * 0.53, d1: W * 0.61, zx: W * 0.5,
        hw: s * 0.44, nw: W * 0.062, zc: W * 0.016, zg: W * 0.0045, hy: H * 0.14 };                                // heads sit above
      g.ty = g.cy - s / 2; g.zh = NZ * g.zc + (NZ - 1) * g.zg;
      rebuild();
    }
    theme(); layout(); api.onResize(layout);

    function clamp(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
    function seg(u, a, b) { return api.ease(clamp((u - a) / (b - a))); }
    function fs() { return Math.max(10, api.W * 0.02); }
    // patch p's top-left in a tile at x0 with explode gap `gap`
    function ppos(x0, p, gap) { var i = p % NP, j = (p / NP) | 0; return [x0 + i * g.ps + (i - 1.5) * gap, g.ty + j * g.ps + (j - 1.5) * gap]; }
    // draw patch p from an offscreen tile, scaled `k` about its centre; `w` < 1 = left part only (wipe)
    function blit(src, p, x, y, k, w) {
      if (k <= 0.01) return;
      var pp = src.width / NP, sz = g.ps * k, ox = x + (g.ps - sz) / 2, oy = y + (g.ps - sz) / 2; w = w === undefined ? 1 : w;
      if (w > 0.001) ctx.drawImage(src, (p % NP) * pp, ((p / NP) | 0) * pp, pp * w, pp, ox, oy, sz * w, sz);
    }
    function hatch(x, y, k) {
      if (k <= 0.01) return;
      var sz = g.ps * k, ox = x + (g.ps - sz) / 2, oy = y + (g.ps - sz) / 2;
      ctx.fillStyle = col.hBg; ctx.fillRect(ox, oy, sz, sz);
      ctx.save(); ctx.beginPath(); ctx.rect(ox, oy, sz, sz); ctx.clip();
      ctx.strokeStyle = col.hLn; ctx.globalAlpha = 0.6; ctx.lineWidth = 1; ctx.beginPath();
      for (var d = -sz; d < sz; d += g.ps / 4.5) { ctx.moveTo(ox + d, oy + sz); ctx.lineTo(ox + d + sz, oy); }
      ctx.stroke(); ctx.restore();
    }
    function slotOutline(x, y, color, a) {
      ctx.strokeStyle = color; ctx.globalAlpha = a; ctx.lineWidth = 1; ctx.setLineDash([2, 3]);
      ctx.strokeRect(x + 0.5, y + 0.5, g.ps - 1, g.ps - 1); ctx.setLineDash([]); ctx.globalAlpha = 1;
    }
    function trapezoid(x0, x1, h0, h1, a) {
      ctx.globalAlpha = a; ctx.beginPath();
      ctx.moveTo(x0, g.cy - h0); ctx.lineTo(x1, g.cy - h1); ctx.lineTo(x1, g.cy + h1); ctx.lineTo(x0, g.cy + h0); ctx.closePath();
      ctx.fillStyle = api.colors.accentTint; ctx.fill(); ctx.strokeStyle = api.colors.muted; ctx.globalAlpha = 0.6 * a; ctx.lineWidth = 1; ctx.stroke();
      ctx.globalAlpha = 0.22 * a; ctx.beginPath();                    // faint layer lines
      for (var k = 1; k < 4; k++) { var f = k / 4, x = x0 + (x1 - x0) * f, h = h0 + (h1 - h0) * f; ctx.moveTo(x, g.cy - h * 0.8); ctx.lineTo(x, g.cy + h * 0.8); }
      ctx.stroke(); ctx.globalAlpha = 1;
    }
    function rail(x1, y1, x2, y2, a, head) {                          // dotted connector, as in Fig. 0
      ctx.strokeStyle = ctx.fillStyle = api.colors.muted; ctx.globalAlpha = a; ctx.lineWidth = 1; ctx.setLineDash([2, 3]);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.bezierCurveTo((x1 + x2) / 2, y1, (x1 + x2) / 2, y2, x2, y2); ctx.stroke(); ctx.setLineDash([]);
      if (head) { var hl = Math.max(4, api.W * 0.008); ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x2 - hl, y2 - hl * 0.55); ctx.lineTo(x2 - hl, y2 + hl * 0.55); ctx.closePath(); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
    function pulse(x, y, color, a) {
      ctx.fillStyle = color; ctx.globalAlpha = 0.18 * a; ctx.beginPath(); ctx.arc(x, y, api.W * 0.012, 0, 7); ctx.fill();
      ctx.globalAlpha = a; ctx.beginPath(); ctx.arc(x, y, Math.max(2.2, api.W * 0.0045), 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    }
    function bez(p0, p1, v) {                                         // vertical-tangent cubic, as the hero's tree edges
      var iv = 1 - v, my = (p0[1] + p1[1]) / 2;
      return [iv * iv * iv * p0[0] + 3 * iv * iv * v * p0[0] + 3 * iv * v * v * p1[0] + v * v * v * p1[0],
              iv * iv * iv * p0[1] + 3 * iv * iv * v * my + 3 * iv * v * v * my + v * v * v * p1[1]];
    }
    // downstream glyphs: a 6\u00d76 stiffness matrix and a mini binary tree (DMN)
    function matrixGlyph(x, y, sz, color, a) {
      var c = sz / 6; ctx.fillStyle = color;
      for (var j = 0; j < 6; j++) for (var i = 0; i < 6; i++) {
        var on = (i < 3 && j < 3) ? (i === j ? 1 : 0.55) : (i === j ? 0.8 : 0);
        if (!on) continue; ctx.globalAlpha = a * on; ctx.fillRect(x - sz / 2 + i * c + 0.4, y - sz / 2 + j * c + 0.4, c - 0.8, c - 0.8);
      }
      ctx.globalAlpha = a; ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.beginPath();
      [-1, 1].forEach(function (sd) { var bx = x + sd * (sz / 2 + 2.5); ctx.moveTo(bx - sd * 2, y - sz / 2 - 1); ctx.lineTo(bx, y - sz / 2 - 1); ctx.lineTo(bx, y + sz / 2 + 1); ctx.lineTo(bx - sd * 2, y + sz / 2 + 1); });
      ctx.stroke(); ctx.globalAlpha = 1;
    }
    function treeGlyph(x, y, sz, color, a) {
      var pts = [[0, -0.5], [-0.3, 0], [0.3, 0], [-0.45, 0.5], [-0.15, 0.5], [0.15, 0.5], [0.45, 0.5]], r = Math.max(1.6, sz * 0.09);
      ctx.strokeStyle = ctx.fillStyle = color; ctx.globalAlpha = a; ctx.lineWidth = 1; ctx.beginPath();
      [[0, 1], [0, 2], [1, 3], [1, 4], [2, 5], [2, 6]].forEach(function (e) { ctx.moveTo(x + pts[e[0]][0] * sz, y + pts[e[0]][1] * sz); ctx.lineTo(x + pts[e[1]][0] * sz, y + pts[e[1]][1] * sz); });
      ctx.stroke();
      pts.forEach(function (p) { ctx.beginPath(); ctx.arc(x + p[0] * sz, y + p[1] * sz, r, 0, 7); ctx.fill(); });
      ctx.globalAlpha = 1;
    }

    function draw(t) {
      var c = api.colors, W = api.W, half = t < 0.5 ? 0 : 1, u = (t - half * 0.5) / 0.5, M = masks[half];
      // phases of one half: explode+mask \u2192 fly \u2192 encode \u2192 decode \u2192 blurry guess \u2192 sharpen \u2192 fine-tune \u2192 reset
      var reset = seg(u, 0.92, 0.98), ft = seg(u, 0.78, 0.82) * (1 - seg(u, 0.92, 0.97)), dim = 1 - 0.65 * ft;
      var gapL = g.ps * 0.14 * seg(u, 0, 0.08) * (1 - seg(u, 0.92, 0.99));
      var gapR = g.ps * 0.14 * (1 - seg(u, 0.72, 0.8) * (1 - reset));
      var act = Math.max(seg(u, 0.26, 0.44) * (1 - seg(u, 0.5, 0.62)), 0.7 * Math.sin(Math.PI * seg(u, 0.76, 0.9)));
      var nv = M.fly.length, zTop = g.cy - g.zh / 2, zBot = g.cy + g.zh / 2;
      var mouth = function (p) { var r = M.slot.indexOf(p); return [g.e0 + (g.e1 - g.e0) * 0.35, g.cy + (r - (nv - 1) / 2) / ((nv - 1) / 2) * g.hw * 0.62]; };
      var fly = M.fly.map(function (p, i) { return seg(u, 0.1 + i * 0.035, 0.24 + i * 0.035); });

      // ---- static rails: tile rows \u2192 encoder mouth, decoder \u2192 reconstructed rows ----
      for (var r = 0; r < NP; r++) {
        var ry = g.ty + (r + 0.5) * g.ps, off = (r - 1.5) / 1.5;
        rail(g.lx + g.s + W * 0.022, ry, g.e0 - 2, g.cy + off * g.hw * 0.62, 0.35, true);
        rail(g.d1 + 2, g.cy + off * g.hw * 0.62, g.rx - W * 0.024, ry, 0.35 * dim, true);
      }

      // ---- left tile: input; masked patches hatch over, visible ones leave an empty slot ----
      for (var p = 0; p < 16; p++) {
        var lp = ppos(g.lx, p, gapL);
        if (M.m[p]) { blit(sharp, p, lp[0], lp[1], 1); hatch(lp[0], lp[1], seg(u, 0.02 + M.order[p] * 0.07, 0.06 + M.order[p] * 0.07) * (1 - reset)); }
        else {
          var gone = fly[M.fly.indexOf(p)] > 0 ? 1 - seg(u, 0.92, 0.97) : 0;
          if (gone > 0) slotOutline(lp[0], lp[1], c.faint, 0.8);
          blit(sharp, p, lp[0], lp[1], 1 - gone);
        }
      }

      // ---- right tile: empty slots \u2192 visible patches \u2192 blurry guesses \u2192 sharp, then snaps together ----
      for (p = 0; p < 16; p++) {
        var rp = ppos(g.rx, p, gapR), o = M.order[p], z = 1 - reset;
        var full = (M.m[p] ? clamp((u - 0.57 - o * 0.07) / 0.05) : clamp((u - 0.55) / 0.05)) * z;
        if (full < 1) slotOutline(rp[0], rp[1], c.rule, dim);       // empty slot only where no patch sits
        ctx.globalAlpha = dim;
        if (!M.m[p]) { blit(sharp, p, rp[0], rp[1], seg(u, 0.55, 0.6) * z); continue; }
        var b = seg(u, 0.57 + o * 0.07, 0.62 + o * 0.07) * z, w = clamp((u - 0.64 - o * 0.07) / 0.05);
        blit(blur, p, rp[0], rp[1], b); ctx.globalAlpha = dim; blit(sharp, p, rp[0], rp[1], b, w);
        if (b > 0.5 && w < 1) { ctx.strokeStyle = c.accent; ctx.globalAlpha = 0.85 * dim; ctx.lineWidth = 1.2; ctx.setLineDash([3, 2]); ctx.strokeRect(rp[0] + 1, rp[1] + 1, g.ps - 2, g.ps - 2); ctx.setLineDash([]); }
      }
      ctx.globalAlpha = 1;

      // ---- visible patches fly off and dive into the encoder (drawn before it, so they vanish inside) ----
      M.fly.forEach(function (p, i) {
        var f = fly[i]; if (f <= 0 || f >= 1) return;
        var s0 = ppos(g.lx, p, gapL), sx = s0[0] + g.ps / 2, sy = s0[1] + g.ps / 2, m = mouth(p);
        var iv = 1 - f, cx = m[0] - (m[0] - sx) * 0.25;               // quadratic: launch level, then curve in
        var x = iv * iv * sx + 2 * iv * f * cx + f * f * m[0], y = iv * iv * sy + 2 * iv * f * sy + f * f * m[1];
        var k = 1 - 0.5 * clamp(f * 2.2), sz = g.ps * k;
        ctx.fillStyle = c.surface; ctx.fillRect(x - sz / 2 - 1.5, y - sz / 2 - 1.5, sz + 3, sz + 3);
        blit(sharp, p, x - g.ps / 2, y - g.ps / 2, k);
        ctx.strokeStyle = c.accent; ctx.globalAlpha = 0.8; ctx.lineWidth = 1; ctx.strokeRect(x - sz / 2, y - sz / 2, sz, sz); ctx.globalAlpha = 1;
      });

      // ---- encoder / decoder (decoder dims during fine-tune: it is discarded) ----
      trapezoid(g.e0, g.e1, g.hw, g.nw, 1);
      trapezoid(g.d0, g.d1, g.nw, g.hw, dim);

      // ---- downstream heads: dashed branches off the latent, lit only in the fine-tune stage ----
      var heads = [{ x: W * 0.405, lab: 'C\u0304', al: 'right', glyph: matrixGlyph }, { x: W * 0.595, lab: 'DMN \u03b8, w', al: 'left', glyph: treeGlyph }];
      var hs = Math.max(14, W * 0.05), hp = seg(u, 0.8, 0.88), glow = Math.sin(Math.PI * seg(u, 0.86, 0.94));
      heads.forEach(function (h) {
        var p0 = [g.zx, zTop - g.zg * 2], p1 = [h.x, g.hy + hs * 0.75];
        ctx.strokeStyle = ft > 0.5 ? c.gold : c.muted; ctx.globalAlpha = 0.3 + 0.45 * ft; ctx.lineWidth = 1.1; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.bezierCurveTo(p0[0], (p0[1] + p1[1]) / 2, p1[0], (p0[1] + p1[1]) / 2, p1[0], p1[1]); ctx.stroke(); ctx.setLineDash([]);
        if (hp > 0 && hp < 1) { var q = bez(p0, p1, hp); pulse(q[0], q[1], c.gold, Math.sin(Math.PI * hp)); }
        if (glow > 0) { ctx.fillStyle = c.gold; ctx.globalAlpha = 0.14 * glow; ctx.beginPath(); ctx.arc(h.x, g.hy, hs * 0.7 + W * 0.012 * glow, 0, 7); ctx.fill(); }
        h.glyph(h.x, g.hy, hs, ft > 0.02 ? c.gold : c.faint, 0.55 + 0.45 * ft);
        var lx = h.al === 'right' ? h.x - hs * 0.5 - W * 0.025 : h.x + hs * 0.5 + W * 0.025;
        api.label(h.lab, lx, g.hy, { align: h.al, baseline: 'middle', size: fs(), color: ft > 0.02 ? c.gold : c.muted });
      });

      // ---- latent code: swells and lights up when the encoder pulses arrive ----
      for (var k = 0; k < NZ; k++) {
        var zw = g.zc * (1 + 0.9 * act), zy = zTop + k * (g.zc + g.zg), zx = g.zx - zw / 2;
        var lv = 0.5 + 0.5 * Math.sin(2 * Math.PI * 6 * t + k * 1.9);
        ctx.fillStyle = c.surface; ctx.fillRect(zx, zy, zw, g.zc);
        ctx.fillStyle = c.accent; ctx.globalAlpha = 0.1 + 0.8 * act * (0.4 + 0.6 * lv); ctx.fillRect(zx, zy, zw, g.zc);
        ctx.globalAlpha = 0.75; ctx.strokeStyle = c.accent; ctx.lineWidth = 1; ctx.strokeRect(zx + 0.5, zy + 0.5, zw - 1, g.zc - 1); ctx.globalAlpha = 1;
      }

      // ---- pulses: each token continues as a pulse to the latent; decoder pulses fan out to the rows ----
      M.fly.forEach(function (p, i) {
        var e = seg(u, 0.24 + i * 0.035, 0.32 + i * 0.035); if (e <= 0 || e >= 1) return;
        var m = mouth(p), zy = zTop + (M.slot.indexOf(p) + 0.5) / nv * g.zh;
        pulse(m[0] + (g.zx - g.zc - m[0]) * e, m[1] + (zy - m[1]) * e, c.accent, Math.sin(Math.PI * Math.min(1, 0.5 + e)));
      });
      var dec = seg(u, 0.46, 0.58);
      if (dec > 0 && dec < 1) for (r = 0; r < NP; r++) {
        var y0 = zTop + (r + 1) / (NP + 1) * g.zh, y1 = g.ty + (r + 0.5) * g.ps;
        pulse(g.zx + g.zc + (g.rx - g.zx - g.zc) * dec, y0 + (y1 - y0) * dec, c.accent, Math.sin(Math.PI * dec));
      }

      // ---- labels ----
      var ly = g.ty + g.s + g.ps * 0.21 + fs() * 1.45;
      api.label('mask', g.lx + g.s / 2, ly, { align: 'center', size: fs() });
      ctx.globalAlpha = dim; api.label('reconstruct', g.rx + g.s / 2, ly, { align: 'center', size: fs() }); ctx.globalAlpha = 1;
    }

    return { draw: draw, theme: theme };
  });
})();
