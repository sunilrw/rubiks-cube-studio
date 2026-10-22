/* Mouse, touch and wheel on the cube.
   Grab a sticker and drag: that row or column follows your finger, then settles on the nearest turn.
   Grab the background: look around. Two fingers or the wheel: zoom. */
(function (root) {
'use strict';
var Pz = root.Puzzle, HALF = Math.PI / 2;

function attachInput(view, cb) {
  cb = cb || {};
  var dom = view.dom, ptrs = {}, count = 0, g = null;
  dom.style.touchAction = 'none';

  function dist() { var k = Object.keys(ptrs), a = ptrs[k[0]], b = ptrs[k[1]]; return Math.hypot(a.x - b.x, a.y - b.y); }
  function finish(cancel) {
    if (g && g.mode === 'live') {
      var a = g.angle / HALF, q = 0;
      if (!cancel && Math.abs(a) > 0.3) q = Math.min(2, Math.max(1, Math.round(Math.abs(a)))) * (a < 0 ? -1 : 1);
      view.endLive(Math.abs(q) === 2 ? 2 : q, 'user');
    }
    view.setDragging(false); g = null;
  }
  dom.addEventListener('pointerdown', function (e) {
    if (e.button !== undefined && e.button > 0 && e.pointerType === 'mouse') return;
    try { dom.setPointerCapture(e.pointerId); } catch (err) {}
    ptrs[e.pointerId] = { x: e.clientX, y: e.clientY }; count = Object.keys(ptrs).length;
    if (cb.onGesture) cb.onGesture();
    if (count >= 2) { finish(true); g = { mode: 'pinch', last: dist() }; return; }
    view.snap();
    var i = view.pick(e.clientX, e.clientY);
    g = { mode: i >= 0 ? 'maybe' : 'orbit', i: i, x0: e.clientX, y0: e.clientY, lx: e.clientX, ly: e.clientY, id: e.pointerId, angle: 0 };
    view.setDragging(true);
  });
  dom.addEventListener('pointermove', function (e) {
    if (!ptrs[e.pointerId]) return;
    ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
    if (!g) return;
    if (g.mode === 'pinch') { if (Object.keys(ptrs).length >= 2) { var d = dist(); if (g.last > 0) view.zoomBy(d / g.last); g.last = d; } return; }
    if (e.pointerId !== g.id) return;
    var dx = e.clientX - g.x0, dy = e.clientY - g.y0;
    if (g.mode === 'maybe') {
      if (Math.hypot(dx, dy) < 9) return;
      var P = Pz.create(view.size), m = Pz.dragMove(view.state, g.i, dx, dy, view.velFn);
      if (!m) { g.mode = 'orbit'; }
      else {
        var r = [P.pos[g.i][0] + P.nrm[g.i][0], P.pos[g.i][1] + P.nrm[g.i][1], P.pos[g.i][2] + P.nrm[g.i][2]], ax = [0, 0, 0]; ax[m.axis] = 1;
        g.sv = view.velFn(r, Pz.cross(ax, r)); g.den = g.sv[0] * g.sv[0] + g.sv[1] * g.sv[1];
        if (g.den < 1e-6) { g.mode = 'orbit'; } else { g.mode = 'live'; view.beginLive(m); if (cb.onTurnStart) cb.onTurnStart(); }
      }
      g.lx = e.clientX; g.ly = e.clientY;
    }
    if (g.mode === 'live') {
      var a = (dx * g.sv[0] + dy * g.sv[1]) / g.den; g.angle = Math.max(-Math.PI, Math.min(Math.PI, a)); view.setLive(g.angle);
    } else if (g.mode === 'orbit') {
      view.orbit(e.clientX - g.lx, e.clientY - g.ly); g.lx = e.clientX; g.ly = e.clientY;
    }
  });
  function up(e) {
    if (!ptrs[e.pointerId]) return;
    delete ptrs[e.pointerId]; count = Object.keys(ptrs).length;
    if (g && g.mode === 'pinch') { if (count === 0) { view.setDragging(false); g = null; } return; }
    if (g && e.pointerId === g.id) finish(e.type === 'pointercancel');
  }
  dom.addEventListener('pointerup', up);
  dom.addEventListener('pointercancel', up);
  dom.addEventListener('wheel', function (e) { e.preventDefault(); view.zoomBy(e.deltaY < 0 ? 1.08 : 1 / 1.08); }, { passive: false });
  dom.addEventListener('contextmenu', function (e) { e.preventDefault(); });
}
root.attachInput = attachInput;
})(typeof window !== 'undefined' ? window : this);
