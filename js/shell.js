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
 *  shell.js – terminál ve stylu PowerShellu (jako ve VS Code na Windows)
 *
 *  GitShell.run(machine, line) vrací {lines, wait, clear, open}
 *    open: {folder: [cesta]} | {file: název}  – co má rozhraní otevřít (příkaz code)
 *  Výstupy cd/ls/pwd/mkdir odpovídají Windows PowerShellu 5.1 (anglická verze).
 * ===================================================================== */
(function (root) {
  'use strict';
  var tr = root.GitI18n ? root.GitI18n.tr : function (s) { var a = arguments; return s.replace(/\{(\d+)\}/g, function (m, i) { return a[+i + 1]; }); };
  var GitSim = root.GitSim;

  // rozdělení příkazové řádky: mezery oddělují, "..." a '...' drží pohromadě
  function tokenize(line) {
    var out = [], cur = '', inQ = null, had = false, i, ch;
    for (i = 0; i < line.length; i++) {
      ch = line.charAt(i);
      if (inQ) {
        if (ch === inQ) { inQ = null; continue; }
        if (ch === '`' && inQ === '"' && i + 1 < line.length) { cur += line.charAt(++i); continue; }
        cur += ch;
      } else if (ch === '"' || ch === '\'' || ch === '„' || ch === '“') {
        inQ = (ch === '„' || ch === '“') ? '“' : ch; had = true;
      } else if (/\s/.test(ch)) {
        if (cur !== '' || had) { out.push(cur); cur = ''; had = false; }
      } else cur += ch;
    }
    if (inQ) return { error: 'quote' };
    if (cur !== '' || had) out.push(cur);
    return { args: out };
  }

  function Out() { this.lines = []; }
  Out.prototype.p = function (t, c) { var self = this; String(t).split('\n').forEach(function (l) { self.lines.push({ s: l ? [[l, c || '']] : [] }); }); return this; };
  Out.prototype.note = function (t) { var self = this; t.split('\n').forEach(function (l) { self.lines.push({ s: [[l, 'n']], k: 'note' }); }); return this; };

  // chybový blok PowerShellu (červeně)
  function psError(out, cmdLine, head, category, errId) {
    var lineText = cmdLine.trim();
    var t = lineText.split(/\s+/)[0];
    out.p(head, 'r');
    out.p('At line:1 char:1', 'r');
    out.p('+ ' + lineText, 'r');
    out.p('+ ' + new Array(t.length + 1).join('~'), 'r');
    out.p('    + CategoryInfo          : ' + category, 'r');
    out.p('    + FullyQualifiedErrorId : ' + errId, 'r');
    out.p('');
  }

  function two(n) { return ('0' + n).slice(-2); }
  function stamp(t) {
    var d = new Date(t * 1000);
    return two(d.getDate()) + '.' + two(d.getMonth() + 1) + '.' + d.getFullYear() + '     ' + two(d.getHours()) + ':' + two(d.getMinutes());
  }
  function lenUtf8(s) { return root.GitText.utf8Length(s); }

  function listing(m, path, entries) {
    var out = [];
    out.push('');
    out.push('    Directory: ' + m.winPath(path));
    out.push('');
    out.push('');
    out.push('Mode                 LastWriteTime         Length Name');
    out.push('----                 -------------         ------ ----');
    entries.forEach(function (e) {
      var len = e.dir ? '' : String(e.size);
      while (len.length < 14) len = ' ' + len;
      out.push((e.dir ? 'd-----' : '-a----') + '        ' + stamp(e.time) + len + ' ' + e.name);
    });
    out.push('');
    out.push('');
    return out;
  }

  function sortNames(a) { return a.slice().sort(function (x, y) { return x.toLowerCase() < y.toLowerCase() ? -1 : x.toLowerCase() > y.toLowerCase() ? 1 : 0; }); }

  var HELP = [
    tr('Simulátor umí tyto příkazy terminálu:'),
    '  pwd            kde jsem',
    tr('  ls             co je ve složce (také dir)'),
    tr('  cd nazev       jdi do složky (cd .. o složku výš, cd ~ domů)'),
    tr('  mkdir nazev    nová složka'),
    tr('  code -r .      otevři složku ve VS Code'),
    tr('  code soubor    otevři soubor v editoru'),
    tr('  cat soubor     vypiš obsah souboru (také type)'),
    tr('  rm soubor      smaž soubor'),
    tr('  cls            vyčisti terminál (také clear)'),
    tr('  git ...        příkazy Gitu (přehled: tlačítko Tahák)'),
    tr('Šipka nahoru vrátí předchozí příkaz, Tab doplní název.')
  ];

  function run(m, line) {
    var out = new Out(), now = m.world.now();
    var tk = tokenize(line);
    if (tk.error) {
      out.note(tr('Simulátor: v příkazu chybí uzavírací uvozovka. Zprávu piš takto: git commit -m "Zpráva"'));
      return { lines: out.lines };
    }
    var args = tk.args;
    if (!args.length) return { lines: [] };
    var cmd = args[0], low = cmd.toLowerCase(), rest = args.slice(1), dir = m.dir();
    if (!m.times) m.times = {};

    if (low === 'git' || low === 'git.exe') {
      var r = GitSim.git(m, rest);
      return { lines: r.lines, wait: r.wait };
    }
    if (low === 'cls' || low === 'clear' || low === 'clear-host') return { lines: [], clear: true };
    if (low === 'help' || low === '?' || low === 'napoveda' || low === 'nápověda') { out.note(HELP.join('\n')); return { lines: out.lines }; }

    if (low === 'pwd' || low === 'get-location') {
      out.p(''); out.p('Path'); out.p('----'); out.p(m.winPath()); out.p(''); out.p('');
      return { lines: out.lines };
    }

    if (low === 'cd' || low === 'chdir' || low === 'set-location' || low === 'sl') {
      if (!rest.length) return { lines: [] };
      var target = m.resolve(rest[0]);
      if (!m.dirAt(target)) {
        var full = m.winPath(target);
        var asFile = m.dirAt(target.slice(0, -1));
        if (asFile && (target[target.length - 1] in asFile.files)) {
          psError(out, line, 'cd : Cannot find path \'' + full + '\' because it does not exist.', 'ObjectNotFound: (' + full + ':String) [Set-Location], ItemNotFoundException', 'PathNotFound,Microsoft.PowerShell.Commands.SetLocationCommand');
          out.note(tr('Simulátor: {0} je soubor, ne složka. Do souboru se přejít nedá.', rest[0]));
        } else {
          psError(out, line, 'cd : Cannot find path \'' + full + '\' because it does not exist.', 'ObjectNotFound: (' + full + ':String) [Set-Location], ItemNotFoundException', 'PathNotFound,Microsoft.PowerShell.Commands.SetLocationCommand');
          out.note(tr('Simulátor: taková složka tu není. Co ve složce je, ukáže příkaz ls.'));
        }
        return { lines: out.lines };
      }
      m.cwd = target;
      return { lines: [] };
    }

    if (low === 'ls' || low === 'dir' || low === 'get-childitem' || low === 'gci') {
      var path = rest.length ? m.resolve(rest[0]) : m.cwd, d = m.dirAt(path);
      if (!d) {
        var f2 = m.winPath(path);
        psError(out, line, low + ' : Cannot find path \'' + f2 + '\' because it does not exist.', 'ObjectNotFound: (' + f2 + ':String) [Get-ChildItem], ItemNotFoundException', 'PathNotFound,Microsoft.PowerShell.Commands.GetChildItemCommand');
        return { lines: out.lines };
      }
      var entries = [];
      sortNames(Object.keys(d.dirs)).forEach(function (n) {
        entries.push({ dir: true, name: n, time: m.times[path.concat([n]).join('/')] || now });
      });
      sortNames(Object.keys(d.files)).forEach(function (n) {
        entries.push({ dir: false, name: n, size: lenUtf8(d.files[n]), time: m.times[path.concat([n]).join('/')] || now });
      });
      if (d.repo) entries.unshift({ dir: true, hidden: true });
      entries = entries.filter(function (e) { return !e.hidden; });
      if (!entries.length) return { lines: [] };
      listing(m, path, entries).forEach(function (l) { out.p(l); });
      return { lines: out.lines };
    }

    if (low === 'mkdir' || low === 'md' || low === 'new-item' || low === 'ni') {
      var names = rest.filter(function (a) { return a.charAt(0) !== '-'; });
      if (low === 'new-item' || low === 'ni') {
        var isDir = rest.some(function (a, i) { return a.toLowerCase() === '-itemtype' && /^dir/i.test(rest[i + 1] || ''); });
        names = names.filter(function (a) { return !/^(directory|file|dir)$/i.test(a); });
        if (!isDir) {
          if (!names.length) { out.note(tr('Simulátor: napiš název souboru, např. New-Item recept.md')); return { lines: out.lines }; }
          var fp = m.resolve(names[0]), fd = m.dirAt(fp.slice(0, -1)), fn = fp[fp.length - 1];
          if (!fd) { out.note(tr('Simulátor: taková složka neexistuje.')); return { lines: out.lines }; }
          if (fn in fd.files) {
            psError(out, line, 'New-Item : The file \'' + m.winPath(fp) + '\' already exists.', 'WriteError: (' + m.winPath(fp) + ':String) [New-Item], IOException', 'NewItemIOError,Microsoft.PowerShell.Commands.NewItemCommand');
            return { lines: out.lines };
          }
          fd.files[fn] = '';
          m.times[fp.join('/')] = now;
          listing(m, fp.slice(0, -1), [{ dir: false, name: fn, size: 0, time: now }]).forEach(function (l) { out.p(l); });
          return { lines: out.lines };
        }
      }
      if (!names.length) { out.note(tr('Simulátor: napiš název nové složky, např. mkdir git')); return { lines: out.lines }; }
      var p = m.resolve(names[0]), parent = m.dirAt(p.slice(0, -1)), name = p[p.length - 1];
      if (!parent) { out.note(tr('Simulátor: nadřazená složka neexistuje.')); return { lines: out.lines }; }
      if (parent.dirs[name] || (name in parent.files)) {
        psError(out, line, 'mkdir : An item with the specified name ' + m.winPath(p) + ' already exists.', 'ResourceExists: (' + m.winPath(p) + ':String) [New-Item], IOException', 'DirectoryExist,Microsoft.PowerShell.Commands.NewItemCommand');
        return { lines: out.lines };
      }
      if (/[\\\/:*?"<>|]/.test(name)) { out.note(tr('Simulátor: takový název složky Windows nedovolí.')); return { lines: out.lines }; }
      m.mkdirp(p);
      m.times[p.join('/')] = now;
      listing(m, p.slice(0, -1), [{ dir: true, name: name, time: now }]).forEach(function (l) { out.p(l); });
      return { lines: out.lines };
    }

    if (low === 'code' || low === 'code.cmd') {
      var targets = rest.filter(function (a) { return a.charAt(0) !== '-'; });
      if (!targets.length) return { lines: [], open: { folder: m.cwd.slice() } };
      var tp = m.resolve(targets[0]);
      if (m.dirAt(tp)) {
        if (targets[0] === '.' && rest.indexOf('-r') < 0) out.note(tr('Simulátor: ve škole používáme code -r . (otevře složku ve stejném okně).'));
        return { lines: out.lines, open: { folder: tp } };
      }
      var td = m.dirAt(tp.slice(0, -1));
      if (!td) { out.note(tr('Simulátor: taková složka neexistuje.')); return { lines: out.lines }; }
      return { lines: out.lines, open: { file: tp } };
    }

    if (low === 'cat' || low === 'type' || low === 'get-content' || low === 'gc') {
      if (!rest.length) { out.note(tr('Simulátor: napiš název souboru, např. cat palacinky.md')); return { lines: out.lines }; }
      var cp = m.resolve(rest[0]), cd2 = m.dirAt(cp.slice(0, -1)), cn = cp[cp.length - 1];
      if (!cd2 || !(cn in cd2.files)) {
        var cf = m.winPath(cp);
        psError(out, line, low + ' : Cannot find path \'' + cf + '\' because it does not exist.', 'ObjectNotFound: (' + cf + ':String) [Get-Content], ItemNotFoundException', 'PathNotFound,Microsoft.PowerShell.Commands.GetContentCommand');
        return { lines: out.lines };
      }
      var text = cd2.files[cn];
      if (text.length) text.replace(/\n$/, '').split('\n').forEach(function (l) { out.p(l); });
      return { lines: out.lines };
    }

    if (low === 'rm' || low === 'del' || low === 'remove-item' || low === 'ri' || low === 'erase') {
      var rn = rest.filter(function (a) { return a.charAt(0) !== '-'; });
      if (!rn.length) { out.note(tr('Simulátor: napiš, co smazat, např. rm poznamky.md')); return { lines: out.lines }; }
      var rp = m.resolve(rn[0]), rd = m.dirAt(rp.slice(0, -1)), rname = rp[rp.length - 1];
      if (rd && (rname in rd.files)) { delete rd.files[rname]; return { lines: [] }; }
      if (rd && rd.dirs[rname]) {
        out.note(tr('Simulátor: mazání celých složek simulátor nedělá, aby sis omylem nesmazal repozitář.'));
        return { lines: out.lines };
      }
      var rf = m.winPath(rp);
      psError(out, line, low + ' : Cannot find path \'' + rf + '\' because it does not exist.', 'ObjectNotFound: (' + rf + ':String) [Remove-Item], ItemNotFoundException', 'PathNotFound,Microsoft.PowerShell.Commands.RemoveItemCommand');
      return { lines: out.lines };
    }

    if (low === 'echo' || low === 'write-output' || low === 'write-host') {
      rest.forEach(function (a) { out.p(a); });
      return { lines: out.lines };
    }

    if (low === 'exit') { out.note(tr('Simulátor: terminál zůstane otevřený. Vyčistit ho můžeš příkazem cls.')); return { lines: out.lines }; }

    if (low === 'vim' || low === 'vi' || low === 'nano' || low === 'notepad') {
      out.note(tr('Simulátor: soubory upravuj v editoru (příkaz code soubor nebo klik na soubor v Průzkumníku).'));
      return { lines: out.lines };
    }

    psError(out, line, cmd + ' : The term \'' + cmd + '\' is not recognized as the name of a cmdlet, function, script file, or operable program. Check the spelling of the name, or if a path was included, verify that the path is correct and try again.',
      'ObjectNotFound: (' + cmd + ':String) [], CommandNotFoundException', 'CommandNotFoundException');
    if (/^git/i.test(cmd)) out.note(tr('Simulátor: za git patří mezera, např. git status'));
    else out.note(tr('Simulátor: takový příkaz neznám. Přehled příkazů ukáže help.'));
    return { lines: out.lines };
  }

  // doplňování tabulátorem: příkazy, podpříkazy gitu, soubory, složky, větve
  var SHELL_CMDS = ['cd', 'ls', 'dir', 'pwd', 'mkdir', 'code', 'cat', 'type', 'rm', 'cls', 'clear', 'git', 'help'];
  var GIT_CMDS = ['add', 'branch', 'clone', 'commit', 'config', 'diff', 'fetch', 'init', 'log', 'merge', 'pull', 'push', 'remote', 'restore', 'revert', 'rm', 'status', 'switch'];
  function complete(m, line) {
    var tk = tokenize(line);
    if (tk.error) return null;
    var args = tk.args, endsSpace = /\s$/.test(line) || line === '';
    var word = endsSpace ? '' : (args[args.length - 1] || '');
    var pos = endsSpace ? args.length : args.length - 1;
    var cands = [];
    if (pos === 0) cands = SHELL_CMDS;
    else if (args[0] === 'git' && pos === 1) cands = GIT_CMDS;
    else {
      var d = m.dir();
      if (d) {
        cands = Object.keys(d.dirs).concat(Object.keys(d.files));
        if (args[0] === 'git' && d.repo) cands = cands.concat(Object.keys(d.repo.branches)).concat(Object.keys(d.repo.remoteRefs));
      }
    }
    var hits = cands.filter(function (c) { return c.indexOf(word) === 0; }).sort();
    if (!hits.length) return null;
    var common = hits[0];
    hits.forEach(function (h) { while (h.indexOf(common) !== 0) common = common.slice(0, -1); });
    if (common.length <= word.length && hits.length > 1) return { options: hits };
    var completed = hits.length === 1 ? hits[0] + ((m.dir() && m.dir().dirs[hits[0]]) || pos < 2 ? ' ' : ' ') : common;
    return { line: line.slice(0, line.length - word.length) + completed };
  }

  root.GitShell = { run: run, tokenize: tokenize, complete: complete, HELP: HELP };
})(typeof window !== 'undefined' ? window : globalThis);
