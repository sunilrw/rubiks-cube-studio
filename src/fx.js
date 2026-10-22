/* Effects that sit around the cube: animated backgrounds, confetti, sound and vibration. */
(function (root) {
'use strict';

/* ---------- backgrounds (drawn on a 2D canvas behind the 3D view) ---------- */
var LIST = [
  { id: 'studio', name: 'Studio', dark: true }, { id: 'daylight', name: 'Daylight', dark: false }, { id: 'stars', name: 'Starfield', dark: true },
  { id: 'aurora', name: 'Aurora', dark: true }, { id: 'synthwave', name: 'Synthwave', dark: true }, { id: 'ocean', name: 'Ocean', dark: true },
  { id: 'bokeh', name: 'Bokeh lights', dark: true }, { id: 'embers', name: 'Embers', dark: true }, { id: 'photo', name: 'Your photo', dark: true }
];

function Backgrounds(canvas) {
  var ctx = canvas.getContext('2d'), w = 300, h = 300, dpr = 1, id = 'studio', t0 = performance.now(), last = t0, energy = 0, photo = null, running = true, reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  var rnd = (function (s) { return function () { s = (s * 16807) % 2147483647; return s / 2147483647; }; })(42);
  var stars = [], blobs = [], bokeh = [], embers = [];
  for (var i = 0; i < 240; i++) stars.push({ x: rnd() * 2 - 1, y: rnd() * 2 - 1, z: rnd() });
  for (i = 0; i < 5; i++) blobs.push({ x: rnd(), y: rnd(), r: 0.35 + rnd() * 0.3, s: 0.05 + rnd() * 0.08, p: rnd() * 6, c: ['#2de2a6', '#3b82f6', '#a855f7', '#22d3ee', '#f472b6'][i] });
  for (i = 0; i < 26; i++) bokeh.push({ x: rnd(), y: rnd(), r: 14 + rnd() * 50, s: 0.01 + rnd() * 0.03, a: 0.06 + rnd() * 0.16, c: ['#ffd166', '#ef476f', '#06d6a0', '#4d96ff', '#f78c6b'][i % 5] });
  for (i = 0; i < 90; i++) embers.push({ x: rnd(), y: rnd(), r: 1 + rnd() * 2.6, s: 0.03 + rnd() * 0.09, p: rnd() * 6 });

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth || 300; h = canvas.clientHeight || 300;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function lin(a, b, c) { var g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, a); if (c) g.addColorStop(0.55, b); g.addColorStop(1, c || b); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); }
  function radial(inner, outer) { var g = ctx.createRadialGradient(w / 2, h * 0.42, 0, w / 2, h * 0.5, Math.max(w, h) * 0.75); g.addColorStop(0, inner); g.addColorStop(1, outer); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); }

  var draw = {
    studio: function () { radial('#27384b', '#0a0e13'); },
    daylight: function () { radial('#ffffff', '#c9d3dd'); },
    stars: function (t, dt) {
      radial('#0d1530', '#02040a');
      var sp = (0.05 + energy * 0.5) * dt / 1000, cx = w / 2, cy = h / 2;
      ctx.fillStyle = '#fff';
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i]; s.z -= sp; if (s.z <= 0.02) { s.z = 1; s.x = rnd() * 2 - 1; s.y = rnd() * 2 - 1; }
        var k = 1 / s.z, x = cx + s.x * k * w * 0.18, y = cy + s.y * k * h * 0.18, r = Math.max(0.4, (1 - s.z) * 2.2);
        if (x < 0 || y < 0 || x > w || y > h) { s.z = 1; continue; }
        ctx.globalAlpha = Math.min(1, (1 - s.z) * 1.4 + 0.1); ctx.fillRect(x, y, r, r);
      }
      ctx.globalAlpha = 1;
    },
    aurora: function (t) {
      ctx.fillStyle = '#050b16'; ctx.fillRect(0, 0, w, h); ctx.globalCompositeOperation = 'lighter';
      blobs.forEach(function (b) {
        var x = (b.x + Math.sin(t / 1000 * b.s + b.p) * 0.28) * w, y = (b.y + Math.cos(t / 1000 * b.s * 1.3 + b.p) * 0.22) * h, r = b.r * Math.max(w, h) * (1 + energy * 0.2);
        var g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, b.c + '66'); g.addColorStop(1, b.c + '00'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      });
      ctx.globalCompositeOperation = 'source-over';
    },
    synthwave: function (t) {
      lin('#14052e', '#5b1a6b', '#ff5e9c'); var hz = h * 0.58, sun = Math.min(w, h) * 0.2;
      var g = ctx.createLinearGradient(0, hz - sun * 2, 0, hz); g.addColorStop(0, '#ffd166'); g.addColorStop(1, '#ff4e8a');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(w / 2, hz - sun * 0.4, sun, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#12041f'; ctx.fillRect(0, hz, w, h - hz);
      ctx.strokeStyle = 'rgba(255,94,200,0.55)'; ctx.lineWidth = 1;
      for (var i = -12; i <= 12; i++) { ctx.beginPath(); ctx.moveTo(w / 2 + i * 8, hz); ctx.lineTo(w / 2 + i * w * 0.16, h); ctx.stroke(); }
      var off = ((t / 1000) * (0.4 + energy)) % 1;
      for (i = 0; i < 12; i++) { var p = Math.pow((i + off) / 12, 2.2), y = hz + p * (h - hz); ctx.globalAlpha = 0.2 + p * 0.6; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      ctx.globalAlpha = 1;
    },
    ocean: function (t) {
      lin('#0b3c5d', '#1b6ca8', '#37a3d3'); var T = t / 1000;
      for (var k = 0; k < 5; k++) {
        var base = h * (0.52 + k * 0.1), amp = 6 + k * 4;
        ctx.beginPath(); ctx.moveTo(0, h);
        for (var x = 0; x <= w; x += 8) ctx.lineTo(x, base + Math.sin(x / (70 + k * 25) + T * (0.5 + k * 0.2) + k) * amp);
        ctx.lineTo(w, h); ctx.closePath(); ctx.fillStyle = 'rgba(' + (10 + k * 10) + ',' + (60 + k * 24) + ',' + (110 + k * 22) + ',0.45)'; ctx.fill();
      }
    },
    bokeh: function (t) {
      radial('#1b2236', '#07090f');
      bokeh.forEach(function (b) {
        var x = ((b.x + Math.sin(t / 4000 * b.s * 8 + b.r) * 0.04) % 1) * w, y = ((b.y - t / 1000 * b.s * 0.12) % 1 + 1) % 1 * h;
        var g = ctx.createRadialGradient(x, y, 0, x, y, b.r); g.addColorStop(0, b.c); g.addColorStop(0.7, b.c); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = b.a * (1 + energy * 0.8); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, b.r, 0, 6.2832); ctx.fill();
      });
      ctx.globalAlpha = 1;
    },
    embers: function (t, dt) {
      lin('#120707', '#2a0d08', '#5a1a0a');
      embers.forEach(function (e) {
        e.y -= e.s * dt / 1000 * (1 + energy * 1.5); if (e.y < -0.05) { e.y = 1.05; e.x = rnd(); }
        var x = (e.x + Math.sin(t / 900 + e.p) * 0.02) * w, y = e.y * h, g = ctx.createRadialGradient(x, y, 0, x, y, e.r * 4);
        g.addColorStop(0, 'rgba(255,190,90,0.95)'); g.addColorStop(1, 'rgba(255,90,20,0)'); ctx.fillStyle = g; ctx.fillRect(x - e.r * 4, y - e.r * 4, e.r * 8, e.r * 8);
      });
    },
    photo: function () {
      if (!photo) { radial('#27384b', '#0a0e13'); return; }
      var s = Math.max(w / photo.width, h / photo.height), pw = photo.width * s, ph = photo.height * s;
      ctx.drawImage(photo, (w - pw) / 2, (h - ph) / 2, pw, ph); ctx.fillStyle = 'rgba(5,8,12,0.35)'; ctx.fillRect(0, 0, w, h);
    }
  };
  function frame(now) {
    if (!running) return;
    var dt = Math.min(64, now - last); last = now;
    (draw[id] || draw.studio)(now - t0, dt);
    energy *= 0.96;
    requestAnimationFrame(frame);
  }
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', function () { running = !document.hidden; if (running) { last = performance.now(); requestAnimationFrame(frame); } });
  resize(); requestAnimationFrame(frame);
  return {
    set: function (v) { if (draw[v]) id = v; },
    get: function () { return id; },
    isDark: function () { var f = LIST.filter(function (b) { return b.id === id; })[0]; return !f || f.dark; },
    pulse: function (v) { energy = Math.min(1.5, energy + (v || 0.4)); },
    setPhoto: function (img) { photo = img; },
    resize: resize
  };
}

