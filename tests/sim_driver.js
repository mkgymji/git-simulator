// Git simulátor – Copyright (C) 2026 Michal Kočer
// SPDX-License-Identifier: GPL-2.0-only
// jsc js/text.js js/world.js js/graph.js js/git.js tests/sim_driver.js -- kroky.json
var steps = JSON.parse(readFile(arguments[0]));
var now = 0;
var world = new GitWorld.World({ now: function () { return now; }, tz: 60 });
var results = [];
function finish(res) {
  var lines = res.lines.slice(), guard = 0;
  while (res.wait && guard++ < 5) {
    if (res.wait.type === 'editor') res = res.wait.resume(res.wait.text);
    else res = res.wait.resume(true);
    lines = lines.concat(res.lines);
  }
  return lines;
}
steps.forEach(function (s) {
  var m = s.m ? world.machines[s.m] : null;
  if (s.op === 'machine') {
    world.addAccount(s.login, s.login, s.login + '@example.com');
    world.addMachine(s.id, { login: s.login, home: s.home, signedIn: true });
  } else if (s.op === 'mkdir') m.mkdirp(m.cwd.concat([s.name]));
  else if (s.op === 'cd') { if (s.name === '..') m.cwd.pop(); else m.cwd.push(s.name); }
  else if (s.op === 'write') m.dir().files[s.name] = s.content;
  else if (s.op === 'rm') delete m.dir().files[s.name];
  else if (s.op === 'gh') { var rr = world.createRemote(s.owner, s.name, { private: false }); rr.collaborators = s.collab || []; }
  else if (s.op === 'git') {
    now = s.ts;
    var lines = finish(GitSim.git(m, s.argv));
    results.push({ i: s.i, lines: lines });
  }
});
print(JSON.stringify(results));
