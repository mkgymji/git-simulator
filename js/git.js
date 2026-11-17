/*
 * Git simulátor – https://github.com/mkgymji/git-simulator
 * Copyright (C) 2026 Michal Kočer
 * SPDX-License-Identifier: GPL-2.0-only
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License version 2 (see LICENSE).
 *
 * Obsahuje kód převzatý z Gitu 2.47.1 (https://github.com/git/git), GPL-2.0:
 *   unpack-trees.c, merge-ort.c, sequencer.c, wt-status.c, remote.c, help.c,
 *   levenshtein.c, advice.c, transport.c, builtin/*.c – přispěvatelé Gitu
 *   diff.c – Copyright (C) 2005 Junio C Hamano; ws.c – Copyright (C) 2007 Junio C Hamano
 *   Texty hlášek Gitu jsou převzaté doslova.
 * Zdroje a autorská práva: ZDROJE.md
 */
/* =====================================================================
 *  git.js – příkazy Gitu
 *
 *  Hlášky jsou doslova hlášky skutečného Gitu (anglicky, včetně barev).
 *  Co simulátor neumí, to řekne česky šedou poznámkou.
 *
 *  GitSim.git(machine, argv) vrací {lines, wait}:
 *    lines – řádky výstupu: {s: [[text, barva], ...], k: 'note' | 'progress'}
 *    wait  – příkaz čeká na člověka (editor zprávy commitu, přihlášení
 *            ke GitHubu); pokračuje se voláním wait.resume(...)
 *  Barvy: g zelená, r červená, y žlutá, c azurová, b tučně (i kombinace "bc").
 * ===================================================================== */
