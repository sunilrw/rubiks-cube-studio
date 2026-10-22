/* The coach: reads your cube, works out which stage you are on and what to turn next.
   2x2 and 3x3 only. The 3x3 beginner method lives in coach3.js, the shortest-solution solver is cubejs. */
(function (root) {
'use strict';
var Pz = root.Puzzle, E = root.CubeEngine, NORM = Pz.NORMALS, WORDS = { U: 'top', D: 'bottom', F: 'front', B: 'back', L: 'left', R: 'right' };

function transpose(m) { return [[m[0][0], m[1][0], m[2][0]], [m[0][1], m[1][1], m[2][1]], [m[0][2], m[1][2], m[2][2]]]; }
function same(a, b) { return a.length === b.length && a.every(function (v, i) { return v === b[i]; }); }

/* ----- hold the cube the way the coach expects (centres for 3x3, one corner for 2x2) ----- */
function normalise(S) {
  var N = S.N, P = Pz.create(N), cols = Pz.colours(S), found = null, i, h;
  if (N === 3) {
    var cc = []; for (h = 0; h < 6; h++) cc[h] = cols[h * 9 + 4];
    Pz.ROTATIONS.some(function (R) {
      for (h = 0; h < 6; h++) if (Pz.faceOfNormal(Pz.matVec(R, NORM[h])) !== cc[h]) return false;
      return (found = R);
    });
  } else if (N === 2) {
    var d = P.indexAt([-1, -1, -1], 3), l = P.indexAt([-1, -1, -1], 4), b = P.indexAt([-1, -1, -1], 5);
    Pz.ROTATIONS.some(function (R) { var nc = Pz.rotateColours(2, cols, R); return nc[d] === 3 && nc[l] === 4 && nc[b] === 5 ? (found = R) : false; });
  }
  if (!found) return null;
  return { R: found, Rinv: transpose(found), cols: Pz.rotateColours(N, cols, found), identity: same([].concat.apply([], found), [1, 0, 0, 0, 1, 0, 0, 0, 1]) };
}
function displayFace(norm, engineFace) { return Pz.FACES[Pz.faceOfNormal(Pz.matVec(norm.Rinv, NORM[Pz.FI[engineFace]]))]; }
function displayToken(norm, tok) { return displayFace(norm, tok.charAt(0)) + tok.slice(1); }
function setWords(norm) { 'URFDLB'.split('').forEach(function (f) { E.WORD[f] = WORDS[displayFace(norm, f)]; }); }

/* ----- 3x3 ----- */
var toEngine = null;
function engineState(ncols) {
  if (!toEngine) { var P = Pz.create(3); toEngine = []; for (var i = 0; i < 54; i++) toEngine[i] = E.STIDX[P.pos[i].map(function (v) { return v / 2; }).join(',') + '|' + P.nrm[i].join(',')]; }
  var st = new Uint8Array(54); for (var j = 0; j < 54; j++) st[toEngine[j]] = ncols[j]; return st;
}
function finishStep(N, norm, step, extra) {
  var conv = function (toks) { return toks.map(function (t) { return displayToken(norm, t); }); };
  var out = { stage: step.stage, stageName: step.stageName, title: step.title, explain: step.explain, segments: step.segments.map(function (s) { return { label: s.label, note: s.note, moves: conv(s.moves), repeat: s.repeat }; }) };
  out.tokens = []; out.segments.forEach(function (s) { for (var r = 0; r < s.repeat; r++) out.tokens = out.tokens.concat(s.moves); });
  out.moves = Pz.parseAlg(N, out.tokens.join(' ')) || [];
  if (extra) for (var k in extra) out[k] = extra[k];
  return out;
}
function next3(S) {
  var norm = normalise(S); if (!norm) return { error: 'The centres are not in a state the coach understands. Try Undo.' };
  setWords(norm);
  var step = E.nextStep(engineState(norm.cols));
  if (step.done) return { done: true };
  if (step.error) return { error: 'The coach could not find a way forward from here.' };
  return finishStep(3, norm, step);
}
function stage3(S) { var norm = normalise(S); return norm ? E.currentStage(engineState(norm.cols)) : 0; }

/* ----- 2x2: one corner stays still, so U, R and F turns are enough ----- */
var C2 = (function () {
  var P = Pz.create(2), MOVES = [];
  ['U', 'R', 'F'].forEach(function (f) { ['', '2', "'"].forEach(function (suf) {
    var tok = f + suf, m = Pz.parse(2, tok), map = new Uint8Array(24), inv = new Uint8Array(24), i;
    for (i = 0; i < 24; i++) map[i] = i;
    m.layers.forEach(function (l) { var pm = P.getPerm(m.axis, l, m.q); for (var k = 0; k < pm.src.length; k++) map[pm.src[k]] = pm.dst[k]; });
    for (i = 0; i < 24; i++) inv[map[i]] = i;
    MOVES.push({ tok: tok, map: map, inv: inv });
  }); });
  var HOMES = [[3, 2, 4], [3, 2, 1], [3, 5, 1], [3, 5, 4]];     // down-front-left, down-front-right, down-back-right, down-back-left
  function cornerPos(colSet) { var p = [0, 0, 0]; colSet.forEach(function (c) { for (var a = 0; a < 3; a++) p[a] += NORM[c][a]; }); return p; }
  function pieces(ncols) {       // where each corner piece is now, listed by its three colours
    var out = {};
    [-1, 1].forEach(function (x) { [-1, 1].forEach(function (y) { [-1, 1].forEach(function (z) {
      var p = [x, y, z], st = [P.indexAt(p, x > 0 ? 1 : 4), P.indexAt(p, y > 0 ? 0 : 3), P.indexAt(p, z > 0 ? 2 : 5)];
      var cs = st.map(function (i) { return ncols[i]; }), key = cs.slice().sort().join(), at = {};
      st.forEach(function (i) { at[ncols[i]] = i; }); out[key] = { colours: cs.slice().sort(), at: at, pos: p };
    }); }); });
    return out;
  }
  function track(ncols, wanted) {
    var pc = pieces(ncols), cur = [], home = [];
    wanted.forEach(function (w) {
      var key = w.slice().sort().join(), piece = pc[key], hp = cornerPos(w);
      piece.colours.forEach(function (c) { cur.push(piece.at[c]); home.push(P.indexAt(hp, c)); });
    });
    return { cur: cur, home: home };
  }
  function solvedPiece(ncols, w) { var t = track(ncols, [w]); return same(t.cur, t.home); }
  function stageOf(ncols) { return HOMES.every(function (w) { return solvedPiece(ncols, w); }) ? 2 : 1; }
  function search(cur, home, maxTotal) {
    var sk = cur.join(), gk = home.join();
    if (sk === gk) return [];
    var fwd = {}, bwd = {}; fwd[sk] = null; bwd[gk] = null;
    var fl = [{ a: cur, k: sk, last: '' }], bl = [{ a: home, k: gk, last: '' }];
    function build(mk) {
      var pre = [], k = mk; while (fwd[k]) { pre.push(fwd[k].move); k = fwd[k].prev; }
      pre.reverse(); var post = []; k = mk; while (bwd[k]) { post.push(bwd[k].move); k = bwd[k].next; } return pre.concat(post);
    }
    for (var d = 0; d < maxTotal; d++) {
      var forward = d % 2 === 0, front = forward ? fl : bl, nxt = [];
      for (var i = 0; i < front.length; i++) {
        var node = front[i];
        for (var m = 0; m < MOVES.length; m++) {
          var mv = MOVES[m]; if (mv.tok.charAt(0) === node.last) continue;
          var tb = forward ? mv.map : mv.inv, arr = node.a.map(function (x) { return tb[x]; }), key = arr.join();
          if (forward) { if (fwd.hasOwnProperty(key)) continue; fwd[key] = { prev: node.k, move: mv.tok }; if (bwd.hasOwnProperty(key)) return build(key); }
          else { if (bwd.hasOwnProperty(key)) continue; bwd[key] = { next: node.k, move: mv.tok }; if (fwd.hasOwnProperty(key)) return build(key); }
          nxt.push({ a: arr, k: key, last: mv.tok.charAt(0) });
        }
      }
      if (forward) fl = nxt; else bl = nxt;
    }
    return null;
  }
  function wordPos(norm, p) {
    var f = [p[0] > 0 ? 'R' : 'L', p[1] > 0 ? 'U' : 'D', p[2] > 0 ? 'F' : 'B'].map(function (e) { return WORDS[displayFace(norm, e)]; });
    return f.sort(function (a, b) { return ['top', 'bottom', 'front', 'back', 'left', 'right'].indexOf(a) - ['top', 'bottom', 'front', 'back', 'left', 'right'].indexOf(b); }).join('-');
  }
  function names(w, nm) { return w.map(function (c) { return nm[c]; }).join('-'); }
  function step(S, nm) {
    var norm = normalise(S); if (!norm) return { error: 'Could not read the cube.' };
    var nc = norm.cols, st = stageOf(nc), segs, title, explain, toks, pc = pieces(nc);
    if (st === 1) {
      var done = HOMES.filter(function (w) { return solvedPiece(nc, w); }), target = HOMES.filter(function (w) { return !solvedPiece(nc, w); })[0];
      var t = track(nc, done.concat([target])), path = search(t.cur, t.home, 14);
      if (!path) return { error: 'The coach could not find a way forward from here.' };
      var pi = pc[target.slice().sort().join()];
      title = 'Place the ' + names(target, nm) + ' corner';
      explain = 'The ' + names(target, nm) + ' corner is at ' + wordPos(norm, pi.pos) + ' now. It belongs at ' + wordPos(norm, cornerPos(target)) + ', next to the ' + nm[3] + ' layer you are building. These turns leave your finished corners in place.';
      toks = path; segs = [{ label: 'Bring the corner home', note: 'A short path found for this exact position.', moves: toks, repeat: 1 }];
    } else {
      var all = [].concat(HOMES, [[0, 2, 1], [0, 2, 4], [0, 5, 4], [0, 5, 1]]), t2 = track(nc, all), p2 = search(t2.cur, t2.home, 16);
      if (!p2) return { error: 'The coach could not find a way forward from here.' };
      title = 'Finish the last layer';
      explain = 'Your ' + nm[3] + ' layer is complete. Only the top corners are left. This short sequence turns and places them all in one go, found by a search for your exact position.';
      toks = p2; segs = [{ label: 'Finish the cube', note: 'Watch the highlighted layer and the arrow.', moves: toks, repeat: 1 }];
    }
    return finishStep(2, norm, { stage: st, stageName: st === 1 ? 'First layer' : 'Last layer', title: title, explain: explain, segments: segs });
  }
  function shortest(S) {
    var norm = normalise(S); if (!norm) return null;
    var all = [].concat(HOMES, [[0, 2, 1], [0, 2, 4], [0, 5, 4], [0, 5, 1]]), t = track(norm.cols, all), p = search(t.cur, t.home, 16);
    return p ? { tokens: p.map(function (x) { return displayToken(norm, x); }), engineTokens: p } : null;
  }
  return { step: step, stageOf: function (S) { var n = normalise(S); return n ? stageOf(n.cols) : 0; }, shortest: shortest };
})();

/* ----- shortest solution for 3x3 (runs in a worker so the page stays smooth) ----- */
var FACELET = 'URFDLB', worker = null, jobs = {}, jobId = 0, mainCube = null, ready = false;
function cubeSource() { var el = document.getElementById('cubejs-src'); return el ? el.textContent : null; }
function startWorker() {
  if (worker || mainCube) return;
  var src = cubeSource(); if (!src) return;
  try {
    var code = src + '\n;var __ok=false;self.onmessage=function(e){var d=e.data;try{if(!__ok){self.Cube.initSolver();__ok=true;}self.postMessage({id:d.id,sol:self.Cube.fromString(d.str).solve()});}catch(err){self.postMessage({id:d.id,error:String(err)});}};';
    worker = new Worker(URL.createObjectURL(new Blob([code], { type: 'text/javascript' })));
    worker.onmessage = function (e) { var j = jobs[e.data.id]; if (j) { delete jobs[e.data.id]; ready = true; e.data.error ? j.reject(new Error(e.data.error)) : j.resolve(e.data.sol); } };
    worker.onerror = function () { worker = null; startMain(src); Object.keys(jobs).forEach(function (k) { var j = jobs[k]; delete jobs[k]; j.retry(); }); };
  } catch (err) { worker = null; startMain(src); }
}
function startMain(src) { if (!mainCube) { var holder = {}; mainCube = new Function(src + '\nreturn this.Cube;').call(holder); } }
function solveString(str) {
  startWorker();
  return new Promise(function (resolve, reject) {
    if (worker) { var id = ++jobId; jobs[id] = { resolve: resolve, reject: reject, retry: function () { solveString(str).then(resolve, reject); } }; worker.postMessage({ id: id, str: str }); return; }
    var src = cubeSource(); if (!src) { reject(new Error('Solver not available')); return; }
    setTimeout(function () { try { startMain(src); if (!mainCube.__init) { mainCube.initSolver(); mainCube.__init = true; } resolve(mainCube.fromString(str).solve()); } catch (e) { reject(e); } }, 20);
  });
}
function faceletString(ncols) {
  var out = [];
  for (var f = 0; f < 6; f++) for (var r = 0; r < 3; r++) for (var k = 0; k < 3; k++) out.push(FACELET.charAt(ncols[f * 9 + (2 - r) * 3 + k]));
  return out.join('');
}
function shortest(S) {
  if (S.N === 2) { var r = C2.shortest(S); return Promise.resolve(r ? { tokens: r.tokens, moves: Pz.parseAlg(2, r.tokens.join(' ')) } : null); }
  var norm = normalise(S); if (!norm) return Promise.resolve(null);
  return solveString(faceletString(norm.cols)).then(function (sol) {
    var toks = sol.trim() ? sol.trim().split(/\s+/).map(function (t) { return displayToken(norm, t); }) : [];
    return { tokens: toks, moves: Pz.parseAlg(3, toks.join(' ')) };
  });
}

/* ----- public ----- */
var STAGES_2 = [
  { name: 'First layer', short: 'First layer', blurb: 'Build one complete layer. Place the three loose corners next to the one that stays still.' },
  { name: 'Last layer', short: 'Last layer', blurb: 'Turn and place the four top corners to finish the cube.' }
];
root.Coach = {
  supports: function (N) { return N === 2 || N === 3; },
  setNames: function (names) { E.setNames(names); },
  stages: function (N) { return N === 3 ? E.STAGES : (N === 2 ? STAGES_2 : []); },
  stageOf: function (S) { return S.N === 3 ? stage3(S) : (S.N === 2 ? (Pz.isSolved(S) ? 3 : C2.stageOf(S)) : 0); },
  next: function (S, names) { if (Pz.isSolved(S)) return { done: true }; return S.N === 3 ? next3(S) : (S.N === 2 ? C2.step(S, names || E.COLOR_NAMES) : { unsupported: true }); },
  shortest: shortest, warmup: function () { if (!worker && !mainCube) startWorker(); },
  isReady: function () { return ready; },
  _faceletString: faceletString, _normalise: normalise
};
})(typeof window !== 'undefined' ? window : this);
