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
 *  scenarios.js – vestavěné scénáře
 *
 *  Texty scénářů jsou v scenarios/*.scenario (zabalené do scenarios-builtin.js),
 *  tady se jen přeloží jazykem scénářů. Chyba ve vestavěném scénáři se vypíše
 *  do konzole a scénář se vynechá.
 * ===================================================================== */
(function (root) {
  'use strict';
  var list = [], sources = {};
  (root.GitBuiltinScenarios || []).forEach(function (item) {
    var r = root.GitScenarioLang.compileAndTry(item.text, item.id);
    if (r.errors) {
      if (root.console) root.console.error('Vestavěný scénář ' + item.file + ' má chyby:', r.errors);
      return;
    }
    r.scenario.builtin = true;
    list.push(r.scenario);
    sources[item.id] = item.text;
  });
  root.GitScenarios = { list: list, source: function (id) { return sources[id]; } };
})(typeof window !== 'undefined' ? window : globalThis);
