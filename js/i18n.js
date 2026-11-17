/*
 * Git simulátor – https://github.com/mkgymji/git-simulator
 * Copyright (C) 2026 Michal Kočer
 * SPDX-License-Identifier: GPL-2.0-only
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License version 2 (see LICENSE).
 * Zdroje a autorská práva: ZDROJE.md
 */
/* =====================================================================
 *  i18n.js – čeština a angličtina
 *
 *  Texty jsou v kódu česky a obalené tr('…'). Klíčem překladu je český
 *  text, anglické znění je v js/i18n-en.js. Místo {0}, {1}… se dosadí
 *  další argumenty: tr('Soubor {0} už existuje.', name).
 *
 *  Jazyk: ?lang=cs|en v adrese > volba přepínačem (localStorage) >
 *  jazyk prohlížeče (čeština → cs, cokoli jiného → en). Bez prohlížeče
 *  (testy) česky.
 * ===================================================================== */
(function (root) {
  'use strict';
  var KEY = 'git-simulator-lang', LANGS = ['cs', 'en'], dicts = {}, missing = {};

  function detect() {
    try {
      var q = /[?&]lang=(cs|en)\b/.exec(root.location ? root.location.search : '');
      if (q) return q[1];
    } catch (e) { /* bez adresy */ }
    try {
      var s = root.localStorage && root.localStorage.getItem(KEY);
      if (LANGS.indexOf(s) >= 0) return s;
    } catch (e) { /* úložiště zakázané */ }
    var nav = root.navigator;
    if (!nav) return 'cs';
    var first = (nav.languages && nav.languages[0]) || nav.language || '';
    return /^cs\b/i.test(first) ? 'cs' : 'en';
  }

  var lang = detect();

  function fmt(s, args) {
    return s.replace(/\{(\d+)\}/g, function (m, i) { return args[+i] !== undefined ? String(args[+i]) : m; });
  }

  function tr(cs) {
    var args = Array.prototype.slice.call(arguments, 1), s = cs, d = dicts[lang];
    if (lang !== 'cs') {
      if (d && Object.prototype.hasOwnProperty.call(d, cs)) s = d[cs];
      else if (!missing[cs]) { missing[cs] = true; if (root.console && root.console.warn) root.console.warn('i18n: chybí překlad: ' + cs); }
    }
    return fmt(s, args);
  }

  root.GitI18n = {
    LANGS: LANGS,
    tr: tr,
    get lang() { return lang; },
    set: function (l) { if (LANGS.indexOf(l) >= 0) lang = l; },
    // volba přepínačem: zapamatuje se v tomto prohlížeči
    remember: function (l) { try { root.localStorage.setItem(KEY, l); } catch (e) { /* nic */ } },
    add: function (l, d) { dicts[l] = dicts[l] || {}; for (var k in d) dicts[l][k] = d[k]; },
    dict: function (l) { return dicts[l] || {}; },
    missing: function () { return Object.keys(missing); }
  };
})(typeof window !== 'undefined' ? window : globalThis);
