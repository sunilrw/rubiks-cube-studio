/* Rubik's Cube Studio: wires the menu, the coach, the modes and the 3D view together. */
(function () {
'use strict';
var Pz = Puzzle, Th = Themes, St = Store, cfg = St.settings;
function $(id) { return document.getElementById(id); }
function h(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; }
function each(list, fn) { Array.prototype.forEach.call(list, fn); }
var SPEED_NAMES = ['Slowest', 'Slow', 'Normal', 'Fast', 'Faster', 'Very fast', 'Instant'], SPEED_MS = [720, 440, 250, 150, 90, 50, 0];
var MODE_NAMES = { free: 'Free play', learn: 'Learn', challenge: 'Challenge' };
var BG_PREVIEW = { studio: ['#2a3a4c', '#0b1118'], daylight: ['#cfe6ff', '#f4f8fb'], stars: ['#1a1c3a', '#05060f'], aurora: ['#2fd6a4', '#3b1d6b'], synthwave: ['#ff3d9a', '#2b0a4a'], ocean: ['#0a7fa8', '#04344d'], bokeh: ['#f78c6b', '#1b1428'], embers: ['#ff6a2b', '#1a0b08'], photo: ['#777', '#333'] };

var G = { size: cfg.size, mode: cfg.mode, hist: [], redo: [], base: [], armed: false, helped: false, daily: false, timer: { status: 'idle', t0: 0, elapsed: 0 },
  hint: null, runId: 0, playing: false, photoImg: null, bgPhoto: false, inspectLeft: 0, inspectIv: 0, saveT: 0, depth: 'outer', padOpen: false };

/* ---------- little helpers ---------- */
function toast(msg) { var box = $('toast'); box.innerHTML = ''; var p = h('p'); p.textContent = msg; box.appendChild(p); setTimeout(function () { if (p.parentNode === box) box.removeChild(p); }, 3300); }
function fmt(ms) { var t = Math.max(0, ms) / 1000, m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1); }
function sizeText(n) { return n + '×' + n; }
function isMobile() { return window.matchMedia('(max-width: 820px)').matches; }
function eqState(a, b) { if (!a || !b || a.id.length !== b.id.length) return false; for (var i = 0; i < a.id.length; i++) if (a.id[i] !== b.id[i]) return false; return true; }
function speedMs(m) { var b = SPEED_MS[cfg.speed]; return m && m.q === 2 ? b * 1.35 : b; }
function themeNow() { return Th.getTheme(cfg.kind, cfg.id); }
function colourDots() { return Th.faceColours(themeNow()); }
function faceOfMove(m) { var n = [0, 0, 0]; n[m.axis] = m.layers.indexOf(G.size - 1) >= 0 ? 1 : (m.layers.indexOf(0) >= 0 ? -1 : 1); return Pz.faceOfNormal(n); }
function sameMove(a, b) { return a.axis === b.axis && a.q === b.q && a.layers.join() === b.layers.join(); }

/* ---------- the view ---------- */
var view = CubeView($('stage'), { onMove: onMove });
var bg = FX.Backgrounds($('bg')), confetti = FX.Confetti($('fx')), Sound = FX.Sound, hand = Hand($('hand'), $('finger'), $('trailLine'));
attachInput(view, { onGesture: function () { Sound.unlock(); }, onTurnStart: function () { cancelPlay(); } });

/* ---------- modal ---------- */
function openModal(title, bodyNode, actions) {
  $('modalTitle').textContent = title; var b = $('modalBody'); b.innerHTML = ''; b.appendChild(bodyNode);
  var a = $('modalActions'); a.innerHTML = '';
  actions.forEach(function (x) { var btn = h('button', 'btn' + (x.cls ? ' ' + x.cls : ''), x.label); btn.type = 'button'; btn.onclick = function () { closeModal(); if (x.fn) x.fn(); }; a.appendChild(btn); });
  $('modal').hidden = false; var first = a.querySelector('button'); if (first) first.focus();
}
function closeModal() { $('modal').hidden = true; }
$('modal').addEventListener('pointerdown', function (e) { if (e.target === $('modal')) closeModal(); });

/* ---------- HUD, timer, progress ---------- */
function elapsed() { var t = G.timer; return t.status === 'running' ? performance.now() - t.t0 : t.elapsed; }
function updateHud() {
  var n = G.hist.length, ms = elapsed();
  $('chipMoves').textContent = n; $('chipTime').textContent = fmt(ms);
  $('chipTps').textContent = G.timer.status !== 'idle' && ms > 400 ? (n / (ms / 1000)).toFixed(1) : '0.0';
  $('modeChip').textContent = MODE_NAMES[G.mode] + ' · ' + sizeText(G.size) + (G.daily ? ' · Daily' : '');
  var p = Pz.progress(view.state); $('progressBar').style.width = Math.max(0, Math.min(100, (p - 0.3) / 0.7 * 100)).toFixed(0) + '%';
  $('hist').textContent = n ? (n > 40 ? '… ' : '') + Pz.describeAll(G.size, G.hist.slice(-40)) : 'No moves yet.';
  $('dUndo').disabled = $('mUndo').disabled = !n; $('mRedo').disabled = !G.redo.length; $('mRewind').disabled = !n;
}
setInterval(function () { if (G.timer.status === 'running') { var ms = elapsed(); $('chipTime').textContent = fmt(ms); $('chipTps').textContent = ms > 400 ? (G.hist.length / (ms / 1000)).toFixed(1) : '0.0'; } }, 80);
function resetTimer(status) { stopInspect(); G.timer = { status: status || 'idle', t0: 0, elapsed: 0 }; }
function startTimer() {
  if (G.timer.status === 'idle' || G.timer.status === 'ready' || G.timer.status === 'inspect') { stopInspect(); G.timer.status = 'running'; G.timer.t0 = performance.now() - G.timer.elapsed; }
}
function stopInspect() { clearInterval(G.inspectIv); G.inspectIv = 0; $('inspect').hidden = true; }
function startInspect() {
  G.timer.status = 'inspect'; G.inspectLeft = 15; $('inspectNum').textContent = G.inspectLeft; $('inspect').hidden = false;
  G.inspectIv = setInterval(function () {
    G.inspectLeft--; $('inspectNum').textContent = Math.max(0, G.inspectLeft); if (G.inspectLeft > 0 && G.inspectLeft <= 3) Sound.tick();
    if (G.inspectLeft <= 0) { stopInspect(); if (G.timer.status === 'inspect') { G.timer.status = 'ready'; toast('Go! The timer starts on your first turn.'); } }
  }, 1000);
}

/* ---------- saving the game in progress ---------- */
function enc(list) { return list.map(function (m) { return [m.axis, m.layers, m.q]; }); }
function dec(list) { return (list || []).map(function (a) { return { axis: a[0], layers: a[1], q: a[2] }; }); }
function saveSoon() {
  clearTimeout(G.saveT);
  G.saveT = setTimeout(function () {
    var S = view.state; St.saveGame({ size: G.size, id: Array.from(S.id), up: Array.from(S.up), hist: enc(G.hist), base: enc(G.base), armed: G.armed, helped: G.helped, status: G.timer.status, elapsed: elapsed() });
  }, 350);
}
function restoreGame() {
  var g = St.loadGame(); if (!g || g.size !== G.size) return;
  var NN = G.size * G.size * 6;
  if (!g.id || g.id.length !== NN || !g.up || g.up.length !== NN || g.id.some(function (v) { return !(v >= 0 && v < NN); })) return;
  view.setState({ N: G.size, id: new Uint16Array(g.id), up: new Uint8Array(g.up) });
  G.hist = dec(g.hist); G.base = dec(g.base); G.armed = !!g.armed && !Pz.isSolved(view.state); G.helped = !!g.helped;
  if (Pz.isSolved(view.state)) { resetTimer('idle'); }
  else if (g.status === 'running') { G.timer = { status: 'running', t0: performance.now() - (g.elapsed || 0), elapsed: g.elapsed || 0 }; }
  else G.timer = { status: g.status === 'ready' || g.status === 'inspect' ? 'ready' : 'idle', t0: 0, elapsed: g.elapsed || 0 };
}

/* ---------- moves arriving from the view ---------- */
function onMove(m, source) {
  if (source === 'scramble' || source === 'pattern') { G.base.push(m); return; }
  if (source === 'user' || source === 'coach' || source === 'alg') {
    G.hist.push(m); G.redo = [];
    if (source !== 'user') G.helped = true;
    startTimer();
  }
  if (SPEED_MS[cfg.speed] > 0 || source === 'user') Sound.turn();
  if (cfg.haptic && source === 'user') Sound.haptic(8);
  bg.pulse(0.12);
  updateHud(); trackHint(source); checkSolved(source); saveSoon();
  if (!$('menu').hidden && $('menu').classList.contains('open')) refreshLearn();
}
function checkSolved(source) {
  if (source === 'undo' || source === 'redo' || source === 'rewind' || source === 'retrace') return;
  if (!Pz.isSolved(view.state) || G.hist.length < 1) return;
  if (G.timer.status === 'done') return;
  if (G.armed) return onSolved(true);
  if (G.hist.length >= 4 && G.timer.status === 'running') onSolved(false);
}
function onSolved(full) {
  var ms = elapsed(), moves = G.hist.length, tps = ms > 0 ? moves / (ms / 1000) : 0, res = null;
  G.timer.elapsed = ms; G.timer.status = 'done'; stopInspect(); closeHint();
  Sound.solve(); if (cfg.haptic) Sound.haptic(40); bg.pulse(1.2);
  var cols = colourDots(); if (cfg.confetti) { confetti.fireworks(cols); confetti.burst(cols, innerWidth / 2, innerHeight * 0.4, 130); }
  if (!full) { toast('Solved! ' + fmt(ms) + ' and ' + moves + ' moves.'); updateHud(); return; }
  if (!G.helped) res = St.addSolve(G.size, ms, moves);
  G.armed = false; var wasDaily = G.daily;
  var body = h('div'), big = h('div', 'big');
  [['Time', fmt(ms)], ['Moves', moves], ['Turns/s', tps.toFixed(1)]].forEach(function (x) { big.appendChild(h('div', '', '<b>' + x[1] + '</b><span>' + x[0] + '</span>')); });
  body.appendChild(big);
  var msg = h('p', '', res ? (res.best ? '<span class="badge">New personal best</span> for ' + sizeText(G.size) + '.' : 'Your best for ' + sizeText(G.size) + ' is ' + fmt(res.rec.best) + '.')
    : 'Solved with help, so this one does not count as a record. Try again with no hints to set a time.');
  msg.style.marginTop = '12px'; body.appendChild(msg);
  openModal(wasDaily ? 'Daily challenge solved' : 'Solved!', body, [{ label: 'Scramble again', cls: 'primary', fn: function () { doScramble(); } }, { label: 'Close' }]);
  renderRecords(); if (cfg.autoBg) nextBackground(); saveSoon();
}

/* ---------- scramble, size, patterns ---------- */
function clearBoard() { cancelPlay(); closeHint(); view.snap(); G.hist = []; G.redo = []; G.base = []; G.helped = false; G.armed = false; resetTimer('idle'); }
function doScramble(seed) {
  var N = G.size, len = cfg.scrLen[N] || Pz.defaultLength(N);
  clearBoard(); G.daily = seed != null; G.armed = true;
  var mv = Pz.scramble(N, len, seed != null ? Pz.mulberry32(seed) : Math.random), last = null;
  view.setState(Pz.solvedState(N));
  mv.forEach(function (m, i) { last = view.turn(m, { ms: i >= mv.length - 12 && SPEED_MS[cfg.speed] > 0 ? 55 : 0, source: 'scramble' }); });
  (last || Promise.resolve()).then(function () {
    Sound.good(); resetTimer('ready'); updateHud(); saveSoon();
    if (G.mode === 'challenge' && cfg.inspect) startInspect();
    else if (G.mode === 'learn') openHint('coach');
  });
}
function dailySeed() { var d = new Date(); return (d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()) * 10 + G.size; }
function doSolved() { clearBoard(); G.daily = false; view.setState(Pz.solvedState(G.size)); updateHud(); saveSoon(); toast('Solved cube.'); }
function setSize(n, quiet) {
  if (n === G.size && quiet) return;
  clearBoard(); G.size = cfg.size = n; G.daily = false; St.save(); view.setSize(n);
  buildPad(); syncSize(); updateHud(); saveSoon(); if (!quiet) Sound.good();
  if (G.mode === 'learn' && !Coach.supports(n)) toast('The coach is for 2×2 and 3×3. You can still play, scramble and retrace.');
  setTimeout(updateInsets, 0);
}
var PATTERNS = [
  { name: 'Checkerboard', alg: 'R2 L2 U2 D2 F2 B2' }, { name: 'Six spots', alg: "U D' R L' F B' U D'" },
  { name: 'Cube in a cube', alg: "F L F U' R U F2 L2 U' L' B D' B' L2 U" }, { name: 'Superflip', alg: "U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2" }
];
function doPattern(p) {
  if (G.size !== 3) { toast('Patterns are made for the 3×3. Switch the size to 3×3 first.'); return; }
  clearBoard(); G.daily = false; view.setState(Pz.solvedState(3));
  var mv = Pz.parseAlg(3, p.alg); mv.forEach(function (m) { view.turn(m, { ms: SPEED_MS[cfg.speed] > 0 ? 70 : 0, source: 'pattern' }); });
  toast(p.name + '. Use Retrace to go back to a solved cube.'); updateHud(); saveSoon();
}

/* ---------- undo, redo, rewind, retrace ---------- */
function undo() { if (!G.hist.length) { toast('Nothing to undo.'); return; } cancelPlay(); var m = G.hist.pop(); G.redo.push(m); view.turn(Pz.inverse(m), { ms: speedMs(m), source: 'undo' }); }
function redo() { if (!G.redo.length) return; cancelPlay(); var m = G.redo.pop(); G.hist.push(m); view.turn(m, { ms: speedMs(m), source: 'redo' }); }
function rewind() {
  if (!G.hist.length) return; cancelPlay();
  var fast = SPEED_MS[cfg.speed] > 0 ? 80 : 0;
  while (G.hist.length) { var m = G.hist.pop(); G.redo.push(m); view.turn(Pz.inverse(m), { ms: fast, source: 'rewind' }); }
}
function retrace() {
  if (G.mode === 'challenge') { toast('Help is off in Challenge mode.'); return; }
  var back = Pz.inverseAll(G.hist).concat(Pz.inverseAll(G.base));
  if (!back.length) { toast(Pz.isSolved(view.state) ? 'The cube is already solved.' : 'No moves to retrace. Use Scramble to start a new one.'); return; }
  cancelPlay(); closeHint(); G.helped = true; G.hist = []; G.redo = []; G.base = []; G.armed = false;
  var fast = SPEED_MS[cfg.speed] > 0 ? 60 : 0, last = null;
  back.forEach(function (m) { last = view.turn(m, { ms: fast, source: 'retrace' }); });
  last.then(function () { resetTimer('idle'); updateHud(); Sound.solve(); toast('Solved by retracing every move.'); if (cfg.confetti) confetti.burst(colourDots(), innerWidth / 2, innerHeight * 0.4, 80); saveSoon(); });
}
function playText(text, src) {
  var t = String(text).replace(/[’‘′`]/g, "'").trim(), mv = Pz.parseAlg(G.size, t);
  if (!t) return false;
  if (!mv) { $('algNote').textContent = 'I could not read "' + t + '". Use letters like R U F with ' + "'" + ' or 2, for example R U R' + "'" + ' U' + "'" + '.'; return false; }
  $('algNote').textContent = 'Playing ' + mv.length + ' move' + (mv.length === 1 ? '' : 's') + '.'; cancelPlay();
  mv.forEach(function (m) { view.turn(m, { ms: speedMs(m), source: 'alg' }); }); return true;
}

/* ---------- coach: hints that follow what you do ---------- */
function helpAllowed() { if (G.mode === 'challenge') { toast('Hints are off in Challenge mode. Choose Free play or Learn to use them.'); return false; } return true; }
function cancelPlay() { G.runId++; G.playing = false; }
function buildHint(o) {
  var s = Pz.cloneState(view.state), states = [Pz.cloneState(s)];
  o.moves.forEach(function (m) { Pz.applyMove(s, m); states.push(Pz.cloneState(s)); });
  o.states = states; o.idx = 0; o.pending = null; return o;
}
function openHint(kind, quiet) {
  if (G.mode === 'challenge') return helpAllowed();
  var S = view.state;
  if (Pz.isSolved(S)) { closeHint(); if (!quiet) toast('Already solved. Scramble it to practise.'); return; }
  if (!Coach.supports(G.size)) { toast('The step coach is for 2×2 and 3×3. Here you can use Retrace to solve by undoing your moves.'); return; }
  Sound.unlock(); Coach.warmup();
  var snap = Pz.cloneState(S);
  try {
    if (kind === 'best') {
      toast('Finding the shortest solution…');
      Coach.shortest(S).then(function (r) {
        if (!eqState(snap, view.state)) return;
        if (!r || !r.moves || !r.moves.length) { toast('Could not find a solution from this position.'); return; }
        G.helped = true;
        showHint(buildHint({ kind: 'best', stageText: 'Shortest', title: 'Shortest solution: ' + r.moves.length + ' moves', tokens: r.tokens, moves: r.moves,
          explain: 'A computer searched for the shortest route from your exact cube. It is not meant to be memorised. Watch the pattern and try to see what each group of turns does.' }));
      }, function () { toast('The solver could not start in this browser.'); });
      return;
    }
    var r = Coach.next(S, colourNames());
    if (r.done) { closeHint(); return; }
    if (r.error || !r.moves || !r.moves.length) { toast(r.error || 'The coach could not find a way forward. Try Undo.'); return; }
    G.helped = true;
    showHint(buildHint({ kind: 'coach', stageText: 'Stage ' + r.stage + ' of ' + Coach.stages(G.size).length + ' · ' + r.stageName, title: r.title, explain: r.explain, tokens: r.tokens, moves: r.moves }));
  } catch (e) { toast('The coach hit a problem. Try Undo or Scramble.'); if (window.console) console.error(e); }
}
function colourNames() { return themeNow().names; }
function showHint(H) { G.hint = H; renderHint(); }
function curMove(H) { return H.pending || H.moves[H.idx]; }
function renderHint() {
  var H = G.hint; if (!H) return;
  var n = H.moves.length, cur = H.idx < n ? curMove(H) : null;
  $('cardStage').textContent = H.stageText; $('cardCount').textContent = cur ? 'Move ' + (H.idx + 1) + ' of ' + n : 'Step finished';
  $('cardTitle').textContent = H.title; $('cardText').textContent = H.explain + (H.pending ? ' You have done half of it. Turn the same way once more.' : '');
  $('cardTok').textContent = cur ? (H.pending ? H.tokens[H.idx].replace('2', '') : H.tokens[H.idx]) : '✓';
  $('cardWords').textContent = cur ? Pz.plainWords(G.size, cur) : 'Looking for the next step…';
  var chips = $('cardChips'); chips.innerHTML = ''; chips.appendChild(h('small', '', 'Moves'));
  H.tokens.forEach(function (t, i) { chips.appendChild(h('span', 'mv' + (i < H.idx ? ' done' : (i === H.idx ? ' now' : '')), t)); });
  $('card').hidden = false; updateInsets();
  var cn = chips.querySelector('.now'); if (cn && cn.scrollIntoView) { try { cn.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) {} }
  view.clearGuide(); hand.stop();
  if (!cur) return;
  if (cfg.arrows) view.showGuide(cur);
  var wait = 150; if (cfg.follow) { var f = faceOfMove(cur); if (view.isFacing(f) <= 0.5) { view.showFace(f); wait = 750; } }
  var idx = H.idx, pend = H.pending;
  if (cfg.hand) setTimeout(function () { if (G.hint === H && H.idx === idx && H.pending === pend && !G.playing) hand.start(function () { return view.fingerPath(cur); }); }, wait);
}
function closeHint() { cancelPlay(); G.hint = null; $('card').hidden = true; view.clearGuide(); hand.stop(); updateInsets(); }
function trackHint(source) {
  var H = G.hint; if (!H) return;
  var S = view.state, j, n = H.moves.length;
  for (j = n; j > H.idx; j--) if (eqState(S, H.states[j])) { H.idx = j; H.pending = null; if (j >= n) return stepFinished(H); return renderHint(); }
  if (eqState(S, H.states[H.idx])) { if (H.pending) { H.pending = null; renderHint(); } return; }
  var cur = H.moves[H.idx];
  if (cur && cur.q === 2 && !H.pending) {
    for (var k = 0; k < 2; k++) {
      var q = k ? -1 : 1, t = Pz.cloneState(H.states[H.idx]); Pz.applyMove(t, { axis: cur.axis, layers: cur.layers, q: q });
      if (eqState(S, t)) { H.pending = { axis: cur.axis, layers: cur.layers, q: q }; return renderHint(); }
    }
  }
  if (G.playing) return;
  if (source !== 'undo' && source !== 'redo' && source !== 'rewind') toast('No problem. The coach has re-planned from where you are.');
  setTimeout(function () { if (G.hint === H && !G.playing) openHint(H.kind, true); }, 250);
}
function stepFinished(H) {
  if (G.playing) { renderHint(); return; }
  renderHint();
  setTimeout(function () { if (G.hint === H && !G.playing) { if (Pz.isSolved(view.state)) closeHint(); else openHint(H.kind === 'best' ? 'coach' : H.kind, true); } }, 700);
}
// play moves of the current step (limit = how many); resolves when finished or cancelled
function playRaw(id, limit) {
  return new Promise(function (done) {
    var H = G.hint, n = 0;
    (function loop() {
      if (id !== G.runId || G.hint !== H || !H) return done(false);
      if (H.idx >= H.moves.length || n >= limit) return done(true);
      var m = curMove(H); n++; hand.stop();
      view.turn(m, { ms: speedMs(m) || 0, source: 'coach' }).then(loop);
    })();
  });
}
function playStep(limit) {
  if (!G.hint) return; var id = ++G.runId; G.playing = true;
  playRaw(id, limit).then(function () { if (id === G.runId) { G.playing = false; var H = G.hint; if (H) { if (H.idx >= H.moves.length) stepFinished(H); else renderHint(); } } });
}
function solveAll() {
  if (!helpAllowed()) return;
  if (!Coach.supports(G.size)) { retrace(); return; }
  if (Pz.isSolved(view.state)) { toast('Already solved. Scramble it to practise.'); return; }
  var id = ++G.runId; G.playing = true; G.helped = true;
  (function next() {
    if (id !== G.runId) return;
    if (Pz.isSolved(view.state)) { G.playing = false; return; }
    var r = Coach.next(view.state, colourNames());
    if (r.done || r.error || !r.moves || !r.moves.length) { G.playing = false; if (r.error) toast(r.error); return; }
    showHint(buildHint({ kind: 'coach', stageText: 'Stage ' + r.stage + ' of ' + Coach.stages(G.size).length + ' · ' + r.stageName, title: r.title, explain: r.explain, tokens: r.tokens, moves: r.moves }));
    G.playing = true;
    setTimeout(function () { playRaw(id, 1e9).then(function (ok) { if (ok && id === G.runId) setTimeout(next, SPEED_MS[cfg.speed] > 80 ? 900 : 200); }); }, 400);
  })();
}

/* ---------- menu, tabs, panels ---------- */
function setMenu(open) {
  var m = $('menu'); m.classList.toggle('open', open); $('btnMenu').setAttribute('aria-expanded', open ? 'true' : 'false');
  document.body.classList.toggle('sheet-open', open); updateInsets(); if (open) { refreshLearn(); renderRecords(); }
}
function toggleMenu() { setMenu(!$('menu').classList.contains('open')); }
function showTab(name) {
  each($('tabs').children, function (b) { b.setAttribute('aria-selected', b.getAttribute('data-tab') === name ? 'true' : 'false'); });
  each(document.querySelectorAll('.tabpanel'), function (p) { p.hidden = p.getAttribute('data-panel') !== name; });
  $('menu').querySelector('.menu-body').scrollTop = 0; if (name === 'learn') refreshLearn();
}
$('tabs').addEventListener('click', function (e) { var b = e.target.closest('button[data-tab]'); if (b) showTab(b.getAttribute('data-tab')); });
$('btnMenu').onclick = toggleMenu; $('menuClose').onclick = function () { setMenu(false); };

function updateInsets() {
  var open = $('menu').classList.contains('open'), mobile = isMobile(), dockH = $('dock').offsetHeight || 56, r = 0, b = dockH + 24, t = 66;
  document.documentElement.style.setProperty('--dock-h', dockH + 'px');
  if (!mobile && open) r = $('menu').offsetWidth + 22;
  document.documentElement.style.setProperty('--right-inset', r + 'px');
  if (!$('card').hidden) b += $('card').offsetHeight + 8;
  if (!$('pad').hidden) b += $('pad').offsetHeight + 8;
  if (mobile && open) b = $('menu').offsetHeight + 18;
  view.setInsets(0, t, r, b);
}
var insetRaf = 0; function insetSoon() { cancelAnimationFrame(insetRaf); insetRaf = requestAnimationFrame(updateInsets); }
window.addEventListener('resize', insetSoon);
if (window.ResizeObserver) { var ro = new ResizeObserver(insetSoon); ['card', 'dock', 'pad', 'menu'].forEach(function (id) { ro.observe($(id)); }); }

/* size and mode */
function syncSize() {
  each($('sizeSeg').children, function (b) { b.setAttribute('aria-pressed', +b.getAttribute('data-size') === G.size ? 'true' : 'false'); });
  var notes = { 2: '2×2 pocket cube: 4 stickers per face. Coach and shortest solution work here.', 3: '3×3 classic cube: 9 stickers per face. Full coach, shortest solution and every look.',
    4: '4×4 revenge cube: 16 stickers per face. Play, scramble, undo, rewind and retrace. The step coach is for 2×2 and 3×3.', 5: '5×5 professor cube: 25 stickers per face. Play, scramble, undo, rewind and retrace. The step coach is for 2×2 and 3×3.' };
  $('sizeNote').textContent = notes[G.size];
  var len = cfg.scrLen[G.size] || Pz.defaultLength(G.size); $('scrLen').value = len; $('scrLenOut').textContent = len;
  var can = Coach.supports(G.size);
  $('lAuto').textContent = can ? 'Solve step by step' : 'Retrace to solved'; $('lBest').disabled = !can; $('lHint').disabled = !can;
  refreshLearn();
}
function syncMode() {
  each($('modeList').children, function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-mode') === G.mode ? 'true' : 'false'); });
  var ch = G.mode === 'challenge'; ['dHint', 'lHint', 'lAuto', 'lBest', 'cardAuto'].forEach(function (id) { $(id).title = ch ? 'Off in Challenge mode' : ''; });
  $('dHint').style.opacity = ch ? '0.45' : ''; updateHud();
}
function setMode(m) {
  if (m === G.mode) return; G.mode = cfg.mode = m; St.save(); syncMode();
  if (m === 'challenge') { closeHint(); toast('Challenge: no hints. ' + (cfg.inspect ? 'You get 15 seconds to look.' : 'The timer starts on your first turn.')); if (Pz.isSolved(view.state)) doScramble(); else if (cfg.inspect && G.timer.status !== 'running') { G.armed = true; startInspect(); } }
  else if (m === 'learn') { if (!Coach.supports(G.size)) toast('The coach is for 2×2 and 3×3. Change the size to learn step by step.'); else if (Pz.isSolved(view.state)) doScramble(); else openHint('coach'); }
  else { stopInspect(); if (G.timer.status === 'inspect') G.timer.status = 'ready'; }
}
$('sizeSeg').onclick = function (e) { var b = e.target.closest('button[data-size]'); if (b) setSize(+b.getAttribute('data-size')); };
$('modeList').onclick = function (e) { var b = e.target.closest('button[data-mode]'); if (b) setMode(b.getAttribute('data-mode')); };
$('mScramble').onclick = $('dScramble').onclick = function () { Sound.unlock(); doScramble(); };
$('mDaily').onclick = function () { Sound.unlock(); if (G.mode !== 'challenge') { G.mode = cfg.mode = 'challenge'; St.save(); syncMode(); } doScramble(dailySeed()); toast("Today's challenge: everyone gets the same scramble on the same size."); };
$('mSolved').onclick = doSolved;
$('scrLen').oninput = function () { cfg.scrLen[G.size] = +this.value; $('scrLenOut').textContent = this.value; St.save(); };
$('chkInspect').onchange = function () { cfg.inspect = this.checked; St.save(); };
$('mUndo').onclick = $('dUndo').onclick = undo; $('mRedo').onclick = redo; $('mRewind').onclick = rewind;
$('algPlay').onclick = function () { playText($('algIn').value, 'alg'); };
$('algIn').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); playText(this.value, 'alg'); } e.stopPropagation(); });
PATTERNS.forEach(function (p) { var b = h('button', '', p.name); b.type = 'button'; b.onclick = function () { doPattern(p); }; $('patterns').appendChild(b); });

/* learn */
function refreshLearn() {
  var list = $('stageList'), N = G.size; list.innerHTML = '';
  if (!Coach.supports(N)) { $('learnNote').textContent = 'The step coach is for 2×2 and 3×3. On this size you can scramble, play, undo, rewind and retrace the moves back to solved.'; return; }
  var stages = Coach.stages(N), cur = Coach.stageOf(view.state), solved = Pz.isSolved(view.state);
  stages.forEach(function (s, i) {
    var done = solved || cur > i + 1, now = !solved && cur === i + 1, row = h('div', 'st' + (done ? ' done' : '') + (now ? ' now' : ''));
    row.appendChild(h('i')); var d = h('div'); d.appendChild(h('b', '', s.name)); d.appendChild(h('br')); d.appendChild(h('small', '', s.blurb)); row.appendChild(d); row.appendChild(h('small', '', done ? 'Done' : (now ? 'Now' : ''))); list.appendChild(row);
  });
  $('learnNote').textContent = solved ? 'The cube is solved. Scramble it to practise again.' : (G.mode === 'challenge' ? 'Hints are off in Challenge mode.' : 'Press Hint for the next step. The coach explains why, shows the layer and a moving hand, and follows your own turns.');
}
$('lHint').onclick = $('dHint').onclick = function () { if (!helpAllowed()) return; openHint('coach'); };
$('lAuto').onclick = $('cardAuto').onclick = solveAll;
$('lBest').onclick = function () { if (!helpAllowed()) return; openHint('best'); };
$('cardPlay').onclick = function () { playStep(1e9); }; $('cardOne').onclick = function () { playStep(1); };
$('cardNew').onclick = function () { if (G.hint) openHint(G.hint.kind, true); }; $('cardClose').onclick = closeHint;
$('chkHand').onchange = function () { cfg.hand = this.checked; hand.setEnabled(this.checked); St.save(); if (G.hint) renderHint(); };
$('chkArrows').onchange = function () { cfg.arrows = this.checked; St.save(); if (G.hint) renderHint(); };
$('chkFollow').onchange = function () { cfg.follow = this.checked; St.save(); };

var METHODS = [
  ['Beginner, layer by layer', 'What the coach teaches', 'Make a cross on the bottom, place the bottom corners, then the middle-layer edges. Next make a cross on top, turn the top corners, place them, and finish the last edges. Few algorithms, and every step is easy to check. Expect 100 or so moves and a few minutes at first.'],
  ['CFOP (Fridrich)', 'Most popular for speed', 'Cross, then the first two layers together (F2L), then orient the last layer (OLL) and permute it (PLL). About 55 moves. Learn F2L by understanding it, then add OLL and PLL a few cases at a time. Most top times use this.'],
  ['Roux', 'Fewest rotations', 'Build two 1×2×3 blocks on the left and right, place the top corners, then finish the last six edges using only M and U turns. About 45 moves and very smooth, but it asks for good block-building sense.'],
  ['ZZ', 'Edges first', 'Orient every edge first so the rest can be solved with only R, U and L turns. Then build two blocks and finish the last layer. Great for turning without rotating the cube.'],
  ['Shortest solution', 'For wonder, not memory', 'Every 3×3 can be solved in 20 moves or fewer. The button in this app runs a two-phase search on your exact cube and usually finds 18 to 22 moves. It shows what is possible; it is not a method to memorise.'],
  ['Getting faster', 'Habits that work', 'Turn smoothly rather than hard. Look ahead to the next piece while your hands are still moving. Practise each algorithm slowly until it never stops, then speed up. Use the speed slider to watch moves at your pace.']
];
METHODS.forEach(function (m) { var d = h('details'); d.appendChild(h('summary', '', '<b>' + m[0] + '</b><span>' + m[1] + '</span>')); d.appendChild(h('p', '', m[2])); $('methods').appendChild(d); });
var ALGS = [
  ['Trigger (the right-hand move)', 'The basis of many steps. Repeat it to put corners in.', "R U R' U'"], ['Insert an edge on the right', 'Middle layer, edge goes to the right.', "U R U' R' U' F' U F"],
  ['Insert an edge on the left', 'Middle layer, edge goes to the left.', "U' L' U L U F U' F'"], ['Make the top cross', 'Adds the top edges without breaking the layers below.', "F R U R' U' F'"],
  ['Sune', 'Twists three top corners.', "R U R' U R U2 R'"], ['Corner cycle (A perm)', 'Moves three top corners in a circle.', "R' F R' B2 R F' R' B2 R2"],
  ['Edge cycle (U perm)', 'Moves three top edges in a circle.', "R U' R U R U R U' R' U' R2"], ['Edge cycle, other way', 'The same cycle in reverse.', "R2 U R U R' U' R' U' R' U R'"],
  ['T perm', 'Swaps two top corners and two edges.', "R U R' U' R' F R2 U' R' U' R U R' F'"], ['Y perm', 'Swaps two opposite top corners and two edges.', "F R U' R' U' R U R' F' R U R' U' R' F R F'"]
];
ALGS.forEach(function (a) {
  var d = h('div', 'alg'); d.appendChild(h('b', '', a[0])); d.appendChild(h('small', '', a[1])); d.appendChild(h('code', '', a[2]));
  var b = h('button', 'btn', 'Play'); b.type = 'button'; b.onclick = function () { $('algIn').value = a[2]; playText(a[2], 'alg'); }; d.appendChild(b); $('algList').appendChild(d);
});

/* look */
function pressed(root, test) { each(root.children, function (b) { if (b.hasAttribute('data-k')) b.setAttribute('aria-pressed', test(b.getAttribute('data-k')) ? 'true' : 'false'); }); }
function swatch(parent, key, label, fill) { var b = h('button', 'sw'); b.type = 'button'; b.setAttribute('data-k', key); b.setAttribute('aria-label', label); fill(b); b.appendChild(h('span', '', label)); parent.appendChild(b); return b; }
function buildLook() {
  var cg = $('colourGrid'); cg.innerHTML = '';
  Th.COLOUR.forEach(function (t) { var b = swatch(cg, 'colour:' + t.id, t.name, function (b) { var d = h('div', 'dots'); t.colours.forEach(function (c) { var i = h('i'); i.style.background = c; d.appendChild(i); }); b.insertBefore(d, null); }); b.onclick = function () { chooseLook('colour', t.id); }; });
  var pg = $('pictureGrid'); pg.innerHTML = '';
  Th.PICTURE.forEach(function (t) {
    var b = swatch(pg, 'picture:' + t.id, t.name, function (b) {
      if (t.emoji) { var e = h('div', 'emo', t.emoji.map(function (x) { return '<span>' + x + '</span>'; }).join('')); b.appendChild(e); } else { var d = h('div', 'dots'); t.bg.forEach(function (c) { var i = h('i'); i.style.background = c; d.appendChild(i); }); b.appendChild(d); }
    }); b.onclick = function () { chooseLook('picture', t.id); };
  });
  if (G.photoImg) { var pb = swatch(pg, 'photo:photo', 'Your photo', function (b) { var p = h('div', 'prev'); p.style.backgroundImage = 'url(' + G.photoImg.toDataURL('image/jpeg', 0.6) + ')'; b.appendChild(p); }); pb.onclick = function () { chooseLook('photo', 'photo'); }; }
  var sr = $('styleRow'); sr.innerHTML = ''; Object.keys(Th.STYLES).forEach(function (k) { var b = h('button', '', Th.STYLES[k].name); b.type = 'button'; b.setAttribute('data-k', k); b.onclick = function () { cfg.style = k; St.save(); applyLook(); }; sr.appendChild(b); });
  var br = $('bodyRow'); br.innerHTML = ''; [['auto', 'Auto body']].concat(Object.keys(Th.BODIES).map(function (k) { return [k, Th.BODIES[k].name + ' body']; })).forEach(function (x) { var b = h('button', '', x[1]); b.type = 'button'; b.setAttribute('data-k', x[0]); b.onclick = function () { cfg.body = x[0] === 'auto' ? null : x[0]; St.save(); applyLook(); }; br.appendChild(b); });
  var bgs = $('bgGrid'); bgs.innerHTML = '';
  FX.LIST.forEach(function (b) { if (b.id === 'photo' && !G.bgPhoto) return; var s = swatch(bgs, b.id, b.name, function (el) { var p = h('div', 'prev'); var c = BG_PREVIEW[b.id]; p.style.background = 'linear-gradient(135deg,' + c[0] + ',' + c[1] + ')'; el.appendChild(p); }); s.onclick = function () { setBg(b.id); }; });
  applyLook(); setBg(bg.get(), true);
}
function chooseLook(kind, id) { cfg.kind = kind; cfg.id = id; if (kind !== 'colour') { /* body kept */ } St.save(); applyLook(); }
function applyLook() {
  if (cfg.kind === 'photo' && !G.photoImg) { cfg.kind = 'colour'; cfg.id = 'classic'; }
  var t = themeNow(), body = cfg.body || (cfg.kind === 'colour' ? t.body : 'black');
  view.setLook({ kind: cfg.kind, id: cfg.id, body: body, style: cfg.style, matte: cfg.matte, photo: G.photoImg });
  Coach.setNames(t.names);
  pressed($('colourGrid'), function (k) { return k === cfg.kind + ':' + cfg.id; }); pressed($('pictureGrid'), function (k) { return k === cfg.kind + ':' + cfg.id; });
  pressed($('styleRow'), function (k) { return k === cfg.style; }); pressed($('bodyRow'), function (k) { return k === (cfg.body || 'auto'); });
  $('chkMatte').checked = cfg.matte; if (G.hint) openHint(G.hint.kind, true); else refreshLearn();
}
function setBg(id, quiet) {
  if (id === 'photo' && !G.bgPhoto) id = 'studio';
  bg.set(id); cfg.bg = id; document.body.classList.toggle('light', !bg.isDark()); if (!quiet) St.save();
  pressed($('bgGrid'), function (k) { return k === id; });
}
function nextBackground() { var ids = FX.LIST.filter(function (b) { return b.id !== 'photo' || G.bgPhoto; }).map(function (b) { return b.id; }); setBg(ids[(ids.indexOf(bg.get()) + 1) % ids.length]); }
$('chkMatte').onchange = function () { cfg.matte = this.checked; St.save(); applyLook(); };
$('chkAutoBg').onchange = function () { cfg.autoBg = this.checked; St.save(); };
$('chkRotate').onchange = function () { cfg.rotate = this.checked; view.setAutoRotate(this.checked); St.save(); };
function loadImage(file, size, cb) {
  var rd = new FileReader();
  rd.onload = function () {
    var img = new Image();
    img.onload = function () { var s = Math.min(img.width, img.height), sc = Math.min(1, size / Math.max(img.width, img.height)), cv = document.createElement('canvas'); cv.width = Math.round(img.width * sc); cv.height = Math.round(img.height * sc); cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); cb(cv); };
    img.onerror = function () { toast('That image could not be opened.'); }; img.src = rd.result;
  };
  rd.readAsDataURL(file);
}
$('photoIn').onchange = function () { var f = this.files && this.files[0]; this.value = ''; if (!f) return; loadImage(f, 768, function (cv) { G.photoImg = cv; cfg.kind = 'photo'; cfg.id = 'photo'; buildLook(); toast('Your photo is on the cube. Solve it to put the picture back together.'); }); };
$('bgIn').onchange = function () { var f = this.files && this.files[0]; this.value = ''; if (!f) return; loadImage(f, 1600, function (cv) { bg.setPhoto(cv); G.bgPhoto = true; buildLook(); setBg('photo'); }); };

/* settings */
function syncSpeed() { $('speed').value = cfg.speed; $('speedOut').textContent = SPEED_NAMES[cfg.speed]; }
$('speed').oninput = function () { cfg.speed = +this.value; syncSpeed(); St.save(); };
$('chkSound').onchange = function () { cfg.sound = this.checked; Sound.setOn(this.checked); St.save(); };
$('vol').oninput = function () { cfg.vol = +this.value; Sound.setVolume(cfg.vol / 100); St.save(); };
$('chkHaptic').onchange = function () { cfg.haptic = this.checked; St.save(); };
$('chkLabels').onchange = function () { cfg.labels = this.checked; view.setLabels(this.checked); St.save(); };
$('chkConfetti').onchange = function () { cfg.confetti = this.checked; St.save(); };
function fullscreen() {
  var d = document, el = d.documentElement;
  try { if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d); else (el.requestFullscreen || el.webkitRequestFullscreen).call(el); } catch (e) { toast('Full screen is not available here.'); }
}
if (!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen)) { $('btnFull').hidden = true; $('sFull').hidden = true; }
$('btnFull').onclick = $('sFull').onclick = fullscreen;
$('sView').onclick = function () { view.resetView(); };
$('sShot').onclick = function () {
  try { var a = h('a'); a.href = view.snapshot($('bg')); a.download = 'rubiks-cube.png'; document.body.appendChild(a); a.click(); a.remove(); toast('Picture saved.'); } catch (e) { toast('The picture could not be saved here.'); }
};
$('sReset').onclick = function () {
  openModal('Reset everything?', h('p', '', 'This clears your settings, the game in progress and your records on this device.'), [{ label: 'Reset', cls: 'danger', fn: function () { St.resetAll(); location.reload(); } }, { label: 'Keep them' }]);
};

/* records */
function renderRecords() {
  var box = $('records'), r = St.records(), any = false; box.innerHTML = '';
  [2, 3, 4, 5].forEach(function (n) { var x = r[n]; if (!x || !x.solves) return; any = true; box.appendChild(h('div', 'rec', '<span>' + sizeText(n) + '</span><b>' + fmt(x.best) + '</b><span>' + x.solves + ' solve' + (x.solves === 1 ? '' : 's') + '</span>')); });
  if (!any) box.appendChild(h('p', 'note', 'Solve a scramble without hints to set your first record.'));
}

/* moves pad */
function depthOptions() {
  var N = G.size, o = [['outer', 'Outer layer']];
  if (N >= 3) o.push(['wide2', 'Two layers (Rw)']); if (N >= 4) o.push(['wide3', 'Three layers (3Rw)'], ['in2', 'Second layer (2R)']); if (N >= 5) o.push(['in3', 'Middle layer (3R)']);
  return o;
}
function tokenFor(face, depth) { return depth === 'wide2' ? face + 'w' : (depth === 'wide3' ? '3' + face + 'w' : (depth === 'in2' ? '2' + face : (depth === 'in3' ? '3' + face : face))); }
function buildPad() {
  var sel = $('padDepth'), opts = depthOptions(); if (!opts.some(function (o) { return o[0] === G.depth; })) G.depth = 'outer';
  sel.innerHTML = ''; opts.forEach(function (o) { var op = h('option', '', o[1]); op.value = o[0]; sel.appendChild(op); }); sel.value = G.depth; sel.style.display = opts.length > 1 ? '' : 'none';
  var grid = $('padGrid'); grid.innerHTML = '';
  function add(tok, cls) { var m = Pz.parse(G.size, tok); if (!m) return; var b = h('button', cls || '', tok); b.type = 'button'; b.setAttribute('aria-label', Pz.plainWords(G.size, m)); b.onclick = function () { cancelPlay(); Sound.unlock(); view.turn(m, { ms: speedMs(m), source: 'user' }); }; grid.appendChild(b); }
  'URFDLB'.split('').forEach(function (f) { add(tokenFor(f, G.depth)); }); 'URFDLB'.split('').forEach(function (f) { add(tokenFor(f, G.depth) + "'"); });
  if (G.size % 2 === 1 && G.depth === 'outer') { ['M', 'E', 'S'].forEach(function (s) { add(s, 'slice'); }); ['M', 'E', 'S'].forEach(function (s) { add(s + "'", 'slice'); }); }
}
$('padDepth').onchange = function () { G.depth = this.value; buildPad(); };
function setPad(open) { G.padOpen = open; $('pad').hidden = !open; $('dPad').setAttribute('aria-pressed', open ? 'true' : 'false'); if (open) closeHint(); updateInsets(); }
$('dPad').onclick = function () { setPad(!G.padOpen); }; $('padClose').onclick = function () { setPad(false); };
$('dSpin').onclick = function (e) { view.spinCube(e.shiftKey ? 0 : 1, 1); };

/* keyboard */
document.addEventListener('keydown', function (e) {
  var t = e.target && e.target.tagName; if (t === 'INPUT' || t === 'SELECT' || t === 'TEXTAREA' || e.ctrlKey || e.metaKey || e.altKey) return;
  var k = e.key, K = k.length === 1 ? k.toUpperCase() : k;
  if (k === 'Escape') { if (!$('modal').hidden) closeModal(); else if ($('menu').classList.contains('open')) setMenu(false); else if (G.padOpen) setPad(false); else if (G.hint) closeHint(); return; }
  if (!$('modal').hidden) return;
  if (/^[URFDLBMES]$/.test(K)) { var m = Pz.parse(G.size, K + (e.shiftKey ? "'" : '')); if (m) { e.preventDefault(); Sound.unlock(); cancelPlay(); view.turn(m, { ms: speedMs(m), source: 'user' }); } return; }
  if (K === 'Z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
  else if (K === 'N') { doScramble(); } else if (K === 'H' || k === ' ') { e.preventDefault(); if (helpAllowed()) openHint('coach'); }
  else if (K === 'G') toggleMenu(); else if (K === 'P') setPad(!G.padOpen);
  else if (k === 'ArrowLeft') { e.preventDefault(); view.spinCube(1, -1); } else if (k === 'ArrowRight') { e.preventDefault(); view.spinCube(1, 1); }
  else if (k === 'ArrowUp') { e.preventDefault(); view.spinCube(0, -1); } else if (k === 'ArrowDown') { e.preventDefault(); view.spinCube(0, 1); }
});

/* ---------- start ---------- */
(function init() {
  Sound.setOn(cfg.sound); Sound.setVolume(cfg.vol / 100); hand.setEnabled(cfg.hand);
  $('chkInspect').checked = cfg.inspect; $('chkSound').checked = cfg.sound; $('vol').value = cfg.vol; $('chkHaptic').checked = cfg.haptic; $('chkLabels').checked = cfg.labels;
  $('chkConfetti').checked = cfg.confetti; $('chkHand').checked = cfg.hand; $('chkArrows').checked = cfg.arrows; $('chkFollow').checked = cfg.follow;
  $('chkAutoBg').checked = cfg.autoBg; $('chkRotate').checked = cfg.rotate; syncSpeed();
  if (G.size !== 3) view.setSize(G.size);
  buildLook(); setBg(cfg.bg === 'photo' ? 'studio' : cfg.bg, true);
  view.setLabels(cfg.labels); view.setAutoRotate(cfg.rotate);
  buildPad(); syncSize(); syncMode(); renderRecords(); restoreGame(); updateHud();
  if (G.mode === 'challenge' && G.timer.status === 'ready' && cfg.inspect && G.hist.length === 0) startInspect();
  setMenu(!isMobile()); updateInsets();
  setTimeout(function () { Coach.warmup(); }, 3000);
  if (!cfg.menuSeen) { cfg.menuSeen = true; St.save(); setTimeout(function () { toast(isMobile() ? 'Drag a piece to turn it. Tap the menu button for everything else.' : 'Drag a piece to turn it. Drag the background to look around.'); }, 1400); }
  window.RubiksStudio = { view: view, G: G, doScramble: doScramble, openHint: openHint, setSize: setSize, setMode: setMode, solveAll: solveAll, retrace: retrace };
})();
})();