/* ---------- confetti and fireworks on a 2D overlay canvas ---------- */
function Confetti(canvas) {
  var ctx = canvas.getContext('2d'), parts = [], running = false, dpr = 1, w = 300, h = 300;
  function resize() { dpr = Math.min(window.devicePixelRatio || 1, 2); w = canvas.clientWidth || 300; h = canvas.clientHeight || 300; canvas.width = w * dpr; canvas.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
  window.addEventListener('resize', resize); resize();
  function loop(now) {
    ctx.clearRect(0, 0, w, h);
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i]; p.vy += p.g; p.x += p.vx; p.y += p.vy; p.vx *= 0.992; p.rot += p.vr; p.life -= 1;
      if (p.life <= 0 || p.y > h + 30) { parts.splice(i, 1); continue; }
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.globalAlpha = Math.min(1, p.life / 30); ctx.fillStyle = p.c;
      if (p.spark) { ctx.beginPath(); ctx.arc(0, 0, p.s * 0.5, 0, 6.2832); ctx.fill(); } else ctx.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * 0.6);
      ctx.restore();
    }
    if (parts.length) requestAnimationFrame(loop); else { running = false; ctx.clearRect(0, 0, w, h); }
  }
  function start() { if (!running) { running = true; requestAnimationFrame(loop); } }
  return {
    burst: function (colours, x, y, n) {
      for (var i = 0; i < (n || 90); i++) {
        var a = Math.random() * 6.2832, sp = 3 + Math.random() * 8;
        parts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 4, g: 0.16, s: 6 + Math.random() * 7, c: colours[i % colours.length], rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, life: 90 + Math.random() * 70 });
      }
      start();
    },
    fireworks: function (colours) {
      for (var k = 0; k < 6; k++) (function (k) {
        setTimeout(function () {
          var x = w * (0.2 + Math.random() * 0.6), y = h * (0.15 + Math.random() * 0.35), c = colours[k % colours.length];
          for (var i = 0; i < 46; i++) { var a = i / 46 * 6.2832, sp = 2 + Math.random() * 4; parts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 0.06, s: 4 + Math.random() * 3, c: c, rot: 0, vr: 0, life: 60 + Math.random() * 30, spark: true }); }
          start();
        }, k * 260);
      })(k);
    },
    resize: resize
  };
}

