// Git simulátor – Copyright (C) 2026 Michal Kočer
// SPDX-License-Identifier: GPL-2.0-only
//
// Test ekvivalence: scénáře v jazyce scénářů (scenarios/*.scenario) × původní scénáře
// v JavaScriptu (tests/legacy_scenarios.js). Porovná výchozí stav světa a po každém kroku
// řešení i to, které úkoly jsou splněné.
//
// Spuštění: jsc js/text.js js/world.js js/graph.js js/rename.js js/git.js js/shell.js \
//   js/session.js js/scenario-lang.js tests/legacy_scenarios.js tests/scenario_equiv.js -- <složka scenarios>
var DIR = arguments[0] || 'scenarios';
var LEG = GitLegacyScenarios, S = GitSession, L = GitScenarioLang;
var failures = 0, checks = 0;

function fail(msg) { failures++; print('ROZDÍL: ' + msg); }

function legacyScenario(id) {
  var orig = LEG.list.filter(function (s) { return s.id === id; })[0];
  return {
    id: orig.id, title: orig.title, tasks: orig.tasks,
    setup: function (api) {
      var wrapped = {};
      for (var k in api) wrapped[k] = api[k];
      wrapped.person = function (pid, o) { var p = LEG.PEOPLE[pid]; return api.person({ id: pid, name: p.name, email: p.email, login: p.login, label: p.label }, o); };
      orig.setup(wrapped);
    }
  };
}

// --- otisk světa bez hashů a časů ---
function commitSig(w, h, depth) {
  if (!h) return null;
  var c = w.commits[h], t = w.trees[c.tree], files = {};
  for (var p in t) files[p] = w.blobs[t[p]];
  return { msg: c.message, author: c.author.name + ' <' + c.author.email + '>', parents: depth > 0 ? c.parents.map(function (x) { return commitSig(w, x, depth - 1); }) : c.parents.length, files: files };
}
function dirSig(w, d) {
  var o = { files: d.files, dirs: {} }, k;
  for (k in d.dirs) o.dirs[k] = dirSig(w, d.dirs[k]);
  if (d.repo) {
    var r = d.repo, br = {}, rr = {}, idx = {};
    for (k in r.branches) br[k] = commitSig(w, r.branches[k], 30);
    for (k in r.remoteRefs) rr[k] = commitSig(w, r.remoteRefs[k], 30);
    for (k in r.index) idx[k] = w.blobs[r.index[k]];
    o.repo = { head: r.head, branches: br, remoteRefs: rr, index: idx, remotes: r.remotes, upstream: r.upstream, merge: !!r.merge, remoteHead: r.remoteHead || null };
  }
  return o;
}
function worldSig(a) {
  var w = a.world, out = { people: a.people, hidden: Object.keys(a.hidden).sort(), github: a.github, machines: {}, remotes: {} }, k;
  w.machineOrder.forEach(function (id) {
    var m = w.machines[id];
    out.machines[id] = { cwd: m.cwd.join('/'), config: m.config.map(function (e) { return e.key + '=' + e.value; }), signedIn: m.signedIn,
      login: m.login, folder: a.ide[id] && a.ide[id].folder ? a.ide[id].folder.join('/') : null, root: dirSig(w, m.root) };
  });
  for (k in w.remotes) {
    var r = w.remotes[k], br = {};
    for (var b in r.branches) br[b] = commitSig(w, r.branches[b], 30);
    out.remotes[k] = { private: r.private, collaborators: r.collaborators, branches: br, defaultBranch: r.defaultBranch };
  }
  return out;
}
function same(x, y) { return JSON.stringify(x) === JSON.stringify(y); }
function firstDiff(x, y, path) {
  if (JSON.stringify(x) === JSON.stringify(y)) return null;
  if (typeof x !== 'object' || typeof y !== 'object' || x === null || y === null) return path + ': ' + JSON.stringify(x) + ' × ' + JSON.stringify(y);
  var keys = {}, k;
  for (k in x) keys[k] = 1;
  for (k in y) keys[k] = 1;
  for (k in keys) { var d = firstDiff(x[k], y[k], path + '.' + k); if (d) return d; }
  return path;
}

