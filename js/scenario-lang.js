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
 *  scenario-lang.js – jazyk scénářů (FORMAT 1)
 *
 *  GitScenarioLang.compile(text, id) vrací {scenario} nebo {errors: [{line, msg}]}.
 *  Scénář je jen data: žádný JavaScript, podmínky jsou věty z pevného slovníku.
 *  Popis jazyka: docs/SCENARE.md
 * ===================================================================== */
(function (root) {
  'use strict';
  var FORMAT = 1;
  var GS = root.GitSim, GW = root.GitWorld;

  // ------------------------------------------------------------------
  //  Pomocné funkce
  // ------------------------------------------------------------------
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  // `kód`, **tučně**, *kurzíva* – vše ostatní se escapuje
  function inline(text) {
    var codes = [];
    var s = String(text).replace(/`([^`]+)`/g, function (m, c) { codes.push(c); return '\u0000' + (codes.length - 1) + '\u0000'; });
    s = esc(s).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
    return s.replace(/\u0000(\d+)\u0000/g, function (m, i) { return '<code>' + esc(codes[+i]) + '</code>'; });
  }

  function slug(s) {
    return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'scenar';
  }

  // řetězce v uvozovkách "…" (také „…“ a “…”)
  var Q = '(?:"([^"]*)"|„([^“”]*)[“”]|“([^”]*)”)';
  function qv(m, i) { return m[i] !== undefined ? m[i] : m[i + 1] !== undefined ? m[i + 1] : m[i + 2]; }

  function normCmd(s) { return String(s).trim().replace(/\s+/g, ' '); }
  // "git log" = přesně; "git restore --source=..." (… nebo ...) = začátek příkazu
  function cmdMatcher(pattern) {
    var p = normCmd(pattern), prefix = /(\.\.\.|…)$/.test(p);
    if (prefix) p = p.replace(/(\.\.\.|…)$/, '');
    return function (line) { var l = normCmd(line); return prefix ? l.indexOf(p) === 0 : l === p; };
  }
  function outText(entry) { return entry.out.map(function (l) { return l.s.map(function (x) { return x[0]; }).join(''); }).join('\n'); }

  // ------------------------------------------------------------------
  //  Podmínky (CHECK) – slovník
  //  Každé pravidlo: re (bez předpony počítače), need ('repo' = potřebuje REPOSITORY), make(m, ctx) -> fn(c, id)
  // ------------------------------------------------------------------
  var LOC = '(?:\\s+(in HEAD|in commit ' + Q + '|in branch (\\S+)|on github (\\S+?/\\S+)))?';
  var TEXTCOND = '(exists|does not exist|contains ' + Q + '|does not contain ' + Q + '|contains line starting with ' + Q + '|has no conflict markers)';

  function textTest(kind, val) {
    if (kind === 'contains') return function (t) { return t !== null && t.indexOf(val) >= 0; };
    if (kind === 'does not contain') return function (t) { return t !== null && t.indexOf(val) < 0; };
    if (kind === 'line') return function (t) { return t !== null && t.split('\n').some(function (l) { return l.indexOf(val) === 0; }); };
    if (kind === 'nomarkers') return function (t) { return t !== null && !/^(<{7}|={7}|>{7})( |$)/m.test(t); };
    return null;
  }
  function parseTextCond(mm, base) {
    // mm = výsledek regexu, base = index skupiny TEXTCOND
    var what = mm[base];
    if (what === 'exists') return { kind: 'exists' };
    if (what === 'does not exist') return { kind: 'missing' };
    if (what === 'has no conflict markers') return { kind: 'nomarkers' };
    if (/^contains line starting with/.test(what)) return { kind: 'line', val: qv(mm, base + 7) };
    if (/^does not contain/.test(what)) return { kind: 'does not contain', val: qv(mm, base + 4) };
    return { kind: 'contains', val: qv(mm, base + 1) };
  }

  function repoOf(c, id, path) {
    var m = c.m(id), d = m && m.dirAt(m.home.concat(path));
    return d && d.repo ? { dir: d, repo: d.repo } : null;
  }
  function isRevertMsg(msg) { return /^(Revert|Reapply) "/.test(msg); }
  function historyOf(c, repo) {
    var h = repo.headHash();
    if (!h) return [];
    return Object.keys(c.world.ancestors(h)).map(function (x) { return c.world.commits[x]; })
      .sort(function (x, y) { return y.seq - x.seq; });
  }
  function findCommit(c, repo, msg) {
    var low = msg.toLowerCase(), wantRevert = isRevertMsg(msg);
    var list = historyOf(c, repo).filter(function (k) { return k.message.toLowerCase().indexOf(low) >= 0 && (wantRevert || !isRevertMsg(k.message)); });
    return list[0] || null;
  }
  function treeText(c, commit, name) {
    if (!commit) return null;
    var t = c.world.trees[commit.tree];
    return t && t[name] ? c.world.blobs[t[name]] : null;
  }
  function remoteOf(c, key) { return c.world.remotes[key.toLowerCase()] || null; }

  var RULES = [
    { re: new RegExp('^file (\\S+)' + LOC + '\\s+' + TEXTCOND + '$'), need: 'repo-or-github', make: function (mm, ctx) {
      var name = mm[1], loc = mm[2] || '', locCommit = qv(mm, 3), locBranch = mm[6], locGithub = mm[7];
      var cond = parseTextCond(mm, 8), test = textTest(cond.kind, cond.val);
      if (locGithub) ctx.githubRefs.push(locGithub);
      return function (c, id) {
        var text = null;
        if (locGithub) {
          var r = remoteOf(c, locGithub), h = r && r.branches[r.defaultBranch];
          text = h ? treeText(c, c.world.commits[h], name) : null;
        } else {
          var rr = repoOf(c, id, ctx.repoPath);
          if (!rr) return false;
          if (!loc) text = (name in rr.dir.files) ? rr.dir.files[name] : null;
          else if (loc === 'in HEAD') text = treeText(c, rr.repo.headHash() ? c.world.commits[rr.repo.headHash()] : null, name);
          else if (locBranch) { var bh = rr.repo.branches[locBranch]; text = bh ? treeText(c, c.world.commits[bh], name) : null; }
          else {
            var k = findCommit(c, rr.repo, locCommit);
            if (!k) return false;
            text = treeText(c, k, name);
          }
        }
        if (cond.kind === 'exists') return text !== null;
        if (cond.kind === 'missing') return text === null;
        return test(text);
      };
    }, needsRepo: function (mm) { return !mm[7]; } },
    { re: /^repository exists$/, needsRepo: true, make: function (mm, ctx) {
      return function (c, id) { return !!repoOf(c, id, ctx.repoPath); };
    } },
    { re: new RegExp('^commit ' + Q + ' (exists|is reverted)$'), needsRepo: true, make: function (mm, ctx) {
      var msg = qv(mm, 1), what = mm[4];
      return function (c, id) {
        var rr = repoOf(c, id, ctx.repoPath);
        if (!rr) return false;
        if (what === 'exists') return !!findCommit(c, rr.repo, msg);
        var low = msg.toLowerCase(), hist = historyOf(c, rr.repo);
        var bad = hist.filter(function (k) { return k.message.toLowerCase().indexOf(low) >= 0 && !isRevertMsg(k.message); });
        return bad.some(function (b) { return hist.some(function (k) { return k.message.indexOf('This reverts commit ' + b.hash) >= 0; }); });
      };
    } },
    { re: /^commit count is at least (\d+)$/, needsRepo: true, make: function (mm, ctx) {
      var n = parseInt(mm[1], 10);
      return function (c, id) { var rr = repoOf(c, id, ctx.repoPath); return !!rr && historyOf(c, rr.repo).length >= n; };
    } },
    { re: /^HEAD is a merge$/, needsRepo: true, make: function (mm, ctx) {
      return function (c, id) { var rr = repoOf(c, id, ctx.repoPath), h = rr && rr.repo.headHash(); return !!h && c.world.commits[h].parents.length === 2; };
    } },
    { re: /^(no )?merge is in progress$/, needsRepo: true, make: function (mm, ctx) {
      var neg = !!mm[1];
      return function (c, id) { var rr = repoOf(c, id, ctx.repoPath); if (!rr) return false; return neg ? !rr.repo.merge : !!rr.repo.merge; };
    } },
    { re: /^branch (\S+) exists$/, needsRepo: true, make: function (mm, ctx) {
      return function (c, id) { var rr = repoOf(c, id, ctx.repoPath); return !!rr && !!rr.repo.branches[mm[1]]; };
    } },
    { re: /^on branch (\S+)$/, needsRepo: true, make: function (mm, ctx) {
      return function (c, id) { var rr = repoOf(c, id, ctx.repoPath); return !!rr && rr.repo.head === mm[1]; };
    } },
    { re: /^branches (\S+) and (\S+) have diverged$/, needsRepo: true, make: function (mm, ctx) {
      return function (c, id) {
        var rr = repoOf(c, id, ctx.repoPath);
        if (!rr) return false;
        var x = rr.repo.branches[mm[1]], y = rr.repo.branches[mm[2]];
        return !!x && !!y && !c.world.isAncestor(x, y) && !c.world.isAncestor(y, x);
      };
    } },
    { re: new RegExp('^command ' + Q + ' was run(?: after command ' + Q + ')?$'), make: function (mm) {
      var a = cmdMatcher(qv(mm, 1)), afterPat = qv(mm, 4), b = afterPat !== undefined ? cmdMatcher(afterPat) : null;
      return function (c, id) {
        var log = c.log(id), i, j;
        for (i = 0; i < log.length; i++) {
          if (!a(log[i].line)) continue;
          if (!b) return true;
          for (j = 0; j < i; j++) if (b(log[j].line)) return true;
        }
        return false;
      };
    } },
    { re: new RegExp('^output of ' + Q + ' (contains ' + Q + '|does not contain ' + Q + '|contains line starting with ' + Q + ')$'), make: function (mm) {
      var match = cmdMatcher(qv(mm, 1)), what = mm[4], kind, val;
      if (/^contains line/.test(what)) { kind = 'line'; val = qv(mm, 11); }
      else if (/^does not/.test(what)) { kind = 'does not contain'; val = qv(mm, 8); }
      else { kind = 'contains'; val = qv(mm, 5); }
      var test = textTest(kind, val);
      return function (c, id) { return c.log(id).some(function (e) { return match(e.line) && test(outText(e)); }); };
    } },
    { re: new RegExp('^config (\\S+) (is set|is ' + Q + '|contains ' + Q + ')$'), make: function (mm) {
      var key = mm[1], what = mm[2], val = /^is "/.test(what) || /^is [„“]/.test(what) ? qv(mm, 3) : qv(mm, 6);
      return function (c, id) {
        var v = c.m(id).getConfig(key);
        if (what === 'is set') return v !== undefined && v !== '';
        if (/^is /.test(what)) return v === val;
        return v !== undefined && v.indexOf(val) >= 0;
      };
    } },
    { re: /^vscode folder is (\S+)$/, make: function (mm) {
      var rel = mm[1].replace(/^\/+|\/+$/g, '');
      return function (c, id) { var m = c.m(id); return c.openFolder(id) === m.home.concat(rel.split('/')).join('/'); };
    } },
    { re: /^github (\S+?\/\S+) (exists|has branch (\S+)|has collaborator (\S+)|(\S+) equals HEAD|(\S+) is a merge)$/, make: function (mm, ctx) {
      var key = mm[1], what = mm[2];
      ctx.githubRefs.push(key);
      return function (c, id) {
        var r = remoteOf(c, key);
        if (!r) return false;
        if (what === 'exists') return true;
        if (mm[3]) return !!r.branches[mm[3]];
        if (mm[4]) return r.collaborators.indexOf(mm[4]) >= 0;
        if (mm[5]) { var rr = repoOf(c, id, ctx.repoPath); return !!rr && !!r.branches[mm[5]] && r.branches[mm[5]] === rr.repo.headHash(); }
        var h = r.branches[mm[6]];
        return !!h && c.world.commits[h].parents.length === 2;
      };
    }, needsRepo: function (mm) { return !!mm[5]; } }
  ];
  var CHECK_STARTS = ['file', 'repository exists', 'commit', 'HEAD is a merge', 'merge is in progress', 'no merge is in progress',
    'branch', 'on branch', 'branches', 'command', 'output of', 'config', 'vscode folder is', 'github'];

  // ------------------------------------------------------------------
  //  Parser
  // ------------------------------------------------------------------
  function compile(text, idHint) {
    var lines = String(text).replace(/\r\n?/g, '\n').replace(/^﻿/, '').split('\n');
    var errors = [], i = 0;
    function err(n, msg) { errors.push({ line: n + 1, msg: msg }); }
    function isBlank(l) { return /^\s*$/.test(l); }
    function isComment(l) { return /^\s*#/.test(l); }
    function kw(l) { var m = /^\s*(PS>|[A-Z][A-Z-]*)(?:\s+(.*))?$/.exec(l); return m ? { k: m[1], rest: (m[2] || '').replace(/\s+$/, '') } : null; }
    function skip() { while (i < lines.length && (isBlank(lines[i]) || isComment(lines[i]))) i++; }

    var sc = { format: null, title: null, label: '', summary: '', intro: [], persons: {}, machines: [], steps: [], repoPath: null, github: false, tasks: [] };
    var known = {}, k;
    for (k in root.GitSession.DEFAULT_PEOPLE) known[k] = root.GitSession.DEFAULT_PEOPLE[k];

    // FORMAT
    skip();
    var first = i < lines.length ? kw(lines[i]) : null;
    if (!first || first.k !== 'FORMAT') {
      err(i < lines.length ? i : 0, 'Scénář musí začínat řádkem FORMAT 1.');
      return { errors: errors };
    }
    if (!/^\d+$/.test(first.rest)) { err(i, 'Za FORMAT patří číslo verze, např. FORMAT 1.'); return { errors: errors }; }
    if (+first.rest > FORMAT) { err(i, 'Scénář je zapsaný ve verzi FORMAT ' + first.rest + ', tento simulátor umí jen FORMAT ' + FORMAT + '. Aktualizuj simulátor.'); return { errors: errors }; }
    if (+first.rest < 1) { err(i, 'Neznámá verze FORMAT ' + first.rest + '.'); return { errors: errors }; }
    sc.format = +first.rest;
    i++;

    // hlavička: SCENARIO, LABEL?, SUMMARY?, INTRO*
    var order = { SCENARIO: 0, LABEL: 1, SUMMARY: 2, INTRO: 3 }, last = -1;
    for (;;) {
      skip();
      if (i >= lines.length) break;
      var h = kw(lines[i]);
      if (!h || order[h.k] === undefined) break;
      if (order[h.k] < last || (order[h.k] === last && h.k !== 'INTRO')) err(i, 'Hlavička má pevné pořadí: SCENARIO, LABEL, SUMMARY, INTRO (každé jednou, INTRO víckrát).');
      last = Math.max(last, order[h.k]);
      if (!h.rest) err(i, h.k + ' potřebuje text.');
      if (h.k === 'SCENARIO') sc.title = h.rest;
      else if (h.k === 'LABEL') sc.label = h.rest;
      else if (h.k === 'SUMMARY') sc.summary = h.rest;
      else sc.intro.push(h.rest);
      i++;
    }
    if (!sc.title) err(i < lines.length ? i : lines.length - 1, 'Chybí řádek SCENARIO s názvem scénáře (hned za FORMAT).');

    // SETUP … END
    skip();
    var s0 = i < lines.length ? kw(lines[i]) : null;
    if (!s0 || s0.k !== 'SETUP') {
      err(i < lines.length ? i : lines.length - 1, 'Po hlavičce musí následovat blok SETUP … END.');
      return { errors: errors };
    }
    i++;
    var current = null, acted = false, setupEnd = false, ghShow = false;
    while (i < lines.length) {
      var raw = lines[i];
      if (isBlank(raw) || isComment(raw)) { i++; continue; }
      var t = kw(raw);
      if (!t) { err(i, 'Neznámý řádek v SETUP. Řádek musí začínat klíčovým slovem (MACHINE, PS>, FILE…).'); i++; continue; }
      if (t.k === 'END') { setupEnd = true; i++; break; }
      if (t.k === 'TASK') { err(i, 'Blok SETUP není ukončený řádkem END.'); break; }
      var ln = i;
      if (t.k === 'PERSON') {
        if (acted) err(ln, 'PERSON a MACHINE patří na začátek SETUP, před příkazy.');
        var pm = /^([a-z][a-z0-9-]*)\s*(.*)$/.exec(t.rest);
        if (!pm) { err(ln, 'PERSON: chybí id postavy (malá písmena bez diakritiky), např. PERSON jana NAME "Jana Nováková".'); i++; continue; }
        var attrs = {}, rest = pm[2], am, are = /(NAME|EMAIL|LOGIN|LABEL)\s+"([^"]*)"/g, consumed = rest.replace(are, function (m, a, v) { attrs[a] = v; return ''; });
        if (/\S/.test(consumed)) err(ln, 'PERSON: nerozumím části „' + consumed.trim() + '“. Povolené: NAME "…" EMAIL "…" LOGIN "…" LABEL "…".');
        if (!attrs.NAME) err(ln, 'PERSON ' + pm[1] + ': chybí NAME "Jméno Příjmení".');
        var login = attrs.LOGIN || pm[1];
        if (!/^[A-Za-z0-9-]+$/.test(login)) err(ln, 'PERSON ' + pm[1] + ': LOGIN smí obsahovat jen písmena bez diakritiky, číslice a pomlčku.');
        known[pm[1]] = { id: pm[1], name: attrs.NAME || pm[1], email: attrs.EMAIL || (pm[1] + '@example.com'), login: login, label: attrs.LABEL || '' };
      } else if (t.k === 'MACHINE') {
        if (acted) err(ln, 'PERSON a MACHINE patří na začátek SETUP, před příkazy.');
        var mp = t.rest.split(/\s+/), mid = mp[0], flags = mp.slice(1);
        if (!known[mid]) err(ln, 'MACHINE ' + mid + ': taková postava není. Nadefinuj ji řádkem PERSON, nebo použij alice / bob.');
        else if (sc.machines.some(function (x) { return x.id === mid; })) err(ln, 'MACHINE ' + mid + ' je tu podruhé.');
        else {
          flags.forEach(function (f) { if (f !== 'CONFIGURED' && f !== 'HIDDEN') err(ln, 'MACHINE: neznámá volba ' + f + ' (povolené CONFIGURED, HIDDEN).'); });
          sc.machines.push({ id: mid, configured: flags.indexOf('CONFIGURED') >= 0, hidden: flags.indexOf('HIDDEN') >= 0 });
          if (!current) current = mid;
        }
      } else {
        acted = true;
        if (!sc.machines.length && t.k !== 'SHOW' && t.k !== 'REPOSITORY' && t.k !== 'GITHUB') err(ln, 'Nejdřív nadefinuj počítač řádkem MACHINE.');
        if (t.k === 'AS') {
          if (!sc.machines.some(function (x) { return x.id === t.rest; })) err(ln, 'AS ' + t.rest + ': takový počítač není (chybí MACHINE ' + t.rest + ').');
          else { current = t.rest; sc.steps.push({ op: 'as', id: t.rest, line: ln }); }
        } else if (t.k === 'PS>') {
          if (!t.rest) err(ln, 'PS> potřebuje příkaz.');
          else sc.steps.push({ op: 'run', id: current, cmd: t.rest, line: ln });
        } else if (t.k === 'FILE') {
          if (!t.rest || /[\\\/:*?"<>|]/.test(t.rest)) err(ln, 'FILE potřebuje název souboru bez lomítek, např. FILE recept.md');
          var content = [], closed = false;
          i++;
          while (i < lines.length) {
            if (/^\s*END\s*$/.test(lines[i])) { closed = true; break; }
            content.push(lines[i]);
            i++;
          }
          if (!closed) { err(ln, 'FILE ' + t.rest + ' není ukončený řádkem END.'); break; }
          var ind = null;
          content.forEach(function (l) { if (/\S/.test(l)) { var n = /^[ \t]*/.exec(l)[0].length; ind = ind === null ? n : Math.min(ind, n); } });
          var body = content.map(function (l) { return l.slice(ind || 0).replace(/\s+$/, ''); });
          while (body.length && body[body.length - 1] === '') body.pop();
          sc.steps.push({ op: 'file', id: current, name: t.rest, content: body.length ? body.join('\n') + '\n' : '', line: ln });
        } else if (t.k === 'GITHUB') {
          var gm = /^(\S+?)\/(\S+)\s*(.*)$/.exec(t.rest);
          if (!gm) { err(ln, 'GITHUB potřebuje vlastníka a název: GITHUB alice/kucharka'); i++; continue; }
          var gopts = { public: false, readme: false, collaborators: [] }, gw = gm[3].split(/\s+/).filter(Boolean), gi;
          for (gi = 0; gi < gw.length; gi++) {
            if (gw[gi] === 'PUBLIC') gopts.public = true;
            else if (gw[gi] === 'PRIVATE') gopts.public = false;
            else if (gw[gi] === 'README') gopts.readme = true;
            else if (gw[gi] === 'COLLABORATOR' && gw[gi + 1]) gopts.collaborators.push(gw[++gi]);
            else err(ln, 'GITHUB: neznámá volba ' + gw[gi] + ' (povolené PUBLIC, PRIVATE, README, COLLABORATOR login).');
          }
          sc.steps.push({ op: 'github', owner: gm[1], name: gm[2], opts: gopts, line: ln });
        } else if (t.k === 'SHOW') {
          if (t.rest !== 'GITHUB') err(ln, 'Známe jen SHOW GITHUB.');
          ghShow = true;
        } else if (t.k === 'REPOSITORY') {
          if (sc.repoPath !== null) err(ln, 'REPOSITORY může být jen jednou.');
          if (!t.rest) err(ln, 'REPOSITORY potřebuje cestu od domovské složky, např. REPOSITORY git/kucharka');
          sc.repoPath = t.rest.replace(/^~?[\\\/]*/, '').replace(/[\\\/]+$/, '').split(/[\\\/]+/).filter(Boolean);
        } else if (t.k === 'VSCODE') {
          if (!t.rest) err(ln, 'VSCODE potřebuje složku od domovské složky, např. VSCODE git/kucharka');
          else sc.steps.push({ op: 'vscode', id: current, path: t.rest.replace(/^~?[\\\/]*/, '').replace(/[\\\/]+$/, '').split(/[\\\/]+/).filter(Boolean), line: ln });
        } else err(ln, 'Neznámé klíčové slovo ' + t.k + ' v SETUP. Povolené: PERSON, MACHINE, AS, PS>, FILE, GITHUB, SHOW GITHUB, REPOSITORY, VSCODE.');
      }
      i++;
    }
    if (!setupEnd && !errors.length) err(lines.length - 1, 'Blok SETUP není ukončený řádkem END.');
    if (!sc.machines.length) err(0, 'Scénář potřebuje aspoň jeden počítač (MACHINE v SETUP).');
    if (!sc.machines.some(function (x) { return !x.hidden; }) && sc.machines.length) err(0, 'Aspoň jeden počítač musí být viditelný (bez HIDDEN).');
    sc.github = ghShow;
    // vlastník GitHub repozitáře musí být známý účet
    sc.steps.forEach(function (s) {
      if (s.op !== 'github') return;
      var ok = sc.machines.some(function (x) { return known[x.id] && known[x.id].login === s.owner; });
      if (!ok) err(s.line, 'GITHUB ' + s.owner + '/' + s.name + ': účet ' + s.owner + ' nepatří žádnému počítači ze scénáře.');
    });

    // TASK … END
    var ctx = { repoPath: sc.repoPath || [], githubRefs: [] };
    var machineIds = sc.machines.map(function (x) { return x.id; });
    for (;;) {
      skip();
      if (i >= lines.length) break;
      var tk = kw(lines[i]);
      if (!tk || tk.k !== 'TASK') { err(i, 'Za SETUP mohou být jen bloky TASK … END.'); i++; continue; }
      if (!tk.rest) err(i, 'TASK potřebuje text úkolu.');
      var task = { text: tk.rest, hints: [], question: null, checks: [], line: i }, phase = 0, tclosed = false;
      i++;
      while (i < lines.length) {
        var tl = lines[i];
        if (isBlank(tl) || isComment(tl)) { i++; continue; }
        var tt = kw(tl);
        if (!tt) { err(i, 'Neznámý řádek v TASK (povolené HINT, NOTE, QUESTION, CHECK, END).'); i++; continue; }
        if (tt.k === 'END') { tclosed = true; i++; break; }
        if (tt.k === 'TASK') break;
        if (tt.k === 'HINT' || tt.k === 'NOTE') {
          if (phase > 0) err(i, tt.k + ' patří před QUESTION a CHECK.');
          task.hints.push({ code: tt.k === 'HINT', text: tt.rest });
        } else if (tt.k === 'QUESTION') {
          if (phase > 1) err(i, 'QUESTION patří před CHECK.');
          if (task.question !== null) err(i, 'TASK může mít jen jednu QUESTION.');
          task.question = tt.rest; phase = 1;
        } else if (tt.k === 'CHECK') {
          phase = 2;
          var body2 = tt.rest, who = null, pref = /^([a-z][a-z0-9-]*):\s*(.*)$/.exec(body2);
          if (pref) {
            if (machineIds.indexOf(pref[1]) < 0) err(i, 'CHECK ' + pref[1] + ': – takový počítač ve scénáři není.');
            who = pref[1]; body2 = pref[2];
          }
          var rule = null, mm = null, r;
          for (r = 0; r < RULES.length; r++) { mm = RULES[r].re.exec(body2.trim()); if (mm) { rule = RULES[r]; break; } }
          if (!rule) {
            var near = CHECK_STARTS.filter(function (s) { return body2.trim().indexOf(s.split(' ')[0]) === 0; });
            err(i, 'Neznám podmínku „' + body2.trim() + '“.' + (near.length ? ' Podmínky začínající „' + near[0].split(' ')[0] + '“ jsou popsané v docs/SCENARE.md.' : ' Podmínka musí začínat jedním z: ' + CHECK_STARTS.join(', ') + '.'));
          } else {
            var needsRepo = typeof rule.needsRepo === 'function' ? rule.needsRepo(mm) : !!rule.needsRepo;
            if (needsRepo && !sc.repoPath) err(i, 'Tahle podmínka se týká repozitáře – doplň do SETUP řádek REPOSITORY cesta/k/repozitari.');
            task.checks.push({ fn: rule.make(mm, ctx), who: who });
          }
        } else err(i, 'Neznámé klíčové slovo ' + tt.k + ' v TASK. Povolené: HINT, NOTE, QUESTION, CHECK, END.');
        i++;
      }
      if (!tclosed) err(task.line, 'TASK není ukončený řádkem END.');
      if (!task.checks.length) err(task.line, 'TASK potřebuje aspoň jednu podmínku CHECK.');
      sc.tasks.push(task);
    }
    if (errors.length) return { errors: errors.sort(function (x, y) { return x.line - y.line; }) };
    return { scenario: build(sc, known, idHint) };
  }

  // první řádek výstupu, který znamená chybu (Git, PowerShell nebo poznámka simulátoru)
  function failure(lines) {
    var i, t;
    for (i = 0; i < (lines || []).length; i++) {
      t = lines[i].s.map(function (x) { return x[0]; }).join('');
      if (/^(fatal|error): /.test(t) || /is not a git command/.test(t) || /is not recognized as the name/.test(t) ||
          /^\S+ : Cannot find path/.test(t) || /already exists\.$/.test(t) || (lines[i].k === 'note' && /^Simulátor: /.test(t))) return t;
    }
    return null;
  }

  // ------------------------------------------------------------------
  //  Sestavení objektu scénáře pro GitSession
  // ------------------------------------------------------------------
  function build(sc, known, idHint) {
    var runs = sc.steps.filter(function (s) { return s.op === 'run' || s.op === 'github'; }).length;
    var firstVisible = sc.machines.filter(function (x) { return !x.hidden; })[0].id;
    function hintHtml(hints) {
      var out = '', code = [];
      function flush() { if (code.length) { out += '<pre>' + esc(code.join('\n')) + '</pre>'; code = []; } }
      hints.forEach(function (h) { if (h.code) code.push(h.text); else { flush(); out += '<p style="margin:0 0 4px">' + inline(h.text) + '</p>'; } });
      flush();
      return out;
    }
    return {
      id: idHint || slug(sc.title),
      kicker: sc.label || 'Scénář',
      title: sc.title,
      short: sc.summary,
      intro: sc.intro.map(function (p) { return '<p>' + inline(p) + '</p>'; }).join(''),
      format: sc.format,
      // problémy z posledního spuštění přípravy: [{line, msg}] (příkazy, které skončily chybou)
      setupProblems: [],
      setup: function (api) {
        var cur = null, n = 0, self = this;
        self.setupProblems = [];
        // viditelné počítače nejdřív (pořadí záložek), skryté potom
        sc.machines.forEach(function (x) { api.person(known[x.id], { configured: x.configured, hidden: x.hidden }); if (!cur) cur = x.id; });
        if (sc.github) api.github(true);
        sc.steps.forEach(function (s) {
          var ago = runs + 5 - n;
          if (s.op === 'as') cur = s.id;
          else if (s.op === 'run') {
            var res = api.run(s.id, s.cmd, ago), bad = failure(res && res.lines);
            if (bad) self.setupProblems.push({ line: s.line + 1, msg: 'Příkaz „' + s.cmd + '“ v SETUP skončil chybou: ' + bad });
            n++;
          }
          else if (s.op === 'file') api.write(s.id, s.name, s.content);
          else if (s.op === 'github') {
            if (!api.remote(s.owner, s.name, s.opts, ago)) self.setupProblems.push({ line: s.line + 1, msg: 'Repozitář ' + s.owner + '/' + s.name + ' na GitHubu už existuje.' });
            n++;
          }
          else if (s.op === 'vscode') api.open(s.id, s.path);
        });
      },
      tasks: sc.tasks.map(function (t) {
        return {
          text: inline(t.text),
          hint: t.hints.length ? hintHtml(t.hints) : '',
          question: t.question || undefined,
          check: function (c) { return t.checks.every(function (ch) { return ch.fn(c, ch.who || firstVisible); }); }
        };
      })
    };
  }

  // přeloží a přípravu zkusí nanečisto; chyby v příkazech SETUP vrátí jako errors
  function compileAndTry(text, idHint) {
    var r = compile(text, idHint);
    if (r.errors) return r;
    try { root.GitSession.create(r.scenario); }
    catch (e) { return { errors: [{ line: 1, msg: 'Přípravu scénáře nejde provést: ' + e.message }] }; }
    if (r.scenario.setupProblems.length) return { errors: r.scenario.setupProblems.slice() };
    return r;
  }

  root.GitScenarioLang = { compile: compile, compileAndTry: compileAndTry, FORMAT: FORMAT, inline: inline };
})(typeof window !== 'undefined' ? window : globalThis);
