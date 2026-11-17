/* =====================================================================
 *  ui.js – rozhraní simulátoru
 * ===================================================================== */
(function () {
  'use strict';
  var GW = window.GitWorld, GS = window.GitSim, SH = window.GitShell, MD = window.GitMarkdown, SC = window.GitScenarios;
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
  //  Scénář: vytvoření světa
  // ------------------------------------------------------------------
  function makeApp(scen) {
    var world = new GW.World();
    var realNow = world.now;
    var a = {
      scen: scen, world: world, people: [], hidden: {}, github: false,
      active: null, view: {}, term: {}, ide: {}, log: {}, done: {}, gh: {}, seen: null, cardState: {}, finished: false
    };
    function runAt(id, line, minutesAgo) {
      var m = world.machines[id];
      if (minutesAgo !== undefined) world.now = function () { return Math.floor(realNow() - minutesAgo * 60); };
      var r = SH.run(m, line), guard = 0;
      while (r.wait && guard++ < 5) {
        r = r.wait.type === 'editor' ? r.wait.resume(r.wait.text) : r.wait.resume(true);
      }
      world.now = realNow;
    }
    var api = {
      person: function (id, opts) {
        opts = opts || {};
        var p = SC.PEOPLE[id];
        world.addAccount(p.login, p.name, p.email);
        var m = world.addMachine(id, { login: p.login, home: id, label: p.label });
        if (opts.configured) {
          [['user.name', p.name], ['user.email', p.email], ['init.defaultBranch', 'main'], ['core.editor', 'code --wait'],
            ['pull.rebase', 'false'], ['core.quotepath', 'false']].forEach(function (kv) { GW.configSet(m.config, kv[0], kv[1]); });
        }
        if (opts.hidden) a.hidden[id] = true;
        else a.people.push(id);
        a.term[id] = { lines: [], history: [], hpos: -1, wait: null };
        a.ide[id] = { folder: null, file: null, buffer: '', dirty: false, preview: true, creating: false };
        a.log[id] = [];
        a.gh[id] = { page: 'home' };
        a.view[id] = 'pc';
      },
      github: function (on) { a.github = on; },
      mkdir: function (id, rel) { var m = world.machines[id]; m.mkdirp(m.home.concat(rel)); },
      cd: function (id, rel) { var m = world.machines[id]; m.cwd = m.home.concat(rel); },
      write: function (id, name, content) { world.machines[id].dir().files[name] = content; },
      run: runAt,
      open: function (id, rel) { var m = world.machines[id]; a.ide[id].folder = m.home.concat(rel); },
      remote: function (owner, name, opts, minutesAgo) {
        world.now = function () { return Math.floor(realNow() - (minutesAgo || 0) * 60); };
        var r = world.createRemote(owner, name, { private: true, readme: !!(opts && opts.readme) });
        r.collaborators = (opts && opts.collaborators) || [];
        r.invites = [];
        world.now = realNow;
      }
    };
    scen.setup(api);
    a.active = a.people[0];
    for (var k in world.remotes) if (!world.remotes[k].invites) world.remotes[k].invites = [];
    a.people.forEach(function (id) {
      var m = world.machines[id], t = a.term[id];
      t.lines.push({ s: [['Windows PowerShell', '']] });
      t.lines.push({ s: [['Simulátor: napiš příkaz a stiskni Enter. Přehled příkazů ukáže help.', 'n']], k: 'note' });
      t.lines.push({ s: [] });
    });
    return a;
  }

  function m() { return app.world.machines[app.active]; }
  function person(id) { return SC.PEOPLE[id]; }

  // ------------------------------------------------------------------
  //  Kontrola úkolů
  // ------------------------------------------------------------------
  function checkCtx() {
    return {
      world: app.world,
      m: function (id) { return app.world.machines[id]; },
      log: function (id) { return app.log[id] || []; },
      openFolder: function (id) { var f = app.ide[id] && app.ide[id].folder; return f ? f.join('/') : null; }
    };
  }
  function evaluate() {
    var c = checkCtx(), tasks = app.scen.tasks, i, newly = false;
    for (i = 0; i < tasks.length; i++) {
      if (app.done[i]) continue;
      var ok = false;
      try { ok = !!tasks[i].check(c); } catch (e) { ok = false; }
      if (ok) { app.done[i] = true; newly = true; }
    }
    if (tasks.length && !app.finished && tasks.every(function (t, k) { return app.done[k]; })) {
      app.finished = true;
      confetti();
    }
    return newly;
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
        if (t.question && (app.done[i] || i === current)) html += '<div class="q">Odpověz si: ' + esc(t.question) + '</div>';
        if (t.hint && !app.done[i]) {
          var open = app.openHints && app.openHints[i];
          html += '<button class="hint-btn" type="button" data-hint="' + i + '">' + (open ? 'Skrýt nápovědu' : 'Nápověda') + '</button>';
          if (open) html += '<div class="hint">' + t.hint + '</div>';
        }
        html += '</li>';
      });
      html += '</ol>';
      html += '<div class="done-banner' + (app.finished ? ' show' : '') + '"><b>Hotovo!</b> Všechny úkoly jsou splněné. Vyber si další scénář nahoře, nebo pokračuj ve zkoušení.</div>';
    } else {
      html += '<div class="intro"><p>V tomhle režimu nejsou úkoly. Graf a tři oblasti vpravo ukazují, co se děje.</p></div>';
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
    app.people.forEach(function (id) {
      var p = person(id);
      var pc = el('button', { class: 'mtab ' + id + (app.active === id && app.view[id] === 'pc' ? ' active' : ''), type: 'button', role: 'tab' },
        '<span class="dot"></span>' + esc(multi ? p.label : 'Počítač (' + p.name + ')'));
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
    var card = el('div', { class: 'card' });
    card.appendChild(el('div', { class: 'card-head' }, '<span class="grow">Visual Studio Code</span><span class="sub">' +
      (ide.folder ? esc(mm.winPath(ide.folder)) : 'žádná otevřená složka') + '</span>'));
    var wrap = el('div', { class: 'ide' });
    // Průzkumník
    var ex = el('div', { class: 'explorer' });
    var folderDir = ide.folder ? mm.dirAt(ide.folder) : null;
    if (!ide.folder || !folderDir) {
      ex.innerHTML = '<div class="folder"><span class="grow">Průzkumník</span></div><div class="empty">Žádná složka není otevřená.<br>V terminálu přejdi do složky projektu a napiš <span class="cmd">code -r .</span></div>';
    } else {
      var head = el('div', { class: 'folder' }, '<span class="grow">' + esc(ide.folder[ide.folder.length - 1]) + '</span>');
      var nb = el('button', { class: 'icon-btn', type: 'button', title: 'Nový soubor' }, '<svg width="14" height="14" viewBox="0 0 16 16"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.8"/></svg>');
      nb.addEventListener('click', function () { ide.creating = true; renderWorkspace(); var i = document.querySelector('.new-file input'); if (i) i.focus(); });
      head.appendChild(nb);
      ex.appendChild(head);
      if (ide.creating) {
        var nf = el('div', { class: 'new-file' });
        var inp = el('input', { type: 'text', placeholder: 'nazev.md', 'aria-label': 'Název nového souboru' });
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
        var b = el('button', { type: 'button', title: s === 'I' ? 'Git tento soubor ignoruje' : '' },
          DOC.replace('class="doc"', 'class="doc" style="color:#57606A;width:12px;height:14px"') +
          '<span class="fname' + (s && s !== 'I' ? ' st-' + (s === '!' ? 'C' : s) : '') + '"' + (s === 'I' ? ' style="opacity:.55"' : '') + '>' + esc(n) + '</span>' +
          '<span class="st st-' + (s === '!' ? 'C' : s) + '">' + (s === 'I' ? '' : s) + '</span>');
        b.addEventListener('click', function () { openFile(n); });
        li.appendChild(b);
        ul.appendChild(li);
      });
      if (!names.length && !dirs.length && !ide.creating) ex.appendChild(el('div', { class: 'empty' }, 'Složka je prázdná. Nový soubor vytvoříš tlačítkem <b>+</b>.'));
      ex.appendChild(ul);
    }
    wrap.appendChild(ex);
    // Editor
    var ed = el('div', { class: 'editor' });
    if (!ide.file) {
      ed.appendChild(el('div', { class: 'etabs' }));
      var body0 = el('div', { class: 'ebody' });
      body0.appendChild(el('div', { class: 'welcome' }, ide.folder ?
        'Klikni na soubor vlevo, nebo vytvoř nový tlačítkem <b>+</b>.<br>Soubor ulož <kbd>Ctrl</kbd>+<kbd>S</kbd>. Uložení ale není commit – Git si změnu zapamatuje až po <span class="cmd">git add</span> a <span class="cmd">git commit</span>.' :
        'Tady se otevřou soubory. Nejdřív otevři složku: <span class="cmd">code -r .</span>'));
      ed.appendChild(body0);
    } else {
      var exists = folderDir && (ide.file in folderDir.files);
      var tabs = el('div', { class: 'etabs' });
      var tab = el('div', { class: 'etab' }, esc(ide.file) + (exists ? '' : ' <i style="color:#CF222E">(smazáno)</i>') + (ide.dirty ? '<span class="dirty" title="Neuloženo"></span>' : ''));
      var cl = el('button', { class: 'close', type: 'button', title: 'Zavřít' }, '×');
      cl.addEventListener('click', closeFile);
      tab.appendChild(cl);
      tabs.appendChild(tab);
      var tools = el('div', { class: 'etools' });
      var pv = el('button', { class: 'ebtn', type: 'button', title: 'Náhled Markdownu (Ctrl+Shift+V)' }, ide.preview ? 'Bez náhledu' : 'Náhled');
      pv.addEventListener('click', function () { ide.preview = !ide.preview; renderWorkspace(); });
      var sv = el('button', { class: 'ebtn save', type: 'button', title: 'Uložit soubor (Ctrl+S)' }, 'Uložit');
      sv.disabled = !ide.dirty && exists;
      sv.addEventListener('click', saveFile);
      tools.appendChild(pv); tools.appendChild(sv);
      tabs.appendChild(tools);
      ed.appendChild(tabs);
      var body = el('div', { class: 'ebody' + (ide.preview && /\.md$/i.test(ide.file) ? '' : ' nopreview') });
      var src = el('div', { class: 'src' });
      src.appendChild(el('div', { class: 'pane-title' }, 'Napíšeš (' + (/\.md$/i.test(ide.file) ? 'Markdown' : 'text') + ')'));
      var ta = el('textarea', { spellcheck: 'false', 'aria-label': 'Obsah souboru ' + ide.file });
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
        prev.appendChild(el('div', { class: 'pane-title' }, 'Uvidíš (náhled)'));
        var md = el('div', { class: 'md', id: 'mdPreview' }, MD.render(ide.buffer));
        md.addEventListener('click', function (e) {
          var a = e.target.closest('a[data-file]');
          if (a) { e.preventDefault(); var f = a.getAttribute('data-file'); if (folderDir && f in folderDir.files) openFile(f); else toast('Soubor ' + f + ' ve složce není.'); }
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
    if (tab && !tab.querySelector('.dirty') && ide.dirty) tab.insertBefore(el('span', { class: 'dirty', title: 'Neuloženo' }), tab.querySelector('.close'));
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
    if (!validName(name)) { toast('Takový název souboru Windows nedovolí.'); renderWorkspace(); return; }
    if (d.dirs[name] || name in d.files) { toast('Soubor ' + name + ' už existuje.'); renderWorkspace(); return; }
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
    var head = el('div', { class: 'thead' }, '<span>Terminál (PowerShell)</span><span class="grow"></span>');
    var clr = el('button', { type: 'button', title: 'Vyčistit (cls)' }, 'Vyčistit');
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
      body.appendChild(el('div', { class: 'ln waiting' }, esc(t.waitText || 'Git čeká…')));
    } else {
      var line = el('div', { class: 'inputline' });
      line.appendChild(el('span', { class: 'prompt' }, esc(mm.prompt()) + ' '));
      var inp = el('input', { type: 'text', id: 'termInput', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': 'Příkazová řádka' });
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
      r = { lines: [{ s: [['Simulátor: tady se něco pokazilo (' + err.message + '). Zkus scénář začít znovu.', 'n']], k: 'note' }] };
      if (window.console) console.error(err);
    }
    var entry = { line: line, cwd: cwd, out: [] };
    if (line.trim()) app.log[id].push(entry);
    handleResult(id, r, entry);
  }

  function handleResult(id, r, entry) {
    var t = app.term[id];
    if (r.clear) t.lines = [];
    pushLines(id, r.lines || []);
    if (entry) entry.out = entry.out.concat(r.lines || []);
    if (r.open) {
      var ide = app.ide[id], mm = app.world.machines[id];
      if (r.open.folder) {
        var changed = !ide.folder || ide.folder.join('/') !== r.open.folder.join('/');
        ide.folder = r.open.folder; ide.file = null; ide.dirty = false;
        mm.cwd = r.open.folder.slice();
        if (changed) {
          t.lines = [];
          pushLines(id, [{ s: [['(VS Code se přenačetl a terminál začíná znovu ve složce ' + r.open.folder[r.open.folder.length - 1] + ')', 'n']], k: 'note' }, { s: [] }]);
        }
      } else if (r.open.file) {
        var folder = r.open.file.slice(0, -1), name = r.open.file[r.open.file.length - 1];
        if (!ide.folder || ide.folder.join('/') !== folder.join('/')) {
          if (!ide.folder) ide.folder = folder;
          else { pushLines(id, [{ s: [['Simulátor: soubor je mimo otevřenou složku. Otevři nejdřív jeho složku: code -r .', 'n']], k: 'note' }]); finish(); return; }
        }
        var d = mm.dirAt(folder);
        if (!(name in d.files)) d.files[name] = '';
        ide.file = name; ide.buffer = d.files[name]; ide.dirty = false;
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
        t.waitText = '(otevřel se Vim – výchozí editor Gitu)';
        vimDialog(wait, function (text) { done(wait.resume(text)); });
      }
    } else if (wait.type === 'signin') {
      t.waitText = '(Git Credential Manager čeká na přihlášení)';
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
      'Git spojuje dvě linie historie a připravil zprávu pro <b>merge commit</b>. Nic neměň, jen záložku zavři.' :
      'Git čeká na <b>zprávu commitu</b>. Napiš ji na první řádek, ulož a zavři. Řádky s <code>#</code> Git vynechá; prázdná zpráva commit zruší.';
    d.querySelector('.dbody').appendChild(el('div', { class: 'tip' }, tipText));
    var foot = el('div', { class: 'dfoot' });
    var close = el('button', { class: 'dbtn', type: 'button' }, 'Zavřít bez uložení');
    var save = el('button', { class: 'dbtn primary', type: 'button' }, 'Uložit a zavřít záložku');
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
    d.appendChild(el('div', { class: 'tip' }, 'Tohle je <b>Vim</b>. Otevřel se, protože chybí nastavení <code>core.editor</code>. ' +
      'Zprávu napiš nahoru, pak do řádku dole napiš <b>:wq</b> a Enter (uložit a odejít). <b>:q!</b> odejde bez uložení.<br>' +
      'Příště: <code>git config --global core.editor "code --wait"</code>'));
    var ta = el('textarea', { spellcheck: 'false' });
    ta.value = wait.text;
    d.appendChild(ta);
    var line = el('div', { class: 'vimline' }, '<span>:</span>');
    var inp = el('input', { type: 'text', 'aria-label': 'Příkaz Vimu' });
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
      } else if (c === 'w') { inp.value = ''; inp.placeholder = 'uloženo – teď :q'; wait.text = ta.value; }
      else { inp.value = ''; inp.placeholder = 'E492: Not an editor command: ' + c; }
    });
    setTimeout(function () { ta.focus(); ta.setSelectionRange(0, 0); }, 0);
  }

  function signinDialog(login, cb) {
    var d = el('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true', style: 'max-width:440px' });
    d.innerHTML = '<div class="dhead"><span class="grow">Git Credential Manager</span></div>' +
      '<div class="dbody gcm"><svg class="gcm-logo" viewBox="0 0 54 54"><rect width="54" height="54" rx="12" fill="#24292F"/><path d="M12 22h30" stroke="#fff" stroke-width="3"/><path d="M22 22c0 11 5 14 9 14s8-4 8-14" fill="none" stroke="#F05033" stroke-width="3"/><circle cx="12" cy="22" r="3.6" fill="#fff"/><circle cx="22" cy="22" r="3.6" fill="#fff"/><circle cx="42" cy="22" r="3.6" fill="#fff"/><circle cx="31" cy="36" r="3.6" fill="#F05033"/></svg>' +
      '<div class="big">Connect to GitHub</div><div class="muted" style="color:#57606A">Git potřebuje vědět, kdo jsi.</div>' +
      '<div class="stack"><button class="dbtn primary" type="button" data-a="browser">Sign in with your browser</button>' +
      '<button class="dbtn" type="button" data-a="token">Token</button><button class="dbtn" type="button" data-a="cancel">Cancel</button></div></div>';
    var ov = overlay(d);
    d.querySelector('[data-a=cancel]').addEventListener('click', function () { ov.close(); cb(false); });
    d.querySelector('[data-a=token]').addEventListener('click', function () {
      d.querySelector('.dbody').innerHTML = '<p>Záložní cesta: na GitHubu vytvoř <b>token (classic)</b> se scope <code>repo</code> (Settings → Developer settings → Personal access tokens) a vlož ho sem.</p>' +
        '<p><input type="text" style="width:100%;border:1px solid #D0D7DE;border-radius:6px;padding:6px" placeholder="ghp_..." aria-label="Token"></p>' +
        '<p class="muted" style="color:#57606A;font-size:13px">V simulátoru projde libovolný text.</p>';
      var f = el('div', { class: 'dfoot' });
      var ok = el('button', { class: 'dbtn green', type: 'button' }, 'Sign in');
      var cn = el('button', { class: 'dbtn', type: 'button' }, 'Cancel');
      f.appendChild(cn); f.appendChild(ok); d.appendChild(f);
      cn.addEventListener('click', function () { ov.close(); cb(false); });
      ok.addEventListener('click', function () { ov.close(); cb(true); });
    });
    d.querySelector('[data-a=browser]').addEventListener('click', function () {
      d.querySelector('.dhead .grow').textContent = 'Prohlížeč – github.com';
      d.querySelector('.dbody').innerHTML = '<div style="text-align:center"><div class="big" style="font-size:18px;font-weight:700">Authorize Git Credential Manager</div>' +
        '<p>Přihlášen(a) jako <b>' + esc(login) + '</b>. Git Credential Manager žádá o přístup k tvým repozitářům.</p>' +
        '<p class="muted" style="color:#57606A;font-size:13px">Přihlášení se uloží do počítače. Na sdíleném počítači se proto po hodině odhlas.</p></div>';
      var f = el('div', { class: 'dfoot' });
      var ok = el('button', { class: 'dbtn green', type: 'button' }, 'Authorize git-ecosystem');
      var cn = el('button', { class: 'dbtn', type: 'button' }, 'Cancel');
      f.appendChild(cn); f.appendChild(ok); d.appendChild(f);
      cn.addEventListener('click', function () { ov.close(); cb(false); });
      ok.addEventListener('click', function () { ov.close(); toast('Přihlášení proběhlo. Git pokračuje.'); cb(true); });
    });
  }

  function askSave(cb) {
    var d = el('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true', style: 'max-width:440px' });
    d.innerHTML = '<div class="dhead">Uložit změny v souboru?</div><div class="dbody">Soubor má neuložené změny. Bez uložení se ztratí.</div>';
    var f = el('div', { class: 'dfoot' });
    [['cancel', 'Zrušit', 'dbtn'], ['discard', 'Neukládat', 'dbtn'], ['save', 'Uložit', 'dbtn primary']].forEach(function (b) {
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
        '<label class="radio"><input type="radio" name="vis" value="public"> <span>Public<small>Repozitář uvidí kdokoliv na internetu.</small></span></label>' +
        '<label class="radio"><input type="radio" name="vis" value="private" checked> <span>Private<small>Uvidíš ho jen ty a lidé, které pozveš.</small></span></label>' +
        '<label>Initialize this repository with:</label>' +
        '<label class="radio"><input type="checkbox" id="nr-readme"> <span>Add a README file<small>Repozitář nebude prázdný a půjde rovnou naklonovat.</small></span></label>' +
        '<p><button class="gbtn green" type="submit">Create repository</button> <button class="gbtn" type="button" id="nr-cancel">Cancel</button></p></form>';
      page.querySelector('#nr-cancel').addEventListener('click', function () { go({ page: 'home' }); });
      page.querySelector('form').addEventListener('submit', function (e) {
        e.preventDefault();
        var name = page.querySelector('#nr-name').value.trim().replace(/\s+/g, '-');
        if (!/^[A-Za-z0-9._-]+$/.test(name)) { toast('Název repozitáře smí mít jen písmena bez diakritiky, číslice, - _ a tečku.'); return; }
        var vis = page.querySelector('input[name=vis]:checked').value;
        var readme = page.querySelector('#nr-readme').checked;
        var created = w.createRemote(p.login, name, { private: vis === 'private', readme: readme });
        if (!created) { toast('Repozitář ' + name + ' už máš.'); return; }
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
        html += '<div class="invite"><span><b>' + esc(ri.owner) + '</b> tě zve ke spolupráci na <b>' + esc(ri.owner + '/' + ri.name) + '</b>.</span> <button class="gbtn green" type="button" data-acc="' + esc(ri.key) + '">Accept invitation</button></div>';
      });
      html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><h4 style="margin:0;flex:1">Repositories</h4><button class="gbtn green" type="button" id="gh-new">New</button></div>';
      var list = reposOf(p.login);
      if (!list.length) html += '<p class="muted">Zatím tu nemáš žádný repozitář.</p>';
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
          toast('Pozvánka přijata. Teď můžeš do ' + ri.name + ' pushovat.');
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
      if (!r.collaborators.length && !(r.invites || []).length) html2 += '<div class="frow muted">Zatím nikoho nemáš.</div>';
      r.collaborators.forEach(function (c) { html2 += '<div class="frow">' + esc(c) + '<span class="msg">Collaborator</span></div>'; });
      (r.invites || []).forEach(function (c) { html2 += '<div class="frow">' + esc(c) + '<span class="msg">Pending invite</span></div>'; });
      html2 += '</div><form style="margin-top:10px"><label for="ad-name">Add people</label><div style="display:flex;gap:6px"><input type="text" id="ad-name" placeholder="uživatelské jméno"><button class="gbtn green" type="submit">Add</button></div></form>';
      page.innerHTML = html2;
      page.querySelector('form').addEventListener('submit', function (e) {
        e.preventDefault();
        var who = page.querySelector('#ad-name').value.trim();
        if (!w.accounts[who]) { toast('Uživatel ' + who + ' na GitHubu není.'); return; }
        if (who === r.owner) { toast('Vlastníka zvát nemusíš.'); return; }
        if (r.collaborators.indexOf(who) >= 0 || r.invites.indexOf(who) >= 0) { toast(who + ' už pozvánku má.'); return; }
        r.invites.push(who);
        toast('Pozvánka odeslána. ' + who + ' ji musí přijmout.');
        renderAll();
      });
    } else if (st.page === 'commits') {
      var html3 = title + '<div class="box"><div class="bhead"><span class="grow">Commits na větvi ' + esc(r.defaultBranch) + '</span></div>', h = head;
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
            if (gt.value === content) { toast('Soubor se nezměnil – není co commitnout.'); return; }
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
          '<p style="margin:0 0 6px">HTTPS adresa: <code>' + esc(r.url) + '</code></p>' +
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
        html5 += '<p class="muted" style="margin-top:10px">Naklonovat: <code>' + esc(r.url) + '</code></p>';
      }
      page.innerHTML = html5;
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
    card.appendChild(el('div', { class: 'card-head' }, '<span class="grow">Kde je která verze</span><span class="sub">' + (cur ? esc(cur.path[cur.path.length - 1]) : '') + '</span>'));
    if (!cur) {
      card.appendChild(el('div', { class: 'graph-empty' }, 'Tady uvidíš pracovní složku, přípravnou oblast a repozitář, jakmile budeš ve složce s repozitářem (<span class="cmd">git init</span> nebo <span class="cmd">git clone</span>).'));
    } else card.appendChild(renderAreas(cur));
    box.appendChild(card);
    // graf
    var g = el('div', { class: 'card' });
    var repo = cur && cur.dir.repo;
    g.appendChild(el('div', { class: 'card-head' }, '<span class="grow">Historie (graf commitů)</span><span class="sub">' + esc(person(app.active).label) + '</span>'));
    if (!repo || !repo.headHash() && !Object.keys(repo.remoteRefs).length) {
      g.appendChild(el('div', { class: 'graph-empty' }, repo ? 'Zatím žádný commit. První vznikne příkazem <span class="cmd">git commit</span>.' : 'Žádný repozitář.'));
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
      if (!rem) ghc.appendChild(el('div', { class: 'graph-empty' }, 'Na téhle adrese zatím žádný repozitář není.'));
      else if (!Object.keys(rem.branches).length) ghc.appendChild(el('div', { class: 'graph-empty' }, 'Repozitář na GitHubu je prázdný. Pošli do něj commity: <span class="cmd">git push -u origin main</span>'));
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
      if (conf[p]) { wd += card(p, 'konflikt', 'conflict', 'changed', 'wd', 'Soubor je v konfliktu. Vyřeš ho a pak git add.'); return; }
      if (!(p in W)) { wd += card(p, 'smazaný', 'deleted', 'changed', 'wd', 'Soubor je v přípravné oblasti, ale v pracovní složce chybí.'); return; }
      if (!I[p]) {
        if (GS.isIgnored(rules, p)) wd += card(p, 'ignorovaný', 'ignored', 'same', 'wd', 'Soubor je v .gitignore – Git si ho nevšímá.');
        else wd += card(p, 'nesledovaný', 'untracked', 'changed', 'wd', 'Git tenhle soubor zatím nesleduje. Přidej ho: git add');
        return;
      }
      if (hW[p] !== I[p]) wd += card(p, 'změněný', 'modified', 'changed', 'wd', 'Změna, která ještě není v přípravné oblasti (git add).');
      else wd += card(p, '', '', 'same', 'wd', 'Stejné jako v přípravné oblasti.');
    });
    // přípravná oblast
    var st = '', alls = {};
    for (p in I) alls[p] = 1;
    for (p in H) alls[p] = 1;
    for (p in conf) alls[p] = 1;
    GW.sortedKeys(alls).forEach(function (p) {
      if (conf[p]) { st += card(p, 'konflikt', 'conflict', 'changed', 'st', 'Git čeká, až konflikt vyřešíš (git add).'); return; }
      if (!I[p]) { st += card(p, 'smazání', 'deleted', 'changed', 'st', 'Příští commit soubor smaže.'); return; }
      if (!H[p]) st += card(p, 'nový', 'new', 'changed', 'st', 'Příští commit soubor přidá.');
      else if (H[p] !== I[p]) st += card(p, 'změněný', 'modified', 'changed', 'st', 'Příští commit uloží tuhle verzi.');
      else st += card(p, '', '', 'same', 'st', 'Stejné jako v posledním commitu.');
    });
    // repozitář
    var re = '';
    GW.sortedKeys(H).forEach(function (p) { re += card(p, '', '', 'same', 're', 'Verze uložená v posledním commitu.'); });
    var head = Hh ? '<div class="en" style="font-style:normal"><code>' + Hh.slice(0, 7) + '</code> ' + esc(repo.head) + '</div>' : '<div class="en">zatím žádný commit</div>';
    var arrow = function (label) { return '<div class="arrow"><svg viewBox="0 0 30 18"><path d="M2 9h22" stroke="#57606A" stroke-width="2"/><path d="M20 4l7 5-7 5" fill="#57606A"/></svg><span>' + label + '</span></div>'; };
    areas.innerHTML =
      '<div class="area wd"><h3>Pracovní složka</h3><div class="en">working directory</div><div class="files">' + (wd || '<div class="none">prázdná</div>') + '</div></div>' +
      arrow('git add') +
      '<div class="area st"><h3>Přípravná oblast</h3><div class="en">staging area</div><div class="files">' + (st || '<div class="none">prázdná</div>') + '</div></div>' +
      arrow('git commit') +
      '<div class="area re"><h3>Repozitář</h3>' + head + '<div class="files">' + (re || '<div class="none">–</div>') + '</div></div>';
    wrap.appendChild(areas);
    var dirtyFiles = app.people.filter(function (id) { return app.ide[id].dirty; }).length;
    if (app.ide[app.active].dirty) wrap.appendChild(el('div', { class: 'areas-note' }, 'Soubor <b>' + esc(app.ide[app.active].file) + '</b> má neuložené změny v editoru – Git je zatím nevidí. Ulož ho (<kbd>Ctrl</kbd>+<kbd>S</kbd>).'));
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
    var width = X0 * 2 + Math.max(0, hashes.length - 1) * DX, height = Y0 + maxLane * DY + 46;
    var seenKey = kind + ':';
    var svg = '<svg width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="Graf commitů">';
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
    Object.keys(labels).forEach(function (h) {
      var a = pos[h], list = labels[h].slice(), y = a.y - R - 14;
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
        y -= 22;
      });
    });
    svg += '</svg>';
    var need = 0;
    Object.keys(labels).forEach(function (h) { need = Math.max(need, labels[h].length); });
    var wrap = el('div', { class: 'graph-wrap' });
    wrap.innerHTML = svg;
    var s = wrap.querySelector('svg');
    if (need > 1) {
      var extra = (need - 1) * 22;
      s.setAttribute('height', height + extra);
      s.setAttribute('viewBox', '0 ' + (-extra) + ' ' + width + ' ' + (height + extra));
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

  function scenarioDialog() {
    var d = el('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true', style: 'max-width:820px' });
    d.innerHTML = '<div class="dhead"><span class="grow">Vyber scénář</span></div><div class="dbody"><div class="scen-list"></div><p style="font-size:13px;color:#57606A;margin:12px 0 0">Každý scénář začíná načisto. Přímý odkaz na scénář: adresa stránky + <code>#nazev</code> (např. <code>#odmitnuty-push</code>).</p></div>';
    var list = d.querySelector('.scen-list');
    var ov = overlay(d);
    SC.list.forEach(function (s) {
      var b = el('button', { class: 'scen-item' + (s.id === app.scen.id ? ' active' : ''), type: 'button' },
        '<small>' + esc(s.kicker) + '</small><b>' + esc(s.title) + '</b><span>' + esc(s.short) + '</span>');
      b.addEventListener('click', function () { ov.close(); if (location.hash === '#' + s.id) start(s.id); else location.hash = s.id; });
      list.appendChild(b);
    });
    var f = el('div', { class: 'dfoot' });
    var x = el('button', { class: 'dbtn', type: 'button' }, 'Zavřít');
    x.addEventListener('click', function () { ov.close(); });
    f.appendChild(x); d.appendChild(f);
  }

  var CHEAT = [
    ['Nastavení (jednou na počítači)'],
    ['git config --global user.name "Jméno"', 'kdo jsem'],
    ['git config --global user.email "e-mail"', 'můj e-mail (stejný jako na GitHubu)'],
    ['Nový projekt'],
    ['git init', 'ze složky udělá repozitář'],
    ['git clone adresa', 'stáhne repozitář z GitHubu'],
    ['Každodenní práce'],
    ['git status', 'co se děje?'],
    ['git add soubor', 'připrav soubor do commitu'],
    ['git add .', 'připrav všechny změny'],
    ['git commit -m "zpráva"', 'ulož verzi'],
    ['git diff', 'co jsem změnil od posledního commitu?'],
    ['Historie'],
    ['git log --oneline', 'stručná historie'],
    ['git restore soubor', 'zahoď neuložené změny'],
    ['git restore --staged soubor', 'vyndej soubor ze stagingu'],
    ['git restore --source=hash soubor', 'vytáhni starou verzi souboru'],
    ['git revert hash', 'vrať commit novým commitem'],
    ['GitHub'],
    ['git remote add origin adresa', 'propoj repozitář s GitHubem (jednou)'],
    ['git push -u origin main', 'první push'],
    ['git push', 'pošli commity na GitHub'],
    ['git pull', 'stáhni commity z GitHubu'],
    ['Větve'],
    ['git branch', 'seznam větví'],
    ['git switch -c nazev', 'vytvoř větev a přepni se na ni'],
    ['git switch nazev', 'přepni se na větev'],
    ['git merge nazev', 'slouč větev do té, na které jsi'],
    ['git merge --abort', 'zruš rozdělaný merge'],
    ['Terminál'],
    ['pwd   ls   cd nazev   cd ..', 'kde jsem · co tu je · jdi do složky · o složku výš'],
    ['mkdir nazev   code -r .', 'nová složka · otevři složku ve VS Code'],
    ['Tab · ↑ · cls', 'doplní název · předchozí příkaz · vyčistí terminál']
  ];
  function cheatDialog() {
    var d = el('div', { class: 'dialog cheat', role: 'dialog', 'aria-modal': 'true' });
    var rows = CHEAT.map(function (r) { return r.length === 1 ? '<tr class="sec"><td colspan="2">' + esc(r[0]) + '</td></tr>' : '<tr><td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td></tr>'; }).join('');
    d.innerHTML = '<div class="dhead"><span class="grow">Tahák (z příručky, kap. 10)</span></div><div class="dbody"><table>' + rows + '</table></div>';
    var f = el('div', { class: 'dfoot' });
    var x = el('button', { class: 'dbtn primary', type: 'button' }, 'Zavřít');
    f.appendChild(x); d.appendChild(f);
    var ov = overlay(d);
    x.addEventListener('click', function () { ov.close(); });
  }
  function resetDialog() {
    var d = el('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true', style: 'max-width:440px' });
    d.innerHTML = '<div class="dhead">Začít scénář znovu?</div><div class="dbody">Všechno, co jsi v tomhle scénáři udělal(a), zmizí.</div>';
    var f = el('div', { class: 'dfoot' });
    var cn = el('button', { class: 'dbtn', type: 'button' }, 'Zrušit');
    var ok = el('button', { class: 'dbtn primary', type: 'button' }, 'Začít znovu');
    f.appendChild(cn); f.appendChild(ok); d.appendChild(f);
    var ov = overlay(d);
    cn.addEventListener('click', function () { ov.close(); });
    ok.addEventListener('click', function () { ov.close(); start(app.scen.id); });
    setTimeout(function () { ok.focus(); }, 0);
  }

  // ------------------------------------------------------------------
  //  Start
  // ------------------------------------------------------------------
  function start(id) {
    var s = SC.list.filter(function (x) { return x.id === id; })[0] || SC.list[0];
    app = makeApp(s);
    app.seen = null;
    evaluate();
    renderAll();
    app.seen = app.seen || {};
    document.title = 'Git simulátor – ' + s.title;
    setTimeout(focusTerm, 0);
  }
  window.addEventListener('hashchange', function () { start(location.hash.slice(1)); });
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { var o = document.querySelector('.overlay'); if (o && !o.querySelector('.vim, .vsc') && !app.term[app.active].wait) o.remove(); }
  });
  $('scenBtn').addEventListener('click', scenarioDialog);
  $('cheatBtn').addEventListener('click', cheatDialog);
  $('resetBtn').addEventListener('click', resetDialog);
  start(location.hash.slice(1) || 'volne');
  window.__gitsim = function () { return app; };
})();
