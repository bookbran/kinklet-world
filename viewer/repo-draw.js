// @astrolabe-premium
// repo-draw.js: how a repository world is drawn (E.2, E.3a), shared by the
// world beside a chat and the same world expanded. Islands with thickness,
// files as small lit objects in six families, three landmarks, the board's
// door as node art, names by distance, and a course lens that lets the land a
// build does not touch recede. Everything is drawn on the core's own globe
// through its layer seam and its `paint` option.
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const BOARD_MARK = 71000;
  // ── small helpers ────────────────────────────────────────────────────────
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const norm3 = (v) => { const l = Math.hypot(v.x, v.y, v.z) || 1; return { x: v.x / l, y: v.y / l, z: v.z / l }; };
  const dot3 = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
  const ang = (a, b) => Math.acos(Math.max(-1, Math.min(1, dot3(a, b))));
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }
  function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function frameAt(c) {
    const up = Math.abs(c.y) < 0.95 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
    const e1 = norm3({ x: up.y * c.z - up.z * c.y, y: up.z * c.x - up.x * c.z, z: up.x * c.y - up.y * c.x });
    return { e1, e2: { x: c.y * e1.z - c.z * e1.y, y: c.z * e1.x - c.x * e1.z, z: c.x * e1.y - c.y * e1.x } };
  }
  function onCap(c, f, th, d) {
    const s = Math.sin(d), k = Math.cos(d), a = Math.cos(th), b = Math.sin(th);
    return norm3({ x: c.x * k + (f.e1.x * a + f.e2.x * b) * s, y: c.y * k + (f.e1.y * a + f.e2.y * b) * s, z: c.z * k + (f.e1.z * a + f.e2.z * b) * s });
  }
  // a loop scaled about its centre on the sphere (small angles)
  const scaleLoop = (c, loop, k) => loop.map((v) => norm3({ x: c.x + (v.x - c.x) * k, y: c.y + (v.y - c.y) * k, z: c.z + (v.z - c.z) * k }));
  // colours: tokens resolve to hex here (repo-world.css); rgb() is read too
  function rgbOf(c) {
    const s = String(c || '').trim();
    let m = /^#([0-9a-f]{6})$/i.exec(s);
    if (m) { const n = parseInt(m[1], 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
    m = /^#([0-9a-f]{3})$/i.exec(s);
    if (m) return m[1].split('').map((x) => parseInt(x + x, 16));
    m = /rgba?\(([^)]+)\)/.exec(s);
    if (m) return m[1].split(',').slice(0, 3).map((x) => parseFloat(x));
    return [160, 180, 255];
  }
  const mixRgb = (a, b, t) => a.map((v, i) => Math.round(v * (1 - t) + b[i] * t));
  const css = (a, al = 1) => `rgba(${a[0]},${a[1]},${a[2]},${al})`;
  const WHITE = [255, 255, 255], INK = [6, 7, 24];
  // Remembered per look (2026-10-09): read per file per frame, a computed-style
  // read was most of a second of one profiled tab switch. A theme toggle, a
  // custom look or the system scheme forgets them
  const tokenSeen = new Map();
  const token = (name, fallback) => {
    let v = tokenSeen.get(name);
    if (v === undefined) { v = (getComputedStyle(document.documentElement).getPropertyValue(name) || '').trim(); tokenSeen.set(name, v); }
    return v || fallback;
  };
  try {
    new MutationObserver(() => tokenSeen.clear())
      .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] });
  } catch (_) {}
  try { window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => tokenSeen.clear()); } catch (_) {}
  const nowStamp = (iso) => { if (!iso) return null; const d = new Date(iso); return isNaN(d) ? null : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); };

  // a course lens: its current work comes forward, its other work stays, the rest recedes
  const lensFade = (W, file) => { const L = W.lens; if (!L) return 1; return L.near.has(file.path) ? 1 : L.rel.has(file.path) ? 0.82 : 0.28; };
  const lensGrow = (W, file) => { const L = W.lens; return L && L.near.has(file.path) ? 1.15 : 1; };
  // ── file families: small lit objects ─────────────────────────────────────
  // Form and material first, hue restrained: every form is lit from the upper
  // left like its island, and its colour is the family token (repo-world.css).
  // ORDINARY FILES ARE SMALL GEMSTONES (slice 13): one family of lit objects,
  // told apart by silhouette and material first and hue second. Every form is
  // small, lit from the upper left, and finished with the same pinpoint glint,
  // so a JS crystal and a Markdown tablet read as cousins, not as a legend.
  const glint = (ctx, x, y, s, a = 0.9) => { a *= GLINT; if (a <= 0) return; ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.beginPath(); ctx.arc(x, y, Math.max(0.55, s * 0.13), 0, TAU); ctx.fill(); };
  const FORMS = {
    src(ctx, x, y, s, c) { // a faceted crystal
      const pts = [[0, -1.35], [0.62, -0.45], [0.55, 0.55], [0, 1.0], [-0.55, 0.55], [-0.62, -0.45]].map(([a, b]) => [x + a * s, y + b * s]);
      ctx.fillStyle = css(c.lo); ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.fill();
      ctx.fillStyle = css(c.mid); ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); ctx.lineTo(pts[5][0], pts[5][1]); ctx.lineTo(pts[4][0], pts[4][1]); ctx.lineTo(pts[3][0], pts[3][1]); ctx.lineTo(x - 0.05 * s, y - 0.1 * s); ctx.fill();
      ctx.fillStyle = css(c.hi); ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); ctx.lineTo(pts[5][0], pts[5][1]); ctx.lineTo(x - 0.05 * s, y - 0.1 * s); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = Math.max(0.6, s * 0.08);
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); ctx.lineTo(x - 0.05 * s, y - 0.1 * s); ctx.lineTo(pts[3][0], pts[3][1]); ctx.stroke();
      glint(ctx, x - 0.3 * s, y - 0.7 * s, s);
    },
    md(ctx, x, y, s, c) { // a warm tablet: paper-coloured stone, a bevelled face, one folded corner
      ctx.save(); ctx.translate(x, y); ctx.rotate(-0.16);
      const w = 0.62 * s, h = 0.86 * s, r = 0.2 * s, fold = 0.3 * s;
      const tablet = (dx, dy, k) => {
        ctx.beginPath(); ctx.moveTo(-w * k + r + dx, -h * k + dy); ctx.lineTo(w * k - fold + dx, -h * k + dy); ctx.lineTo(w * k + dx, -h * k + fold + dy);
        ctx.lineTo(w * k + dx, h * k - r + dy); ctx.quadraticCurveTo(w * k + dx, h * k + dy, w * k - r + dx, h * k + dy);
        ctx.lineTo(-w * k + r + dx, h * k + dy); ctx.quadraticCurveTo(-w * k + dx, h * k + dy, -w * k + dx, h * k - r + dy);
        ctx.lineTo(-w * k + dx, -h * k + r + dy); ctx.quadraticCurveTo(-w * k + dx, -h * k + dy, -w * k + r + dx, -h * k + dy); ctx.closePath();
      };
      ctx.fillStyle = css(c.lo); tablet(0.1 * s, 0.14 * s, 1); ctx.fill();
      const gr = ctx.createLinearGradient(-w, -h, w, h); gr.addColorStop(0, css(c.hi)); gr.addColorStop(1, css(c.mid));
      ctx.fillStyle = gr; tablet(0, 0, 1); ctx.fill();
      ctx.fillStyle = css(mixRgb(c.mid, c.lo, 0.4)); ctx.beginPath(); ctx.moveTo(w - fold, -h); ctx.lineTo(w - fold, -h + fold); ctx.lineTo(w, -h + fold); ctx.fill();
      if (s > 5) { ctx.strokeStyle = 'rgba(122,90,51,.45)'; ctx.lineWidth = Math.max(0.5, s * 0.06); for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.moveTo(-0.34 * s, (-0.12 + i * 0.32) * s); ctx.lineTo((0.34 - i * 0.18) * s, (-0.12 + i * 0.32) * s); ctx.stroke(); } }
      glint(ctx, -0.32 * s, -0.5 * s, s, 0.8);
      ctx.restore();
    },
    test(ctx, x, y, s, c) { // a seed held by its guard ring
      const gr = ctx.createRadialGradient(x - 0.3 * s, y - 0.3 * s, 0.1 * s, x, y, 0.75 * s); gr.addColorStop(0, css(c.hi)); gr.addColorStop(0.55, css(c.mid)); gr.addColorStop(1, css(c.lo));
      ctx.strokeStyle = css(c.mid, 0.9); ctx.lineWidth = Math.max(0.7, s * 0.14);
      ctx.beginPath(); ctx.ellipse(x, y, 1.3 * s, 0.42 * s, -0.35, Math.PI, TAU); ctx.stroke();
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, 0.62 * s, 0, TAU); ctx.fill();
      ctx.strokeStyle = css(c.hi, 0.95); ctx.beginPath(); ctx.ellipse(x, y, 1.3 * s, 0.42 * s, -0.35, 0, Math.PI); ctx.stroke();
      glint(ctx, x - 0.22 * s, y - 0.25 * s, s);
    },
    cfg(ctx, x, y, s, c) { // a small slate block with one amber rivet
      const a = 0.72 * s, b = 0.4 * s, h = 0.7 * s;
      ctx.fillStyle = css(c.lo); ctx.beginPath(); ctx.moveTo(x, y + b); ctx.lineTo(x + a, y); ctx.lineTo(x + a, y + h); ctx.lineTo(x, y + b + h); ctx.fill();
      ctx.fillStyle = css(mixRgb(c.lo, c.mid, 0.5)); ctx.beginPath(); ctx.moveTo(x, y + b); ctx.lineTo(x - a, y); ctx.lineTo(x - a, y + h); ctx.lineTo(x, y + b + h); ctx.fill();
      ctx.fillStyle = css(c.hi); ctx.beginPath(); ctx.moveTo(x, y - b); ctx.lineTo(x + a, y); ctx.lineTo(x, y + b); ctx.lineTo(x - a, y); ctx.fill();
      ctx.fillStyle = css(c.accent || [255, 196, 107]); ctx.beginPath(); ctx.arc(x + 0.1 * s, y, Math.max(0.7, 0.16 * s), 0, TAU); ctx.fill();
      glint(ctx, x - 0.36 * s, y - 0.05 * s, s, 0.6);
    },
    ui(ctx, x, y, s, c) { // a glossy, translucent drop
      const gr = ctx.createRadialGradient(x - 0.25 * s, y + 0.05 * s, 0.05 * s, x, y + 0.2 * s, 0.9 * s); gr.addColorStop(0, css(c.hi)); gr.addColorStop(0.5, css(c.mid)); gr.addColorStop(1, css(c.lo));
      ctx.save(); ctx.globalAlpha *= 0.94; ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(x, y - 1.25 * s);
      ctx.bezierCurveTo(x + 0.25 * s, y - 0.6 * s, x + 0.78 * s, y - 0.1 * s, x + 0.72 * s, y + 0.38 * s); ctx.arc(x, y + 0.38 * s, 0.72 * s, 0, Math.PI);
      ctx.bezierCurveTo(x - 0.78 * s, y - 0.1 * s, x - 0.25 * s, y - 0.6 * s, x, y - 1.25 * s); ctx.fill(); ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(x - 0.26 * s, y + 0.05 * s, Math.max(0.6, 0.17 * s), 0, TAU); ctx.fill();
    },
    other(ctx, x, y, s, c) { // a moonstone: a plain milky cabochon, a file and nothing more
      const gr = ctx.createRadialGradient(x - 0.25 * s, y - 0.3 * s, 0.05 * s, x, y, 0.8 * s);
      gr.addColorStop(0, 'rgba(250,251,255,0.95)'); gr.addColorStop(0.55, css(c.mid, 0.9)); gr.addColorStop(1, css(c.lo, 0.9));
      ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(x, y, 0.7 * s, 0.56 * s, 0, 0, TAU); ctx.fill();
      glint(ctx, x - 0.25 * s, y - 0.22 * s, s, 0.7);
    },
    data(ctx, x, y, s, c) { // a little cairn of discs
      for (let i = 2; i >= 0; i--) {
        const yy = y + (i - 1) * 0.42 * s, rx = (0.78 - i * 0.06) * s;
        ctx.fillStyle = css(c.lo); ctx.beginPath(); ctx.ellipse(x, yy + 0.16 * s, rx, 0.3 * s, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = css(i === 0 ? c.hi : c.mid); ctx.beginPath(); ctx.ellipse(x, yy, rx, 0.3 * s, 0, 0, TAU); ctx.fill();
      }
      glint(ctx, x - 0.35 * s, y - 0.5 * s, s, 0.75);
    },
  };
  // THE FORM LIBRARY (settled call 40): a /2 look gives each family a form by
  // name. The seven above keep their names; the new ones are as cheap as they
  // are (two to four fills, one gradient at most), so a world of candles costs
  // what a world of crystals did.
  const FORM_BY_NAME = {
    crystal: FORMS.src, tablet: FORMS.md, seed: FORMS.test, slate: FORMS.cfg, drop: FORMS.ui, moonstone: FORMS.other, cairn: FORMS.data,
    candle(ctx, x, y, s, c) { // a short pillar with a living flame
      const w = 0.42 * s, h = 0.95 * s, f = c.flame || [255, 205, 140], b = c.breath == null ? 1 : c.breath;
      ctx.fillStyle = css(c.lo); ctx.fillRect(x - w, y - h * 0.15, w * 2, h);
      ctx.fillStyle = css(c.mid); ctx.fillRect(x - w, y - h * 0.15, w * 1.1, h);
      ctx.fillStyle = css(c.hi); ctx.beginPath(); ctx.ellipse(x, y - h * 0.15, w, w * 0.32, 0, 0, TAU); ctx.fill();
      const gl = ctx.createRadialGradient(x, y - h * 0.62, 0, x, y - h * 0.62, s * 1.6);
      gl.addColorStop(0, css(f, 0.5 * b)); gl.addColorStop(1, css(f, 0));
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(x, y - h * 0.62, s * 1.6, 0, TAU); ctx.fill();
      ctx.fillStyle = css(mixRgb(f, WHITE, 0.55), 0.95); ctx.beginPath();
      ctx.moveTo(x, y - h * (0.95 + 0.12 * b)); ctx.quadraticCurveTo(x + w * 0.55, y - h * 0.45, x, y - h * 0.3); ctx.quadraticCurveTo(x - w * 0.55, y - h * 0.45, x, y - h * (0.95 + 0.12 * b)); ctx.fill();
    },
    pearl(ctx, x, y, s, c) { // a soft round lustre
      const gr = ctx.createRadialGradient(x - 0.25 * s, y - 0.3 * s, 0.04 * s, x, y, 0.72 * s);
      gr.addColorStop(0, css(mixRgb(c.hi, WHITE, 0.5))); gr.addColorStop(0.6, css(c.mid)); gr.addColorStop(1, css(c.lo));
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, 0.62 * s, 0, TAU); ctx.fill();
      glint(ctx, x - 0.2 * s, y - 0.24 * s, s, 0.8);
    },
    ember(ctx, x, y, s, c) { // a coal, dark outside and alight within
      const f = c.flame || [255, 140, 90], b = c.breath == null ? 1 : c.breath;
      ctx.fillStyle = css(c.lo); ctx.beginPath(); ctx.ellipse(x, y, 0.7 * s, 0.5 * s, 0.3, 0, TAU); ctx.fill();
      const gr = ctx.createRadialGradient(x, y, 0, x, y, 0.6 * s);
      gr.addColorStop(0, css(mixRgb(f, WHITE, 0.3), 0.9 * b)); gr.addColorStop(1, css(c.mid, 0));
      ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(x, y, 0.6 * s, 0.42 * s, 0.3, 0, TAU); ctx.fill();
    },
    stud(ctx, x, y, s, c) { // a faceted cabochon set in a metal collet
      ctx.fillStyle = css(c.metal || [201, 162, 102]); ctx.beginPath(); ctx.arc(x, y, 0.66 * s, 0, TAU); ctx.fill();
      ctx.fillStyle = css(c.lo); ctx.beginPath(); ctx.arc(x, y, 0.5 * s, 0, TAU); ctx.fill();
      ctx.fillStyle = css(c.mid); ctx.beginPath(); ctx.moveTo(x, y - 0.5 * s); ctx.lineTo(x + 0.43 * s, y - 0.1 * s); ctx.lineTo(x, y + 0.12 * s); ctx.lineTo(x - 0.43 * s, y - 0.1 * s); ctx.fill();
      glint(ctx, x - 0.16 * s, y - 0.28 * s, s, 0.9);
    },
    bead(ctx, x, y, s, c) { // a small glass bead with a bright core
      ctx.fillStyle = css(c.mid, 0.85); ctx.beginPath(); ctx.ellipse(x, y, 0.55 * s, 0.48 * s, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = css(c.lo, 0.9); ctx.beginPath(); ctx.ellipse(x, y, 0.16 * s, 0.14 * s, 0, 0, TAU); ctx.fill();
      glint(ctx, x - 0.2 * s, y - 0.2 * s, s, 0.85);
    },
    rose(ctx, x, y, s, c) { // a closed bud: three petals and a heart
      ctx.fillStyle = css(c.lo); ctx.beginPath(); ctx.ellipse(x - 0.28 * s, y + 0.08 * s, 0.42 * s, 0.56 * s, -0.5, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x + 0.28 * s, y + 0.08 * s, 0.42 * s, 0.56 * s, 0.5, 0, TAU); ctx.fill();
      ctx.fillStyle = css(c.mid); ctx.beginPath(); ctx.ellipse(x, y - 0.05 * s, 0.4 * s, 0.6 * s, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = css(c.hi, 0.85); ctx.lineWidth = Math.max(0.6, s * 0.09);
      ctx.beginPath(); ctx.arc(x + 0.04 * s, y - 0.14 * s, 0.2 * s, Math.PI * 0.9, Math.PI * 2.4); ctx.stroke();
    },
  };
  // forms that read as a flame at rest distance, before the form itself arrives
  const FLAME_FORMS = new Set(['candle', 'ember']);
  // FINISH: how a file catches the light (gloss is how every file was drawn)
  const FINISH = {
    gloss: { hi: 0.58, lo: 0.5, glint: 1 },
    satin: { hi: 0.36, lo: 0.42, glint: 0.45 },
    matte: { hi: 0.2, lo: 0.35, glint: 0 },
    metallic: { hi: 0.78, lo: 0.65, glint: 1 },
  };
  let GLINT = 1;   // the finish's glint, set per file while it is painted
  // the three landmarks: a skyline, rare on purpose
  const MARKS = {
    spire(ctx, gx, gy, hx, hy, s, c) { // the entry point: a crystal spire
      const dx = hx - gx, dy = hy - gy;
      const crystal = (t1, w, off, hi, lo) => {
        const ax = gx + off * s * 0.5, ay = gy, bx = gx + dx * t1 + off * s * 0.3, by = gy + dy * t1;
        const nx = -(by - ay), ny = bx - ax, L = Math.hypot(nx, ny) || 1, ux = nx / L * w * s * 0.28, uy = ny / L * w * s * 0.28;
        ctx.fillStyle = css(lo); ctx.beginPath(); ctx.moveTo(ax + ux, ay + uy); ctx.lineTo(bx, by); ctx.lineTo(ax, ay + s * 0.15); ctx.fill();
        ctx.fillStyle = css(hi); ctx.beginPath(); ctx.moveTo(ax - ux, ay - uy); ctx.lineTo(bx, by); ctx.lineTo(ax, ay + s * 0.15); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = Math.max(0.7, s * 0.06); ctx.beginPath(); ctx.moveTo(ax, ay + s * 0.15); ctx.lineTo(bx, by); ctx.stroke();
      };
      crystal(0.48, 2.6, -2.6, c.themed ? mixRgb(c.hi, c.lo, 0.3) : mixRgb(c.hi, [180, 168, 255], 0.3), c.themed ? c.lo : mixRgb(c.lo, [58, 47, 138], 0.4));
      crystal(0.64, 2.2, 2.4, c.hi, c.lo);
      crystal(0.36, 1.8, 4.2, c.themed ? mixRgb(c.hi, c.flame, 0.3) : mixRgb(c.hi, [159, 230, 255], 0.5), c.themed ? mixRgb(c.lo, INK, 0.3) : mixRgb(c.lo, [42, 106, 154], 0.5));
      crystal(1, 3.4, 0, c.hi, c.lo);
      ctx.shadowBlur = 12; ctx.shadowColor = css(c.hi); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(hx, hy, Math.max(1.2, s * 0.22), 0, TAU); ctx.fill(); ctx.shadowBlur = 0;
    },
    lighthouse(ctx, gx, gy, hx, hy, s, c) { // the README: a standing scroll with a lantern
      const h = Math.hypot(hx - gx, hy - gy), a = Math.atan2(hx - gx, -(hy - gy)), w = s * 1.15;
      ctx.save(); ctx.translate(gx, gy); ctx.rotate(a);
      const gr = ctx.createLinearGradient(-w, 0, w, 0); gr.addColorStop(0, css(c.hi)); gr.addColorStop(0.55, css(c.mid)); gr.addColorStop(1, css(c.lo));
      ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(-w, 0); ctx.lineTo(-w * 0.72, -h * 0.84); ctx.lineTo(w * 0.72, -h * 0.84); ctx.lineTo(w, 0); ctx.quadraticCurveTo(0, s * 0.35, -w, 0); ctx.fill();
      ctx.strokeStyle = css(c.trim || [138, 106, 60], 0.5); ctx.lineWidth = Math.max(0.6, s * 0.08);
      for (let i = 1; i < 6; i++) { const yy = -h * 0.84 * i / 6; ctx.beginPath(); ctx.moveTo(-w * 0.55, yy); ctx.lineTo(w * 0.5, yy); ctx.stroke(); }
      ctx.fillStyle = css(mixRgb(c.mid, c.lo, 0.4)); ctx.beginPath(); ctx.ellipse(0, -h * 0.84, w * 0.85, s * 0.3, 0, 0, TAU); ctx.fill();
      const lg = ctx.createRadialGradient(0, -h * 0.96, 0, 0, -h * 0.96, s * 4.2); lg.addColorStop(0, css(c.flame || [255, 217, 138], 0.55)); lg.addColorStop(1, css(c.flame || [255, 217, 138], 0));
      ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(0, -h * 0.96, s * 4.2, 0, TAU); ctx.fill();
      ctx.fillStyle = css(mixRgb(c.flame || [255, 217, 138], WHITE, 0.6)); ctx.beginPath(); ctx.arc(0, -h * 0.96, s * 0.5, 0, TAU); ctx.fill();
      ctx.restore();
    },
    lantern(ctx, gx, gy, hx, hy, s, c) { // the build's memory: a paper lantern
      const r = s * 1.05;
      const gl = ctx.createRadialGradient(hx, hy, 0, hx, hy, r * 3.4); gl.addColorStop(0, css(c.flame || [255, 207, 122], 0.42)); gl.addColorStop(1, css(c.flame || [255, 207, 122], 0));
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(hx, hy, r * 3.4, 0, TAU); ctx.fill();
      const gr = ctx.createRadialGradient(hx - r * 0.3, hy - r * 0.3, 1, hx, hy, r * 1.2); gr.addColorStop(0, css(mixRgb(c.flame || [255, 250, 240], WHITE, 0.7))); gr.addColorStop(0.6, css(c.mid)); gr.addColorStop(1, css(c.lo));
      ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(hx, hy, r * 0.8, r * 1.1, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = css(c.trim || [138, 106, 60], 0.55); ctx.lineWidth = Math.max(0.6, s * 0.07);
      for (const t of [-0.5, 0, 0.5]) { ctx.beginPath(); ctx.ellipse(hx, hy + t * r, r * 0.8 * Math.sqrt(1 - t * t * 0.8), r * 0.18, 0, 0, TAU); ctx.stroke(); }
      ctx.fillStyle = css(c.trim || [122, 90, 51]); ctx.fillRect(hx - r * 0.35, hy - r * 1.25, r * 0.7, r * 0.2); ctx.fillRect(hx - r * 0.35, hy + r * 1.05, r * 0.7, r * 0.2);
    },
    // ── THE LANDMARK LIBRARY (settled call 40): a /2 look can stand a
    // different form in each of the three places, or none. Each is a few
    // fills in the look's own colours (c.metal, c.rope, c.flame), no blur.
    obelisk(ctx, gx, gy, hx, hy, s, c) { // the entry point: a tapered stone needle
      const w = s * 0.9, h = gy - hy;
      ctx.fillStyle = css(c.lo); ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + w, gy); ctx.lineTo(hx + w * 0.3, hy + h * 0.06); ctx.lineTo(hx, hy); ctx.fill();
      ctx.fillStyle = css(c.mid); ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx - w, gy); ctx.lineTo(hx - w * 0.3, hy + h * 0.06); ctx.lineTo(hx, hy); ctx.fill();
      ctx.fillStyle = css(mixRgb(c.flame || c.hi, WHITE, 0.4)); ctx.beginPath(); ctx.arc(hx, hy, Math.max(1, s * 0.2), 0, TAU); ctx.fill();
    },
    arch(ctx, gx, gy, hx, hy, s, c) { // the entry point: a doorway to walk through
      const w = s * 1.6, h = (gy - hy) * 0.8, t = Math.max(1.2, s * 0.32);
      ctx.strokeStyle = css(c.metal || c.mid); ctx.lineWidth = t; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(gx - w, gy); ctx.lineTo(gx - w, gy - h); ctx.arc(gx, gy - h, w, Math.PI, TAU); ctx.lineTo(gx + w, gy); ctx.stroke();
      const gl = ctx.createRadialGradient(gx, gy - h * 0.5, 0, gx, gy - h * 0.5, w * 1.1);
      gl.addColorStop(0, css(c.flame || c.hi, 0.28)); gl.addColorStop(1, css(c.flame || c.hi, 0));
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(gx, gy - h * 0.5, w * 1.1, 0, TAU); ctx.fill();
      ctx.lineCap = 'butt';
    },
    stanchions(ctx, gx, gy, hx, hy, s, c) { // the entry point: two posts and a velvet rope
      const w = s * 1.7, h = (gy - hy) * 0.55, metal = c.metal || [201, 162, 102];
      ctx.strokeStyle = css(c.rope || c.mid); ctx.lineWidth = Math.max(1.4, s * 0.3); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(gx - w, gy - h * 0.9); ctx.quadraticCurveTo(gx, gy - h * 0.25, gx + w, gy - h * 0.9); ctx.stroke();
      for (const x of [gx - w, gx + w]) {
        ctx.strokeStyle = css(metal); ctx.lineWidth = Math.max(1, s * 0.18);
        ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x, gy - h); ctx.stroke();
        ctx.fillStyle = css(metal); ctx.beginPath(); ctx.ellipse(x, gy, s * 0.42, s * 0.14, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = css(mixRgb(metal, WHITE, 0.45)); ctx.beginPath(); ctx.arc(x, gy - h, Math.max(1, s * 0.22), 0, TAU); ctx.fill();
      }
      ctx.lineCap = 'butt';
    },
    marquee(ctx, gx, gy, hx, hy, s, c) { // the front page: a lit sign on two legs
      const w = s * 1.9, bh = s * 1.1, flame = c.flame || [255, 217, 138];
      ctx.strokeStyle = css(c.metal || c.lo); ctx.lineWidth = Math.max(1, s * 0.14);
      ctx.beginPath(); ctx.moveTo(hx - w * 0.6, gy); ctx.lineTo(hx - w * 0.6, hy); ctx.moveTo(hx + w * 0.6, gy); ctx.lineTo(hx + w * 0.6, hy); ctx.stroke();
      ctx.fillStyle = css(c.lo); ctx.fillRect(hx - w, hy - bh, w * 2, bh);
      ctx.fillStyle = css(c.mid); ctx.fillRect(hx - w * 0.8, hy - bh * 0.75, w * 1.6, bh * 0.5);
      ctx.fillStyle = css(mixRgb(flame, WHITE, 0.4));
      for (let i = 0; i <= 6; i++) { const x = hx - w + (i / 6) * w * 2; ctx.beginPath(); ctx.arc(x, hy - bh, Math.max(0.8, s * 0.13), 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(x, hy, Math.max(0.8, s * 0.13), 0, TAU); ctx.fill(); }
    },
    pillar(ctx, gx, gy, hx, hy, s, c) { // the front page: a column with a light on its capital
      const w = s * 0.55, flame = c.flame || [255, 217, 138];
      const gr = ctx.createLinearGradient(gx - w, 0, gx + w, 0); gr.addColorStop(0, css(c.hi)); gr.addColorStop(0.6, css(c.mid)); gr.addColorStop(1, css(c.lo));
      ctx.fillStyle = gr; ctx.fillRect(gx - w, hy, w * 2, gy - hy);
      ctx.fillStyle = css(c.lo); ctx.fillRect(gx - w * 1.5, hy - s * 0.25, w * 3, s * 0.3); ctx.fillRect(gx - w * 1.5, gy - s * 0.2, w * 3, s * 0.25);
      const gl = ctx.createRadialGradient(hx, hy - s * 0.5, 0, hx, hy - s * 0.5, s * 2.6);
      gl.addColorStop(0, css(flame, 0.5)); gl.addColorStop(1, css(flame, 0));
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(hx, hy - s * 0.5, s * 2.6, 0, TAU); ctx.fill();
    },
    chandelier(ctx, gx, gy, hx, hy, s, c) { // the build's memory: arms of small flames
      const r = s * 1.5, flame = c.flame || [255, 207, 122];
      const gl = ctx.createRadialGradient(hx, hy, 0, hx, hy, r * 2.4);
      gl.addColorStop(0, css(flame, 0.35)); gl.addColorStop(1, css(flame, 0));
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(hx, hy, r * 2.4, 0, TAU); ctx.fill();
      ctx.strokeStyle = css(c.metal || c.mid); ctx.lineWidth = Math.max(0.8, s * 0.12);
      ctx.beginPath(); ctx.ellipse(hx, hy, r, r * 0.3, 0, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(hx, hy - r * 0.9); ctx.lineTo(hx, hy); ctx.stroke();
      ctx.fillStyle = css(mixRgb(flame, WHITE, 0.5));
      for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; ctx.beginPath(); ctx.arc(hx + Math.cos(a) * r, hy + Math.sin(a) * r * 0.3 - s * 0.2, Math.max(0.8, s * 0.16), 0, TAU); ctx.fill(); }
    },
    orb(ctx, gx, gy, hx, hy, s, c) { // the build's memory: a glowing sphere
      const r = s * 1.05, flame = c.flame || [255, 207, 122];
      const gl = ctx.createRadialGradient(hx, hy, 0, hx, hy, r * 3);
      gl.addColorStop(0, css(flame, 0.4)); gl.addColorStop(1, css(flame, 0));
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(hx, hy, r * 3, 0, TAU); ctx.fill();
      const gr = ctx.createRadialGradient(hx - r * 0.3, hy - r * 0.3, 0, hx, hy, r);
      gr.addColorStop(0, css(mixRgb(flame, WHITE, 0.7))); gr.addColorStop(0.7, css(c.mid)); gr.addColorStop(1, css(c.lo));
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(hx, hy, r, 0, TAU); ctx.fill();
    },
  };
  // which form stands in each landmark's place under a look (the place, never the file, decides)
  const MARK_PLACE = { spire: 'entry', lighthouse: 'front', lantern: 'memory' };
  const FAMILY_WORDS ={ md: 'markdown', src: 'source', test: 'test', cfg: 'configuration', ui: 'style or asset', data: 'data', other: 'file' };
  const MARK_WORDS = { spire: 'the entry point', lighthouse: "the repository's front page", lantern: "the build's memory" };

  // ── the world's own layers ───────────────────────────────────────────────
  const LIGHT = norm3({ x: -0.55, y: 0.55, z: 0.63 });
  const LAND = { src: [52, 80, 122], ui: [110, 64, 88], md: [111, 94, 64], data: [107, 85, 48], test: [40, 90, 88], cfg: [64, 68, 90], other: [70, 72, 86], board: [79, 61, 79] };
  const RIM = { src: [143, 180, 255], ui: [255, 179, 200], md: [255, 227, 174], data: [255, 210, 122], test: [143, 240, 223], cfg: [185, 192, 220], other: [205, 210, 226], board: [255, 201, 168] };
  // ── the look (repo-world-style/2, settled call 40) ───────────────────────
  // Everything a look says is turned into numbers HERE, once, when the world
  // mounts: a light direction, a material's few constants, coasts reshaped.
  // The frame then does what it always did with different numbers, which is
  // the whole performance contract.
  const LIGHT_FROM = {
    'upper-left': { x: -0.55, y: 0.55, z: 0.63 }, 'upper-right': { x: 0.55, y: 0.55, z: 0.63 }, above: { x: 0, y: 0.8, z: 0.6 },
    'low-left': { x: -0.85, y: 0.22, z: 0.48 }, 'low-right': { x: 0.85, y: 0.22, z: 0.48 }, behind: { x: 0.1, y: 0.45, z: -0.3 },
  };
  // a land material: how much the fill shows (centre, edge), how far it sinks
  // toward ink, the coast glow and edge, and a sheen on the lit side
  const MATERIAL = {
    luminous: { a0: 0.3, a1: 0.12, sink: 0.45, glow: 1, edge: 1, sheen: 0, spec: 0 },
    velvet: { a0: 0.95, a1: 0.97, sink: 0.8, glow: 0.3, edge: 0.4, sheen: 0, spec: 0, graze: 0.2 },
    lacquer: { a0: 0.85, a1: 0.95, sink: 0.6, glow: 0.4, edge: 0.8, sheen: 0.08, spec: 0.5 },
    paper: { a0: 0.7, a1: 0.62, sink: 0.08, glow: 0, edge: 0.7, sheen: 0.1, spec: 0 },
    stone: { a0: 0.62, a1: 0.7, sink: 0.35, glow: 0.15, edge: 0.6, sheen: 0.06, spec: 0 },
    glass: { a0: 0.12, a1: 0.05, sink: 0.2, glow: 0.8, edge: 1.4, sheen: 0.12, spec: 0.7 },
    moss: { a0: 0.66, a1: 0.5, sink: 0.4, glow: 0.25, edge: 0.3, sheen: 0.14, spec: 0 },
  };
  // a coast's character: the same shore, redrawn in a different hand. Pure
  // functions of the loop and the island's key, so every installation draws
  // the same shore (call 29) and nothing about the geography moves.
  function reshape(c, loop, character, seed) {
    if (!loop || !loop.length || character === 'natural') return loop;
    const radial = (v, k) => norm3({ x: c.x + (v.x - c.x) * k, y: c.y + (v.y - c.y) * k, z: c.z + (v.z - c.z) * k });
    const smooth = (pts) => { const out = []; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; out.push(norm3({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25, z: a.z * 0.75 + b.z * 0.25 }), norm3({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75, z: a.z * 0.25 + b.z * 0.75 })); } return out; };
    if (character === 'plush') { const s = smooth(smooth(loop)); return s.filter((_, i) => i % 2 === 0).map((v) => radial(v, 1.03)); }
    if (character === 'crisp') { const step = Math.max(2, Math.round(loop.length / 11)); return loop.filter((_, i) => i % step === 0); }
    if (character === 'craggy') { const q = rng(seed); return loop.map((v, i) => radial(v, 1 + (i % 2 ? -0.09 : 0.05) * (0.5 + q()))); }
    if (character === 'melted') {
      // the shore slumps: the side away from the pole sags outward, softly
      const s = smooth(loop).filter((_, i) => i % 2 === 0);
      return s.map((v) => { const down = clamp01((c.y - v.y) * 8); return radial(v, 1 + 0.16 * down); });
    }
    return loop;
  }
  const FACES = {
    mono: null,   // the token (--data), as every world has been drawn
    sans: 'Inter, "Helvetica Neue", Arial, system-ui, sans-serif',
    serif: '"Cormorant Garamond", "EB Garamond", Georgia, "Times New Roman", serif',
    display: '"Playfair Display", "Bodoni Moda", Didot, Georgia, serif',
  };
  const TEMPO = { still: 0, slow: 1 / 2400, easy: 1 / 1400, brisk: 1 / 700 };
  // the look's numbers, from W.style.look (null for every /1 world)
  // THE AGENT'S OWN SHAPES (settled call 40, Dan 2026-10-14: "color outside
  // the lines"): SVG path parts in a box from -1 to 1, each made a Path2D once
  // when the look arrives, then drawn wherever a form or a landmark names it.
  function shapesOf(map) {
    const out = {};
    if (!map || typeof Path2D !== 'function') return out;
    for (const [name, sh] of Object.entries(map)) {
      const parts = [];
      for (const p of sh.parts || []) { try { parts.push(Object.assign({}, p, { p: new Path2D(p.d) })); } catch (_) { /* a path the browser cannot read draws nothing */ } }
      if (parts.length) out[name] = { parts, glow: sh.glow, breathes: !!sh.breathes };
    }
    return out;
  }
  const paintOf = (v, c) => (v == null ? null : v.charAt(0) === '#' ? rgbOf(v) : (c[v] || (v === 'ink' ? c.ink : null) || c.mid));
  // a shape centred on (x, y), r its half-size in pixels
  function drawShape(ctx, sh, x, y, r, c) {
    const b = sh.breathes && c.breath != null ? c.breath : 1;
    if (sh.glow) {
      const gc = paintOf(sh.glow, c) || c.hi;
      const gl = ctx.createRadialGradient(x, y, 0, x, y, r * 2.4); gl.addColorStop(0, css(gc, 0.38 * b)); gl.addColorStop(1, css(gc, 0));
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(x, y, r * 2.4, 0, TAU); ctx.fill();
    }
    ctx.save(); ctx.translate(x, y); ctx.scale(r, r);
    for (const p of sh.parts) {
      const a0 = ctx.globalAlpha; ctx.globalAlpha = a0 * p.alpha;
      const f = paintOf(p.fill, c), st = paintOf(p.stroke, c);
      if (f) { ctx.fillStyle = css(f); ctx.fill(p.p); }
      if (st) { ctx.strokeStyle = css(st); ctx.lineWidth = p.width; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(p.p); }
      ctx.globalAlpha = a0;
    }
    ctx.restore();
  }
  // the work's animations under a look: each event's style and colour, and
  // how much of it there is (settled call 40; Dan, 2026-10-14)
  const AMOUNT = { subtle: 0.45, normal: 1, lavish: 1.8 };
  const BURST = { fountain: 0, confetti: 1, embers: 2, stars: 3 };
  function motionOf(m) {
    if (!m) return null;
    const ev = (e) => (m[e] ? { style: m[e].style, colour: m[e].colour ? rgbOf(m[e].colour) : null, particle: m[e].particle || null } : { style: null, colour: null, particle: null });
    return { read: ev('read'), write: ev('write'), finish: ev('finish'), birth: ev('birth'), push: ev('push'), amount: AMOUNT[m.amount] || 1 };
  }
  function lookOf(W) {
    const L = W.style && W.style.look;
    if (!L) return null;
    if (W.lookN && W.lookN.src === L) return W.lookN;
    const atm = W.style.atmosphere;
    W.lookN = {
      src: L, L,
      light: norm3(LIGHT_FROM[L.light.from] || LIGHT_FROM['upper-left']),
      lightCol: rgbOf(L.light.colour), key: L.light.key, vignette: L.light.vignette,
      mat: MATERIAL[L.material] || MATERIAL.luminous,
      glow: L.coast.glow, contours: L.coast.contours,
      ground: L.ground.kind, groundCol: L.ground.colour ? rgbOf(L.ground.colour) : null,
      finish: FINISH[L.finish] || FINISH.gloss,
      tempo: TEMPO[L.tempo] || 0,
      face: FACES[L.type.face] || null, caps: L.type.case,
      typeCol: L.type.colour ? rgbOf(L.type.colour) : rgbOf(W.style.ink),
      thread: L.threads ? rgbOf(L.threads) : null,
      size: { small: 0.75, medium: 1, large: 1.35 }[L.files.size] || 1, stem: L.files.stem,
      presence: { hushed: 0.35, present: 1, bright: 1.5 }[L.files.presence] || 1, shallows: L.coast.shallows,
      shapes: shapesOf(L.shapes),
      motion: motionOf(L.motion),
      metal: L.finish === 'metallic' || L.material === 'velvet' || L.material === 'lacquer' ? [201, 162, 102] : [170, 176, 190],
      day: atm === 'day',
    };
    return W.lookN;
  }
  function mountWorld(g, view) {
    const W = g.o.repoWorld, world = W.world;
    const ctx = g.ctx;
    const byId = new Map(world.files.map((f) => [f.id, f]));
    const LK = lookOf(W);
    const LIT = LK ? LK.light : LIGHT;
    // an islet is drawn only if it clears every other island, and every islet kept so far
    const keptIslets = [];
    const isletClear = (loop, own) => {
      let c = { x: 0, y: 0, z: 0 }; for (const v of loop) { c.x += v.x; c.y += v.y; c.z += v.z; } c = norm3(c);
      const r = Math.max(...loop.map((v) => ang(c, v)));
      for (const J of world.islands) if (J !== own && ang(c, J.c) < r + J.r * 1.12) return false;
      if (ang(c, own.c) < r + own.r * 1.02) return false;
      for (const k of keptIslets) if (ang(c, k.c) < r + k.r + 0.01) return false;
      keptIslets.push({ c, r });
      return true;
    };
    // what a look's land sinks toward: its own sea (a cold ink would cast every red purple)
    const DEEP = LK ? rgbOf(W.style.sea) : INK;
    // islands, prepared once: loops, shallows, stipple, contours
    const isl = world.islands.map((I) => {
      const fam = I.board ? 'board' : I.family;
      const q = rng(hash(world.repo + ':' + I.key + ':ground'));
      const f = frameAt(I.c);
      const n = Math.min(700, Math.round(I.r * I.r * 26000));
      const ground = [];
      for (let i = 0; i < n; i++) ground.push({ v: onCap(I.c, f, q() * TAU, I.r * 1.05 * Math.sqrt(q())), a: q(), s: q(), t: q() * TAU });
      const ch = LK ? LK.L.coast.character : 'natural';
      const coast = reshape(I.c, I.coast, ch, hash(world.repo + ':' + I.key + ':coast'));
      // THE SMALL EMPTY ISLETS were decoration only (no files, no meaning),
      // scattered past each shore without looking at the neighbours, so they
      // ran into other islands and made merged blobs (Dan, 2026-10-14). They
      // are off unless a look asks for them, and then only those touching no
      // other land are drawn (the geography itself is unchanged).
      const keepIslets = LK ? LK.L.coast.islets : 'none';
      const islets = keepIslets === 'none' ? [] : (I.islets || []).filter((_, i) => keepIslets === 'all' || i % 2 === 0)
        .filter((loop) => isletClear(loop, I))
        .map((loop, i) => reshape(I.c, loop, ch, hash(world.repo + ':' + I.key + ':islet' + i)));
      return {
        // a shared world draws its project's own palette (F.2); a personal one the recipe's
        I, fam, land: W.style ? rgbOf(W.style.land[fam] || W.style.land.cfg) : (LAND[fam] || LAND.cfg), rim: W.style ? rgbOf(W.style.rim[fam] || W.style.rim.cfg) : (RIM[fam] || RIM.cfg), ground,
        coast, islets,
        shallows: [1.34, 1.2, 1.1].map((k) => scaleLoop(I.c, coast, k)),
        contours: [0.7, 0.42].map((k) => scaleLoop(I.c, coast, k)),
        stitch: scaleLoop(I.c, coast, 0.93),
      };
    });
    // threads: each recent commit's files, stitched in path order
    const threads = world.threads.map((t) => {
      const pts = [];
      for (let i = 1; i < t.files.length; i++) {
        const a = byId.get(t.files[i - 1]), b = byId.get(t.files[i]);
        if (!a || !b) continue;
        const seg = [];
        for (let k = 0; k <= 16; k++) { const u = k / 16; seg.push(norm3({ x: a.at.x * (1 - u) + b.at.x * u, y: a.at.y * (1 - u) + b.at.y * u, z: a.at.z * (1 - u) + b.at.z * u })); }
        pts.push(seg);
      }
      return { segs: pts, hue: hash(t.sha) % 5 };
    });
    const THREAD_COL = [[255, 217, 192], [199, 212, 255], [255, 227, 174], [255, 192, 212], [214, 204, 255]];
    W.pos = new Map();   // where each file's head was drawn, for labels and the card
    W.fx = W.fx || new Map();   // file id -> { kind, t0, ms, hold }: an event's material answer

    // ── THE CALM CAMERA (slice 13) ─────────────────────────────────────────
    // A repository is a small archipelago on a big ball, so the vault's idle
    // spin carries the land off and leaves a screen of empty sea. Here the
    // world rests FACING ITS OCCUPIED HEMISPHERE and holds still there (no sway
    // since 2026-10-10). What the member holds outranks the rest: a selection or a turn
    // defers it, a hand on the globe pauses it, and under a course in the full
    // view the Journey's own framing owns the camera. It turns only to watch work.
    const heart = (() => { let h = { x: 0, y: 0, z: 0 }; for (const I of world.islands) { if (I.board) continue; const w = I.r * I.r; h.x += I.c.x * w; h.y += I.c.y * w; h.z += I.c.z * w; } return norm3(h); })();
    W.heart = heart;
    // how far the land reaches from its heart: the rest zoom fits the archipelago, not the sphere
    const reach = Math.max(0.2, ...world.islands.filter((I) => !I.board).map((I) => ang(heart, I.c) + I.r));
    // the sidebar rests close in (Dan, 2026-10-01): the globe's top arc stays in
    // view and its sides and bottom run past the area, so the land reads large
    W.fitZoom = (size) => { const z = Math.max(1, Math.min(size === 'full' ? 1.3 : 1.45, 0.78 / Math.sin(Math.min(1.4, reach)))); return size === 'full' ? z : Math.max(1.6, Math.min(2.2, z * 1.55)); };
    let touched = 0, lastNow = 0;
    const mark = () => { touched = performance.now(); };
    g.canvas.addEventListener('pointerdown', mark);
    g.canvas.addEventListener('wheel', mark, { passive: true });
    // A HAND ON THE GLOBE. While it turns, the faint fine detail (contours,
    // district edges, history threads, most of the ground's scatter, each
    // file's pool of light) rests, and fades back in once the hand lets go.
    // Nobody reads a dotted contour mid-turn, and that detail was most of a
    // frame (measured 2026-10-01: ~8,000 fills a frame in the full view).
    let handDown = false, handAt = 0;
    g.canvas.addEventListener('pointerdown', () => { handDown = true; handAt = performance.now(); });
    const handUp = () => { if (handDown) { handDown = false; handAt = performance.now(); } };
    // The hand is let go of anywhere on the page, so these two are on window,
    // and they end with this world (2026-10-13). They used to outlive it: each
    // remount (every commit in a watched repository) left a dead world held
    // alive by its listener, globe, canvas and all. The core ends them when
    // the globe is disposed (g.onDispose); W.teardown is the same
    // end for a core that predates it, called by repo-world.js when it lets
    // the world go.
    window.addEventListener('pointerup', handUp);
    window.addEventListener('pointercancel', handUp);
    W.teardown = () => { window.removeEventListener('pointerup', handUp); window.removeEventListener('pointercancel', handUp); };
    if (g.onDispose) g.onDispose(W.teardown);
    g.canvas.addEventListener('wheel', () => { handAt = performance.now(); }, { passive: true });
    // 1 at rest, 0 while turning, easing back over a third of a second
    const settled = (now) => handDown ? 0 : clamp01((now - handAt - 120) / 330);
    const X = { x: 1, y: 0, z: 0 }, Y = { x: 0, y: 1, z: 0 };
    const facing = (v, yawOff) => {
      const t = norm3({ x: v.x, y: v.y - 0.06, z: v.z });   // the land sits a touch above centre
      const yaw = Math.atan2(t.x, t.z) + yawOff, pitch = Math.asin(Math.max(-1, Math.min(1, t.y)));
      return qmul(axisAngle(X, pitch), axisAngle(Y, -yaw));
    };
    W.restQ = (yawOff = 0) => facing(W.swayAt || heart, yawOff);
    // WATCHING THE WORK (Dan, 2026-10-05: "the globe turns so that the camera
    // is in a nice position to see the edit animation take place for each node
    // or file being worked on"). The one exception to "it never chases": the
    // agent's own write. The file turns to face the member set LOW in the
    // frame, so the sky above it is open for the write stream pouring down,
    // and the sway holds off while the work goes on. A hand on the globe in the
    // last few seconds wins, and reduced motion gets no turn at all.
    //
    // READS TURN IT TOO, AND NOTHING SWINGS IT BACK (Dan, 2026-10-10: "I'd
    // still like the globe to turn to files that are actively being written
    // to or read ... just no constant globe swaying"). A read ({ read: true })
    // turns more gently, never over a write's hold, and at most once every
    // READ_TURN_MS, because an answer reads a dozen files a second. After a
    // turn the globe stays on that file; it settles back to its rest only
    // after RETURN_MS with no work, and then holds still (the calm camera
    // below). While work goes on, the course's you-are-here pin pulses
    // (repo-world.js workPulse).
    const READ_TURN_MS = 2500, RETURN_MS = 30000;
    W.onCourse = () => !!(W.lens || W.sharedCourse);
    W.watch = (v, opt) => {
      const now = performance.now(), read = !!(opt && opt.read);
      if (!v || g.calm || handDown || now - touched < 4000) return false;
      if (read && ((W.holdUntil && now < W.holdUntil) || now - (W.readTurnAt || 0) < READ_TURN_MS)) return false;
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
      const t = norm3({ x: v.x, y: v.y + 0.2, z: v.z });
      const yaw = Math.atan2(t.x, t.z), pitch = Math.asin(Math.max(-1, Math.min(1, t.y)));
      const to = qmul(axisAngle(X, pitch), axisAngle(Y, -yaw));
      g.turn = { from: g.orient, to, start: now, ms: read ? 1600 : 1200 };
      if (read) W.readTurnAt = now; else W.holdUntil = now + 8000;
      W.watchedAt = now;
      return true;
    };
    // THE ENTRANCE (Dan, 2026-10-02): "it should just fly in nicely and at a
    // good zoom distance", never draw somewhere and then jump to centre. The
    // zoom lands on its rest at once (the caller places the canvas for that
    // rest and scales it in), and the world swings round to face its land on
    // one long settle rather than snapping there.
    W.flyIn = (e = {}) => {
      const to = e.q || W.restQ(0), now = performance.now();
      g.userZoom = e.zoom || W.fitZoom(W.size);
      if (g.settle) g.settle();
      const still = e.swoop === false || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      g.turn = still ? { from: to, to, start: now - 1000, ms: 1 } : { from: qmul(axisAngle(Y, 0.6), to), to, start: now, ms: 2200 };
    };
    // a full view born for this world takes its entrance before its first frame
    if (W.entry) { W.flyIn(W.entry); W.entry = null; }
    g.draw('beneath', function (f) {
      const now = f.now || performance.now(), dt = lastNow ? Math.min(0.1, (now - lastNow) / 1000) : 0;
      lastNow = now;
      // a course in view holds the camera where the member put it: a chat tab's
      // lens, or a shared world's course (mountShared's sharedCourse, which has no
      // lens). Without the second, choosing a stop in a shared world drifted
      // back to the world's rest after seven idle seconds (I.5, 2026-10-02)
      if (W.size === 'full' && (W.lens || W.sharedCourse)) return;
      if (g.turn || g.selected || now - touched < 7000 || g.calm || (W.holdUntil && now < W.holdUntil)) return;
      // a watched file holds the view until the work has been quiet a while
      if (W.watchedAt && now - W.watchedAt < RETURN_MS) return;
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      // NO SWAY (Dan, 2026-10-10: "no constant globe swaying"). The world
      // settles to face its rest (the current stop on a course, its land
      // otherwise) and, once there, stops asking for frames at all
      const q = W.restQ(0);
      if (Math.abs(g.orient.w * q.w + g.orient.x * q.x + g.orient.y * q.y + g.orient.z * q.z) > 0.99999) return;
      const k = 1 - Math.exp(-dt * 0.55);
      // idle: the sway is ambience, so the globe keeps its resting frame rate
      g.turn = { from: g.orient, to: slerp(g.orient, q, k), start: now - 1000, ms: 1, idle: true };
    });

    // THE SAME CAMERA, THE SAME PLACES (2026-10-13). A world at rest holds its
    // camera still, yet every frame projected every coast point and every
    // speck of ground again (and each projection made three objects for the
    // collector): most of an idle world's cost. Where a point lands is a pure
    // function of the camera, so it is kept for exactly as long as the camera
    // is the same (its orientation, radius, centre and distance, to the
    // digit) and dropped the moment any of them moves; a lens in play is never
    // kept, because its warp eases on its own.
    let camKey = '';
    const proj = new Map(), paths = new Map();
    const camFor = (f) => {
      const o = g.orient;
      const k = f.lensing || !o ? '' : o.w + ',' + o.x + ',' + o.y + ',' + o.z + '|' + f.R + '|' + f.cx + '|' + f.cy + '|' + f.camZ;
      if (k !== camKey || !k) { camKey = k; proj.clear(); paths.clear(); }
    };
    const P = (f, v, alt = 1) => {
      const keep = camKey && alt === 1;
      if (keep) { const hit = proj.get(v); if (hit) return hit; }
      let q = rotate(g.orient, f.lensing ? g.lens(v) : v);
      let back = false;
      if (q.z < 0) { const l = Math.hypot(q.x, q.y) || 1; q = { x: q.x / l, y: q.y / l, z: 0 }; back = true; }
      const s = project({ x: q.x * alt, y: q.y * alt, z: q.z * alt }, f.R * 0.9, f.cx, f.cy, f.camZ);
      s.z = q.z; s.back = back; s.q = q;
      if (keep) proj.set(v, s);
      return s;
    };
    const path = (f, loop, dy = 0) => { ctx.beginPath(); loop.forEach((v, i) => { const s = P(f, v); i ? ctx.lineTo(s.x, s.y + dy) : ctx.moveTo(s.x, s.y + dy); }); ctx.closePath(); };
    // a loop's outline as one Path2D, kept with the camera like its points, so
    // a coast filled, stroked three times and clipped is traced once
    const P2D = typeof Path2D === 'function';
    const loopPath = (f, loop) => {
      let p = camKey ? paths.get(loop) : null;
      if (p) return p;
      p = new Path2D();
      loop.forEach((v, i) => { const s = P(f, v); i ? p.lineTo(s.x, s.y) : p.moveTo(s.x, s.y); });
      p.closePath();
      if (camKey) paths.set(loop, p);
      return p;
    };
    const fillLoop = (f, loop) => { if (P2D) ctx.fill(loopPath(f, loop)); else { path(f, loop); ctx.fill(); } };
    const strokeLoop = (f, loop) => { if (P2D) ctx.stroke(loopPath(f, loop)); else { path(f, loop); ctx.stroke(); } };
    const clipLoop = (f, loop) => { if (P2D) ctx.clip(loopPath(f, loop)); else { path(f, loop); ctx.clip(); } };

    // a district's files, grouped once: the warmth below asked every file in
    // the world about every district, every frame (profiled 2026-10-07)
    let byDistrict = null;
    const filesIn = (island, district) => {
      if (!byDistrict) {
        byDistrict = new Map();
        for (const file of world.files) {
          const key = file.island + '|' + file.district;
          if (!byDistrict.has(key)) byDistrict.set(key, []);
          byDistrict.get(key).push(file.path);
        }
      }
      return byDistrict.get(island + '|' + district) || [];
    };
    g.draw('beneath', function (f) {
      camFor(f);
      const dpr = g.o.dpr || 1, k = f.R / (400 * dpr) * dpr;
      const order = isl.map((x) => ({ x, z: rotate(g.orient, x.I.c).z })).filter((o) => o.z > -0.25).sort((a, b) => a.z - b.z);
      const side = W.size !== 'full';
      const maxN = Math.max(1, ...isl.map((x) => x.I.count || 1));
      const still = side ? 1 : settled(f.now || performance.now());
      W.moving = still < 1;
      for (const { x, z } of order) {
        const I = x.I, cS = P(f, I.c);
        // a course lens lets the land its work does not touch recede
        const away = !!(W.lens && !W.lens.islands.has(I.key));
        // presence by weight: a big place carries more light than a small
        // one, so the archipelago is never a row of equal pieces
        const weight = I.board ? 0.8 : 0.42 + 0.58 * Math.sqrt((I.count || 1) / maxN);
        const face = 0.45 + 0.7 * Math.max(0, cS.z);
        ctx.save();
        // receding land is dimmer, not filtered: a canvas filter re-renders
        // everything it covers, every frame
        ctx.globalAlpha = clamp01((z + 0.25) / 0.35) * (away ? 0.34 : 1);
        // the faintest shelf of lit water
        const sh0 = LK ? LK.shallows : 'wide';
        if (sh0 !== 'none') { ctx.fillStyle = css(x.rim, 0.022); fillLoop(f, x.shallows[sh0 === 'narrow' ? 2 : 1]); }
        // THE LAND IS LIGHT AT ITS EDGE AND NIGHT WITHIN, like the vault's own
        // lands: a translucent tint over the shared dark, and a luminous coast
        const M = LK ? LK.mat : MATERIAL.luminous;
        const shape = (loop, big) => {
          const R0 = f.R * 0.9 * I.r;
          // the fill's bright side faces the look's light (upper left for /1)
          const ox = LIT.x * 0.6, oy = -LIT.y * 0.6;
          const gr = ctx.createRadialGradient(cS.x + R0 * ox, cS.y + R0 * oy, 0, cS.x, cS.y, R0 * 1.25);
          if (!LK) { gr.addColorStop(0, css(x.land, 0.3 * weight)); gr.addColorStop(1, css(mixRgb(x.land, INK, 0.45), 0.12)); }
          else {
            const lit = M.sheen ? mixRgb(x.land, LK.lightCol, M.sheen) : x.land;
            gr.addColorStop(0, css(lit, Math.min(1, M.a0 * (0.6 + 0.4 * weight)))); gr.addColorStop(1, css(mixRgb(x.land, DEEP, M.sink), M.a1));
          }
          ctx.fillStyle = gr; fillLoop(f, loop);
          // velvet: the light grazes the pile on its lit side only, a crescent of
          // the light's colour through the rim's, and the rest stays deep
          if (LK && M.graze && big) {
            ctx.save(); clipLoop(f, loop);
            const gz = ctx.createRadialGradient(cS.x + R0 * ox * 1.25, cS.y + R0 * oy * 1.25, 0, cS.x + R0 * ox * 1.25, cS.y + R0 * oy * 1.25, R0 * 0.95);
            const gc = mixRgb(x.rim, LK.lightCol, 0.45);
            gz.addColorStop(0, css(gc, M.graze * face)); gz.addColorStop(1, css(gc, 0));
            ctx.fillStyle = gz; fillLoop(f, loop);
            ctx.restore();
          }
          // lacquer and glass carry one hard highlight where the light lands
          if (LK && M.spec && big) {
            ctx.save(); clipLoop(f, loop);
            ctx.fillStyle = css(mixRgb(LK.lightCol, WHITE, 0.5), 0.16 * M.spec * face);
            ctx.beginPath(); ctx.ellipse(cS.x + R0 * ox * 0.9, cS.y + R0 * oy * 0.9, R0 * 0.42, R0 * 0.16, -0.6, 0, TAU); ctx.fill();
            ctx.restore();
          }
          // the coast's glow as two soft strokes under the line, never
          // shadowBlur: a blur per coast per frame was the costliest thing the
          // course globe drew (profiled 2026-10-07), and a still globe at rest
          // still paid it twelve times a second
          ctx.save();
          const lw = Math.max(1, (big ? 1.2 : 0.8) * k), glow = (big ? 0.78 : 0.42) * weight * face;
          const gm = LK ? M.glow * LK.glow : 1, em = LK ? M.edge : 1;
          ctx.lineJoin = 'round';
          // THE GLOW RESTS WHILE THE HAND TURNS (Premium S.1, measured
          // 2026-10-14): a wide round-joined stroke is re-tessellated for every
          // new camera, and on Kinklet's 410 files the islands were 45 of a
          // dragged frame's 54 ms, the files 9. Like the contours, the glow
          // fades out under the hand and back in as it lets go; the line stays.
          if (gm > 0.01 && still > 0.02) {
            ctx.strokeStyle = css(x.rim, Math.min(1, 0.1 * glow * gm * still)); ctx.lineWidth = lw + (big ? 9 : 5) * k; strokeLoop(f, loop);
            ctx.strokeStyle = css(x.rim, Math.min(1, 0.22 * glow * gm * still)); ctx.lineWidth = lw + (big ? 4 : 2.2) * k; strokeLoop(f, loop);
          }
          ctx.strokeStyle = css(mixRgb(x.rim, WHITE, 0.12), Math.min(1, glow * em));
          ctx.lineWidth = lw;
          strokeLoop(f, loop);
          ctx.restore();
        };
        for (const loop of x.islets) shape(loop, false);
        shape(x.coast, true);
        ctx.save(); clipLoop(f, x.coast);
        const cont = LK ? LK.contours : 'dotted';
        if (!side && still > 0 && cont !== 'none') {
          ctx.lineWidth = Math.max(1, 0.8 * k);
          if (cont === 'stitched') {
            // upholstery: one running stitch just inside the shore
            ctx.setLineDash([3.2 * k, 2.6 * k]); ctx.lineWidth = Math.max(1, 1.1 * k);
            ctx.strokeStyle = css(mixRgb(x.rim, WHITE, 0.2), 0.26 * weight * still); strokeLoop(f, x.stitch);
          } else {
            if (cont === 'dotted') ctx.setLineDash([1 * k, 3.6 * k]);
            x.contours.forEach((loop, i) => { ctx.strokeStyle = css(x.rim, [0.12, 0.16][i] * weight * still * (cont === 'solid' ? 0.6 : 1)); strokeLoop(f, loop); });
          }
          ctx.setLineDash([]);
        }
        // the ground: a sparse scatter of light, brighter toward the sun;
        // thinner while the globe turns
        const gk = LK ? LK.ground : 'light';
        const hl = LK && LK.groundCol ? LK.groundCol : mixRgb(x.rim, WHITE, 0.3);
        const keep = (side ? 0.3 : 0.15 + 0.3 * still) * (gk === 'sparkle' ? 0.35 : gk === 'petals' ? 0.5 : 1);
        const tw = LK && LK.tempo ? (f.now || performance.now()) * LK.tempo * TAU : 0;
        if (gk !== 'none') for (const p of x.ground) {
          if (p.s > keep) continue;
          const sp = P(f, p.v);
          if (sp.back || sp.z < 0.02) continue;
          const l = Math.max(0, dot3(sp.q, LIT));
          const r0 = (0.45 + 0.6 * p.s * sp.z) * k;
          if (gk === 'light') {
            ctx.fillStyle = css(hl, (0.04 + 0.26 * l * p.a) * (0.4 + sp.z) * weight);
            ctx.beginPath(); ctx.arc(sp.x, sp.y, r0, 0, TAU); ctx.fill();
          } else if (gk === 'dust') {
            ctx.fillStyle = css(hl, (0.03 + 0.12 * l * p.a) * (0.4 + sp.z) * weight);
            ctx.beginPath(); ctx.arc(sp.x, sp.y, r0 * 0.6, 0, TAU); ctx.fill();
          } else if (gk === 'sparkle') {
            const tws = tw ? 0.55 + 0.45 * Math.sin(tw + p.t) : 1;
            ctx.fillStyle = css(mixRgb(hl, WHITE, 0.4), (0.15 + 0.6 * l * p.a) * tws * (0.4 + sp.z) * weight);
            ctx.beginPath(); ctx.arc(sp.x, sp.y, r0 * 0.7, 0, TAU); ctx.fill();
          } else if (gk === 'petals') {
            ctx.fillStyle = css(hl, (0.1 + 0.35 * l * p.a) * (0.4 + sp.z) * weight);
            ctx.beginPath(); ctx.ellipse(sp.x, sp.y, r0 * 2.2, r0 * 1.1, p.t, 0, TAU); ctx.fill();
          } else if (gk === 'nap') {
            // velvet's pile: short strokes all brushed one way, catching the light
            ctx.strokeStyle = css(hl, (0.025 + 0.13 * l * p.a) * (0.4 + sp.z) * weight); ctx.lineWidth = Math.max(0.7, r0 * 0.6);
            ctx.beginPath(); ctx.moveTo(sp.x, sp.y); ctx.lineTo(sp.x + r0 * 2.6 * LIT.x, sp.y - r0 * 2.6 * LIT.y); ctx.stroke();
          }
        }
        // THE DISTRICT'S WARMTH (slice 14): where this chat has worked recently,
        // the district holding that work carries the faintest warm light. Never
        // a colour change; gone with the afterstate.
        if (W.recentOf) for (const d of I.districts) {
          let kk = 0;
          for (const p of filesIn(I.key, d.key)) kk = Math.max(kk, W.recentOf(p));
          if (kk <= 0) continue;
          const dc = P(f, d.c), R = f.R * 0.9 * d.r * 1.15 * (0.5 + 0.5 * Math.max(0, dc.z));
          const wg = ctx.createRadialGradient(dc.x, dc.y, 0, dc.x, dc.y, R);
          wg.addColorStop(0, `rgba(255,222,184,${(side ? 0.07 : 0.05) * kk})`); wg.addColorStop(1, 'rgba(255,222,184,0)');
          ctx.fillStyle = wg; ctx.beginPath(); ctx.arc(dc.x, dc.y, R, 0, TAU); ctx.fill();
        }
        // districts: only up close, a dotted whisper of an edge
        if (!side && still > 0) for (const d of I.districts) {
          if (!d.coast) continue;
          ctx.setLineDash([1.5 * k, 4.5 * k]); ctx.strokeStyle = css(x.rim, 0.22 * weight * still); ctx.lineWidth = Math.max(1, 0.8 * k);
          strokeLoop(f, d.coast); ctx.setLineDash([]);
        }
        ctx.restore();
        ctx.restore();
      }
      // THE DOOR'S FOOTHOLD: the board's pavilion stands on lit ground of its
      // own, a warm pool and a ring where it meets its islet
      if (world.board) {
        const b = P(f, world.board.at);
        if (!b.back && b.z > 0.02) {
          const rr = f.R * 0.9 * 0.026 * (0.5 + 0.5 * b.z);
          ctx.save();
          ctx.globalAlpha = W.board && W.board.pres ? W.board.pres.alpha : 0.62;
          ctx.translate(b.x, b.y); ctx.scale(1, 0.45 + 0.4 * b.z);
          const pool = ctx.createRadialGradient(0, 0, 0, 0, 0, rr * 2.4);
          const bc = LK ? LK.lightCol : [255, 201, 168];
          pool.addColorStop(0, css(bc, 0.34)); pool.addColorStop(1, css(bc, 0));
          ctx.fillStyle = pool; ctx.beginPath(); ctx.arc(0, 0, rr * 2.4, 0, TAU); ctx.fill();
          ctx.shadowBlur = 8 * k; ctx.shadowColor = css(bc, 0.9);
          ctx.strokeStyle = css(mixRgb(bc, WHITE, 0.3), 0.7); ctx.lineWidth = Math.max(1, k);
          ctx.beginPath(); ctx.arc(0, 0, rr * 1.15, 0, TAU); ctx.stroke();
          ctx.restore();
        }
      }
      // history, stitched: only in the full view, only without a course, and
      // barely there (a course carries its own line; two would read as wiring)
      if (!side && !W.lens && still > 0) {
        ctx.save(); ctx.setLineDash([2 * k, 6 * k]); ctx.lineWidth = Math.max(1, 0.8 * k);
        for (const t of threads) {
          ctx.strokeStyle = LK && LK.thread ? css(LK.thread, 0.16 * still) : css(THREAD_COL[t.hue], 0.07 * still);
          for (const seg of t.segs) {
            ctx.beginPath(); let on = false;
            for (const v of seg) { const sp = P(f, v, 1.004); if (sp.back || sp.z < 0.02) { on = false; continue; } on ? ctx.lineTo(sp.x, sp.y) : ctx.moveTo(sp.x, sp.y); on = true; }
            ctx.stroke();
          }
        }
        ctx.restore();
      }
    });

    // a look's room light (its warm pool and vignette) is NOT drawn here: it is
    // the room's, in one compositor layer over the canvas (repo-world.js
    // paintShared), so it costs no frame anything
    // the sparks fly over the land and under the names
    g.draw('overlay', function (f) { stepStream(W, ctx, f.now, g.o.dpr || 1); stepSparks(W, ctx, f.now, g.o.dpr || 1); });
    // while they fly, the globe draws every frame: without this the stream
    // played at the globe's resting rate, 12 to 20 a second, and read as
    // chunky (Dan, 2026-10-10). Older cores without the seam simply skip it.
    if (g.playing) g.playing(function () {
      if (W.working) return true;   // the course pin's pulse (repo-world.js workPulse)
      if (W.jetUntil && performance.now() < W.jetUntil) return true;   // a push jet in flight
      if (W.fx) { const t = performance.now(); for (const f of W.fx.values()) if (f.kind === 'skim' && t - f.t0 < f.ms) return true; }   // a read
      const S = W.stream;
      return !!((S && (S.drops.length || S.motes.length || S.hits.size)) || (W.sparks && W.sparks.n));
    });

    // names, by distance: islands from afar, districts nearer, files close up
    g.draw('overlay', function (f) {
      camFor(f);
      const dpr = g.o.dpr || 1, z = g.userZoom || 1;
      // a look's type: its face, case and colour (the mono token otherwise)
      const mono = (LK && LK.face) || token('--data', 'JetBrains Mono, monospace');
      const big = (LK && LK.face && LK.L.type.face !== 'sans' ? 1.18 : 1) * (LK && LK.caps === 'small-caps' ? 0.84 : 1);
      const ink = (rgb, a) => LK ? css(LK.typeCol, a) : `rgba(${rgb},${a})`;
      const say = (t) => LK && LK.caps !== 'as-is' ? String(t).toUpperCase() : t;
      ctx.save();
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      if ('letterSpacing' in ctx) ctx.letterSpacing = (1.2 * dpr) + 'px';
      const side = W.size !== 'full';
      const islandA = side ? 0 : clamp01((2.1 - z) / 0.7), distA = side ? 0 : clamp01((z - 1.35) / 0.4);
      for (const x of isl) {
        const I = x.I;
        if (I.board) continue;
        const c = P(f, I.c);
        if (c.back || c.z < 0.3) continue;
        if (islandA > 0.02) {
          const r = f.R * 0.9 * I.r * c.z;
          ctx.font = `500 ${10.5 * big * dpr}px ${mono}`;
          ctx.fillStyle = ink('231,236,255', 0.78 * islandA * clamp01((c.z - 0.3) / 0.3));
          ctx.fillText(say(I.name), c.x, c.y + r * 1.02 + 12 * dpr);
        }
        if (distA > 0.02) for (const d of I.districts) {
          if (!d.name) continue;
          const s = P(f, d.c);
          if (s.back || s.z < 0.4) continue;
          ctx.font = `500 ${10 * big * dpr}px ${mono}`;
          ctx.fillStyle = ink('214,222,255', 0.62 * distA);
          ctx.fillText(say(d.name), s.x, s.y + f.R * 0.9 * d.r * s.z + 10 * dpr);
        }
      }
      // the board's door keeps its quiet name at every distance
      const box = view.sculptureBox ? view.sculptureBox('repo-board') : null;
      const pres = W.boardPresence ? W.boardPresence() : { label: side ? 0 : 1 };
      if (pres.label > 0 && box && box.facing > 0.15) {
        const kk = g.canvas.width / (g.canvas.getBoundingClientRect().width || 1);
        ctx.font = `500 ${10.5 * big * dpr}px ${mono}`;
        ctx.fillStyle = ink('255,217,192', 0.85 * pres.label * clamp01((box.facing - 0.15) / 0.3));
        ctx.fillText(say('the board'), (box.x + box.w / 2) * kk, (box.y + box.h) * kk + 14 * dpr);
      }
      // files, only close up: the few nearest the middle of the view
      const fileA = clamp01((z - 1.6) / 0.4);
      const selected = g.selected;
      const list = [];
      for (const [id, p] of W.pos) {
        if (p.frame !== W.frame || p.facing < 0.45) continue;
        const d = Math.hypot(p.x - f.cx, p.y - (f.cy - f.R * 0.2));
        list.push({ id, p, d });
      }
      list.sort((a, b) => a.d - b.d);
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
      ctx.textAlign = 'left';
      list.forEach((it, i) => {
        const file = byId.get(it.id);
        if (!file) return;
        const mark = !!file.landmark, sel = it.id === selected;
        const a = sel ? 1 : side ? 0 : mark ? Math.max(clamp01((z - 1.2) / 0.4), fileA) : (i < 12 ? fileA : 0);
        if (a < 0.02) return;
        ctx.font = `${mark ? 600 : 500} ${10.5 * big * dpr}px ${mono}`;
        ctx.fillStyle = ink('236,236,255', 0.82 * a);
        ctx.fillText(say(file.name), it.p.x + 9 * dpr, it.p.y + 3.5 * dpr);
      });
      ctx.restore();
      W.frame = (W.frame || 0) + 1;
    });

    // the board's door: commissioned node art on its islet, through the
    // core's own sculpture engine
    // night or day is the shared world's own, never the member's theme (F.2)
    const dark = W.style ? W.style.atmosphere !== 'day' : document.documentElement.dataset.theme !== 'light';
    const artFile = W.boardArt;
    const cur = artFile && window.CourseArt && window.CourseArt.currentOf ? window.CourseArt.currentOf(artFile) : null;
    const spec0 = (cur && cur.spec) || DEFAULT_DOOR;
    const spec = LK ? tintSpec(spec0, toHsl(rgbOf(W.style.route))[0], toHsl(LK.lightCol)[0]) : spec0;
    let sc = window.CourseArt && window.CourseArt.sculpt ? window.CourseArt.sculpt(spec, { free: true, base: null, dark }) : null;
    if (window.CourseArt && window.CourseArt.ready && (!sc || !sc.ok)) {
      window.CourseArt.ready().then(() => {
        sc = window.CourseArt.sculpt(spec, { free: true, base: null, dark });
        W.board.key = "";
        W.boardPresence();
      }).catch(() => {});
    }
    // THE BOARD IS A DOOR, NOT THE ATTRACTION (repo-policy.js): small and quiet
    // at rest, brighter and named near the hand, a step further back under a course
    W.board = { key: '' };
    W.boardPresence = () => {
      const pres = window.RepoPolicy ? window.RepoPolicy.boardPresence({ size: W.size, lens: !!W.lens, hover: g.hoverMark === BOARD_MARK || (W.boardFlashUntil && performance.now() < W.boardFlashUntil) })
        : { span: 0.085, alpha: 0.62, label: 0 };
      const key = pres.span + ':' + pres.alpha;
      if (sc && sc.ok && world.board && key !== W.board.key) {
        W.board.key = key;
        view.sculpture('repo-board', { at: world.board.at, front: world.board.front, alt: 1.004,
          size: pres.span / Math.max(0.2, sc.extent.w), art: sc, alpha: pres.alpha, amount: 0.5 });
      }
      W.board.pres = pres;
      return pres;
    };
    W.boardPresence();
    g.hit(function (ev, out) {
      const b = view.sculptureBox ? view.sculptureBox('repo-board') : null;
      if (!b || b.facing < 0.1) return -1;
      const rect = g.canvas.getBoundingClientRect(), x = ev.clientX - rect.left, y = ev.clientY - rect.top;
      if (x < b.x - 6 || x > b.x + b.w + 6 || y < b.y - 6 || y > b.y + b.h + 6) return -1;
      out.d = Math.hypot(x - (b.x + b.w / 2), y - (b.y + b.h / 2)) * 0.3;
      return BOARD_MARK;
    });
    g.press(function (i) { if (i !== BOARD_MARK) return false; if (W.onBoard) W.onBoard(); return true; });
    W.g = g;
  }

  // A piece of node art in a look's colours: cool strokes (hue 160 to 300)
  // take the route's hue, warm ones the light's. A copy; the spec is untouched.
  function tintSpec(spec, body, warm) {
    if (!spec || !Array.isArray(spec.strokes)) return spec;
    const out = Object.assign({}, spec, { strokes: spec.strokes.map((st) => (typeof st.hue === 'number' ? Object.assign({}, st, { hue: Math.round(st.hue >= 160 && st.hue <= 300 ? body : warm) }) : st)) });
    return out;
  }
  // The door grammar for a repository that has not commissioned its own:
  // posts in a ring, a plain roof, the card stack at its heart.
  const DEFAULT_DOOR = (() => {
    const ring = (y, r, n = 16) => Array.from({ length: n + 1 }, (_, i) => { const a = (i / n) * TAU; return [+(r * Math.cos(a)).toFixed(3), y, +(r * Math.sin(a)).toFixed(3)]; });
    const posts = [];
    for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU + 0.26, b = a + 0.18; posts.push([+(0.5 * Math.cos(a)).toFixed(3), -0.5, +(0.5 * Math.sin(a)).toFixed(3)], [+(0.47 * Math.cos(a)).toFixed(3), 0.1, +(0.47 * Math.sin(a)).toFixed(3)], [+(0.47 * Math.cos(b)).toFixed(3), 0.1, +(0.47 * Math.sin(b)).toFixed(3)], [+(0.5 * Math.cos(b)).toFixed(3), -0.5, +(0.5 * Math.sin(b)).toFixed(3)]); }
    return { seed: 41, span: 0.85, depth: 'volumetric', view: 'three-quarter', motion: { kind: 'breathe', tempo: 'lazy' },
      reading: 'A pavilion, the door to the board',
      strokes: [
        { points: ring(-0.5, 0.52), smooth: true, section: 'tube', importance: 'primary', girth: 0.06, moves: 'still', hue: 250 },
        { points: ring(0.12, 0.6), smooth: true, section: 'tube', importance: 'secondary', girth: 0.035, moves: 'still', hue: 250 },
        { points: posts, section: 'thread', importance: 'secondary', hue: 250 },
        { points: [[-0.6, 0.12, 0], [0, 0.62, 0], [0.6, 0.12, 0]], smooth: true, section: 'blade', importance: 'primary', girth: 0.08, moves: 'still', hue: 230 },
        { points: [[0, 0.62, 0], [0, 0.7, 0]], section: 'tube', importance: 'secondary', girth: 0.06, moves: 'still', hue: 45 },
        { points: [[0, -0.26, 0], [0, -0.04, 0]], section: 'tube', importance: 'primary', girth: 0.1, moves: 'pulse', hue: 45 },
        { points: [[-0.12, 0.02, 0], [0.12, 0.04, 0]], section: 'tube', importance: 'accent', girth: 0.03, moves: 'sway', hue: 18 },
      ] };
  })();

  // THE FAMILY MODULATES, IT NEVER REPLACES. The event itself is the core's
  // (skim, working wheel then flare, birth, send beam), drawn by the globe on
  // this node exactly as on a note. This adds only how the material answers:
  // a crystal throws a small four-point sparkle, paper blooms softly, glass
  // rings once, stone brightens along its top. Brief, and never progress.
  function material(ctx, family, fx, t, x, y, rr, base, c, dpr, now) {
    const kind = window.RepoPolicy ? window.RepoPolicy.materialOf(family) : 'stone';
    const u = fx.hold ? 0.5 + 0.5 * Math.sin(now / 260) : clamp01(t);
    const fade = fx.hold ? 0.8 : Math.sin(Math.PI * Math.min(1, u)) ;
    const loud = fx.kind === 'skim' ? 0.55 : fx.kind === 'born' ? 1.2 : 0.9;
    ctx.save();
    ctx.globalAlpha = Math.min(1, ctx.globalAlpha * fade * loud);
    if (kind === 'crystal') {
      const L = rr * (2.2 + 1.4 * u), a = now / 900;
      ctx.strokeStyle = css(mixRgb(c.hi, WHITE, 0.5), 0.95); ctx.lineWidth = Math.max(0.8, 0.7 * dpr);
      for (let i = 0; i < 4; i++) {
        const th = a + i * Math.PI / 2, k = i % 2 ? 0.55 : 1;
        ctx.beginPath(); ctx.moveTo(x - 0.3 * rr, y - 0.55 * rr); ctx.lineTo(x - 0.3 * rr + Math.cos(th) * L * k, y - 0.55 * rr + Math.sin(th) * L * k); ctx.stroke();
      }
      glint(ctx, x - 0.3 * rr, y - 0.55 * rr, rr * 2.2, 1);
    } else if (kind === 'paper') {
      const R = rr * (2 + 2.5 * u);
      const gl = ctx.createRadialGradient(x, y, 0, x, y, R); gl.addColorStop(0, 'rgba(255,236,196,0.55)'); gl.addColorStop(1, 'rgba(255,236,196,0)');
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.fill();
    } else if (kind === 'glass') {
      ctx.strokeStyle = css(mixRgb(base, WHITE, 0.6), 0.9); ctx.lineWidth = Math.max(0.8, 0.8 * dpr);
      ctx.beginPath(); ctx.arc(x, y, rr * (1.3 + 1.8 * u), 0, TAU); ctx.stroke();
    } else {
      ctx.fillStyle = css(mixRgb(c.hi, WHITE, 0.4), 0.9);
      ctx.beginPath(); ctx.ellipse(x, y - rr * 0.55, rr * (0.9 + 0.6 * u), rr * 0.3, 0, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  // THE AFTERGLOW (slice 14): where this chat worked in the last three minutes.
  // An afterimage, not an alarm: a soft light in the file's own hue that fades
  // with the record, and in the full view one quiet ring. It never pulses.
  function afterglow(ctx, x, y, rr, base, k, side, dpr) {
    ctx.save();
    const warm = mixRgb(base, [255, 226, 186], 0.35);
    const R = rr * (side ? 3.4 : 3.8);
    const gl = ctx.createRadialGradient(x, y, 0, x, y, R);
    gl.addColorStop(0, css(warm, 0.1 + 0.26 * k)); gl.addColorStop(1, css(warm, 0));
    ctx.globalAlpha = 1; ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.fill();
    if (!side) {
      ctx.strokeStyle = css(mixRgb(warm, WHITE, 0.3), 0.14 + 0.3 * k); ctx.lineWidth = Math.max(0.8, 0.9 * dpr);
      ctx.beginPath(); ctx.arc(x, y, rr * 2.3, 0, TAU); ctx.stroke();
    }
    ctx.restore();
  }

  // ── SPARKS (Dan, 2026-10-04: "the sparkly bounce from Noita") ──────────
  // A write throws a handful of hot pixels up off the file; they arc under
  // gravity, hit the ground the file stands on, bounce two or three times
  // losing energy, flicker and cool from white through the file's own hue to
  // ember. What makes Noita's version feel good is copied, not its engine:
  // every spark is a crisp square pixel snapped to the grid (no blur, no
  // shadowBlur, which is the slow path in canvas), added with 'lighter' so
  // they glow where they overlap, with a one-frame streak behind each, and
  // the physics is a fixed-cost loop over a preallocated pool, so a burst
  // costs nothing to allocate and the frame never waits on the collector.
  // Sparks ride with their file (offsets from its head), so a turning globe
  // carries them. Reduced motion gets none; the core's flare still plays.
  const SPARK_MAX = 360, SP = 16;   // x y vx vy age life floor bounce r g b anchor er eg eb style (burst + 4 for a birth)

  // EACH KIND THROWS ITS OWN FIRE (Dan, 2026-10-04: colour-coded to the
  // node's kind, with complements). Every tone is turned from the file's own
  // hue, never a fixed colour, so a project's themed gems keep their sparks.
  // Most sparks are the family's hue; `mate` is a neighbouring hue mixed in
  // for depth; `pop` is a rare true complement, a glint of contrast; `ember`
  // is the hue it cools to as it dies. Shifts are degrees round the wheel.
  //   source, blue crystal:   violet mates, gold glints, cools to indigo
  //   test, teal crystal:     mint mates, coral glints, cools to deep sea
  //   markdown, paper:        amber mates, burns down to orange-red like paper
  //   data, gold stone:       orange mates, a few blue glints, cools to red
  //   style or asset, glass:  lilac mates, mint glints, cools to magenta
  //   config and other:       grey, so its fire is lifted to steel and lilac
  const SPARK_TONE = {
    src:   { sat: 1.15, mate: [38, 0.35], pop: [180, 0.08], ember: [22, 0.42] },
    test:  { sat: 1.1,  mate: [-26, 0.35], pop: [170, 0.08], ember: [14, 0.36] },
    md:    { sat: 1.9,  mate: [-14, 0.4], pop: null, ember: [-28, 0.4] },
    data:  { sat: 1.2,  mate: [-18, 0.35], pop: [185, 0.06], ember: [-34, 0.42] },
    ui:    { sat: 1.1,  mate: [-48, 0.35], pop: [160, 0.08], ember: [-14, 0.48] },
    cfg:   { sat: 2.6,  mate: [30, 0.35], pop: [190, 0.06], ember: [12, 0.5], emberSat: 0.35 },
    other: { sat: 2.2,  mate: [40, 0.35], pop: [185, 0.06], ember: [14, 0.5], emberSat: 0.35 },
  };
  function toHsl(c) {
    const r = c[0] / 255, g = c[1] / 255, b = c[2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    if (mx === mn) return [0, 0, l];
    const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h * 60, s, l];
  }
  function fromHsl(h, s, l) {
    h = ((h % 360) + 360) % 360 / 360; s = clamp01(s); l = clamp01(l);
    if (!s) return [l * 255, l * 255, l * 255];
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const ch = (t) => { t = (t + 1) % 1; return 255 * (t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p); };
    return [ch(h + 1 / 3), ch(h), ch(h - 1 / 3)];
  }
  // the family's spark set, turned from its base hue once per base and family
  const toneCache = new Map();
  function sparkTones(family, base) {
    const key = family + ':' + base.join(',');
    let t = toneCache.get(key);
    if (t) return t;
    const T = SPARK_TONE[family] || SPARK_TONE.other, [h, s0, l0] = toHsl(base);
    const s = Math.min(1, Math.max(0.35, s0 * T.sat)), l = Math.max(0.55, Math.min(0.72, l0));
    t = {
      main: fromHsl(h, s, l + 0.06),
      mate: fromHsl(h + T.mate[0], Math.min(1, s * 1.05), l),
      mateP: T.mate[1],
      pop: T.pop ? fromHsl(h + T.pop[0], 0.9, 0.7) : null,
      popP: T.pop ? T.pop[1] : 0,
      ember: fromHsl(h + T.ember[0], T.emberSat || Math.min(0.85, s), T.ember[1]),
    };
    toneCache.set(key, t);
    return t;
  }
  function sparks(W) {
    if (W.sparks) return W.sparks;
    W.sparks = { buf: new Float32Array(SPARK_MAX * SP), n: 0, anchors: [], last: 0 };
    return W.sparks;
  }
  function stillMotion() { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  function anchorOf(S, id) { let i = S.anchors.indexOf(id); if (i < 0) { i = S.anchors.length; S.anchors.push(id); } return i; }
  // `count` pixels from the head at (hx, hy); `floor` is how far below the
  // head the ground is, in device pixels
  function emitSparks(W, id, count, floor, base, dpr, power, family, style) {
    if (stillMotion()) return;
    const S = sparks(W), b = S.buf, a = anchorOf(S, id), p = power || 1;
    const T = sparkTones(family, base);
    // a look's burst: confetti drifts and lasts, embers rise slowly, stars are few and large
    const st = (style || 0) & 3, spd = st === 2 ? 0.35 : st === 1 ? 0.8 : 1, lf = st === 2 ? 2.2 : st === 1 ? 1.8 : st === 3 ? 1.4 : 1;
    for (let k = 0; k < count; k++) {
      const roll = Math.random();
      const hot = roll < T.popP ? T.pop : roll < T.popP + T.mateP ? T.mate : T.main;
      let i = S.n;
      if (i >= SPARK_MAX) i = (Math.random() * SPARK_MAX) | 0; else S.n++;   // full: overwrite one at random
      const o = i * SP;
      const th = -Math.PI / 2 + (Math.random() - 0.5) * (st === 2 ? 0.9 : 2.3);   // a fountain, mostly up
      const sp = (70 + Math.random() * 190) * dpr * p * spd;
      b[o] = (Math.random() - 0.5) * 2 * dpr; b[o + 1] = (Math.random() - 0.5) * 2 * dpr;
      b[o + 2] = Math.cos(th) * sp; b[o + 3] = Math.sin(th) * sp;
      b[o + 4] = 0; b[o + 5] = (0.8 + Math.random() * 0.9) * lf;
      b[o + 6] = Math.max(4 * dpr, floor + (Math.random() - 0.3) * 3 * dpr);
      b[o + 7] = 0;
      b[o + 8] = hot[0]; b[o + 9] = hot[1]; b[o + 10] = hot[2]; b[o + 11] = a;
      b[o + 12] = T.ember[0]; b[o + 13] = T.ember[1]; b[o + 14] = T.ember[2];
      b[o + 15] = style || 0;
      // confetti: each piece its own neighbouring hue
      if (st === 1) { const j = fromHsl(toHsl([b[o + 8], b[o + 9], b[o + 10]])[0] + (Math.random() - 0.5) * 90, 0.85, 0.65); b[o + 8] = j[0]; b[o + 9] = j[1]; b[o + 10] = j[2]; }
    }
  }
  function stepSparks(W, ctx, now, dpr) {
    const S = W.sparks;
    if (!S || !S.n) { if (S) S.last = now; return; }
    const dt = Math.min(0.05, Math.max(0, (now - (S.last || now)) / 1000));
    S.last = now;
    const b = S.buf, G = 620 * dpr, px = Math.max(1, Math.round(1.4 * dpr)), LKs = lookOf(W);
    // anchors resolved once per frame: where each file's head is now
    const at = S.anchors.map((id) => W.pos.get(id) || null);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowBlur = 0;
    let w = 0;
    for (let i = 0; i < S.n; i++) {
      const o = i * SP;
      let x = b[o], y = b[o + 1], vx = b[o + 2], vy = b[o + 3];
      const age = b[o + 4] + dt, life = b[o + 5], floor = b[o + 6], st = b[o + 15] & 3;
      if (age >= life) continue;   // dead: dropped by the compaction below
      const px0 = x, py0 = y;
      vy += G * dt * (st === 1 ? 0.22 : st === 2 ? -0.12 : st === 3 ? 0.5 : 1); vx *= 1 - (st === 1 ? 1.4 : 0.6) * dt;
      if (st === 1) vx += Math.sin(now * 0.004 + i) * 30 * dpr * dt;   // confetti flutters
      x += vx * dt; y += vy * dt;
      if (y > floor && vy > 0) {
        y = floor - (y - floor) * 0.5;
        vy = -vy * (0.42 + 0.16 * Math.random()); vx *= 0.72;
        b[o + 7] += 1;
        if (Math.abs(vy) < 40 * dpr) vy = 0;   // too tired to bounce: it skitters along and dies
      }
      const A = at[b[o + 11]];
      if (A) {
        const u = age / life;
        // a white-hot instant, then the kind's own colour for most of its
        // flight, then down to the kind's ember as it dies
        const k = Math.min(1, u / 0.15), e = u < 0.55 ? 0 : (u - 0.55) / 0.45;
        const cr = (255 * (1 - k) + b[o + 8] * k) * (1 - e) + b[o + 12] * e;
        const cg = (255 * (1 - k) + b[o + 9] * k) * (1 - e) + b[o + 13] * e;
        const cb = (255 * (1 - k) + b[o + 10] * k) * (1 - e) + b[o + 14] * e;
        // Noita's twinkle: each spark flickers on its own beat as it cools
        const flick = 0.6 + 0.4 * Math.sin(now * 0.045 + i * 2.39);
        const al = (1 - u * u) * (u > 0.6 ? flick : 1) * (A.facing == null ? 1 : Math.min(1, A.facing * 1.6));
        const sx = Math.round(A.x + x), sy = Math.round(A.y + y);
        const col = 'rgb(' + (cr | 0) + ',' + (cg | 0) + ',' + (cb | 0) + ')';
        ctx.fillStyle = col;
        // the halo is pixels too, in the spark's own colour: a wide faint
        // block and a tight brighter one, so the glow carries the kind's hue
        // a look's own shape as the particle, or the pixel spark in its style's size
        const shp = LKs && LKs.motion ? (LKs.motion[(b[o + 15] >> 2) ? 'birth' : 'finish'].particle) : null;
        if (shp && LKs.shapes[shp]) { ctx.globalAlpha = al; drawShape(ctx, LKs.shapes[shp], sx, sy, px * 3.2, { hi: [cr, cg, cb], mid: [cr, cg, cb], lo: [cr * 0.6, cg * 0.6, cb * 0.6], flame: [cr, cg, cb] }); }
        else {
        const big = st === 3 ? 2.4 : st === 1 ? 1.6 : 1, qx = Math.round(px * big);
        ctx.globalAlpha = al * 0.07; ctx.fillRect(sx - 2 * qx, sy - 2 * qx, 5 * qx, 5 * qx);
        ctx.globalAlpha = al * 0.18; ctx.fillRect(sx - qx, sy - qx, 3 * qx, 3 * qx);
        ctx.globalAlpha = al * 0.45;   // the streak: where it was a frame ago
        ctx.fillRect(Math.round(A.x + px0), Math.round(A.y + py0), px, px);
        ctx.globalAlpha = al;
        ctx.fillRect(sx, sy, qx, qx);
        }
      }
      // compact in place: live sparks slide down over the dead
      const q = w * SP;
      if (q !== o) for (let f = 0; f < SP; f++) b[q + f] = b[o + f];
      b[q] = x; b[q + 1] = y; b[q + 2] = vx; b[q + 3] = vy; b[q + 4] = age;
      w++;
    }
    S.n = w;
    if (!w) S.anchors.length = 0;
    ctx.restore();
  }

  // ── THE STREAM: A WAND OUT OF SIGHT (Dan, 2026-10-04 and 10-05: "a stream
  // being shot from space directly at that node, as it happens and looks in
  // Noita ... as if the wand is above that point, out of view, shooting down
  // on it") ────────────────────────────────────────────────────────────────
  // A rapid-fire wand of spark bolts, held somewhere above the top of the
  // canvas, firing down at the file while the agent writes. What reads as
  // Noita, copied rather than its engine:
  //   * BOLTS, not dots: a white-hot core a few pixels across inside a stepped
  //     pixel bloom in the file's colour, a short hard streak behind it.
  //   * a slight arc and a little spread, so a volley fans and converges
  //     rather than running down one ruled line.
  //   * every bolt SHEDS a sparkle trail as it flies: motes that hang in the
  //     air, drift, twinkle and cool, so the path stays lit after it passes.
  //   * the hit: a pop of sparks off the file, and the spot it strikes is lit
  //     (an emissive pool that swells while the volley lands and dies after).
  // Everything is additive square pixels, no shadowBlur; motes and bolts ride
  // with their file like the sparks do, so a turning globe swings the volley.
  const BOLT_MAX = 420, MOTE_MAX = 900, BOLT_SPEED = 1400, BOLT_LEAN = 0.22, BOLT_TAIL = 5;
  // THE CONE, as the core's write-stream.js pours it (Dan, 2026-10-10: here
  // it "still looks like pellets in a straight line"). The wand stands at
  // least WAND_REACH CSS px above the file; the sway is a slope (px across per
  // px above the file) flared like a tornado that pinches in at the file;
  // three strands braid round one funnel; every shot leaves on one
  // line, so the ribbons coil rather than rain. CONE_SLOPE * CONE_SPREAD matches the vault globe's cone.
  const WAND_REACH = 360, CONE_SLOPE = 0.06, CONE_SPREAD = 2.2;
  // the cone is a tornado: radius as (height above the file)^POW, pinched at
  // the file and flared wide up top, standing nearer upright (write-stream.js)
  const TWISTER_POW = 1.8, TWISTER_GAIN = 2.2, TWISTER_LEAN = 0.13;
  // it falls at a third of the hero's speed so the turn can be seen, each
  // strand a helix of (RATE + WAVE_DRIFT) * fall time radians, turning at
  // WAVE_DRIFT a second (write-stream.js TWISTER_RATE)
  const TWISTER_RATE = 6, TWISTER_SPEED = 0.34, TWISTER_STRANDS = [0, Math.PI * 2 / 3, Math.PI * 4 / 3];
  const WAVE_AMP = 9, WAVE_RATE = 40, WAVE_DRIFT = 14;   // sway in px, radians a second of a particle's age, and of firing time
  function stream(W) {
    if (!W.stream) W.stream = { drops: [], motes: [], hits: new Map(), last: 0 };
    return W.stream;
  }
  // one bolt at file `id`, whose head is `top` device pixels below the
  // canvas's top edge; `floor` is how far below the head its ground is
  function pourDrop(W, id, top, floor, base, dpr, family) {
    if (stillMotion()) return;
    const S = stream(W);
    S.n = (S.n || 0) + 1;
    if (S.n > 1e6) S.n = 0;
    // three strands a third of a turn apart on one funnel, braiding as it turns
    for (const ph of TWISTER_STRANDS) shoot(W, id, top, floor, base, dpr, family, ph);
  }
  function shoot(W, id, top, floor, base, dpr, family, phase) {
    const S = stream(W), T = sparkTones(family, base);
    if (S.drops.length >= BOLT_MAX) S.drops.shift();
    // the wand sits above the file and a little to the left, out of view;
    // every shot leaves it on the same line, so the coils hold together
    // a look's write: rain falls straight, a spiral coils wider and faster, a drift takes its time
    const MWs = ((lookOf(W) || {}).motion || {}).write || {}, ws = MWs.style || 'wand';
    const sy = -Math.max(top + 40 * dpr, WAND_REACH * dpr), sx = ws === 'rain' ? 0 : sy * TWISTER_LEAN;
    const dist = Math.hypot(sx, sy), roll = Math.random(), t0 = performance.now();
    const col = roll < T.popP ? T.pop : roll < T.popP + T.mateP ? T.mate : T.main;
    S.drops.push({
      id, sx, sy, t0, dur: Math.max(300, Math.min(2800, dist / (BOLT_SPEED * TWISTER_SPEED * dpr) * 1000 * (ws === 'drift' ? 2 : ws === 'rain' ? 0.7 : 1))),
      // SLITHERING PATH (Dan, 2026-10-05: "less cluster, more a wavy particle
      // stream"; Noita's modifier "makes a projectile move rapidly in a
      // slithering manner, like a snake"). Every particle sways across its
      // line by its own age, and the phase it is fired at drifts, so the
      // stream at any instant is one sine ribbon that travels as it pours.
      amp: dist * CONE_SLOPE * CONE_SPREAD * (ws === 'rain' ? 0 : ws === 'spiral' ? 1.8 : ws === 'drift' ? 1.2 : 1),
      ph: -WAVE_DRIFT * t0 / 1000 + phase, rate: TWISTER_RATE * (ws === 'spiral' ? 1.6 : 1), shed: 0,
      col, cs: css(col), ember: T.ember, family, base, floor,
    });
  }
  // where a particle is at `u` (0 at the wand, 1 at the file), relative to
  // the file's head: the straight line, swayed across it by the slither. The
  // sway opens just out of the wand and closes to nothing at the file, so
  // every particle still lands true.
  function boltAt(d, u) {
    const L = Math.hypot(d.sx, d.sy) || 1, nx = d.sy / L, ny = -d.sx / L;
    // straight sides: widest just out of the wand, closing evenly on the file
    const age = u * d.dur / 1000, env = Math.min(1, u * 9) * TWISTER_GAIN * Math.pow(1 - u, TWISTER_POW);
    const sway = d.amp * env * Math.sin((d.rate || WAVE_RATE) * age + d.ph);
    return [d.sx * (1 - u) + nx * sway, d.sy * (1 - u) + ny * sway];
  }
  function stepStream(W, ctx, now, dpr) {
    const S = W.stream;
    if (!S || (!S.drops.length && !S.motes.length && !S.hits.size)) return;
    const dt = Math.min(0.05, Math.max(0, (now - (S.last || now)) / 1000));
    S.last = now;
    const px = Math.max(1, Math.round(1.4 * dpr));
    const rgb = (c) => 'rgb(' + Math.min(255, c[0] | 0) + ',' + Math.min(255, c[1] | 0) + ',' + Math.min(255, c[2] | 0) + ')';
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowBlur = 0;
    // the lit spot where the volley lands
    for (const [id, h] of S.hits) {
      const fade = 1 - (now - h.at) / 380, A = W.pos.get(id);
      if (fade <= 0) { S.hits.delete(id); continue; }
      if (!A) continue;
      const face = A.facing == null ? 1 : Math.min(1, A.facing * 1.6);
      const R = (8 + 7 * Math.min(1, h.n / 10)) * dpr;
      const gr = ctx.createRadialGradient(A.x, A.y, 0, A.x, A.y, R);
      gr.addColorStop(0, css([255, 250, 235], 0.32 * fade * face)); gr.addColorStop(0.3, css(h.col, 0.22 * fade * face)); gr.addColorStop(1, css(h.col, 0));
      ctx.globalAlpha = 1; ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(A.x, A.y, R, 0, TAU); ctx.fill();
    }
    // the sparkle the bolts leave hanging in the air
    let m = 0;
    for (let i = 0; i < S.motes.length; i++) {
      const o = S.motes[i];
      o.age += dt;
      if (o.age >= o.life) continue;
      o.vy += 90 * dpr * dt; o.vx *= 1 - 1.8 * dt; o.vy *= 1 - 1.2 * dt;
      o.x += o.vx * dt; o.y += o.vy * dt;
      S.motes[m++] = o;
      const A = W.pos.get(o.id);
      if (!A) continue;
      const face = A.facing == null ? 1 : Math.min(1, A.facing * 1.6);
      const u = o.age / o.life, e = u < 0.4 ? 0 : (u - 0.4) / 0.6;
      const c = [o.col[0] * (1 - e) + o.ember[0] * e, o.col[1] * (1 - e) + o.ember[1] * e, o.col[2] * (1 - e) + o.ember[2] * e];
      const tw = 0.45 + 0.55 * Math.max(0, Math.sin(now * 0.05 + o.ph));
      ctx.fillStyle = rgb(c);
      ctx.globalAlpha = face * (1 - u) * tw;
      ctx.fillRect(Math.round(A.x + o.x), Math.round(A.y + o.y), px, px);
    }
    S.motes.length = m;
    // the bolts
    let w = 0;
    for (let i = 0; i < S.drops.length; i++) {
      const d = S.drops[i], u = (now - d.t0) / d.dur, A = W.pos.get(d.id);
      if (u >= 1) {
        // the hit: a pop of sparks off the file, and the spot flares
        if (A) {
          if (Math.random() < 0.6) emitSparks(W, d.id, 1, d.floor, d.base, dpr, 0.55, d.family);
          const h = S.hits.get(d.id);
          S.hits.set(d.id, { at: now, col: d.col, n: h ? Math.min(12, h.n + 1) : 1 });
        }
        continue;
      }
      S.drops[w++] = d;
      if (!A) continue;
      // each particle orbits the funnel: brightest swinging past in front
      const face = (A.facing == null ? 1 : Math.min(1, A.facing * 1.6)) * (0.4 + 0.6 * (0.5 + 0.5 * Math.cos((d.rate || WAVE_RATE) * u * d.dur / 1000 + d.ph)));
      const [bx, by] = boltAt(d, u), [qx, qy] = boltAt(d, Math.max(0, u - 0.04));
      const fx = A.x + bx, fy = A.y + by;
      let ux = bx - qx, uy = by - qy;
      const ul = Math.hypot(ux, uy) || 1; ux /= ul; uy /= ul;
      // shed the trail: a mote or two per frame, flung a little off the line
      if (S.motes.length < MOTE_MAX && now - d.shed > 16) {
        d.shed = now;
        for (let k = Math.random() < 0.55 ? 1 : 0; k > 0; k--) {
          const roll = Math.random();
          S.motes.push({ id: d.id, x: bx - ux * Math.random() * 6 * dpr, y: by - uy * Math.random() * 6 * dpr,
            vx: (Math.random() - 0.5) * 24 * dpr - ux * 18 * dpr, vy: (Math.random() - 0.7) * 24 * dpr - uy * 18 * dpr,
            age: 0, life: 0.25 + Math.random() * 0.4, ph: Math.random() * TAU,
            col: roll < 0.25 ? [255, 244, 220] : d.col, ember: d.ember });
        }
      }
      if (face <= 0.02) continue;
      // A PARTICLE, NOT A BOLT (Dan, 2026-10-05: "the bolts were too big; in
      // the game it's a stream of little particles shooting at a really smooth
      // high framerate"). One pixel, placed at its true sub-pixel position so
      // fast flight glides rather than stepping, behind it a thin continuous
      // streak the length of one frame's travel and a little more, cooling
      // from white to the particle's colour, and the faintest 3-pixel glow.
      // two flat strokes stacked by 'lighter' (colour, then white at the
      // head) rather than a gradient built per particle per frame
      const tl = BOLT_TAIL * px * 2.2, tx = fx - ux * tl, ty = fy - uy * tl, mx = fx - ux * tl * 0.45, my = fy - uy * tl * 0.45;
      ctx.lineWidth = px * 0.9; ctx.lineCap = 'round';
      ctx.strokeStyle = d.cs; ctx.globalAlpha = 0.3 * face;
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(fx, fy); ctx.stroke();
      ctx.strokeStyle = 'rgb(255,250,238)'; ctx.globalAlpha = 0.5 * face;
      ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(fx, fy); ctx.stroke();
      ctx.fillStyle = d.cs; ctx.globalAlpha = face * 0.14;
      ctx.fillRect(fx - 1.5 * px, fy - 1.5 * px, 3 * px, 3 * px);
      ctx.fillStyle = 'rgb(255,252,240)'; ctx.globalAlpha = face;
      ctx.fillRect(fx - px / 2, fy - px / 2, px, px);
    }
    S.drops.length = w;
    ctx.restore();
  }

  // THE FILE RISES TO BE WRITTEN (Dan, 2026-10-05): a file the agent starts
  // writing eases up off its land on a longer stem and grows, the stream
  // pours onto it there, and when the work goes quiet (after the flare) it
  // eases smaller and settles back down. Up is quicker than down, the way a
  // thing is picked up briskly and set down with care. This replaces the
  // core's turning wheel, which the repo world switches off (noWheel).
  function raiseOf(W, id, want, now) {
    const R = W.raise || (W.raise = new Map());
    let st = R.get(id);
    if (!st) { if (!want) return 0; st = { v: 0, t: now }; R.set(id, st); }
    const dt = Math.min(0.05, Math.max(0, (now - st.t) / 1000));
    st.t = now;
    st.v = want ? st.v + (1 - st.v) * Math.min(1, dt * 5.5) : Math.max(0, st.v - dt * 1.6);
    if (!want && st.v <= 0) { R.delete(id); return 0; }
    if (stillMotion()) return want ? 1 : 0;
    return st.v * st.v * (3 - 2 * st.v);   // smoothstep, so both ends ease
  }

  // ── THE PUSH JET (Dan, 2026-10-13: "push the file gem up from the bottom
  // like a jet up and out of view in that line, and then the gem settles back
  // down atop the settling down jet") ─────────────────────────────────────
  // One clock for the gem and the jet, so the gem is always the jet's tip: it
  // fires up out of the top of the view, the column holds while it is gone,
  // then the gem comes back down riding the column as it shortens, and the
  // column fades into the stem as the gem lands. `fx.t0` may be in the future
  // (a set's stagger); before it the file rests.
  const JET_RISE = 600, JET_HOLD = 650, JET_SETTLE = 1450;
  const JET_MS = JET_RISE + JET_HOLD + JET_SETTLE;
  function jetOf(fx, now) {
    const el = now - fx.t0;
    if (el < 0) return null;
    if (stillMotion()) return null;
    if (el < JET_RISE) { const t = el / JET_RISE; return { alt: 1 - Math.pow(1 - t, 3), phase: 'rise', el }; }
    if (el < JET_RISE + JET_HOLD) return { alt: 1, phase: 'hold', el };
    const v = Math.min(1, (el - JET_RISE - JET_HOLD) / JET_SETTLE);
    if (v >= 1) return null;
    return { alt: 1 - v * v * (3 - 2 * v), phase: 'settle', el, v };
  }
  function paintJet(ctx, gx, gy, hx, hy, dx, dy, base, dpr, jet, now, look) {
    // a look's push: its colour, and a jet, a thin beam, a soft float, or the file simply rising
    const MP = look && look.motion ? look.motion.push : {};
    if (MP.style === 'none') return;
    if (MP.colour) base = MP.colour;
    const beam = MP.style === 'beam', float = MP.style === 'float';
    // fades out over the last fifth of the settle, so it ends as the stem
    const fade = (jet.phase === 'settle' && jet.v > 0.8 ? (1 - jet.v) / 0.2 : 1) * (float ? 0.45 : 1);
    const hot = mixRgb(base, WHITE, 0.55);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    const g = ctx.createLinearGradient(gx, gy, hx, hy);
    g.addColorStop(0, css(base, 0.05 * fade)); g.addColorStop(0.25, css(base, 0.5 * fade)); g.addColorStop(1, css(hot, 0.9 * fade));
    // a wide soft body and a narrow white-hot core: a glow without blur passes
    ctx.strokeStyle = g; ctx.lineWidth = (beam ? 4 : float ? 16 : 9) * dpr; ctx.globalAlpha = beam ? 0.2 : 0.35;
    ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.globalAlpha = 1; ctx.lineWidth = (beam ? 1.6 : float ? 0.8 : 2.6) * dpr;
    ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(hx, hy); ctx.stroke();
    // thrust: bright parcels running up the column while it climbs and holds
    if (jet.phase !== 'settle' || jet.v < 0.6) {
      const len = Math.hypot(hx - gx, hy - gy);
      ctx.fillStyle = css(WHITE, 0.85 * fade);
      for (let i = 0; i < 4; i++) {
        const p = ((now / (float ? 1100 : beam ? 260 : 420)) + i / 4) % 1;
        const r = (1.1 + 1.2 * (1 - p)) * dpr;
        ctx.beginPath(); ctx.arc(gx + dx * len * p, gy + dy * len * p, r, 0, TAU); ctx.fill();
      }
    }
    // a flash at the root as it fires
    if (jet.phase === 'rise') {
      const k = 1 - jet.el / JET_RISE;
      ctx.fillStyle = css(hot, 0.5 * k);
      ctx.beginPath(); ctx.ellipse(gx, gy, (6 + 10 * (1 - k)) * dpr, (2.5 + 4 * (1 - k)) * dpr, 0, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  // ── THE READ (Dan, 2026-10-13: "let's enhance the animation for when files
  // are read") ───────────────────────────────────────────────────────────
  // A file being read is TAKEN IN, and it never moves: a write lifts the gem
  // under a stream from above, a push jets it up and out, a read leaves it on
  // the ground. A band of light sweeps down over it once, like a page skimmed,
  // and the lines it crosses peel off and slide LEFT, toward the chat the
  // reading goes into, fading before they get far. An answer reads a dozen
  // files a second, so at most READ_THREADS threads fly at once; the rest
  // play the scan alone, a shimmer across the files rather than a blizzard.
  // Parametric, no particle state: each mote is a pure function of its age.
  const READ_RISE = 380, READ_SCAN_MS = 560, READ_THREADS = 3, READ_LIFE = 820;
  // the smallest the scan and the lines ever draw, in CSS px of file size,
  // however far out the camera stands: they are marks on the screen, not the land
  const READ_FLOOR = 11;
  // the lines of a page: each one's length, the last one short like a paragraph's end
  const READ_LINES = [1, 0.8, 0.95, 0.7, 0.45];
  function paintRead(W, ctx, fx, hx, hy, size, base, dpr, now, side) {
    const el = now - fx.t0 - READ_RISE;   // the file rises first (raiseOf)
    if (el < 0 || stillMotion()) return;
    // a look's read: its colour, and a skim (the page scanned), a glow, a ripple, or nothing
    const MR = ((lookOf(W) || {}).motion || {}).read || {};
    if (MR.style === 'none') return;
    if (MR.colour) base = MR.colour;
    const hot = mixRgb(base, WHITE, 0.6);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (MR.style === 'glow' || MR.style === 'ripple') {
      const t = Math.min(1, el / (READ_SCAN_MS + READ_LIFE)), a = Math.sin(Math.PI * t);
      if (MR.style === 'glow') {
        const R = size * (1.6 + 1.4 * t), gl = ctx.createRadialGradient(hx, hy, 0, hx, hy, R);
        gl.addColorStop(0, css(hot, 0.55 * a)); gl.addColorStop(1, css(base, 0));
        ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(hx, hy, R, 0, TAU); ctx.fill();
      } else for (let k = 0; k < 3; k++) {
        const u = t * 1.4 - k * 0.2; if (u <= 0 || u >= 1) continue;
        ctx.strokeStyle = css(hot, (1 - u) * 0.8); ctx.lineWidth = Math.max(0.8, 1.6 * (1 - u)) * dpr;
        ctx.beginPath(); ctx.ellipse(hx, hy, size * (0.6 + 2.4 * u), size * (0.3 + 1.2 * u), 0, 0, TAU); ctx.stroke();
      }
      ctx.restore();
      return;
    }
    if (el < READ_SCAN_MS) {
      const t = el / READ_SCAN_MS, h = size * 1.8, w = size * 2.4;
      const y = hy - h + 2 * h * t, a = Math.sin(Math.PI * t);
      // the lit page behind the band: a soft wash from the top down to it
      const wash = ctx.createLinearGradient(hx, hy - h, hx, y);
      wash.addColorStop(0, css(base, 0)); wash.addColorStop(1, css(base, 0.28 * a));
      ctx.fillStyle = wash; ctx.fillRect(hx - w * 0.7, hy - h, w * 1.4, y - (hy - h));
      const g = ctx.createLinearGradient(hx - w, y, hx + w, y);
      g.addColorStop(0, css(hot, 0)); g.addColorStop(0.5, css(WHITE, a)); g.addColorStop(1, css(hot, 0));
      ctx.strokeStyle = g; ctx.lineCap = 'round';
      ctx.lineWidth = 6 * dpr; ctx.globalAlpha = 0.4;
      ctx.beginPath(); ctx.moveTo(hx - w, y); ctx.lineTo(hx + w, y); ctx.stroke();
      ctx.lineWidth = 1.8 * dpr; ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.moveTo(hx - w, y); ctx.lineTo(hx + w, y); ctx.stroke();
    }
    // whether this read gets a thread is decided once, on its first frame
    if (fx.thread == null) {
      let n = 0;
      for (const f of W.fx.values()) if (f !== fx && f.kind === 'skim' && f.thread && now - f.t0 < f.ms) n++;
      fx.thread = n < READ_THREADS;
    }
    if (fx.thread) {
      // THE PAGE'S LINES, PULLED INTO THE CHAT (Dan, 2026-10-13: the round
      // motes "look like a sweat animation"). As the scan crosses each line of
      // the file, that line peels off as a short level dash and slides LEFT,
      // toward the chat: slow, then quick, stretching thin and fading. Flat,
      // level and in page order, where sweat is round, falling and random.
      const h = size * 1.8, D = (side ? 80 : 130) * dpr;
      const n = side ? 4 : READ_LINES.length;
      ctx.lineCap = 'round';
      for (let i = 0; i < n; i++) {
        const row = n > 1 ? i / (n - 1) : 0.5;
        const y = hy - h * 0.62 + row * h * 1.24;
        const at = ((y - (hy - h)) / (2 * h)) * READ_SCAN_MS;   // when the band reaches it
        const p = (el - at) / READ_LIFE;
        if (p <= 0 || p >= 1) continue;
        const go = p * p * (0.4 + 0.6 * p);                      // slow off the page, quick away
        const head = hx - size * 0.5 - go * D;
        const len = size * 1.4 * READ_LINES[i % READ_LINES.length] * (1 + 2.2 * p);
        const a = Math.min(1, p * 8) * Math.pow(1 - p, 1.3);
        const g = ctx.createLinearGradient(head, y, head + len, y);
        g.addColorStop(0, css(WHITE, a)); g.addColorStop(0.35, css(hot, 0.85 * a)); g.addColorStop(1, css(base, 0));
        ctx.strokeStyle = g;
        ctx.lineWidth = Math.max(0.6 * dpr, (side ? 1.3 : 1.8) * (1 - 0.6 * p) * dpr);
        ctx.beginPath(); ctx.moveTo(head, y); ctx.lineTo(head + len, y); ctx.stroke();
      }
    }
    ctx.restore();
  }

  // Every facing file is painted as its family's object, standing on a stem
  // leaned toward screen-up in proportion to how face-on it is (a stem along
  // the normal points straight at the viewer and vanishes in the middle).
  function paintFile(W, ctx, d, r, col, alpha, info) {
    const file = d.n && d.n.file;
    if (!W || !file) return false;
    const g = W.g;
    const zoom = g ? g.userZoom : 1, now = performance.now();
    const fx = W.fx ? W.fx.get(d.n.id) : null;
    const fxT = fx ? (now - fx.t0) / fx.ms : 1;
    if (fx && fxT >= 1 && !fx.hold) W.fx.delete(d.n.id);
    // how far this file has risen to be written, 0 resting to 1 lifted
    // a read rises too (Dan, 2026-10-13: "the files should rise up and
    // enlarge ... they are so small at default globe view size"), once the
    // camera has landed on it (fx.t0), and settles as its thread fades
    const up = raiseOf(W, d.n.id, !!(fx && ((fx.kind === 'write' && (fx.hold || fxT < 1)) || (fx.kind === 'skim' && fxT >= 0 && fxT < 0.8))), now);
    // where this chat has worked in the last three minutes (D.2's afterstate), 1 just now to 0
    const recent = W.recentOf ? W.recentOf(file.path) : 0;
    const active = !!(fx && (fxT < 1 || fx.hold)) || recent > 0;
    const sel = !!(g && g.selected === d.n.id);
    const lod = window.RepoPolicy ? window.RepoPolicy.fileLod({ size: W.size, zoom, landmark: !!file.landmark, selected: sel, near: !!(W.lens && W.lens.near.has(file.path)), active, folded: file.folded }) : 'light';
    // a settlement's quiet files wait until you come close
    if (lod === 'hidden') { d.x = -1e6; d.y = -1e6; return true; }
    const dpr = info.dpr || 1;
    // THE SIDEBAR IS AN ORIENTATION WINDOW: an ordinary file there is a faint
    // speck on its land, texture rather than an object
    if (lod === 'speck') {
      const base = rgbOf(col);
      d.x = d.gx; d.y = d.gy - dpr;
      ctx.save(); ctx.shadowBlur = 0; ctx.globalAlpha = alpha * lensFade(W, file) * 0.6;
      ctx.fillStyle = css(mixRgb(base, WHITE, 0.25)); ctx.beginPath(); ctx.arc(d.x, d.y, Math.max(0.8 * dpr, r * 0.42), 0, TAU); ctx.fill();
      ctx.restore();
      if (fx && fx.kind === 'skim') paintRead(W, ctx, fx, d.x, d.y, Math.max(r * 1.6, READ_FLOOR * dpr), base, dpr, now, true);
      W.pos.set(d.n.id, { x: d.x, y: d.y, facing: d.f == null ? 1 : d.f, frame: W.frame || 0 });
      return true;
    }
    const vx = d.x - d.gx, vy = d.y - d.gy, len = Math.hypot(vx, vy);
    const full = info.R * 0.9 * (g ? g.o.tall : 0.07) * (d.n.depth || 0.6) * 1.15;
    const w = Math.pow(clamp01(d.f == null ? 1 : d.f), 1.3);
    let dx = len > 0.5 ? (vx / len) * (1 - w) : 0, dy = len > 0.5 ? (vy / len) * (1 - w) - w : -1;
    const m = Math.hypot(dx, dy) || 1; dx /= m; dy /= m;
    // a look's stem: a pin, a short one, or the file sitting on its ground
    const LKs = lookOf(W), stemK = !LKs ? 1 : LKs.stem === 'short' ? 0.45 : LKs.stem === 'none' ? 0.08 : 1, sizeK = LKs ? LKs.size : 1;
    const L0 = Math.max(len, full * 0.62) * stemK * (1 + 0.85 * up);
    // a pushed file rides its jet up out of view and back down (jetOf below)
    const jet = fx && fx.kind === 'send' ? jetOf(fx, now) : null;
    let L = L0;
    if (jet) {
      const gy0 = d.gy + dy * L0;
      // far enough along the stem's line that the gem clears the top edge
      const reach = dy < -0.2 ? (gy0 + 60 * dpr) / -dy : ctx.canvas.height;
      L = L0 + jet.alt * Math.min(ctx.canvas.height * 1.6, Math.max(0, reach));
    }
    const hx = d.gx + dx * L, hy = d.gy + dy * L;
    d.x = hx; d.y = hy;
    const base = rgbOf(col);
    const LK = lookOf(W), FN = LK ? LK.finish : FINISH.gloss;
    const c = { hi: mixRgb(base, WHITE, FN.hi), mid: base, lo: mixRgb(base, INK, FN.lo), accent: [255, 196, 107] };
    const formName = LK ? LK.L.forms[file.family] : null;
    if (file.family === 'md' && (!formName || formName === 'tablet')) { c.hi = [255, 246, 224]; c.mid = mixRgb(base, [236, 217, 176], 0.5); c.lo = mixRgb(base, [150, 120, 80], 0.5); }
    if (LK) {
      c.flame = LK.lightCol; c.metal = LK.metal; c.themed = true;
      c.rope = rgbOf(W.style.route); c.trim = mixRgb(LK.metal, INK, 0.3); c.ink = rgbOf(W.style.ink);
      // a look's tempo: each file breathes on its own phase, at whatever rate
      // the globe is already drawing (it never asks for a frame of its own)
      c.breath = LK.tempo ? 0.72 + 0.28 * Math.sin(now * LK.tempo * TAU + (hash(file.path) % 628) / 100) : 1;
    }
    GLINT = FN.glint;
    // objects grow as you come closer, so up close a file is a thing and not a speck
    const near = Math.min(2.4, 0.55 + 0.5 * (g ? g.userZoom : 1));
    // a read swells further than a write (Dan, 2026-10-13: "the globe size is
    // zoomed quite a bit out so it's hard to see"), so the page it is read
    // from can be seen from the resting distance
    const swell = 1 + (fx && fx.kind === 'skim' ? 1.4 : 0.55) * up;
    const s = sizeK * Math.max(3.2 * dpr, r * 1.8) * near * (file.landmark ? 1.25 : 1) * lensGrow(W, file) * swell;
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = alpha * lensFade(W, file);
    // its own small pool of light on the ground, so an island reads as lit
    // the pool is only ever drawn in the full view (its alpha is 0 in the
    // sidebar), and rests while the globe turns: a wide gradient per file
    if (W.size === 'full' && !W.moving) {
      ctx.save(); ctx.translate(d.gx, d.gy); ctx.scale(1, 0.55);
      const pool = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 5.5); pool.addColorStop(0, css(base, 0.12)); pool.addColorStop(1, css(base, 0));
      ctx.fillStyle = pool; ctx.beginPath(); ctx.arc(0, 0, s * 5.5, 0, TAU); ctx.fill(); ctx.restore();
    }
    ctx.fillStyle = 'rgba(0,0,16,.35)'; ctx.beginPath(); ctx.ellipse(d.gx, d.gy + dpr, s * 0.8, s * 0.3, 0, 0, TAU); ctx.fill();
    const side = W.size !== 'full';
    if (jet) paintJet(ctx, d.gx, d.gy, hx, hy, dx, dy, base, dpr, jet, now, lookOf(W));
    // the sparks: a trickle while the agent is writing, a fountain when it
    // goes quiet (the flare), a bigger one for a birth
    if (fx && (fx.kind === 'write' || fx.kind === 'born')) {
      const floor = Math.max(4 * dpr, d.gy - hy), few = side ? 0.4 : 1;
      // a look's motion: each event's style and colour, and how much of it there is
      const MO = LK && LK.motion, amt = MO ? MO.amount : 1;
      if (fx.hold) {
        // while it writes, the stream pours onto it from space
        const wr = MO ? MO.write : {};
        if (wr.style !== 'none' && up > 0.6 && (!fx.drip || now - fx.drip > (side ? 40 : 14) / amt)) { fx.drip = now; pourDrop(W, d.n.id, hy, floor, wr.colour || base, dpr, file.family); }
      } else if (!fx.burst && fxT < 1) {
        fx.burst = true;
        const ev = fx.kind === 'born' ? 'birth' : 'finish', bu = MO ? MO[ev] : {};
        const code = (BURST[bu.style] || 0) + (ev === 'birth' ? 4 : 0);
        if (bu.style !== 'none') emitSparks(W, d.n.id, Math.max(1, Math.round((fx.kind === 'born' ? 54 : 30) * few * amt * (bu.style === 'stars' ? 0.35 : 1))), floor, bu.colour || base, dpr, side ? 0.6 : 1, file.family, code);
      }
    }
    // a look may stand another form in a landmark's place, or none (it is then an ordinary file)
    const markKind = !file.landmark ? null : !LK ? file.landmark : (LK.L.landmarks[MARK_PLACE[file.landmark]] || file.landmark);
    const ownMark = LK && markKind && LK.shapes[markKind];
    if (ownMark || (markKind && markKind !== 'none' && MARKS[markKind])) {
      // the agent's own landmark stands on its ground, as tall as the place it takes
      if (ownMark) { const hh = Math.max(s * 1.6, (d.gy - hy) * 0.6); drawShape(ctx, ownMark, d.gx, d.gy - hh, hh, c); }
      else MARKS[markKind](ctx, d.gx, d.gy, hx, hy, side ? s * 0.85 : s, c);
      if (recent > 0) afterglow(ctx, hx, hy, s * 0.8, base, recent, side, dpr);
    } else {
      // AN ORDINARY FILE IS A SIMPLE LIGHT, the way a note is on the vault
      // globe: a stem, a small bright disc in its family's hue, a soft glow.
      // Its family's own form arrives only when you have come close enough
      // to want it, and never in the sidebar.
      if (stemK > 0.1) {
      const sg = ctx.createLinearGradient(d.gx, d.gy, hx, hy); sg.addColorStop(0, css(base, 0.05)); sg.addColorStop(1, css(base, 0.55));
      ctx.strokeStyle = sg; ctx.lineWidth = Math.max(1, 0.8 * dpr); ctx.beginPath(); ctx.moveTo(d.gx, d.gy); ctx.lineTo(hx, hy); ctx.stroke();
      }
      // a birth grows the gem out of its district (the core's own birth flare
      // and spectacle play over it)
      const grow = fx && fx.kind === 'born' ? Math.min(1, Math.max(0.05, fxT * 2.4)) : 1;
      const rr = Math.max((side ? 1.5 : 2.3) * dpr, r * (side ? 0.95 : 1.45)) * lensGrow(W, file) * grow * swell * sizeK;
      // a flame form glows in its light's colour, taller than wide, and breathes
      const flame = !!(formName && FLAME_FORMS.has(formName));
      // a look's presence: hushed files let only the flames glow, bright ones shine
      const hush = LK && !flame ? LK.presence : 1;
      const glc = flame ? mixRgb(base, c.flame, 0.6) : base, ga = (side ? 0.4 : 0.3) * (flame ? 1.25 * c.breath : 1) * hush;
      const gl = ctx.createRadialGradient(hx, hy, 0, hx, hy, rr * 3); gl.addColorStop(0, css(glc, ga)); gl.addColorStop(1, css(glc, 0));
      ctx.fillStyle = gl; ctx.beginPath();
      if (flame) ctx.ellipse(hx, hy - rr * 0.6, rr * 2.3, rr * 3.3, 0, 0, TAU); else ctx.arc(hx, hy, rr * 3, 0, TAU);
      ctx.fill();
      // the full view resolves every file into its gemstone as soon as the
      // world is near enough to hold it; the sidebar keeps the plain light
      // An ordinary file waits until you come in past the full view's resting
      // zoom (at most 1.3) before it turns to a gemstone. It used to start at
      // 0.75, so at rest every file drew both its light and its gemstone,
      // cross-fading. What is held, happening, or on the course turns early.
      const early = sel || active || !!(W.lens && W.lens.near.has(file.path));
      const formA = lod === 'gem' ? clamp01((zoom - (early ? 0.75 : LK ? 0.95 : 1.35)) / 0.45) : 0;
      if (formA < 1) {
        ctx.save(); ctx.globalAlpha *= (1 - formA) * (hush < 1 ? 0.7 : 1);
        const dg = ctx.createRadialGradient(hx - rr * 0.35, hy - rr * 0.35, 0, hx, hy, rr); dg.addColorStop(0, css(c.hi)); dg.addColorStop(1, css(base));
        ctx.fillStyle = dg; ctx.beginPath(); ctx.arc(hx, hy, rr, 0, TAU); ctx.fill();
        ctx.restore();
      }
      if (formA > 0) {
        ctx.save(); ctx.globalAlpha *= formA;
        // small from orbit, a real object on approach
        const gs = rr * Math.min(2.5, 0.95 + 0.95 * Math.max(0, zoom - 1));
        const own = LK && formName && LK.shapes[formName];
        if (own) drawShape(ctx, own, hx, hy, gs * 0.8, c);
        else ((formName && FORM_BY_NAME[formName]) || FORMS[file.family] || FORMS.other)(ctx, hx, hy, gs, c);
        ctx.restore();
      }
      if (fx && fx.kind !== 'skim' && (fxT < 1 || fx.hold)) material(ctx, file.family, fx, fxT, hx, hy, rr, base, c, dpr, now);
      if (recent > 0) afterglow(ctx, hx, hy, rr, base, recent, side, dpr);
    }
    if (fx && fx.kind === 'skim') paintRead(W, ctx, fx, hx, hy, Math.max(s, READ_FLOOR * dpr), base, dpr, now, side);
    if (g && g.selected === d.n.id) {
      ctx.strokeStyle = css(mixRgb(base, WHITE, 0.6), 0.9); ctx.lineWidth = Math.max(1, 1.3 * dpr);
      ctx.beginPath(); ctx.arc(hx, hy, s * 2.1, 0, TAU); ctx.stroke();
    }
    ctx.restore();
    GLINT = 1;
    W.pos.set(d.n.id, { x: hx, y: hy, facing: d.f == null ? 1 : d.f, frame: W.frame || 0 });
    return true;
  }

  window.RepoDraw = { mountWorld, paintFile, FORMS, FORM_BY_NAME, FAMILY_WORDS, MARK_WORDS,
    util: { el, norm3, dot3, ang, clamp01, hash, rng, frameAt, onCap, rgbOf, mixRgb, css, token, nowStamp } };
})();
