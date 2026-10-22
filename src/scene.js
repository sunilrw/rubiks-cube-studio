/* The 3D cube view (Three.js): builds the pieces, shows the state, animates turns.
   Pieces never move: a turn spins a group of pieces, then the sticker pictures are redrawn from the state. */
(function (root) {
'use strict';
var THREE = root.THREE, Pz = root.Puzzle, Th = root.Themes;
var PI2 = Math.PI / 2;

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
function easeOutBack(t) { var c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }

function roundedBoxGeo(r) {
  var g = new THREE.BoxGeometry(1, 1, 1, 6, 6, 6), pos = g.attributes.position, nor = g.attributes.normal, inner = 0.5 - r;
  var map = function (a) { var s = Math.abs(a) < 1e-6 ? 0 : (a < 0 ? -1 : 1), m = Math.abs(a); return s * (m < 0.1 ? 0 : (m < 0.2 ? 0.2 : (m < 0.4 ? inner : 0.5))); };
  var v = new THREE.Vector3(), c = new THREE.Vector3(), d = new THREE.Vector3();
  for (var i = 0; i < pos.count; i++) {
    v.set(map(pos.getX(i)), map(pos.getY(i)), map(pos.getZ(i)));
    c.set(clamp(v.x, -inner, inner), clamp(v.y, -inner, inner), clamp(v.z, -inner, inner));
    d.subVectors(v, c);
    if (d.lengthSq() > 1e-12) { d.normalize(); nor.setXYZ(i, d.x, d.y, d.z); v.copy(c).addScaledVector(d, r); }
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  return g;
}
function roundRect(w, r) {
  var s = new THREE.Shape(), x = -w / 2, y = -w / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + w - r);
  s.quadraticCurveTo(x + w, y + w, x + w - r, y + w); s.lineTo(x + r, y + w); s.quadraticCurveTo(x, y + w, x, y + w - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
}
function mixHex(a, b, t) { return new THREE.Color(a).lerp(new THREE.Color(b), t); }

function CubeView(host, cb) {
  cb = cb || {};
  var N = 3, P = Pz.create(3), S = Pz.solvedState(3), W = 300, H = 300, zoom = 1, insets = { l: 0, t: 0, r: 0, b: 0 };
  var look = { kind: 'colour', id: 'classic', body: 'black', style: 'flat', matte: false, photo: null };
  var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0); renderer.toneMapping = THREE.NoToneMapping;
  host.appendChild(renderer.domElement);
  var scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
  var root3 = new THREE.Group(), cubeGroup = new THREE.Group();
  root3.add(cubeGroup); scene.add(root3);
  var HOME_Q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.46, -0.63, 0, 'XYZ'));
  root3.quaternion.copy(HOME_Q);

  /* lighting: a small studio built into an environment map, plus one key light */
  (function () {
    var pm = new THREE.PMREMGenerator(renderer), env = new THREE.Scene();
    var sky = new THREE.Mesh(new THREE.SphereGeometry(20, 24, 12), new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true }));
    var cols = [], p = sky.geometry.attributes.position;
    for (var i = 0; i < p.count; i++) { var t = (p.getY(i) / 20 + 1) / 2, c = new THREE.Color('#1c2733').lerp(new THREE.Color('#aebdd0'), t); cols.push(c.r, c.g, c.b); }
    sky.geometry.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); env.add(sky);
    [[-8, 9, 8, 6, 3, 4, 7], [10, 5, 6, 3, 6, 4, 5], [0, -4, 10, 10, 1, 1, 2]].forEach(function (b) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(b[3], b[4], b[5]), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(b[6]) })); m.position.set(b[0], b[1], b[2]); env.add(m);
    });
    scene.environment = pm.fromScene(env, 0.03).texture; pm.dispose();
    var key = new THREE.DirectionalLight(0xffffff, 0.9); key.position.set(-4, 8, 7); scene.add(key);
    scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  })();

  /* soft ground shadow */
  var shadow = (function () {
    var cv = document.createElement('canvas'); cv.width = cv.height = 128; var g = cv.getContext('2d'), gr = g.createRadialGradient(64, 64, 4, 64, 64, 62);
    gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    var m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
    m.rotation.x = -PI2; scene.add(m); return m;
  })();

  /* ---------- pieces ---------- */
  var cubies = {}, cubieList = [], stickers = [], disposables = [], bodyGeo = roundedBoxGeo(0.06), bodyMat = null, capMats = [], sideMats = [], matSets = [], faceTex = null;
  var geoCache = {}, intro = null, tweens = [], anim = null, queue = [], live = null, guideObjs = [], floatT = 0;
  function key3(p) { return p[0] + ',' + p[1] + ',' + p[2]; }
  function worldOf(p) { return new THREE.Vector3(p[0] * 0.5, p[1] * 0.5, p[2] * 0.5); }

  function stickerGeo(tile, rotK) {
    var st = Th.STYLES[look.style], k = (tile < 0 ? 'p' : tile + '_' + rotK) + look.style + N;
    if (geoCache[k]) return geoCache[k];
    var w = 0.86, r = 0.12, depth = st.depth, bev = st.bevel;
    var g = new THREE.ExtrudeGeometry(roundRect(w, r), { depth: depth, bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev * 0.9, bevelOffset: -bev * 0.9, bevelSegments: 2, curveSegments: 5 });
    g.translate(0, 0, 0.5);
    if (tile >= 0) {
      var uv = g.attributes.uv, pos = g.attributes.position, grp = g.groups[0], c = P.col[tile], rw = P.row[tile];
      for (var i = grp.start; i < grp.start + grp.count; i++) {
        var x = (pos.getX(i) / w), y = (pos.getY(i) / w), xr, yr;
        if (rotK === 0) { xr = x; yr = y; } else if (rotK === 1) { xr = y; yr = -x; } else if (rotK === 2) { xr = -x; yr = -y; } else { xr = -y; yr = x; }
        uv.setXY(i, (c + clamp(xr + 0.5, 0, 1)) / N, (rw + clamp(yr + 0.5, 0, 1)) / N);
      }
      uv.needsUpdate = true;
    }
    disposables.push(g); return (geoCache[k] = g);
  }
  function rotIndex(i) {
    var f = P.face[i], n = Pz.NORMALS[f], u = Pz.UPV[f], r = Pz.cross(u, n), w = Pz.DIRS[S.up[i]];
    var a = w[0] * r[0] + w[1] * r[1] + w[2] * r[2], b = w[0] * u[0] + w[1] * u[1] + w[2] * u[2];
    return b === 1 ? 0 : (a === -1 ? 1 : (b === -1 ? 2 : 3));
  }
  function buildMaterials() {
    var theme = Th.getTheme(look.kind, look.id), cols = Th.faceColours(theme), body = Th.BODIES[look.body] || Th.BODIES.black, glow = theme.glow || 0, matte = look.matte;
    if (faceTex) faceTex.forEach(function (t) { t.dispose(); });
    faceTex = Th.makeFaceTextures(THREE, theme, N, look.photo);
    capMats.forEach(function (m) { m.dispose(); }); sideMats.forEach(function (m) { m.dispose(); }); if (bodyMat) bodyMat.dispose();
    bodyMat = new THREE.MeshStandardMaterial({ color: body.color, roughness: matte ? 0.8 : body.rough, metalness: 0.05 });
    capMats = []; sideMats = []; matSets = [];
    for (var f = 0; f < 6; f++) {
      var c = new THREE.Color(cols[f]);
      var cap = new THREE.MeshPhysicalMaterial({ color: faceTex ? 0xffffff : c, map: faceTex ? faceTex[f] : null, roughness: matte ? 0.72 : 0.38, metalness: 0, clearcoat: matte ? 0 : 0.55, clearcoatRoughness: 0.14, envMapIntensity: 0.62,
        emissive: faceTex ? 0x000000 : c, emissiveIntensity: faceTex ? 0 : glow });
      var side = new THREE.MeshStandardMaterial({ color: mixHex(cols[f], '#000000', 0.5), roughness: 0.6 });
      capMats.push(cap); sideMats.push(side); matSets.push([cap, side]);
    }
    return !!faceTex;
  }
  function refresh() {
    var textured = !!faceTex, NN = P.NN;
    for (var i = 0; i < P.count; i++) {
      var m = stickers[i]; if (!m) continue;
      var id = S.id[i];
      m.geometry = textured ? stickerGeo(id, rotIndex(i)) : stickerGeo(-1, 0);
      m.material = matSets[(id / NN) | 0];
    }
  }
  function clearPieces() {
    while (cubeGroup.children.length) cubeGroup.remove(cubeGroup.children[0]);
    disposables.forEach(function (g) { g.dispose(); }); disposables = []; geoCache = {};
    cubies = {}; cubieList = []; stickers = [];
  }
  function build(newN, withIntro) {
    N = newN; P = Pz.create(N); clearPieces(); var textured = buildMaterials(), off = N - 1;
    for (var x = -off; x <= off; x += 2) for (var y = -off; y <= off; y += 2) for (var z = -off; z <= off; z += 2) {
      if (Math.abs(x) < off && Math.abs(y) < off && Math.abs(z) < off) continue;
      var g = new THREE.Group(), b = new THREE.Mesh(bodyGeo, bodyMat); b.userData.cubie = key3([x, y, z]); g.add(b);
      g.position.copy(worldOf([x, y, z])); g.userData.p = [x, y, z]; cubeGroup.add(g);
      cubies[key3([x, y, z])] = g; cubieList.push(g);
    }
    for (var i = 0; i < P.count; i++) {
      var cg = cubies[key3(P.pos[i])], n = Pz.NORMALS[P.face[i]], u = Pz.UPV[P.face[i]], r = Pz.cross(u, n);
      var mesh = new THREE.Mesh(stickerGeo(-1, 0), matSets[P.face[i]]);
      mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3().fromArray(r), new THREE.Vector3().fromArray(u), new THREE.Vector3().fromArray(n)));
      mesh.userData.i = i; cg.add(mesh); stickers[i] = mesh;
    }
    S = Pz.solvedState(N); refresh(); layout(); applyLabels();
    if (withIntro) startIntro();
  }
  var labelGroup = new THREE.Group(), labelsOn = false, labelTex = null;
  root3.add(labelGroup);
  function applyLabels() {
    while (labelGroup.children.length) { var o = labelGroup.children[0]; labelGroup.remove(o); if (o.material) o.material.dispose(); }
    if (!labelsOn) return;
    if (!labelTex) labelTex = 'URFDLB'.split('').map(function (ch) {
      var cv = document.createElement('canvas'); cv.width = cv.height = 128; var g = cv.getContext('2d');
      g.fillStyle = 'rgba(10,14,20,0.72)'; g.beginPath(); g.arc(64, 64, 56, 0, 6.2832); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 5; g.stroke();
      g.fillStyle = '#fff'; g.font = '700 72px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, 64, 70);
      var t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
    });
    for (var f = 0; f < 6; f++) {
      var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex[f], transparent: true, depthTest: false }));
      var nn = Pz.NORMALS[f]; sp.position.set(nn[0], nn[1], nn[2]).multiplyScalar(N / 2 + 0.55); sp.scale.setScalar(0.5); sp.renderOrder = 20; labelGroup.add(sp);
    }
  }
  function startIntro() {
    var t0 = performance.now(), items = cubieList.map(function (c) {
      var d = c.position.length(), dir = c.position.clone().normalize();
      return { c: c, home: c.position.clone(), from: dir.multiplyScalar(N * 2.6 + Math.random() * 2).add(new THREE.Vector3((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3)),
        q: new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6)), delay: Math.random() * 380 };
    });
    intro = { t0: t0, items: items, dur: 900 };
  }
  function tickIntro(now) {
    if (!intro) return;
    var all = true;
    intro.items.forEach(function (it) {
      var t = clamp((now - intro.t0 - it.delay) / intro.dur, 0, 1); if (t < 1) all = false;
      var e = easeOutBack(t); it.c.position.lerpVectors(it.from, it.home, clamp(e, 0, 1.02)); it.c.quaternion.slerpQuaternions(it.q, new THREE.Quaternion(), clamp(ease(t), 0, 1)); it.c.scale.setScalar(0.3 + 0.7 * clamp(t * 1.4, 0, 1));
    });
    if (all) { intro.items.forEach(function (it) { it.c.position.copy(it.home); it.c.quaternion.identity(); it.c.scale.setScalar(1); }); intro = null; if (cb.onIntroDone) cb.onIntroDone(); }
  }

  /* ---------- turns ---------- */
  function startPivot(m) {
    var pivot = new THREE.Group(), list = [], off = N - 1;
    cubieList.forEach(function (c) { if (m.layers.some(function (l) { return c.userData.p[m.axis] === 2 * l - off; })) { list.push(c); pivot.add(c); } });
    cubeGroup.add(pivot);
    var ax = new THREE.Vector3(); ax.setComponent(m.axis, 1);
    return { pivot: pivot, list: list, ax: ax };
  }
  function endPivot(pv) { pv.list.forEach(function (c) { cubeGroup.add(c); }); cubeGroup.remove(pv.pivot); }
  function commit(m, source) { Pz.applyMove(S, m); refresh(); if (cb.onMove) cb.onMove(m, source); }
  function pump() {
    if (anim || live || !queue.length) return;
    var job = queue.shift();
    if (job.ms <= 0 || intro) { commit(job.m, job.source); job.res(); pump(); return; }
    var pv = startPivot(job.m);
    anim = { pv: pv, m: job.m, t0: performance.now(), dur: job.ms, angle: job.m.q * PI2, job: job, from: 0 };
  }
  function tickAnim(now) {
    if (!anim) return;
    var t = clamp((now - anim.t0) / anim.dur, 0, 1), a = anim.from + (anim.angle - anim.from) * ease(t);
    anim.pv.pivot.quaternion.setFromAxisAngle(anim.pv.ax, a);
    if (t >= 1) { var a2 = anim; anim = null; endPivot(a2.pv); if (a2.revert) { a2.job.res(); } else commit(a2.m, a2.job.source); a2.job.res(); pump(); }
  }
  function turn(m, opts) {
    opts = opts || {};
    return new Promise(function (res) { queue.push({ m: m, ms: opts.ms === undefined ? 200 : opts.ms, source: opts.source || 'auto', res: res }); pump(); });
  }
  function snap() {      // finish everything at once
    if (anim) { var a = anim; anim = null; endPivot(a.pv); if (!a.revert) commit(a.m, a.job.source); a.job.res(); }
    while (queue.length) { var j = queue.shift(); commit(j.m, j.source); j.res(); }
    if (intro) { intro.t0 -= 5000; tickIntro(performance.now()); }
  }
  function busy() { return !!(anim || queue.length || live || intro); }
  // live dragging: the layer follows the finger, then settles on the nearest quarter turn
  function beginLive(m) { snap(); live = { m: m, pv: startPivot(m), angle: 0 }; }
  function setLive(a) { if (live) { live.angle = a; live.pv.pivot.quaternion.setFromAxisAngle(live.pv.ax, a); } }
  function endLive(q, source) {
    if (!live) return; var l = live; live = null;
    var m = { axis: l.m.axis, layers: l.m.layers, q: q }, job = { m: m, source: source || 'user', res: function () {} };
    anim = { pv: l.pv, m: m, t0: performance.now(), dur: 140 + Math.abs(q * PI2 - l.angle) * 90, angle: q * PI2, from: l.angle, job: job, revert: q === 0 };
  }
  function setState(ns) { S = Pz.cloneState(ns); refresh(); }

  /* ---------- camera ---------- */
  function layout() {
    var w = host.clientWidth || 300, h = host.clientHeight || 300; W = w; H = h;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); camera.aspect = w / h;
    var aw = Math.max(120, w - insets.l - insets.r), ah = Math.max(120, h - insets.t - insets.b), R = N * 0.95;
    var dist = R * h / (Math.tan(camera.fov * Math.PI / 360) * Math.min(aw, ah)) / zoom;
    camera.position.set(0, 0, dist); camera.lookAt(0, 0, 0);
    camera.setViewOffset(w, h, (insets.r - insets.l) / 2, (insets.b - insets.t) / 2, w, h);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    shadow.scale.setScalar(N * 1.9); shadow.position.y = -N * 0.98;
  }
  function tween(dur, fn, done) { tweens.push({ t0: performance.now(), dur: dur, fn: fn, done: done }); }
  function tickTweens(now) {
    for (var i = tweens.length - 1; i >= 0; i--) {
      var tw = tweens[i], t = clamp((now - tw.t0) / tw.dur, 0, 1); tw.fn(ease(t));
      if (t >= 1) { tweens.splice(i, 1); if (tw.done) tw.done(); }
    }
  }
  function tweenQuat(target, dur) {
    var from = root3.quaternion.clone(); tween(dur || 600, function (e) { root3.quaternion.slerpQuaternions(from, target, e); });
  }
  function resetView() { spin.x = spin.y = 0; tweenQuat(HOME_Q, 650); setZoom(1); }
  function setZoom(z) { zoom = clamp(z, 0.5, 2.2); layout(); }
  var spin = { x: 0, y: 0 }, auto = false;
  function orbit(dx, dy) {
    var q = new THREE.Quaternion().setFromEuler(new THREE.Euler(dy * 0.0085, dx * 0.0085, 0, 'XYZ'));
    root3.quaternion.premultiply(q); spin.x = dx; spin.y = dy; tweens.length = 0;
  }
  // turn the whole cube so that a face looks towards the camera (a little from above), used by the coach
  function showFace(faceIdx) {
    var n = new THREE.Vector3().fromArray(Pz.NORMALS[faceIdx]).applyQuaternion(root3.quaternion);
    if (n.z > 0.5) return;
    var t = new THREE.Vector3(-0.32, 0.5, 1).normalize(), q = new THREE.Quaternion().setFromUnitVectors(n, t).multiply(root3.quaternion);
    tweenQuat(q.normalize(), 650);
  }
  function spinCube(axis, q) {   // whole-cube quarter turn, as the x / y / z moves
    var a = new THREE.Vector3(); a.setComponent(axis, 1);
    var target = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(axis === 0 ? 1 : 0, axis === 1 ? 1 : 0, 0), q * PI2).multiply(root3.quaternion);
    tweenQuat(target.normalize(), 520);
  }

  /* ---------- hints drawn on the cube: layer glow, turn arrow, and finger path ---------- */
  function clearGuide() { guideObjs.forEach(function (o) { cubeGroup.remove(o); if (o.geometry) o.geometry.dispose(); }); guideObjs = []; }
  var arrowTex = {};
  function arrowTexture(kind) {
    if (arrowTex[kind]) return arrowTex[kind];
    var cv = document.createElement('canvas'); cv.width = cv.height = 256; var g = cv.getContext('2d'); g.lineCap = 'round'; g.lineJoin = 'round';
    var cx = 128, cy = 128, r = 78, a0 = -2.5, a1 = 1.75, ccw = kind === 'ccw';
    var P0 = function (a) { return [cx + r * Math.cos(ccw ? Math.PI - a : a), cy + r * Math.sin(ccw ? Math.PI - a : a)]; };
    function arc() { g.beginPath(); for (var a = a0; a <= a1; a += 0.05) { var p = P0(a); a === a0 ? g.moveTo(p[0], p[1]) : g.lineTo(p[0], p[1]); } g.stroke(); }
    var e = P0(a1), tx = -Math.sin(a1) * (ccw ? 1 : 1), ty = Math.cos(a1), nx = Math.cos(a1), ny = Math.sin(a1);
    var dir = ccw ? [Math.sin(a1), Math.cos(a1)] : [-Math.sin(a1), Math.cos(a1)];
    var nrm = ccw ? [-Math.cos(a1), Math.sin(a1)] : [Math.cos(a1), Math.sin(a1)];
    function head() { g.beginPath(); g.moveTo(e[0] + dir[0] * 34, e[1] + dir[1] * 34); g.lineTo(e[0] + nrm[0] * 22, e[1] + nrm[1] * 22); g.lineTo(e[0] - nrm[0] * 22, e[1] - nrm[1] * 22); g.closePath(); g.fill(); g.stroke(); }
    g.strokeStyle = '#111'; g.fillStyle = '#111'; g.lineWidth = 30; arc(); head();
    g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineWidth = 16; arc(); g.lineWidth = 8; head();
    if (kind === 'half') { g.font = '700 90px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 10; g.strokeStyle = '#111'; g.strokeText('2', cx, cy + 4); g.fillStyle = '#fff'; g.fillText('2', cx, cy + 4); }
    var t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return (arrowTex[kind] = t);
  }
  function showGuide(m) {
    clearGuide(); if (!m) return;
    var L = m.layers.slice().sort(function (a, b) { return a - b; }), thick = L.length, mid = (L[0] + L[L.length - 1]) / 2 - (N - 1) / 2;
    var dims = [N + 0.08, N + 0.08, N + 0.08]; dims[m.axis] = thick + 0.06;
    var slab = new THREE.Mesh(new THREE.BoxGeometry(dims[0], dims[1], dims[2]), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.1, depthWrite: false }));
    slab.position.setComponent(m.axis, mid); slab.userData.pulse = true; slab.renderOrder = 5;
    var edges = new THREE.LineSegments(new THREE.EdgesGeometry(slab.geometry), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 })); slab.add(edges);
    cubeGroup.add(slab); guideObjs.push(slab);
    if (m.layers.length < N) {
      var s = L[L.length - 1] === N - 1 ? 1 : (L[0] === 0 ? -1 : 1), kind = m.q === 2 ? 'half' : (m.q === -s ? 'cw' : 'ccw');
      var pl = new THREE.Mesh(new THREE.PlaneGeometry(N * 0.82, N * 0.82), new THREE.MeshBasicMaterial({ map: arrowTexture(kind), transparent: true, depthWrite: false, depthTest: false }));
      var faceN = [0, 0, 0]; faceN[m.axis] = s;
      var u = Pz.UPV[Pz.faceOfNormal(faceN)], r = Pz.cross(u, faceN);
      pl.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3().fromArray(r), new THREE.Vector3().fromArray(u), new THREE.Vector3().fromArray(faceN)));
      pl.position.fromArray(faceN).multiplyScalar(N / 2 + 0.06); pl.userData.pulse = true; pl.renderOrder = 10;
      cubeGroup.add(pl); guideObjs.push(pl);
    }
  }
  function toScreen(v3) { var v = v3.clone().project(camera); return { x: (v.x + 1) / 2 * W, y: (1 - v.y) / 2 * H, z: v.z }; }
  function localToScreen(r, scale) {
    cubeGroup.updateMatrixWorld(true); camera.updateMatrixWorld(true);
    return toScreen(new THREE.Vector3(r[0] * (scale || 0.5), r[1] * (scale || 0.5), r[2] * (scale || 0.5)).applyMatrix4(cubeGroup.matrixWorld));
  }
  // where a finger should travel to make this move: follows one visible sticker along its real path
  function fingerPath(m) {
    cubeGroup.updateMatrixWorld(true); var best = null, off = N - 1, steps = 14;
    for (var i = 0; i < P.count; i++) {
      var p = P.pos[i], inLayer = m.layers.some(function (l) { return p[m.axis] === 2 * l - off; }); if (!inLayer) continue;
      var nw = new THREE.Vector3().fromArray(P.nrm[i]).transformDirection(cubeGroup.matrixWorld); if (nw.z < 0.35) continue;
      var r0 = [p[0] + P.nrm[i][0], p[1] + P.nrm[i][1], p[2] + P.nrm[i][2]], pts = [], len = 0;
      for (var s = 0; s <= steps; s++) {
        var ang = m.q * PI2 * 0.8 * s / steps, c = Math.cos(ang), sn = Math.sin(ang), a = (m.axis + 1) % 3, b = (m.axis + 2) % 3, r1 = r0.slice();
        r1[a] = r0[a] * c - r0[b] * sn; r1[b] = r0[a] * sn + r0[b] * c; pts.push(localToScreen(r1));
      }
      for (s = 1; s < pts.length; s++) len += Math.hypot(pts[s].x - pts[s - 1].x, pts[s].y - pts[s - 1].y);
      var score = len * (0.5 + nw.z); if (!best || score > best.score) best = { score: score, pts: pts };
    }
    return best ? best.pts : null;
  }

  /* ---------- picking ---------- */
  var ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pick(cx, cy) {
    var rect = renderer.domElement.getBoundingClientRect();
    ndc.set(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
    camera.updateMatrixWorld(); cubeGroup.updateMatrixWorld(true); ray.setFromCamera(ndc, camera);
    var hits = ray.intersectObjects(cubeGroup.children, true);
    for (var h = 0; h < hits.length; h++) {
      var o = hits[h].object;
      if (o.userData.i !== undefined) return o.userData.i;
      if (o.userData.cubie) {
        var nl = hits[h].face.normal, ax = Math.abs(nl.x) > Math.abs(nl.y) ? (Math.abs(nl.x) > Math.abs(nl.z) ? 0 : 2) : (Math.abs(nl.y) > Math.abs(nl.z) ? 1 : 2);
        var nn = [0, 0, 0]; nn[ax] = nl.getComponent(ax) > 0 ? 1 : -1;
        var p = o.parent.userData.p, idx = P.indexAt(p, Pz.faceOfNormal(nn)); if (idx >= 0) return idx;
      }
    }
    return -1;
  }
  function velFn(r, v) {
    cubeGroup.updateMatrixWorld(true); camera.updateMatrixWorld(true);
    var a = toScreen(new THREE.Vector3(r[0] * 0.5, r[1] * 0.5, r[2] * 0.5).applyMatrix4(cubeGroup.matrixWorld));
    var b = toScreen(new THREE.Vector3((r[0] + v[0] * 1e-3) * 0.5, (r[1] + v[1] * 1e-3) * 0.5, (r[2] + v[2] * 1e-3) * 0.5).applyMatrix4(cubeGroup.matrixWorld));
    return [(b.x - a.x) * 1e3, (b.y - a.y) * 1e3];
  }

  /* ---------- frame loop ---------- */
  function tick(now) {
    floatT = now / 1000;
    tickIntro(now); tickAnim(now); tickTweens(now);
    if (!drag.active && (Math.abs(spin.x) > 0.02 || Math.abs(spin.y) > 0.02) && !tweens.length) {
      root3.quaternion.premultiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(spin.y * 0.0085, spin.x * 0.0085, 0, 'XYZ'))); spin.x *= 0.93; spin.y *= 0.93;
    }
    if (auto && !drag.active && !tweens.length) root3.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.004));
    root3.position.y = Math.sin(floatT * 0.9) * 0.05;
    var pulse = 0.5 + 0.5 * Math.sin(floatT * 4);
    guideObjs.forEach(function (o) { if (o.userData.pulse && o.material) { o.material.opacity = o.material.map ? 0.55 + 0.45 * pulse : 0.07 + 0.09 * pulse; } });
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  var drag = { active: false };
  if (window.ResizeObserver) new ResizeObserver(layout).observe(host); else window.addEventListener('resize', layout);
  build(3, true); requestAnimationFrame(tick);

  return {
    dom: renderer.domElement, host: host,
    get state() { return S; }, get size() { return N; }, get busy() { return busy(); }, get camera() { return camera; },
    setSize: function (n) { snap(); build(n, true); },
    setLook: function (o) { snap(); for (var k in o) look[k] = o[k]; var tx = buildMaterials(); geoCache = {}; stickers.forEach(function (m) { m.material = matSets[0]; }); refresh(); return tx; },
    getLook: function () { return look; },
    setState: setState, turn: turn, snap: snap, beginLive: beginLive, setLive: setLive, endLive: endLive,
    pick: pick, velFn: velFn, orbit: orbit, setDragging: function (v) { drag.active = v; }, zoomBy: function (f) { setZoom(zoom * f); }, resetView: resetView, showFace: showFace, spinCube: spinCube,
    setLabels: function (v) { labelsOn = !!v; applyLabels(); },
    setAutoRotate: function (v) { auto = !!v; }, setInsets: function (l, t, r, b) { insets = { l: l, t: t, r: r, b: b }; layout(); },
    showGuide: showGuide, clearGuide: clearGuide, fingerPath: fingerPath, localToScreen: localToScreen,
    isFacing: function (faceIdx) { return new THREE.Vector3().fromArray(Pz.NORMALS[faceIdx]).applyQuaternion(root3.quaternion).z; },
    snapshot: function (bgCanvas) {
      renderer.render(scene, camera); var cv = document.createElement('canvas'); cv.width = renderer.domElement.width; cv.height = renderer.domElement.height; var g = cv.getContext('2d');
      if (bgCanvas) g.drawImage(bgCanvas, 0, 0, cv.width, cv.height); g.drawImage(renderer.domElement, 0, 0); return cv.toDataURL('image/png');
    },
    layout: layout
  };
}
root.CubeView = CubeView;
})(typeof window !== 'undefined' ? window : this);
