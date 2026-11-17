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
 *  ui.js – rozhraní simulátoru
 * ===================================================================== */
(function () {
  'use strict';
  var I18N = window.GitI18n, tr = I18N.tr;
  var GW = window.GitWorld, GS = window.GitSim, SH = window.GitShell, MD = window.GitMarkdown, SC = window.GitScenarios,
    SS = window.GitSession, LANG = window.GitScenarioLang, STORE = window.GitStore;
  var esc = MD.esc;

  var app = null;
  var $ = function (id) { return document.getElementById(id); };

  function el(tag, attrs, html) {
    var e = document.createElement(tag), k;
    for (k in attrs || {}) {
      if (k === 'class') e.className = attrs[k];
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== null && attrs[k] !== undefined) e.setAttribute(k, attrs[k]);
    }
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  var CHECK = '<svg viewBox="0 0 16 16"><path d="M3 8.5l3 3 7-7" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var DOC = '<svg class="doc" viewBox="0 0 12 14"><path d="M1 1h7l3 3v9H1z" fill="#fff" stroke="currentColor"/><path d="M8 1v3h3" fill="none" stroke="currentColor"/></svg>';
  var PENCIL = '<svg width="14" height="14" viewBox="0 0 16 16"><path d="M11 2l3 3-8 8H3v-3z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';

  // ------------------------------------------------------------------
  //  Scénář: vytvoření světa (session.js)
  // ------------------------------------------------------------------
  function makeApp(scen) { return SS.create(scen); }

  function m() { return app.world.machines[app.active]; }
  function person(id) { return app.persons[id]; }

  // ------------------------------------------------------------------
  //  Kontrola úkolů
  // ------------------------------------------------------------------
  function evaluate() {
    var r = SS.evaluate(app);
    r.auto.forEach(showAuto);
    if (r.finishedNow) { confetti(); STORE.markDone(app.scen.id); showDone(); }
    return r.newly;
  }

  // tlačítko Kopírovat u adresy repozitáře (adresa se pak vloží do terminálu Ctrl+V)
  function copyBtn(text) { return '<button class="gbtn copy" type="button" data-copy="' + esc(text) + '">' + tr('Kopírovat') + '</button>'; }
  function bindCopy(box) {
    Array.prototype.forEach.call(box.querySelectorAll('[data-copy]'), function (b) {
      b.addEventListener('click', function () {
        var text = b.getAttribute('data-copy');
        function done() { toast(tr('Adresa je zkopírovaná. V terminálu ji vložíš Ctrl+V.')); }
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
          else fallback();
        } catch (e) { fallback(); }
        function fallback() {
          var ta = el('textarea', { style: 'position:fixed;left:-9999px' });
          ta.value = text; document.body.appendChild(ta); ta.select();
          try { document.execCommand('copy'); done(); } catch (e2) { /* nic */ }
          ta.remove();
        }
      });
    });
  }

  // co udělal simulátor za studenta (AUTO): do terminálu daného počítače, soubor i do otevřeného editoru
  function showAuto(ev) {
    var hasNote = ev.items.some(function (it) { return it.note !== undefined; });
    ev.items.forEach(function (it) {
      var t = app.term[it.id];
      if (!t) return;
      if (it.note !== undefined) {
        t.lines.push({ s: [[tr('Doplnil simulátor: {0}', it.note.replace(/[`*]/g, '')), 'n']], k: 'note' });
      } else if (it.cmd !== undefined) {
        t.lines.push({ s: [[it.prompt + ' ', 'prompt'], [it.cmd, 'auto'], ['   ' + tr('← simulátor'), 'n']] });
        t.lines = t.lines.concat(it.lines || []);
      } else if (it.file !== undefined) {
        var ide = app.ide[it.id];
        if (ide && ide.file === it.file && ide.folder && ide.folder.join('/') === it.folder.join('/') && !ide.dirty) ide.buffer = it.content;
        if (!hasNote) t.lines.push({ s: [[tr('Simulátor: do souboru {0} doplnil text – podívej se do editoru.', it.file), 'n']], k: 'note' });
      }
    });
  }

  // ------------------------------------------------------------------
  //  Vykreslení: úkoly
  // ------------------------------------------------------------------
  function renderTasks() {
    var box = $('tasks'), s = app.scen, tasks = s.tasks;
    var done = tasks.filter(function (t, i) { return app.done[i]; }).length;
    var current = -1;
    tasks.some(function (t, i) { if (!app.done[i]) { current = i; return true; } return false; });
    var html = '<div class="card-head"><span class="grow">' + esc(s.kicker) + ': ' + esc(s.title) + '</span>' +
      (tasks.length ? '<span class="sub">' + done + ' / ' + tasks.length + '</span>' : '') + '</div>';
    html += '<div class="intro">' + s.intro + '</div>';
    if (tasks.length) {
      html += '<div class="progress"><i style="width:' + Math.round(done / tasks.length * 100) + '%"></i></div>';
      html += '<ol class="task-list">';
      tasks.forEach(function (t, i) {
        var cls = 'task' + (app.done[i] ? ' done' : '') + (i === current ? ' current' : '');
        html += '<li class="' + cls + '" data-i="' + i + '"><span class="mark">' + CHECK + '</span><div class="ttext"><p>' + t.text + '</p></div>';
        if (t.question && (app.done[i] || i === current)) html += tr('<div class="q">Odpověz si: {0}</div>', esc(t.question));
        if (app.autoNotes && app.autoNotes[i]) html += '<div class="auto-note"><b>' + tr('Doplnil simulátor:') + '</b> ' + app.autoNotes[i].join(' ') + '</div>';
        if (t.hint && !app.done[i]) {
          var open = app.openHints && app.openHints[i];
          html += '<button class="hint-btn" type="button" data-hint="' + i + '">' + (open ? tr('Skrýt nápovědu') : tr('Nápověda')) + '</button>';
          if (open) html += '<div class="hint">' + t.hint + '</div>';
        }
        html += '</li>';
      });
      html += '</ol>';
      html += '<div class="done-banner' + (app.finished ? ' show' : '') + '">' + tr('<b>Hotovo!</b> Všechny úkoly jsou splněné. Vyber si další scénář nahoře, nebo pokračuj ve zkoušení.') + '</div>';
    } else {
      html += tr('<div class="intro"><p>V tomhle režimu nejsou úkoly. Graf a tři oblasti vpravo ukazují, co se děje.</p></div>');
    }
    box.innerHTML = html;
    box.querySelectorAll('[data-hint]').forEach(function (b) {
      b.addEventListener('click', function () {
        app.openHints = app.openHints || {};
        var i = +b.getAttribute('data-hint');
        app.openHints[i] = !app.openHints[i];
        renderTasks();
      });
    });
  }

  // ------------------------------------------------------------------
  //  Záložky počítačů
  // ------------------------------------------------------------------
  function renderMachines() {
    var box = $('machines');
    box.innerHTML = '';
    var multi = app.people.length > 1;
    app.people.forEach(function (id, idx) {
      var p = person(id);
      var pc = el('button', { class: 'mtab p' + idx + (app.active === id && app.view[id] === 'pc' ? ' active' : ''), type: 'button', role: 'tab' },
        '<span class="dot"></span>' + esc(multi ? p.label : tr('Počítač ({0})', p.name)));
      pc.addEventListener('click', function () { app.active = id; app.view[id] = 'pc'; renderAll(); focusTerm(); });
      box.appendChild(pc);
      if (app.github) {
        var inv = pendingInvites(p.login).length;
        var gh = el('button', { class: 'mtab github' + (app.active === id && app.view[id] === 'gh' ? ' active' : ''), type: 'button', role: 'tab' },
          '<span class="dot"></span>GitHub' + (multi ? ' (' + esc(p.name.split(' ')[0]) + ')' : '') + (inv ? ' <span class="badge">' + inv + '</span>' : ''));
        gh.addEventListener('click', function () { app.active = id; app.view[id] = 'gh'; renderAll(); });
        box.appendChild(gh);
      }
    });
  }

  // ------------------------------------------------------------------
  //  Pracovní plocha: VS Code + terminál (nebo GitHub)
  // ------------------------------------------------------------------
  function renderWorkspace() {
    var box = $('workspace');
    box.innerHTML = '';
    if (app.view[app.active] === 'gh') { box.appendChild(renderGitHub()); return; }
    box.appendChild(renderIDE());
    box.appendChild(renderTerminal());
  }

  // --- stav souborů pro Průzkumník (písmena jako ve VS Code)
  function fileStatus(machine, folder) {
    var d = machine.dirAt(folder), st = {};
    if (!d || !d.repo) return st;
    var saveCwd = machine.cwd;
    machine.cwd = folder;
    var info = GS.statusInfo(machine);
    machine.cwd = saveCwd;
    if (!info) return st;
    info.untracked.forEach(function (p) { st[p] = 'U'; });
    info.staged.forEach(function (e) { st[e.path] = e.type === 'new file' ? 'A' : e.type === 'deleted' ? 'D' : e.type === 'renamed' ? 'R' : 'M'; });
    info.unstaged.forEach(function (e) { if (e.type === 'modified') st[e.path] = (st[e.path] === 'A' ? 'A' : 'M'); else st[e.path] = 'D'; });
    info.unmerged.forEach(function (e) { st[e.path] = '!'; });
    var rules = GS.ignoreRules(d.files);
    Object.keys(d.files).forEach(function (p) { if (!st[p] && !d.repo.index[p] && GS.isIgnored(rules, p)) st[p] = 'I'; });
    return st;
  }

  function renderIDE() {
    var id = app.active, ide = app.ide[id], mm = m();
    var card = el('div', { class: 'card vscode' });
    card.appendChild(el('div', { class: 'card-head' }, '<span class="grow">Visual Studio Code</span><span class="sub">' +
      (ide.folder ? esc(mm.winPath(ide.folder)) : tr('žádná otevřená složka')) + '</span>'));
    var wrap = el('div', { class: 'ide' });
    // Průzkumník
    var ex = el('div', { class: 'explorer' });
    var folderDir = ide.folder ? mm.dirAt(ide.folder) : null;
    if (!ide.folder || !folderDir) {
      ex.innerHTML = tr('<div class="folder"><span class="grow">Průzkumník</span></div><div class="empty">Žádná složka není otevřená.<br>V terminálu přejdi do složky projektu a napiš <span class="cmd">code -r .</span></div>');
    } else {
      var head = el('div', { class: 'folder' }, '<span class="grow">' + esc(ide.folder[ide.folder.length - 1]) + '</span>');
      var nb = el('button', { class: 'icon-btn', type: 'button', title: tr('Nový soubor') }, '<svg width="14" height="14" viewBox="0 0 16 16"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.8"/></svg>');
      nb.addEventListener('click', function () { ide.creating = true; renderWorkspace(); var i = document.querySelector('.new-file input'); if (i) i.focus(); });
      head.appendChild(nb);
      ex.appendChild(head);
      if (ide.creating) {
        var nf = el('div', { class: 'new-file' });
        var inp = el('input', { type: 'text', placeholder: 'nazev.md', 'aria-label': tr('Název nového souboru') });
        inp.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') { createFile(inp.value.trim()); }
          if (e.key === 'Escape') { ide.creating = false; renderWorkspace(); }
        });
        inp.addEventListener('blur', function () { setTimeout(function () { if (ide.creating) { ide.creating = false; renderWorkspace(); } }, 150); });
        nf.appendChild(inp);
        ex.appendChild(nf);
      }
      var st = fileStatus(mm, ide.folder);
      var ul = el('ul');
      var names = Object.keys(folderDir.files).sort(function (x, y) { return x.toLowerCase() < y.toLowerCase() ? -1 : 1; });
      var dirs = Object.keys(folderDir.dirs).sort();
      dirs.forEach(function (n) {
        ul.appendChild(el('li', null, '<button type="button" disabled><span class="fname" style="color:#57606A">› ' + esc(n) + '</span></button>'));
      });
      names.forEach(function (n) {
        var s = st[n] || '';
        var li = el('li', { class: ide.file === n ? 'open' : '' });
        var b = el('button', { type: 'button', title: s === 'I' ? tr('Git tento soubor ignoruje') : '' },
          DOC.replace('class="doc"', 'class="doc" style="color:#57606A;width:12px;height:14px"') +
          '<span class="fname' + (s && s !== 'I' ? ' st-' + (s === '!' ? 'C' : s) : '') + '"' + (s === 'I' ? ' style="opacity:.55"' : '') + '>' + esc(n) + '</span>' +
          '<span class="st st-' + (s === '!' ? 'C' : s) + '">' + (s === 'I' ? '' : s) + '</span>');
        b.addEventListener('click', function () { openFile(n); });
        li.appendChild(b);
        ul.appendChild(li);
      });
      if (!names.length && !dirs.length && !ide.creating) ex.appendChild(el('div', { class: 'empty' }, tr('Složka je prázdná. Nový soubor vytvoříš tlačítkem <b>+</b>.')));
      ex.appendChild(ul);
    }
    wrap.appendChild(ex);
    // Editor
    var ed = el('div', { class: 'editor' });
    if (!ide.file) {
      ed.appendChild(el('div', { class: 'etabs' }));
      var body0 = el('div', { class: 'ebody' });
      body0.appendChild(el('div', { class: 'welcome' }, ide.folder ?
        tr('Klikni na soubor vlevo, nebo vytvoř nový tlačítkem <b>+</b>.<br>Soubor ulož <kbd>Ctrl</kbd>+<kbd>S</kbd>. Uložení ale není commit – Git si změnu zapamatuje až po <span class="cmd">git add</span> a <span class="cmd">git commit</span>.') :
        tr('Tady se otevřou soubory. Nejdřív otevři složku: <span class="cmd">code -r .</span>')));
      ed.appendChild(body0);
    } else {
      var exists = folderDir && (ide.file in folderDir.files);
      var tabs = el('div', { class: 'etabs' });
      var tab = el('div', { class: 'etab' }, esc(ide.file) + (exists ? '' : tr(' <i style="color:#CF222E">(smazáno)</i>')) + (ide.dirty ? tr('<span class="dirty" title="Neuloženo"></span>') : ''));
      var cl = el('button', { class: 'close', type: 'button', title: tr('Zavřít') }, '×');
      cl.addEventListener('click', closeFile);
      tab.appendChild(cl);
      tabs.appendChild(tab);
      var tools = el('div', { class: 'etools' });
      var pv = el('button', { class: 'ebtn', type: 'button', title: tr('Náhled Markdownu (Ctrl+Shift+V)') }, ide.preview ? tr('Bez náhledu') : tr('Náhled'));
      pv.addEventListener('click', function () { ide.preview = !ide.preview; renderWorkspace(); });
      var sv = el('button', { class: 'ebtn save', type: 'button', title: tr('Uložit soubor (Ctrl+S)') }, tr('Uložit'));
      sv.disabled = !ide.dirty && exists;
      sv.addEventListener('click', saveFile);
      tools.appendChild(pv); tools.appendChild(sv);
      tabs.appendChild(tools);
      ed.appendChild(tabs);
      var body = el('div', { class: 'ebody' + (ide.preview && /\.md$/i.test(ide.file) ? '' : ' nopreview') });
      var src = el('div', { class: 'src' });
      src.appendChild(el('div', { class: 'pane-title' }, tr('Napíšeš ({0})', /\.md$/i.test(ide.file) ? 'Markdown' : tr('text'))));
      var ta = el('textarea', { spellcheck: 'false', 'aria-label': tr('Obsah souboru {0}', ide.file) });
      ta.value = ide.buffer;
      ta.addEventListener('input', function () {
        ide.buffer = ta.value;
        if (!ide.dirty) { ide.dirty = true; renderWorkspaceKeepEditor(); }
        updatePreview();
      });
      ta.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) { e.preventDefault(); saveFile(); }
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'v' || e.key === 'V')) { e.preventDefault(); ide.preview = !ide.preview; renderWorkspace(); }
        if (e.key === 'Tab') { e.preventDefault(); var s = ta.selectionStart; ta.value = ta.value.slice(0, s) + '    ' + ta.value.slice(ta.selectionEnd); ta.selectionStart = ta.selectionEnd = s + 4; ta.dispatchEvent(new Event('input')); }
      });
      src.appendChild(ta);
      body.appendChild(src);
      if (ide.preview && /\.md$/i.test(ide.file)) {
        var prev = el('div', { class: 'prev' });
        prev.appendChild(el('div', { class: 'pane-title' }, tr('Uvidíš (náhled)')));
        var md = el('div', { class: 'md', id: 'mdPreview' }, MD.render(ide.buffer));
        md.addEventListener('click', function (e) {
          var a = e.target.closest('a[data-file]');
          if (a) { e.preventDefault(); var f = a.getAttribute('data-file'); if (folderDir && f in folderDir.files) openFile(f); else toast(tr('Soubor {0} ve složce není.', f)); }
        });
        prev.appendChild(md);
        body.appendChild(prev);
      }
      ed.appendChild(body);
    }
    wrap.appendChild(ed);
    card.appendChild(wrap);
    return card;
  }

  function renderWorkspaceKeepEditor() {
    // překreslí jen záhlaví editoru (tečka neuloženo, tlačítko Uložit), textarea zůstane
    var ide = app.ide[app.active], tab = document.querySelector('.etab');
    if (tab && !tab.querySelector('.dirty') && ide.dirty) tab.insertBefore(el('span', { class: 'dirty', title: tr('Neuloženo') }), tab.querySelector('.close'));
    var sv = document.querySelector('.ebtn.save');
    if (sv) sv.disabled = false;
  }
  function updatePreview() {
    var p = $('mdPreview');
    if (p) p.innerHTML = MD.render(app.ide[app.active].buffer);
  }

  function validName(n) { return n && !/[\\\/:*?"<>|]/.test(n) && n !== '.' && n !== '..'; }

  function createFile(name) {
    var ide = app.ide[app.active], d = m().dirAt(ide.folder);
    ide.creating = false;
    if (!name) { renderWorkspace(); return; }
    if (!validName(name)) { toast(tr('Takový název souboru Windows nedovolí.')); renderWorkspace(); return; }
    if (d.dirs[name] || name in d.files) { toast(tr('Soubor {0} už existuje.', name)); renderWorkspace(); return; }
    d.files[name] = '';
    m().times = m().times || {};
    m().times[ide.folder.concat([name]).join('/')] = app.world.now();
    ide.file = name; ide.buffer = ''; ide.dirty = false;
    afterChange();
    var ta = document.querySelector('.ebody textarea');
    if (ta) ta.focus();
  }
  function openFile(name, cb) {
    var ide = app.ide[app.active];
    if (ide.dirty && ide.file !== name) {
      askSave(function (res) { if (res === 'cancel') return; if (res === 'save') saveFile(); ide.dirty = false; openFile(name, cb); });
      return;
    }
    var d = m().dirAt(ide.folder);
    ide.file = name; ide.buffer = d && name in d.files ? d.files[name] : ''; ide.dirty = false;
    renderWorkspace();
    if (cb) cb();
  }
  function closeFile() {
    var ide = app.ide[app.active];
    if (ide.dirty) { askSave(function (res) { if (res === 'cancel') return; if (res === 'save') saveFile(); ide.dirty = false; ide.file = null; renderWorkspace(); }); return; }
    ide.file = null; renderWorkspace();
  }
  function saveFile() {
    var ide = app.ide[app.active], d = m().dirAt(ide.folder);
    if (!ide.file || !d) return;
    d.files[ide.file] = ide.buffer;
    m().times = m().times || {};
    m().times[ide.folder.concat([ide.file]).join('/')] = app.world.now();
    ide.dirty = false;
    afterChange();
  }
  // po změně souborů Gitem: neupravený otevřený soubor se načte znovu
  function syncEditors() {
    app.people.forEach(function (id) {
      var ide = app.ide[id], mm = app.world.machines[id];
      if (!ide.folder || !ide.file || ide.dirty) return;
      var d = mm.dirAt(ide.folder);
      if (d && ide.file in d.files) ide.buffer = d.files[ide.file];
    });
  }

  // ------------------------------------------------------------------
  //  Terminál
  // ------------------------------------------------------------------
  function segsHtml(segs) {
    return segs.map(function (x) { return x[1] ? '<span class="c-' + x[1] + '">' + esc(x[0]) + '</span>' : esc(x[0]); }).join('');
  }
  function renderTerminal() {
    var id = app.active, t = app.term[id], mm = m();
    var box = el('div', { class: 'terminal' });
    var head = el('div', { class: 'thead' }, tr('<span>Terminál (PowerShell)</span><span class="grow"></span>'));
    var clr = el('button', { type: 'button', title: tr('Vyčistit (cls)') }, tr('Vyčistit'));
    clr.addEventListener('click', function () { t.lines = []; renderWorkspace(); focusTerm(); });
    head.appendChild(clr);
    box.appendChild(head);
    var body = el('div', { class: 'tbody', id: 'tbody' });
    var html = '';
    t.lines.forEach(function (l) {
      var cls = 'ln' + (l.k === 'note' ? ' note' : '') + (l.k === 'progress' ? ' progress' : '');
      html += '<div class="' + cls + '">' + segsHtml(l.s) + '</div>';
    });
    body.innerHTML = html;
    if (t.wait) {
      body.appendChild(el('div', { class: 'ln waiting' }, esc(t.waitText || tr('Git čeká…'))));
    } else {
      var line = el('div', { class: 'inputline' });
      line.appendChild(el('span', { class: 'prompt' }, esc(mm.prompt()) + ' '));
      var inp = el('input', { type: 'text', id: 'termInput', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': tr('Příkazová řádka') });
      inp.value = t.draft || '';
      inp.addEventListener('keydown', termKey);
      inp.addEventListener('input', function () { t.draft = inp.value; });
      line.appendChild(inp);
      body.appendChild(line);
    }
    body.addEventListener('mouseup', function () { if (!window.getSelection().toString()) focusTerm(); });
    box.appendChild(body);
    setTimeout(function () { body.scrollTop = body.scrollHeight; }, 0);
    return box;
  }
  function focusTerm() { var i = $('termInput'); if (i) i.focus({ preventScroll: true }); }

  function termKey(e) {
    var t = app.term[app.active], inp = e.target;
    if (e.key === 'Enter') { e.preventDefault(); var v = inp.value; t.draft = ''; execute(v); return; }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!t.history.length) return;
      t.hpos = t.hpos < 0 ? t.history.length - 1 : Math.max(0, t.hpos - 1);
      inp.value = t.history[t.hpos]; t.draft = inp.value;
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (t.hpos < 0) return;
      t.hpos++;
      if (t.hpos >= t.history.length) { t.hpos = -1; inp.value = ''; } else inp.value = t.history[t.hpos];
      t.draft = inp.value;
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      var r = SH.complete(m(), inp.value);
      if (!r) return;
      if (r.line) { inp.value = r.line; t.draft = r.line; }
      else if (r.options) {
        t.lines.push({ s: [[m().prompt() + ' ', 'prompt'], [inp.value, 'typed']] });
        t.lines.push({ s: [[r.options.join('   '), '']] });
        var keep = inp.value; renderWorkspace(); var i2 = $('termInput'); if (i2) { i2.value = keep; t.draft = keep; } focusTerm();
      }
      return;
    }
    if (e.key === 'c' && e.ctrlKey && !inp.selectionEnd) {
      e.preventDefault();
      t.lines.push({ s: [[m().prompt() + ' ', 'prompt'], [inp.value + '^C', 'typed']] });
      t.draft = ''; renderWorkspace(); focusTerm();
    }
    if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); t.lines = []; renderWorkspace(); focusTerm(); }
  }

  function pushLines(id, lines) {
    var t = app.term[id];
    lines.forEach(function (l) { t.lines.push(l); });
    if (t.lines.length > 3000) t.lines = t.lines.slice(t.lines.length - 3000);
  }

  function execute(line) {
    var id = app.active, t = app.term[id], mm = m();
    t.lines.push({ s: [[mm.prompt() + ' ', 'prompt'], [line, 'typed']] });
    if (line.trim()) { t.history.push(line); }
    t.hpos = -1;
    var cwd = mm.cwd.slice();
    var r;
    try { r = SH.run(mm, line); }
    catch (err) {
      r = { lines: [{ s: [[tr('Simulátor: tady se něco pokazilo ({0}). Zkus scénář začít znovu.', err.message), 'n']], k: 'note' }] };
      if (window.console) console.error(err);
    }
    var entry = SS.logEntry(app, id, line, cwd);
    handleResult(id, r, entry);
  }

  function handleResult(id, r, entry) {
    var t = app.term[id];
    if (r.clear) t.lines = [];
    pushLines(id, r.lines || []);
    if (entry) entry.out = entry.out.concat(r.lines || []);
    if (r.open) {
      var res = SS.applyOpen(app, id, r.open);
      if (res.error === 'outside') { pushLines(id, [{ s: [[tr('Simulátor: soubor je mimo otevřenou složku. Otevři nejdřív jeho složku: code -r .'), 'n']], k: 'note' }]); finish(); return; }
      if (res.folderChanged) {
        t.lines = [];
        pushLines(id, [{ s: [[tr('(VS Code se přenačetl a terminál začíná znovu ve složce {0})', r.open.folder[r.open.folder.length - 1]), 'n']], k: 'note' }, { s: [] }]);
      }
    }
    if (r.wait) { startWait(id, r.wait, entry); }
    finish();
  }

  function finish() { syncEditors(); afterChange(); setTimeout(focusTerm, 0); }

  // ------------------------------------------------------------------
  //  Čekání na člověka: editor zprávy, přihlášení
  // ------------------------------------------------------------------
  function startWait(id, wait, entry) {
    var t = app.term[id], mm = app.world.machines[id];
    t.wait = wait;
    function done(res) {
      t.wait = null; t.waitText = null;
      handleResult(id, { lines: res.lines || [], wait: res.wait }, entry);
    }
    if (wait.type === 'editor') {
      var ed = mm.getConfig('core.editor', null) || '';
      if (/code/.test(ed)) {
        t.waitText = 'hint: Waiting for your editor to close the file...';
        editorDialog(wait, function (text) { done(wait.resume(text)); });
      } else {
        t.waitText = tr('(otevřel se Vim – výchozí editor Gitu)');
        vimDialog(wait, function (text) { done(wait.resume(text)); });
      }
    } else if (wait.type === 'signin') {
      t.waitText = tr('(Git Credential Manager čeká na přihlášení)');
      signinDialog(wait.login, function (ok) { done(wait.resume(ok)); });
    }
  }

  function overlay(dialog) {
    var o = el('div', { class: 'overlay' });
    o.appendChild(dialog);
    document.body.appendChild(o);
    return { close: function () { o.remove(); } };
  }

  function editorDialog(wait, cb) {
    var d = el('div', { class: 'dialog vsc', role: 'dialog', 'aria-modal': 'true', 'aria-label': wait.file });
    d.innerHTML = '<div class="dhead"><span class="grow">VS Code – ' + esc(wait.file) + '</span></div><div class="dbody"></div>';
    var ta = el('textarea', { spellcheck: 'false' });
    ta.value = wait.text;
    d.querySelector('.dbody').appendChild(ta);
    var tipText = wait.file === 'MERGE_MSG' ?
      tr('Git spojuje dvě linie historie a připravil zprávu pro <b>merge commit</b>. Nic neměň, jen záložku zavři.') :
      tr('Git čeká na <b>zprávu commitu</b>. Napiš ji na první řádek, ulož a zavři. Řádky s <code>#</code> Git vynechá; prázdná zpráva commit zruší.');
    d.querySelector('.dbody').appendChild(el('div', { class: 'tip' }, tipText));
    var foot = el('div', { class: 'dfoot' });
    var close = el('button', { class: 'dbtn', type: 'button' }, tr('Zavřít bez uložení'));
    var save = el('button', { class: 'dbtn primary', type: 'button' }, tr('Uložit a zavřít záložku'));
    foot.appendChild(close); foot.appendChild(save);
    d.appendChild(foot);
    var ov = overlay(d);
    close.addEventListener('click', function () { ov.close(); cb(wait.text); });
    save.addEventListener('click', function () { ov.close(); cb(ta.value); });
    ta.addEventListener('keydown', function (e) { if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) { e.preventDefault(); ov.close(); cb(ta.value); } });
    setTimeout(function () { ta.focus(); ta.setSelectionRange(0, 0); }, 0);
  }

  function vimDialog(wait, cb) {
    var d = el('div', { class: 'dialog vim', role: 'dialog', 'aria-modal': 'true' });
    d.innerHTML = '<div class="dhead"><span class="grow">Vim – .git/' + esc(wait.file) + '</span></div>';
    d.appendChild(el('div', { class: 'tip' }, tr('Tohle je <b>Vim</b>. Otevřel se, protože chybí nastavení <code>core.editor</code>. ') +
      tr('Zprávu napiš nahoru, pak do řádku dole napiš <b>:wq</b> a Enter (uložit a odejít). <b>:q!</b> odejde bez uložení.<br>') +
      tr('Příště: <code>git config --global core.editor "code --wait"</code>')));
    var ta = el('textarea', { spellcheck: 'false' });
    ta.value = wait.text;
    d.appendChild(ta);
    var line = el('div', { class: 'vimline' }, '<span>:</span>');
    var inp = el('input', { type: 'text', 'aria-label': tr('Příkaz Vimu') });
    line.appendChild(inp);
    d.appendChild(line);
    var ov = overlay(d);
    inp.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      var c = inp.value.replace(/^:/, '').trim();
      if (c === 'wq' || c === 'x' || c === 'wq!' || c === 'x!') { ov.close(); cb(ta.value); }
      else if (c === 'q!' || c === 'cq') { ov.close(); cb(wait.text); }
      else if (c === 'q') {
        if (ta.value !== wait.text) { inp.value = ''; inp.placeholder = 'E37: No write since last change (add ! to override)'; }
        else { ov.close(); cb(wait.text); }
      } else if (c === 'w') { inp.value = ''; inp.placeholder = tr('uloženo – teď :q'); wait.text = ta.value; }
      else { inp.value = ''; inp.placeholder = 'E492: Not an editor command: ' + c; }
    });
    setTimeout(function () { ta.focus(); ta.setSelectionRange(0, 0); }, 0);
  }

  function signinDialog(login, cb) {
    var d = el('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true', style: 'max-width:440px' });
    d.innerHTML = '<div class="dhead"><span class="grow">Git Credential Manager</span></div>' +
      '<div class="dbody gcm"><svg class="gcm-logo" viewBox="0 0 54 54"><rect width="54" height="54" rx="12" fill="#24292F"/><path d="M12 22h30" stroke="#fff" stroke-width="3"/><path d="M22 22c0 11 5 14 9 14s8-4 8-14" fill="none" stroke="#F05033" stroke-width="3"/><circle cx="12" cy="22" r="3.6" fill="#fff"/><circle cx="22" cy="22" r="3.6" fill="#fff"/><circle cx="42" cy="22" r="3.6" fill="#fff"/><circle cx="31" cy="36" r="3.6" fill="#F05033"/></svg>' +
      tr('<div class="big">Connect to GitHub</div><div class="muted" style="color:#57606A">Git potřebuje vědět, kdo jsi.</div>') +
      '<div class="stack"><button class="dbtn primary" type="button" data-a="browser">Sign in with your browser</button>' +
      '<button class="dbtn" type="button" data-a="token">Token</button><button class="dbtn" type="button" data-a="cancel">Cancel</button></div></div>';
    var ov = overlay(d);
    d.querySelector('[data-a=cancel]').addEventListener('click', function () { ov.close(); cb(false); });
    d.querySelector('[data-a=token]').addEventListener('click', function () {
      d.querySelector('.dbody').innerHTML = tr('<p>Záložní cesta: na GitHubu vytvoř <b>token (classic)</b> se scope <code>repo</code> (Settings → Developer settings → Personal access tokens) a vlož ho sem.</p>') +
        '<p><input type="text" style="width:100%;border:1px solid #D0D7DE;border-radius:6px;padding:6px" placeholder="ghp_..." aria-label="Token"></p>' +
        tr('<p class="muted" style="color:#57606A;font-size:13px">V simulátoru projde libovolný text.</p>');
      var f = el('div', { class: 'dfoot' });
      var ok = el('button', { class: 'dbtn green', type: 'button' }, 'Sign in');
      var cn = el('button', { class: 'dbtn', type: 'button' }, 'Cancel');
      f.appendChild(cn); f.appendChild(ok); d.appendChild(f);
      cn.addEventListener('click', function () { ov.close(); cb(false); });
      ok.addEventListener('click', function () { ov.close(); cb(true); });
    });
    d.querySelector('[data-a=browser]').addEventListener('click', function () {
      d.querySelector('.dhead .grow').textContent = tr('Prohlížeč – github.com');
      d.querySelector('.dbody').innerHTML = '<div style="text-align:center"><div class="big" style="font-size:18px;font-weight:700">Authorize Git Credential Manager</div>' +
        tr('<p>Přihlášen(a) jako <b>{0}</b>. Git Credential Manager žádá o přístup k tvým repozitářům.</p>', esc(login)) +
        tr('<p class="muted" style="color:#57606A;font-size:13px">Přihlášení se uloží do počítače. Na sdíleném počítači se proto po hodině odhlas.</p></div>');
      var f = el('div', { class: 'dfoot' });
      var ok = el('button', { class: 'dbtn green', type: 'button' }, 'Authorize git-ecosystem');
      var cn = el('button', { class: 'dbtn', type: 'button' }, 'Cancel');
      f.appendChild(cn); f.appendChild(ok); d.appendChild(f);
      cn.addEventListener('click', function () { ov.close(); cb(false); });
      ok.addEventListener('click', function () { ov.close(); toast(tr('Přihlášení proběhlo. Git pokračuje.')); cb(true); });
    });
  }

  function askSave(cb) {
    var d = el('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true', style: 'max-width:440px' });
    d.innerHTML = tr('<div class="dhead">Uložit změny v souboru?</div><div class="dbody">Soubor má neuložené změny. Bez uložení se ztratí.</div>');
    var f = el('div', { class: 'dfoot' });
    [['cancel', tr('Zrušit'), 'dbtn'], ['discard', tr('Neukládat'), 'dbtn'], ['save', tr('Uložit'), 'dbtn primary']].forEach(function (b) {
      var x = el('button', { class: b[2], type: 'button' }, b[1]);
      x.addEventListener('click', function () { ov.close(); cb(b[0]); });
      f.appendChild(x);
    });
    d.appendChild(f);
    var ov = overlay(d);
  }

  // ------------------------------------------------------------------
  //  GitHub v prohlížeči
  // ------------------------------------------------------------------
  function pendingInvites(login) {
    var out = [], k;
    for (k in app.world.remotes) {
      var r = app.world.remotes[k];
      (r.invites || []).forEach(function (i) { if (i === login) out.push(r); });
    }
    return out;
  }
  function reposOf(login) {
    var out = [], k;
    for (k in app.world.remotes) {
      var r = app.world.remotes[k];
      if (r.owner === login || r.collaborators.indexOf(login) >= 0) out.push(r);
    }
    return out.sort(function (a, b) { return a.key < b.key ? -1 : 1; });
  }
  function lastCommitFor(r, path) {
    var w = app.world, h = r.branches[r.defaultBranch], c;
    while (h) {
      c = w.commits[h];
      var mine = w.trees[c.tree][path] || null, par = c.parents[0] ? w.trees[w.commits[c.parents[0]].tree][path] || null : null;
      if (mine !== par) return c;
      h = c.parents[0];
    }
    return null;
  }

  function renderGitHub() {
    var id = app.active, p = person(id), st = app.gh[id], w = app.world;
    var card = el('div', { class: 'card gh' });
    var url = 'github.com';
    var r = st.repo ? w.remotes[st.repo] : null;
    if (r) url += '/' + r.owner + '/' + r.name + (st.page === 'file' || st.page === 'edit' ? '/blob/main/' + st.file : st.page === 'commits' ? '/commits/main' : st.page === 'settings' ? '/settings/access' : '');
    else if (st.page === 'new') url += '/new';
    var bar = el('div', { class: 'bar' }, '<svg width="20" height="20" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="none" stroke="#fff" stroke-width="1.4"/><path d="M5 8h6M8 5v6" stroke="#fff" stroke-width="1.4"/></svg>' +
      '<span class="url">https://' + esc(url) + '</span><span class="who">' + esc(p.login) + '</span>');
    card.appendChild(bar);
    var page = el('div', { class: 'page' });
    card.appendChild(page);
    function go(s) { app.gh[id] = s; renderAll(); }

    if (st.page === 'new') {
      page.innerHTML = '<h4>Create a new repository</h4><form>' +
        '<label for="nr-name">Repository name</label><input type="text" id="nr-name" value="" autocomplete="off">' +
        '<label>Visibility</label>' +
        tr('<label class="radio"><input type="radio" name="vis" value="public"> <span>Public<small>Repozitář uvidí kdokoliv na internetu.</small></span></label>') +
        tr('<label class="radio"><input type="radio" name="vis" value="private" checked> <span>Private<small>Uvidíš ho jen ty a lidé, které pozveš.</small></span></label>') +
        '<label>Initialize this repository with:</label>' +
        tr('<label class="radio"><input type="checkbox" id="nr-readme"> <span>Add a README file<small>Repozitář nebude prázdný a půjde rovnou naklonovat.</small></span></label>') +
        '<p><button class="gbtn green" type="submit">Create repository</button> <button class="gbtn" type="button" id="nr-cancel">Cancel</button></p></form>';
      page.querySelector('#nr-cancel').addEventListener('click', function () { go({ page: 'home' }); });
      page.querySelector('form').addEventListener('submit', function (e) {
        e.preventDefault();
        var name = page.querySelector('#nr-name').value.trim().replace(/\s+/g, '-');
        if (!/^[A-Za-z0-9._-]+$/.test(name)) { toast(tr('Název repozitáře smí mít jen písmena bez diakritiky, číslice, - _ a tečku.')); return; }
        var vis = page.querySelector('input[name=vis]:checked').value;
        var readme = page.querySelector('#nr-readme').checked;
        var created = w.createRemote(p.login, name, { private: vis === 'private', readme: readme });
        if (!created) { toast(tr('Repozitář {0} už máš.', name)); return; }
        created.invites = [];
        go({ page: 'repo', repo: created.key });
        afterChange();
      });
      setTimeout(function () { var i = page.querySelector('#nr-name'); if (i) i.focus(); }, 0);
      return card;
    }

    if (!r) {
      var inv = pendingInvites(p.login), html = '';
      inv.forEach(function (ri) {
        html += '<div class="invite"><span>' + tr('<b>{0}</b> tě zve ke spolupráci na <b>{1}</b>.', esc(ri.owner), esc(ri.owner + '/' + ri.name)) + '</span> <button class="gbtn green" type="button" data-acc="' + esc(ri.key) + '">Accept invitation</button></div>';
      });
      html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><h4 style="margin:0;flex:1">Repositories</h4><button class="gbtn green" type="button" id="gh-new">New</button></div>';
      var list = reposOf(p.login);
      if (!list.length) html += tr('<p class="muted">Zatím tu nemáš žádný repozitář.</p>');
      else {
        html += '<div class="box">';
        list.forEach(function (ri) { html += '<div class="frow"><button class="link" type="button" data-repo="' + esc(ri.key) + '">' + esc(ri.owner + '/' + ri.name) + '</button><span class="vis">' + (ri.private ? 'Private' : 'Public') + '</span></div>'; });
        html += '</div>';
      }
      page.innerHTML = html;
      page.querySelector('#gh-new').addEventListener('click', function () { go({ page: 'new' }); });
      page.querySelectorAll('[data-repo]').forEach(function (b) { b.addEventListener('click', function () { go({ page: 'repo', repo: b.getAttribute('data-repo') }); }); });
      page.querySelectorAll('[data-acc]').forEach(function (b) {
        b.addEventListener('click', function () {
          var ri = w.remotes[b.getAttribute('data-acc')];
          ri.invites = ri.invites.filter(function (x) { return x !== p.login; });
          if (ri.collaborators.indexOf(p.login) < 0) ri.collaborators.push(p.login);
          toast(tr('Pozvánka přijata. Teď můžeš do {0} pushovat.', ri.name));
          go({ page: 'repo', repo: ri.key });
          afterChange();
        });
      });
      return card;
    }

    var canWrite = w.canWrite(r, p.login), head = r.branches[r.defaultBranch] || null;
    var title = '<div class="repo-title"><button class="gbtn" type="button" id="gh-home">←</button> <a href="#" id="gh-repo">' + esc(r.owner) + ' / <b>' + esc(r.name) + '</b></a><span class="vis">' + (r.private ? 'Private' : 'Public') + '</span>' +
      (r.owner === p.login ? '<span style="flex:1"></span><button class="gbtn" type="button" id="gh-settings">Settings</button>' : '') + '</div>';

    if (st.page === 'settings') {
      var html2 = title + '<h4>Collaborators</h4><div class="box">';
      if (!r.collaborators.length && !(r.invites || []).length) html2 += tr('<div class="frow muted">Zatím nikoho nemáš.</div>');
      r.collaborators.forEach(function (c) { html2 += '<div class="frow">' + esc(c) + '<span class="msg">Collaborator</span></div>'; });
      (r.invites || []).forEach(function (c) { html2 += '<div class="frow">' + esc(c) + '<span class="msg">Pending invite</span></div>'; });
      html2 += tr('</div><form style="margin-top:10px"><label for="ad-name">Add people</label><div style="display:flex;gap:6px"><input type="text" id="ad-name" placeholder="uživatelské jméno"><button class="gbtn green" type="submit">Add</button></div></form>');
      page.innerHTML = html2;
      page.querySelector('form').addEventListener('submit', function (e) {
        e.preventDefault();
        var who = page.querySelector('#ad-name').value.trim();
        if (!w.accounts[who]) { toast(tr('Uživatel {0} na GitHubu není.', who)); return; }
        if (who === r.owner) { toast(tr('Vlastníka zvát nemusíš.')); return; }
        if (r.collaborators.indexOf(who) >= 0 || r.invites.indexOf(who) >= 0) { toast(tr('{0} už pozvánku má.', who)); return; }
        r.invites.push(who);
        toast(tr('Pozvánka odeslána. {0} ji musí přijmout.', who));
        renderAll();
      });
    } else if (st.page === 'commits') {
      var html3 = tr('{0}<div class="box"><div class="bhead"><span class="grow">Commits na větvi {1}</span></div>', title, esc(r.defaultBranch)), h = head;
      var order = window.GitGraph.topoOrder(w, Object.keys(w.ancestors(h)).sort(function (a, b) { return w.commits[b].committer.time - w.commits[a].committer.time || w.commits[b].seq - w.commits[a].seq; }));
      order.forEach(function (x) {
        var c = w.commits[x];
        html3 += '<div class="frow"><span style="flex:1">' + esc(GS.subject(c.message)) + '<br><span class="muted">' + esc(c.author.name) + '</span></span><code>' + x.slice(0, 7) + '</code></div>';
      });
      page.innerHTML = html3 + '</div>';
    } else if (st.page === 'file' || st.page === 'edit') {
      var tree = w.treeOf(head), content = tree[st.file] ? w.blobs[tree[st.file]] : '';
      var html4 = title + '<div class="crumbs"><button type="button" id="gh-back">' + esc(r.name) + '</button> / <b>' + esc(st.file) + '</b></div>';
      if (st.page === 'file') {
        html4 += '<div class="box"><div class="bhead"><span class="grow">' + esc(st.file) + '</span>' + (canWrite ? '<button class="gbtn" type="button" id="gh-edit" title="Edit this file">' + PENCIL + '</button>' : '') + '</div>';
        html4 += /\.md$/i.test(st.file) ? '<div class="md" style="padding:6px 14px">' + MD.render(content) + '</div>' : '<pre style="margin:0;padding:10px">' + esc(content) + '</pre>';
        html4 += '</div>';
        page.innerHTML = html4;
        if (canWrite) page.querySelector('#gh-edit').addEventListener('click', function () { go({ page: 'edit', repo: r.key, file: st.file }); });
      } else {
        html4 += '<form><textarea class="fileedit" id="gh-text"></textarea><p style="display:flex;gap:6px"><button class="gbtn" type="button" id="gh-cancel">Cancel changes</button><span style="flex:1"></span><button class="gbtn green" type="submit">Commit changes...</button></p></form>';
        page.innerHTML = html4;
        var gt = page.querySelector('#gh-text');
        gt.value = st.draft !== undefined ? st.draft : content;
        gt.addEventListener('input', function () { st.draft = gt.value; });
        page.querySelector('#gh-cancel').addEventListener('click', function () { go({ page: 'file', repo: r.key, file: st.file }); });
        page.querySelector('form').addEventListener('submit', function (e) {
          e.preventDefault();
          commitDialog(st.file, function (msg) {
            var files = {}; files[st.file] = gt.value.replace(/\r/g, '');
            if (gt.value === content) { toast(tr('Soubor se nezměnil – není co commitnout.')); return; }
            w.webCommit(r, p.login, files, msg);
            go({ page: 'file', repo: r.key, file: st.file });
            afterChange();
          });
        });
      }
      page.querySelector('#gh-back').addEventListener('click', function () { go({ page: 'repo', repo: r.key }); });
    } else {
      var html5 = title;
      if (!head) {
        html5 += '<div class="box"><div class="bhead">Quick setup</div><div style="padding:10px;font-size:13.5px">' +
          '<p style="margin:0 0 6px">' + tr('HTTPS adresa:') + ' <code>' + esc(r.url) + '</code> ' + copyBtn(r.url) + '</p>' +
          '<p style="margin:10px 0 4px"><b>…or push an existing repository from the command line</b></p>' +
          '<pre style="background:#F6F8FA;border:1px solid #D0D7DE;border-radius:6px;padding:8px;margin:0;white-space:pre-wrap">git remote add origin ' + esc(r.url) + '\ngit branch -M main\ngit push -u origin main</pre></div></div>';
      } else {
        var tree2 = w.treeOf(head), last = w.commits[head], count = Object.keys(w.ancestors(head)).length;
        html5 += '<div class="box"><div class="bhead"><span class="grow"><b>' + esc(last.author.name) + '</b> ' + esc(GS.subject(last.message)) + '</span><code>' + head.slice(0, 7) + '</code> <button class="link gbtn" type="button" id="gh-commits">' +
          '<svg width="13" height="13" viewBox="0 0 16 16" style="vertical-align:-2px"><circle cx="8" cy="8" r="6.3" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 4.5V8l2.5 1.5" fill="none" stroke="currentColor" stroke-width="1.5"/></svg> ' + count + ' Commit' + (count === 1 ? '' : 's') + '</button></div>';
        GW.sortedKeys(tree2).forEach(function (f) {
          var lc = lastCommitFor(r, f);
          html5 += '<div class="frow">' + DOC + '<button class="link" type="button" data-f="' + esc(f) + '">' + esc(f) + '</button><span class="msg">' + esc(lc ? GS.subject(lc.message) : '') + '</span></div>';
        });
        html5 += '</div>';
        var readme = Object.keys(tree2).filter(function (f) { return /^readme\.md$/i.test(f); })[0];
        if (readme) html5 += '<div class="box readme"><div class="bhead">README</div><div class="md">' + MD.render(w.blobs[tree2[readme]]) + '</div></div>';
        html5 += '<p class="muted" style="margin-top:10px">' + tr('Naklonovat:') + ' <code>' + esc(r.url) + '</code> ' + copyBtn(r.url) + '</p>';
      }
      page.innerHTML = html5;
      bindCopy(page);
      page.querySelectorAll('[data-f]').forEach(function (b) { b.addEventListener('click', function () { go({ page: 'file', repo: r.key, file: b.getAttribute('data-f') }); }); });
      var cb = page.querySelector('#gh-commits');
      if (cb) cb.addEventListener('click', function () { go({ page: 'commits', repo: r.key }); });
    }
    var hb = page.querySelector('#gh-home');
    if (hb) hb.addEventListener('click', function () { go({ page: 'home' }); });
    var rp = page.querySelector('#gh-repo');
    if (rp) rp.addEventListener('click', function (e) { e.preventDefault(); go({ page: 'repo', repo: r.key }); });
    var sb = page.querySelector('#gh-settings');
    if (sb) sb.addEventListener('click', function () { go({ page: 'settings', repo: r.key }); });
    return card;
  }

  function commitDialog(file, cb) {
    var d = el('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true', style: 'max-width:480px' });
    d.innerHTML = '<div class="dhead">Commit changes</div><div class="dbody"><label style="font-weight:600;font-size:13.5px" for="cm-msg">Commit message</label>' +
      '<input type="text" id="cm-msg" style="width:100%;border:1px solid #D0D7DE;border-radius:6px;padding:6px 8px;margin-top:4px"></div>';
    var f = el('div', { class: 'dfoot' });
    var cn = el('button', { class: 'dbtn', type: 'button' }, 'Cancel');
    var ok = el('button', { class: 'dbtn green', type: 'button' }, 'Commit changes');
    f.appendChild(cn); f.appendChild(ok); d.appendChild(f);
    var ov = overlay(d);
    var inp = d.querySelector('#cm-msg');
    inp.value = 'Update ' + file;
    cn.addEventListener('click', function () { ov.close(); });
    function go() { var v = inp.value.trim() || ('Update ' + file); ov.close(); cb(v); }
    ok.addEventListener('click', go);
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
    setTimeout(function () { inp.focus(); inp.select(); }, 0);
  }

  // ------------------------------------------------------------------
  //  Pravý sloupec: tři oblasti, graf, GitHub
  // ------------------------------------------------------------------
  function currentRepoDir() {
    var mm = m(), d = mm.dir();
    if (d && d.repo) return { dir: d, path: mm.cwd };
    var f = app.ide[app.active].folder, fd = f && mm.dirAt(f);
    if (fd && fd.repo) return { dir: fd, path: f };
    return null;
  }

  function renderViz() {
    var box = $('vizCol');
    box.innerHTML = '';
    var cur = currentRepoDir(), mm = m();
    // tři oblasti
    var card = el('div', { class: 'card' });
    card.appendChild(el('div', { class: 'card-head' }, tr('<span class="grow">Kde je která verze</span><span class="sub">') + (cur ? esc(cur.path[cur.path.length - 1]) : '') + '</span>'));
    if (!cur) {
      card.appendChild(el('div', { class: 'graph-empty' }, tr('Tady uvidíš pracovní složku, přípravnou oblast a repozitář, jakmile budeš ve složce s repozitářem (<span class="cmd">git init</span> nebo <span class="cmd">git clone</span>).')));
    } else card.appendChild(renderAreas(cur));
    box.appendChild(card);
    // graf
    var g = el('div', { class: 'card' });
    var repo = cur && cur.dir.repo;
    g.appendChild(el('div', { class: 'card-head' }, tr('<span class="grow">Historie (graf commitů)</span><span class="sub">{0}</span>', esc(person(app.active).label))));
    if (!repo || !repo.headHash() && !Object.keys(repo.remoteRefs).length) {
      g.appendChild(el('div', { class: 'graph-empty' }, repo ? tr('Zatím žádný commit. První vznikne příkazem <span class="cmd">git commit</span>.') : tr('Žádný repozitář.')));
    } else {
      var refs = [];
      if (repo.headHash()) refs.push({ name: repo.head, hash: repo.headHash(), kind: 'head' });
      GW.sortedKeys(repo.branches).forEach(function (b) { if (b !== repo.head) refs.push({ name: b, hash: repo.branches[b], kind: 'branch' }); });
      GW.sortedKeys(repo.remoteRefs).forEach(function (rr) { refs.push({ name: rr, hash: repo.remoteRefs[rr], kind: 'remote' }); });
      g.appendChild(drawGraph(refs, 'local'));
    }
    box.appendChild(g);
    // GitHub
    if (repo && repo.remotes.length) {
      var url = repo.remoteUrl('origin') || repo.remotes[0].url, rem = app.world.findRemote(url);
      var ghc = el('div', { class: 'card' });
      ghc.appendChild(el('div', { class: 'card-head' }, '<span class="grow">GitHub</span><span class="sub">' + esc(url.replace(/^https:\/\//, '')) + '</span>'));
      if (!rem) ghc.appendChild(el('div', { class: 'graph-empty' }, tr('Na téhle adrese zatím žádný repozitář není.')));
      else if (!Object.keys(rem.branches).length) ghc.appendChild(el('div', { class: 'graph-empty' }, tr('Repozitář na GitHubu je prázdný. Pošli do něj commity: <span class="cmd">git push -u origin main</span>')));
      else {
        var rrefs = GW.sortedKeys(rem.branches).map(function (b) { return { name: b, hash: rem.branches[b], kind: b === rem.defaultBranch ? 'head-remote' : 'branch' }; });
        ghc.appendChild(drawGraph(rrefs, 'remote', repo));
      }
      box.appendChild(ghc);
    }
  }

  function renderAreas(cur) {
    var w = app.world, d = cur.dir, repo = d.repo, W = d.files, I = repo.index, Hh = repo.headHash(), H = w.treeOf(Hh);
    var conf = repo.conflicts || {};
    var rules = GS.ignoreRules(W);
    var wrap = el('div');
    var areas = el('div', { class: 'areas' });
    function card(name, tag, tagCls, cls, key, title) {
      var stateKey = cur.path.join('/') + '|' + key + '|' + name;
      var sig = tag + '|' + (tagCls || '');
      var flash = app.cardState[stateKey] !== undefined && app.cardState[stateKey] !== sig;
      app.nextCardState[stateKey] = sig;
      return '<div class="fcard ' + (cls || '') + (flash ? ' flash' : '') + '" title="' + esc(title || '') + '">' + DOC + '<span class="n">' + esc(name) + '</span>' + (tag ? '<span class="tag ' + tagCls + '">' + tag + '</span>' : '') + '</div>';
    }
    var hW = {}, p;
    for (p in W) hW[p] = w.hashBlob(W[p]);
    // pracovní složka
    var wd = '', all = {};
    for (p in W) all[p] = 1;
    for (p in I) all[p] = 1;
    for (p in conf) all[p] = 1;
    GW.sortedKeys(all).forEach(function (p) {
      if (conf[p]) { wd += card(p, 'konflikt', 'conflict', 'changed', 'wd', tr('Soubor je v konfliktu. Vyřeš ho a pak git add.')); return; }
      if (!(p in W)) { wd += card(p, tr('smazaný'), 'deleted', 'changed', 'wd', tr('Soubor je v přípravné oblasti, ale v pracovní složce chybí.')); return; }
      if (!I[p]) {
        if (GS.isIgnored(rules, p)) wd += card(p, tr('ignorovaný'), 'ignored', 'same', 'wd', tr('Soubor je v .gitignore – Git si ho nevšímá.'));
        else wd += card(p, tr('nesledovaný'), 'untracked', 'changed', 'wd', tr('Git tenhle soubor zatím nesleduje. Přidej ho: git add'));
        return;
      }
      if (hW[p] !== I[p]) wd += card(p, tr('změněný'), 'modified', 'changed', 'wd', tr('Změna, která ještě není v přípravné oblasti (git add).'));
      else wd += card(p, '', '', 'same', 'wd', tr('Stejné jako v přípravné oblasti.'));
    });
    // přípravná oblast
    var st = '', alls = {};
    for (p in I) alls[p] = 1;
    for (p in H) alls[p] = 1;
    for (p in conf) alls[p] = 1;
    GW.sortedKeys(alls).forEach(function (p) {
      if (conf[p]) { st += card(p, 'konflikt', 'conflict', 'changed', 'st', tr('Git čeká, až konflikt vyřešíš (git add).')); return; }
      if (!I[p]) { st += card(p, tr('smazání'), 'deleted', 'changed', 'st', tr('Příští commit soubor smaže.')); return; }
      if (!H[p]) st += card(p, tr('nový'), 'new', 'changed', 'st', tr('Příští commit soubor přidá.'));
      else if (H[p] !== I[p]) st += card(p, tr('změněný'), 'modified', 'changed', 'st', tr('Příští commit uloží tuhle verzi.'));
      else st += card(p, '', '', 'same', 'st', tr('Stejné jako v posledním commitu.'));
    });
    // repozitář
    var re = '';
    GW.sortedKeys(H).forEach(function (p) { re += card(p, '', '', 'same', 're', tr('Verze uložená v posledním commitu.')); });
    var head = Hh ? '<div class="en" style="font-style:normal"><code>' + Hh.slice(0, 7) + '</code> ' + esc(repo.head) + '</div>' : tr('<div class="en">zatím žádný commit</div>');
    var arrow = function (label) { return '<div class="arrow"><svg viewBox="0 0 30 18"><path d="M2 9h22" stroke="#57606A" stroke-width="2"/><path d="M20 4l7 5-7 5" fill="#57606A"/></svg><span>' + label + '</span></div>'; };
    areas.innerHTML =
      tr('<div class="area wd"><h3>Pracovní složka</h3><div class="en">working directory</div><div class="files">') + (wd || tr('<div class="none">prázdná</div>')) + '</div></div>' +
      arrow('git add') +
      tr('<div class="area st"><h3>Přípravná oblast</h3><div class="en">staging area</div><div class="files">') + (st || tr('<div class="none">prázdná</div>')) + '</div></div>' +
      arrow('git commit') +
      tr('<div class="area re"><h3>Repozitář</h3>{0}<div class="files">', head) + (re || '<div class="none">–</div>') + '</div></div>';
    wrap.appendChild(areas);
    var dirtyFiles = app.people.filter(function (id) { return app.ide[id].dirty; }).length;
    if (app.ide[app.active].dirty) wrap.appendChild(el('div', { class: 'areas-note' }, tr('Soubor <b>{0}</b> má neuložené změny v editoru – Git je zatím nevidí. Ulož ho (<kbd>Ctrl</kbd>+<kbd>S</kbd>).', esc(app.ide[app.active].file))));
    return wrap;
  }

  // --- graf: rozložení do pruhů, nejnovější vpravo, šipky k předchůdci
  function drawGraph(refs, kind, localRepo) {
    var w = app.world, all = {}, hashes = [];
    refs.forEach(function (r) { var a = w.ancestors(r.hash), k; for (k in a) all[k] = 1; });
    hashes = Object.keys(all).sort(function (a, b) { return w.commits[a].seq - w.commits[b].seq; });
    var lane = {}, nextLane = 0;
    function walk(h) {
      var l = null;
      while (h && lane[h] === undefined) {
        if (l === null) l = nextLane++;
        lane[h] = l;
        h = w.commits[h].parents[0];
      }
    }
    refs.forEach(function (r) { walk(r.hash); });
    hashes.slice().reverse().forEach(function (h) { w.commits[h].parents.forEach(function (p) { walk(p); }); });
    var DX = 96, DY = 78, X0 = 44, Y0 = 70, R = 23;
    var maxLane = 0; hashes.forEach(function (h) { if (lane[h] > maxLane) maxLane = lane[h]; });
    var pos = {};
    hashes.forEach(function (h, i) { pos[h] = { x: X0 + i * DX, y: Y0 + lane[h] * DY }; });
    var labels = {};
    refs.forEach(function (r) { (labels[r.hash] = labels[r.hash] || []).push(r); });
    var width = X0 * 2 + 30 + Math.max(0, hashes.length - 1) * DX, height = Y0 + maxLane * DY + 46;
    var seenKey = kind + ':';
    var svg = '<svg width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="' + tr('Graf commitů') + '">';
    svg += '<defs><marker id="arr-' + kind + '" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#8C959F"/></marker></defs>';
    hashes.forEach(function (h) {
      var c = w.commits[h], a = pos[h];
      c.parents.forEach(function (p, pi) {
        var b = pos[p];
        if (!b) return;
        var cls = 'g-edge lane' + Math.min(3, Math.max(lane[h], lane[p]));
        var x1 = a.x - R, y1 = a.y, x2 = b.x + R, y2 = b.y;
        if (a.y === b.y) svg += '<path class="' + cls + '" d="M' + x1 + ' ' + y1 + ' L' + (x2 + 2) + ' ' + y2 + '" marker-end="url(#arr-' + kind + ')"/>';
        else {
          var mx = (x1 + x2) / 2;
          svg += '<path class="' + cls + '" d="M' + x1 + ' ' + y1 + ' C' + mx + ' ' + y1 + ', ' + mx + ' ' + y2 + ', ' + (x2 + 2) + ' ' + y2 + '" marker-end="url(#arr-' + kind + ')"/>';
        }
      });
    });
    hashes.forEach(function (h) {
      var c = w.commits[h], a = pos[h], isNew = app.seen && !app.seen[seenKey + h];
      app.nextSeen[seenKey + h] = true;
      var remoteOnly = kind === 'local' && localRepo === undefined && false;
      var cls = 'g-commit lane' + Math.min(3, lane[h]) + (c.parents.length > 1 ? ' merge' : '') + (isNew ? ' new' : '');
      var msg = GS.subject(c.message);
      var short = msg.length > 15 ? msg.slice(0, 14) + '…' : msg;
      svg += '<g class="' + cls + '"><title>' + esc(h.slice(0, 7) + ' ' + msg + '\n' + c.author.name + ', ' + GS.fmtDate(c.author)) + '</title>' +
        '<circle cx="' + a.x + '" cy="' + a.y + '" r="' + R + '"/><text class="h" x="' + a.x + '" y="' + a.y + '">' + h.slice(0, 7) + '</text>' +
        '<text class="m" x="' + a.x + '" y="' + (a.y + R + 14) + '">' + esc(short) + '</text></g>';
    });
    // štítky větví nad commity
    var below = 0;
    Object.keys(labels).forEach(function (h) {
      // štítky u hlavní linie nad commitem, u vedlejších větví pod popiskem (nepřekrývají čáry)
      var a = pos[h], list = labels[h].slice(), under = lane[h] > 0, y = under ? a.y + R + 32 : a.y - R - 14;
      list.sort(function (x, y2) { var o = { head: 0, 'head-remote': 0, branch: 1, remote: 2 }; return o[x.kind] - o[y2.kind]; });
      list.forEach(function (r) {
        var items = [];
        if (r.kind === 'head') { items.push({ t: r.name, c: r.name === 'main' || r.name === 'master' ? 'main' : 'branch' }); items.push({ t: 'HEAD', c: 'head' }); }
        else if (r.kind === 'head-remote') items.push({ t: r.name, c: 'main' });
        else if (r.kind === 'remote') items.push({ t: r.name, c: 'remote' });
        else items.push({ t: r.name, c: r.name === 'main' || r.name === 'master' ? 'main' : 'branch' });
        var widths = items.map(function (it) { return it.t.length * 7 + 12; });
        var total = widths.reduce(function (s, x) { return s + x; }, 0) + (items.length - 1) * 4;
        var x = a.x - total / 2;
        items.forEach(function (it, k) {
          svg += '<g class="g-label ' + it.c + '"><rect x="' + x + '" y="' + (y - 9) + '" width="' + widths[k] + '" height="18"/><text x="' + (x + widths[k] / 2) + '" y="' + y + '">' + esc(it.t) + '</text></g>';
          x += widths[k] + 4;
        });
        y += under ? 22 : -22;
      });
      if (under) below = Math.max(below, list.length * 22 + 6);
    });
    svg += '</svg>';
    var need = 0;
    Object.keys(labels).forEach(function (h) { if (lane[h] === 0) need = Math.max(need, labels[h].length); });
    var wrap = el('div', { class: 'graph-wrap' });
    wrap.innerHTML = svg;
    var s = wrap.querySelector('svg');
    var extra = need > 1 ? (need - 1) * 22 : 0;
    if (extra || below) {
      s.setAttribute('height', height + extra + below);
      s.setAttribute('viewBox', '0 ' + (-extra) + ' ' + width + ' ' + (height + extra + below));
    }
    setTimeout(function () { wrap.scrollLeft = wrap.scrollWidth; }, 0);
    return wrap;
  }

  // ------------------------------------------------------------------
  //  Hlavní vykreslení
  // ------------------------------------------------------------------
  function renderAll() {
    app.nextSeen = {};
    app.nextCardState = {};
    renderTasks();
    renderMachines();
    renderWorkspace();
    renderViz();
    app.seen = app.nextSeen;
    app.cardState = app.nextCardState;
    $('scenKicker').textContent = app.scen.kicker;
    $('scenTitle').textContent = app.scen.title;
  }
  function afterChange() { evaluate(); renderAll(); }

  // ------------------------------------------------------------------
  //  Drobnosti: toast, konfety, dialogy scénářů a taháku
  // ------------------------------------------------------------------
  function toast(text) {
    var box = $('toasts');
    if (!box) { box = el('div', { id: 'toasts', class: 'toasts', 'aria-live': 'polite' }); document.body.appendChild(box); }
    var t = el('div', { class: 'toast', role: 'status' }, esc(text));
    box.appendChild(t);
    setTimeout(function () { t.remove(); }, 2800);
  }
  function confetti() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var box = el('div', { class: 'confetti' }), colors = ['#F05033', '#1A7F37', '#0969DA', '#BF8700', '#8250DF'];
    for (var i = 0; i < 90; i++) {
      var c = el('i');
      c.style.left = Math.random() * 100 + 'vw';
      c.style.background = colors[i % colors.length];
      c.style.animationDuration = (1.8 + Math.random() * 1.8) + 's';
      c.style.animationDelay = (Math.random() * 0.6) + 's';
      box.appendChild(c);
    }
    document.body.appendChild(box);
    setTimeout(function () { box.remove(); }, 4500);
  }

  // ------------------------------------------------------------------
  //  Výběr scénáře: vestavěné, moje (jen v tomto prohlížeči), nahrání
  // ------------------------------------------------------------------
  var REPO_URL = 'https://github.com/mkgymji/git-simulator';
  var EN = I18N.lang === 'en';
  var DOCS_NAME = EN ? 'docs/SCENARIOS.md' : 'docs/SCENARE.md';
  var DOCS_URL = REPO_URL + '/blob/main/' + DOCS_NAME;
  var HELP_URL = EN ? REPO_URL + '/blob/main/README.en.md' : REPO_URL + '#readme';
  var CHECK_SVG = '<svg class="chk" width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  // fajfka u názvu scénáře v záhlaví: scénář s úkoly, který už byl v tomto prohlížeči splněný
  function showDone() {
    var on = app.scen.tasks.length > 0 && STORE.isDone(app.scen.id);
    var b = $('scenBtn');
    b.classList.toggle('done', on);
    b.title = on ? tr('Tento scénář už máš v tomto prohlížeči splněný.') : '';
  }

  function download(name, text) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function fileName(title) { return LANG ? (title.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'scenar') + '.scenario' : 'scenar.scenario'; }

  function errorsHtml(errors, text) {
    var lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
    return '<div class="scen-errors"><b>' + tr('Scénář má chyby, nejde spustit:') + '</b><ul>' + errors.slice(0, 12).map(function (e) {
      var src = lines[e.line - 1];
      return '<li><span class="ln">' + tr('ř. {0}', e.line) + '</span> ' + esc(e.msg) + (src !== undefined && src.trim() ? '<br><code>' + esc(src.trim()) + '</code>' : '') + '</li>';
    }).join('') + '</ul>' + (errors.length > 12 ? '<p>' + tr('… a dalších {0} chyb.', errors.length - 12) + '</p>' : '') +
      '<p class="small">' + tr('Popis jazyka:') + ' <a href="' + DOCS_URL + '" target="_blank" rel="noopener">' + DOCS_NAME + '</a></p></div>';
  }

  // zkusí text přeložit; při úspěchu uloží do Mých scénářů a spustí
  function loadText(text, source, onError) {
    var r = LANG.compileAndTry(text);
    if (r.errors) { onError(r.errors); return; }
    STORE.save({ title: r.scenario.title, label: r.scenario.kicker, text: text, source: source || '' }).then(function (item) {
      if (location.hash === '#' + item.id) start(item.id); else location.hash = item.id;
      if (!STORE.persistent) toast(tr('Prohlížeč nedovolil uložení – scénář zmizí po zavření stránky.'));
    });
  }

  function scenarioDialog() {
    var d = el('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true', style: 'max-width:860px' });
    d.innerHTML = tr('<div class="dhead"><span class="grow">Vyber scénář</span></div><div class="dbody">') +
      tr('<h4 class="scen-h">Vestavěné scénáře</h4><div class="scen-list" id="sl-builtin"></div>') +
      tr('<h4 class="scen-h">Moje scénáře <span class="small">– uložené jen v tomto prohlížeči</span></h4><div class="scen-list" id="sl-my"><p class="small">Načítám…</p></div>') +
      tr('<h4 class="scen-h">Nahrát scénář</h4>') +
      tr('<div class="upload"><div class="drop" id="sl-drop">Přetáhni sem soubor <code>.scenario</code>, nebo <label class="linkbtn">vyber soubor<input type="file" id="sl-file" accept=".scenario,.txt,text/plain" hidden></label>.</div>') +
      tr('<details><summary>…nebo vlož text scénáře</summary><textarea id="sl-text" spellcheck="false" placeholder="FORMAT 1&#10;SCENARIO …"></textarea>') +
      tr('<p><button class="dbtn primary" type="button" id="sl-go">Načíst a spustit</button></p></details>') +
      '<div id="sl-err"></div>' +
      tr('<p class="small">Jak scénář napsat: <a href="{0}" target="_blank" rel="noopener">popis jazyka scénářů</a>. Vestavěný scénář si můžeš stáhnout jako vzor. ', DOCS_URL) +
      tr('Sdílet scénář jde odkazem: adresa simulátoru + <code>#load=</code> + adresa souboru (třeba na GitHubu).</p></div></div>');
    var ov = overlay(d);
    function go(id) { ov.close(); if (location.hash === '#' + id) start(id); else location.hash = id; }
    function card(s, my) {
      var wrap = el('div', { class: 'scen-item' + (app && s.id === app.scen.id ? ' active' : '') });
      var solved = s.tasks && s.tasks.length > 0 && STORE.isDone(s.id);
      if (solved) wrap.classList.add('done');
      var b = el('button', { class: 'scen-open', type: 'button' }, '<small>' + esc(s.kicker || s.label || tr('Scénář')) + '</small><b>' + esc(s.title) +
        (solved ? ' <span class="solved" title="' + tr('Splněno') + '">' + CHECK_SVG + '<span class="sr">' + tr('Splněno') + '</span></span>' : '') + '</b><span>' + esc(s.short || '') + '</span>');
      b.addEventListener('click', function () { go(s.id); });
      wrap.appendChild(b);
      var tools = el('div', { class: 'scen-tools' });
      var dl = el('button', { class: 'linkbtn', type: 'button' }, my ? tr('Stáhnout') : tr('Stáhnout jako vzor'));
      dl.addEventListener('click', function () { download(my ? fileName(s.title) : s.id + '.scenario', my ? s.text : SC.source(s.id)); });
      tools.appendChild(dl);
      if (my) {
        var rm = el('button', { class: 'linkbtn', type: 'button' }, tr('Odebrat'));
        rm.addEventListener('click', function () { STORE.remove(s.id).then(function () { wrap.remove(); toast(tr('Scénář odebrán z tohoto prohlížeče.')); }); });
        tools.appendChild(rm);
      }
      wrap.appendChild(tools);
      return wrap;
    }
    SC.list.forEach(function (s) { d.querySelector('#sl-builtin').appendChild(card(s, false)); });
    if (STORE.doneCount()) {
      var forget = el('button', { class: 'linkbtn forget', type: 'button', title: tr('Fajfky u splněných scénářů jsou uložené jen v tomto prohlížeči.') }, tr('Zapomenout splněné'));
      forget.addEventListener('click', function () {
        STORE.clearDone();
        Array.prototype.forEach.call(d.querySelectorAll('.scen-item.done'), function (w) { w.classList.remove('done'); var c = w.querySelector('.solved'); if (c) c.remove(); });
        forget.remove();
        showDone();
        toast(tr('Splněné scénáře jsou zapomenuté.'));
      });
      d.querySelector('.scen-h').appendChild(forget);
    }
    STORE.list().then(function (items) {
      var box = d.querySelector('#sl-my');
      box.innerHTML = '';
      if (!items.length) box.innerHTML = tr('<p class="small">Zatím žádné. Nahraný scénář se sem uloží.</p>');
      items.forEach(function (it) {
        var r = LANG.compile(it.text, it.id);
        box.appendChild(card({ id: it.id, title: it.title, kicker: it.label, short: r.scenario ? r.scenario.short : tr('Scénář má chyby.'), tasks: r.scenario ? r.scenario.tasks : [], text: it.text }, true));
      });
    });
    var errBox = d.querySelector('#sl-err');
    function showErr(text) { return function (errors) { errBox.innerHTML = errorsHtml(errors, text); }; }
    function readFile(f) {
      if (!f) return;
      var fr = new FileReader();
      fr.onload = function () { errBox.innerHTML = ''; loadText(String(fr.result), f.name, function (e) { showErr(String(fr.result))(e); }); if (!errBox.innerHTML) ov.close(); };
      fr.readAsText(f, 'utf-8');
    }
    d.querySelector('#sl-file').addEventListener('change', function (e) { readFile(e.target.files[0]); });
    var drop = d.querySelector('#sl-drop');
    ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
    drop.addEventListener('drop', function (e) { readFile(e.dataTransfer.files[0]); });
    d.querySelector('#sl-go').addEventListener('click', function () {
      var text = d.querySelector('#sl-text').value;
      errBox.innerHTML = '';
      loadText(text, tr('vložený text'), showErr(text));
      if (!errBox.innerHTML) ov.close();
    });
    var f = el('div', { class: 'dfoot' });
    var x = el('button', { class: 'dbtn', type: 'button' }, tr('Zavřít'));
    x.addEventListener('click', function () { ov.close(); });
    f.appendChild(x); d.appendChild(f);
  }

  var CHEAT = [
    [tr('Nastavení (jednou na počítači)')],
    [tr('git config --global user.name "Jméno"'), tr('kdo jsem')],
    [tr('git config --global user.email "e-mail"'), tr('můj e-mail (stejný jako na GitHubu)')],
    [tr('Nový projekt')],
    ['git init', tr('ze složky udělá repozitář')],
    [tr('git clone adresa'), tr('stáhne repozitář z GitHubu')],
    [tr('Každodenní práce')],
    ['git status', tr('co se děje?')],
    [tr('git add soubor'), tr('připrav soubor do commitu')],
    ['git add .', tr('připrav všechny změny')],
    [tr('git commit -m "zpráva"'), tr('ulož verzi')],
    ['git diff', tr('co jsem změnil od posledního commitu?')],
    [tr('Historie')],
    ['git log --oneline', tr('stručná historie')],
    [tr('git restore soubor'), tr('zahoď neuložené změny')],
    [tr('git restore --staged soubor'), tr('vyndej soubor ze stagingu')],
    [tr('git restore --source=hash soubor'), tr('vytáhni starou verzi souboru')],
    [tr('git revert hash'), tr('vrať commit novým commitem')],
    ['GitHub'],
    [tr('git remote add origin adresa'), tr('propoj repozitář s GitHubem (jednou)')],
    ['git push -u origin main', tr('první push')],
    ['git push', tr('pošli commity na GitHub')],
    ['git pull', tr('stáhni commity z GitHubu')],
    [tr('Větve')],
    ['git branch', tr('seznam větví')],
    [tr('git switch -c nazev'), tr('vytvoř větev a přepni se na ni')],
    [tr('git switch nazev'), tr('přepni se na větev')],
    [tr('git merge nazev'), tr('slouč větev do té, na které jsi')],
    ['git merge --abort', tr('zruš rozdělaný merge')],
    [tr('Terminál')],
    [tr('pwd   ls   cd nazev   cd ..'), tr('kde jsem · co tu je · jdi do složky · o složku výš')],
    [tr('mkdir nazev   code -r .'), tr('nová složka · otevři složku ve VS Code')],
    [tr('Tab · ↑ · cls'), tr('doplní název · předchozí příkaz · vyčistí terminál')]
  ];
  function cheatDialog() {
    var d = el('div', { class: 'dialog cheat', role: 'dialog', 'aria-modal': 'true' });
    var rows = CHEAT.map(function (r) { return r.length === 1 ? '<tr class="sec"><td colspan="2">' + esc(r[0]) + '</td></tr>' : '<tr><td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td></tr>'; }).join('');
    d.innerHTML = tr('<div class="dhead"><span class="grow">Tahák (z příručky, kap. 10)</span></div><div class="dbody"><table>{0}</table></div>', rows);
    var f = el('div', { class: 'dfoot' });
    var x = el('button', { class: 'dbtn primary', type: 'button' }, tr('Zavřít'));
    f.appendChild(x); d.appendChild(f);
    var ov = overlay(d);
    x.addEventListener('click', function () { ov.close(); });
  }
  // O simulátoru: autorská práva, licence a použité zdroje (podrobně v ZDROJE.md)
  function aboutDialog() {
    var GITSRC = 'https://github.com/git/git/blob/v2.47.1/';
    function src(f) { return '<a href="' + GITSRC + f + '" target="_blank" rel="noopener"><code>' + f + '</code></a>'; }
    var d = el('div', { class: 'dialog about', role: 'dialog', 'aria-modal': 'true', style: 'max-width:720px' });
    d.innerHTML = tr('<div class="dhead"><span class="grow">O simulátoru</span></div><div class="dbody">') +
      tr('<p style="margin-top:0"><b>Git simulátor</b> pro kurz Git a GitHub – rychlý úvod<br>Copyright © 2026 Michal Kočer</p>') +
      tr('<p>Simulátor je svobodný software pod licencí <a href="https://github.com/mkgymji/git-simulator/blob/main/LICENSE" target="_blank" rel="noopener">GNU General Public License verze 2</a>, ') +
      tr('stejně jako Git. Smíš ho používat, upravovat a šířit; upravenou verzi ale jen pod stejnou licencí a se zdrojovým kódem. ') +
      tr('Je poskytován bez jakékoli záruky.</p>') +
      tr('<h4>Převzato z Gitu 2.47.1</h4>') +
      tr('<p class="small" style="margin:0 0 4px">Algoritmy jsou převedené do JavaScriptu, hlášky Gitu převzaté doslova. Git: © Linus Torvalds, Junio C Hamano a přispěvatelé, GPL-2.0.</p>') +
      '<ul>' +
      '<li>diff a merge: ' + src('xdiff/xdiffi.c') + ', ' + src('xdiff/xprepare.c') + ', ' + src('xdiff/xemit.c') + ', ' + src('xdiff/xutils.c') + ', ' + src('xdiff/xmerge.c') +
      ' <span class="small">(© Davide Libenzi, Johannes E. Schindelin, LGPL-2.1+)</span></li>' +
      tr('<li>histogramový diff: {0} <span class="small">(© 2010 Google Inc., Eclipse Distribution License 1.0)</span></li>', src('xdiff/xhistogram.c')) +
      tr('<li>diff souboru v konfliktu: {0}</li>', src('combine-diff.c')) +
      '<li><code>git log --graph</code>: ' + src('graph.c') + ', ' + src('commit.c') + '</li>' +
      tr('<li>přejmenování: {0}, {1}</li>', src('diffcore-rename.c'), src('diffcore-delta.c')) +
      tr('<li>přepínání větví a místní změny: {0}; slučování: {1}; revert: {2}</li>', src('unpack-trees.c'), src('merge-ort.c'), src('sequencer.c')) +
      tr('<li>výpisy: {0}, {1}, {2}, {3}, {4}, {5}, {6} a <code>builtin/*.c</code></li>', src('wt-status.c'), src('diff.c'), src('ws.c'), src('remote.c'), src('help.c'), src('advice.c'), src('transport.c')) +
      '</ul>' +
      tr('<h4>Písma</h4><ul>') +
      '<li><a href="https://github.com/rsms/inter" target="_blank" rel="noopener">Inter</a> – © The Inter Project Authors, SIL Open Font License 1.1</li>' +
      '<li><a href="https://dejavu-fonts.github.io/" target="_blank" rel="noopener">DejaVu Sans Mono</a> – ' + tr('© Bitstream, Inc. (Bitstream Vera) a DejaVu, licence Bitstream Vera') + '</li></ul>' +
      tr('<h4>Ochranné známky</h4><p class="small" style="margin:0">Git je ochranná známka Software Freedom Conservancy, GitHub ochranná známka GitHub, Inc., ') +
      tr('PowerShell, Windows a Visual Studio Code ochranné známky společnosti Microsoft. Simulátor s nimi není spojen, jejich vzhled a texty napodobuje jen pro výuku.</p>') +
      tr('<p class="small">Úplný přehled: <a href="https://github.com/mkgymji/git-simulator/blob/main/ZDROJE.md" target="_blank" rel="noopener">ZDROJE.md</a></p></div>');
    var f = el('div', { class: 'dfoot' });
    var x = el('button', { class: 'dbtn primary', type: 'button' }, tr('Zavřít'));
    f.appendChild(x); d.appendChild(f);
    var ov = overlay(d);
    x.addEventListener('click', function () { ov.close(); });
    setTimeout(function () { x.focus(); }, 0);
  }

  function resetDialog() {
    var d = el('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true', style: 'max-width:440px' });
    d.innerHTML = tr('<div class="dhead">Začít scénář znovu?</div><div class="dbody">Všechno, co jsi v tomhle scénáři udělal(a), zmizí.</div>');
    var f = el('div', { class: 'dfoot' });
    var cn = el('button', { class: 'dbtn', type: 'button' }, tr('Zrušit'));
    var ok = el('button', { class: 'dbtn primary', type: 'button' }, tr('Začít znovu'));
    f.appendChild(cn); f.appendChild(ok); d.appendChild(f);
    var ov = overlay(d);
    cn.addEventListener('click', function () { ov.close(); });
    ok.addEventListener('click', function () { ov.close(); start(app.scen.id); });
    setTimeout(function () { ok.focus(); }, 0);
  }

  // ------------------------------------------------------------------
  //  Start
  // ------------------------------------------------------------------
  function launch(s) {
    app = makeApp(s);
    app.seen = null;
    evaluate();
    renderAll();
    app.seen = app.seen || {};
    document.title = tr('Git simulátor – {0}', s.title);
    showDone();
    setTimeout(focusTerm, 0);
  }
  function failDialog(title, html) {
    var d = el('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true', style: 'max-width:640px' });
    d.innerHTML = '<div class="dhead">' + esc(title) + '</div><div class="dbody">' + html + '</div>';
    var f = el('div', { class: 'dfoot' });
    var x = el('button', { class: 'dbtn primary', type: 'button' }, tr('Vybrat jiný scénář'));
    f.appendChild(x); d.appendChild(f);
    var ov = overlay(d);
    x.addEventListener('click', function () { ov.close(); scenarioDialog(); });
  }
  // #id (vestavěný), #my-… (Moje scénáře), #load=adresa (stáhne, uloží a spustí)
  function start(hash) {
    hash = decodeURIComponent(hash || '');
    if (hash.indexOf('load=') === 0) {
      var url = hash.slice(5);
      if (!app) launch(SC.list[0]);
      fetch(url, { cache: 'no-store' }).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      }).then(function (text) {
        loadText(text, url, function (errors) { failDialog(tr('Scénář z odkazu nejde spustit'), '<p>' + esc(url) + '</p>' + errorsHtml(errors, text)); });
      }).catch(function (e) {
        failDialog(tr('Scénář se nepodařilo stáhnout'), tr('<p>Adresa <code>{0}</code> nejde načíst ({1}).</p>', esc(url), esc(e.message)) +
          tr('<p class="small">Soubor musí být veřejně dostupný a server musí povolit stažení z jiné stránky (např. raw.githubusercontent.com to umí).</p>'));
      });
      return;
    }
    if (hash.indexOf('my-') === 0) {
      STORE.get(hash).then(function (item) {
        if (!item) { if (!app) launch(SC.list[0]); failDialog(tr('Scénář nenalezen'), tr('<p>Tenhle scénář v tomto prohlížeči uložený není. Moje scénáře jsou vždy jen v prohlížeči, kde je nahraješ.</p>')); return; }
        var r = LANG.compile(item.text, item.id);
        if (r.errors) { if (!app) launch(SC.list[0]); failDialog(tr('Scénář nejde spustit'), errorsHtml(r.errors, item.text)); return; }
        launch(r.scenario);
      });
      return;
    }
    launch(SC.list.filter(function (x) { return x.id === hash; })[0] || SC.list[0]);
  }
  window.addEventListener('hashchange', function () { start(location.hash.slice(1)); });
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { var o = document.querySelector('.overlay'); if (o && !o.querySelector('.vim, .vsc') && !app.term[app.active].wait) o.remove(); }
  });
  // texty stránky (index.html je česky) a přepínač jazyka
  function localizePage() {
    document.documentElement.lang = I18N.lang;
    $('pageKicker').textContent = tr('Git a GitHub – rychlý úvod');
    $('pageTitle').textContent = tr('Git simulátor');
    $('scenKicker').textContent = tr('Scénář');
    $('helpLink').textContent = tr('Návod');
    $('helpLink').href = HELP_URL;
    $('helpLink').title = tr('Jak simulátor používat (otevře se v nové záložce)');
    $('cheatBtn').textContent = tr('Tahák');
    $('resetBtn').textContent = tr('Začít znovu');
    $('langSwitch').setAttribute('aria-label', tr('Jazyk'));
    $('zt1').textContent = tr('Úkoly');
    $('zt2').textContent = tr('Počítač');
    $('zs2').textContent = tr('terminál, VS Code a prohlížeč');
    $('zt3').textContent = tr('Co se děje v Gitu');
    $('zs3').textContent = tr('verze souborů, historie, GitHub');
    $('machines').setAttribute('aria-label', tr('Počítač'));
    $('footNote').textContent = tr('Simulátor odpovídá Gitu 2.47 (Git for Windows). Hlášky Gitu jsou skutečné, poznámky simulátoru jsou česky a šedě. Po obnovení stránky začíná scénář znovu.');
    $('footLicence').innerHTML = tr('licence <a href="{0}">GNU GPL v2</a> · obsahuje kód převzatý z <a href="{1}">Gitu 2.47.1</a>', REPO_URL + '/blob/main/LICENSE', 'https://github.com/git/git/tree/v2.47.1');
    $('aboutBtn').textContent = tr('O simulátoru a zdrojích');
    $('srcLink').textContent = tr('zdrojový kód');
    Array.prototype.forEach.call($('langSwitch').querySelectorAll('button'), function (b) {
      var l = b.getAttribute('data-lang'), on = l === I18N.lang;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.title = l === 'cs' ? 'Česky (scénář začne znovu)' : 'English (the scenario restarts)';
      b.addEventListener('click', function () {
        if (on) return;
        I18N.remember(l);
        history.replaceState(null, '', location.pathname + location.hash);
        location.reload();
      });
    });
  }
  localizePage();
  $('scenBtn').addEventListener('click', scenarioDialog);
  $('cheatBtn').addEventListener('click', cheatDialog);
  $('resetBtn').addEventListener('click', resetDialog);
  $('aboutBtn').addEventListener('click', aboutDialog);
  start(location.hash.slice(1) || SC.list[0].id);
  window.__gitsim = function () { return app; };
})();
