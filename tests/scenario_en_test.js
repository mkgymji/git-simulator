// Git simulátor – Copyright (C) 2026 Michal Kočer
// SPDX-License-Identifier: GPL-2.0-only
//
// Test anglických scénářů (scenarios/en/) proti českým (scenarios/): stejný počet úkolů
// a podmínek, a když se obě verze řeší stejnými kroky (tests/solutions.js), odškrtávají
// se úkoly ve stejném okamžiku a nakonec jsou splněné všechny. Běží v angličtině.
//
// Spuštění: jsc js/i18n.js js/i18n-en.js tests/lang_en.js js/text.js js/world.js js/graph.js \
//   js/rename.js js/git.js js/shell.js js/session.js js/scenario-lang.js tests/solutions.js \
//   tests/scenario_en_test.js -- <složka scenarios>
var DIR = arguments[0] || 'scenarios';
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
  if (te.length && !te.every(function (t, k) { return b.done[k]; })) fail(id + ': anglické řešení nesplnilo všechny úkoly ' + JSON.stringify(b.done));
  print(id + ': ' + se.length + ' kroků, úkoly ' + Object.keys(b.done).length + '/' + te.length);
});
print('EN KONTROL: ' + checks + ', ROZDÍLŮ: ' + failures);
