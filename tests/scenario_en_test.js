// Git simulátor – Copyright (C) 2026 Michal Kočer
// SPDX-License-Identifier: GPL-2.0-only
//
// Test vestavěných scénářů: české (scenarios/) i anglické (scenarios/en/) jdou vyřešit (tests/solutions.js),
// každý blok AUTO proběhne a anglická verze odpovídá české: stejný počet úkolů, a když se obě verze řeší stejnými kroky (tests/solutions.js), odškrtávají
// se úkoly ve stejném okamžiku a nakonec jsou splněné všechny. Běží v angličtině.
//
// Spuštění: jsc js/i18n.js js/i18n-en.js tests/lang_en.js js/text.js js/world.js js/graph.js \
//   js/rename.js js/git.js js/shell.js js/session.js js/scenario-lang.js tests/solutions.js \
//   tests/scenario_en_test.js -- <složka scenarios>
var DIR = arguments[0] || 'scenarios';
// pevné hodiny: porovnávají se různé běhy a hashe commitů závisí na čase
var FIXED_NOW = Date.now();
Date.now = function () { return FIXED_NOW; };
var S = GitSession, L = GitScenarioLang, SOL = GitSolutions;
var failures = 0, checks = 0;
function fail(msg) { failures++; print('ROZDÍL: ' + msg); }

if (GitI18n.lang !== 'en') fail('test neběží v angličtině');
Object.keys(SOL.cs).forEach(function (id) {
  var cs = L.compileAndTry(readFile(DIR + '/' + id + '.scenario'), id);
  var en = L.compileAndTry(readFile(DIR + '/en/' + id + '.scenario'), id);
  if (cs.errors) { fail(id + ' (cs): ' + JSON.stringify(cs.errors)); return; }
  if (en.errors) { fail(id + ' (en): ' + JSON.stringify(en.errors)); return; }
  var tc = cs.scenario.tasks, te = en.scenario.tasks;
  checks++;
  if (tc.length !== te.length) { fail(id + ': počet úkolů ' + tc.length + ' × ' + te.length); return; }
  var a = S.create(cs.scenario), b = S.create(en.scenario);
  if (JSON.stringify(a.people) !== JSON.stringify(b.people)) fail(id + ': jiné počítače ' + a.people + ' × ' + b.people);
  S.evaluate(a); S.evaluate(b);
  var sc = SOL.cs[id], se = SOL.en[id];
  if (sc.length !== se.length) { fail(id + ': řešení mají různý počet kroků'); return; }
  for (var i = 0; i < sc.length; i++) {
    SOL.step(a, sc[i]); SOL.step(b, se[i]);
    S.evaluate(a); S.evaluate(b);
    checks++;
    var da = JSON.stringify(a.done), db = JSON.stringify(b.done);
    if (da !== db) fail(id + ' po kroku ' + (i + 1) + ' (' + JSON.stringify(se[i]) + '): česky ' + da + ', anglicky ' + db);
  }
  if (tc.length && !tc.every(function (t, k) { return a.done[k]; })) fail(id + ': české řešení nesplnilo všechny úkoly ' + JSON.stringify(a.done));
  if (te.length && !te.every(function (t, k) { return b.done[k]; })) fail(id + ': anglické řešení nesplnilo všechny úkoly ' + JSON.stringify(b.done));
  // každý blok AUTO proběhl (v obou jazycích stejně)
  [[a, tc, 'česky'], [b, te, 'anglicky']].forEach(function (x) {
    var total = 0;
    x[1].forEach(function (t) { total += (t.autos || []).length; });
    if (Object.keys(x[0].autoFired).length !== total) fail(id + ' ' + x[2] + ': proběhlo AUTO ' + Object.keys(x[0].autoFired).length + ' z ' + total);
  });
  checks++;
  if (id === 'pl1') [a, b].forEach(function (x) {
    var cfg = x.world.machines.jana.config.map(function (e) { return e.key + '=' + e.value; }).join(';');
    if (cfg.indexOf('user.email=novakovaj@jirovcovka.net') < 0 || cfg.indexOf('core.quotepath=false') < 0) fail('pl1: AUTO nenastavil config: ' + cfg);
  });
  print(id + ': ' + se.length + ' kroků, úkoly ' + Object.keys(b.done).length + '/' + te.length);
});
// --- Začít úkol znovu: uprostřed každého úkolu ho vrátit na začátek, pak dokončit stejnými kroky ---
function stamp(a) {
  var w = a.world, out = { done: a.done, active: a.active, machines: {}, remotes: {} };
  w.machineOrder.forEach(function (id) {
    var m = w.machines[id];
    out.machines[id] = { cwd: m.cwd.join('/'), config: m.config.map(function (e) { return e.key + '=' + e.value; }).join(';'), log: a.log[id].length,
      term: a.term[id].lines.length, root: JSON.stringify(m.root, function (k, v) { return k === 'times' ? undefined : v; }) };
  });
  for (var k in w.remotes) out.remotes[k] = JSON.stringify(w.remotes[k].branches) + w.remotes[k].collaborators;
  return JSON.stringify(out);
}
[['cs', ''], ['en', 'en/']].forEach(function (lg) {
  Object.keys(SOL.cs).forEach(function (id) {
    var sc = L.compile(readFile(DIR + '/' + lg[1] + id + '.scenario'), id).scenario, steps = SOL[lg[0]][id];
    if (!sc.tasks.length) return;
    // kdy se který úkol stal aktuálním (index prvního kroku, který se v něm dělá) a stav v tu chvíli
    var ref = S.create(sc), startAt = {}, startStamp = {};
    S.evaluate(ref);
    startAt[S.currentTask(ref)] = 0; startStamp[S.currentTask(ref)] = stamp(ref);
    steps.forEach(function (st, k) {
      SOL.step(ref, st); S.evaluate(ref);
      var c = S.currentTask(ref);
      if (c >= 0 && startAt[c] === undefined) { startAt[c] = k + 1; startStamp[c] = stamp(ref); }
    });
    Object.keys(startAt).forEach(function (cs) {
      var c = +cs, from = startAt[c], to = c + 1 < sc.tasks.length && startAt[c + 1] !== undefined ? startAt[c + 1] : steps.length;
      if (to - from < 1) return;
      var a = S.create(sc), k;
      S.evaluate(a);
      for (k = 0; k < from + Math.ceil((to - from) / 2); k++) { SOL.step(a, steps[k]); S.evaluate(a); }
      checks++;
      if (!S.canRestart(a, c)) { fail(lg[0] + ' ' + id + ': úkol ' + (c + 1) + ' nejde začít znovu'); return; }
      S.restartTask(a, c);
      if (stamp(a) !== startStamp[c]) { fail(lg[0] + ' ' + id + ': po „začít úkol ' + (c + 1) + ' znovu“ jiný stav než na jeho začátku'); return; }
      for (k = from; k < steps.length; k++) { SOL.step(a, steps[k]); S.evaluate(a); }
      if (!sc.tasks.every(function (t, j) { return a.done[j]; })) fail(lg[0] + ' ' + id + ': po restartu úkolu ' + (c + 1) + ' řešení nedoběhlo ' + JSON.stringify(a.done));
    });
  });
});

print('EN KONTROL: ' + checks + ', ROZDÍLŮ: ' + failures);
