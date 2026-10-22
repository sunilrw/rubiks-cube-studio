/* Saved settings, the game in progress, and personal records. Everything stays in this browser. */
(function (root) {
'use strict';
var KEY = 'rcube-studio-v1', GAME = 'rcube-studio-game-v1', REC = 'rcube-studio-records-v1';
var DEFAULTS = {
  size: 3, mode: 'free', kind: 'colour', id: 'classic', body: null, style: 'raised', matte: false, bg: 'studio', speed: 2,
  sound: true, vol: 50, haptic: true, labels: false, confetti: true, hand: true, arrows: true, follow: true, autoBg: false, rotate: false,
  inspect: true, scrLen: {}, menuSeen: false
};
function read(k, fallback) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; } }
function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }

var settings = (function () { var s = read(KEY, {}), o = {}; for (var k in DEFAULTS) o[k] = s && s[k] !== undefined ? s[k] : DEFAULTS[k]; if (!o.scrLen || typeof o.scrLen !== 'object') o.scrLen = {}; return o; })();
var records = read(REC, {});

root.Store = {
  settings: settings,
  save: function () { write(KEY, settings); },
  saveGame: function (g) { write(GAME, g); },
  loadGame: function () { return read(GAME, null); },
  clearGame: function () { try { localStorage.removeItem(GAME); } catch (e) {} },
  records: function () { return records; },
  // returns { best: bool, rec } after adding a solved time for this size
  addSolve: function (size, ms, moves) {
    var r = records[size] || (records[size] = { solves: 0, best: null, bestMoves: null, last: [] }), isBest = r.best === null || ms < r.best;
    r.solves++; if (isBest) r.best = ms; if (r.bestMoves === null || moves < r.bestMoves) r.bestMoves = moves;
    r.last.unshift(ms); r.last = r.last.slice(0, 5); write(REC, records); return { best: isBest, rec: r };
  },
  resetAll: function () { try { localStorage.removeItem(KEY); localStorage.removeItem(GAME); localStorage.removeItem(REC); } catch (e) {} }
};
})(typeof window !== 'undefined' ? window : this);
