/* The moving hand: a finger that glides along the path a real swipe would take, with a trail behind it. */
(function (root) {
'use strict';
function Hand(box, finger, line) {
  var getter = null, raf = 0, t0 = 0, pts = null, cycle = 2300, enabled = true;
  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function place(x, y, o, s) { finger.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) scale(' + (s || 1).toFixed(3) + ')'; finger.style.opacity = o.toFixed(2); }
  function frame(now) {
    if (!getter) return;
    var t = (now - t0) % cycle;
    if (t < 30 || !pts) { var p = getter(); if (p && p.length > 1) pts = p; else { pts = null; place(0, 0, 0); line.setAttribute('points', ''); raf = requestAnimationFrame(frame); return; } }
    var a = pts[0], b;
    if (t < 350) { var f = t / 350; place(a.x, a.y, f, 1.25 - 0.25 * f); line.setAttribute('points', ''); }
    else if (t < 1450) {
      var k = ease((t - 350) / 1100) * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(k)), u = k - i;
      b = { x: pts[i].x + (pts[i + 1].x - pts[i].x) * u, y: pts[i].y + (pts[i + 1].y - pts[i].y) * u };
      var s = pts.slice(0, i + 1).map(function (q) { return q.x.toFixed(1) + ',' + q.y.toFixed(1); }); s.push(b.x.toFixed(1) + ',' + b.y.toFixed(1));
      line.setAttribute('points', s.join(' ')); place(b.x, b.y, 1, 0.92);
    } else if (t < 1900) {
      var e = pts[pts.length - 1], g = (t - 1450) / 450; place(e.x, e.y, 1 - g, 1 + 0.1 * g); line.setAttribute('points', pts.map(function (q) { return q.x.toFixed(1) + ',' + q.y.toFixed(1); }).join(' '));
    } else { place(a.x, a.y, 0, 1); line.setAttribute('points', ''); }
    raf = requestAnimationFrame(frame);
  }
  return {
    start: function (fn) { if (!enabled) return; getter = fn; pts = null; t0 = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); },
    stop: function () { getter = null; pts = null; cancelAnimationFrame(raf); finger.style.opacity = '0'; line.setAttribute('points', ''); },
    setEnabled: function (v) { enabled = !!v; if (!enabled) this.stop(); }
  };
}
root.Hand = Hand;
})(typeof window !== 'undefined' ? window : this);
