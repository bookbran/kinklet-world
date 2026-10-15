// @astrolabe-premium
// repo-viewer.js: a repository's public world, standalone (publish-repo-world B.2, B.3).
//
// The page a stranger opens. It reads ONE file, repo-world.json (the public
// model repo-public.js builds, astrolabe-repo-world/1), and draws it with the
// app's own renderer: the core globe (globe.js), the repository painter
// (repo-draw.js, repo-policy.js) and the node-art engine (course-art.js). It
// is the slim cousin of repo-world.js's mountShared: the same look pinning
// (sharedTokens, paintShared) and the same entrance, without the app around
// it. No server, no member, no chat, no board door to open, no course, no
// collaborator control: nothing here asks anything of anyone but the file.
//
// What a public model never carries (names, paths, headings, a withheld title
// or reading) this page never restores. A withheld title or reading leaves a
// deliberate caption behind, never a gap: the look's name, else "A project's
// world" (caption()).
//
// ALIVE (B.3): the world replays its own motion on its own files, the read,
// the write with its finish burst, a birth and a push, the way it plays while
// someone works (repo-world.js fx), unhurried, one thing on a file at a time
// (Motion). Reduced motion holds it still; a phone gets a lighter cadence.
//
// THE JOURNEY (G.2, Dan: "the public globe gently touring its own islands and
// ending on the invitation"): once, after the entrance, the camera visits each
// island in the order the globe itself lays them out (by bearing around the
// entry, never by a path, a course or a tracker), then rests on the whole
// world, and the invitation to get in touch (G.1) comes forward when there is
// one. A visitor's first touch, scroll or key ends it and the camera is
// theirs; reduced motion skips the flight; a hidden tab holds its place.
(function (root) {
  'use strict';
  const MODEL_FILE = 'repo-world.json';
  const SCHEMA = 'astrolabe-repo-world/1';
  // what a /2 look draws when a term is left unsaid (space-manifest.js LOOK_DEFAULTS)
  const LOOK_DEFAULTS = {
    reading: null, sky: null,
    light: { from: 'upper-left', colour: '#ffffff', key: 'soft', vignette: 0 },
    material: 'luminous',
    coast: { character: 'natural', contours: 'dotted', glow: 1, shallows: 'wide', islets: 'none' },
    landmarks: { entry: 'spire', front: 'lighthouse', memory: 'lantern' },
    files: { size: 'medium', stem: 'pin', presence: 'present' },
    forms: { src: 'crystal', md: 'tablet', test: 'seed', cfg: 'slate', ui: 'drop', data: 'cairn', other: 'moonstone' },
    finish: 'gloss', ground: { kind: 'light', colour: null }, tempo: 'still',
    type: { face: 'mono', case: 'as-is', colour: null }, threads: null,
    motion: { read: { style: 'skim', colour: null }, write: { style: 'wand', colour: null }, finish: { style: 'fountain', colour: null, particle: null }, birth: { style: 'fountain', colour: null, particle: null }, push: { style: 'jet', colour: null }, amount: 'normal' },
    shapes: {}, extra: {}, history: [],
  };
  // Midnight, the recipe's own colours, for anything a model leaves unsaid
  const MIDNIGHT = { atmosphere: 'night', sea: '#0b0d2a', ink: '#e9e6f5', route: '#e9c46a',
    land: { src: '#34507a', ui: '#6e4058', md: '#6f5e40', data: '#6b5530', test: '#285a58', cfg: '#40445a', other: '#464856', board: '#4f3d4f' },
    rim: { src: '#8fb4ff', ui: '#ffb3c8', md: '#ffe3ae', data: '#ffd27a', test: '#8ff0df', cfg: '#b9c0dc', other: '#cdd2e2', board: '#ffc9a8' },
    gems: { md: '#ecd9b0', src: '#7ea6ff', test: '#5fe0c8', cfg: '#9aa1bd', ui: '#ff8fb0', data: '#f2c464', other: '#c9cedd' } };
  const FACES = { mono: 'ui-monospace, "JetBrains Mono", Consolas, monospace', sans: 'Inter, system-ui, sans-serif', serif: 'Georgia, "Iowan Old Style", serif', display: '"Playfair Display", Georgia, serif' };
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const isObj = (o) => !!o && typeof o === 'object' && !Array.isArray(o);
  const merge = (base, over) => { const out = clone(base); if (!isObj(over)) return out; for (const [k, v] of Object.entries(over)) out[k] = isObj(v) && isObj(out[k]) ? merge(out[k], v) : clone(v); return out; };
  const hexRgb = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(h || '')); const n = m ? parseInt(m[1], 16) : 0; return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const hexA = (h, a) => { const [r, g, b] = hexRgb(h); return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')'; };
  const hexMix = (a, b, t) => { const x = hexRgb(a), y = hexRgb(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join(''); };

  // ── the public model, in the shape the app's painter reads ───────────────
  // Every name the painter would print is empty: an island shows only the
  // label its member gave it, a district and a file show nothing. Seeds are
  // the model's own positions, never a path.
  function adapt(model) {
    if (!model || model.schema !== SCHEMA) throw new Error('not a public world (' + MODEL_FILE + ')');
    const keyOf = (i) => 'i' + i;
    const count = new Map();
    for (const f of model.files || []) count.set(f.island, (count.get(f.island) || 0) + 1);
    const islands = (model.islands || []).map((I, i) => ({
      key: I.board ? '~board' : keyOf(i), name: I.label || '', label: I.label || null, home: !!I.home, board: !!I.board,
      family: I.family || 'other', count: count.get(i) || 0, c: I.c, r: I.r, coast: I.coast || [], islets: I.islets || [],
      districts: (I.districts || []).map((d, j) => ({ key: keyOf(i) + '/' + j, name: '', c: d.c, r: d.r, coast: d.coast || [], settled: !!d.settled, count: 0 })),
    }));
    const files = (model.files || []).map((f, i) => ({
      id: 'f' + i, path: 'f' + i, name: '', heading: null, family: f.family || 'other',
      island: islands[f.island] ? islands[f.island].key : null, district: null,
      at: f.at, depth: f.depth == null ? 0.7 : f.depth, landmark: f.landmark || null, folded: !!f.folded,
    }));
    const world = { repo: 'a-public-world', head: '', count: files.length, islands, files, threads: [],
      board: model.board && model.board.at ? { at: model.board.at, front: model.board.front, island: '~board' } : null };
    const L = model.look || {};
    const style = {
      name: L.name || null, atmosphere: L.atmosphere === 'day' ? 'day' : 'night',
      sea: L.sea || MIDNIGHT.sea, ink: L.ink || MIDNIGHT.ink, route: L.route || MIDNIGHT.route,
      land: Object.assign({}, MIDNIGHT.land, L.land), rim: Object.assign({}, MIDNIGHT.rim, L.rim), gems: Object.assign({}, MIDNIGHT.gems, L.gems),
      // a /2 look is the one with its terms; a /1 world draws as it always did
      look: L.light ? merge(LOOK_DEFAULTS, { reading: L.reading || null, sky: L.sky || null, threads: L.threads || null, light: L.light, material: L.material, coast: L.coast,
        landmarks: L.landmarks, files: L.files, forms: L.forms, finish: L.finish, ground: L.ground, tempo: L.tempo, type: L.type, motion: L.motion, shapes: L.shapes || {} }) : null,
    };
    if (style.look) for (const k of Object.keys(style.look)) if (style.look[k] == null && LOOK_DEFAULTS[k] != null) style.look[k] = clone(LOOK_DEFAULTS[k]);
    const art = (a) => (a && a.spec ? { current: 1, versions: [{ v: 1, reading: a.reading || null, spec: a.spec }] } : null);
    const focus = model.entry && model.entry.focus ? model.entry.focus : null;
    // the invitation only as an https link or a mailto with its line, or not at all (no dead button)
    const inv = model.invite;
    const invite = inv && typeof inv.line === 'string' && inv.line.trim() && typeof inv.href === 'string' && /^(https:\/\/[^\s"'<>]+|mailto:[^\s"'<>@]+@[^\s"'<>]+)$/.test(inv.href)
      ? { line: inv.line.trim(), href: inv.href } : null;
    return { world, style, boardArt: art(model.board && model.board.art), landmarks: (model.landmarks || []).map((l) => ({ at: l.at, art: art(l.art) })), focus, invite };
  }

  // ── the caption: what the model says, and a deliberate line where it is silent
  function caption(model) {
    const L = (model && model.look) || {};
    const title = typeof model.title === 'string' && model.title.trim() ? model.title.trim() : null;
    const look = typeof L.name === 'string' && L.name.trim() ? L.name.trim() : null;
    const reading = typeof L.reading === 'string' && L.reading.trim() ? L.reading.trim() : null;
    if (title) return { head: title, sub: look ? 'In ' + look : 'A project’s world', reading, from: 'title' };
    if (look) return { head: look, sub: 'A project’s world', reading, from: 'look' };
    return { head: 'A project’s world', sub: 'Made with Astrolabe', reading, from: 'none' };
  }

  // ── the look, pinned on the page (repo-world.js sharedTokens, slimmed) ───
  function tokens(s) {
    const day = s.atmosphere === 'day', ink = s.ink, route = s.route;
    const low = !day && s.look && s.look.light.key === 'low';
    const t = {
      '--globe-core': hexA(low ? hexMix(s.sea, s.look.sky || s.sea, 0.5) : hexMix(s.sea, day ? '#ffffff' : ink, day ? 0.35 : 0.1), 0.92),
      '--globe-mid': hexA(s.sea, 0.9),
      '--globe-edge': hexA(hexMix(s.sea, day ? ink : '#000000', day ? 0.18 : 0.35), 0.92),
      '--globe-rim': hexA(route, low ? 0.12 : 0.35), '--globe-limb': hexA(route, low ? 0.12 : 0.35), '--globe-limb-warm': hexA(route, low ? 0.12 : 0.35), '--globe-limb-deep': hexA(route, low ? 0.12 : 0.35),
      '--globe-marble': '0', '--globe-vein': 'transparent', '--globe-shadow': 'transparent', '--globe-rings': 'transparent',
      '--coast': hexA(ink, 0.2), '--coast-on': hexA(ink, 0.62), '--coast-fill': hexA(ink, 0.05), '--coast-glow': '1',
      '--land-cap': ink, '--land-cap-on': ink, '--land-lab': ink, '--land-lab-on': ink,
      '--ink': ink, '--ink-2': hexA(ink, 0.8), '--ink-3': hexA(ink, 0.6), '--pen': route, '--rule': hexA(ink, 0.15), '--ember': route,
      '--paper': s.sea, '--paper-up': hexMix(s.sea, ink, 0.12),
      '--pip': hexA(ink, 0.92), '--landmark': hexA(ink, 0.92),
      '--node-stroke': 'transparent', '--node-stroke-w': '0', '--node-bloom': '0',
      '--data': FACES.mono, '--body': FACES.sans,
      // the page's own: the caption wears the look's type
      '--world-face': FACES[(s.look && s.look.type.face) || 'mono'] || FACES.mono,
      '--world-type': (s.look && s.look.type.colour) || ink,
      '--world-glass': hexA(hexMix(s.sea, ink, 0.08), 0.72),
      '--world-sky': s.look && s.look.sky
        ? 'radial-gradient(ellipse at 45% 40%, ' + s.look.sky + ', ' + hexMix(s.look.sky, '#000000', day ? 0.15 : 0.7) + ')'
        : 'radial-gradient(ellipse at 45% 40%, ' + hexMix(s.sea, ink, day ? 0.04 : 0.08) + ', ' + hexMix(s.sea, '#000000', day ? 0.06 : 0.3) + ')',
    };
    for (let i = 1; i <= 8; i++) t['--land-' + i] = s.land.other;
    for (const [fam, col] of Object.entries(s.gems)) t['--repo-' + fam] = col;
    // a look's room light: a low key's warm pool and its vignette, one layer over the canvas
    const lk = s.look;
    const pool = lk && lk.light.key === 'low' ? 'radial-gradient(ellipse 34% 30% at 50% 52%, ' + hexA(lk.light.colour, 0.16) + ', ' + hexA(lk.light.colour, 0) + ')' : null;
    const vig = lk && lk.light.vignette > 0 ? 'radial-gradient(ellipse 72% 70% at 50% 52%, rgba(0,0,0,0) 38%, rgba(0,0,0,' + (0.92 * lk.light.vignette).toFixed(2) + ') 100%)' : null;
    t['--world-room'] = [pool, vig].filter(Boolean).join(', ') || 'none';
    return t;
  }

  // ── ALIVE: the world's own motion, replayed (B.3) ─────────────────────────
  // Durations are the app's (repo-world.js FX_MS, WORK_IDLE_MS, the push's
  // stagger); a file is busy from its start to its end plus a breath, and
  // nothing new starts on a busy file. One thing at a time across the world:
  // a stranger watches one event land, then the next.
  const FX_MS = { skim: 1900, write: 1100, born: 2400, send: 2700 };
  const WORK_IDLE_MS = 2600, PUSH_SPREAD_MS = 900, BREATH_MS = 600;
  const KINDS = ['read', 'write', 'read', 'birth', 'write', 'push'];
  function Motion(o) {
    const files = o.files || [];
    const rand = o.rand || Math.random;
    const gap = o.phone ? [9000, 14000] : [3600, 6400];
    const busy = new Map();
    const focus = o.focus || null;
    // the files a camera resting on the entry can see, else all of them
    const near = focus ? files.filter((f) => f.at && f.at.x * focus.x + f.at.y * focus.y + f.at.z * focus.z > 0.55) : [];
    const pool = near.length >= 3 ? near : files;
    let next = o.reduced || !pool.length ? Infinity : (o.start || 0) + (o.phone ? 4000 : 2200);
    let kindAt = 0, until = 0;
    const free = (now) => pool.filter((f) => !(busy.get(f.id) > now));
    const pick = (list) => list[Math.floor(rand() * list.length) % list.length];
    function tick(now) {
      if (now < next || now < until) return [];
      const kind = KINDS[kindAt++ % KINDS.length];
      const open = free(now);
      if (!open.length) { next = now + 1000; return []; }
      let ids, ms;
      if (kind === 'push') {
        const n = Math.min(open.length, 1 + Math.floor(rand() * 3));
        const set = new Set();
        while (set.size < n) set.add(pick(open).id);
        ids = [...set];
        ms = FX_MS.send + (ids.length > 1 ? PUSH_SPREAD_MS : 0);
      } else {
        ids = [pick(open).id];
        ms = kind === 'read' ? FX_MS.skim : kind === 'write' ? WORK_IDLE_MS + FX_MS.write : FX_MS.born;
      }
      for (const id of ids) busy.set(id, now + ms + BREATH_MS);
      until = now + ms;
      next = now + ms + gap[0] + rand() * (gap[1] - gap[0]);
      return [{ kind, ids, at: now, ms }];
    }
    return { tick, busy, pool, get next() { return next; }, still: next === Infinity };
  }
  // ── the journey (G.2) ─────────────────────────────────────────────────────
  // The islands a stranger tours, in the globe's own order: by bearing around
  // the entry (clockwise from the top of the view), ties by position, so the
  // order is a fact of the geometry and never of a name, a path or a course.
  function tourStops(islands, focus) {
    const f = focus || { x: 0, y: 0, z: 1 };
    const up0 = Math.abs(f.y) > 0.95 ? { x: 0, y: 0, z: 1 } : { x: 0, y: 1, z: 0 };
    const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
    const sub = (a, k, b) => ({ x: a.x - k * b.x, y: a.y - k * b.y, z: a.z - k * b.z });
    const norm = (v) => { const l = Math.hypot(v.x, v.y, v.z) || 1; return { x: v.x / l, y: v.y / l, z: v.z / l }; };
    const up = norm(sub(up0, dot(up0, f), f));
    const right = norm({ x: up.y * f.z - up.z * f.y, y: up.z * f.x - up.x * f.z, z: up.x * f.y - up.y * f.x });
    const list = (islands || []).filter((I) => I && !I.board && I.c && (I.count == null || I.count > 0)).map((I) => {
      let b = Math.atan2(dot(I.c, right), dot(I.c, up));
      if (b < 0) b += Math.PI * 2;
      return { c: I.c, bearing: b };
    });
    return list.sort((a, b) => a.bearing - b.bearing || a.c.x - b.c.x || a.c.y - b.c.y || a.c.z - b.c.z).map((s) => ({ c: s.c }));
  }
  // One pass: wait out the entrance, then each stop for `dwell`, then the end.
  // At most one step per tick, and after a visit the next waits a full dwell
  // from now, so a tab coming back never races through what it missed; time
  // spent hidden does not count. `cancel` ends it at once (a visitor's hand).
  function Tour(o) {
    const stops = o.stops || [];
    const invite = !!o.invite;
    let nextAt = (o.start || 0) + (o.lead == null ? 3200 : o.lead);
    let i = 0, done = false, cancelled = false, pausedAt = null;
    const immediate = !!o.reduced || !stops.length;
    function tick(now, hidden) {
      if (done) return [];
      if (hidden) { if (pausedAt == null) pausedAt = now; return []; }
      if (pausedAt != null) { nextAt += now - pausedAt; pausedAt = null; }
      if (immediate) { done = true; return [{ kind: 'end', invite, still: !!o.reduced, at: now }]; }
      if (now < nextAt) return [];
      if (i < stops.length) { const s = stops[i++]; nextAt = now + (o.dwell || 4200); return [{ kind: 'visit', index: i - 1, c: s.c, at: now }]; }
      done = true;
      return [{ kind: 'end', invite, at: now }];
    }
    function cancel(now) {
      if (done) return [];
      done = true; cancelled = true;
      return [{ kind: 'end', invite, cancelled: true, at: now || 0 }];
    }
    return { tick, cancel, stops, get done() { return done; }, get cancelled() { return cancelled; }, get visited() { return i; } };
  }

  // one replayed event, played the way repo-world.js fx plays a live one
  function play(view, W, p, later) {
    const t0 = p.at, nodes = W.nodes || [];
    if (p.kind === 'read') { for (const id of p.ids) W.fx.set(id, { kind: 'skim', t0, ms: FX_MS.skim }); return; }
    if (p.kind === 'write') {
      const id = p.ids[0];
      if (view.writing) view.writing(id);
      W.fx.set(id, { kind: 'write', t0, ms: FX_MS.write, hold: true });
      later(() => {
        if (view.writing) view.writing(null);
        if (view.pulse) view.pulse(id);
        W.fx.set(id, { kind: 'write', t0: t0 + WORK_IDLE_MS, ms: FX_MS.write });
      }, WORK_IDLE_MS);
      return;
    }
    if (p.kind === 'birth') {
      const id = p.ids[0], node = nodes.find((n) => n.id === id);
      if (node && view.forget && view.born) { view.forget(id); view.born(node, node.at, {}); }
      W.fx.set(id, { kind: 'born', t0, ms: FX_MS.born });
      return;
    }
    if (p.kind === 'push') {
      const step = p.ids.length > 1 ? PUSH_SPREAD_MS / (p.ids.length - 1) : 0;
      p.ids.forEach((id, i) => W.fx.set(id, { kind: 'send', t0: t0 + i * step, ms: FX_MS.send }));
      W.jetUntil = Math.max(W.jetUntil || 0, t0 + FX_MS.send + PUSH_SPREAD_MS + 100);
    }
  }

  // ── the mount ─────────────────────────────────────────────────────────────
  function mount(model, env) {
    const doc = env.document, win = env.window || root;
    const media = (q) => !!(win.matchMedia && win.matchMedia(q).matches);
    const reduced = media('(prefers-reduced-motion: reduce)');
    const phone = media('(max-width: 700px)') || media('(pointer: coarse)');
    const a = adapt(model);
    const cap = caption(model);
    // the look on the page: tokens on the root, the caption in the look's type
    const pinned = tokens(a.style);
    const rootEl = doc.documentElement;
    for (const [k, v] of Object.entries(pinned)) rootEl.style.setProperty(k, v);
    rootEl.dataset.atmosphere = a.style.atmosphere;
    if (a.style.look && a.style.look.type.case !== 'as-is') rootEl.dataset.case = a.style.look.type.case;
    const set = (id, text) => { const e = doc.getElementById(id); if (!e) return null; e.textContent = text || ''; e.hidden = !text; return e; };
    set('world-title', cap.head); set('world-sub', cap.sub); set('world-reading', cap.reading);
    doc.title = cap.head;
    rootEl.dataset.caption = cap.from;
    // the invitation, as text and a link, or not there at all
    const inviteEl = doc.getElementById('world-invite');
    if (inviteEl) {
      const line = doc.getElementById('world-invite-line'), go = doc.getElementById('world-invite-go');
      if (a.invite && line && go) {
        line.textContent = a.invite.line;
        go.setAttribute('href', a.invite.href);
        inviteEl.hidden = false;
        rootEl.dataset.invite = 'waiting';
      } else {
        inviteEl.hidden = true;
        if (go && go.removeAttribute) go.removeAttribute('href');
        delete rootEl.dataset.invite;
      }
    }
    const gh = doc.getElementById('world-github');
    if (gh) { if (model.github) { gh.setAttribute('href', model.github); gh.hidden = false; } else gh.hidden = true; }
    // the painter's world, on the core globe; the layer seam hands the globe
    // to repo-draw.js the way the app's own mount moment does
    const W = { world: a.world, boardArt: a.boardArt, pos: new Map(), frame: 0, size: 'full', tabId: null, style: a.style, lens: null,
      swayAt: a.focus, entry: { swoop: !reduced }, recentOf: () => null, fx: new Map() };
    W.nodes = a.world.files.map((f) => ({ id: f.id, kind: f.family, at: f.at, links: [], degree: 1, depth: f.depth, weight: f.landmark ? 0.9 : 0.4, region: f.island, file: f }));
    if (!win.astrolabe || typeof win.astrolabe.emit !== 'function') {
      win.astrolabe = { on() {}, ask() { return null; }, emit(name, g, view) { if (name === 'globe:mount' && g && g.o && g.o.repoWorld && win.RepoDraw) win.RepoDraw.mountWorld(g, view); } };
    }
    const canvas = doc.getElementById('world');
    const mountGlobe = env.mountGlobe || win.mountGlobe;
    if (!canvas || typeof mountGlobe !== 'function') throw new Error('the globe could not start');
    const view = mountGlobe(canvas, W.nodes, {
      caption: false, repoWorld: W, paint: (...args) => win.RepoDraw.paintFile(W, ...args),
      dust: 1, web: 0, tall: 0.07, nodeScale: 1.1, noWheel: false, recede: 0.78, magnify: 0.35, lift: 0.04, idleRate: 0, explore: true,
      kinds: { md: '--repo-md', src: '--repo-src', test: '--repo-test', cfg: '--repo-cfg', ui: '--repo-ui', data: '--repo-data', other: '--repo-other' },
    });
    // landmarks: the world's own art, standing where the model put it
    const sculpt = () => {
      const CA = win.CourseArt;
      if (!CA || !CA.sculpt || !view || !view.sculpture || !win.RepoDraw) return 0;
      let n = 0;
      a.landmarks.forEach((l, i) => {
        const cur = l.art && CA.currentOf ? CA.currentOf(l.art) : null;
        if (!cur || !cur.spec) return;
        const sc = CA.sculpt(cur.spec, { free: true, base: null, dark: a.style.atmosphere !== 'day' });
        if (!sc || !sc.ok) return;
        view.sculpture('repo-landmark-' + i, { at: l.at, front: win.RepoDraw.util.frameAt(l.at).e1, alt: 1.004, size: 0.08 / Math.max(0.2, sc.extent.w), art: sc, alpha: 0.92, amount: 0.5 });
        n++;
      });
      return n;
    };
    let landmarks = sculpt();
    if (!landmarks && a.landmarks.length && win.CourseArt && win.CourseArt.ready) win.CourseArt.ready().then(() => { landmarks = sculpt(); }).catch(() => {});
    // alive
    const now = () => (win.performance ? win.performance.now() : Date.now());
    const motion = Motion({ files: a.world.files, focus: a.focus, reduced, phone, start: now() });
    const later = (fn, ms) => (win.setTimeout ? win.setTimeout(fn, ms) : fn());
    const tour = Tour({ stops: tourStops(a.world.islands, a.focus), invite: !!a.invite, reduced, start: now(), dwell: phone ? 5600 : 4200 });
    const FLIGHT_MS = 2600;
    const act = (t) => {
      const g = W.g;
      if (t.kind === 'visit') {
        W.swayAt = t.c;
        if (g && !g.calm && view.turnTo) view.turnTo(t.c, FLIGHT_MS);
        return;
      }
      // the end: back to the whole world, and the invitation forward
      W.swayAt = a.focus;
      if (!t.cancelled && !t.still && g && !g.calm && view.turnTo && a.focus) view.turnTo(a.focus, FLIGHT_MS);
      if (a.invite) rootEl.dataset.invite = 'arrived';
      rootEl.dataset.tour = t.cancelled ? 'yours' : 'done';
    };
    // a visitor's own hand ends it, and from then on the camera is theirs
    const yours = () => {
      if (W.g) W.g.calm = true;
      for (const t of tour.cancel(now())) act(t);
    };
    for (const ev of ['pointerdown', 'wheel', 'keydown', 'touchstart']) canvas.addEventListener(ev, yours, ev === 'wheel' || ev === 'touchstart' ? { passive: true } : undefined);
    const step = () => {
      for (const t of tour.tick(now(), !!doc.hidden)) act(t);
      if (doc.hidden) return;
      for (const p of motion.tick(now())) play(view, W, p, later);
    };
    if (tour.done === false && (reduced || !tour.stops.length)) step();
    const timer = (motion.still && tour.done) || !win.setInterval ? null : win.setInterval(step, 400);
    return { view, W, caption: cap, motion, tour, invite: a.invite, step, reduced, phone, tokens: pinned, landmarks: () => landmarks, stop: () => { if (timer && win.clearInterval) win.clearInterval(timer); } };
  }

  async function boot(env) {
    const e = env || { window: root, document: root.document };
    const doc = e.document;
    try {
      const r = await (e.fetch || root.fetch)(MODEL_FILE, { cache: 'no-cache' });
      if (!r || !r.ok) throw new Error('the world file did not load');
      const model = await r.json();
      const m = mount(model, e);
      if (doc.documentElement) doc.documentElement.dataset.state = 'ready';
      return m;
    } catch (err) {
      if (doc && doc.documentElement) doc.documentElement.dataset.state = 'failed';
      const say = doc && doc.getElementById ? doc.getElementById('world-sub') : null;
      if (say) { say.textContent = 'This world could not be drawn here.'; say.hidden = false; }
      return null;
    }
  }

  root.RepoViewer = { adapt, caption, tokens, Motion, Tour, tourStops, play, mount, boot, MODEL_FILE, SCHEMA };
  // a page that is the public world starts itself; a test drives it by hand
  if (root.document && root.document.getElementById && root.document.getElementById('world') && !root.REPO_VIEWER_MANUAL) boot();
})(typeof self !== 'undefined' ? self : this);
