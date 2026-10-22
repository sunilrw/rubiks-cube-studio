/* Puzzle model for N x N x N cubes (2 to 5).
   State = which original sticker sits in each position, plus which way up it is.
   Moves are layer turns, written in standard notation (R, U', Rw, 2R, M, x ...). */
(function (root) {
'use strict';

var FACES = ['U', 'R', 'F', 'D', 'L', 'B'];
var FI = { U: 0, R: 1, F: 2, D: 3, L: 4, B: 5 };
var NORMALS = [[0, 1, 0], [1, 0, 0], [0, 0, 1], [0, -1, 0], [-1, 0, 0], [0, 0, -1]];
// the way "up" points when you look straight at a face (the U face is viewed with the back edge at the top)
var UPV = [[0, 0, -1], [0, 1, 0], [0, 1, 0], [0, 0, 1], [0, 1, 0], [0, 1, 0]];
var DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
var FACE_AXIS = { R: [0, 1], L: [0, -1], U: [1, 1], D: [1, -1], F: [2, 1], B: [2, -1] };

function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function dirCode(v) { for (var i = 0; i < 6; i++) if (DIRS[i][0] === v[0] && DIRS[i][1] === v[1] && DIRS[i][2] === v[2]) return i; return -1; }
function faceOfNormal(v) { for (var i = 0; i < 6; i++) if (NORMALS[i][0] === v[0] && NORMALS[i][1] === v[1] && NORMALS[i][2] === v[2]) return i; return -1; }
// right-handed quarter turn about +axis (y is up)
function rot1(v, axis, phi) {
  var x = v[0], y = v[1], z = v[2];
  if (axis === 0) return phi > 0 ? [x, -z, y] : [x, z, -y];
  if (axis === 1) return phi > 0 ? [z, y, -x] : [-z, y, x];
  return phi > 0 ? [-y, x, z] : [y, -x, z];
}
function rotQ(v, axis, q) {
  if (q === 2) return rot1(rot1(v, axis, 1), axis, 1);
  return rot1(v, axis, q);
}
function matVec(m, v) {
  return [m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2], m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2], m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2]];
}
function matMul(a, b) {
  var r = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++) for (var k = 0; k < 3; k++) r[i][j] += a[i][k] * b[k][j];
  return r;
}
function rotMat(axis, q) {
  var cols = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map(function (e) { return rotQ(e, axis, q); });
  var m = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++) m[i][j] = cols[j][i];
  return m;
}
var IDENT = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
var ROTATIONS = (function () {      // the 24 ways to hold a cube
  var out = [IDENT], seen = { '100010001': 1 }, i = 0;
  while (i < out.length) {
    [rotMat(0, 1), rotMat(1, 1)].forEach(function (g) {
      var m = matMul(g, out[i]), k = m.join(',');
      if (!seen[k]) { seen[k] = 1; out.push(m); }
    });
    i++;
  }
  return out;
})();

