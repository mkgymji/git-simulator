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
 *  session.js – běh scénáře bez vazby na stránku
 *
 *  Sestaví svět podle scénáře (počítače, příprava, GitHub), vede záznam
 *  příkazů a vyhodnocuje úkoly. Používá ho rozhraní (ui.js) i testy.
 *
 *  Scénář: {id, kicker, title, short, intro (HTML), setup(api), tasks: [...]}
 *  Úkol:   {text, hint, question, check(c) -> bool}
 * ===================================================================== */
(function (root) {
  'use strict';
  var GW = root.GitWorld, SH = root.GitShell;

  // výchozí postavy, když scénář nedefinuje vlastní
  var DEFAULT_PEOPLE = {
    alice: { id: 'alice', name: 'Alice', email: 'alice@example.com', login: 'alice' },
    bob: { id: 'bob', name: 'Bob', email: 'bob@example.com', login: 'bob' }
  };

  var CONFIG_LINES = function (p) {
    return [['user.name', p.name], ['user.email', p.email], ['init.defaultBranch', 'main'], ['core.editor', 'code --wait'],
      ['pull.rebase', 'false'], ['core.quotepath', 'false']];
  };

  // provede příkaz a čekání (editor, přihlášení) vyřeší samo: editor beze změny, přihlášení úspěšné
  function runAuto(m, line) {
    var r = SH.run(m, line), lines = (r.lines || []).slice(), guard = 0, open = r.open, clear = r.clear;
    while (r.wait && guard++ < 5) {
      r = r.wait.type === 'editor' ? r.wait.resume(r.wait.text) : r.wait.resume(true);
      lines = lines.concat(r.lines || []);
    }
    return { lines: lines, open: open, clear: clear };
  }

  function create(scen) {
    var world = new GW.World();
    var realNow = world.now;
    var a = {
      scen: scen, world: world, people: [], hidden: {}, persons: {}, github: false,
      active: null, view: {}, term: {}, ide: {}, log: {}, done: {}, gh: {}, seen: null, cardState: {}, finished: false
    };
    function at(minutesAgo, fn) {
      if (minutesAgo !== undefined && minutesAgo !== null) world.now = function () { return Math.floor(realNow() - minutesAgo * 60); };
      try { return fn(); } finally { world.now = realNow; }
    }
    var api = {
      // def: {id, name, email, login, label}; opts: {configured, hidden}
      person: function (def, opts) {
        opts = opts || {};
        var p = { id: def.id, name: def.name, email: def.email, login: def.login, label: def.label || ('Počítač (' + def.name + ')') };
        if (!world.accounts[p.login]) world.addAccount(p.login, p.name, p.email);
        var m = world.addMachine(p.id, { login: p.login, home: p.id, label: p.label });
        if (opts.configured) CONFIG_LINES(p).forEach(function (kv) { GW.configSet(m.config, kv[0], kv[1]); });
        a.persons[p.id] = p;
        if (opts.hidden) a.hidden[p.id] = true;
        else a.people.push(p.id);
        a.term[p.id] = { lines: [], history: [], hpos: -1, wait: null };
        a.ide[p.id] = { folder: null, file: null, buffer: '', dirty: false, preview: true, creating: false };
        a.log[p.id] = [];
        a.gh[p.id] = { page: 'home' };
        a.view[p.id] = 'pc';
        return m;
      },
      github: function (on) { a.github = on; },
      mkdir: function (id, rel) { var m = world.machines[id]; m.mkdirp(m.home.concat(rel)); },
      cd: function (id, rel) { var m = world.machines[id]; m.cwd = m.home.concat(rel); },
      write: function (id, name, content) { world.machines[id].dir().files[name] = content; },
      run: function (id, line, minutesAgo) { return at(minutesAgo, function () { return runAuto(world.machines[id], line); }); },
      open: function (id, rel) { var m = world.machines[id]; a.ide[id].folder = m.home.concat(rel); },
      remote: function (owner, name, opts, minutesAgo) {
        return at(minutesAgo || 0, function () {
          var r = world.createRemote(owner, name, { private: !(opts && opts.public), readme: !!(opts && opts.readme) });
          if (!r) return null;
          r.collaborators = (opts && opts.collaborators) || [];
          r.invites = [];
          return r;
        });
      }
    };
    scen.setup(api);
    a.active = a.people[0];
    for (var k in world.remotes) if (!world.remotes[k].invites) world.remotes[k].invites = [];
    a.people.forEach(function (id) {
      var t = a.term[id];
      t.lines.push({ s: [['Windows PowerShell', '']] });
      t.lines.push({ s: [['Simulátor: napiš příkaz a stiskni Enter. Přehled příkazů ukáže help.', 'n']], k: 'note' });
      t.lines.push({ s: [] });
    });
    return a;
  }

  function checkCtx(a) {
    return {
      world: a.world,
      m: function (id) { return a.world.machines[id]; },
      log: function (id) { return a.log[id] || []; },
      openFolder: function (id) { var f = a.ide[id] && a.ide[id].folder; return f ? f.join('/') : null; },
      firstMachine: a.people[0]
    };
  }

  // vyhodnotí úkoly; splněný úkol zůstává splněný. Vrací {newly, finishedNow}
  function evaluate(a) {
    var c = checkCtx(a), tasks = a.scen.tasks, i, newly = false, finishedNow = false;
    for (i = 0; i < tasks.length; i++) {
      if (a.done[i]) continue;
      var ok = false;
      try { ok = !!tasks[i].check(c); } catch (e) { ok = false; }
      if (ok) { a.done[i] = true; newly = true; }
    }
    if (tasks.length && !a.finished && tasks.every(function (t, k) { return a.done[k]; })) {
      a.finished = true;
      finishedNow = true;
    }
    return { newly: newly, finishedNow: finishedNow };
  }

  // záznam příkazu (pro kontroly "command … was run" a "output of …")
  function logEntry(a, id, line, cwd) {
    var entry = { line: line, cwd: cwd, out: [] };
    if (line.trim()) a.log[id].push(entry);
    return entry;
  }

  // příkaz code: otevře složku nebo soubor ve VS Code. Vrací {folderChanged, error}
  function applyOpen(a, id, open) {
    var ide = a.ide[id], mm = a.world.machines[id];
    if (open.folder) {
      var changed = !ide.folder || ide.folder.join('/') !== open.folder.join('/');
      ide.folder = open.folder; ide.file = null; ide.dirty = false;
      mm.cwd = open.folder.slice();
      return { folderChanged: changed };
    }
    if (open.file) {
      var folder = open.file.slice(0, -1), name = open.file[open.file.length - 1];
      if (!ide.folder) ide.folder = folder;
      else if (ide.folder.join('/') !== folder.join('/')) return { error: 'outside' };
      var d = mm.dirAt(folder);
      if (!(name in d.files)) d.files[name] = '';
      ide.file = name; ide.buffer = d.files[name]; ide.dirty = false;
    }
    return {};
  }

  // pro testy: příkaz jako od studenta, čekání se vyřeší samo
  function exec(a, id, line) {
    var mm = a.world.machines[id], entry = logEntry(a, id, line, mm.cwd.slice());
    var r = runAuto(mm, line);
    entry.out = r.lines;
    if (r.open) applyOpen(a, id, r.open);
    return r;
  }

  root.GitSession = {
    create: create, evaluate: evaluate, checkCtx: checkCtx, logEntry: logEntry, applyOpen: applyOpen,
    exec: exec, runAuto: runAuto, DEFAULT_PEOPLE: DEFAULT_PEOPLE
  };
})(typeof window !== 'undefined' ? window : globalThis);
