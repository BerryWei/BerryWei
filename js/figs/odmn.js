/* Fig. 1 \u2014 ODMN schematic (sibling of the hero Fig. 0).
   A depth-3 material network: internal nodes carry interaction
   (equilibrium) directions as fixed ticks; each of the 8 leaves carries its
   own crystal lattice, drawn as a small rotated square unit cell. Under load
   the lattices rotate (texture evolution) while the interaction directions
   stay put (decoupled). The rotation is plastic: on unloading only the
   stretch springs back a little, the texture is kept. On the right, each
   leaf's four <10> poles turn with its lattice and gather into a texture.
   The loop closes with a fade back to the virgin state.
   Abstract: deformation and rotation are exaggerated. */
(function () {
  'use strict';
  if (!window.FigKit) return;
  FigKit.register('odmn', function (api) {
    var ctx = api.ctx, rand = api.rand(1125), D2R = Math.PI / 180;
    var DEPTH = 3, NLEAF = 1 << DEPTH;
    api.staticT = 0.68;                                               // loaded + unloaded: texture kept

    // ---- tree nodes (level 0 = root ... level 3 = leaves) ----
    var nodes = [];
    for (var L = 0; L <= DEPTH; L++) for (var k = 0; k < (1 << L); k++) {
      nodes.push({ L: L, k: k, theta: (20 + rand() * 140) * D2R, x: 0, y: 0, r: 0 });
    }
    function nodeAt(L, k) { return nodes[(1 << L) - 1 + k]; }

    // ---- leaves: colour, lattice angle (start far from 45\u00b0, end near it), pole radius ----
    var START = [6, 72, 17, 84, 24, 66, 11, 78];                      // every one \u2265 21\u00b0 from 45\u00b0
    var RAD = [0.50, 0.78, 0.36, 0.64, 0.86, 0.43, 0.71, 0.57];        // distinct radii \u2192 clusters read as dots
    var leaves = [];
    for (var q = 0; q < NLEAF; q++) {
      var th0 = (START[q] + rand() * 3) * D2R;
      var tgt = (45 + ((q * 3) % 8 - 3.5) * 2.6) * D2R;              // fan of \u00b19\u00b0 around the preferred 45\u00b0
      leaves.push({ hue: (q * 0.375 + rand() * 0.06) % 1, sat: 0.6 + rand() * 0.3, th0: th0, dth: tgt - th0,
                    rp: RAD[q], fill: '', soft: '' });
    }
    function theme() {
      leaves.forEach(function (lf) { lf.fill = api.grainFill(lf.hue, lf.sat, true); lf.soft = api.grainFill(lf.hue, lf.sat, false); });
    }
    theme();

    // ---- layout (recomputed on resize) ----
    var G = {};
    function layout(W, H) {
      var x0 = W * 0.06, x1 = W * 0.56, top = H * 0.14, leafY = H * 0.54;
      nodes.forEach(function (nd) {
        nd.x = x0 + (x1 - x0) * (nd.k + 0.5) / (1 << nd.L);
        nd.y = top + (leafY - top) * nd.L / DEPTH;
        nd.r = Math.max(4.5, W * (0.016 - nd.L * 0.0015));
      });
      G.small = W < 480;
      G.cell = Math.max(5, W * 0.0155);                               // half-side of the lattice glyph
      G.box = { cx: (x0 + x1) / 2, cy: H * 0.765, s: W * 0.1 };        // macro specimen (reference width)
      G.pf = { cx: W * 0.78, cy: H * 0.49, R: Math.min(W * 0.17, H * 0.36) };
      G.dot = Math.max(G.small ? 3.5 : 2.6, W * 0.0072);
    }
    api.onResize(layout);

    // ---- timeline: load 0\u2013.45, elastic springback .45\u2013.6, hold, fade out .78\u2013.87, fade in virgin .87\u2013.96 ----
    function clamp(x) { return Math.max(0, Math.min(1, x)); }
    function state(t) {
      t = ((t % 1) + 1) % 1;
      var s = api.ease(clamp(t / 0.45));                               // texture / plastic progress (never reverses)
      var F = 1 + 0.5 * s - 0.06 * api.ease(clamp((t - 0.45) / 0.15)); // 1.00 \u2192 1.50 \u2192 1.44
      var vis = 1, virgin = false;
      if (t >= 0.78 && t < 0.87) vis = 1 - api.ease((t - 0.78) / 0.09);
      else if (t >= 0.87) { virgin = true; vis = api.ease(clamp((t - 0.87) / 0.09)); }
      if (virgin) { s = 0; F = 1; }
      return { s: s, F: F, vis: vis };
    }
    function leafAngle(lf, s) { return lf.th0 + lf.dth * s; }

    // lattice glyph: rotated square cell; at small sizes outline + corner atoms only
    function lattice(x, y, a, h, lf) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      ctx.fillStyle = lf.soft; ctx.fillRect(-h, -h, 2 * h, 2 * h);
      ctx.strokeStyle = lf.fill; ctx.lineWidth = G.small ? 2 : 1.4; ctx.strokeRect(-h, -h, 2 * h, 2 * h);
      if (!G.small) { ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-h, 0); ctx.lineTo(h, 0); ctx.moveTo(0, -h); ctx.lineTo(0, h); ctx.stroke(); }
      ctx.fillStyle = lf.fill;
      var ar = Math.max(1.7, h * 0.22), pts = [[-h, -h], [h, -h], [h, h], [-h, h]];
      if (!G.small) pts.push([0, 0]);
      pts.forEach(function (p) { ctx.beginPath(); ctx.arc(p[0], p[1], ar, 0, 7); ctx.fill(); });
      ctx.restore();
    }

    function bez(ch, pa, u) {                                         // point on the child\u2192parent edge
      var my = (pa.y + ch.y) / 2, iv = 1 - u;
      return { x: (iv * iv * iv + 3 * iv * iv * u) * ch.x + (3 * iv * u * u + u * u * u) * pa.x,
               y: iv * iv * iv * ch.y + 3 * iv * iv * u * my + 3 * iv * u * u * my + u * u * u * pa.y };
    }

    function draw(t) {
      var c = api.colors, W = api.W, H = api.H, st = state(t), s = st.s;
      var fs = Math.max(10, W * 0.021);

      // ---- tree edges ----
      ctx.lineWidth = 1.2; ctx.strokeStyle = c.muted; ctx.globalAlpha = 0.45; ctx.beginPath();
      for (var n = 1; n < nodes.length; n++) {
        var nd = nodes[n], p = nodeAt(nd.L - 1, nd.k >> 1);
        ctx.moveTo(p.x, p.y); ctx.bezierCurveTo(p.x, (p.y + nd.y) / 2, nd.x, (p.y + nd.y) / 2, nd.x, nd.y);
      }
      ctx.stroke(); ctx.globalAlpha = 1;

      // ---- internal nodes: fixed interaction directions (decoupled from the lattices) ----
      nodes.forEach(function (nd) {
        if (nd.L === DEPTH) return;
        var col = nd.L === 0 ? c.accent : c.muted, rr = nd.r * 0.72;
        ctx.beginPath(); ctx.arc(nd.x, nd.y, nd.r, 0, 7); ctx.fillStyle = c.surface; ctx.fill();
        ctx.lineWidth = 1.3; ctx.strokeStyle = col; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(nd.x - Math.cos(nd.theta) * rr, nd.y - Math.sin(nd.theta) * rr);
        ctx.lineTo(nd.x + Math.cos(nd.theta) * rr, nd.y + Math.sin(nd.theta) * rr); ctx.lineWidth = 1.2; ctx.stroke();
      });

      // ---- pulses (on top of nodes, linear along each edge): accent up while loading, gold down on springback ----
      var up = t < 0.45, ph = up ? t / 0.45 : (t - 0.45) / 0.17;
      if (ph < 1) {
        var segF = ph * DEPTH, seg = Math.min(DEPTH - 1, Math.floor(segF)), u = segF - seg;
        var Lc = up ? DEPTH - seg : seg + 1, fade = Math.sin(Math.PI * ph);
        if (!up) u = 1 - u;
        ctx.fillStyle = up ? c.accent : c.gold;
        for (var m = 0; m < (1 << Lc); m++) {
          var pp = bez(nodeAt(Lc, m), nodeAt(Lc - 1, m >> 1), u);
          ctx.globalAlpha = 0.18 * fade; ctx.beginPath(); ctx.arc(pp.x, pp.y, 6, 0, 7); ctx.fill();
          ctx.globalAlpha = fade; ctx.beginPath(); ctx.arc(pp.x, pp.y, 2.4, 0, 7); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      // ---- leaves: faint initial-orientation tick + rotating lattice ----
      for (var q = 0; q < NLEAF; q++) {
        var lf = leaves[q], nl = nodeAt(DEPTH, q), tl = G.cell * 1.9;
        ctx.strokeStyle = c.faint; ctx.lineWidth = 1; ctx.globalAlpha = 0.8;
        ctx.beginPath(); ctx.moveTo(nl.x - Math.cos(lf.th0) * tl, nl.y - Math.sin(lf.th0) * tl);
        ctx.lineTo(nl.x + Math.cos(lf.th0) * tl, nl.y + Math.sin(lf.th0) * tl); ctx.stroke();
        ctx.globalAlpha = st.vis;
        lattice(nl.x, nl.y, leafAngle(lf, s), G.cell, lf);
        ctx.globalAlpha = 1;
      }

      // ---- macro specimen: visual stretch exaggerated 2\u00d7 relative to F11 ----
      var B = G.box, Fv = 1 + 2 * (st.F - 1), bw = B.s * Fv, bh = B.s * 0.72 / Math.sqrt(Fv);
      ctx.globalAlpha = st.vis;
      for (var g = 0; g < NLEAF; g++) {                                // 4\u00d72 voxel 'grains', one per leaf colour
        ctx.fillStyle = leaves[(g * 5) % NLEAF].soft;
        ctx.fillRect(B.cx - bw / 2 + bw * (g % 4) / 4, B.cy - bh / 2 + bh * (g >> 2) / 2, bw / 4 + 0.5, bh / 2 + 0.5);
      }
      ctx.strokeStyle = c.muted; ctx.lineWidth = 1; ctx.strokeRect(B.cx - bw / 2, B.cy - bh / 2, bw, bh);
      // F11 readout: 'F' with a smaller lowered '11'
      var ly = B.cy + B.s * 0.36 + fs * 1.9, fx = B.cx - fs * 2.6;
      ctx.globalAlpha = st.vis;
      api.label('F', fx, ly, { size: fs });
      api.label('11', fx + fs * 0.62, ly + fs * 0.22, { size: fs * 0.7 });
      api.label(st.F.toFixed(2), fx + fs * 1.85, ly, { size: fs, color: c.text });
      ctx.globalAlpha = 1;

      // ---- pole figure: four <10> poles per leaf, turning exactly with its lattice ----
      var P = G.pf, dr = G.dot;
      ctx.strokeStyle = c.rule; ctx.lineWidth = 1; ctx.beginPath();
      ctx.moveTo(P.cx - P.R, P.cy); ctx.lineTo(P.cx + P.R, P.cy); ctx.moveTo(P.cx, P.cy - P.R); ctx.lineTo(P.cx, P.cy + P.R); ctx.stroke();
      ctx.strokeStyle = c.muted; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(P.cx, P.cy, P.R, 0, 7); ctx.stroke();
      ctx.beginPath();                                                 // loading-axis marks
      ctx.moveTo(P.cx - P.R - 6, P.cy); ctx.lineTo(P.cx - P.R + 2, P.cy); ctx.moveTo(P.cx + P.R - 2, P.cy); ctx.lineTo(P.cx + P.R + 6, P.cy); ctx.stroke();
      var ringA = G.small ? 0.6 : 0.5;
      for (var q2 = 0; q2 < NLEAF; q2++) {
        var lf2 = leaves[q2], r2 = lf2.rp * P.R, a2 = leafAngle(lf2, s);
        for (var j = 0; j < 4; j++) {
          var off = j * Math.PI / 2;
          // initial pole: faint ring
          ctx.strokeStyle = lf2.fill; ctx.globalAlpha = ringA; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(P.cx + Math.cos(lf2.th0 + off) * r2, P.cy + Math.sin(lf2.th0 + off) * r2, dr, 0, 7); ctx.stroke();
          // short trail, only while the lattice is turning
          ctx.fillStyle = lf2.fill;
          for (var i = 3; i >= 1 && t < 0.5; i--) {
            var ag = leafAngle(lf2, state(t - i * 0.02).s);
            if (Math.abs(ag - a2) * r2 < dr * 0.8) continue;
            ctx.globalAlpha = st.vis * 0.3 * (1 - i / 4);
            ctx.beginPath(); ctx.arc(P.cx + Math.cos(ag + off) * r2, P.cy + Math.sin(ag + off) * r2, dr * 0.7, 0, 7); ctx.fill();
          }
          ctx.globalAlpha = st.vis;
          ctx.beginPath(); ctx.arc(P.cx + Math.cos(a2 + off) * r2, P.cy + Math.sin(a2 + off) * r2, dr, 0, 7); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      api.label('\u27e810\u27e9 poles', P.cx, P.cy + P.R + fs * 1.6, { align: 'center', size: fs });
    }

    return { draw: draw, theme: theme };
  });
})();
