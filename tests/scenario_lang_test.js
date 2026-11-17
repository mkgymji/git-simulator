// Git simulátor – Copyright (C) 2026 Michal Kočer
// SPDX-License-Identifier: GPL-2.0-only
//
// Testy jazyka scénářů: chybové hlášky (text a číslo řádku) a vybrané podmínky.
// Spuštění: jsc js/text.js js/world.js js/graph.js js/rename.js js/git.js js/shell.js \
//   js/session.js js/scenario-lang.js tests/scenario_lang_test.js
var L = GitScenarioLang, S = GitSession, bad = 0, n = 0;

function ok(cond, msg) { n++; if (!cond) { bad++; print('CHYBA TESTU: ' + msg); } }
function errs(text) { var r = L.compile(text, 't'); return r.errors || []; }
function hasErr(text, line, part, label) {
  var e = errs(text);
  ok(e.some(function (x) { return x.line === line && x.msg.indexOf(part) >= 0; }),
    label + ': čekám ř. ' + line + ' „' + part + '“, dostal ' + JSON.stringify(e));
}

var HEAD = 'FORMAT 1\nSCENARIO Test\n';
var SETUP = 'SETUP\n  MACHINE alice CONFIGURED\n  REPOSITORY projekt\n  PS> mkdir projekt\n  PS> cd projekt\n  PS> git init\nEND\n';

// --- chyby ---
hasErr('SCENARIO X\n', 1, 'FORMAT 1', 'chybí FORMAT');
hasErr('FORMAT 2\nSCENARIO X\n', 1, 'tento simulátor umí jen FORMAT 1', 'novější FORMAT');
hasErr('FORMAT jedna\n', 1, 'číslo verze', 'FORMAT bez čísla');
hasErr('FORMAT 1\nLABEL x\nSETUP\nMACHINE alice\nEND\n', 3, 'Chybí řádek SCENARIO', 'chybí SCENARIO');
hasErr('FORMAT 1\nSCENARIO X\nINTRO a\nLABEL b\nSETUP\nMACHINE alice\nEND\n', 4, 'pevné pořadí', 'pořadí hlavičky');
hasErr(HEAD + 'TASK x\nCHECK repository exists\nEND\n', 3, 'blok SETUP', 'chybí SETUP');
hasErr(HEAD + 'SETUP\n  MACHINE carol\nEND\n', 4, 'taková postava není', 'neznámá postava');
hasErr(HEAD + 'SETUP\n  MACHINE alice FAST\nEND\n', 4, 'neznámá volba FAST', 'neznámá volba MACHINE');
hasErr(HEAD + 'SETUP\n  PS> git init\nEND\n', 4, 'Nejdřív nadefinuj počítač', 'příkaz bez MACHINE');
hasErr(HEAD + 'SETUP\n  MACHINE alice\n  PS> git init\n  MACHINE bob\nEND\n', 6, 'patří na začátek SETUP', 'MACHINE po příkazu');
hasErr(HEAD + 'SETUP\n  MACHINE alice\n  FILE a.md\n    text\n', 5, 'není ukončený řádkem END', 'neukončený FILE');
hasErr(HEAD + 'SETUP\n  MACHINE alice\n  JUMP\nEND\n', 5, 'Neznámé klíčové slovo JUMP', 'neznámé slovo v SETUP');
hasErr(HEAD + 'SETUP\n  MACHINE alice\n  AS bob\nEND\n', 5, 'takový počítač není', 'AS na neexistující počítač');
hasErr(HEAD + 'SETUP\n  MACHINE alice\n  GITHUB carol/repo\nEND\n', 5, 'nepatří žádnému počítači', 'GITHUB cizí účet');
hasErr(HEAD + 'SETUP\n  PERSON tom EMAIL "t@x.cz"\n  MACHINE tom\nEND\n', 4, 'chybí NAME', 'PERSON bez NAME');
hasErr(HEAD + SETUP + 'TASK Úkol\n  CHECK file a.md is nice\nEND\n', 11, 'Neznám podmínku', 'neznámá podmínka');
hasErr(HEAD + 'SETUP\n  MACHINE alice\nEND\nTASK Úkol\n  CHECK branch x exists\nEND\n', 7, 'doplň do SETUP řádek REPOSITORY', 'podmínka bez REPOSITORY');
hasErr(HEAD + SETUP + 'TASK Úkol\n  CHECK bob: repository exists\nEND\n', 11, 'takový počítač ve scénáři není', 'neznámý počítač v CHECK');
hasErr(HEAD + SETUP + 'TASK Úkol\n  HINT a\nEND\n', 10, 'aspoň jednu podmínku CHECK', 'TASK bez CHECK');
hasErr(HEAD + SETUP + 'TASK Úkol\n  CHECK repository exists\n  HINT git init\nEND\n', 12, 'patří před QUESTION a CHECK', 'HINT po CHECK');
hasErr(HEAD + SETUP + 'TASK Úkol\n  CHECK repository exists\n', 10, 'TASK není ukončený', 'neukončený TASK');
hasErr(HEAD + SETUP + 'TASK Úkol\n  QUESTION a\n  QUESTION b\n  CHECK repository exists\nEND\n', 12, 'jen jednu QUESTION', 'dvě QUESTION');
ok(errs(HEAD + 'SETUP\n  MACHINE alice HIDDEN\nEND\n').some(function (e) { return e.msg.indexOf('viditelný') >= 0; }), 'všechny počítače skryté');