// --- kroky řešení ---
// 'příkaz' | {as: id} | {write: [název, obsah]} | {gh: 'create'|'invite'|'accept'|'edit', ...}
function step(a, st) {
  if (typeof st === 'string') { S.exec(a, a.active, st); return; }
  if (st.as) { a.active = st.as; return; }
  var w = a.world, m = w.machines[a.active];
  if (st.write) { m.dir().files[st.write[0]] = st.write[1]; return; }
  if (st.open) { a.ide[a.active].folder = m.cwd.slice(); return; }
  if (st.gh === 'create') { var r = w.createRemote(m.login, st.name, { private: true, readme: !!st.readme }); r.invites = []; return; }
  if (st.gh === 'invite') { w.remotes[st.repo].invites.push(st.who); return; }
  if (st.gh === 'accept') { var rr = w.remotes[st.repo]; rr.invites = rr.invites.filter(function (x) { return x !== m.login; }); rr.collaborators.push(m.login); return; }
  if (st.gh === 'edit') { var f = {}; f[st.file] = st.content; w.webCommit(w.remotes[st.repo], m.login, f, 'Update ' + st.file); return; }
}

var PAL = '# Palačinky\n\n## Suroviny\n\n- 250 ml mléka\n- 1 vejce\n';
var SOLUTIONS = {
  volne: ['git status', 'git init'],
  pl1: ['git status', 'pwd', 'git --version', 'git config --global user.name "Jana Nováková"', 'git config --global user.email "novakovaj@jirovcovka.net"',
    'git config --global init.defaultBranch main', 'git config --global core.editor "code --wait"', 'git config --global pull.rebase false',
    'git config --global core.quotepath false', 'git config --global --list', 'cd ~', 'mkdir git', 'cd git', 'mkdir kucharka', 'cd kucharka', 'git init',
    'git status', 'code -r .', 'git status', { write: ['palacinky.md', '# Palačinky\n'] }, 'git status', { write: ['palacinky.md', PAL] }, 'git status',
    'git add palacinky.md', 'git commit -m "Přidán recept na palačinky"', { write: ['palacinky.md', PAL + '\n## Tip\n\nMarmeláda.\n'] },
    'git commit -am "Přidán tip"', 'git log', 'git log --oneline'],
  pl2: [{ write: ['palacinky.md', '# Palačinky\n\n## Postup\n\n1. Smíchej.\n'] }, 'git diff --staged', 'git diff', 'git commit -am "Přidán postup"',
    { write: ['livance.md', '# Lívance\n'] }, 'git add livance.md', 'git commit -m "Přidány lívance"',
    { write: ['README.md', '- [Palačinky](palacinky.md)\n- [Lívance](livance.md)\n'] }, 'git add .', 'git commit -m "Obsah"',
    'git log --oneline', 'git log', { write: ['palacinky.md', 'nic\n'] }, 'git restore palacinky.md', { write: ['palacinky.md', 'mléka\n'] }, 'git restore palacinky.md',
    'git restore palacinky.md', 'git restore --source=HEAD~3 palacinky.md', 'git restore palacinky.md',
    { write: ['livance.md', '# Lívance\n- 2 kg soli\n'] }, 'git commit -am "Přidána chyba"', 'git revert --no-edit HEAD',
    { write: ['poznamky-pro-me.md', 'x\n'] }, { write: ['.gitignore', 'poznamky-pro-me.md\n'] }, 'git add .gitignore', 'git commit -m "Přidán .gitignore"'],
  revert: ['git log --oneline', { write: ['livance.md', '# Lívance\n- 2 kg soli\n'] }, 'git commit -am "Přidána chyba"', 'git log --oneline', 'git revert --no-edit HEAD', 'git log --oneline'],
  pl3: ['git status', { gh: 'create', name: 'kucharka' }, 'git remote add origin https://github.com/jana-novakova/kucharka.git', 'git branch -M main',
    'git push -u origin main', { gh: 'edit', repo: 'jana-novakova/kucharka', file: 'palacinky.md', content: PAL + '\n| a | b |\n|---|---|\n| 1 | 2 |\n' },
    'git status', 'git pull', { write: ['livance.md', 'tip\n'] }, 'git add .', 'git commit -m "Tip"', 'git push'],
  'odmitnuty-push': ['git status', { write: ['buchty.md', '# Buchty\n'] }, 'git add buchty.md', 'git commit -m "Přidány buchty"', 'git push', 'git pull', 'git push'],
  spoluprace: [{ as: 'anna' }, { gh: 'create', name: 'spolecna-kucharka', readme: true }, { gh: 'invite', repo: 'anna-svobodova/spolecna-kucharka', who: 'petr-dvorak' },
    { as: 'petr' }, { gh: 'accept', repo: 'anna-svobodova/spolecna-kucharka' },
    { as: 'anna' }, 'git clone https://github.com/anna-svobodova/spolecna-kucharka.git', 'cd spolecna-kucharka', 'code -r .',
    { as: 'petr' }, 'git clone https://github.com/anna-svobodova/spolecna-kucharka.git', 'cd spolecna-kucharka', 'code -r .',
    { as: 'anna' }, { write: ['bramboracka.md', '# Bramboračka\n'] }, 'git add .', 'git commit -m "Přidána bramboračka"', 'git push',
    { as: 'petr' }, { write: ['buchty.md', '# Buchty\n'] }, 'git add .', 'git commit -m "Přidány buchty"', 'git push', 'git pull', 'git push',
    { as: 'anna' }, 'git pull', { write: ['README.md', '# spolecna-kucharka\n\n> Ve dvou.\n\n- [Buchty](buchty.md)\n'] }, 'git commit -am "README"', 'git push',
    { as: 'petr' }, 'git pull'],
  vetve: ['git branch', 'git switch -c nove-recepty', { write: ['livance.md', '# Lívance\n'] }, 'git add livance.md', 'git commit -m "Přidány lívance"',
    'git switch main', { write: ['README.md', '# Kuchařka\n'] }, 'git commit -am "Upraven README"', 'git merge nove-recepty', 'git log --oneline --graph'],
  konflikt: ['git status', 'git merge uprava', 'git status', { write: ['README.md', '# Moje kuchařka\n\nOboje.\n'] }, 'git add README.md',
    'git commit -m "Vyřešen konflikt v README"', 'git log --oneline --graph']
};

