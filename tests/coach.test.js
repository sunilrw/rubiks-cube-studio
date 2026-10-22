const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
const ctx = { console, setTimeout, performance };
ctx.window = ctx; ctx.self = ctx;
ctx.document = { getElementById: (id) => id === 'cubejs-src' ? { textContent: fs.readFileSync(root + '/vendor/cubejs.js', 'utf8') } : null };
vm.createContext(ctx);
for (const f of ['puzzle.js', 'coach3.js', 'coach.js']) vm.runInContext(fs.readFileSync(root + '/src/' + f, 'utf8'), ctx, { filename: f });
const Pz = ctx.Puzzle, Coach = ctx.Coach;
let fails = 0;
const check = (n, ok, x) => { if (!ok) { fails++; console.log('FAIL', n, x || ''); } else console.log('ok  ', n); };

function run(N, scrambleMoves, label) {
  let S = Pz.applyMoves(Pz.solvedState(N), scrambleMoves), steps = 0, moves = 0, lastStage = 0, err = null;
  for (let g = 0; g < 60; g++) {
    const st = Coach.next(S, ['yellow', 'orange', 'green', 'white', 'red', 'blue']);
    if (st.done) break;
    if (st.error || !st.moves.length) { err = st.error || 'empty step'; break; }
    const before = Coach.stageOf(S);
    Pz.applyMoves(S, st.moves); steps++; moves += st.moves.length;
    if (Coach.stageOf(S) < before) { err = 'stage went backwards ' + before + '->' + Coach.stageOf(S); break; }
  }
  return { ok: Pz.isSolved(S) && !err, steps, moves, err };
}
for (const N of [3, 2]) {
  let bad = 0, maxMoves = 0, tot = 0, T = N === 3 ? 60 : 80;
  const t0 = Date.now();
  for (let i = 0; i < T; i++) {
    const r = run(N, Pz.scramble(N, N === 3 ? 25 : 14));
    if (!r.ok) { bad++; if (bad < 3) console.log('  bad:', r.err); }
    maxMoves = Math.max(maxMoves, r.moves); tot += r.moves;
  }
  check(N + 'x' + N + ': coach solves ' + T + ' random scrambles (avg ' + (tot / T).toFixed(0) + ' moves, max ' + maxMoves + ', ' + ((Date.now() - t0) / T).toFixed(0) + ' ms each)', bad === 0);
}
// 3x3 scrambled with middle-slice turns (centres move, so the coach has to re-orient)
{
  let bad = 0;
  for (let i = 0; i < 30; i++) {
    const sc = Pz.parseAlg(3, "M E S M' E' S' M2 E S2 R U F' M"), r = run(3, Pz.scramble(3, 12).concat(sc, Pz.scramble(3, 8)));
    if (!r.ok) { bad++; if (bad < 3) console.log('  bad:', r.err); }
  }
  check('3x3 with M/E/S turns (moved centres): coach still solves it', bad === 0);
}
// the hint explanation uses display positions, spot check
{
  const S = Pz.applyMoves(Pz.solvedState(3), Pz.parseAlg(3, "R U R' U' F"));
  const st = Coach.next(S); console.log('  sample hint:', st.stageName, '|', st.title, '|', st.explain.slice(0, 110), '|', st.tokens.join(' '));
}
// shortest solutions
(async () => {
  for (const N of [3, 2]) {
    let ok = true, tot = 0, max = 0; const T = N === 3 ? 15 : 25;
    for (let i = 0; i < T; i++) {
      const S = Pz.applyMoves(Pz.solvedState(N), Pz.scramble(N, N === 3 ? 25 : 14));
      const r = await Coach.shortest(S); if (!r) { ok = false; break; }
      Pz.applyMoves(S, r.moves); tot += r.moves.length; max = Math.max(max, r.moves.length); if (!Pz.isSolved(S)) { ok = false; break; }
    }
    check(N + 'x' + N + ': shortest solutions solve the cube (avg ' + (tot / T).toFixed(1) + ' moves, max ' + max + ')', ok);
  }
  // shortest also works after slice turns
  const S = Pz.applyMoves(Pz.solvedState(3), Pz.parseAlg(3, "M E S R U2 M' F"));
  const r = await Coach.shortest(S); Pz.applyMoves(S, r.moves);
  check('3x3 shortest solution works with moved centres', Pz.isSolved(S));
  console.log(fails ? '\n' + fails + ' FAILURES' : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})();
