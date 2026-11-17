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
 *  Úkol:   {text, hint, question, check(c) -> bool, autos: [{when(c)|null, machine, steps}]}
 *
 *  AUTO: kroky, které simulátor udělá za studenta (nastavení, doplnění textu
 *  souboru…), když platí podmínka WHEN, nebo bez ní po splnění úkolu. Každý
 *  blok proběhne jednou; evaluate() vrací, co se stalo (auto), aby to rozhraní
 *  ukázalo v terminálu.
 * ===================================================================== */
(function (root) {
  'use strict';
  var tr = root.GitI18n ? root.GitI18n.tr : function (s) { var a = arguments; return s.replace(/\{(\d+)\}/g, function (m, i) { return a[+i + 1]; }); };
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
      active: null, view: {}, term: {}, ide: {}, log: {}, done: {}, gh: {}, seen: null, cardState: {}, finished: false,
      autoFired: {}, autoNotes: {}, snapshots: {}
    };
    function at(minutesAgo, fn) {
      if (minutesAgo !== undefined && minutesAgo !== null) world.now = function () { return Math.floor(realNow() - minutesAgo * 60); };
      try { return fn(); } finally { world.now = realNow; }
    }
    var api = {
      // def: {id, name, email, login, label}; opts: {configured, hidden}
      person: function (def, opts) {
        opts = opts || {};
        var p = { id: def.id, name: def.name, email: def.email, login: def.login, label: def.label || (tr('Počítač ({0})', def.name)) };
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
      t.lines.push({ s: [[tr('Simulátor: napiš příkaz a stiskni Enter. Přehled příkazů ukáže help.'), 'n']], k: 'note' });
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

  // složka pro FILE/APPEND v AUTO: repozitář scénáře (REPOSITORY), když na počítači je, jinak aktuální složka
  function autoFolder(a, m) {
    if (a.scen.repoPath) {
      var p = m.home.concat(a.scen.repoPath), d = m.dirAt(p);
      if (d) return { dir: d, path: p };
    }
    return { dir: m.dir(), path: m.cwd.slice() };
  }

  // provede blok AUTO (jen jednou). Vrací {task, items: [{id, note, html} | {id, cmd, prompt, lines} | {id, file, folder, content}]}
  function fireAuto(a, i, k, auto) {
    var key = i + '.' + k;
    if (a.autoFired[key]) return null;
    a.autoFired[key] = true;
    var cur = auto.machine, ev = { task: i, items: [] };
    auto.steps.forEach(function (st) {
      if (st.op === 'as') { cur = st.id; return; }
      var m = a.world.machines[cur];
      if (!m) return;
      if (st.op === 'note') {
        ev.items.push({ id: cur, note: st.text, html: st.html });
        (a.autoNotes[i] = a.autoNotes[i] || []).push(st.html);
      } else if (st.op === 'run') {
        var prompt = m.prompt(), r = runAuto(m, st.cmd);
        if (r.open) applyOpen(a, cur, r.open);
        ev.items.push({ id: cur, cmd: st.cmd, prompt: prompt, lines: r.lines });
      } else if (st.op === 'file' || st.op === 'append') {
        var f = autoFolder(a, m), old = f.dir.files[st.name];
        f.dir.files[st.name] = st.op === 'file' || !old ? st.content : (/\n$/.test(old) ? old : old + '\n') + st.content;
        m.times = m.times || {};
        m.times[f.path.concat([st.name]).join('/')] = a.world.now();
        ev.items.push({ id: cur, file: st.name, folder: f.path, content: f.dir.files[st.name] });
      }
    });
    return ev;
  }

  // vyhodnotí úkoly; splněný úkol zůstává splněný. Vrací {newly, finishedNow, auto: [události AUTO]}
  function evaluate(a) {
    var c = checkCtx(a), tasks = a.scen.tasks, i, newly = false, finishedNow = false, events = [], pass, changed;
    function safe(fn) { try { return !!fn(c); } catch (e) { return false; } }
    // AUTO mění svět, takže se vyhodnocuje znovu, dokud se něco děje
    for (pass = 0; pass < 5; pass++) {
      changed = false;
      for (i = 0; i < tasks.length; i++) {
        if (a.done[i]) continue;
        var autos = tasks[i].autos || [];
        autos.forEach(function (au, k) {
          if (au.when && !a.autoFired[i + '.' + k] && safe(au.when)) { var ev = fireAuto(a, i, k, au); if (ev) { events.push(ev); changed = true; } }
        });
        if (safe(tasks[i].check)) {
          a.done[i] = true; newly = true; changed = true;
          autos.forEach(function (au, k) { if (!au.when) { var ev = fireAuto(a, i, k, au); if (ev) events.push(ev); } });
        }
      }
      if (!changed) break;
    }
    if (tasks.length && !a.finished && tasks.every(function (t, k) { return a.done[k]; })) {
      a.finished = true;
      finishedNow = true;
    }
    checkpoint(a);
    return { newly: newly, finishedNow: finishedNow, auto: events };
  }

  // ------------------------------------------------------------------
  //  Začít úkol znovu: na začátku každého úkolu (když se stane aktuálním)
  //  se uloží celý stav a jde se k němu vrátit. Nejde o UNDO příkazů –
  //  vrací se jen začátek rozpracovaného úkolu.
  // ------------------------------------------------------------------
  var NOT_SAVED = { scen: true, snapshots: true };
  function deepClone(x, seen) {
    if (x === null || typeof x !== 'object') return x;          // funkce a hodnoty beze změny
    if (seen.has(x)) return seen.get(x);
    var y = Array.isArray(x) ? [] : Object.create(Object.getPrototypeOf(x));
    seen.set(x, y);
    for (var k in x) if (Object.prototype.hasOwnProperty.call(x, k)) y[k] = deepClone(x[k], seen);
    return y;
  }
  function copyState(from, to) {
    var seen = new Map(), k;
    for (k in from) if (!NOT_SAVED[k]) to[k] = deepClone(from[k], seen);
    return to;
  }
  // první nesplněný úkol (-1 = všechno splněné nebo žádné úkoly)
  function currentTask(a) {
    for (var i = 0; i < a.scen.tasks.length; i++) if (!a.done[i]) return i;
    return -1;
  }
  function checkpoint(a) {
    var i = currentTask(a);
    if (i < 0 || a.snapshots[i]) return;
    // čekající Git (editor, přihlášení) se uložit nedá – uloží se až po něm
    for (var id in a.term) if (a.term[id].wait) return;
    a.snapshots[i] = copyState(a, {});
  }
  function canRestart(a, i) { return !!a.snapshots[i]; }
  // vrátí stav na začátek úkolu i; uložené začátky pozdějších úkolů zahodí
  function restartTask(a, i) {
    var snap = a.snapshots[i], k;
    if (!snap) return false;
    for (k in a) if (!NOT_SAVED[k]) delete a[k];
    copyState(snap, a);
    for (k in a.snapshots) if (+k > i) delete a.snapshots[k];
    return true;
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
    exec: exec, runAuto: runAuto, DEFAULT_PEOPLE: DEFAULT_PEOPLE,
    currentTask: currentTask, canRestart: canRestart, restartTask: restartTask
  };
})(typeof window !== 'undefined' ? window : globalThis);