(function (root) {
  'use strict';
  var T = root.GitText, GW = root.GitWorld;
  var sortedKeys = GW.sortedKeys;
  var VERSION = '2.47.1.windows.1';

  // ------------------------------------------------------------------
  //  Výstup
  // ------------------------------------------------------------------
  function Out() { this.lines = []; }
  Out.prototype.p = function (text, color) {
    var parts = String(text).split('\n'), i;
    for (i = 0; i < parts.length; i++) this.lines.push({ s: parts[i] === '' ? [] : [[parts[i], color || '']] });
    return this;
  };
  Out.prototype.segs = function (segs) {
    this.lines.push({ s: segs.filter(function (x) { return x[0] !== ''; }).map(function (x) { return [x[0], x[1] || '']; }) });
    return this;
  };
  Out.prototype.hint = function (text) {
    var parts = text.split('\n'), i;
    for (i = 0; i < parts.length; i++) this.lines.push({ s: [['hint:' + (parts[i] ? ' ' + parts[i] : ''), 'y']] });
    return this;
  };
  Out.prototype.note = function (text) {
    var parts = text.split('\n'), i;
    for (i = 0; i < parts.length; i++) this.lines.push({ s: [[parts[i], 'n']], k: 'note' });
    return this;
  };
  Out.prototype.progress = function (text) {
    var parts = text.split('\n'), i;
    for (i = 0; i < parts.length; i++) this.lines.push({ s: [[parts[i], '']], k: 'progress' });
    return this;
  };

  // ------------------------------------------------------------------
  //  Pomocné funkce
  // ------------------------------------------------------------------
  function short(hash) { return hash.slice(0, 7); }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  function copyMap(m) { var o = Object.create(null), k; for (k in m) o[k] = m[k]; return o; }
  function pad(s, n) { while (s.length < n) s += ' '; return s; }
  function lpad(s, n) { s = String(s); while (s.length < n) s = ' ' + s; return s; }

  // Název souboru tak, jak ho Git vypíše při core.quotepath=true (výchozí)
  function quotePath(ctx, path) {
    var q = ctx.m.getConfig('core.quotepath', ctx.repo);
    var bytes = T.utf8(path), i, needs = false, out = '';
    for (i = 0; i < bytes.length; i++) {
      if (bytes[i] === 0x22 || bytes[i] === 0x5c || bytes[i] < 0x20 || bytes[i] === 0x7f) needs = true;
      if (bytes[i] >= 0x80 && q !== 'false') needs = true;
    }
    if (!needs) return path;
    if (q === 'false') {
      return '"' + path.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
    }
    for (i = 0; i < bytes.length; i++) {
      if (bytes[i] === 0x22) out += '\\"';
      else if (bytes[i] === 0x5c) out += '\\\\';
      else if (bytes[i] >= 0x80 || bytes[i] < 0x20 || bytes[i] === 0x7f) out += '\\' + ('000' + bytes[i].toString(8)).slice(-3);
      else out += String.fromCharCode(bytes[i]);
    }
    return '"' + out + '"';
  }
  // a/soubor resp. "a/soubor" v hlavičce diffu
  function quotePrefixed(ctx, prefix, path) {
    var q = quotePath(ctx, path);
    if (q.charAt(0) === '"') return '"' + prefix + q.slice(1);
    return prefix + path;
  }

  var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function fmtDate(who) {
    var d = new Date((who.time + who.tz * 60) * 1000);
    function two(x) { return ('0' + x).slice(-2); }
    return DAYS[d.getUTCDay()] + ' ' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCDate() + ' ' +
      two(d.getUTCHours()) + ':' + two(d.getUTCMinutes()) + ':' + two(d.getUTCSeconds()) + ' ' +
      d.getUTCFullYear() + ' ' + GW.tzString(who.tz);
  }

  function subject(message) {
    var lines = message.split('\n'), out = [], i;
    for (i = 0; i < lines.length; i++) {
      if (lines[i].trim() === '') { if (out.length) break; else continue; }
      out.push(lines[i].trim());
    }
    return out.join(' ');
  }

  // Úprava zprávy z editoru: řádky s # pryč, prázdné okraje pryč
  function cleanupMessage(text, stripComments) {
    var lines = text.replace(/\r/g, '').split('\n'), out = [], i, l, blank = false;
    for (i = 0; i < lines.length; i++) {
      l = lines[i].replace(/\s+$/, '');
      if (stripComments && l.charAt(0) === '#') continue;
      if (l === '') { blank = true; continue; }
      if (blank && out.length) out.push('');
      blank = false;
      out.push(l);
    }
    return out.length ? out.join('\n') + '\n' : '';
  }

  // jednoduchý glob (*, ?, [abc]) nad názvem souboru
  function globToRegex(glob) {
    var re = '', i, ch;
    for (i = 0; i < glob.length; i++) {
      ch = glob.charAt(i);
      if (ch === '*') re += '.*';
      else if (ch === '?') re += '.';
      else if (ch === '[') {
        var j = glob.indexOf(']', i + 1);
        if (j < 0) re += '\\[';
        else { re += '[' + glob.slice(i + 1, j).replace(/\\/g, '\\\\').replace(/^!/, '^') + ']'; i = j; }
      } else re += ch.replace(/[.+^${}()|\\\/]/g, '\\$&');
    }
    return new RegExp('^' + re + '$');
  }

  function ignoreRules(files) {
    var text = files['.gitignore'], rules = [];
    if (text === undefined) return rules;
    text.replace(/\r/g, '').split('\n').forEach(function (line) {
      var l = line.replace(/\s+$/, ''), neg = false;
      if (l === '' || l.charAt(0) === '#') return;
      if (l.charAt(0) === '!') { neg = true; l = l.slice(1); }
      if (l.charAt(0) === '\\') l = l.slice(1);
      if (l.charAt(l.length - 1) === '/') return;          // jen složky – ty v repozitáři nemáme
      if (l.charAt(0) === '/') l = l.slice(1);
      if (l.indexOf('/') >= 0) return;
      rules.push({ re: globToRegex(l), neg: neg });
    });
    return rules;
  }
  function isIgnored(rules, name) {
    var ign = false, i;
    for (i = 0; i < rules.length; i++) if (rules[i].re.test(name)) ign = !rules[i].neg;
    return ign;
  }

  // ------------------------------------------------------------------
  //  Revize: HEAD, HEAD~2, main, origin/main, začátek hashe
  // ------------------------------------------------------------------
  function knownCommits(ctx) {
    var w = ctx.w, repo = ctx.repo, seen = Object.create(null), k;
    function add(h) { if (!h) return; var a = w.ancestors(h), x; for (x in a) seen[x] = true; }
    for (k in repo.branches) add(repo.branches[k]);
    for (k in repo.remoteRefs) add(repo.remoteRefs[k]);
    if (repo.merge) add(repo.merge.theirs);
    return seen;
  }

  function resolveRev(ctx, str) {
    var w = ctx.w, repo = ctx.repo;
    var m = /^(.*?)((?:[~^]\d*)*)$/.exec(str), base = m[1], mods = m[2], hash = null, k;
    if (base === 'HEAD' || base === '@') hash = repo.headHash();
    else if (repo.branches[base]) hash = repo.branches[base];
    else if (repo.remoteRefs[base]) hash = repo.remoteRefs[base];
    else if (/^[0-9a-fA-F]{4,40}$/.test(base)) {
      var known = knownCommits(ctx), found = [];
      for (k in known) if (k.indexOf(base.toLowerCase()) === 0) found.push(k);
      if (found.length === 1) hash = found[0];
    }
    if (!hash) return null;
    var re = /([~^])(\d*)/g, mm, n, c;
    while ((mm = re.exec(mods))) {
      n = mm[2] === '' ? 1 : parseInt(mm[2], 10);
      if (mm[1] === '~') {
        while (n-- > 0) { c = w.commits[hash]; if (!c.parents.length) return null; hash = c.parents[0]; }
      } else {
        if (n === 0) continue;
        c = w.commits[hash];
        if (c.parents.length < n) return null;
        hash = c.parents[n - 1];
      }
    }
    return hash;
  }

  // ------------------------------------------------------------------
  //  Stav: co je ve stagingu, co je změněné, co nesledované
  // ------------------------------------------------------------------
  function statusInfo(ctx) {
    var w = ctx.w, repo = ctx.repo, W = ctx.dir.files, I = repo.index, H = w.treeOf(repo.headHash());
    var conf = repo.conflicts;
    var info = { staged: [], unstaged: [], untracked: [], unmerged: [] };
    var all = Object.create(null), p;
    for (p in H) all[p] = 1;
    for (p in I) all[p] = 1;
    var pairs = [];
    sortedKeys(all).forEach(function (p) {
      if (conf[p] || I[p] === H[p]) return;
      pairs.push({ path: p, a: H[p] || null, b: I[p] || null });
    });
    root.GitRename.detect(w, pairs).forEach(function (q) {
      if (q.from) info.staged.push({ path: q.path, from: q.from, type: 'renamed' });
      else if (!q.a) info.staged.push({ path: q.path, type: 'new file' });
      else if (!q.b) info.staged.push({ path: q.path, type: 'deleted' });
      else info.staged.push({ path: q.path, type: 'modified' });
    });
    sortedKeys(I).forEach(function (p) {
      if (conf[p]) return;
      if (!(p in W)) info.unstaged.push({ path: p, type: 'deleted' });
      else if (w.hashBlob(W[p]) !== I[p]) info.unstaged.push({ path: p, type: 'modified' });
    });
    sortedKeys(conf).forEach(function (p) {
      var c = conf[p], type;
      if (c.ours && c.theirs) type = c.base ? 'both modified' : 'both added';
      else if (!c.ours) type = 'deleted by us';
      else type = 'deleted by them';
      info.unmerged.push({ path: p, type: type });
    });
    var rules = ignoreRules(W);
    sortedKeys(W).forEach(function (p) {
      if (I[p] || conf[p]) return;
      if (isIgnored(rules, p)) return;
      info.untracked.push(p);
    });
    return info;
  }

  // "Your branch is ahead of 'origin/main' by 1 commit." apod.
  // forCommit: výpis uvnitř git commit (bez rady u rozbíhajících se větví, jako v Gitu)
  function trackingLines(ctx, out, forCommit) {
    var w = ctx.w, repo = ctx.repo, up = repo.upstream[repo.head];
    if (!up) return false;
    var name = up.remote + '/' + up.branch, theirs = repo.remoteRefs[name], ours = repo.headHash();
    if (!ours) return false;
    if (!theirs) {
      out.p("Your branch is based on '" + name + "', but the upstream is gone.");
      out.p('  (use "git branch --unset-upstream" to fixup)');
      return true;
    }
    if (!ours) return false;
    var A = w.ancestors(ours), B = w.ancestors(theirs), ahead = 0, behind = 0, k;
    for (k in A) if (!B[k]) ahead++;
    for (k in B) if (!A[k]) behind++;
    if (!ahead && !behind) out.p("Your branch is up to date with '" + name + "'.");
    else if (ahead && !behind) {
      out.p("Your branch is ahead of '" + name + "' by " + plural(ahead, 'commit', 'commits') + '.');
      out.p('  (use "git push" to publish your local commits)');
    } else if (!ahead && behind) {
      out.p("Your branch is behind '" + name + "' by " + plural(behind, 'commit', 'commits') + ', and can be fast-forwarded.');
      out.p('  (use "git pull" to update your local branch)');
    } else {
      out.p("Your branch and '" + name + "' have diverged,");
      out.p('and have ' + ahead + ' and ' + behind + ' different commits each, respectively.');
      if (!forCommit) out.p('  (use "git pull" if you want to integrate the remote branch with yours)');
    }
    return true;
  }

  function printStatus(ctx, out, forCommit) {
    var repo = ctx.repo, info = statusInfo(ctx), unborn = !repo.headHash();
    out.p('On branch ' + repo.head);
    if (trackingLines(ctx, out, forCommit)) out.p('');
    if (unborn) { out.p(''); out.p(forCommit ? 'Initial commit' : 'No commits yet'); out.p(''); }
    if (repo.revert) {
      out.p('You are currently reverting commit ' + short(repo.revert.commit) + '.');
      if (info.unmerged.length) out.p('  (fix conflicts and run "git revert --continue")');
      else out.p('  (all conflicts fixed: run "git revert --continue")');
      out.p('  (use "git revert --skip" to skip this patch)');
      out.p('  (use "git revert --abort" to cancel the revert operation)');
      out.p('');
    }
    if (repo.merge) {
      if (info.unmerged.length) {
        out.p('You have unmerged paths.');
        out.p('  (fix conflicts and run "git commit")');
        out.p('  (use "git merge --abort" to abort the merge)');
      } else {
        out.p('All conflicts fixed but you are still merging.');
        out.p('  (use "git commit" to conclude merge)');
      }
      out.p('');
    }
    if (info.staged.length) {
      out.p('Changes to be committed:');
      if (!repo.merge) {
        out.p(unborn ? '  (use "git rm --cached <file>..." to unstage)' : '  (use "git restore --staged <file>..." to unstage)');
      }
      info.staged.forEach(function (e) {
        var name = e.from ? quotePath(ctx, e.from) + ' -> ' + quotePath(ctx, e.path) : quotePath(ctx, e.path);
        out.segs([['\t', ''], [pad(e.type + ':', 12) + name, 'g']]);
      });
      out.p('');
    }
    if (info.unmerged.length) {
      var anyDel = info.unmerged.some(function (e) { return e.type.indexOf('deleted') === 0; });
      var allDel = info.unmerged.every(function (e) { return e.type.indexOf('deleted') === 0; });
      out.p('Unmerged paths:');
      if (!repo.merge) out.p(unborn ? '  (use "git rm --cached <file>..." to unstage)' : '  (use "git restore --staged <file>..." to unstage)');
      if (!anyDel) out.p('  (use "git add <file>..." to mark resolution)');
      else if (allDel && false) out.p('  (use "git rm <file>..." to mark resolution)');
      else out.p('  (use "git add/rm <file>..." as appropriate to mark resolution)');
      info.unmerged.forEach(function (e) {
        out.segs([['\t', ''], [pad(e.type + ':', 17) + quotePath(ctx, e.path), 'r']]);
      });
      out.p('');
    }
    if (info.unstaged.length) {
      var del = info.unstaged.some(function (e) { return e.type === 'deleted'; });
      out.p('Changes not staged for commit:');
      out.p(del ? '  (use "git add/rm <file>..." to update what will be committed)' : '  (use "git add <file>..." to update what will be committed)');
      out.p('  (use "git restore <file>..." to discard changes in working directory)');
      info.unstaged.forEach(function (e) {
        out.segs([['\t', ''], [pad(e.type + ':', 12) + quotePath(ctx, e.path), 'r']]);
      });
      out.p('');
    }
    if (info.untracked.length) {
      out.p('Untracked files:');
      out.p('  (use "git add <file>..." to include in what will be committed)');
      info.untracked.forEach(function (p) { out.segs([['\t', ''], [quotePath(ctx, p), 'r']]); });
      out.p('');
    }
    var committable = info.staged.length > 0 || (repo.merge && !info.unmerged.length);
    if (!committable) {
      if (info.unstaged.length || info.unmerged.length) out.p('no changes added to commit (use "git add" and/or "git commit -a")');
      else if (info.untracked.length) out.p('nothing added to commit but untracked files present (use "git add" to track)');
      else if (unborn) out.p('nothing to commit (create/copy files and use "git add" to track)');
      else out.p('nothing to commit, working tree clean');
    }
    return info;
  }

  // ------------------------------------------------------------------
  //  Rozdíl dvou stromů (mapa cesta -> hash blobu)
  // ------------------------------------------------------------------
  // renames: false = bez detekce přejmenování (výchozí je zapnutá jako v Gitu)
  function treeChanges(ctx, oldT, newT, renames) {
    var w = ctx.w, all = Object.create(null), p, pairs = [];
    for (p in oldT) all[p] = 1;
    for (p in newT) all[p] = 1;
    sortedKeys(all).forEach(function (p) {
      if (oldT[p] === newT[p]) return;
      pairs.push({ path: p, a: oldT[p] || null, b: newT[p] || null });
    });
    if (renames !== false) pairs = root.GitRename.detect(w, pairs);
    return pairs.map(function (q) {
      var a = q.a ? w.blobs[q.a] : '', b = q.b ? w.blobs[q.b] : '';
      var c = T.countChanges(a, b);
      return { path: q.path, from: q.from || null, score: q.score || 0, old: q.a, now: q.b, add: c.add, del: c.del };
    });
  }

  // "stary => novy" (pprint_rename; repozitář nemá podsložky)
  function renameName(ctx, from, to) {
    var qa = quotePath(ctx, from), qb = quotePath(ctx, to);
    return qa + ' => ' + qb;
  }

  function summaryLine(changes) {
    var ins = 0, del = 0;
    changes.forEach(function (c) { ins += c.add; del += c.del; });
    var s = ' ' + plural(changes.length, 'file changed', 'files changed');
    if (ins || (!ins && !del)) s += ', ' + plural(ins, 'insertion(+)', 'insertions(+)');
    if (del || (!ins && !del)) s += ', ' + plural(del, 'deletion(-)', 'deletions(-)');
    return s;
  }
  function modeLines(ctx, out, changes) {
    changes.forEach(function (c) {
      if (c.from) out.p(' rename ' + renameName(ctx, c.from, c.path) + ' (' + root.GitRename.similarityIndex(c.score) + '%)');
      else if (!c.old) out.p(' create mode 100644 ' + quotePath(ctx, c.path));
      else if (!c.now) out.p(' delete mode 100644 ' + quotePath(ctx, c.path));
    });
  }

  // tabulka " soubor | 3 ++-" jako u git merge / git pull
  function diffstat(ctx, out, changes) {
    if (!changes.length) return;
    var width = 80, maxLen = 0, maxChange = 0, names = [];
    changes.forEach(function (c) {
      var n = c.from ? renameName(ctx, c.from, c.path) : quotePath(ctx, c.path);
      names.push(n);
      if (n.length > maxLen) maxLen = n.length;
      if (c.add + c.del > maxChange) maxChange = c.add + c.del;
    });
    var numberWidth = String(maxChange).length;
    var graphWidth = maxChange, nameWidth = maxLen;
    if (nameWidth + numberWidth + 6 + graphWidth > width) {
      if (graphWidth > Math.floor(width * 3 / 8) - numberWidth - 6) {
        graphWidth = Math.floor(width * 3 / 8) - numberWidth - 6;
        if (graphWidth < 6) graphWidth = 6;
      }
      if (nameWidth > width - numberWidth - 6 - graphWidth) nameWidth = width - numberWidth - 6 - graphWidth;
      else graphWidth = width - numberWidth - 6 - nameWidth;
    }
    function scale(it) { return it ? 1 + Math.floor(it * (graphWidth - 1) / maxChange) : 0; }
    changes.forEach(function (c, i) {
      var add = c.add, del = c.del, total;
      if (graphWidth <= maxChange) {
        total = scale(add + del);
        if (total < 2 && add && del) total = 2;
        if (add < del) { add = scale(add); del = total - add; }
        else { del = scale(del); add = total - del; }
      }
      var segs = [[' ' + pad(names[i], nameWidth) + ' | ' + lpad(c.add + c.del, numberWidth) + (c.add + c.del ? ' ' : ''), '']];
      if (add) segs.push([new Array(add + 1).join('+'), 'g']);
      if (del) segs.push([new Array(del + 1).join('-'), 'r']);
      out.segs(segs);
    });
    out.p(summaryLine(changes));
  }

  // --- chyby v mezerách (ws.c, diff.c): mezery na konci řádku, mezera před tabulátorem,
  //     prázdné řádky přidané na konec souboru. Git je v diffu zvýrazní červeným pozadím ('R').
  function isSpace(ch) { return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f' || ch === '\v'; }
  function wsBlank(line) { for (var i = 0; i < line.length; i++) if (!isSpace(line.charAt(i))) return false; return true; }
  function countLinesC(text) {
    if (!text.length) return 0;
    var n = 0, i;
    for (i = 0; i < text.length; i++) if (text.charAt(i) === '\n') n++;
    if (text.charAt(text.length - 1) !== '\n') n++;
    return n;
  }
  function countTrailingBlank(text) {
    var cnt = 0, ptr, prev;
    if (!text.length) return 0;
    ptr = text.length - 1;
    if (text.charAt(ptr) === '\n') ptr--;
    while (0 < ptr) {
      for (prev = ptr; prev >= 0; prev--) if (text.charAt(prev) === '\n') break;
      if (!wsBlank(text.slice(prev + 1, ptr + 1))) break;
      cnt++;
      ptr = prev - 1;
    }
    return cnt;
  }
  // obsah přidaného řádku (bez '+') rozdělený na úseky s barvami
  function wsSegs(line) {
    var segs = [], len = line.length, tw = -1, i, written = 0;
    for (i = len - 1; i >= 0; i--) { if (isSpace(line.charAt(i))) tw = i; else break; }
    if (tw === -1) tw = len;
    for (i = 0; i < tw; i++) {
      var ch = line.charAt(i);
      if (ch === ' ') continue;
      if (ch !== '\t') break;
      if (written < i) { segs.push([line.slice(written, i), 'R']); segs.push(['\t', '']); }
      else segs.push([line.slice(written, i + 1), '']);
      written = i + 1;
    }
    if (tw - written > 0) segs.push([line.slice(written, tw), 'g']);
    if (tw !== len) segs.push([line.slice(tw), 'R']);
    return segs;
  }

  // výpis git diff pro seznam změn {path, a: obsah|null, b: obsah|null}
  function printDiff(ctx, out, items) {
    var w = ctx.w, pairs = [];
    items.forEach(function (it) {
      if (it.unmerged) { pairs.push({ path: it.path, a: null, b: null, unmerged: true }); return; }
      var ha = it.a === null ? null : w.hashBlob(it.a), hb = it.b === null ? null : w.hashBlob(it.b);
      if (ha === hb) return;
      pairs.push({ path: it.path, a: ha, b: hb, ca: it.a, cb: it.b });
    });
    // git diff (porcelán) hledá přejmenování; obsah zdroje bereme z původní položky
    var byPath = Object.create(null);
    pairs.forEach(function (q) { if (!q.unmerged) byPath[q.path] = q; });
    root.GitRename.detect(w, pairs).forEach(function (q) {
      if (q.unmerged) { out.p('* Unmerged path ' + q.path); return; }
      var from = q.from || q.path, it = { a: q.from ? byPath[q.from].ca : q.ca, b: q.cb };
      var ha = q.a, hb = q.b;
      var pa = quotePrefixed(ctx, 'a/', from), pb = quotePrefixed(ctx, 'b/', q.path);
      out.p('diff --git ' + pa + ' ' + pb, 'b');
      if (q.from) {
        out.p('similarity index ' + root.GitRename.similarityIndex(q.score) + '%', 'b');
        out.p('rename from ' + quotePath(ctx, q.from), 'b');
        out.p('rename to ' + quotePath(ctx, q.path), 'b');
        if (ha === hb) return;
      }
      if (it.a === null) out.p('new file mode 100644', 'b');
      if (it.b === null) out.p('deleted file mode 100644', 'b');
      out.p('index ' + (ha ? short(ha) : '0000000') + '..' + (hb ? short(hb) : '0000000') + (it.a !== null && it.b !== null ? ' 100644' : ''), 'b');
      var body = T.unifiedDiff(it.a || '', it.b || '');
      if (!body.length) return;
      out.p('--- ' + (it.a === null ? '/dev/null' : pa), 'b');
      out.p('+++ ' + (it.b === null ? '/dev/null' : pb), 'b');
      var ta = it.a || '', tb = it.b || '', l1 = countTrailingBlank(ta), l2 = countTrailingBlank(tb);
      var eofPre = 0, eofPost = 0, lnoPre = 0, lnoPost = 0;
      if (l2 > l1) { eofPre = countLinesC(ta) - l1 + 1; eofPost = countLinesC(tb) - l2 + 1; }
      body.forEach(function (l) {
        if (l.t === '@') {
          var at = l.s.indexOf(' @@', 3) + 3, m = /^@@ -(\d+)(?:,\d+)? \+(\d+)/.exec(l.s);
          lnoPre = parseInt(m[1], 10); lnoPost = parseInt(m[2], 10);
          out.segs([[l.s.slice(0, at), 'c'], [l.s.slice(at), '']]);
        } else if (l.t === '+') {
          lnoPost++;
          if (eofPre && eofPost && eofPre <= lnoPre && eofPost <= lnoPost && wsBlank(l.s)) out.segs([['+' + l.s, 'R']]);
          else out.segs([['+', 'g']].concat(wsSegs(l.s)));
        } else if (l.t === '-') { lnoPre++; out.segs([['-' + l.s, 'r']]); }
        else if (l.t === ' ') { lnoPre++; lnoPost++; out.p(' ' + l.s); }
        else if (l.t === '\\') out.p(l.s);
      });
    });
  }

  // kombinovaný výpis souboru v konfliktu (diff --cc)
  function printCombined(ctx, out, p, c) {
    var w = ctx.w, W = ctx.dir.files, work = (p in W) ? W[p] : null;
    out.p('diff --cc ' + quotePath(ctx, p), 'b');
    out.p('index ' + short(c.ours) + ',' + short(c.theirs) + '..0000000', 'b');
    if (work === null) {
      out.p('deleted file mode 100644,100644', 'b');
      out.p('--- ' + quotePrefixed(ctx, 'a/', p), 'b');
      out.p('+++ /dev/null', 'b');
      return;
    }
    out.p('--- ' + quotePrefixed(ctx, 'a/', p), 'b');
    out.p('+++ ' + quotePrefixed(ctx, 'b/', p), 'b');
    T.combinedDiff(work, [w.blobs[c.ours], w.blobs[c.theirs]]).forEach(function (segs) { out.segs(segs); });
  }

  // ------------------------------------------------------------------
  //  Vytvoření commitu
  // ------------------------------------------------------------------
  function identity(ctx, out) {
    var name = ctx.m.getConfig('user.name', ctx.repo), email = ctx.m.getConfig('user.email', ctx.repo);
    if (name && email) return { name: name, email: email };
    out.p('Author identity unknown');
    out.p('');
    out.p('*** Please tell me who you are.');
    out.p('');
    out.p('Run');
    out.p('');
    out.p('  git config --global user.email "you@example.com"');
    out.p('  git config --global user.name "Your Name"');
    out.p('');
    out.p("to set your account's default identity.");
    out.p('Omit --global to set the identity only in this repository.');
    out.p('');
    if (!email) out.p("fatal: unable to auto-detect email address (got '" + ctx.m.homeName + '@' + ctx.m.host + ".(none)')");
    else out.p('fatal: empty ident name (for <' + email + '>) not allowed');
    return null;
  }

  function writeCommit(ctx, id, parents, message, treeMap, author) {
    var w = ctx.w, now = { time: w.now(), tz: w.tz };
    var committer = { name: id.name, email: id.email, time: now.time, tz: now.tz };
    return w.commit({
      tree: w.tree(treeMap), parents: parents,
      author: author || committer, committer: committer, message: message
    });
  }

  function printCommitResult(ctx, out, hash, opts) {
    var w = ctx.w, c = w.commits[hash];
    var label = ctx.repo.head + (opts && opts.root ? ' (root-commit)' : '');
    out.p('[' + label + ' ' + short(hash) + '] ' + subject(c.message));
    if (opts && opts.date) out.p(' Date: ' + fmtDate(c.author));
    if (c.parents.length > 1) return;
    var changes = treeChanges(ctx, w.treeOf(c.parents[0] || null), w.trees[c.tree]);
    if (!changes.length) return;
    out.p(summaryLine(changes));
    modeLines(ctx, out, changes);
  }

  // ------------------------------------------------------------------
  //  Slučování stromů
  // ------------------------------------------------------------------
  // Přejmenování při slučování (merge-ort): pro každou stranu hledá přejmenování
  // zdrojů, které druhá strana změnila nebo smazala. Simulátor zvládá případ
  // "jedna strana přejmenovala, druhá upravila"; ostatní vrací jako nepodporované.
  function mergeRenames(ctx, baseT, sides) {
    var w = ctx.w, found = [], unsupported = false;
    [1, 2].forEach(function (s) {
      var me = sides[s], other = sides[3 - s], pairs = [], relevant = Object.create(null), all = Object.create(null), p;
      for (p in baseT) all[p] = 1;
      for (p in me) all[p] = 1;
      sortedKeys(all).forEach(function (p) {
        if (baseT[p] && !me[p]) {
          pairs.push({ path: p, a: baseT[p], b: null });
          if (other[p] !== baseT[p]) relevant[p] = true;
        } else if (!baseT[p] && me[p]) pairs.push({ path: p, a: null, b: me[p] });
      });
      root.GitRename.detect(w, pairs, { renameEmpty: false, relevant: relevant }).forEach(function (q) {
        if (q.from) found.push({ side: s, from: q.from, to: q.path, relevant: !!relevant[q.from] });
      });
    });
    var map = Object.create(null);
    found.forEach(function (r) {
      var other = sides[3 - r.side];
      if (!r.relevant) {
        if (other[r.to] || baseT[r.to]) unsupported = true;
        return;
      }
      var twin = found.some(function (x) { return x !== r && x.from === r.from; });
      if (!other[r.to] && !baseT[r.to] && !twin && !map[r.to]) {
        r.kind = other[r.from] ? 'modify' : 'delete';
        map[r.to] = r;
      } else unsupported = true;
    });
    return { map: map, unsupported: unsupported };
  }

  // Vrací {tree, conflicts: {cesta: {base, ours, theirs}}, files: {cesta: text s značkami}, messages: [..]}
  function mergeTrees(ctx, baseT, oursT, theirsT, oursLabel, theirsLabel) {
    var w = ctx.w, all = Object.create(null), p;
    var res = { tree: Object.create(null), conflicts: Object.create(null), files: Object.create(null), messages: [], count: 0 };
    var ren = mergeRenames(ctx, baseT, { 1: oursT, 2: theirsT });
    if (ren.unsupported) { res.unsupported = true; return res; }
    var skip = Object.create(null), entries = Object.create(null);
    for (p in baseT) all[p] = 1;
    for (p in oursT) all[p] = 1;
    for (p in theirsT) all[p] = 1;
    sortedKeys(all).forEach(function (p) { entries[p] = { b: baseT[p], o: oursT[p], t: theirsT[p], names: null }; });
    sortedKeys(ren.map).forEach(function (to) {
      var r = ren.map[to], from = r.from;
      skip[from] = true;
      if (r.kind === 'delete') { entries[to] = { rendel: r }; return; }
      var e = { b: baseT[from], names: [from, from, from] };
      if (r.side === 1) { e.o = oursT[to]; e.t = theirsT[from]; e.names[1] = to; }
      else { e.o = oursT[from]; e.t = theirsT[to]; e.names[2] = to; }
      entries[to] = e;
    });
    sortedKeys(entries).forEach(function (p) {
      if (skip[p]) return;
      // merge-ort vypisuje cesty bez uvozovek (i s diakritikou)
      var e = entries[p], b = e.b, o = e.o, t = e.t, qp = p;
      if (e.rendel) {
        var r = e.rendel, yb = r.side === 1 ? oursT[p] : theirsT[p];
        var rl = r.side === 1 ? oursLabel : theirsLabel, dl = r.side === 1 ? theirsLabel : oursLabel;
        res.messages.push(['CONFLICT (rename/delete): ' + r.from + ' renamed to ' + p + ' in ' + rl + ', but deleted in ' + dl + '.', '']);
        if (yb !== baseT[r.from]) {
          res.messages.push(['CONFLICT (modify/delete): ' + p + ' deleted in ' + dl + ' and modified in ' + rl + '.  Version ' + rl + ' of ' + p + ' left in tree.', '']);
        }
        res.conflicts[p] = { base: baseT[r.from], ours: r.side === 1 ? yb : null, theirs: r.side === 2 ? yb : null };
        res.files[p] = w.blobs[yb];
        res.count++;
        return;
      }
      if (o === t) { if (o) res.tree[p] = o; return; }
      if (b === o) { if (t) res.tree[p] = t; return; }
      if (b === t) { if (o) res.tree[p] = o; return; }
      if (o && t) {
        var l1 = oursLabel, l2 = theirsLabel;
        if (e.names) { l1 = oursLabel + ':' + e.names[1]; l2 = theirsLabel + ':' + e.names[2]; }
        var m = T.merge3(b ? w.blobs[b] : '', w.blobs[o], w.blobs[t], l1, l2);
        res.messages.push(['Auto-merging ' + qp, '']);
        if (m.conflicts) {
          res.messages.push(['CONFLICT (' + (b ? 'content' : 'add/add') + '): Merge conflict in ' + qp, '']);
          res.conflicts[p] = { base: b || null, ours: o, theirs: t };
          res.files[p] = m.text;
          res.count++;
        } else {
          res.tree[p] = w.blob(m.text);
        }
        return;
      }
      // jedna strana soubor smazala, druhá změnila
      if (!o) {
        res.messages.push(['CONFLICT (modify/delete): ' + qp + ' deleted in ' + oursLabel + ' and modified in ' + theirsLabel + '.  Version ' + theirsLabel + ' of ' + qp + ' left in tree.', '']);
        res.conflicts[p] = { base: b, ours: null, theirs: t };
        res.files[p] = w.blobs[t];
      } else {
        res.messages.push(['CONFLICT (modify/delete): ' + qp + ' deleted in ' + theirsLabel + ' and modified in ' + oursLabel + '.  Version ' + oursLabel + ' of ' + qp + ' left in tree.', '']);
        res.conflicts[p] = { base: b, ours: o, theirs: null };
        res.files[p] = w.blobs[o];
      }
      res.count++;
    });
    return res;
  }

  function unsupportedMerge(out) {
    out.note('Simulátor: v tomhle slučování se potkává přejmenovaný soubor s další změnou téhož souboru');
    out.note('(smazání, jiné přejmenování nebo nový soubor se stejným jménem). Takový případ simulátor');
    out.note('neumí, a proto nic nezměnil. Ve skutečném Gitu by vznikl konflikt.');
  }

  // ------------------------------------------------------------------
  //  Přechod indexu a pracovní složky z HEAD (fromT) na cílový strom (toT)
  //  přesně podle twoway_merge v unpack-trees.c. Vrací chyby po typech
  //  a seznam operací; nic nemění.
  //  extra: {cesta: obsah} pro cílové bloby, které ještě nejsou v úložišti
  // ------------------------------------------------------------------
  function twoway(ctx, fromT, toT, extra) {
    var w = ctx.w, repo = ctx.repo, W = ctx.dir.files, I = repo.index, conf = repo.conflicts;
    var errs = { overwrite: [], notUptodate: [], untrackedOver: [], untrackedRemoved: [] }, ops = [];
    var rules = ignoreRules(W), all = Object.create(null), p;
    [I, fromT, toT, conf].forEach(function (m) { for (var k in m) all[k] = 1; });
    function uptodate(p, i) { return !(p in W) || w.hashBlob(W[p]) === i; }
    function absent(p) { return !(p in W) || isIgnored(rules, p); }
    sortedKeys(all).forEach(function (p) {
      var i = I[p] || null, h = fromT[p] || null, m = toT[p] || null;
      if (conf[p]) {
        if (h === m) ops.push({ p: p, op: m ? 'use' : 'del', m: m });
        else errs.overwrite.push(p);
        return;
      }
      if (i) {
        if ((!h && !m) || (!h && m && i === m) || (h && m && h === m) || (h && m && h !== m && i === m)) return;
        if (h && !m && i === h) {
          if (!uptodate(p, i)) errs.notUptodate.push(p); else ops.push({ p: p, op: 'del' });
        } else if (h && m && i === h && i !== m) {
          if (!uptodate(p, i)) errs.notUptodate.push(p); else ops.push({ p: p, op: 'use', m: m });
        } else errs.overwrite.push(p);
      } else if (m) {
        if (h) { if (h !== m) errs.overwrite.push(p); return; }
        if (!absent(p)) errs.untrackedOver.push(p); else ops.push({ p: p, op: 'use', m: m });
      } else if (h) {
        if (!absent(p)) errs.untrackedRemoved.push(p);
      }
    });
    var ok = !errs.overwrite.length && !errs.notUptodate.length && !errs.untrackedOver.length && !errs.untrackedRemoved.length;
    return {
      ok: ok, errs: errs,
      apply: function () {
        ops.forEach(function (o) {
          if (o.op === 'use') {
            repo.index[o.p] = o.m;
            W[o.p] = (extra && extra[o.p] !== undefined && !w.blobs[o.m]) ? extra[o.p] : w.blobs[o.m];
          } else { delete repo.index[o.p]; delete W[o.p]; }
        });
      }
    };
  }

  function checkOverwrite(ctx, fromT, toT, extra) { return twoway(ctx, fromT, toT, extra); }
  function applyTree(ctx, fromT, toT) { twoway(ctx, fromT, toT).apply(); }

  // chyby jako display_error_msgs (pořadí podle typu chyby)
  function overwriteError(ctx, out, chk, verb) {
    var e = chk.errs, sw = verb === 'checkout';
    function block(list, head, tail) {
      if (!list.length) return;
      out.p('error: ' + head);
      list.forEach(function (p) { out.p('\t' + p); });
      out.p(tail);
    }
    var local = 'Your local changes to the following files would be overwritten by ' + verb + ':';
    var commitTail = sw ? 'Please commit your changes or stash them before you switch branches.' : 'Please commit your changes or stash them before you merge.';
    var moveTail = sw ? 'Please move or remove them before you switch branches.' : 'Please move or remove them before you merge.';
    block(e.overwrite, local, commitTail);
    block(e.notUptodate, local, commitTail);
    block(e.untrackedOver, 'The following untracked working tree files would be overwritten by ' + verb + ':', moveTail);
    block(e.untrackedRemoved, 'The following untracked working tree files would be removed by ' + verb + ':', moveTail);
    out.p('Aborting');
  }

  // Zapíše výsledek slučování s konflikty: pracovní složka přejde na strom výsledku
  // (u konfliktů obsah se značkami), soubory v konfliktu pak v indexu nejsou.
  function conflictTarget(ctx, res) {
    var w = ctx.w, target = copyMap(res.tree), extra = Object.create(null), p;
    for (p in res.conflicts) { target[p] = w.hashBlob(res.files[p]); extra[p] = res.files[p]; }
    return { tree: target, extra: extra };
  }
  function writeConflictResult(ctx, oursT, res) {
    var t = conflictTarget(ctx, res), repo = ctx.repo, p;
    twoway(ctx, oursT, t.tree, t.extra).apply();
    for (p in res.conflicts) delete repo.index[p];
  }

  // Společné jádro pro git merge a git pull.
  // o: {theirs: hash, label: jméno do značek konfliktu, message: zpráva merge commitu, noEdit}
  function doMerge(ctx, out, o) {
    var w = ctx.w, repo = ctx.repo, ours = repo.headHash(), theirs = o.theirs;
    if (w.isAncestor(theirs, ours)) { out.p('Already up to date.'); return null; }
    var oursT = w.treeOf(ours), theirsT = w.treeOf(theirs), chk;

    if (w.isAncestor(ours, theirs)) {            // fast-forward
      out.p('Updating ' + short(ours) + '..' + short(theirs));
      chk = checkOverwrite(ctx, oursT, theirsT);
      if (!chk.ok) { overwriteError(ctx, out, chk, 'merge'); return null; }
      applyTree(ctx, oursT, theirsT);
      repo.branches[repo.head] = theirs;
      out.p('Fast-forward');
      var ch = treeChanges(ctx, oursT, theirsT);
      diffstat(ctx, out, ch);
      modeLines(ctx, out, ch);
      return null;
    }

    var base = w.mergeBase(ours, theirs);
    var res = mergeTrees(ctx, w.treeOf(base), oursT, theirsT, 'HEAD', o.label);
    if (res.unsupported) { unsupportedMerge(out); return null; }
    // co by merge přepsal v pracovní složce
    var p, info = statusInfo(ctx);
    if (info.staged.length) {
      out.p('error: Your local changes to the following files would be overwritten by merge:');
      out.p('  ' + info.staged.map(function (e) { return quotePath(ctx, e.path); }).join(' '));
      out.p('Merge with strategy ort failed.');
      return null;
    }
    var ct = conflictTarget(ctx, res);
    chk = checkOverwrite(ctx, oursT, ct.tree, ct.extra);
    if (!chk.ok) {
      overwriteError(ctx, out, chk, 'merge');
      out.p('Merge with strategy ort failed.');
      return null;
    }
    res.messages.forEach(function (m) { out.p(m[0], m[1]); });
    if (res.count) {
      writeConflictResult(ctx, oursT, res);
      repo.merge = { theirs: theirs, message: o.message, hadConflicts: sortedKeys(res.conflicts) };
      repo.conflicts = res.conflicts;
      out.p('Automatic merge failed; fix conflicts and then commit the result.');
      return null;
    }
    var id = identity(ctx, out);
    if (!id) return null;
    function finish(text) {
      var out2 = new Out();
      var msg = cleanupMessage(text, true);
      if (!msg) {
        out2.p('error: Empty commit message.');
        out2.p("Not committing merge; use 'git commit' to complete the merge.");
        applyTree(ctx, oursT, res.tree);
        repo.merge = { theirs: theirs, message: o.message, hadConflicts: [] };
        return { lines: out2.lines };
      }
      applyTree(ctx, oursT, res.tree);
      var hash = writeCommit(ctx, id, [ours, theirs], msg, res.tree);
      repo.branches[repo.head] = hash;
      out2.p("Merge made by the 'ort' strategy.");
      var ch2 = treeChanges(ctx, oursT, res.tree);
      diffstat(ctx, out2, ch2);
      modeLines(ctx, out2, ch2);
      return { lines: out2.lines };
    }
    if (o.noEdit) { out.lines = out.lines.concat(finish(o.message).lines); return null; }
    return {
      type: 'editor', file: 'MERGE_MSG',
      text: o.message + '\n# Please enter a commit message to explain why this merge is necessary,\n' +
        '# especially if it merges an updated upstream into a topic branch.\n#\n' +
        "# Lines starting with '#' will be ignored, and an empty message aborts\n# the commit.\n",
      resume: finish
    };
  }

  // ------------------------------------------------------------------
  //  Výpis historie
  // ------------------------------------------------------------------
  // Štítky u commitů jako v Gitu: odkazy se načtou v abecedním pořadí plných názvů
  // (refs/heads/..., refs/remotes/...) a Git je řadí na začátek seznamu, takže se
  // vypisují pozpátku. Aktuální větev jde jako "HEAD -> větev" vždy první.
  function decorations(ctx) {
    var repo = ctx.repo, map = Object.create(null), refs = [], head = repo.headHash();
    sortedKeys(repo.branches).forEach(function (b) { refs.push({ ref: 'refs/heads/' + b, hash: repo.branches[b], seg: { name: b } }); });
    sortedKeys(repo.remoteRefs).forEach(function (r) {
      refs.push({ ref: 'refs/remotes/' + r, hash: repo.remoteRefs[r], seg: { remote: true, name: r } });
    });
    sortedKeys(repo.remoteHead || {}).forEach(function (rn) {
      var target = repo.remoteRefs[rn + '/' + repo.remoteHead[rn]];
      if (target) refs.push({ ref: 'refs/remotes/' + rn + '/HEAD', hash: target, seg: { remote: true, name: rn + '/HEAD' } });
    });
    refs.sort(function (x, y) { return GW.cmpBytes(x.ref, y.ref); });
    refs.reverse();
    if (head) map[head] = [{ head: true, name: repo.head }];
    refs.forEach(function (r) {
      if (r.hash === head && r.ref === 'refs/heads/' + repo.head) return;
      (map[r.hash] = map[r.hash] || []).push(r.seg);
    });
    return map;
  }
  function decorSegs(list) {
    if (!list) return [];
    var segs = [[' (', 'y']], i;
    for (i = 0; i < list.length; i++) {
      if (i) segs.push([', ', 'y']);
      if (list[i].head) { segs.push(['HEAD', 'bc']); segs.push([' -> ', 'y']); segs.push([list[i].name, 'bg']); }
      else if (list[i].remote) segs.push([list[i].name, 'br']);
      else segs.push([list[i].name, 'bg']);
    }
    segs.push([')', 'y']);
    return segs;
  }

  // pořadí commitů jako git log: podle času commitu, od nejnovějšího
  function walkByDate(ctx, tips) {
    var w = ctx.w, seen = Object.create(null), queue = [], out = [], n = 0;
    function push(h) { if (h && !seen[h]) { seen[h] = true; queue.push({ h: h, n: n++ }); } }
    tips.forEach(push);
    while (queue.length) {
      var best = 0, i;
      for (i = 1; i < queue.length; i++) {
        var a = w.commits[queue[i].h].committer.time, b = w.commits[queue[best].h].committer.time;
        if (a > b || (a === b && queue[i].n < queue[best].n)) best = i;
      }
      var item = queue.splice(best, 1)[0];
      out.push(item.h);
      w.commits[item.h].parents.forEach(push);
    }
    return out;
  }

  // ------------------------------------------------------------------
  //  GitHub: přístup ke vzdálenému repozitáři
  // ------------------------------------------------------------------
  function notFound(out, url) {
    out.p('remote: Repository not found.');
    out.p("fatal: repository '" + url.replace(/\/$/, '') + "/' not found");
  }
  // Vrací {remote} | {error:true} | {wait}
  function openRemote(ctx, out, url, forWrite, again) {
    var w = ctx.w, m = ctx.m, parsed = GW.parseUrl(url);
    if (!parsed) {
      out.p("fatal: '" + url + "' does not appear to be a git repository");
      out.p('fatal: Could not read from remote repository.');
      out.p('');
      out.p('Please make sure you have the correct access rights');
      out.p('and the repository exists.');
      return { error: true };
    }
    var remote = w.remotes[parsed.key];
    var needAuth = forWrite || !remote || remote.private;
    if (needAuth && !m.signedIn) {
      if (!m.login) { notFound(out, url); return { error: true }; }
      return { wait: { type: 'signin', login: m.login, resume: function (ok) {
        if (!ok) {
          var o = new Out();
          o.p("fatal: Authentication failed for '" + url.replace(/\/$/, '') + "/'");
          return { lines: o.lines };
        }
        m.signedIn = true;
        return again();
      } } };
    }
    if (!remote || !w.canRead(remote, m.signedIn ? m.login : null)) { notFound(out, url); return { error: true }; }
    if (forWrite && !w.canWrite(remote, m.login)) {
      out.p('remote: Permission to ' + remote.owner + '/' + remote.name + '.git denied to ' + m.login + '.');
      out.p("fatal: unable to access '" + url.replace(/\/$/, '') + "/': The requested URL returned error: 403");
      return { error: true };
    }
    return { remote: remote };
  }

  function sizeEstimate(w, objs) {
    var bytes = 0, h;
    for (h in objs) {
      if (objs[h] === 'blob') bytes += Math.round(T.utf8Length(w.blobs[h]) * 0.62) + 18;
      else if (objs[h] === 'tree') bytes += 34 * Object.keys(w.trees[h]).length + 20;
      else bytes += 130;
    }
    return bytes;
  }
  function sizeText(bytes) {
    if (bytes < 1024) return bytes + ' bytes | ' + bytes + '.00 KiB/s';
    return (bytes / 1024).toFixed(2) + ' KiB | ' + (bytes / 1024).toFixed(2) + ' MiB/s';
  }
  function newObjects(w, haveTips, wantTips) {
    var have = w.objectsOf(haveTips), want = w.objectsOf(wantTips), out = Object.create(null), h;
    for (h in want) if (!have[h]) out[h] = want[h];
    return out;
  }

  // stažení nových commitů; vrací pole řádků "From ..." (už vypsaných)
  function doFetch(ctx, out, remoteName, remote, url, onlyBranch) {
    var w = ctx.w, repo = ctx.repo, updates = [], b;
    var have = [], k;
    for (k in repo.branches) have.push(repo.branches[k]);
    for (k in repo.remoteRefs) have.push(repo.remoteRefs[k]);
    sortedKeys(remote.branches).forEach(function (b) {
      var ref = remoteName + '/' + b, old = repo.remoteRefs[ref], now = remote.branches[b];
      if (old === now) return;
      updates.push({ branch: b, ref: ref, old: old, now: now });
    });
    if (!updates.length) return updates;
    var objs = newObjects(w, have, updates.map(function (u) { return u.now; }));
    var n = Object.keys(objs).length;
    if (n) {
      out.progress('remote: Enumerating objects: ' + n + ', done.');
      out.progress('remote: Counting objects: 100% (' + n + '/' + n + '), done.');
      out.progress('remote: Total ' + n + ' (delta 0), reused 0 (delta 0), pack-reused 0 (from 0)');
      out.progress('Unpacking objects: 100% (' + n + '/' + n + '), ' + sizeText(sizeEstimate(w, objs)) + ', done.');
    }
    out.p('From ' + url.replace(/\/$/, '').replace(/\.git$/, ''));
    var width = 10;
    updates.forEach(function (u) { if (u.branch.length > width) width = u.branch.length; });
    updates.forEach(function (u) {
      if (!u.old) out.p(' * [new branch]      ' + pad(u.branch, width) + ' -> ' + u.ref);
      else out.p('   ' + short(u.old) + '..' + short(u.now) + '  ' + pad(u.branch, width) + ' -> ' + u.ref);
      repo.remoteRefs[u.ref] = u.now;
    });
    return updates;
  }

  // ------------------------------------------------------------------
  //  Příkazy
  // ------------------------------------------------------------------
  var C = {};
  var NO_REPO = { init: 1, clone: 1, config: 1, version: 1, help: 1 };

  C.version = function (ctx) { ctx.out.p('git version ' + VERSION); };

  C.help = function (ctx) {
    ctx.out.note('Simulátor umí příkazy z kurzu: init, status, add, commit, diff, log, restore, revert,');
    ctx.out.note('branch, switch, merge, remote, push, pull, clone, config. Tahák najdeš pod tlačítkem Nápověda.');
  };

  C.init = function (ctx, args) {
    var m = ctx.m, dir = ctx.dir, out = ctx.out;
    var extra = args.filter(function (a) { return a.charAt(0) !== '-'; });
    if (extra.length) {
      out.note('Simulátor: git init spouštěj bez názvu složky – nejdřív do složky přejdi (cd) a pak napiš git init.');
      return;
    }
    if (dir.repo) {
      out.p('Reinitialized existing Git repository in ' + m.gitPath() + '/.git/');
      return;
    }
    if (Object.keys(dir.dirs).length) {
      out.note('Simulátor: tahle složka obsahuje další složky (' + Object.keys(dir.dirs).join(', ') + ').');
      out.note('Repozitář zakládej až ve složce projektu, např. cd ' + Object.keys(dir.dirs)[0] + ' a potom git init.');
      return;
    }
    var def = m.getConfig('init.defaultbranch');
    if (!def) {
      out.hint("Using 'master' as the name for the initial branch. This default branch name\n" +
        'is subject to change. To configure the initial branch name to use in all\n' +
        'of your new repositories, which will suppress this warning, call:\n\n' +
        '\tgit config --global init.defaultBranch <name>\n\n' +
        "Names commonly chosen instead of 'master' are 'main', 'trunk' and\n" +
        "'development'. The just-created branch can be renamed via this command:\n\n" +
        '\tgit branch -m <name>\n\n' +
        'Disable this message with "git config advice.defaultBranchName false"');
    }
    dir.repo = new GW.Repo(def || 'master');
    out.p('Initialized empty Git repository in ' + m.gitPath() + '/.git/');
  };

  C.config = function (ctx, args) {
    var m = ctx.m, out = ctx.out, global = false, list = false, unset = false, rest = [], i;
    for (i = 0; i < args.length; i++) {
      if (args[i] === '--global') global = true;
      else if (args[i] === '--list' || args[i] === '-l' || args[i] === 'list') list = true;
      else if (args[i] === '--local') global = false;
      else if (args[i] === '--unset' || args[i] === 'unset') unset = true;
      else if (args[i] === '--get' || args[i] === 'get' || args[i] === 'set') { /* stejné chování */ }
      else if (args[i].charAt(0) === '-') { out.p("error: unknown option `" + args[i].replace(/^-+/, '') + "'"); return; }
      else rest.push(args[i]);
    }
    if (list) {
      m.config.forEach(function (e) { out.p(e.key + '=' + e.value); });
      if (!global && ctx.repo) {
        ['core.repositoryformatversion=0', 'core.filemode=false', 'core.bare=false', 'core.logallrefupdates=true',
          'core.symlinks=false', 'core.ignorecase=true'].forEach(function (l) { out.p(l); });
        ctx.repo.remotes.forEach(function (r) {
          out.p('remote.' + r.name + '.url=' + r.url);
          out.p('remote.' + r.name + '.fetch=+refs/heads/*:refs/remotes/' + r.name + '/*');
        });
        sortedKeys(ctx.repo.upstream).forEach(function (b) {
          out.p('branch.' + b + '.remote=' + ctx.repo.upstream[b].remote);
          out.p('branch.' + b + '.merge=refs/heads/' + ctx.repo.upstream[b].branch);
        });
        ctx.repo.config.forEach(function (e) { out.p(e.key + '=' + e.value); });
      }
      return;
    }
    if (!rest.length) { out.p('error: no action specified'); return; }
    var key = rest[0];
    if (key.indexOf('.') < 0) { out.p('error: key does not contain a section: ' + key); return; }
    if (!global && !ctx.repo && (rest.length > 1 || unset)) { out.p('fatal: not in a git directory'); return; }
    var target = global ? m.config : (ctx.repo ? ctx.repo.config : m.config);
    if (unset) { GW.configUnset(target, key); return; }
    if (rest.length === 1) {
      var v = global ? GW.configGet(m.config, key) : m.getConfig(key, ctx.repo);
      if (v !== undefined) out.p(v);
      return;
    }
    GW.configSet(target, key, rest.slice(1).join(' '));
  };

  C.status = function (ctx, args) {
    var bad = args.filter(function (a) { return a.charAt(0) === '-'; });
    if (bad.length) { ctx.out.note('Simulátor: git status používáme bez přepínačů.'); }
    printStatus(ctx, ctx.out, false);
  };

  // soubory odpovídající zadání (soubor, ".", "*.md")
  function matchPaths(ctx, spec, pool) {
    if (spec === '.' || spec === './' || spec === '*' || spec === ':/') return pool.slice();
    var s = spec.replace(/^\.[\\\/]/, '');
    if (/[*?\[]/.test(s)) {
      var re = globToRegex(s);
      return pool.filter(function (p) { return re.test(p); });
    }
    return pool.filter(function (p) { return p === s; });
  }

  C.add = function (ctx, args) {
    var w = ctx.w, repo = ctx.repo, W = ctx.dir.files, out = ctx.out, all = false, specs = [], force = false;
    args.forEach(function (a) {
      if (a === '-A' || a === '--all') all = true;
      else if (a === '-f' || a === '--force') force = true;
      else if (a === '--') { /* nic */ }
      else if (a.charAt(0) === '-' && a.length > 1) specs.push({ bad: a });
      else specs.push(a);
    });
    var bad = specs.filter(function (s) { return s.bad; });
    if (bad.length) { out.p("error: unknown option `" + bad[0].bad.replace(/^-+/, '') + "'"); out.note('Simulátor: git add zná jen název souboru, tečku a -A.'); return; }
    if (all && !specs.length) specs = ['.'];
    if (!specs.length) {
      out.p('Nothing specified, nothing added.');
      out.hint("Maybe you wanted to say 'git add .'?\nDisable this message with \"git config advice.addEmptyPathspec false\"");
      return;
    }
    var conf = repo.conflicts;
    var rules = ignoreRules(W), pool = Object.create(null), p;
    for (p in W) pool[p] = 1;
    for (p in repo.index) pool[p] = 1;
    for (p in conf) pool[p] = 1;
    var names = sortedKeys(pool), todo = Object.create(null), ignoredHit = [], i;
    for (i = 0; i < specs.length; i++) {
      var explicit = !(/[*?\[]/.test(specs[i])) && specs[i] !== '.';
      var hit = matchPaths(ctx, specs[i], names), whole = (specs[i] === '.' || specs[i] === './' || specs[i] === ':/');
      if (!hit.length && !whole) { out.p("fatal: pathspec '" + specs[i] + "' did not match any files"); return; }
      hit.forEach(function (p) {
        if (!repo.index[p] && !conf[p] && isIgnored(rules, p) && !force) {
          if (explicit) ignoredHit.push(p);
          return;
        }
        todo[p] = 1;
      });
    }
    if (ignoredHit.length) {
      out.p('The following paths are ignored by one of your .gitignore files:');
      ignoredHit.forEach(function (p) { out.p(p); });
      out.hint('Use -f if you really want to add them.\nDisable this message with "git config advice.addIgnoredFile false"');
      return;
    }
    for (p in todo) {
      if (p in W) repo.index[p] = w.blob(W[p]);
      else delete repo.index[p];
      if (conf[p]) delete conf[p];
    }
  };

  C.rm = function (ctx, args) {
    var w = ctx.w, repo = ctx.repo, W = ctx.dir.files, out = ctx.out, cached = false, force = false, specs = [];
    args.forEach(function (a) {
      if (a === '--cached') cached = true;
      else if (a === '-f' || a === '--force') force = true;
      else if (a !== '--') specs.push(a);
    });
    if (!specs.length) { out.p('fatal: No pathspec was given. Which files should I remove?'); return; }
    var H = w.treeOf(repo.headHash()), names = sortedKeys(repo.index), todo = [], i;
    for (i = 0; i < specs.length; i++) {
      var hit = matchPaths(ctx, specs[i], names);
      if (!hit.length) { out.p("fatal: pathspec '" + specs[i] + "' did not match any files"); return; }
      todo = todo.concat(hit);
    }
    if (!force) {
      var both = [], stagedL = [], localL = [];
      todo.forEach(function (p) {
        var inW = p in W, wh = inW ? w.hashBlob(W[p]) : null;
        var stagedDiff = (repo.index[p] !== (H[p] || null)), localDiff = inW && wh !== repo.index[p];
        if (stagedDiff && localDiff) both.push(p);
        else if (stagedDiff && !cached) stagedL.push(p);
        else if (localDiff && !cached) localL.push(p);
      });
      function block(list, one, many, tail) {
        out.p('error: the following ' + (list.length === 1 ? one : many));
        list.forEach(function (p) { out.p('    ' + p); });
        out.p(tail);
      }
      if (both.length) block(both, 'file has staged content different from both the\nfile and the HEAD:', 'files have staged content different from both the\nfile and the HEAD:', '(use -f to force removal)');
      if (stagedL.length) block(stagedL, 'file has changes staged in the index:', 'files have changes staged in the index:', '(use --cached to keep the file, or -f to force removal)');
      if (localL.length) block(localL, 'file has local modifications:', 'files have local modifications:', '(use --cached to keep the file, or -f to force removal)');
      if (both.length || stagedL.length || localL.length) return;
    }
    todo.forEach(function (p) {
      delete repo.index[p];
      if (!cached) delete W[p];
      out.p("rm '" + p + "'");
    });
  };

  C.commit = function (ctx, args) {
    var w = ctx.w, repo = ctx.repo, out = ctx.out, W = ctx.dir.files;
    var msgs = [], all = false, amend = false, noEdit = false, allowEmpty = false, i, a;
    for (i = 0; i < args.length; i++) {
      a = args[i];
      if (a === '-m' || a === '--message') {
        if (i + 1 >= args.length) { out.p('error: switch `m\' requires a value'); return; }
        msgs.push(args[++i]);
      } else if (a.indexOf('--message=') === 0) msgs.push(a.slice(10));
      else if (a === '-am' || a === '-ma') {
        all = true;
        if (i + 1 >= args.length) { out.p('error: switch `m\' requires a value'); return; }
        msgs.push(args[++i]);
      } else if (/^-m./.test(a)) msgs.push(a.slice(2));
      else if (a === '-a' || a === '--all') all = true;
      else if (a === '--amend') amend = true;
      else if (a === '--no-edit') noEdit = true;
      else if (a === '--allow-empty') allowEmpty = true;
      else if (a.charAt(0) === '-') { out.p("error: unknown option `" + a.replace(/^-+/, '') + "'"); out.note('Simulátor: git commit zná -m "zpráva", -a, --amend a --no-edit.'); return; }
      else { out.p("error: pathspec '" + a + "' did not match any file(s) known to git"); out.note('Zprávu commitu piš do uvozovek: git commit -m "Zpráva o více slovech"'); return; }
    }
    var head = repo.headHash();
    // -a zapíše i soubory v konfliktu (jako git add -u) a tím je vyřeší
    if (all) {
      sortedKeys(repo.conflicts).forEach(function (p) {
        if (p in W) repo.index[p] = w.blob(W[p]); else delete repo.index[p];
        delete repo.conflicts[p];
      });
    }
    if (sortedKeys(repo.conflicts).length) {
      sortedKeys(repo.conflicts).forEach(function (p) { out.p('U\t' + quotePath(ctx, p)); });
      out.p('error: Committing is not possible because you have unmerged files.');
      out.hint("Fix them up in the work tree, and then use 'git add/rm <file>'\nas appropriate to mark resolution and make a commit.");
      out.p('fatal: Exiting because of an unresolved conflict.');
      return;
    }
    if (amend && !head) { out.p('fatal: You have nothing to amend.'); return; }
    if (amend && repo.merge) { out.p('fatal: You are in the middle of a merge -- cannot amend.'); return; }
    if (all) {
      sortedKeys(repo.index).forEach(function (p) {
        if (p in W) repo.index[p] = w.blob(W[p]); else delete repo.index[p];
      });
    }
    var H = w.treeOf(head), info = statusInfo(ctx);
    if (!info.staged.length && !repo.merge && !amend && !allowEmpty) { printStatus(ctx, out, true); return; }
    var id = identity(ctx, out);
    if (!id) return;

    function finish(text, fromEditor) {
      var o = fromEditor ? new Out() : out;
      var msg = cleanupMessage(text, fromEditor);
      if (!msg) { o.p('Aborting commit due to empty commit message.'); return { lines: o.lines }; }
      var parents, author = null, hash;
      if (amend) {
        var old = w.commits[head];
        parents = old.parents.slice();
        author = old.author;
      } else if (repo.merge) parents = [head, repo.merge.theirs];
      else parents = head ? [head] : [];
      hash = writeCommit(ctx, id, parents, msg, repo.index, author);
      repo.branches[repo.head] = hash;
      repo.merge = null;
      repo.revert = null;
      repo.conflicts = Object.create(null);
      printCommitResult(ctx, o, hash, { root: !parents.length, date: amend });
      return { lines: o.lines };
    }

    if (msgs.length) { finish(msgs.join('\n\n'), false); return; }
    if (amend && noEdit) { finish(w.commits[head].message, false); return; }
    // bez -m: otevře se editor
    var tmp = new Out(), text;
    printStatus(ctx, tmp, false);
    var comment = tmp.lines.map(function (l) {
      var s = l.s.map(function (x) { return x[0]; }).join('');
      return s === '' ? '#' : (s.charAt(0) === '\t' ? '#' + s : '# ' + s);
    }).join('\n');
    if (repo.merge) {
      text = repo.merge.message;
      if (repo.merge.hadConflicts.length) {
        text += '\n# Conflicts:\n' + repo.merge.hadConflicts.map(function (p) { return '#\t' + p; }).join('\n') + '\n';
      }
      text += '#\n# It looks like you may be committing a merge.\n# If this is not correct, please run\n#\tgit update-ref -d MERGE_HEAD\n# and try again.\n';
    } else if (repo.revert) {
      text = repo.revert.message;
      if (repo.revert.hadConflicts.length) {
        text += '\n# Conflicts:\n' + repo.revert.hadConflicts.map(function (p) { return '#\t' + p; }).join('\n') + '\n';
      }
    } else text = amend ? w.commits[head].message : '';
    text += '\n# Please enter the commit message for your changes. Lines starting\n' +
      "# with '#' will be ignored, and an empty message aborts the commit.\n#\n" + comment + '\n#\n';
    return { type: 'editor', file: 'COMMIT_EDITMSG', text: text, resume: function (t) { return finish(t, true); } };
  };

  C.log = function (ctx, args) {
    var w = ctx.w, repo = ctx.repo, out = ctx.out, oneline = false, graph = false, all = false, max = -1, i, a, revs = [];
    for (i = 0; i < args.length; i++) {
      a = args[i];
      if (a === '--oneline') oneline = true;
      else if (a === '--graph') graph = true;
      else if (a === '--all') all = true;
      else if (a === '--decorate' || a === '--no-color' || a === '--color') { /* výchozí */ }
      else if (/^-\d+$/.test(a)) max = parseInt(a.slice(1), 10);
      else if (a === '-n' && i + 1 < args.length) max = parseInt(args[++i], 10);
      else if (/^-n\d+$/.test(a)) max = parseInt(a.slice(2), 10);
      else if (a.charAt(0) === '-') { out.p('fatal: unrecognized argument: ' + a); out.note('Simulátor: git log zná --oneline, --graph, --all a -N (počet).'); return; }
      else revs.push(a);
    }
    var tips = [];
    if (revs.length) {
      for (i = 0; i < revs.length; i++) {
        var h = resolveRev(ctx, revs[i]);
        if (!h) {
          out.p("fatal: ambiguous argument '" + revs[i] + "': unknown revision or path not in the working tree.");
          out.p("Use '--' to separate paths from revisions, like this:");
          out.p("'git <command> [<revision>...] -- [<file>...]'");
          return;
        }
        tips.push(h);
      }
    } else {
      if (!repo.headHash() && !all) { out.p("fatal: your current branch '" + repo.head + "' does not have any commits yet"); return; }
      if (repo.headHash()) tips.push(repo.headHash());
    }
    if (all) {
      sortedKeys(repo.branches).forEach(function (b) { tips.push(repo.branches[b]); });
      sortedKeys(repo.remoteRefs).forEach(function (b) { tips.push(repo.remoteRefs[b]); });
    }
    var deco = decorations(ctx);
    function entry(hash) {
      var c = w.commits[hash], lines = [];
      if (oneline) {
        lines.push([[short(hash), 'y']].concat(decorSegs(deco[hash])).concat([[' ' + subject(c.message), '']]));
        return lines;
      }
      lines.push([['commit ' + hash, 'y']].concat(decorSegs(deco[hash])));
      if (c.parents.length > 1) lines.push([['Merge: ' + c.parents.map(short).join(' '), '']]);
      lines.push([['Author: ' + c.author.name + ' <' + c.author.email + '>', '']]);
      lines.push([['Date:   ' + fmtDate(c.author), '']]);
      lines.push([]);
      c.message.replace(/\n+$/, '').split('\n').forEach(function (l) { lines.push([['    ' + l, '']]); });
      return lines;
    }
    if (graph) {
      root.GitGraph.render(w, walkByDate(ctx, tips), max, entry, oneline).forEach(function (segs) { out.segs(segs); });
      return;
    }
    var list = walkByDate(ctx, tips);
    if (max >= 0) list = list.slice(0, max);
    list.forEach(function (hash, idx) {
      if (!oneline && idx) out.p('');
      entry(hash).forEach(function (segs) { out.segs(segs); });
    });
  };

  C.diff = function (ctx, args) {
    var w = ctx.w, repo = ctx.repo, out = ctx.out, W = ctx.dir.files, staged = false, rest = [], paths = [], revs = [], i, dashdash = false;
    for (i = 0; i < args.length; i++) {
      if (args[i] === '--staged' || args[i] === '--cached') staged = true;
      else if (args[i] === '--') dashdash = true;
      else if (args[i].charAt(0) === '-' && !dashdash) { out.p('error: invalid option: ' + args[i]); out.note('Simulátor: git diff zná --staged a název souboru.'); return; }
      else if (dashdash) paths.push(args[i]);
      else rest.push(args[i]);
    }
    for (i = 0; i < rest.length; i++) {
      var a = rest[i], isFile = (a in W) || repo.index[a] || a === '.';
      var h = isFile ? null : resolveRev(ctx, a);
      if (isFile) paths.push(a);
      else if (h) revs.push(h);
      else {
        out.p("fatal: ambiguous argument '" + a + "': unknown revision or path not in the working tree.");
        out.p("Use '--' to separate paths from revisions, like this:");
        out.p("'git <command> [<revision>...] -- [<file>...]'");
        return;
      }
    }
    var I = repo.index, items = [], oldT, newT, p, useW = false;
    function content(tree, p) { return tree[p] ? w.blobs[tree[p]] : null; }
    if (revs.length >= 2) { oldT = w.treeOf(revs[0]); newT = w.treeOf(revs[1]); }
    else if (revs.length === 1) { oldT = w.treeOf(revs[0]); if (staged) newT = I; else useW = true; }
    else if (staged) { oldT = w.treeOf(repo.headHash()); newT = I; }
    else { oldT = I; useW = true; }
    var names = Object.create(null);
    for (p in oldT) names[p] = 1;
    if (!useW) for (p in newT) names[p] = 1;
    var conf = repo.conflicts;
    var conflicted = sortedKeys(conf);
    function wanted(p) { return !paths.length || paths.some(function (s) { return matchPaths(ctx, s, [p]).length; }); }
    // git diff <commit>: soubory v konfliktu se porovnávají s pracovní složkou jako ostatní
    sortedKeys(names).forEach(function (p) {
      if ((conf[p] && !(useW && revs.length)) || !wanted(p)) return;
      if (useW) {
        // git diff <commit>: soubor, který není v indexu, je smazaný (i když leží v pracovní složce)
        if (revs.length && !I[p] && !conf[p]) { items.push({ path: p, a: content(oldT, p), b: null }); return; }
        items.push({ path: p, a: content(oldT, p), b: (p in W) ? W[p] : null });
      } else items.push({ path: p, a: content(oldT, p), b: content(newT, p) });
    });
    if (useW && revs.length) {
      var extra = Object.create(null);
      sortedKeys(I).forEach(function (p) { extra[p] = 1; });
      conflicted.forEach(function (p) { extra[p] = 1; });
      sortedKeys(extra).forEach(function (p) {
        if (names[p] || !wanted(p)) return;
        if (conf[p] && !(p in W)) return;
        items.push({ path: p, a: null, b: (p in W) ? W[p] : null });
      });
    }
    if (!revs.length) {
      conflicted.forEach(function (p) {
        if (!wanted(p)) return;
        var c = conf[p];
        if (useW && c.ours && c.theirs) { printCombined(ctx, out, p, c); return; }
        items.push({ path: p, unmerged: true });
        if (useW && c.ours) items.push({ path: p, a: w.blobs[c.ours], b: (p in W) ? W[p] : null });
      });
    }
    items.sort(function (x, y) { return GW.cmpBytes(x.path, y.path); });
    printDiff(ctx, out, items);
  };

  C.restore = function (ctx, args) {
    var w = ctx.w, repo = ctx.repo, out = ctx.out, W = ctx.dir.files, staged = false, worktree = false, source = null, specs = [], i, a;
    for (i = 0; i < args.length; i++) {
      a = args[i];
      if (a === '--staged' || a === '-S') staged = true;
      else if (a === '--worktree' || a === '-W') worktree = true;
      else if (a.indexOf('--source=') === 0) source = a.slice(9);
      else if ((a === '--source' || a === '-s') && i + 1 < args.length) source = args[++i];
      else if (a === '--') { /* nic */ }
      else if (a.charAt(0) === '-' && a.length > 1) { out.p("error: unknown option `" + a.replace(/^-+/, '') + "'"); return; }
      else specs.push(a);
    }
    if (!specs.length) { out.p('fatal: you must specify path(s) to restore'); return; }
    if (!staged) worktree = true;
    var srcT;
    if (source !== null) {
      var sh = resolveRev(ctx, source);
      if (!sh) { out.p('fatal: could not resolve ' + source); return; }
      srcT = w.treeOf(sh);
    } else if (staged) {
      if (!repo.headHash()) { out.p('fatal: could not resolve HEAD'); return; }
      srcT = w.treeOf(repo.headHash());
    } else srcT = repo.index;
    var conf = repo.conflicts;
    var pool = Object.create(null), p;
    for (p in srcT) pool[p] = 1;
    for (p in repo.index) pool[p] = 1;
    if (!staged && source === null) for (p in conf) pool[p] = 1;
    var names = sortedKeys(pool), todo = Object.create(null);
    for (i = 0; i < specs.length; i++) {
      var hit = matchPaths(ctx, specs[i], names);
      if (!hit.length) { out.p("error: pathspec '" + specs[i] + "' did not match any file(s) known to git"); return; }
      hit.forEach(function (p) { todo[p] = 1; });
    }
    var unmerged = sortedKeys(todo).filter(function (p) { return conf[p] && !staged && source === null; });
    if (unmerged.length) {
      unmerged.forEach(function (p) { out.p("error: path '" + p + "' is unmerged"); });
      return;
    }
    for (p in todo) {
      if (staged) { if (srcT[p]) repo.index[p] = srcT[p]; else delete repo.index[p]; }
      if (worktree) { if (srcT[p]) W[p] = w.blobs[srcT[p]]; else delete W[p]; }
    }
  };

  // vrátí index a pracovní složku do stavu HEAD (git merge --abort, git revert --abort/--skip)
  function resetToHead(ctx) {
    var w = ctx.w, repo = ctx.repo, W = ctx.dir.files, headT = w.treeOf(repo.headHash()), p;
    for (p in repo.conflicts) { if (headT[p]) W[p] = w.blobs[headT[p]]; else delete W[p]; }
    var cur = copyMap(repo.index);
    for (p in cur) if (cur[p] !== headT[p]) { if (headT[p]) W[p] = w.blobs[headT[p]]; else delete W[p]; }
    for (p in headT) if (!cur[p]) W[p] = w.blobs[headT[p]];
    repo.index = copyMap(headT);
    repo.conflicts = Object.create(null);
  }

  C.revert = function (ctx, args) {
    var w = ctx.w, repo = ctx.repo, out = ctx.out, noEdit = false, revs = [], i, action = null;
    for (i = 0; i < args.length; i++) {
      if (args[i] === '--no-edit') noEdit = true;
      else if (args[i] === '--edit' || args[i] === '-e') noEdit = false;
      else if (args[i] === '--abort' || args[i] === '--continue' || args[i] === '--quit' || args[i] === '--skip') action = args[i];
      else if (args[i].charAt(0) === '-') { out.p("error: unknown option `" + args[i].replace(/^-+/, '') + "'"); return; }
      else revs.push(args[i]);
    }
    if (action) {
      if (!repo.revert) {
        out.p(action === '--skip' ? 'error: no revert in progress' : 'error: no cherry-pick or revert in progress');
        out.p('fatal: revert failed');
        return;
      }
      if (action === '--abort' || action === '--skip') { resetToHead(ctx); repo.revert = null; return; }
      if (action === '--quit') { repo.revert = null; return; }
      return C.commit(ctx, noEdit ? ['--no-edit'] : []);
    }
    if (!revs.length) { out.p('usage: git revert [--[no-]edit] [-n] [-m <parent-number>] [-s] [-S[<keyid>]] <commit>...'); return; }
    if (revs.length > 1) { out.note('Simulátor: vracej commity po jednom.'); return; }
    var target = repo.headHash() ? resolveRev(ctx, revs[0]) : null;
    if (!target) { out.p("fatal: bad revision '" + revs[0] + "'"); return; }
    var c = w.commits[target], head = repo.headHash();
    if (sortedKeys(repo.conflicts).length) {
      out.p('error: Reverting is not possible because you have unmerged files.');
      out.hint("Fix them up in the work tree, and then use 'git add/rm <file>'\nas appropriate to mark resolution and make a commit.");
      out.p('fatal: revert failed');
      return;
    }
    if (c.parents.length > 1) {
      out.p('error: commit ' + target + ' is a merge but no -m option was given.');
      out.p('fatal: revert failed');
      return;
    }
    var info = statusInfo(ctx);
    if (info.staged.length) {
      out.p('error: your local changes would be overwritten by revert.');
      out.hint('commit your changes or stash them to proceed.');
      out.p('fatal: revert failed');
      return;
    }
    var subj = subject(c.message);
    var headT = w.treeOf(head), parentT = w.treeOf(c.parents[0] || null);
    var theirsLabel = c.parents.length ? 'parent of ' + short(target) + ' (' + subj + ')' : '(empty tree)';
    var res = mergeTrees(ctx, w.trees[c.tree], headT, parentT, 'HEAD', theirsLabel);
    if (res.unsupported) { unsupportedMerge(out); return; }
    var ct = conflictTarget(ctx, res);
    var chk = checkOverwrite(ctx, headT, ct.tree, ct.extra);
    if (!chk.ok) {
      overwriteError(ctx, out, chk, 'merge');
      out.p('fatal: revert failed');
      return;
    }
    var title;
    if (subj.indexOf('Revert "') === 0 && subj.slice(8).indexOf('Revert "') !== 0) title = 'Reapply "' + subj.slice(8);
    else title = 'Revert "' + subj + '"';
    var message = title + '\n\nThis reverts commit ' + target + '.\n';
    if (res.count) {
      res.messages.forEach(function (m) { out.p(m[0], m[1]); });
      writeConflictResult(ctx, headT, res);
      repo.conflicts = res.conflicts;
      repo.revert = { commit: target, message: message, hadConflicts: sortedKeys(res.conflicts) };
      out.p('error: could not revert ' + short(target) + '... ' + subj);
      out.hint('After resolving the conflicts, mark them with\n"git add/rm <pathspec>", then run\n"git revert --continue".\n' +
        'You can instead skip this commit with "git revert --skip".\nTo abort and get back to the state before "git revert",\n' +
        'run "git revert --abort".\nDisable this message with "git config advice.mergeConflict false"');
      return;
    }
    res.messages.forEach(function (m) { out.p(m[0], m[1]); });
    var id = identity(ctx, out);
    if (!id) return;
    function finish(text, fromEditor) {
      var o = fromEditor ? new Out() : out;
      var msg = cleanupMessage(text, fromEditor);
      if (!msg) { o.p('Aborting commit due to empty commit message.'); return { lines: o.lines }; }
      if (w.tree(res.tree) === (head ? w.commits[head].tree : null)) {
        printStatus(ctx, o, true);
        return { lines: o.lines };
      }
      applyTree(ctx, headT, res.tree);
      var hash = writeCommit(ctx, id, [head], msg, res.tree);
      repo.branches[repo.head] = hash;
      printCommitResult(ctx, o, hash, { date: !fromEditor });
      return { lines: o.lines };
    }
    if (noEdit) { finish(message, false); return; }
    return {
      type: 'editor', file: 'COMMIT_EDITMSG',
      text: message + '\n# Please enter the commit message for your changes. Lines starting\n' +
        "# with '#' will be ignored, and an empty message aborts the commit.\n#\n# On branch " + repo.head + '\n#\n',
      resume: function (t) { return finish(t, true); }
    };
  };

  function badBranchName(out, name) {
    out.p("fatal: '" + name + "' is not a valid branch name");
    out.hint('See `man git check-ref-format`\nDisable this message with "git config advice.refSyntax false"');
  }

  function validBranchName(n) {
    return n !== '' && !/[\s~^:?*\[\\]/.test(n) && n.indexOf('..') < 0 && n.charAt(0) !== '-' && n.charAt(0) !== '.' &&
      n.charAt(n.length - 1) !== '/' && n.charAt(n.length - 1) !== '.' && !/\.lock$/.test(n) && n !== '@';
  }

  C.branch = function (ctx, args) {
    var w = ctx.w, repo = ctx.repo, out = ctx.out, mode = 'list', allB = false, names = [], i, a;
    for (i = 0; i < args.length; i++) {
      a = args[i];
      if (a === '-M' || a === '-m' || a === '--move') mode = (a === '-M') ? 'forcemove' : 'move';
      else if (a === '-d' || a === '--delete') mode = 'delete';
      else if (a === '-D') mode = 'forcedelete';
      else if (a === '-a' || a === '--all') allB = true;
      else if (a === '--list' || a === '-l') mode = 'list';
      else if (a.indexOf('--set-upstream-to=') === 0 || a === '-u') {
        var up = a === '-u' ? args[++i] : a.slice(18), parts = (up || '').split('/');
        if (!up || !repo.remoteRefs[up]) { out.p("fatal: the requested upstream branch '" + up + "' does not exist"); return; }
        repo.upstream[repo.head] = { remote: parts[0], branch: parts.slice(1).join('/') };
        out.p("branch '" + repo.head + "' set up to track '" + up + "'.");
        return;
      } else if (a.charAt(0) === '-') { out.p("error: unknown option `" + a.replace(/^-+/, '') + "'"); return; }
      else names.push(a);
    }
    if (mode === 'list' && !names.length) {
      sortedKeys(repo.branches).forEach(function (b) {
        if (b === repo.head) out.segs([['* ', ''], [b, 'g']]);
        else out.p('  ' + b);
      });
      if (allB) {
        var heads = [];
        sortedKeys(repo.remoteHead || {}).forEach(function (rn) {
          if (repo.remoteRefs[rn + '/' + repo.remoteHead[rn]]) heads.push(rn);
        });
        var list = sortedKeys(repo.remoteRefs).map(function (r) { return { name: r }; });
        heads.forEach(function (rn) { list.push({ name: rn + '/HEAD', target: rn + '/' + repo.remoteHead[rn] }); });
        list.sort(function (x, y) { return GW.cmpBytes(x.name, y.name); });
        list.forEach(function (e) {
          if (e.target) out.segs([['  ', ''], ['remotes/' + e.name, 'r'], [' -> ' + e.target, '']]);
          else out.segs([['  ', ''], ['remotes/' + e.name, 'r']]);
        });
      }
      return;
    }
    if (mode === 'move' || mode === 'forcemove') {
      var from = names.length > 1 ? names[0] : repo.head, to = names[names.length - 1];
      if (!names.length) { out.p('fatal: branch name required'); return; }
      if (!validBranchName(to)) { badBranchName(out, to); return; }
      if (from !== repo.head && !repo.branches[from]) { out.p("error: refname refs/heads/" + from + ' not found'); out.p('fatal: Branch rename failed'); return; }
      if (to === from) return;
      if (repo.branches[to] && mode === 'move') { out.p("fatal: a branch named '" + to + "' already exists"); return; }
      if (repo.branches[from]) { repo.branches[to] = repo.branches[from]; delete repo.branches[from]; }
      if (repo.upstream[from]) { repo.upstream[to] = repo.upstream[from]; delete repo.upstream[from]; }
      if (repo.head === from) repo.head = to;
      return;
    }
    if (mode === 'delete' || mode === 'forcedelete') {
      if (!names.length) { out.p('fatal: branch name required'); return; }
      names.forEach(function (n) {
        if (n === repo.head) { out.p("error: cannot delete branch '" + n + "' used by worktree at '" + ctx.m.gitPath() + "'"); return; }
        if (!repo.branches[n]) { out.p("error: branch '" + n + "' not found"); return; }
        var h = repo.branches[n];
        if (mode === 'delete' && !w.isAncestor(h, repo.headHash())) {
          out.p("error: the branch '" + n + "' is not fully merged");
          out.hint("If you are sure you want to delete it, run 'git branch -D " + n + "'\nDisable this message with \"git config advice.forceDeleteBranch false\"");
          return;
        }
        delete repo.branches[n];
        delete repo.upstream[n];
        out.p('Deleted branch ' + n + ' (was ' + short(h) + ').');
      });
      return;
    }
    // vytvoření větve
    var name = names[0], start = names.length > 1 ? resolveRev(ctx, names[1]) : repo.headHash();
    if (!validBranchName(name)) { badBranchName(out, name); return; }
    if (repo.branches[name]) { out.p("fatal: a branch named '" + name + "' already exists"); return; }
    if (!start) { out.p("fatal: not a valid object name: '" + (names.length > 1 ? names[1] : repo.head) + "'"); return; }
    repo.branches[name] = start;
  };

  C.switch = function (ctx, args) {
    var w = ctx.w, repo = ctx.repo, out = ctx.out, create = false, names = [], i;
    for (i = 0; i < args.length; i++) {
      if (args[i] === '-c' || args[i] === '--create') create = true;
      else if (args[i] === '-') { out.note('Simulátor: napiš název větve, na kterou chceš přepnout.'); return; }
      else if (args[i].charAt(0) === '-') { out.p("error: unknown option `" + args[i].replace(/^-+/, '') + "'"); out.note('Simulátor: git switch zná název větve a -c (vytvořit).'); return; }
      else names.push(args[i]);
    }
    if (!names.length) { out.p(create ? "error: switch `c' requires a value" : 'fatal: missing branch or commit argument'); return; }
    var name = names[0];
    if (repo.merge) {
      out.p('fatal: cannot switch branch while merging');
      out.p('Consider "git merge --quit" or "git worktree add".');
      return;
    }
    if (repo.revert) {
      out.p('fatal: cannot switch branch while reverting');
      out.p('Consider "git revert --quit" or "git worktree add".');
      return;
    }
    if (create) {
      if (!validBranchName(name)) { badBranchName(out, name); return; }
      if (repo.branches[name]) { out.p("fatal: a branch named '" + name + "' already exists"); return; }
      var start = names.length > 1 ? resolveRev(ctx, names[1]) : repo.headHash();
      if (names.length > 1 && !start) { out.p("fatal: invalid reference: " + names[1]); return; }
      if (start && names.length > 1 && start !== repo.headHash()) {
        out.note('Simulátor: novou větev zakládej z místa, kde právě jsi (git switch -c nazev).');
        return;
      }
      if (start) repo.branches[name] = start;
      repo.head = name;
      // bez výchozího bodu Git pracovní složku neprochází (only_merge_on_switching_branches)
      if (names.length > 1 && start) localChangeLines(ctx);
      out.p("Switched to a new branch '" + name + "'");
      return;
    }
    if (name === repo.head && repo.branches[name]) {
      localChangeLines(ctx);
      out.p("Already on '" + name + "'");
      trackingLines(ctx, out);
      return;
    }
    var track = null;
    if (!repo.branches[name]) {
      var cands = sortedKeys(repo.remoteRefs).filter(function (r) { return r.slice(r.indexOf('/') + 1) === name; });
      if (cands.length === 1) track = cands[0];
      else { out.p('fatal: invalid reference: ' + name); return; }
    }
    var target = track ? repo.remoteRefs[track] : repo.branches[name];
    var fromT = w.treeOf(repo.headHash()), toT = w.treeOf(target);
    var chk = checkOverwrite(ctx, fromT, toT);
    if (!chk.ok) { overwriteError(ctx, out, chk, 'checkout'); return; }
    applyTree(ctx, fromT, toT);
    if (!repo.headHash()) { /* opouštíme větev bez commitů – zanikne */ }
    if (track) {
      repo.branches[name] = target;
      repo.upstream[name] = { remote: track.slice(0, track.indexOf('/')), branch: name };
    }
    repo.head = name;
    localChangeLines(ctx);
    if (track) {
      out.p("branch '" + name + "' set up to track '" + track + "'.");
      out.p("Switched to a new branch '" + name + "'");
    } else {
      out.p("Switched to branch '" + name + "'");
      trackingLines(ctx, out);
    }
  };

  // "M\tsoubor" – místní změny, které se přenesly na druhou větev.
  // Git porovná poslední commit s pracovní složkou (diff-index bez --cached).
  function localChangeLines(ctx) {
    var w = ctx.w, repo = ctx.repo, W = ctx.dir.files, I = repo.index, H = w.treeOf(repo.headHash());
    var out = ctx.out, all = Object.create(null), p;
    for (p in H) all[p] = 1;
    for (p in I) all[p] = 1;
    sortedKeys(all).forEach(function (p) {
      var st = null;
      if (!H[p]) { if (I[p] && (p in W)) st = 'A'; }
      else if (!I[p] || !(p in W)) st = 'D';
      else if (w.hashBlob(W[p]) !== H[p]) st = 'M';
      if (st) out.p(st + '\t' + quotePath(ctx, p));
    });
  }

  C.checkout = function (ctx) {
    ctx.out.note('Simulátor: v kurzu místo git checkout používáme novější příkazy:');
    ctx.out.note('  git switch nazev-vetve   (přepnutí větve)');
    ctx.out.note('  git restore soubor       (zahození změn v souboru)');
  };

  C.merge = function (ctx, args) {
    var w = ctx.w, repo = ctx.repo, out = ctx.out, names = [], noEdit = false, i, msg = null;
    for (i = 0; i < args.length; i++) {
      if (args[i] === '--abort') {
        if (!repo.merge) { out.p('fatal: There is no merge to abort (MERGE_HEAD missing).'); return; }
        resetToHead(ctx);
        repo.merge = null;
        return;
      }
      if (args[i] === '--no-edit') noEdit = true;
      else if (args[i] === '--continue') {
        if (!repo.merge) { out.p('fatal: There is no merge in progress (MERGE_HEAD missing).'); return; }
        return C.commit(ctx, []);
      } else if (args[i] === '-m' && i + 1 < args.length) { msg = args[++i]; noEdit = true; }
      else if (args[i] === '--no-ff' || args[i] === '--ff-only' || args[i] === '--squash') { out.note('Simulátor: git merge používáme bez přepínačů (jen název větve).'); return; }
      else if (args[i].charAt(0) === '-') { out.p("error: unknown option `" + args[i].replace(/^-+/, '') + "'"); return; }
      else names.push(args[i]);
    }
    if (sortedKeys(repo.conflicts).length) {
      out.p('error: Merging is not possible because you have unmerged files.');
      out.hint("Fix them up in the work tree, and then use 'git add/rm <file>'\nas appropriate to mark resolution and make a commit.");
      out.p('fatal: Exiting because of an unresolved conflict.');
      return;
    }
    if (repo.merge) {
      if (false) {
        out.p('error: Merging is not possible because you have unmerged files.');
        out.hint("Fix them up in the work tree, and then use 'git add/rm <file>'\nas appropriate to mark resolution and make a commit.");
        out.p('fatal: Exiting because of an unresolved conflict.');
      } else {
        out.p('fatal: You have not concluded your merge (MERGE_HEAD exists).');
        out.p('Please, commit your changes before you merge.');
      }
      return;
    }
    if (!names.length) { out.p('fatal: No remote for the current branch.'); return; }
    if (names.length > 1) { out.note('Simulátor: slučuj vždy jen jednu větev.'); return; }
    var name = names[0], theirs = resolveRev(ctx, name);
    if (!theirs) { out.p('merge: ' + name + ' - not something we can merge'); return; }
    if (!repo.headHash()) {
      var toT = w.treeOf(theirs), chk = checkOverwrite(ctx, Object.create(null), toT);
      if (!chk.ok) { overwriteError(ctx, out, chk, 'merge'); return; }
      applyTree(ctx, Object.create(null), toT);
      repo.branches[repo.head] = theirs;
      return;
    }
    var message;
    if (msg !== null) message = msg + '\n';
    else {
      if (repo.branches[name]) message = "Merge branch '" + name + "'";
      else if (repo.remoteRefs[name]) message = "Merge remote-tracking branch '" + name + "'";
      else message = "Merge commit '" + name + "'";
      if (repo.head !== 'main' && repo.head !== 'master') message += ' into ' + repo.head;
      message += '\n';
    }
    var wait = doMerge(ctx, out, { theirs: theirs, label: name, message: message, noEdit: noEdit });
    return wait || undefined;
  };

  C.remote = function (ctx, args) {
    var repo = ctx.repo, out = ctx.out, verbose = false, rest = [];
    args.forEach(function (a) { if (a === '-v' || a === '--verbose') verbose = true; else rest.push(a); });
    function find(n) { for (var i = 0; i < repo.remotes.length; i++) if (repo.remotes[i].name === n) return i; return -1; }
    if (!rest.length) {
      repo.remotes.slice().sort(function (a, b) { return GW.cmpBytes(a.name, b.name); }).forEach(function (r) {
        if (verbose) { out.p(r.name + '\t' + r.url + ' (fetch)'); out.p(r.name + '\t' + r.url + ' (push)'); }
        else out.p(r.name);
      });
      return;
    }
    var sub = rest[0], idx;
    if (sub === 'add') {
      if (rest.length !== 3) { out.p('usage: git remote add [<options>] <name> <url>'); return; }
      if (find(rest[1]) >= 0) { out.p('error: remote ' + rest[1] + ' already exists.'); return; }
      repo.remotes.push({ name: rest[1], url: rest[2] });
      return;
    }
    if (sub === 'set-url') {
      if (rest.length !== 3) { out.p('usage: git remote set-url [--push] <name> <newurl> [<oldurl>]'); return; }
      idx = find(rest[1]);
      if (idx < 0) { out.p("error: No such remote '" + rest[1] + "'"); return; }
      repo.remotes[idx].url = rest[2];
      return;
    }
    if (sub === 'remove' || sub === 'rm') {
      if (rest.length !== 2) { out.p('usage: git remote remove <name>'); return; }
      idx = find(rest[1]);
      if (idx < 0) { out.p("error: No such remote: '" + rest[1] + "'"); return; }
      var name = rest[1], k;
      repo.remotes.splice(idx, 1);
      for (k in repo.remoteRefs) if (k.indexOf(name + '/') === 0) delete repo.remoteRefs[k];
      for (k in repo.upstream) if (repo.upstream[k].remote === name) delete repo.upstream[k];
      if (repo.remoteHead) delete repo.remoteHead[name];
      return;
    }
    if (sub === 'get-url') {
      idx = find(rest[1]);
      if (idx < 0) { out.p("error: No such remote '" + rest[1] + "'"); return; }
      out.p(repo.remotes[idx].url);
      return;
    }
    out.p('error: unknown subcommand: `' + sub + "'");
  };

  C.push = function (ctx, args) {
    var w = ctx.w, repo = ctx.repo, out = ctx.out, setUp = false, rest = [], i;
    for (i = 0; i < args.length; i++) {
      if (args[i] === '-u' || args[i] === '--set-upstream') setUp = true;
      else if (args[i] === '-f' || args[i] === '--force' || args[i] === '--force-with-lease') {
        out.note('Simulátor: vynucený push (--force) v kurzu nepoužíváme – přepsal by práci ostatních.');
        return;
      } else if (args[i].charAt(0) === '-') { out.p("error: unknown option `" + args[i].replace(/^-+/, '') + "'"); return; }
      else rest.push(args[i]);
    }
    var up = repo.upstream[repo.head], remoteName, branch, dest;
    if (rest.length) {
      remoteName = rest[0];
      branch = rest[1] || repo.head;
      dest = branch;
      if (rest.length === 1 && up && up.remote === remoteName) dest = up.branch;
    } else {
      if (!repo.remotes.length) {
        out.p('fatal: No configured push destination.');
        out.p('Either specify the URL from the command-line or configure a remote repository using');
        out.p(''); out.p('    git remote add <name> <url>'); out.p('');
        out.p('and then push using the remote name');
        out.p(''); out.p('    git push <name>'); out.p('');
        return;
      }
      if (!up) {
        var guess = repo.remoteUrl('origin') ? 'origin' : repo.remotes[0].name;
        out.p('fatal: The current branch ' + repo.head + ' has no upstream branch.');
        out.p('To push the current branch and set the remote as upstream, use');
        out.p(''); out.p('    git push --set-upstream ' + guess + ' ' + repo.head); out.p('');
        out.p('To have this happen automatically for branches without a tracking');
        out.p("upstream, see 'push.autoSetupRemote' in 'git help config'.");
        out.p('');
        return;
      }
      remoteName = up.remote; branch = repo.head; dest = up.branch;
      if (dest !== branch) {
        out.p('fatal: The upstream branch of your current branch does not match');
        out.p('the name of your current branch.  To push to the upstream branch');
        out.p('on the remote, use');
        out.p(''); out.p('    git push ' + remoteName + ' HEAD:' + dest); out.p('');
        out.p('To push to the branch of the same name on the remote, use');
        out.p(''); out.p('    git push ' + remoteName + ' HEAD'); out.p('');
        return;
      }
    }
    var url = repo.remoteUrl(remoteName);
    if (!url) {
      out.p("fatal: '" + remoteName + "' does not appear to be a git repository");
      out.p('fatal: Could not read from remote repository.');
      out.p('');
      out.p('Please make sure you have the correct access rights');
      out.p('and the repository exists.');
      return;
    }
    var local = repo.branches[branch];
    if (!local) {
      out.p('error: src refspec ' + branch + ' does not match any');
      out.p("error: failed to push some refs to '" + url + "'");
      return;
    }
    var acc = openRemote(ctx, out, url, true, function () {
      var c2 = { m: ctx.m, w: w, dir: ctx.dir, repo: repo, out: new Out() };
      var r = C.push(c2, args);
      return { lines: c2.out.lines, wait: r || undefined };
    });
    if (acc.wait) return acc.wait;
    if (acc.error) return;
    var remote = acc.remote, theirs = remote.branches[dest] || null, ref = remoteName + '/' + dest;
    if (theirs === local) {
      out.p('Everything up-to-date');
      repo.remoteRefs[ref] = local;
      if (setUp) { repo.upstream[branch] = { remote: remoteName, branch: dest }; out.p("branch '" + branch + "' set up to track '" + ref + "'."); }
      return;
    }
    if (theirs && !w.isAncestor(theirs, local)) {
      var known = knownCommits(ctx)[theirs];
      out.p('To ' + url);
      out.segs([[' ', ''], ['! [rejected]       ', 'r'], [' ' + branch + ' -> ' + dest + ' (' + (known ? 'non-fast-forward' : 'fetch first') + ')', '']]);
      out.p("error: failed to push some refs to '" + url + "'", 'r');
      if (known) {
        out.hint('Updates were rejected because the tip of your current branch is behind\n' +
          'its remote counterpart. If you want to integrate the remote changes,\n' +
          "use 'git pull' before pushing again.\n" +
          "See the 'Note about fast-forwards' in 'git push --help' for details.");
      } else {
        out.hint('Updates were rejected because the remote contains work that you do not\n' +
          'have locally. This is usually caused by another repository pushing to\n' +
          'the same ref. If you want to integrate the remote changes, use\n' +
          "'git pull' before pushing again.\n" +
          "See the 'Note about fast-forwards' in 'git push --help' for details.");
      }
      return;
    }
    var tips = [], k;
    for (k in remote.branches) tips.push(remote.branches[k]);
    var objs = newObjects(w, tips, [local]), n = Object.keys(objs).length, extra = theirs ? 2 : 0;
    out.progress('Enumerating objects: ' + (n + extra) + ', done.');
    out.progress('Counting objects: 100% (' + (n + extra) + '/' + (n + extra) + '), done.');
    if (n > 2) {
      out.progress('Delta compression using up to 8 threads');
      out.progress('Compressing objects: 100% (' + (n - 1) + '/' + (n - 1) + '), done.');
    }
    out.progress('Writing objects: 100% (' + n + '/' + n + '), ' + sizeText(sizeEstimate(w, objs)) + ', done.');
    out.progress('Total ' + n + ' (delta 0), reused 0 (delta 0), pack-reused 0 (from 0)');
    out.p('To ' + url);
    if (!theirs) out.p(' * [new branch]      ' + branch + ' -> ' + dest);
    else out.p('   ' + short(theirs) + '..' + short(local) + '  ' + branch + ' -> ' + dest);
    remote.branches[dest] = local;
    if (!remote.defaultBranch || !remote.branches[remote.defaultBranch]) remote.defaultBranch = dest;
    repo.remoteRefs[ref] = local;
    if (setUp) { repo.upstream[branch] = { remote: remoteName, branch: dest }; out.p("branch '" + branch + "' set up to track '" + ref + "'."); }
  };

  function noTracking(ctx, out, verb, remoteName) {
    var repo = ctx.repo;
    out.p('There is no tracking information for the current branch.');
    out.p('Please specify which branch you want to ' + verb + ' with.');
    out.p('See git-pull(1) for details.');
    out.p(''); out.p('    git pull <remote> <branch>'); out.p('');
    out.p('If you wish to set tracking information for this branch you can do so with:');
    out.p(''); out.p('    git branch --set-upstream-to=' + (remoteName || '<remote>') + '/<branch> ' + repo.head); out.p('');
  }

  C.fetch = function (ctx, args) {
    var repo = ctx.repo, out = ctx.out;
    var rest = args.filter(function (a) { return a.charAt(0) !== '-'; });
    var up = repo.upstream[repo.head];
    var remoteName = rest[0] || (up ? up.remote : (repo.remoteUrl('origin') ? 'origin' : (repo.remotes[0] ? repo.remotes[0].name : null)));
    if (!remoteName) return;
    var url = repo.remoteUrl(remoteName);
    if (!url) {
      out.p("fatal: '" + remoteName + "' does not appear to be a git repository");
      out.p('fatal: Could not read from remote repository.');
      out.p(''); out.p('Please make sure you have the correct access rights'); out.p('and the repository exists.');
      return;
    }
    var acc = openRemote(ctx, out, url, false, function () {
      var c2 = { m: ctx.m, w: ctx.w, dir: ctx.dir, repo: repo, out: new Out() };
      var r = C.fetch(c2, args);
      return { lines: c2.out.lines, wait: r || undefined };
    });
    if (acc.wait) return acc.wait;
    if (acc.error) return;
    doFetch(ctx, out, remoteName, acc.remote, url);
  };

  C.pull = function (ctx, args) {
    var w = ctx.w, repo = ctx.repo, out = ctx.out, rest = [], i, noRebase = false;
    for (i = 0; i < args.length; i++) {
      if (args[i] === '--no-rebase' || args[i] === '--no-edit' || args[i] === '--ff') noRebase = noRebase || args[i] === '--no-rebase';
      else if (args[i] === '--rebase' || args[i] === '-r') { out.note('Simulátor: git pull --rebase v kurzu nepoužíváme.'); return; }
      else if (args[i].charAt(0) === '-') { out.p("error: unknown option `" + args[i].replace(/^-+/, '') + "'"); return; }
      else rest.push(args[i]);
    }
    if (sortedKeys(repo.conflicts).length) {
      out.p('error: Pulling is not possible because you have unmerged files.');
      out.hint("Fix them up in the work tree, and then use 'git add/rm <file>'\nas appropriate to mark resolution and make a commit.");
      out.p('fatal: Exiting because of an unresolved conflict.');
      return;
    }
    if (repo.merge) {
      if (false) {
        out.p('error: Pulling is not possible because you have unmerged files.');
        out.hint("Fix them up in the work tree, and then use 'git add/rm <file>'\nas appropriate to mark resolution and make a commit.");
        out.p('fatal: Exiting because of an unresolved conflict.');
      } else {
        out.p('error: You have not concluded your merge (MERGE_HEAD exists).');
        out.hint('Please, commit your changes before merging.');
        out.p('fatal: Exiting because of unfinished merge.');
      }
      return;
    }
    var up = repo.upstream[repo.head];
    var remoteName = rest[0] || (up ? up.remote : (repo.remoteUrl('origin') ? 'origin' : (repo.remotes.length === 1 ? repo.remotes[0].name : null)));
    if (!remoteName) { noTracking(ctx, out, 'merge', null); return; }
    var url = repo.remoteUrl(remoteName);
    if (!url) {
      out.p("fatal: '" + remoteName + "' does not appear to be a git repository");
      out.p('fatal: Could not read from remote repository.');
      out.p(''); out.p('Please make sure you have the correct access rights'); out.p('and the repository exists.');
      return;
    }
    var acc = openRemote(ctx, out, url, false, function () {
      var c2 = { m: ctx.m, w: w, dir: ctx.dir, repo: repo, out: new Out() };
      var r = C.pull(c2, args);
      return { lines: c2.out.lines, wait: r || undefined };
    });
    if (acc.wait) return acc.wait;
    if (acc.error) return;
    var remote = acc.remote, branch = rest[1] || (up && up.remote === remoteName ? up.branch : null);
    if (rest[1] && !remote.branches[rest[1]]) {
      out.p("fatal: couldn't find remote ref " + rest[1]);
      return;
    }
    var before = repo.remoteRefs[remoteName + '/' + branch];
    if (rest[1]) {
      // git pull origin main: vypíše i řádek s FETCH_HEAD
      var updates = [], old = repo.remoteRefs[remoteName + '/' + branch], now = remote.branches[branch];
      var have = [], k;
      for (k in repo.branches) have.push(repo.branches[k]);
      for (k in repo.remoteRefs) have.push(repo.remoteRefs[k]);
      var objs = newObjects(w, have, [now]), n = Object.keys(objs).length;
      if (n) {
        out.progress('remote: Enumerating objects: ' + n + ', done.');
        out.progress('remote: Counting objects: 100% (' + n + '/' + n + '), done.');
        out.progress('remote: Total ' + n + ' (delta 0), reused 0 (delta 0), pack-reused 0 (from 0)');
        out.progress('Unpacking objects: 100% (' + n + '/' + n + '), ' + sizeText(sizeEstimate(w, objs)) + ', done.');
      }
      out.p('From ' + url.replace(/\/$/, '').replace(/\.git$/, ''));
      var width = Math.max(10, branch.length);
      out.p(' * branch            ' + pad(branch, width) + ' -> FETCH_HEAD');
      if (!old) out.p(' * [new branch]      ' + pad(branch, width) + ' -> ' + remoteName + '/' + branch);
      else if (old !== now) out.p('   ' + short(old) + '..' + short(now) + '  ' + pad(branch, width) + ' -> ' + remoteName + '/' + branch);
      repo.remoteRefs[remoteName + '/' + branch] = now;
    } else {
      doFetch(ctx, out, remoteName, remote, url);
    }
    if (!branch) { noTracking(ctx, out, 'merge', remoteName); return; }
    var theirs = repo.remoteRefs[remoteName + '/' + branch];
    if (!theirs) {
      out.p('Your configuration specifies to merge with the ref \'refs/heads/' + branch + "'");
      out.p('from the remote, but no such ref was fetched.');
      return;
    }
    var ours = repo.headHash();
    if (!ours) {
      var toT = w.treeOf(theirs), chk = checkOverwrite(ctx, Object.create(null), toT);
      if (!chk.ok) { overwriteError(ctx, out, chk, 'merge'); return; }
      applyTree(ctx, Object.create(null), toT);
      repo.branches[repo.head] = theirs;
      return;
    }
    if (!w.isAncestor(theirs, ours) && !w.isAncestor(ours, theirs)) {
      var rebase = ctx.m.getConfig('pull.rebase', repo), ff = ctx.m.getConfig('pull.ff', repo);
      if (rebase === undefined && ff === undefined && !noRebase) {
        out.hint('You have divergent branches and need to specify how to reconcile them.\n' +
          'You can do so by running one of the following commands sometime before\n' +
          'your next pull:\n\n' +
          '  git config pull.rebase false  # merge\n' +
          '  git config pull.rebase true   # rebase\n' +
          '  git config pull.ff only       # fast-forward only\n\n' +
          'You can replace "git config" with "git config --global" to set a default\n' +
          'preference for all repositories. You can also pass --rebase, --no-rebase,\n' +
          'or --ff-only on the command line to override the configured default per\n' +
          'invocation.');
        out.p('fatal: Need to specify how to reconcile divergent branches.');
        return;
      }
      if (rebase === 'true' && !noRebase) {
        out.note('Simulátor: máš nastaveno pull.rebase true, ale rebase v kurzu nepoužíváme.');
        out.note('Nastav: git config --global pull.rebase false');
        return;
      }
    }
    var message = "Merge branch '" + branch + "' of " + url.replace(/\/$/, '').replace(/\.git$/, '');
    if (repo.head !== 'main' && repo.head !== 'master') message += ' into ' + repo.head;
    var wait = doMerge(ctx, out, { theirs: theirs, label: theirs, message: message + '\n' });
    return wait || undefined;
  };

  C.clone = function (ctx, args) {
    var w = ctx.w, m = ctx.m, out = ctx.out;
    var rest = args.filter(function (a) { return a.charAt(0) !== '-'; });
    if (!rest.length) { out.p('fatal: You must specify a repository to clone.'); return; }
    var url = rest[0], parsed = GW.parseUrl(url);
    var name = rest[1] || (parsed ? parsed.name : url.replace(/\/+$/, '').replace(/\.git$/, '').split(/[\/\\:]/).pop());
    if (ctx.repo) {
      out.note('Simulátor: jsi uvnitř repozitáře ' + m.cwd[m.cwd.length - 1] + '. Klonuj o složku výš (cd ..), jinak by vznikl repozitář v repozitáři.');
      return;
    }
    var parent = ctx.dir, existing = parent.dirs[name];
    if ((name in parent.files) || (existing && (Object.keys(existing.files).length || Object.keys(existing.dirs).length || existing.repo))) {
      out.p("fatal: destination path '" + name + "' already exists and is not an empty directory.");
      return;
    }
    if (!parsed) { out.p("fatal: repository '" + url + "' does not exist"); return; }
    var already = !!m.signedIn;
    out.p("Cloning into '" + name + "'...");
    var acc = openRemote(ctx, out, url, false, function () {
      var c2 = { m: m, w: w, dir: ctx.dir, repo: ctx.repo, out: new Out() };
      var r = C.clone(c2, args);
      c2.out.lines.shift();
      return { lines: c2.out.lines, wait: r || undefined };
    });
    if (acc.wait) return acc.wait;
    if (acc.error) return;
    var remote = acc.remote, dir = existing || (parent.dirs[name] = new GW.Dir());
    var def = remote.branches[remote.defaultBranch] ? remote.defaultBranch : (sortedKeys(remote.branches)[0] || remote.defaultBranch || 'main');
    var repo = new GW.Repo(def), b;
    repo.remotes.push({ name: 'origin', url: url });
    for (b in remote.branches) repo.remoteRefs['origin/' + b] = remote.branches[b];
    repo.upstream[def] = { remote: 'origin', branch: def };
    if (remote.branches[def]) repo.remoteHead = { origin: def };
    dir.repo = repo;
    var tip = remote.branches[def];
    if (!tip) { out.p('warning: You appear to have cloned an empty repository.'); return; }
    var tips = [];
    for (b in remote.branches) tips.push(remote.branches[b]);
    var objs = w.objectsOf(tips), n = Object.keys(objs).length;
    out.progress('remote: Enumerating objects: ' + n + ', done.');
    out.progress('remote: Counting objects: 100% (' + n + '/' + n + '), done.');
    out.progress('remote: Total ' + n + ' (delta 0), reused 0 (delta 0), pack-reused 0 (from 0)');
    out.progress('Receiving objects: 100% (' + n + '/' + n + '), done.');
    repo.branches[def] = tip;
    var tree = w.treeOf(tip), p;
    for (p in tree) { repo.index[p] = tree[p]; dir.files[p] = w.blobs[tree[p]]; }
  };

  // ------------------------------------------------------------------
  //  Neznámý příkaz: stejná rada jako v Gitu ("The most similar command is")
  // ------------------------------------------------------------------
  var MAIN_CMDS = ('add am annotate apply archive bisect blame branch bugreport bundle cat-file check-attr check-ignore ' +
    'check-mailmap check-ref-format checkout checkout--worker checkout-index cherry cherry-pick clean clone column commit ' +
    'commit-graph commit-tree config count-objects credential credential-cache credential-cache--daemon credential-store ' +
    'daemon describe diagnose diff diff-files diff-index diff-tree difftool difftool--helper fast-export fast-import fetch ' +
    'fetch-pack filter-branch fmt-merge-msg for-each-ref for-each-repo format-patch fsck fsck-objects fsmonitor--daemon gc ' +
    'get-tar-commit-id grep gui--askpass hash-object help hook http-backend http-fetch http-push imap-send index-pack init ' +
    'init-db interpret-trailers log ls-files ls-remote ls-tree mailinfo mailsplit maintenance merge merge-base merge-file ' +
    'merge-index merge-octopus merge-one-file merge-ours merge-recursive merge-recursive-ours merge-recursive-theirs ' +
    'merge-resolve merge-subtree merge-tree mergetool mktag mktree multi-pack-index mv name-rev notes pack-objects ' +
    'pack-redundant pack-refs patch-id prune prune-packed pull push quiltimport range-diff read-tree rebase receive-pack ' +
    'reflog refs remote remote-ext remote-fd remote-ftp remote-ftps remote-http remote-https repack replace replay ' +
    'request-pull rerere reset restore rev-list rev-parse revert rm send-email send-pack sh-i18n--envsubst shell shortlog ' +
    'show show-branch show-index show-ref sparse-checkout stage stash status stripspace submodule submodule--helper subtree ' +
    'switch symbolic-ref tag unpack-file unpack-objects update-index update-ref update-server-info upload-archive ' +
    'upload-archive--writer upload-pack var verify-commit verify-pack verify-tag version web--browse whatchanged worktree ' +
    'write-tree').split(' ');
  var COMMON = 'add bisect branch clone commit diff fetch grep init log merge mv pull push rebase reset restore rm show status switch tag'.split(' ');

  function levenshtein(s1, s2, w, s, a, d) {
    var len1 = s1.length, len2 = s2.length, i, j;
    var row0 = new Array(len2 + 1), row1 = new Array(len2 + 1), row2 = new Array(len2 + 1), tmp;
    for (j = 0; j <= len2; j++) row1[j] = j * a;
    for (i = 0; i < len1; i++) {
      row2[0] = (i + 1) * d;
      for (j = 0; j < len2; j++) {
        row2[j + 1] = row1[j] + s * (s1.charAt(i) !== s2.charAt(j) ? 1 : 0);
        if (i > 0 && j > 0 && s1.charAt(i - 1) === s2.charAt(j) && s1.charAt(i) === s2.charAt(j - 1) && row2[j + 1] > row0[j - 1] + w) row2[j + 1] = row0[j - 1] + w;
        if (row2[j + 1] > row1[j + 1] + d) row2[j + 1] = row1[j + 1] + d;
        if (row2[j + 1] > row2[j] + a) row2[j + 1] = row2[j] + a;
      }
      tmp = row0; row0 = row1; row1 = row2; row2 = tmp;
    }
    return row1[len2];
  }

  function unknownCommand(out, cmd) {
    var scored = MAIN_CMDS.map(function (c) {
      if (COMMON.indexOf(c) >= 0 && c.indexOf(cmd) === 0) return { name: c, len: 0 };
      return { name: c, len: levenshtein(cmd, c, 0, 2, 1, 3) + 1 };
    });
    scored.sort(function (x, y) { return x.len !== y.len ? x.len - y.len : (x.name < y.name ? -1 : x.name > y.name ? 1 : 0); });
    var n = 0, best;
    while (n < scored.length && !scored[n].len) n++;
    if (scored.length <= n) best = 8;
    else {
      best = scored[n++].len;
      while (n < scored.length && best === scored[n].len) n++;
    }
    out.p("git: '" + cmd + "' is not a git command. See 'git --help'.");
    if (best < 7) {
      out.p('');
      out.p(n === 1 ? 'The most similar command is' : 'The most similar commands are');
      for (var i = 0; i < n; i++) out.p('\t' + scored[i].name);
    }
  }

  var NOT_TAUGHT = {
    rebase: 'git rebase v kurzu nepoužíváme (přepisuje historii).',
    reset: 'git reset v kurzu nepoužíváme. Změny v souboru zahodíš přes git restore, commit vrátíš přes git revert.',
    stash: 'git stash v kurzu nepoužíváme.',
    tag: 'git tag v kurzu nepoužíváme.',
    show: 'git show simulátor neumí. Historii ukáže git log, změny git diff.',
    mv: 'git mv simulátor neumí.',
    'cherry-pick': 'git cherry-pick v kurzu nepoužíváme.',
    reflog: 'git reflog simulátor neumí.',
    blame: 'git blame simulátor neumí.',
    clean: 'git clean simulátor neumí.',
    stage: 'Místo git stage piš git add.',
    gui: 'Grafické nástroje simulátor nemá.'
  };

  // ------------------------------------------------------------------
  //  Vstupní bod
  // ------------------------------------------------------------------
  function git(machine, argv) {
    var out = new Out(), dir = machine.dir();
    var ctx = { m: machine, w: machine.world, dir: dir, repo: dir ? dir.repo : null, out: out };
    if (!argv.length) {
      out.note('Napiš příkaz Gitu, např. git status. Přehled příkazů je pod tlačítkem Nápověda.');
      return { lines: out.lines };
    }
    var cmd = argv[0], args = argv.slice(1);
    if (cmd === '--version' || cmd === '-v') cmd = 'version';
    if (cmd === '--help' || cmd === '-h') cmd = 'help';
    if (!C[cmd]) {
      if (NOT_TAUGHT[cmd]) out.note('Simulátor: ' + NOT_TAUGHT[cmd]);
      else if (MAIN_CMDS.indexOf(cmd) >= 0) out.note('Simulátor: příkaz git ' + cmd + ' neumí (v kurzu ho nepotřebujeme).');
      else if (cmd.charAt(0) === '-') { out.p('unknown option: ' + cmd); out.p('usage: git [-v | --version] [-h | --help] <command> [<args>]'); }
      else unknownCommand(out, cmd);
      return { lines: out.lines };
    }
    if (!ctx.repo && !NO_REPO[cmd]) {
      out.p('fatal: not a git repository (or any of the parent directories): .git');
      return { lines: out.lines };
    }
    var wait = C[cmd](ctx, args);
    return { lines: out.lines, wait: wait || undefined };
  }

  root.GitSim = {
    git: git, Out: Out, statusInfo: function (machine) {
      var dir = machine.dir();
      if (!dir || !dir.repo) return null;
      return statusInfo({ m: machine, w: machine.world, dir: dir, repo: dir.repo });
    },
    short: short, subject: subject, fmtDate: fmtDate, VERSION: VERSION,
    resolveRev: resolveRev, ignoreRules: ignoreRules, isIgnored: isIgnored
  };
})(typeof window !== 'undefined' ? window : globalThis);