Object.keys(SOLUTIONS).forEach(function (id) {
  var text = readFile(DIR + '/' + id + '.scenario');
  var compiled = L.compile(text, id);
  if (compiled.errors) { fail(id + ': scénář má chyby: ' + JSON.stringify(compiled.errors)); return; }
  var a = S.create(legacyScenario(id)), b = S.create(compiled.scenario);
  checks++;
  if (a.scen.tasks.length !== b.scen.tasks.length) fail(id + ': počet úkolů ' + a.scen.tasks.length + ' × ' + b.scen.tasks.length);
  var d = firstDiff(worldSig(a), worldSig(b), id);
  if (d) fail('výchozí stav ' + d);
  S.evaluate(a); S.evaluate(b);
  var steps = SOLUTIONS[id], i;
  for (i = 0; i < steps.length; i++) {
    step(a, steps[i]); step(b, steps[i]);
    S.evaluate(a); S.evaluate(b);
    checks++;
    var da = JSON.stringify(a.done), db = JSON.stringify(b.done);
    if (da !== db) fail(id + ' po kroku ' + (i + 1) + ' (' + JSON.stringify(steps[i]) + '): splněno původně ' + da + ', nově ' + db);
  }
  var all = b.scen.tasks.every(function (t, k) { return b.done[k]; });
  if (b.scen.tasks.length && !all) fail(id + ': řešení nesplnilo všechny úkoly (nově ' + JSON.stringify(b.done) + ')');
  print(id + ': ' + (steps.length) + ' kroků, úkoly ' + Object.keys(b.done).length + '/' + b.scen.tasks.length);
});
print('KONTROL: ' + checks + ', ROZDÍLŮ: ' + failures);
