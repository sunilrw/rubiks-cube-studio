const Pz = require('../src/puzzle.js');
const Old = require('../src/coach3.js');
const Cube = require('/tmp/npmwork/node_modules/cubejs');
let fails = 0;
function check(name, ok, extra) { if (!ok) { fails++; console.log('FAIL', name, extra || ''); } else console.log('ok  ', name); }
const rnd = (n) => Math.floor(Math.random() * n);
const pick = (a) => a[rnd(a.length)];
const eq = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

// ---- 1. every move: 4 quarter turns is the identity, a move and its inverse cancel, ids stay a permutation
for (const N of [2, 3, 4, 5]) {
  let ok = true;
  for (let ax = 0; ax < 3; ax++) for (let l = 0; l < N; l++) {
    const S = Pz.solvedState(N), S0 = Pz.cloneState(S);
    for (let k = 0; k < 4; k++) Pz.applyTurn(S, ax, l, 1);
    if (!eq(S.id, S0.id) || !eq(S.up, S0.up)) ok = false;
    Pz.applyTurn(S, ax, l, -1); Pz.applyTurn(S, ax, l, 1);
    if (!eq(S.id, S0.id)) ok = false;
    Pz.applyTurn(S, ax, l, 2); Pz.applyTurn(S, ax, l, 1); Pz.applyTurn(S, ax, l, 1);
    if (!eq(S.id, S0.id)) ok = false;
  }
  check(N + 'x' + N + ': all layer turns behave (x4, inverse, half turn)', ok);
}

// ---- 2. sticker "up" arrows stay flat on their face and the ids stay a permutation
for (const N of [2, 3, 4, 5]) {
  const P = Pz.create(N), S = Pz.solvedState(N);
  Pz.applyMoves(S, Pz.scramble(N, 60));
  let ok = true, seen = new Set();
  for (let i = 0; i < P.count; i++) {
    const u = Pz.DIRS[S.up[i]], n = P.nrm[i];
    if (u[0] * n[0] + u[1] * n[1] + u[2] * n[2] !== 0) ok = false;
    seen.add(S.id[i]);
  }
  check(N + 'x' + N + ': after 60 random turns every sticker is a permutation and lies flat', ok && seen.size === P.count);
}

// ---- 3. 3x3 agrees with the old, already-tested engine for face turns
{
  const P = Pz.create(3), toOld = [];
  for (let i = 0; i < P.count; i++) {
    const p = P.pos[i].map((v) => v / 2), n = P.nrm[i];
    toOld[i] = Old.STIDX[p.join(',') + '|' + n.join(',')];
  }
  let ok = true;
  for (let t = 0; t < 200; t++) {
    const toks = Old.randomScramble(25), S = Pz.solvedState(3);
    Pz.applyMoves(S, Pz.parseAlg(3, toks.join(' ')));
    const old = Old.applySeq(Old.solvedState(), toks), cols = Pz.colours(S);
    for (let i = 0; i < P.count; i++) if (cols[i] !== old[toOld[i]]) { ok = false; break; }
  }
  check('3x3 face turns match the old engine on 200 random scrambles', ok);
}

// ---- 4. whole-cube rotation equals turning all layers; slice directions follow L, D, F
for (const N of [3, 5]) {
  const a = (t) => Pz.applyMoves(Pz.applyMoves(Pz.solvedState(N), Pz.scramble(N, 12, Pz.mulberry32(5))), Pz.parseAlg(N, t));
  const lastOnly = (t) => Pz.applyMoves(Pz.solvedState(N), Pz.parseAlg(N, t));
  const base = Pz.applyMoves(Pz.solvedState(N), Pz.scramble(N, 12, Pz.mulberry32(5)));
  let ok = true;
  const sets = N === 3 ? [['x', "R M' L'"], ['y', "U E' D'"], ['z', "F S B'"]] : [['x', "R M' L'"], ['y', "U E' D'"]];
  sets.forEach(([whole, parts]) => {
    const A = Pz.applyMoves(Pz.cloneState(base), Pz.parseAlg(N, whole));
    const mats = N === 3 ? parts : (whole === 'x' ? "R Rw' L'" : "U Uw' D'");
    // for 5x5 use explicit layers: all layers on the axis, same direction
    const axis = 'xyz'.indexOf(whole), q = Pz.parse(N, whole).q, B = Pz.cloneState(base);
    for (let l = 0; l < N; l++) Pz.applyTurn(B, axis, l, q);
    if (!eq(A.id, B.id)) ok = false;
    if (N === 3) { const C = Pz.applyMoves(Pz.cloneState(base), Pz.parseAlg(3, parts)); if (!eq(A.id, C.id)) ok = false; }
  });
  check(N + 'x' + N + ': x / y / z equal turning every layer' + (N === 3 ? ', and M/E/S follow L/D/F' : ''), ok);
}

