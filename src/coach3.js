(function (root) {
'use strict';

/* ================= geometry ================= */
var FACES = ['U', 'R', 'F', 'D', 'L', 'B'];
var FI = { U: 0, R: 1, F: 2, D: 3, L: 4, B: 5 };
var NORMAL = { U: [0, 1, 0], R: [1, 0, 0], F: [0, 0, 1], D: [0, -1, 0], L: [-1, 0, 0], B: [0, 0, -1] };
// colour index = index of the face the sticker belongs to when solved
var COLOR_NAMES = ['yellow', 'orange', 'green', 'white', 'red', 'blue'];
var WORD = { U: 'top', D: 'bottom', F: 'front', B: 'back', L: 'left', R: 'right' };

function k3(p) { return p[0] + ',' + p[1] + ',' + p[2]; }

var ST = [];
var STIDX = {};
FACES.forEach(function (f) {
  var n = NORMAL[f];
  for (var x = -1; x <= 1; x++) for (var y = -1; y <= 1; y++) for (var z = -1; z <= 1; z++) {
    if (x * n[0] + y * n[1] + z * n[2] === 1) {
      STIDX[k3([x, y, z]) + '|' + k3(n)] = ST.length;
      ST.push({ p: [x, y, z], n: n, face: f });
    }
  }
});

// phi = +1: +90deg about +axis, -1: -90deg (right-handed, y up)
function rot(v, axis, phi) {
  var x = v[0], y = v[1], z = v[2];
  if (axis === 0) return phi > 0 ? [x, -z, y] : [x, z, -y];
  if (axis === 1) return phi > 0 ? [z, y, -x] : [-z, y, x];
  return phi > 0 ? [-y, x, z] : [y, -x, z];
}

var MOVE_PERM = {};
var MOVES = [];
FACES.forEach(function (f) {
  var n = NORMAL[f];
  var axis = n[0] !== 0 ? 0 : (n[1] !== 0 ? 1 : 2);
  var s = n[axis];
  var q = new Uint8Array(54);
  for (var i = 0; i < 54; i++) {
    var st = ST[i];
    if (st.p[axis] === s) {
      var p2 = rot(st.p, axis, -s), n2 = rot(st.n, axis, -s);
      q[i] = STIDX[k3(p2) + '|' + k3(n2)];
    } else q[i] = i;
  }
  var d = new Uint8Array(54), inv = new Uint8Array(54);
  for (var j = 0; j < 54; j++) { d[j] = q[q[j]]; inv[q[j]] = j; }
  MOVE_PERM[f] = q; MOVE_PERM[f + '2'] = d; MOVE_PERM[f + "'"] = inv;
  MOVES.push(f, f + "'", f + '2');
});

function invTok(t) { return t.length === 1 ? t + "'" : (t.charAt(1) === "'" ? t.charAt(0) : t); }
function invSeq(a) { return a.slice().reverse().map(invTok); }
function parseAlg(s) { return s.trim().split(/\s+/).filter(Boolean); }

function applyMove(state, tok) {
  var perm = MOVE_PERM[tok], out = new Uint8Array(54);
  for (var i = 0; i < 54; i++) out[perm[i]] = state[i];
  return out;
}
function applySeq(state, toks) {
  var s = state;
  for (var i = 0; i < toks.length; i++) s = applyMove(s, toks[i]);
  return s;
}

var SOLVED = new Uint8Array(54);
for (var si = 0; si < 54; si++) SOLVED[si] = FI[ST[si].face];
function solvedState() { return new Uint8Array(SOLVED); }
function isSolved(state) {
  for (var i = 0; i < 54; i++) if (state[i] !== SOLVED[i]) return false;
  return true;
}

/* ================= cubies ================= */
var CUBIES = {};
ST.forEach(function (st, i) {
  var k = k3(st.p);
  if (!CUBIES[k]) CUBIES[k] = { key: k, p: st.p, stickers: [], faces: [], byFace: {} };
  var c = CUBIES[k];
  c.stickers.push(i); c.faces.push(st.face); c.byFace[st.face] = i;
});
var ORDER = 'UDFBLR';
var BYNAME = {};
var ALL = { edge: [], corner: [], center: [] };
Object.keys(CUBIES).forEach(function (k) {
  var c = CUBIES[k];
  c.faces.sort(function (a, b) { return ORDER.indexOf(a) - ORDER.indexOf(b); });
  c.name = c.faces.join('');
  c.type = c.faces.length === 1 ? 'center' : (c.faces.length === 2 ? 'edge' : 'corner');
  BYNAME[c.name] = c;
  if (c.faces.length > 0 && c.type !== 'center') ALL[c.type].push(c);
  else if (c.type === 'center') ALL.center.push(c);
});

function cubieSolved(state, name) {
  var c = BYNAME[name];
  for (var i = 0; i < c.stickers.length; i++) if (state[c.stickers[i]] !== SOLVED[c.stickers[i]]) return false;
  return true;
}
function findPiece(state, name) {
  var c = BYNAME[name];
  var want = c.faces.map(function (f) { return FI[f]; }).sort().join();
  var list = ALL[c.type];
  for (var j = 0; j < list.length; j++) {
    var got = list[j].stickers.map(function (i) { return state[i]; }).sort().join();
    if (got === want) return list[j];
  }
  return null;
}
function topOriented(state, name) { return state[BYNAME[name].byFace.U] === FI.U; }

var D_EDGES = ['DF', 'DR', 'DB', 'DL'];
var D_CORNERS = ['DFR', 'DFL', 'DBL', 'DBR'];
var M_EDGES = ['FR', 'FL', 'BL', 'BR'];
var U_EDGES = ['UF', 'UR', 'UB', 'UL'];
var U_CORNERS = ['UFR', 'UFL', 'UBL', 'UBR'];

function all(list, fn) { for (var i = 0; i < list.length; i++) if (!fn(list[i])) return false; return true; }
function isSol(state) { return function (n) { return cubieSolved(state, n); }; }
function isTop(state) { return function (n) { return topOriented(state, n); }; }

/* ================= stages ================= */
var STAGE_TPL = [
  { name: '{D} cross', short: 'Cross', blurb: 'Put the four {d} edges around the {d} centre, each matching its side colour.' },
  { name: '{D} corners', short: 'Corners', blurb: 'Finish the {d} layer by dropping the four {d} corners into place.' },
  { name: 'Middle layer', short: 'Middle', blurb: 'Slot the four edges that have no {u} into the middle layer.' },
  { name: '{U} cross', short: '{U} +', blurb: 'Make a {u} cross on top. The side colours do not matter yet.' },
  { name: '{U} corners', short: 'Orient', blurb: 'Turn every top corner {u}-side up.' },
  { name: 'Place corners', short: 'Place', blurb: 'Move the top corners to their correct spots.' },
  { name: 'Place edges', short: 'Finish', blurb: 'Cycle the last three edges into place to finish the cube.' }
];
var STAGES = STAGE_TPL.map(function (t) { return { name: t.name, short: t.short, blurb: t.blurb }; });
function setNames(names) {      // names for the six colours in U, R, F, D, L, B order
  for (var i = 0; i < 6; i++) COLOR_NAMES[i] = names[i];
  var cap = function (w) { return w.charAt(0).toUpperCase() + w.slice(1); };
  var fill = function (t) { return t.replace(/\{D\}/g, cap(names[3])).replace(/\{d\}/g, names[3]).replace(/\{U\}/g, cap(names[0])).replace(/\{u\}/g, names[0]); };
  STAGE_TPL.forEach(function (t, k) { STAGES[k].name = fill(t.name); STAGES[k].short = fill(t.short); STAGES[k].blurb = fill(t.blurb); });
}

function stageDone(state, stage) {
  switch (stage) {
    case 1: return all(D_EDGES, isSol(state));
    case 2: return all(D_CORNERS, isSol(state));
    case 3: return all(M_EDGES, isSol(state));
    case 4: return all(U_EDGES, isTop(state));
    case 5: return all(U_CORNERS, isTop(state));
    case 6: return all(U_CORNERS, isSol(state));
    case 7: return isSolved(state);
  }
  return true;
}
function currentStage(state) {
  for (var s = 1; s <= 7; s++) if (!stageDone(state, s)) return s;
  return 8;
}

/* ================= search helpers ================= */
function trackedStickers(state, names) {
  var cur = [], home = [];
  names.forEach(function (nm) {
    var c = BYNAME[nm], loc = findPiece(state, nm);
    c.faces.forEach(function (f) {
      home.push(c.byFace[f]);
      var want = FI[f], idx = -1;
      for (var j = 0; j < loc.stickers.length; j++) if (state[loc.stickers[j]] === want) idx = loc.stickers[j];
      cur.push(idx);
    });
  });
  return { cur: cur, home: home };
}

// meet-in-the-middle over only the tracked pieces
function mitm(cur, home, maxTotal) {
  var sk = cur.join(','), gk = home.join(',');
  if (sk === gk) return [];
  var fwd = {}, bwd = {};
  fwd[sk] = null; bwd[gk] = null;
  var fl = [{ a: cur, k: sk, last: '' }], bl = [{ a: home, k: gk, last: '' }];
  function build(mk) {
    var pre = [], k = mk;
    while (fwd[k]) { pre.push(fwd[k].move); k = fwd[k].prev; }
    pre.reverse();
    var post = []; k = mk;
    while (bwd[k]) { post.push(bwd[k].move); k = bwd[k].next; }
    return pre.concat(post);
  }
  for (var d = 0; d < maxTotal; d++) {
    var forward = (d % 2 === 0);
    var front = forward ? fl : bl, nxt = [];
    for (var i = 0; i < front.length; i++) {
      var node = front[i];
      for (var m = 0; m < MOVES.length; m++) {
        var tok = MOVES[m];
        if (tok.charAt(0) === node.last) continue;
        var perm = forward ? MOVE_PERM[tok] : MOVE_PERM[invTok(tok)];
        var arr = new Array(node.a.length);
        for (var q = 0; q < arr.length; q++) arr[q] = perm[node.a[q]];
        var key = arr.join(',');
        if (forward) {
          if (fwd.hasOwnProperty(key)) continue;
          fwd[key] = { prev: node.k, move: tok };
          if (bwd.hasOwnProperty(key)) return build(key);
        } else {
          if (bwd.hasOwnProperty(key)) continue;
          bwd[key] = { next: node.k, move: tok };
          if (fwd.hasOwnProperty(key)) return build(key);
        }
        nxt.push({ a: arr, k: key, last: tok.charAt(0) });
      }
    }
    if (forward) fl = nxt; else bl = nxt;
  }
  return null;
}

function stKey(s) { return String.fromCharCode.apply(null, s); }

// cheapest sequence of macros (cost = number of turns) that reaches goalFn
function macroSearch(state, macros, goalFn, protectFn, maxCost) {
  var nodes = [{ s: state, p: -1, m: -1, c: 0 }];
  var seen = {}; seen[stKey(state)] = 0;
  var buckets = []; buckets[0] = [0];
  for (var c = 0; c <= maxCost; c++) {
    var b = buckets[c];
    if (!b) continue;
    for (var bi = 0; bi < b.length; bi++) {
      var ni = b[bi], node = nodes[ni];
      if (seen[stKey(node.s)] !== c) continue;
      if (goalFn(node.s)) {
        var idxs = [], cur = ni;
        while (nodes[cur].p >= 0) { idxs.push(nodes[cur].m); cur = nodes[cur].p; }
        return idxs.reverse();
      }
      for (var mi = 0; mi < macros.length; mi++) {
        var mac = macros[mi];
        var ns = applySeq(node.s, mac.moves);
        if (protectFn && !protectFn(ns)) continue;
        var nc = c + mac.moves.length;
        if (nc > maxCost) continue;
        var k = stKey(ns), old = seen[k];
        if (old !== undefined && old <= nc) continue;
        seen[k] = nc;
        nodes.push({ s: ns, p: ni, m: mi, c: nc });
        if (!buckets[nc]) buckets[nc] = [];
        buckets[nc].push(nodes.length - 1);
      }
    }
  }
  return null;
}

function toSegments(macros, idxs) {
  var segs = [];
  idxs.forEach(function (mi) {
    var last = segs[segs.length - 1];
    if (last && last.mi === mi) last.repeat++;
    else segs.push({ mi: mi, repeat: 1 });
  });
  return segs.map(function (s) {
    return { label: macros[s.mi].label, note: macros[s.mi].note, moves: macros[s.mi].moves, repeat: s.repeat };
  });
}
function flatten(segs) {
  var out = [];
  segs.forEach(function (s) { for (var r = 0; r < s.repeat; r++) out = out.concat(s.moves); });
  return out;
}

/* ================= algorithm library ================= */
// y-rotation relabel: the algorithm as if you had turned the cube a quarter turn k times
var YMAP = { F: 'L', L: 'B', B: 'R', R: 'F', U: 'U', D: 'D' };
function relabel(alg, k) {
  return alg.map(function (t) {
    var f = t.charAt(0);
    for (var i = 0; i < k; i++) f = YMAP[f];
    return f + t.slice(1);
  });
}
var BASE = {
  trigger: parseAlg("R U R' U'"),
  insR: parseAlg("U R U' R' U' F' U F"),
  insL: parseAlg("U' L' U L U F U' F'"),
  cross: parseAlg("F R U R' U' F'"),
  sune: parseAlg("R U R' U R U2 R'"),
  corner: parseAlg("R' F R' B2 R F' R' B2 R2"),
  edge: parseAlg("R U' R U R U R U' R' U' R2"),
  edge2: parseAlg("R2 U R U R' U' R' U' R' U R'")
};
var SLOT_C = ['DFR', 'DFL', 'DBL', 'DBR'];
var SLOT_M = ['FR', 'FL', 'BL', 'BR'];
var UTURNS = [
  { label: 'Turn the top layer', note: 'Line the pieces up. This only moves that one layer.', moves: ['U'] },
  { label: 'Turn the top layer', note: 'Line the pieces up. This only moves that one layer.', moves: ["U'"] },
  { label: 'Turn the top layer', note: 'Line the pieces up. This only moves that one layer.', moves: ['U2'] }
];

function pos(name) { return BYNAME[name].faces.map(function (f) { return WORD[f]; }).join('-'); }
function cols(name) { return BYNAME[name].faces.map(function (f) { return COLOR_NAMES[FI[f]]; }).join('-'); }
function make(stage, title, explain, segs) {
  return { stage: stage, stageName: STAGES[stage - 1].name, title: title, explain: explain, segments: segs, moves: flatten(segs) };
}
function fail(stage) {
  return { stage: stage, stageName: STAGES[stage - 1].name, title: 'Stuck', explain: 'Could not find a sequence from this position.', segments: [], moves: [], error: true };
}
function firstWhere(list, fn) { for (var i = 0; i < list.length; i++) if (fn(list[i])) return list[i]; return null; }

/* ================= stage solvers ================= */
function stepCross(state) {
  var solved = D_EDGES.filter(isSol(state));
  var target = firstWhere(D_EDGES, function (n) { return solved.indexOf(n) < 0; });
  var t = trackedStickers(state, solved.concat([target]));
  var path = mitm(t.cur, t.home, 14);
  if (!path) return fail(1);
  var loc = findPiece(state, target);
  var layer = loc.faces.indexOf('U') >= 0 ? (WORD.U + ' layer') : (loc.faces.indexOf('D') >= 0 ? (WORD.D + ' layer') : 'middle layer');
  var other = BYNAME[target].faces.filter(function (f) { return f !== 'D'; })[0];
  var explain = 'The ' + cols(target) + ' edge is in the ' + layer + ' (' + pos(loc.name) + '). It belongs between the ' + COLOR_NAMES[3] + ' centre and the ' + COLOR_NAMES[FI[other]] + ' centre. ' +
    (solved.length ? 'These turns keep your finished ' + COLOR_NAMES[3] + ' edges in place.' : 'The ' + COLOR_NAMES[3] + ' centre marks your bottom face.');
  return make(1, 'Place the ' + cols(target) + ' edge', explain, [{ label: 'Bring the edge home', note: 'A short path found for this exact position.', moves: path, repeat: 1 }]);
}

function protectD(state) { return D_EDGES.concat(D_CORNERS).filter(isSol(state)); }

function stepCorners(state) {
  var target = firstWhere(D_CORNERS, function (n) { return !cubieSolved(state, n); });
  var keep = D_EDGES.concat(D_CORNERS).filter(isSol(state));
  var macros = UTURNS.slice();
  SLOT_C.forEach(function (slot, k) {
    if (keep.indexOf(slot) >= 0) return;
    var mv = relabel(BASE.trigger, k);
    macros.push({ label: 'Trigger: ' + mv.join(' '), note: 'Lifts the corner out of the ' + pos(slot) + ' slot, or drops it in. Repeat until the ' + COLOR_NAMES[3] + ' sticker points down.', moves: mv });
  });
  var path = macroSearch(state, macros,
    function (s) { return cubieSolved(s, target) && all(keep, isSol(s)); },
    function (s) { return all(keep, isSol(s)); }, 60);
  if (!path) return fail(2);
  var loc = findPiece(state, target);
  var layer = loc.faces.indexOf('D') >= 0 ? (WORD.D + ' layer') : (WORD.U + ' layer');
  var explain = 'The ' + cols(target) + ' corner is in the ' + layer + ' (' + pos(loc.name) + '). It belongs in the ' + pos(target) + ' corner. The trigger moves can look odd mid-way, so finish the whole list before judging.';
  return make(2, 'Insert the ' + cols(target) + ' corner', explain, toSegments(macros, path));
}

function stepMiddle(state) {
  var target = firstWhere(M_EDGES, function (n) { return !cubieSolved(state, n); });
  var keepD = D_EDGES.concat(D_CORNERS);
  var keep = keepD.concat(M_EDGES.filter(isSol(state)));
  var macros = UTURNS.slice();
  SLOT_M.forEach(function (slot, k) {
    var r = relabel(BASE.insR, k), l = relabel(BASE.insL, (k + 3) % 4);
    macros.push({ label: 'Edge to the right: ' + r.join(' '), note: 'Drops the front-top edge into the ' + pos(slot) + ' slot, or pops out a wrong edge from it.', moves: r });
    macros.push({ label: 'Edge to the left: ' + l.join(' '), note: 'Drops the front-top edge into the ' + pos(slot) + ' slot, or pops out a wrong edge from it.', moves: l });
    macros[macros.length - 2].slot = slot; macros[macros.length - 1].slot = slot;
  });
  // keep only macros that do not wreck finished slots
  var usable = macros.filter(function (m) { return !m.slot || !cubieSolved(state, m.slot) || true; });
  var path = macroSearch(state, usable,
    function (s) { return cubieSolved(s, target) && all(keep, isSol(s)); },
    function (s) { return all(keep, isSol(s)); }, 70);
  if (!path) return fail(3);
  var loc = findPiece(state, target);
  var where = loc.faces.indexOf('U') >= 0 ? 'in the ' + WORD.U + ' layer (' + pos(loc.name) + ')' : 'already in the middle layer but in the wrong spot (' + pos(loc.name) + ')';
  var explain = 'The ' + cols(target) + ' edge is ' + where + '. It belongs in the ' + pos(target) + ' slot. The two side algorithms are mirror images of each other.';
  return make(3, 'Slot in the ' + cols(target) + ' edge', explain, toSegments(macros.length ? usable : macros, path));
}

function baseKeep(state) { return D_EDGES.concat(D_CORNERS, M_EDGES); }

function stepYellowCross(state) {
  var keep = baseKeep(state);
  var macros = [0, 1, 2, 3].map(function (k) {
    var mv = relabel(BASE.cross, k);
    return { label: 'Cross algorithm: ' + mv.join(' '), note: 'Adds ' + COLOR_NAMES[0] + ' edges to the top without touching the two lower layers.', moves: mv };
  });
  var path = macroSearch(state, macros,
    function (s) { return all(U_EDGES, isTop(s)); },
    function (s) { return all(keep, isSol(s)); }, 40);
  if (!path) return fail(4);
  var n = U_EDGES.filter(isTop(state)).length;
  var pattern = n === 0 ? 'just the centre (a dot)' : (n === 2 ? 'a bent or straight line' : 'a partial shape');
  var explain = 'The top currently shows ' + pattern + '. Repeat the algorithm until all four edges are ' + COLOR_NAMES[0] + ' on top. It may take up to three goes.';
  return make(4, 'Make the ' + COLOR_NAMES[0] + ' cross', explain, toSegments(macros, path));
}

function stepYellowCorners(state) {
  var keep = baseKeep(state).concat(U_EDGES.filter(isTop(state)));
  var macros = UTURNS.slice();
  [0, 1, 2, 3].forEach(function (k) {
    var a = relabel(BASE.sune, k);
    macros.push({ label: 'Sune: ' + a.join(' '), note: 'Twists three top corners so ' + COLOR_NAMES[0] + ' faces up. The lower layers stay finished.', moves: a });
  });
  [0, 1, 2, 3].forEach(function (k) {
    var a = invSeq(relabel(BASE.sune, k));
    macros.push({ label: 'Anti-Sune: ' + a.join(' '), note: 'The reverse of Sune. It twists the corners the other way.', moves: a });
  });
  var path = macroSearch(state, macros,
    function (s) { return all(U_CORNERS, isTop(s)); },
    function (s) { return all(keep, isSol(s)) || (all(baseKeep(s), isSol(s)) && all(U_EDGES, isTop(s))); }, 70);
  if (!path) return fail(5);
  var n = U_CORNERS.filter(isTop(state)).length;
  var explain = n + ' of the 4 top corners show ' + COLOR_NAMES[0] + ' on top. Use Sune (or its reverse) to twist the others. The top layer turns are only there to line things up.';
  return make(5, 'Turn the top corners ' + COLOR_NAMES[0], explain, toSegments(macros, path));
}

function stepPlaceCorners(state) {
  var keep = baseKeep(state);
  var macros = UTURNS.slice();
  [0, 1, 2, 3].forEach(function (k) {
    var a = relabel(BASE.corner, k);
    macros.push({ label: 'Corner cycle: ' + a.join(' '), note: 'Cycles three top corners. Everything else stays where it is.', moves: a });
    var b = invSeq(a);
    macros.push({ label: 'Corner cycle (reverse): ' + b.join(' '), note: 'The same cycle in the opposite direction.', moves: b });
  });
  var path = macroSearch(state, macros,
    function (s) { return all(U_CORNERS, isSol(s)); },
    function (s) { return all(keep, isSol(s)) && all(U_EDGES, isTop(s)) && all(U_CORNERS, isTop(s)); }, 80);
  if (!path) return fail(6);
  var explain = 'The corners are ' + COLOR_NAMES[0] + '-side up but not all in the right spots. Turn the top layer to line one up, then cycle the other three.';
  return make(6, 'Move the corners into place', explain, toSegments(macros, path));
}

function stepPlaceEdges(state) {
  var keep = baseKeep(state).concat(U_CORNERS);
  var macros = UTURNS.slice();
  [0, 1, 2, 3].forEach(function (k) {
    var a = relabel(BASE.edge, k), b = relabel(BASE.edge2, k);
    macros.push({ label: 'Edge cycle: ' + a.join(' '), note: 'Cycles three top edges one way. Corners and the lower layers stay put.', moves: a });
    macros.push({ label: 'Edge cycle (reverse): ' + b.join(' '), note: 'Cycles three top edges the other way.', moves: b });
  });
  var path = macroSearch(state, macros,
    function (s) { return isSolved(s); },
    function (s) { return all(keep, isSol(s)) && all(U_EDGES, isTop(s)); }, 80);
  if (!path) return fail(7);
  var explain = 'Only the top edges are out of place. Turn the top until at least one edge matches, then cycle the other three.';
  return make(7, 'Finish with the edge cycle', explain, toSegments(macros, path));
}

var STEPPERS = [null, stepCross, stepCorners, stepMiddle, stepYellowCross, stepYellowCorners, stepPlaceCorners, stepPlaceEdges];

function nextStep(state) {
  var st = currentStage(state);
  if (st === 8) return { done: true, stage: 8 };
  return STEPPERS[st](state);
}

function solveAll(state, limit) {
  var s = state, steps = [], n = limit || 40;
  while (n-- > 0) {
    var st = nextStep(s);
    if (st.done) return { steps: steps, state: s, solved: true };
    if (st.error) return { steps: steps, state: s, solved: false, error: st };
    steps.push(st);
    s = applySeq(s, st.moves);
  }
  return { steps: steps, state: s, solved: isSolved(s) };
}

function randomScramble(len) {
  var out = [], last = '', prev = '';
  var axis = { U: 0, D: 0, R: 1, L: 1, F: 2, B: 2 };
  var faces = ['U', 'D', 'R', 'L', 'F', 'B'], suf = ['', "'", '2'];
  while (out.length < len) {
    var f = faces[Math.floor(Math.random() * 6)];
    if (f === last) continue;
    if (prev && axis[f] === axis[last] && axis[f] === axis[prev]) continue;
    out.push(f + suf[Math.floor(Math.random() * 3)]);
    prev = last; last = f;
  }
  return out;
}

function stateToString(s) { var o = ''; for (var i = 0; i < 54; i++) o += s[i]; return o; }
function stringToState(str) {
  if (typeof str !== 'string' || str.length !== 54) return null;
  var s = new Uint8Array(54), counts = [0, 0, 0, 0, 0, 0];
  for (var i = 0; i < 54; i++) {
    var v = str.charCodeAt(i) - 48;
    if (v < 0 || v > 5) return null;
    s[i] = v; counts[v]++;
  }
  for (var j = 0; j < 6; j++) if (counts[j] !== 9) return null;
  return s;
}

/* ================= orientation, slice turns, drag mapping ================= */
var IDENT = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
function matMul(a, b) {
  var r = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++) for (var k = 0; k < 3; k++) r[i][j] += a[i][k] * b[k][j];
  return r;
}
function matVec(m, v) {
  return [m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
          m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
          m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2]];
}
// q quarter turns (+1, -1 or 2) about +axis, right-handed, y up
function rotMat(axis, q) {
  var steps = Math.abs(q) === 2 ? 2 : 1, phi = q < 0 ? -1 : 1;
  var cols = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map(function (e) {
    var v = e;
    for (var s = 0; s < steps; s++) v = rot(v, axis, phi);
    return v;
  });
  var m = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++) m[i][j] = cols[j][i];
  return m;
}
// M follows L, E follows D, S follows F. q is the quarter turns about +axis.
var SLICE_BASE = { M: { axis: 0, q: 1, faces: ['R', "L'"] }, E: { axis: 1, q: 1, faces: ['U', "D'"] }, S: { axis: 2, q: -1, faces: ["F'", 'B'] } };
function isSlice(tok) { return 'MES'.indexOf(tok.charAt(0)) >= 0; }
function sliceInfo(tok) {
  var b = SLICE_BASE[tok.charAt(0)], suf = tok.slice(1);
  if (suf === "'") return { axis: b.axis, q: -b.q, faces: b.faces.map(invTok) };
  if (suf === '2') return { axis: b.axis, q: 2, faces: b.faces.map(function (t) { return t.charAt(0) + '2'; }) };
  return { axis: b.axis, q: b.q, faces: b.faces.slice() };
}
// Face turns keep the centres fixed. A slice turn is stored as the two outer face turns plus a
// whole-cube rotation O, so the solver can keep assuming fixed centres.
function applyAny(state, tok, O) {
  if (!isSlice(tok)) return { state: applyMove(state, tok), orient: O };
  var si = sliceInfo(tok);
  return { state: applySeq(state, si.faces), orient: matMul(O, rotMat(si.axis, si.q)) };
}
// camera: {rx, ry} in degrees, same order as the CSS transform rotateX(rx) rotateY(ry)
function camVec(w, cam) {
  var x = w[0], y = -w[1], z = w[2];
  var ry = cam.ry * Math.PI / 180, rx = cam.rx * Math.PI / 180;
  var x1 = x * Math.cos(ry) + z * Math.sin(ry), z1 = -x * Math.sin(ry) + z * Math.cos(ry);
  return [x1, y * Math.cos(rx) - z1 * Math.sin(rx), y * Math.sin(rx) + z1 * Math.cos(rx)];
}
var FACE_BY_AXIS = { '0,1': 'R', '0,-1': 'L', '1,1': 'U', '1,-1': 'D', '2,1': 'F', '2,-1': 'B' };
// Which turn does dragging from sticker i by (dx, dy) screen pixels ask for?
function dragToken(i, dx, dy, cam, O) {
  var st = ST[i], n = st.n, na = n[0] ? 0 : (n[1] ? 1 : 2), best = null;
  var r = [st.p[0] + 0.5 * n[0], st.p[1] + 0.5 * n[1], st.p[2] + 0.5 * n[2]];   // sticker centre
  for (var b = 0; b < 3; b++) {
    if (b === na) continue;
    // velocity of the sticker for a turn about +axis b, as it appears on screen
    var e = [0, 0, 0]; e[b] = 1;
    var vel = [e[1] * r[2] - e[2] * r[1], e[2] * r[0] - e[0] * r[2], e[0] * r[1] - e[1] * r[0]];
    var sv = camVec(matVec(O, vel), cam);
    var dot = dx * sv[0] + dy * sv[1];
    if (!best || Math.abs(dot) > Math.abs(best.dot)) best = { b: b, dot: dot, q: dot >= 0 ? 1 : -1 };
  }
  if (!best) return null;
  var bAxis = best.b, q = best.q, k = st.p[bAxis];
  if (k === 0) {
    var base = bAxis === 2 ? -1 : 1, nm = 'MES'.charAt(bAxis);
    return q === base ? nm : nm + "'";
  }
  var f = FACE_BY_AXIS[bAxis + ',' + k];
  return q === -k ? f : f + "'";
}

