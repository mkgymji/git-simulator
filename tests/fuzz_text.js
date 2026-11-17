// Git simulátor – Copyright (C) 2026 Michal Kočer
// SPDX-License-Identifier: GPL-2.0-only
// Spouští se přes jsc: jsc js/text.js tests/fuzz_text.js -- pripady.json
var T = globalThis.GitText;
var cases = JSON.parse(readFile(arguments[0]));
function body(a, b, alg) {
  // dočasně přepni algoritmus (unifiedDiff používá výchozí Myers)
  if (alg === 'histogram') {
    var orig = T.diffLines;
    T._alg = 'histogram';
  }
  var lines = T.unifiedDiffWith ? T.unifiedDiffWith(a, b, alg) : T.unifiedDiff(a, b);
  return lines.map(function (l) { return (l.t === '@' || l.t === '\\') ? l.s : l.t + l.s; }).join('\n') + (lines.length ? '\n' : '');
}
var out = cases.map(function (c) {
  return {
    myers: body(c.base, c.a, 'myers'),
    histogram: body(c.base, c.a, 'histogram'),
    merge: T.merge3(c.base, c.a, c.b, 'HEAD', 'uprava').text
  };
});
print(JSON.stringify(out));