var cache = {};
function create(N) {
  if (cache[N]) return cache[N];
  var NN = N * N, M = 2 * N - 1, off = N - 1;
  var table = new Int16Array(M * M * M * 6).fill(-1);
  var P = { N: N, NN: NN, count: 6 * NN, pos: [], nrm: [], face: [], col: [], row: [], perms: {} };
  function tkey(p, f) { return (((p[0] + off) * M + (p[1] + off)) * M + (p[2] + off)) * 6 + f; }
  for (var f = 0; f < 6; f++) {
    var n = NORMALS[f], u = UPV[f], r = cross(u, n);
    for (var rb = 0; rb < N; rb++) for (var c = 0; c < N; c++) {
      var idx = f * NN + rb * N + c, a = 2 * c - off, b = 2 * rb - off;
      var p = [n[0] * off + r[0] * a + u[0] * b, n[1] * off + r[1] * a + u[1] * b, n[2] * off + r[2] * a + u[2] * b];
      P.pos[idx] = p; P.nrm[idx] = n; P.face[idx] = f; P.col[idx] = c; P.row[idx] = rb;
      table[tkey(p, f)] = idx;
    }
  }
  P.indexAt = function (p, fi) { return table[tkey(p, fi)]; };
  P.getPerm = function (axis, layer, q) {
    var k = axis + ',' + layer + ',' + q;
    if (P.perms[k]) return P.perms[k];
    var coord = 2 * layer - off, src = [], dst = [];
    for (var i = 0; i < P.count; i++) {
      if (P.pos[i][axis] !== coord) continue;
      var p2 = rotQ(P.pos[i], axis, q), n2 = rotQ(P.nrm[i], axis, q);
      src.push(i); dst.push(table[tkey(p2, faceOfNormal(n2))]);
    }
    return (P.perms[k] = { src: Uint16Array.from(src), dst: Uint16Array.from(dst) });
  };
  P.upRot = function (axis, q, dir) { return dirCode(rotQ(DIRS[dir], axis, q)); };
  return (cache[N] = P);
}

/* ---------- state ---------- */
function solvedState(N) {
  var P = create(N), id = new Uint16Array(P.count), up = new Uint8Array(P.count);
  for (var i = 0; i < P.count; i++) { id[i] = i; up[i] = dirCode(UPV[P.face[i]]); }
  return { N: N, id: id, up: up };
}
function cloneState(S) { return { N: S.N, id: S.id.slice(), up: S.up.slice() }; }
function copyInto(dst, S) { dst.N = S.N; dst.id = S.id.slice(); dst.up = S.up.slice(); return dst; }

function applyTurn(S, axis, layer, q) {
  var P = create(S.N), pm = P.getPerm(axis, layer, q), n = pm.src.length;
  var ids = new Uint16Array(n), ups = new Uint8Array(n), k;
  for (k = 0; k < n; k++) { ids[k] = S.id[pm.src[k]]; ups[k] = P.upRot(axis, q, S.up[pm.src[k]]); }
  for (k = 0; k < n; k++) { S.id[pm.dst[k]] = ids[k]; S.up[pm.dst[k]] = ups[k]; }
}
function applyMove(S, m) { for (var i = 0; i < m.layers.length; i++) applyTurn(S, m.axis, m.layers[i], m.q); return S; }
function applyMoves(S, ms) { for (var i = 0; i < ms.length; i++) applyMove(S, ms[i]); return S; }
function inverse(m) { return { axis: m.axis, layers: m.layers.slice(), q: m.q === 2 ? 2 : -m.q }; }
function inverseAll(ms) { return ms.slice().reverse().map(inverse); }

function colours(S) {
  var NN = S.N * S.N, out = new Uint8Array(S.id.length);
  for (var i = 0; i < out.length; i++) out[i] = (S.id[i] / NN) | 0;
  return out;
}
function isSolved(S) {
  var NN = S.N * S.N, c = colours(S);
  for (var f = 0; f < 6; f++) for (var k = 1; k < NN; k++) if (c[f * NN + k] !== c[f * NN]) return false;
  return true;
}
// how many stickers already sit on a face whose colour matches its majority, for progress bars
function progress(S) {
  var NN = S.N * S.N, c = colours(S), good = 0;
  for (var f = 0; f < 6; f++) {
    var cnt = [0, 0, 0, 0, 0, 0];
    for (var k = 0; k < NN; k++) cnt[c[f * NN + k]]++;
    good += Math.max.apply(null, cnt);
  }
  return good / (6 * NN);
}

