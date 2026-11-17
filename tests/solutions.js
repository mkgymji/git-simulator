// Git simulátor – Copyright (C) 2026 Michal Kočer
// SPDX-License-Identifier: GPL-2.0-only
//
// Řešení vestavěných scénářů pro testy: české (scenarios/) a anglické (scenarios/en/).
// Anglické řešení je krok za krokem stejné jako české, jen s anglickými názvy a texty.
// Kroky: 'příkaz' | {as: id} | {write: [název, obsah]} | {open: true} | {gh: 'create'|'invite'|'accept'|'edit', ...}
var GitSolutions = (function () {
// 'příkaz' | {as: id} | {write: [název, obsah]} | {gh: 'create'|'invite'|'accept'|'edit', ...}
function step(a, st) {
  var S = GitSession;
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

var PAL_CS = '# Palačinky\n\n## Suroviny\n\n- 250 ml mléka\n- 1 vejce\n';
var CS = {
  volne: ['git status', 'git init'],
  pl1: ['git status', 'pwd', 'git --version', 'git config --global user.name "Jana Nováková"', 'git config --global user.email "novakovaj@jirovcovka.net"',
    'git config --global init.defaultBranch main', 'git config --global core.editor "code --wait"', 'git config --global pull.rebase false',
    'git config --global core.quotepath false', 'git config --global --list', 'cd ~', 'mkdir git', 'cd git', 'mkdir kucharka', 'cd kucharka', 'git init',
    'git status', 'code -r .', 'git status', { write: ['palacinky.md', '# Palačinky\n'] }, 'git status', { write: ['palacinky.md', PAL_CS] }, 'git status',
    'git add palacinky.md', 'git commit -m "Přidán recept na palačinky"', { write: ['palacinky.md', PAL_CS + '\n## Tip\n\nMarmeláda.\n'] },
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
    'git push -u origin main', { gh: 'edit', repo: 'jana-novakova/kucharka', file: 'palacinky.md', content: PAL_CS + '\n| a | b |\n|---|---|\n| 1 | 2 |\n' },
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


var PAL_EN = '# Pancakes\n\n## Ingredients\n\n- 250 ml milk\n- 1 egg\n';
var EN = {
  volne: ['git status', 'git init'],
  pl1: ['git status', 'pwd', 'git --version', 'git config --global user.name "Jana Nováková"', 'git config --global user.email "novakovaj@jirovcovka.net"',
    'git config --global init.defaultBranch main', 'git config --global core.editor "code --wait"', 'git config --global pull.rebase false',
    'git config --global core.quotepath false', 'git config --global --list', 'cd ~', 'mkdir git', 'cd git', 'mkdir cookbook', 'cd cookbook', 'git init',
    'git status', 'code -r .', 'git status', { write: ['pancakes.md', '# Pancakes\n'] }, 'git status', { write: ['pancakes.md', PAL_EN] }, 'git status',
    'git add pancakes.md', 'git commit -m "Add pancake recipe"', { write: ['pancakes.md', PAL_EN + '\n## Tip\n\nJam.\n'] },
    'git commit -am "Add tip"', 'git log', 'git log --oneline'],
  pl2: [{ write: ['pancakes.md', '# Pancakes\n\n## Method\n\n1. Mix.\n'] }, 'git diff --staged', 'git diff', 'git commit -am "Add method"',
    { write: ['drop-scones.md', '# Drop scones\n'] }, 'git add drop-scones.md', 'git commit -m "Add drop scones"',
    { write: ['README.md', '- [Pancakes](pancakes.md)\n- [Drop scones](drop-scones.md)\n'] }, 'git add .', 'git commit -m "Contents"',
    'git log --oneline', 'git log', { write: ['pancakes.md', 'nothing\n'] }, 'git restore pancakes.md', { write: ['pancakes.md', 'milk\n'] }, 'git restore pancakes.md',
    'git restore pancakes.md', 'git restore --source=HEAD~3 pancakes.md', 'git restore pancakes.md',
    { write: ['drop-scones.md', '# Drop scones\n- 2 kg salt\n'] }, 'git commit -am "Add mistake"', 'git revert --no-edit HEAD',
    { write: ['notes-for-me.md', 'x\n'] }, { write: ['.gitignore', 'notes-for-me.md\n'] }, 'git add .gitignore', 'git commit -m "Add .gitignore"'],
  revert: ['git log --oneline', { write: ['drop-scones.md', '# Drop scones\n- 2 kg salt\n'] }, 'git commit -am "Add mistake"', 'git log --oneline', 'git revert --no-edit HEAD', 'git log --oneline'],
  pl3: ['git status', { gh: 'create', name: 'cookbook' }, 'git remote add origin https://github.com/jana-novakova/cookbook.git', 'git branch -M main',
    'git push -u origin main', { gh: 'edit', repo: 'jana-novakova/cookbook', file: 'pancakes.md', content: PAL_EN + '\n| a | b |\n|---|---|\n| 1 | 2 |\n' },
    'git status', 'git pull', { write: ['drop-scones.md', 'tip\n'] }, 'git add .', 'git commit -m "Tip"', 'git push'],
  'odmitnuty-push': ['git status', { write: ['buns.md', '# Buns\n'] }, 'git add buns.md', 'git commit -m "Add buns"', 'git push', 'git pull', 'git push'],
  spoluprace: [{ as: 'anna' }, { gh: 'create', name: 'shared-cookbook', readme: true }, { gh: 'invite', repo: 'anna-svobodova/shared-cookbook', who: 'petr-dvorak' },
    { as: 'petr' }, { gh: 'accept', repo: 'anna-svobodova/shared-cookbook' },
    { as: 'anna' }, 'git clone https://github.com/anna-svobodova/shared-cookbook.git', 'cd shared-cookbook', 'code -r .',
    { as: 'petr' }, 'git clone https://github.com/anna-svobodova/shared-cookbook.git', 'cd shared-cookbook', 'code -r .',
    { as: 'anna' }, { write: ['potato-soup.md', '# Potato soup\n'] }, 'git add .', 'git commit -m "Add potato soup"', 'git push',
    { as: 'petr' }, { write: ['buns.md', '# Buns\n'] }, 'git add .', 'git commit -m "Add buns"', 'git push', 'git pull', 'git push',
    { as: 'anna' }, 'git pull', { write: ['README.md', '# shared-cookbook\n\n> Together.\n\n- [Buns](buns.md)\n'] }, 'git commit -am "README"', 'git push',
    { as: 'petr' }, 'git pull'],
  vetve: ['git branch', 'git switch -c new-recipes', { write: ['drop-scones.md', '# Drop scones\n'] }, 'git add drop-scones.md', 'git commit -m "Add drop scones"',
    'git switch main', { write: ['README.md', '# Cookbook\n'] }, 'git commit -am "Update README"', 'git merge new-recipes', 'git log --oneline --graph'],
  konflikt: ['git status', 'git merge edit', 'git status', { write: ['README.md', '# My cookbook\n\nBoth.\n'] }, 'git add README.md',
    'git commit -m "Resolve conflict in README"', 'git log --oneline --graph']
};

  return { cs: CS, en: EN, step: step };
})();
