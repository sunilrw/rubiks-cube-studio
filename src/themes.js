/* Cube looks: colour palettes, picture sets (animals, mythology and more), body and sticker styles.
   Face order everywhere is U, R, F, D, L, B (top, right, front, bottom, left, back). */
(function (root) {
'use strict';

var COLOUR = [
  { id: 'classic', name: 'Classic', colours: ['#F4C62B', '#EF7B1F', '#25A050', '#F3F4F0', '#D5322F', '#2461CB'], names: ['yellow', 'orange', 'green', 'white', 'red', 'blue'], body: 'black', glow: 0 },
  { id: 'pastel', name: 'Pastel', colours: ['#FFE08A', '#FFB48A', '#9BE0A8', '#F7F7F2', '#FF9AA8', '#9BC4FF'], names: ['yellow', 'orange', 'green', 'white', 'red', 'blue'], body: 'white', glow: 0 },
  { id: 'neon', name: 'Neon', colours: ['#F9F871', '#FF8A00', '#22FF88', '#F2FBFF', '#FF2E63', '#2D8CFF'], names: ['yellow', 'orange', 'green', 'white', 'red', 'blue'], body: 'black', glow: 0.5 },
  { id: 'candy', name: 'Candy', colours: ['#FFD93D', '#FF8E3C', '#6BCB77', '#FFFFFF', '#FF6B9D', '#6C8CFF'], names: ['yellow', 'orange', 'green', 'white', 'pink', 'blue'], body: 'graphite', glow: 0.12 },
  { id: 'colourblind', name: 'Colour-blind friendly', colours: ['#F0E442', '#E69F00', '#009E73', '#F2F2F2', '#D55E00', '#0072B2'], names: ['yellow', 'orange', 'green', 'white', 'vermilion', 'blue'], body: 'black', glow: 0 },
  { id: 'midnight', name: 'Midnight', colours: ['#FFD166', '#FF7B54', '#06D6A0', '#E0E6F0', '#EF476F', '#4D96FF'], names: ['gold', 'orange', 'mint', 'silver', 'rose', 'blue'], body: 'graphite', glow: 0.25 },
  { id: 'earth', name: 'Earth', colours: ['#E9C46A', '#E76F51', '#2A9D8F', '#F1E9DA', '#9B2226', '#264E86'], names: ['sand', 'terracotta', 'teal', 'cream', 'brick', 'navy'], body: 'black', glow: 0 }
];

var PICTURE = [
  { id: 'animals', name: 'Wild animals', emoji: ['🦁', '🐘', '🐼', '🐧', '🦊', '🐙'], bg: ['#F2B84B', '#8FA3BC', '#7CCB84', '#5B9BE0', '#E8643A', '#B573D6'], names: ['lion', 'elephant', 'panda', 'penguin', 'fox', 'octopus'] },
  { id: 'sea', name: 'Ocean life', emoji: ['🐬', '🐢', '🦈', '🐠', '🦀', '🐙'], bg: ['#4FB3E8', '#6FCB8A', '#8A9BB5', '#F2B84B', '#E8643A', '#B573D6'], names: ['dolphin', 'turtle', 'shark', 'fish', 'crab', 'octopus'] },
  { id: 'myth', name: 'Mythical creatures', emoji: ['🐉', '🦄', '🧜', '🧞', '🧚', '🔱'], bg: ['#E04B4B', '#F08CC0', '#2FB7B0', '#8E6AD8', '#7CCB5C', '#3F7FDB'], names: ['dragon', 'unicorn', 'mermaid', 'genie', 'fairy', 'trident'] },
  { id: 'olympus', name: 'Greek gods', emoji: ['⚡', '🔱', '🦉', '🏹', '🔥', '🏛️'], bg: ['#F2C94C', '#3F7FDB', '#7C8FA6', '#4FAE6B', '#E8643A', '#D8CBB0'], names: ['Zeus', 'Poseidon', 'Athena', 'Artemis', 'Hephaestus', 'Olympus'] },
  { id: 'space', name: 'Space', emoji: ['☀️', '🪐', '🌍', '🌙', '🚀', '👽'], bg: ['#F2B84B', '#C98F5A', '#3F8FDB', '#9BA6B8', '#E04B4B', '#5BBF6A'], names: ['sun', 'saturn', 'earth', 'moon', 'rocket', 'alien'] },
  { id: 'fruit', name: 'Fruit', emoji: ['🍋', '🍊', '🍏', '🍐', '🍎', '🫐'], bg: ['#F4D03F', '#F39C32', '#7CCB5C', '#F2F0D8', '#E0463E', '#4B6FD8'], names: ['lemon', 'orange', 'apple', 'pear', 'cherry', 'blueberry'] },
  { id: 'art', name: 'Gradient art', art: true, bg: ['#FFB347', '#FF5E62', '#43C6AC', '#F8F9FA', '#C33764', '#1D2671'], bg2: ['#FFE259', '#FF9966', '#191654', '#A1C4FD', '#1D2671', '#C33764'], names: ['sun', 'ember', 'lagoon', 'cloud', 'berry', 'night'] }
];
var PHOTO = { id: 'photo', name: 'Your photo', photo: true, names: ['yellow', 'orange', 'green', 'white', 'red', 'blue'] };
var PHOTO_TINT = COLOUR[0].colours;

var BODIES = { black: { name: 'Black', color: '#0d1013', rough: 0.55 }, white: { name: 'White', color: '#e9ecef', rough: 0.45 }, graphite: { name: 'Graphite', color: '#323a42', rough: 0.4 }, navy: { name: 'Navy', color: '#101a33', rough: 0.4 } };
var STYLES = { flat: { name: 'Flat stickers', depth: 0.012, bevel: 0.004 }, raised: { name: 'Raised tiles', depth: 0.07, bevel: 0.03 }, chunky: { name: 'Chunky blocks', depth: 0.13, bevel: 0.05 } };
var EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif';

function find(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }
function getTheme(kind, id) {
  if (kind === 'photo') return PHOTO;
  return find(kind === 'picture' ? PICTURE : COLOUR, id) || (kind === 'picture' ? PICTURE[0] : COLOUR[0]);
}
function mix(hex, to, t) {
  var a = parseInt(hex.slice(1), 16), b = parseInt(to.slice(1), 16), out = 0;
  for (var s = 16; s >= 0; s -= 8) { var x = (a >> s) & 255, y = (b >> s) & 255; out = (out << 8) | Math.round(x + (y - x) * t); }
  return '#' + ('000000' + out.toString(16)).slice(-6);
}
// the colour each face is painted, used by the cube materials and the little colour dots in the menu
function faceColours(theme) { return theme.photo ? PHOTO_TINT : (theme.colours || theme.bg); }

function drawEmojiFace(ctx, size, theme, f) {
  var bg = theme.bg[f], g = ctx.createRadialGradient(size * 0.4, size * 0.35, size * 0.05, size / 2, size / 2, size * 0.75);
  g.addColorStop(0, mix(bg, '#ffffff', 0.35)); g.addColorStop(1, mix(bg, '#000000', 0.18));
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = Math.round(size * 0.66) + 'px ' + EMOJI_FONT;
  ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = size * 0.03; ctx.shadowOffsetY = size * 0.015;
  ctx.fillText(theme.emoji[f], size / 2, size * 0.55);
  ctx.shadowColor = 'transparent';
}
function drawArtFace(ctx, size, theme, f) {
  var g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, theme.bg[f]); g.addColorStop(1, theme.bg2[f]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  var seed = f * 97 + 13, rnd = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (var i = 0; i < 7; i++) {
    var x = rnd() * size, y = rnd() * size, r = size * (0.12 + rnd() * 0.26), rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, 'rgba(255,255,255,0.38)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
  }
}
function drawPhotoFace(ctx, size, img, f) {
  var s = Math.min(img.width, img.height), sx = (img.width - s) / 2, sy = (img.height - s) / 2;
  ctx.drawImage(img, sx, sy, s, s, 0, 0, size, size);
  ctx.fillStyle = PHOTO_TINT[f]; ctx.globalAlpha = 0.18; ctx.fillRect(0, 0, size, size);
  ctx.globalAlpha = 1; ctx.lineWidth = size * 0.07; ctx.strokeStyle = PHOTO_TINT[f]; ctx.strokeRect(0, 0, size, size);
}
// one square texture per face; each sticker shows its own window of it
function makeFaceTextures(THREE, theme, N, photoImg) {
  if (!theme.emoji && !theme.art && !(theme.photo && photoImg)) return null;
  var size = Math.min(1024, 200 * N + 112), out = [];
  for (var f = 0; f < 6; f++) {
    var cv = document.createElement('canvas'); cv.width = cv.height = size;
    var ctx = cv.getContext('2d');
    if (theme.photo) drawPhotoFace(ctx, size, photoImg, f); else if (theme.art) drawArtFace(ctx, size, theme, f); else drawEmojiFace(ctx, size, theme, f);
    var t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.needsUpdate = true;
    out.push(t);
  }
  return out;
}

root.Themes = { COLOUR: COLOUR, PICTURE: PICTURE, PHOTO: PHOTO, BODIES: BODIES, STYLES: STYLES, getTheme: getTheme, faceColours: faceColours, makeFaceTextures: makeFaceTextures, mix: mix };
})(typeof window !== 'undefined' ? window : this);