var API = {
  WORD: WORD, COLOR_NAMES: COLOR_NAMES, setNames: setNames, FACES: FACES, FI: FI, MOVES: MOVES, ST: ST, STIDX: STIDX, STAGES: STAGES, COLOR_NAMES: COLOR_NAMES,
  NORMAL: NORMAL, BYNAME: BYNAME, CUBIES: CUBIES,
  IDENT: IDENT, matMul: matMul, matVec: matVec, rotMat: rotMat, isSlice: isSlice, sliceInfo: sliceInfo,
  applyAny: applyAny, camVec: camVec, dragToken: dragToken, MOVE_PERM: MOVE_PERM,
  solvedState: solvedState, isSolved: isSolved, applyMove: applyMove, applySeq: applySeq,
  parseAlg: parseAlg, invSeq: invSeq, invTok: invTok,
  currentStage: currentStage, stageDone: stageDone, nextStep: nextStep, solveAll: solveAll,
  randomScramble: randomScramble, stateToString: stateToString, stringToState: stringToState,
  _internals: { BASE: BASE, D_EDGES: D_EDGES, D_CORNERS: D_CORNERS, M_EDGES: M_EDGES, U_EDGES: U_EDGES, U_CORNERS: U_CORNERS, cubieSolved: cubieSolved, topOriented: topOriented, relabel: relabel }
};
if (typeof module !== 'undefined' && module.exports) module.exports = API;
else root.CubeEngine = API;
})(typeof window !== 'undefined' ? window : this);