/* ---------- sound and vibration ---------- */
var Sound = (function () {
  var ac = null, on = true, vol = 0.5;
  function ctx() { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; } } if (ac && ac.state === 'suspended') ac.resume(); return ac; }
  function tone(freq, dur, type, gain, when, slideTo) {
    var a = ctx(); if (!a || !on) return;
    var o = a.createOscillator(), g = a.createGain(), t = a.currentTime + (when || 0);
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t); if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain * vol), t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  return {
    setOn: function (v) { on = !!v; }, setVolume: function (v) { vol = v; }, isOn: function () { return on; },
    unlock: function () { ctx(); },
    turn: function () { tone(210 + Math.random() * 40, 0.07, 'square', 0.1, 0, 120); tone(900, 0.03, 'triangle', 0.05); },
    tick: function () { tone(1200, 0.04, 'sine', 0.08); },
    good: function () { tone(660, 0.1, 'sine', 0.14); tone(990, 0.14, 'sine', 0.12, 0.08); },
    solve: function () { [523, 659, 784, 1047, 1319].forEach(function (f, i) { tone(f, 0.28, 'triangle', 0.16, i * 0.09); }); },
    haptic: function (ms) { try { if (navigator.vibrate) navigator.vibrate(ms || 8); } catch (e) {} }
  };
})();

root.FX = { LIST: LIST, Backgrounds: Backgrounds, Confetti: Confetti, Sound: Sound };
})(typeof window !== 'undefined' ? window : this);
