// Git simulátor – Copyright (C) 2026 Michal Kočer
// SPDX-License-Identifier: GPL-2.0-only
//
// Test ekvivalence: scénáře v jazyce scénářů (scenarios/*.scenario) × původní scénáře
// v JavaScriptu (tests/legacy_scenarios.js). Porovná výchozí stav světa a po každém kroku
// řešení i to, které úkoly jsou splněné.
//
// Spuštění: jsc js/text.js js/world.js js/graph.js js/rename.js js/git.js js/shell.js \
//   js/session.js js/scenario-lang.js tests/legacy_scenarios.js tests/solutions.js tests/scenario_equiv.js -- <složka scenarios>
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

var SOLUTIONS = GitSolutions.cs, step = GitSolutions.step;

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