// --- správný scénář a podmínky ---
var good = HEAD + 'SETUP\n  PERSON tom NAME "Tomáš Novák"\n  MACHINE tom CONFIGURED\n  MACHINE bob\n  REPOSITORY projekt\n' +
  '  GITHUB tom/projekt README COLLABORATOR bob\n  PS> git clone https://github.com/tom/projekt.git\n  PS> cd projekt\n' +
  '  FILE a.md\n      # Nadpis\n        odsazené\n\n  END\n  PS> git add .\n  PS> git commit -m "První úprava"\n  VSCODE projekt\nEND\n' +
  'TASK Úkol s **tučným** a `kódem`\n  NOTE Pozor na *kurzívu*\n  HINT git status\n  QUESTION Proč?\n' +
  '  CHECK file a.md exists\n  CHECK file a.md contains "odsazené"\n  CHECK file a.md in HEAD contains line starting with "# Nad"\n' +
  '  CHECK file a.md in commit "první" contains "Nadpis"\n  CHECK file README.md on github tom/projekt exists\n' +
  '  CHECK commit "PRVNÍ ÚPRAVA" exists\n  CHECK commit count is at least 2\n  CHECK branch main exists\n  CHECK on branch main\n' +
  '  CHECK no merge is in progress\n  CHECK config user.name is "Tomáš Novák"\n  CHECK config user.email contains "@example.com"\n' +
  '  CHECK vscode folder is projekt\n  CHECK github tom/projekt has collaborator bob\n  CHECK github tom/projekt has branch main\nEND\n' +
  'TASK Druhý\n  CHECK command "git status" was run\n  CHECK output of "git status" contains "ahead"\n  CHECK github tom/projekt main equals HEAD\nEND\n';
var r = L.compile(good, 'dobry');
ok(!r.errors, 'správný scénář se přeloží: ' + JSON.stringify(r.errors));
if (r.scenario) {
  var sc = r.scenario;
  ok(sc.tasks[0].text.indexOf('<b>tučným</b>') >= 0 && sc.tasks[0].text.indexOf('<code>kódem</code>') >= 0, 'inline Markdown v TASK');
  ok(sc.tasks[0].hint.indexOf('<em>kurzívu</em>') >= 0 && sc.tasks[0].hint.indexOf('<pre>git status</pre>') >= 0, 'NOTE a HINT');
  var a = S.create(sc);
  ok(a.people.join() === 'tom,bob', 'pořadí počítačů');
  ok(a.persons.tom.email === 'tom@example.com' && a.persons.tom.label === 'Počítač (Tomáš Novák)', 'výchozí e-mail a popisek postavy');
  var f = a.world.machines.tom.dirAt(['Users', 'tom', 'projekt']).files['a.md'];
  ok(f === '# Nadpis\n  odsazené\n', 'FILE: odsazení a koncové prázdné řádky: ' + JSON.stringify(f));
  S.evaluate(a);
  ok(a.done[0] === true, 'první úkol splněný hned po přípravě');
  ok(!a.done[1], 'druhý úkol zatím ne');
  S.exec(a, 'tom', 'git status');
  S.evaluate(a);
  ok(!a.done[1], 'druhý úkol: chybí shoda s GitHubem');
  S.exec(a, 'tom', 'git push');
  S.exec(a, 'tom', 'git status');
  S.evaluate(a);
  ok(a.done[1] === true, 'po push: GitHub = HEAD a dřívější výstup git status obsahoval "ahead"');
}
// prefixový příkaz a "after"
var r2 = L.compile(HEAD + SETUP + 'TASK T\n  CHECK command "git log..." was run\n  CHECK command "git status" was run after command "git log..."\nEND\n', 'x');
ok(!r2.errors, 'prefixové podmínky');
if (r2.scenario) {
  var b = S.create(r2.scenario);
  S.exec(b, 'alice', 'git status'); S.evaluate(b); ok(!b.done[0], 'status před log nestačí');
  S.exec(b, 'alice', 'git log --oneline'); S.evaluate(b); ok(!b.done[0], 'log bez následného status nestačí');
  S.exec(b, 'alice', 'git status'); S.evaluate(b); ok(b.done[0], 'status po log');
}
// chyby v příkazech přípravy
var tr = L.compileAndTry(HEAD + 'SETUP\n  MACHINE alice\n  PS> mkdir p\n  PS> cd p\n  PS> git innit\n  PS> cd neni\nEND\n', 'y');
ok(tr.errors && tr.errors.length === 2 && tr.errors[0].line === 7 && tr.errors[0].msg.indexOf("'innit' is not a git command") >= 0 && tr.errors[1].line === 8,
  'chyby příkazů v SETUP: ' + JSON.stringify(tr.errors));
var tr2 = L.compileAndTry(HEAD + 'SETUP\n  MACHINE alice\n  PS> git commit -m "x"\nEND\n', 'z');
ok(tr2.errors && tr2.errors[0].line === 5 && /not a git repository/.test(tr2.errors[0].msg), 'git mimo repozitář v SETUP: ' + JSON.stringify(tr2.errors));
// vestavěné scénáře: příprava bez chyb
(typeof GitBuiltinScenarios !== 'undefined' ? GitBuiltinScenarios : []).forEach(function (it) {
  var rr = L.compileAndTry(it.text, it.id);
  ok(!rr.errors, 'vestavěný scénář ' + it.file + ' bez chyb: ' + JSON.stringify(rr.errors));
});
print('TESTŮ: ' + n + ', CHYB: ' + bad);