// ---- 5. notation round trips
for (const N of [2, 3, 4, 5]) {
  let ok = true, bad = '';
  const toks = [];
  for (const f of 'URFDLB') for (const s of ['', "'", '2']) { toks.push(f + s); if (N > 2) { toks.push(f + 'w' + s); toks.push('2' + f + s); } if (N > 3) toks.push('3' + f + 'w' + s); }
  if (N % 2) for (const f of 'MES') for (const s of ['', "'", '2']) toks.push(f + s);
  for (const f of 'xyz') for (const s of ['', "'", '2']) toks.push(f + s);
  toks.forEach((t) => {
    const m = Pz.parse(N, t);
    if (!m) { if (!(N === 3 && /^2[URFDLB]/.test(t)) && !(N === 3 && /^3/.test(t))) { ok = false; bad += ' parse:' + t; } return; }
    const d = Pz.describe(N, m), m2 = Pz.parse(N, d);
    if (!m2 || m2.axis !== m.axis || m2.q !== m.q || !eq(m2.layers, m.layers)) { ok = false; bad += ' rt:' + t + '->' + d; }
  });
  for (let k = 0; k < 300; k++) {
    const m = Pz.scramble(N, 3)[0], d = Pz.describe(N, m), m2 = Pz.parse(N, d);
    if (!m2 || m2.axis !== m.axis || m2.q !== m.q || !eq(m2.layers, m.layers)) { ok = false; bad += ' scr:' + d; break; }
  }
  check(N + 'x' + N + ': notation parses and prints back to the same move', ok, bad.slice(0, 200));
}
check('R U R\' U\' repeated 6 times is the identity (3x3)', (() => {
  const S = Pz.solvedState(3); for (let i = 0; i < 6; i++) Pz.applyMoves(S, Pz.parseAlg(3, "R U R' U'"));
  return eq(S.id, Pz.solvedState(3).id) && eq(S.up, Pz.solvedState(3).up);
})());
check('scramble then its inverse restores the cube (all sizes)', [2, 3, 4, 5].every((N) => {
  const sc = Pz.scramble(N, 50), S = Pz.applyMoves(Pz.solvedState(N), sc); Pz.applyMoves(S, Pz.inverseAll(sc));
  return Pz.isSolved(S) && eq(S.id, Pz.solvedState(N).id);
}));

// ---- 6. dragging: the grabbed sticker moves the way the finger moves, in the layer it sits in
{
  let tested = 0, bad = 0, nul = 0;
  function camera() {
    let R = Pz.IDENT;
    for (let k = 0; k < 3; k++) R = Pz.matMul(Pz.rotMat(rnd(3), pick([1, -1, 2])), R);
    const fine = (ang, ax) => { const c = Math.cos(ang), s = Math.sin(ang); return ax === 0 ? [[1, 0, 0], [0, c, -s], [0, s, c]] : (ax === 1 ? [[c, 0, s], [0, 1, 0], [-s, 0, c]] : [[c, -s, 0], [s, c, 0], [0, 0, 1]]); };
    R = Pz.matMul(fine(Math.random() * 1.2 - 0.6, 0), Pz.matMul(fine(Math.random() * 1.2 - 0.6, 1), R));
    return R;
  }
  const D = 28;
  for (const N of [2, 3, 4, 5]) for (let t = 0; t < 40; t++) {
    const R = camera(), P = Pz.create(N), S = Pz.solvedState(N);
    const proj = (v) => { const w = Pz.matVec(R, v.map((q) => q * 0.5)); const k = D / (D - w[2]); return [w[0] * k * 100, -w[1] * k * 100]; };
    const velFn = (p, v) => { const a = proj(p), b = proj(p.map((q, i) => q + v[i] * 1e-3)); return [(b[0] - a[0]) * 1e3, (b[1] - a[1]) * 1e3]; };
    for (let i = 0; i < P.count; i++) {
      const facing = Pz.matVec(R, P.nrm[i])[2];
      if (facing < 0.35) continue;
      for (let a = 0; a < 8; a++) {
        const ang = a * Math.PI / 4 + 0.1, dx = Math.cos(ang) * 40, dy = Math.sin(ang) * 40;
        const m = Pz.dragMove(S, i, dx, dy, velFn); tested++;
        if (!m) { nul++; continue; }
        const lay = (P.pos[i][m.axis] + N - 1) / 2;
        if (m.layers[0] !== lay) bad++;
        // finite rotation of the sticker centre
        const r0 = P.pos[i].map((v, k) => v + P.nrm[i][k]), h = 0.02 * m.q, c = Math.cos(h), s = Math.sin(h), ax = m.axis;
        const x = r0[(ax + 1) % 3], y = r0[(ax + 2) % 3], r1 = r0.slice();
        r1[(ax + 1) % 3] = x * c - y * s; r1[(ax + 2) % 3] = x * s + y * c;
        const a0 = proj(r0), a1 = proj(r1);
        if ((a1[0] - a0[0]) * dx + (a1[1] - a0[1]) * dy <= 0) bad++;
      }
    }
  }
  check('drag turns the layer under the finger, in the direction of the finger (' + tested + ' cases)', bad === 0 && nul === 0, bad + ' bad, ' + nul + ' null');
}

// ---- 7. the shortest-solution solver reads my facelets correctly
const FACELET = 'URFDLB';
function toFacelets(S) {
  const P = Pz.create(3), c = Pz.colours(S), out = [];
  for (let f = 0; f < 6; f++) for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) out.push(FACELET[c[f * 9 + (2 - r) * 3 + k]]);
  return out.join('');
}
{
  Cube.initSolver();
  let ok = true, lens = [];
  for (let t = 0; t < 40; t++) {
    const S = Pz.applyMoves(Pz.solvedState(3), Pz.scramble(3, 25)), str = toFacelets(S);
    const sol = new Cube(Cube.fromString(str)).solve ? Cube.fromString(str).solve() : null;
    const ms = Pz.parseAlg(3, sol.trim() || '') || [];
    Pz.applyMoves(S, ms); lens.push(ms.length);
    if (!Pz.isSolved(S)) { ok = false; break; }
  }
  check('solver output solves my cube (facelet mapping is right), average ' + (lens.reduce((a, b) => a + b, 0) / lens.length).toFixed(1) + ' moves', ok);
}
console.log(fails ? '\n' + fails + ' FAILURES' : '\nALL PASSED');
process.exit(fails ? 1 : 0);
