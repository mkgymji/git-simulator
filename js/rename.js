/*
 * Git simulátor – https://github.com/mkgymji/git-simulator
 * Copyright (C) 2026 Michal Kočer
 * SPDX-License-Identifier: GPL-2.0-only
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License version 2 (see LICENSE).
 *
 * Obsahuje kód převzatý z Gitu 2.47.1 (https://github.com/git/git), GPL-2.0:
 *   diffcore-rename.c – Copyright (C) 2005 Junio C Hamano a přispěvatelé Gitu
 *   diffcore-delta.c – přispěvatelé Gitu
 * Zdroje a autorská práva: ZDROJE.md
 */
/* =====================================================================
 *  rename.js – detekce přejmenovaných souborů
 *
 *  Převod diffcore-rename.c a diffcore-delta.c z Gitu 2.47:
 *  nejdřív přesné shody obsahu, potom podobnost (výchozí práh 50 %).
 *  Repozitář v simulátoru nemá podsložky, takže porovnávání podle
 *  stejného názvu souboru v jiné složce (find_basename_matches) odpadá.
 * ===================================================================== */
(function (root) {
  'use strict';
  var T = root.GitText;
  var MAX_SCORE = 60000, DEFAULT_SCORE = 30000, CANDIDATES = 4, HASHBASE = 107927;

  // diffcore-delta.c: rozdělí obsah na úseky (do konce řádku, nejvýš 64 bajtů)
  // a sečte jejich délky podle otisku
  function spans(text) {
    var buf = T.utf8(text), map = Object.create(null), n = 0, a1 = 0, a2 = 0, i, c, old1, h;
    function add(hv, cnt) { map[hv] = (map[hv] || 0) + cnt; }
    for (i = 0; i < buf.length; i++) {
      c = buf[i];
      old1 = a1;
      if (c === 13 && i + 1 < buf.length && buf[i + 1] === 10) continue;
      a1 = (((a1 << 7) >>> 0) ^ (a2 >>> 25)) >>> 0;
      a2 = (((a2 << 7) >>> 0) ^ (old1 >>> 25)) >>> 0;
      a1 = (a1 + c) >>> 0;
      if (++n < 64 && c !== 10) continue;
      h = ((a1 + Math.imul(a2, 0x61)) >>> 0) % HASHBASE;
      add(h, n);
      n = 0; a1 = 0; a2 = 0;
    }
    if (n > 0) { h = ((a1 + Math.imul(a2, 0x61)) >>> 0) % HASHBASE; add(h, n); }
    return map;
  }

  function srcCopied(srcMap, dstMap) {
    var sc = 0, k;
    for (k in srcMap) if (dstMap[k]) sc += Math.min(srcMap[k], dstMap[k]);
    return sc;
  }

  // estimate_similarity: kolik obsahu cíle pochází ze zdroje (0 až MAX_SCORE)
  function similarity(src, dst, minScore, cache) {
    var ss = T.utf8Length(src), ds = T.utf8Length(dst);
    var max = Math.max(ss, ds), base = Math.min(ss, ds), delta = max - base;
    if (max * (MAX_SCORE - minScore) < delta * MAX_SCORE) return 0;
    var sm = cache(src), dm = cache(dst);
    if (!ds) return 0;
    return Math.floor(srcCopied(sm, dm) * MAX_SCORE / max);
  }

  function basenameSame(a, b) {
    var i = a.length, j = b.length, c1, c2;
    while (i && j) {
      c1 = a.charAt(--i); c2 = b.charAt(--j);
      if (c1 !== c2) return 0;
      if (c1 === '/') return 1;
    }
    return ((!i || a.charAt(i - 1) === '/') && (!j || b.charAt(j - 1) === '/')) ? 1 : 0;
  }

  function scoreCompare(a, b) {
    if (a.dst < 0) return (0 <= b.dst) ? 1 : 0;
    else if (b.dst < 0) return -1;
    if (a.score === b.score) return b.name - a.name;
    return b.score - a.score;
  }

  // pairs: [{path, a: hash|null, b: hash|null}] v pořadí cest (tak jak je řadí Git)
  // vrací stejný seznam, kde přejmenování jsou {path: nová, from: stará, a, b, score}
  // a zdroje přejmenování jsou vynechané. opts: {renameEmpty}
  function detect(w, pairs, opts) {
    opts = opts || {};
    var renameEmpty = opts.renameEmpty !== false, minScore = DEFAULT_SCORE;
    var empty = w.hashBlob('');
    var dsts = [], srcs = [], i, j;
    pairs.forEach(function (p, idx) {
      if (!p.a) {
        if (!p.b) return;
        if (!renameEmpty && p.b === empty) return;
        dsts.push({ idx: idx, p: p, renamed: false });
      } else if (!renameEmpty && p.a === empty) {
        return;
      } else if (!p.b) {
        srcs.push({ idx: idx, p: p, used: false });
      }
    });
    var result = { map: Object.create(null), used: Object.create(null) };
    if (dsts.length && srcs.length) {
      // přesné shody (zdroje se procházejí od nejnižšího indexu)
      dsts.forEach(function (d) {
        var best = null, bestScore = -1;
        for (var k = 0; k < srcs.length; k++) {
          var s = srcs[k];
          if (s.p.a !== d.p.b) continue;
          if (s.used) continue;
          var sc = 1 + basenameSame(s.p.path, d.p.path);
          if (sc > bestScore) { best = s; bestScore = sc; if (sc === 2) break; }
        }
        if (best) {
          best.used = true; d.renamed = true;
          result.map[d.idx] = { from: best.p.path, a: best.p.a, score: MAX_SCORE };
          result.used[best.idx] = true;
        }
      });
      // podobnost se počítá jen pro "relevantní" zdroje (merge-ort), přesné shody pro všechny
      var rest = srcs.filter(function (s) { return !s.used && (!opts.relevant || opts.relevant[s.p.path]); });
      var todo = dsts.filter(function (d) { return !d.renamed; });
      if (rest.length && todo.length) {
        var cacheMap = Object.create(null);
        var cache = function (text) {
          var key = '$' + text;
          if (!(key in cacheMap)) cacheMap[key] = spans(text);
          return cacheMap[key];
        };
        var mx = [];
        todo.forEach(function (d, di) {
          var m = [];
          for (j = 0; j < CANDIDATES; j++) m.push({ dst: -1, src: -1, score: 0, name: 0 });
          rest.forEach(function (s, si) {
            var o = {
              score: similarity(s.p.ca !== undefined ? s.p.ca : w.blobs[s.p.a], d.p.cb !== undefined ? d.p.cb : w.blobs[d.p.b], minScore, cache),
              name: basenameSame(s.p.path, d.p.path), dst: di, src: si
            };
            var worst = 0;
            for (var q = 1; q < CANDIDATES; q++) if (scoreCompare(m[q], m[worst]) > 0) worst = q;
            if (scoreCompare(m[worst], o) > 0) m[worst] = o;
          });
          mx = mx.concat(m);
        });
        // stabilní řazení
        mx = mx.map(function (x, k) { return { x: x, k: k }; })
          .sort(function (p, q) { return scoreCompare(p.x, q.x) || (p.k - q.k); })
          .map(function (p) { return p.x; });
        for (i = 0; i < mx.length; i++) {
          var e = mx[i];
          if (e.dst < 0 || e.score < minScore) break;
          var d = todo[e.dst], s = rest[e.src];
          if (d.renamed || s.used) continue;
          d.renamed = true; s.used = true;
          result.map[d.idx] = { from: s.p.path, a: s.p.a, score: e.score };
          result.used[s.idx] = true;
        }
      }
    }
    var out = [];
    pairs.forEach(function (p, idx) {
      if (result.used[idx]) return;
      var r = result.map[idx];
      if (r) out.push({ path: p.path, from: r.from, a: r.a, b: p.b, score: r.score, cb: p.cb });
      else out.push(p);
    });
    return out;
  }

  // pprint_rename pro názvy bez podsložek (a => b), cesty už jsou případně v uvozovkách
  function similarityIndex(score) { return Math.floor(score * 100 / MAX_SCORE); }

  root.GitRename = { detect: detect, similarityIndex: similarityIndex, MAX_SCORE: MAX_SCORE };
})(typeof window !== 'undefined' ? window : globalThis);