/* ---------- notation ---------- */
function layersFromEdge(N, side, count) {
  var out = [];
  for (var k = 0; k < count; k++) out.push(side > 0 ? N - 1 - k : k);
  return out.sort(function (a, b) { return a - b; });
}
function qFrom(base, suffix) {
  if (suffix.indexOf('2') >= 0) return 2;
  return suffix.indexOf("'") >= 0 ? -base : base;
}
function parse(N, tok) {
  var m = /^([2-9]?)([URFDLB])(w?)(2'|'2|2|')?$/.exec(tok), d, fa, s, count, layers, suf;
  if (!m) {
    var lm = /^([urfdlb])(2'|'2|2|')?$/.exec(tok);
    if (lm) m = [tok, '', lm[1].toUpperCase(), 'w', lm[2] || ''];
  }
  if (m) {
    d = m[1] ? +m[1] : 0; fa = FACE_AXIS[m[2]]; s = fa[1]; suf = m[4] || '';
    if (m[3]) { count = d || 2; if (count >= N) return null; layers = layersFromEdge(N, s, count); }
    else if (d > 1) { if (d > N) return null; layers = [s > 0 ? N - d : d - 1]; }
    else layers = layersFromEdge(N, s, 1);
    return { axis: fa[0], layers: layers, q: qFrom(-s, suf) };
  }
  m = /^([MES])(2'|'2|2|')?$/.exec(tok);
  if (m) {
    if (N % 2 === 0) return null;
    var mid = (N - 1) / 2, ax = 'MES'.indexOf(m[1]), base = ax === 2 ? -1 : 1;
    return { axis: ax, layers: [mid], q: qFrom(base, m[2] || '') };
  }
  m = /^([xyz])(2'|'2|2|')?$/.exec(tok);
  if (m) {
    var all = []; for (var i = 0; i < N; i++) all.push(i);
    return { axis: 'xyz'.indexOf(m[1]), layers: all, q: qFrom(-1, m[2] || '') };
  }
  return null;
}
function parseAlg(N, text) {
  var out = [], toks = String(text).trim().split(/\s+/).filter(Boolean);
  for (var i = 0; i < toks.length; i++) { var m = parse(N, toks[i]); if (!m) return null; out.push(m); }
  return out;
}
function suffixFor(q, base) { return q === 2 ? '2' : (q === base ? '' : "'"); }
function describe(N, m) {
  var L = m.layers.slice().sort(function (a, b) { return a - b; }), k = L.length, ax = m.axis, q = m.q;
  if (k === N) return 'xyz'.charAt(ax) + suffixFor(q, -1);
  var touchesNeg = L[0] === 0, touchesPos = L[k - 1] === N - 1;
  var contiguous = L[k - 1] - L[0] === k - 1;
  var neg = ['L', 'D', 'B'][ax], pos = ['R', 'U', 'F'][ax];
  if (contiguous && touchesPos && !touchesNeg) {
    return (k === 1 ? '' : (k > 2 ? k : '')) + pos + (k === 1 ? '' : 'w') + suffixFor(q, -1);
  }
  if (contiguous && touchesNeg) {
    return (k === 1 ? '' : (k > 2 ? k : '')) + neg + (k === 1 ? '' : 'w') + suffixFor(q, 1);
  }
  if (k === 1) {
    var c = L[0];
    if (N % 2 === 1 && c === (N - 1) / 2) return 'MES'.charAt(ax) + suffixFor(q, ax === 2 ? -1 : 1);
    var dn = c, dp = N - 1 - c;
    return dp < dn ? (dp + 1) + pos + suffixFor(q, -1) : (dn + 1) + neg + suffixFor(q, 1);
  }
  return '?';
}
function describeAll(N, ms) { return ms.map(function (m) { return describe(N, m); }).join(' '); }
function plainWords(N, m) {      // for tooltips and spoken hints
  var t = describe(N, m), face = { U: 'top', D: 'bottom', F: 'front', B: 'back', L: 'left', R: 'right' };
  var f = t.replace(/[^URFDLB]/g, '').charAt(0), turn = t.indexOf('2') >= 0 ? 'a half turn' : (t.indexOf("'") >= 0 ? 'a quarter turn anticlockwise' : 'a quarter turn clockwise');
  if (face[f] && m.layers.length === 1 && (m.layers[0] === 0 || m.layers[0] === N - 1)) return 'Turn the ' + face[f] + ' face ' + turn;
  if (face[f]) return 'Turn the ' + face[f] + ' side ' + turn + ' (' + t + ')';
  return 'Turn ' + t;
}

/* ---------- scrambles ---------- */
function mulberry32(a) {
  return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function defaultLength(N) { return N === 2 ? 11 : (N === 3 ? 22 : (N === 4 ? 40 : 60)); }
function scramble(N, len, rng) {
  rng = rng || Math.random; len = len || defaultLength(N);
  var out = [], lastAxis = -1, lastKey = '';
  while (out.length < len) {
    var ax = Math.floor(rng() * 3), layer, key;
    if (N === 3 || N === 2) layer = rng() < 0.5 ? 0 : N - 1;
    else layer = Math.floor(rng() * N);
    key = ax + ',' + layer;
    if (ax === lastAxis && (key === lastKey || out.length < 1)) continue;
    if (ax === lastAxis && rng() < 0.8) continue;
    var q = [1, -1, 2][Math.floor(rng() * 3)];
    out.push({ axis: ax, layers: [layer], q: q }); lastAxis = ax; lastKey = key;
  }
  return out;
}

/* ---------- dragging ---------- */
// i = sticker index grabbed, (dx, dy) = drag on screen, velFn(pos, vel) = where that motion goes on screen
function dragMove(S, i, dx, dy, velFn) {
  var P = create(S.N), na = P.nrm[i][0] ? 0 : (P.nrm[i][1] ? 1 : 2), best = null;
  var r = [P.pos[i][0] + P.nrm[i][0], P.pos[i][1] + P.nrm[i][1], P.pos[i][2] + P.nrm[i][2]];
  for (var b = 0; b < 3; b++) {
    if (b === na) continue;
    var e = [0, 0, 0]; e[b] = 1;
    var sv = velFn(r, cross(e, r)), dot = dx * sv[0] + dy * sv[1];
    if (!best || Math.abs(dot) > Math.abs(best.dot)) best = { b: b, dot: dot };
  }
  if (!best || Math.abs(best.dot) < 1e-9) return null;
  return { axis: best.b, layers: [(P.pos[i][best.b] + S.N - 1) / 2], q: best.dot >= 0 ? 1 : -1 };
}

/* ---------- whole-cube turns of a colour array (for the coaches) ---------- */
function rotateColours(N, cols, R) {
  var P = create(N), out = new Uint8Array(cols.length);
  for (var i = 0; i < cols.length; i++) {
    var p2 = matVec(R, P.pos[i]), n2 = matVec(R, P.nrm[i]);
    out[P.indexAt(p2, faceOfNormal(n2))] = cols[i];
  }
  return out;
}

var API = {
  FACES: FACES, FI: FI, NORMALS: NORMALS, UPV: UPV, DIRS: DIRS, FACE_AXIS: FACE_AXIS, ROTATIONS: ROTATIONS, IDENT: IDENT,
  create: create, solvedState: solvedState, cloneState: cloneState, copyInto: copyInto,
  applyTurn: applyTurn, applyMove: applyMove, applyMoves: applyMoves, inverse: inverse, inverseAll: inverseAll,
  colours: colours, isSolved: isSolved, progress: progress,
  parse: parse, parseAlg: parseAlg, describe: describe, describeAll: describeAll, plainWords: plainWords,
  scramble: scramble, defaultLength: defaultLength, mulberry32: mulberry32,
  dragMove: dragMove, rotateColours: rotateColours,
  cross: cross, matVec: matVec, matMul: matMul, rotMat: rotMat, rotQ: rotQ, dirCode: dirCode, faceOfNormal: faceOfNormal
};
if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.Puzzle = API;
})(typeof window !== 'undefined' ? window : this);
