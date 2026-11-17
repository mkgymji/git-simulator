// Git simulátor – Copyright (C) 2026 Michal Kočer
// SPDX-License-Identifier: GPL-2.0-only
// jsc js/text.js tests/fuzz_cc.js -- pripady.json
var T = globalThis.GitText;
var cases = JSON.parse(readFile(arguments[0]));
print(JSON.stringify(cases.map(function (c) {
  return T.combinedDiff(c.work, [c.ours, c.theirs]).map(function (segs) {
    return segs.map(function (x) { return x[0]; }).join('');
  }).join('\n');
})));
