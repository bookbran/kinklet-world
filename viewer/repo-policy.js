// @astrolabe-premium
// repo-policy.js: the repository world's hierarchy rules, as plain functions
// the page draws with and the tests can hold to (slice 13). No drawing here,
// no DOM: one answer to "how loud is this thing right now".
//
// The hierarchy, settled 2026-09-27:
//   no course   geography, ordinary gemstone files, file landmarks, the board's door
//   a course    the Journey's route and vessel, the current work's land, the
//               course's own art, the selected file, landmarks, the door, the rest
// Activity never moves a course: nothing here reads or writes progress.
(function (root, make) {
  const api = make();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RepoPolicy = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // THE BOARD IS A DOOR, NOT THE ATTRACTION. The room can be huge even when
  // the door is small. `size` is the sculpture's span as a share of the
  // globe's radius (it was 0.2 before this slice); alpha its presence.
  const BOARD_REST = 0.062;
  function boardPresence({ size = 'side', lens = false, hover = false } = {}) {
    let span = BOARD_REST * (size === 'full' ? 1 : 0.9), alpha = 0.62, label = size === 'full' ? 0.55 : 0;
    if (lens) { span *= 0.85; alpha = 0.4; label = 0; }   // one more step back under a course
    if (hover) { span *= 1.3; alpha = 0.95; label = 1; }  // near the hand it invites opening
    return { span: +span.toFixed(4), alpha, label };
  }

  // COURSE ART EXISTS ONLY WHILE ITS COURSE IS SELECTED. The base world never
  // accumulates every course's art: no course, no piece; another course, its
  // piece replaces the last.
  function courseArtFor(lens) {
    if (!lens || !lens.cd || !lens.cd.art) return null;
    return { key: 'repo-course-art', course: lens.cd.slug, art: lens.cd.art };
  }

  // WHICH FILES THE SIDEBAR DRAWS AS OBJECTS. The sidebar is an orientation
  // window (where is this chat working, where is the build): landmarks, the
  // selected file, the current stop's work and anything the agent is touching
  // right now keep their light; ordinary files are faint specks there. The
  // full view resolves every file into its gemstone.
  // Returns 'hidden' | 'speck' | 'light' | 'gem'.
  function fileLod({ size = 'side', zoom = 1, landmark = false, selected = false, near = false, active = false, folded = false } = {}) {
    if (folded && zoom < 1.8 && !selected && !active) return 'hidden';
    if (size === 'full') return 'gem';
    if (landmark || selected || active) return 'light';
    if (near) return 'light';
    return zoom >= 1.9 ? 'light' : 'speck';
  }

  // ONE EVENT LANGUAGE. Astrolabe's own globe already has a read (the skim),
  // a write (the working wheel, then the flare), a birth, and a send (the
  // beam of a push). A repository file receives the same ones; its family
  // only adds a material response on top (a crystal catches the light, paper
  // glows softly). Commit has no effect of its own in Astrolabe, so none is
  // invented for it here; a push is the durable, outward save.
  const EVENTS = { read: 'skim', write: 'write', edit: 'write', create: 'born', push: 'send', sent: 'send' };
  const MATERIAL = { src: 'crystal', test: 'crystal', md: 'paper', data: 'stone', cfg: 'stone', ui: 'glass', other: 'glass' };
  function eventFor(kind) { return EVENTS[kind] || null; }
  function materialOf(family) { return MATERIAL[family] || 'stone'; }

  // Where an event lands: a repository-relative path is a node id on THAT
  // repository's world only. Another repository's world, or the vault, hears
  // nothing, and a path outside the world is no node.
  function targetOf(world, repo, rel) {
    if (!world || !rel || (repo && world.repo !== repo)) return null;
    const p = String(rel).replace(/\\/g, '/').replace(/^\.\//, '');
    const id = 'f:' + p;
    return world.files.some((f) => f.id === id) ? id : null;
  }

  // Files a newer compile of the same repository has that the older did not:
  // the ones to be born into their districts rather than simply appear.
  function birthsBetween(prev, next) {
    if (!prev || !next || prev.repo !== next.repo) return [];
    const had = new Set(prev.files.map((f) => f.id));
    return next.files.filter((f) => !had.has(f.id)).map((f) => f.id);
  }

  return { boardPresence, courseArtFor, fileLod, eventFor, materialOf, targetOf, birthsBetween, BOARD_REST };
});
