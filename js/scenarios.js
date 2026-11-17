/* =====================================================================
 *  scenarios.js – scénáře podle pracovních listů PL1–PL4
 *
 *  Scénář: {id, kicker, title, short, intro (HTML), setup(api), tasks: [...]}
 *  Úkol: {text (HTML), hint (HTML), question?, check(c) -> bool}
 *  Splněný úkol zůstává splněný (i když se stav později změní).
 * ===================================================================== */
(function (root) {
  'use strict';

  var PEOPLE = {
    jana: { login: 'jana-novakova', name: 'Jana Nováková', email: 'novakovaj@jirovcovka.net', label: 'Počítač Jany' },
    anna: { login: 'anna-svobodova', name: 'Anna Svobodová', email: 'svobodovaa@jirovcovka.net', label: 'Počítač Anny' },
    petr: { login: 'petr-dvorak', name: 'Petr Dvořák', email: 'dvorakp@jirovcovka.net', label: 'Počítač Petra' }
  };

  var PAL1 = '# Palačinky\n\n## Suroviny\n\n- 250 ml mléka\n- 1 vejce\n- 120 g hladké mouky\n- špetka soli\n';
  var PAL_TIP = PAL1 + '\n## Tip\n\nPlním je jahodovou marmeládou.\n';
  var LIV = '# Lívance\n\n## Suroviny\n\n- 300 ml mléka\n- 2 vejce\n- 250 g polohrubé mouky\n- 1 lžička prášku do pečiva\n\n## Postup\n\n1. Smíchej suroviny.\n2. Smaž malé placky na pánvi.\n\n*Nejlepší jsou teplé.*\n';
  var README = '# Moje kuchařka\n\nRecepty, které umím uvařit.\n\n- [Palačinky](palacinky.md)\n- [Lívance](livance.md)\n';

  // ------------------------------------------------------------------
  //  Pomocné kontroly
  // ------------------------------------------------------------------
  function cfgSet(m, key) { return m.getConfig(key) !== undefined; }
  function repoAt(m, path) { var d = m.dirAt(path); return d && d.repo ? d.repo : null; }
  function ran(c, mid, re) { return c.log(mid).some(function (e) { return re.test(e.line); }); }
  function commits(c, repo, ref) {
    var h = ref ? (repo.branches[ref] || null) : repo.headHash();
    if (!h) return [];
    return Object.keys(c.world.ancestors(h)).map(function (x) { return c.world.commits[x]; });
  }
  function treeFile(c, commit, name) { var t = c.world.trees[commit.tree]; return t && t[name] ? c.world.blobs[t[name]] : null; }
  function headFile(c, repo, name) {
    var h = repo.headHash();
    return h ? treeFile(c, c.world.commits[h], name) : null;
  }
  function lastOut(c, mid, re) {
    var l = c.log(mid), i;
    for (i = l.length - 1; i >= 0; i--) if (re.test(l[i].line)) return l[i];
    return null;
  }
  function outText(e) { return e ? e.out.map(function (l) { return l.s.map(function (x) { return x[0]; }).join(''); }).join('\n') : ''; }
  function H(m) { return ['Users', m.homeName]; }

  // ------------------------------------------------------------------
  //  Scénáře
  // ------------------------------------------------------------------
  var S = [];

  S.push({
    id: 'volne',
    kicker: 'Volný režim',
    title: 'Prázdný počítač',
    short: 'Vyzkoušej si cokoliv: terminál, Git i GitHub. Nic tu není připravené.',
    intro: '<p>Prázdný školní počítač s Gitem a VS Code. Git ještě není nastavený. Na GitHubu máš účet <b>jana-novakova</b>.</p><p>Nevíš, kde začít? Napiš <span class="cmd">help</span> nebo otevři <b>Tahák</b>.</p>',
    setup: function (api) {
      api.person('jana');
      api.github(true);
    },
    tasks: []
  });

  S.push({
    id: 'pl1',
    kicker: 'Pracovní list 1',
    title: 'Můj první repozitář',
    short: 'Nastavení Gitu, git init, add, commit – první verze receptu.',
    intro: '<p>Jsi <b>Jana Nováková</b> na školním počítači. Postupuj podle úkolů; každý se odškrtne sám, až ho splníš.</p>',
    setup: function (api) { api.person('jana'); },
    tasks: [
      { text: 'Zjisti, ve které složce jsi a jakou verzi Gitu máš.',
        hint: '<pre>pwd\ngit --version</pre>',
        check: function (c) { return ran(c, 'jana', /^\s*pwd\b/) && ran(c, 'jana', /^\s*git\s+(--version|version)\b/); } },
      { text: 'Nastav své jméno a školní e-mail.',
        hint: '<pre>git config --global user.name "Jana Nováková"\ngit config --global user.email "novakovaj@jirovcovka.net"</pre>',
        check: function (c) { var m = c.m('jana'); return cfgSet(m, 'user.name') && /@/.test(m.getConfig('user.email') || ''); } },
      { text: 'Opiš zbylé čtyři řádky nastavení. Výsledek zkontroluj příkazem <span class="cmd">git config --global --list</span>.',
        hint: '<pre>git config --global init.defaultBranch main\ngit config --global core.editor "code --wait"\ngit config --global pull.rebase false\ngit config --global core.quotepath false</pre>',
        check: function (c) {
          var m = c.m('jana');
          return m.getConfig('init.defaultbranch') === 'main' && /^code\b.*--wait/.test(m.getConfig('core.editor') || '') &&
            m.getConfig('pull.rebase') === 'false' && m.getConfig('core.quotepath') === 'false' && ran(c, 'jana', /config\s+--global\s+(--list|-l)\b/);
        } },
      { text: 'Vytvoř složku <b>git</b> a v ní <b>kucharka</b>. Otevři ji ve VS Code a udělej z ní repozitář.',
        hint: '<pre>cd ~\nmkdir git\ncd git\nmkdir kucharka\ncd kucharka\ncode -r .\ngit init\ngit status</pre>',
        question: 'Co napsal git status na posledním řádku?',
        check: function (c) {
          var m = c.m('jana'), p = H(m).concat(['git', 'kucharka']);
          return !!repoAt(m, p) && c.openFolder('jana') === p.join('/') && ran(c, 'jana', /git\s+status/);
        } },
      { text: 'V Průzkumníku vytvoř soubor <b>palacinky.md</b> a napiš recept: nadpis <code>#</code>, podnadpis <code>##</code> a odrážky <code>-</code>. Ulož (<kbd>Ctrl</kbd>+<kbd>S</kbd>) a spusť <span class="cmd">git status</span>.',
        hint: 'Klikni na ikonu <b>+</b> nad seznamem souborů. Recept může vypadat takhle:<pre>' + GitMarkdownEsc(PAL1) + '</pre>',
        question: 'Jakou barvou je název souboru a pod jakým nadpisem je?',
        check: function (c) {
          var m = c.m('jana'), d = m.dirAt(H(m).concat(['git', 'kucharka'])), t = d && d.files['palacinky.md'];
          if (!t || !/^#\s/m.test(t) || !/^##\s/m.test(t) || !/^\s*-\s/m.test(t)) return false;
          var e = lastOut(c, 'jana', /git\s+status/);
          return !!e && /Untracked files/.test(outText(e)) && /palacinky\.md/.test(outText(e));
        } },
      { text: 'Udělej první commit.',
        hint: '<pre>git add palacinky.md\ngit status\ngit commit -m "Přidán recept na palačinky"</pre>',
        question: 'Jakou barvou je soubor po git add? Co znamená -m?',
        check: function (c) { var m = c.m('jana'), r = repoAt(m, H(m).concat(['git', 'kucharka'])); return !!r && commits(c, r).some(function (k) { return !!treeFile(c, k, 'palacinky.md'); }); } },
      { text: 'Přidej do receptu <code>## Tip</code> s jednou větou a udělej druhý commit se srozumitelnou zprávou.',
        hint: '<pre>git add palacinky.md\ngit commit -m "Přidán tip na plnění"</pre>',
        check: function (c) {
          var m = c.m('jana'), r = repoAt(m, H(m).concat(['git', 'kucharka']));
          if (!r) return false;
          var t = headFile(c, r, 'palacinky.md');
          return commits(c, r).length >= 2 && !!t && /^##\s*Tip/mi.test(t);
        } },
      { text: 'Prohlédni si historii.',
        hint: '<pre>git log --oneline</pre>',
        check: function (c) { var e = lastOut(c, 'jana', /git\s+log/); return !!e && outText(e).split('\n').filter(function (l) { return /^\*?\s*[0-9a-f]{7}/.test(l); }).length >= 2 || (!!e && (outText(e).match(/^commit [0-9a-f]{40}/gm) || []).length >= 2); } }
    ]
  });

  S.push({
    id: 'pl2',
    kicker: 'Pracovní list 2',
    title: 'Historie a cestování v čase',
    short: 'git diff, git log, git restore a git revert na kuchařce se dvěma commity.',
    intro: '<p>Repozitář <b>kucharka</b> už má dva commity a je otevřený ve VS Code. Graf vpravo ukazuje historii.</p>',
    setup: function (api) {
      api.person('jana', { configured: true });
      api.mkdir('jana', ['git', 'kucharka']);
      api.cd('jana', ['git', 'kucharka']);
      api.run('jana', 'git init', 90);
      api.write('jana', 'palacinky.md', PAL1);
      api.run('jana', 'git add palacinky.md', 89);
      api.run('jana', 'git commit -m "Přidán recept na palačinky"', 88);
      api.write('jana', 'palacinky.md', PAL_TIP);
      api.run('jana', 'git commit -am "Přidán tip na plnění"', 80);
      api.open('jana', ['git', 'kucharka']);
    },
    tasks: [
      { text: 'Přidej do <b>palacinky.md</b> postup jako číslovaný seznam (<code>1.</code>, <code>2.</code>…), ulož a <b>před commitem</b> spusť <span class="cmd">git diff</span>. Pak commitni.',
        hint: '<pre>## Postup\n\n1. Všechno smíchej v míse.\n2. Nech těsto **15 minut** odpočinout.\n3. Smaž na rozpálené pánvi.</pre><pre>git diff\ngit add palacinky.md\ngit commit -m "Přidán postup"</pre>',
        question: 'Jak jsou ve výpisu označené řádky, které přibyly?',
        check: function (c) {
          var m = c.m('jana'), r = repoAt(m, H(m).concat(['git', 'kucharka'])), t = r && headFile(c, r, 'palacinky.md');
          return !!t && /^\s*1[.)]\s/m.test(t) && c.log('jana').some(function (e) { return /git\s+diff\s*$/.test(e.line) && /^\+/m.test(outText(e)); });
        } },
      { text: 'Vytvoř <b>livance.md</b> s nadpisy, odrážkami, číslovaným seznamem a poznámkou <em>kurzívou</em> (<code>*text*</code>). Commitni se zprávou <b>Přidány lívance</b>.',
        hint: '<pre>git add livance.md\ngit commit -m "Přidány lívance"</pre>',
        check: function (c) { var m = c.m('jana'), r = repoAt(m, H(m).concat(['git', 'kucharka'])); return !!r && !!headFile(c, r, 'livance.md') && commits(c, r).some(function (k) { return /lívance/i.test(k.message); }); } },
      { text: 'Vytvoř <b>README.md</b> s odkazy na oba recepty a commitni ho. Odkaz v náhledu zkus otevřít.',
        hint: '<pre>' + GitMarkdownEsc(README) + '</pre>',
        check: function (c) { var m = c.m('jana'), r = repoAt(m, H(m).concat(['git', 'kucharka'])), t = r && headFile(c, r, 'README.md'); return !!t && /\]\(palacinky\.md\)/.test(t) && /\]\(livance\.md\)/.test(t); } },
      { text: 'Prohlédni si historii oběma způsoby.',
        hint: '<pre>git log\ngit log --oneline</pre>',
        question: 'Proč má soused jiné hashe, i když dělal totéž co ty?',
        check: function (c) { return ran(c, 'jana', /git\s+log\s*$/) && ran(c, 'jana', /git\s+log\s+--oneline/); } },
      { text: 'V <b>palacinky.md</b> smaž všechny suroviny a ulož. Podívej se na <span class="cmd">git diff</span> a recept zachraň.',
        hint: '<pre>git diff\ngit restore palacinky.md</pre>',
        check: function (c) {
          var m = c.m('jana'), d = m.dirAt(H(m).concat(['git', 'kucharka']));
          return ran(c, 'jana', /git\s+restore\s+palacinky\.md\s*$/) && !!d && /mléka/.test(d.files['palacinky.md'] || '');
        } },
      { text: 'Vytáhni si <b>palacinky.md</b> ve stavu z prvního commitu a pak se vrať k nejnovější verzi.',
        hint: 'Hash prvního commitu najdeš v <span class="cmd">git log --oneline</span>.<pre>git restore --source=HASH palacinky.md\ngit restore palacinky.md</pre>',
        check: function (c) { return ran(c, 'jana', /git\s+restore\s+(--source[= ]\S+|-s\s*\S+)\s+palacinky\.md/) && c.log('jana').some(function (e, i, all) { return /--source/.test(e.line) && all.slice(i + 1).some(function (f) { return /git\s+restore\s+palacinky\.md\s*$/.test(f.line); }); }); } },
      { text: 'Přidej do <b>livance.md</b> řádek <code>- 2 kg soli</code>, commitni ho jako <b>Přidána chyba</b> a pak commit vrať.',
        hint: '<pre>git commit -am "Přidána chyba"\ngit log --oneline\ngit revert --no-edit HASH</pre>',
        question: 'Zmizel commit „Přidána chyba“ z historie? Podívej se do grafu.',
        check: function (c) {
          var m = c.m('jana'), r = repoAt(m, H(m).concat(['git', 'kucharka']));
          if (!r) return false;
          var cs = commits(c, r), bad = cs.filter(function (k) { return /chyba/i.test(k.message) && !/^Revert/.test(k.message); });
          return bad.some(function (b) { return cs.some(function (k) { return k.message.indexOf('This reverts commit ' + b.hash) >= 0; }); }) && !/2 kg soli/.test(headFile(c, r, 'livance.md') || '');
        } },
      { text: 'Vytvoř soubor <b>poznamky-pro-me.md</b>, pak <b>.gitignore</b> s řádkem <code>poznamky-pro-me.md</code>. Porovnej <span class="cmd">git status</span> před a po. Nakonec <b>.gitignore</b> commitni.',
        hint: '<pre>git status\ngit add .gitignore\ngit commit -m "Přidán .gitignore"</pre>',
        question: 'Čím se liší git restore a git revert?',
        check: function (c) { var m = c.m('jana'), r = repoAt(m, H(m).concat(['git', 'kucharka'])), t = r && headFile(c, r, '.gitignore'); return !!t && /poznamky-pro-me\.md/.test(t) && !headFile(c, r, 'poznamky-pro-me.md'); } }
    ]
  });

  S.push({
    id: 'revert',
    kicker: 'Pracovní list 2 · úkol 8',
    title: 'Historie jako graf',
    short: 'Commit s chybou a git revert – co se stane v grafu commitů.',
    intro: '<p>Kuchařka má tři commity. Vpravo vidíš graf: každý kroužek je jeden commit, šipka vede k předchozímu. Nejnovější commit je vpravo.</p>',
    setup: function (api) {
      api.person('jana', { configured: true });
      api.mkdir('jana', ['git', 'kucharka']);
      api.cd('jana', ['git', 'kucharka']);
      api.run('jana', 'git init', 120);
      api.write('jana', 'palacinky.md', PAL1); api.run('jana', 'git add .', 119); api.run('jana', 'git commit -m "Přidán recept na palačinky"', 118);
      api.write('jana', 'palacinky.md', PAL_TIP); api.run('jana', 'git commit -am "Přidán tip na plnění"', 100);
      api.write('jana', 'livance.md', LIV); api.run('jana', 'git add .', 80); api.run('jana', 'git commit -m "Přidány lívance"', 79);
      api.open('jana', ['git', 'kucharka']);
    },
    tasks: [
      { text: 'Otevři <b>livance.md</b>, přidej řádek <code>- 2 kg soli</code> a ulož (<kbd>Ctrl</kbd>+<kbd>S</kbd>). Commitni se zprávou <b>Přidána chyba</b>.',
        hint: '<pre>git commit -am "Přidána chyba"</pre><code>-a</code> přidá všechny změněné soubory, takže <span class="cmd">git add</span> není potřeba.',
        check: function (c) { var m = c.m('jana'), r = repoAt(m, H(m).concat(['git', 'kucharka'])); return !!r && commits(c, r).some(function (k) { return /chyba/i.test(k.message) && !/^(Revert|Reapply)/.test(k.message) && /2 kg soli/.test(treeFile(c, k, 'livance.md') || ''); }); } },
      { text: 'Najdi hash commitu <b>Přidána chyba</b> a commit vrať.',
        hint: '<pre>git log --oneline\ngit revert --no-edit HASH</pre>Místo <code>HASH</code> napiš hash z výpisu (7 znaků).',
        question: 'Kolik kroužků je v grafu? Zmizel commit Přidána chyba?',
        check: function (c) {
          var m = c.m('jana'), r = repoAt(m, H(m).concat(['git', 'kucharka']));
          if (!r) return false;
          var cs = commits(c, r), bad = cs.filter(function (k) { return /chyba/i.test(k.message) && !/^(Revert|Reapply)/.test(k.message); });
          return bad.some(function (b) { return cs.some(function (k) { return k.message.indexOf('This reverts commit ' + b.hash) >= 0; }); }) && !/2 kg soli/.test(headFile(c, r, 'livance.md') || '');
        } },
      { text: 'Porovnej graf s výpisem <span class="cmd">git log --oneline</span>.',
        hint: '<pre>git log --oneline</pre>',
        question: 'Kde je nejnovější commit v grafu a kde ve výpisu?',
        check: function (c) { var e = lastOut(c, 'jana', /git\s+log/); return !!e && /Revert/.test(outText(e)); } }
    ]
  });

  S.push({
    id: 'pl3',
    kicker: 'Pracovní list 3',
    title: 'Kuchařka na GitHubu',
    short: 'Prázdný repozitář na GitHubu, git push, úprava na webu a git pull.',
    intro: '<p>Kuchařka má pět commitů. Na GitHubu jsi přihlášená jako <b>jana-novakova</b>. Záložka <b>GitHub</b> nahoře je prohlížeč.</p>',
    setup: function (api) {
      api.person('jana', { configured: true });
      api.github(true);
      api.mkdir('jana', ['git', 'kucharka']);
      api.cd('jana', ['git', 'kucharka']);
      api.run('jana', 'git init', 300);
      api.write('jana', 'palacinky.md', PAL1); api.run('jana', 'git add .', 299); api.run('jana', 'git commit -m "Přidán recept na palačinky"', 298);
      api.write('jana', 'palacinky.md', PAL_TIP); api.run('jana', 'git commit -am "Přidán tip na plnění"', 290);
      api.write('jana', 'livance.md', LIV); api.run('jana', 'git add .', 200); api.run('jana', 'git commit -m "Přidány lívance"', 199);
      api.write('jana', 'README.md', README); api.run('jana', 'git add .', 150); api.run('jana', 'git commit -m "Přidán obsah kuchařky"', 149);
      api.write('jana', '.gitignore', 'poznamky-pro-me.md\n'); api.run('jana', 'git add .', 100); api.run('jana', 'git commit -m "Přidán .gitignore"', 99);
      api.open('jana', ['git', 'kucharka']);
    },
    tasks: [
      { text: 'Na GitHubu vytvoř repozitář <b>kucharka</b>: <b>Private</b> a <b>nic nezaškrtávej</b>.',
        hint: 'Záložka <b>GitHub</b> → tlačítko <b>New</b> → název <code>kucharka</code> → Private → Create repository.',
        question: 'Proč tentokrát nezaškrtáváme Add a README file?',
        check: function (c) { var r = c.world.remotes['jana-novakova/kucharka']; return !!r; } },
      { text: 'Propoj repozitář s GitHubem a pošli ho tam. Při přihlášení zvol <b>Sign in with your browser</b>.',
        hint: '<pre>git remote add origin https://github.com/jana-novakova/kucharka.git\ngit branch -M main\ngit push -u origin main</pre>',
        check: function (c) { var r = c.world.remotes['jana-novakova/kucharka']; return !!r && !!r.branches.main; } },
      { text: 'Na GitHubu otevři <b>palacinky.md</b>, klikni na tužku a přidej na konec tabulku. Potvrď <b>Commit changes</b>.',
        hint: '<pre>## Na kolik porcí\n\n| Porce | Mléko  | Mouka |\n|-------|--------|-------|\n| 2     | 250 ml | 120 g |\n| 4     | 500 ml | 240 g |</pre>',
        check: function (c) { var r = c.world.remotes['jana-novakova/kucharka'], h = r && r.branches.main; return !!h && /\|/.test(treeFile(c, c.world.commits[h], 'palacinky.md') || ''); } },
      { text: 'Vrať se do VS Code a napiš <span class="cmd">git status</span>. Pak změnu stáhni.',
        hint: '<pre>git status\ngit pull</pre>',
        question: 'Ví Git v počítači o změně na GitHubu? Proč?',
        check: function (c) { var m = c.m('jana'), d = m.dirAt(H(m).concat(['git', 'kucharka'])); return ran(c, 'jana', /git\s+pull/) && !!d && /\|/.test(d.files['palacinky.md'] || ''); } },
      { text: 'Přidej do <b>livance.md</b> tip, commitni a pošli na GitHub.',
        hint: '<pre>git add .\ngit commit -m "Přidán tip k lívancům"\ngit push</pre>',
        check: function (c) {
          var m = c.m('jana'), d = m.dirAt(H(m).concat(['git', 'kucharka'])), r = c.world.remotes['jana-novakova/kucharka'];
          if (!d || !d.repo || !r || !r.branches.main) return false;
          var local = d.repo.headHash();
          return local === r.branches.main && commits(c, d.repo).length >= 7;
        } }
    ]
  });

  S.push({
    id: 'odmitnuty-push',
    kicker: 'Pracovní list 4 · nanečisto',
    title: 'Odmítnutý push',
    short: 'Někdo mezitím pushnul na GitHub. Co udělá git push a jak to vyřešit.',
    intro: '<p>Jsi <b>Petr</b>. Se spolužačkou Annou máte společný repozitář <b>spolecna-kucharka</b> a máš ho naklonovaný. Anna právě pushnula svůj recept – ty o tom zatím nevíš.</p><p>Vpravo vidíš historii svého počítače a pod ní GitHub.</p>',
    setup: function (api) {
      api.person('anna', { configured: true, hidden: true });
      api.person('petr', { configured: true });
      api.remote('anna-svobodova', 'spolecna-kucharka', { readme: true, collaborators: ['petr-dvorak'] }, 120);
      api.mkdir('petr', ['git']); api.cd('petr', ['git']);
      api.run('petr', 'git clone https://github.com/anna-svobodova/spolecna-kucharka.git', 100);
      api.cd('petr', ['git', 'spolecna-kucharka']);
      api.mkdir('anna', ['git']); api.cd('anna', ['git']);
      api.run('anna', 'git clone https://github.com/anna-svobodova/spolecna-kucharka.git', 99);
      api.cd('anna', ['git', 'spolecna-kucharka']);
      api.write('anna', 'bramboracka.md', '# Bramboračka\n\n- 4 brambory\n- 1 cibule\n- majoránka\n');
      api.run('anna', 'git add .', 10); api.run('anna', 'git commit -m "Přidána bramboračka"', 9); api.run('anna', 'git push', 8);
      api.open('petr', ['git', 'spolecna-kucharka']);
    },
    tasks: [
      { text: 'Vytvoř soubor <b>buchty.md</b> s receptem a commitni ho.',
        hint: '<pre>git add buchty.md\ngit commit -m "Přidány buchty"</pre>',
        check: function (c) { var m = c.m('petr'), r = repoAt(m, H(m).concat(['git', 'spolecna-kucharka'])); return !!r && !!headFile(c, r, 'buchty.md'); } },
      { text: 'Zkus pushnout.',
        hint: '<pre>git push</pre>',
        question: 'Co se stalo? Přečti si řádky hint.',
        check: function (c) { return c.log('petr').some(function (e) { return /git\s+push/.test(e.line) && /\[rejected\]/.test(outText(e)); }); } },
      { text: 'Stáhni Annin commit. Otevře se <b>MERGE_MSG</b> – nic neměň, jen ho zavři.',
        hint: '<pre>git pull</pre>',
        question: 'Jaký nový commit se objevil v grafu a kolik má předchůdců?',
        check: function (c) { var m = c.m('petr'), r = repoAt(m, H(m).concat(['git', 'spolecna-kucharka'])); return !!r && !!r.headHash() && c.world.commits[r.headHash()].parents.length === 2; } },
      { text: 'Pushni znovu.',
        hint: '<pre>git push</pre>',
        check: function (c) { var m = c.m('petr'), r = repoAt(m, H(m).concat(['git', 'spolecna-kucharka'])), rem = c.world.remotes['anna-svobodova/spolecna-kucharka']; return !!r && rem.branches.main === r.headHash() && c.world.commits[r.headHash()].parents.length === 2; } }
    ]
  });

  S.push({
    id: 'spoluprace',
    kicker: 'Pracovní list 4',
    title: 'Společná kuchařka ve dvojici',
    short: 'Anna a Petr: společný repozitář, pozvánka, klonování, odmítnutý push a pull.',
    intro: '<p>Hraješ za oba: <b>Annu</b> (vlastní repozitář) i <b>Petra</b> (spolupracovník). Mezi jejich počítači a GitHubem přepínáš záložkami nahoře.</p>',
    setup: function (api) {
      api.person('anna', { configured: true });
      api.person('petr', { configured: true });
      api.github(true);
      api.mkdir('anna', ['git']); api.cd('anna', ['git']);
      api.mkdir('petr', ['git']); api.cd('petr', ['git']);
    },
    tasks: [
      { text: '<b>Anna</b> na GitHubu vytvoří repozitář <b>spolecna-kucharka</b>: Private a <b>zaškrtne</b> Add a README file.',
        hint: 'Přepni na <b>GitHub (Anna)</b> → New → název, Private, zaškrtnout <b>Add a README file</b> → Create repository.',
        check: function (c) { var r = c.world.remotes['anna-svobodova/spolecna-kucharka']; return !!r && !!r.branches.main; } },
      { text: '<b>Anna</b> pozve Petra: Settings → Collaborators → Add people → <b>petr-dvorak</b>. <b>Petr</b> pozvánku přijme.',
        hint: 'Pozvánku Petr uvidí na GitHubu nahoře (záložka <b>GitHub (Petr)</b>).',
        check: function (c) { var r = c.world.remotes['anna-svobodova/spolecna-kucharka']; return !!r && r.collaborators.indexOf('petr-dvorak') >= 0; } },
      { text: 'Oba si repozitář naklonují do složky <b>git</b> a otevřou ho ve VS Code.',
        hint: '<pre>git clone https://github.com/anna-svobodova/spolecna-kucharka.git\ncd spolecna-kucharka\ncode -r .</pre>',
        check: function (c) { return ['anna', 'petr'].every(function (id) { var m = c.m(id); return !!repoAt(m, H(m).concat(['git', 'spolecna-kucharka'])); }); } },
      { text: 'Každý vytvoří <b>jiný</b> recept a commitne ho. <b>Anna</b> pushne první, <b>potom</b> Petr.',
        hint: '<pre>git add .\ngit commit -m "Přidána bramboračka"\ngit push</pre>',
        question: 'Co se stalo při Petrově pushi?',
        check: function (c) { return c.log('petr').some(function (e) { return /git\s+push/.test(e.line) && /\[rejected\]/.test(outText(e)); }); } },
      { text: '<b>Petr</b> to vyřeší podle rady v hint: stáhne a pushne znovu. <b>Anna</b> si pak stáhne Petrův recept.',
        hint: 'Petr:<pre>git pull\ngit push</pre>Anna:<pre>git pull</pre>',
        check: function (c) {
          var ra = repoAt(c.m('anna'), H(c.m('anna')).concat(['git', 'spolecna-kucharka'])), rp = repoAt(c.m('petr'), H(c.m('petr')).concat(['git', 'spolecna-kucharka']));
          var rem = c.world.remotes['anna-svobodova/spolecna-kucharka'];
          return !!ra && !!rp && !!rem && ra.headHash() === rem.branches.main && rp.headHash() === rem.branches.main && c.world.commits[rem.branches.main].parents.length === 2;
        } },
      { text: '<b>Anna</b> doplní do README odkazy na oba recepty a citaci (<code>&gt;</code>), commitne a pushne. <b>Petr</b> stáhne.',
        hint: '<pre># spolecna-kucharka\n\n&gt; Kuchařka, kterou píšeme ve dvou.\n\n- [Bramboračka](bramboracka.md)\n- [Buchty](buchty.md)</pre>',
        question: 'Kterými dvěma příkazy začínáš a končíš práci na společném projektu?',
        check: function (c) {
          var rem = c.world.remotes['anna-svobodova/spolecna-kucharka'], rp = repoAt(c.m('petr'), H(c.m('petr')).concat(['git', 'spolecna-kucharka']));
          if (!rem || !rem.branches.main || !rp) return false;
          var t = treeFile(c, c.world.commits[rem.branches.main], 'README.md') || '';
          return /^>/m.test(t) && /\]\(/.test(t) && rp.headHash() === rem.branches.main;
        } }
    ]
  });

  S.push({
    id: 'vetve',
    kicker: 'Bonus',
    title: 'Větve a sloučení',
    short: 'git switch -c, práce na větvi, git merge a merge commit se dvěma předchůdci.',
    intro: '<p>V kuchařce chceš zkusit nové recepty, aniž bys rozbila hlavní verzi. Na to jsou <b>větve</b>.</p>',
    setup: function (api) {
      api.person('jana', { configured: true });
      api.mkdir('jana', ['git', 'kucharka']); api.cd('jana', ['git', 'kucharka']);
      api.run('jana', 'git init', 100);
      api.write('jana', 'palacinky.md', PAL_TIP); api.run('jana', 'git add .', 99); api.run('jana', 'git commit -m "Přidán recept na palačinky"', 98);
      api.write('jana', 'README.md', '# Moje kuchařka\n\nMoje nejoblíbenější recepty.\n'); api.run('jana', 'git add .', 90); api.run('jana', 'git commit -m "Přidán README"', 89);
      api.open('jana', ['git', 'kucharka']);
    },
    tasks: [
      { text: 'Vytvoř větev <b>nove-recepty</b> a přepni se na ni.',
        hint: '<pre>git switch -c nove-recepty\ngit branch</pre>',
        check: function (c) { var m = c.m('jana'), r = repoAt(m, H(m).concat(['git', 'kucharka'])); return !!r && !!r.branches['nove-recepty']; } },
      { text: 'Na větvi vytvoř <b>livance.md</b> a commitni ho.',
        hint: '<pre>git add livance.md\ngit commit -m "Přidány lívance"</pre>',
        check: function (c) { var m = c.m('jana'), r = repoAt(m, H(m).concat(['git', 'kucharka'])), h = r && r.branches['nove-recepty']; return !!h && !!treeFile(c, c.world.commits[h], 'livance.md'); } },
      { text: 'Přepni se zpět na <b>main</b>. Co se stalo se souborem <b>livance.md</b>?',
        hint: '<pre>git switch main</pre>',
        check: function (c) { var m = c.m('jana'), r = repoAt(m, H(m).concat(['git', 'kucharka'])); return !!r && r.head === 'main' && ran(c, 'jana', /git\s+switch\s+main/); } },
      { text: 'Na <b>main</b> uprav README a commitni. Historie se tím rozdvojí – podívej se do grafu.',
        hint: '<pre>git commit -am "Upraven README"\ngit log --oneline --graph --all</pre>',
        check: function (c) { var m = c.m('jana'), r = repoAt(m, H(m).concat(['git', 'kucharka'])); return !!r && !!r.branches['nove-recepty'] && !c.world.isAncestor(r.branches.main, r.branches['nove-recepty']) && !c.world.isAncestor(r.branches['nove-recepty'], r.branches.main); } },
      { text: 'Slouč větev <b>nove-recepty</b> do <b>main</b>. Zprávu v MERGE_MSG nech, jak je.',
        hint: '<pre>git merge nove-recepty\ngit log --oneline --graph</pre>',
        question: 'Kolik předchůdců má merge commit?',
        check: function (c) { var m = c.m('jana'), r = repoAt(m, H(m).concat(['git', 'kucharka'])); return !!r && r.head === 'main' && c.world.commits[r.headHash()].parents.length === 2; } }
    ]
  });

  S.push({
    id: 'konflikt',
    kicker: 'Bonus',
    title: 'Konflikt',
    short: 'Dvě větve změnily stejný řádek README. Git neví, co platí – rozhodni ty.',
    intro: '<p>Na větvi <b>main</b> i na větvi <b>uprava</b> se změnil stejný řádek v README. Při sloučení vznikne <b>konflikt</b>.</p>',
    setup: function (api) {
      api.person('jana', { configured: true });
      api.mkdir('jana', ['git', 'kucharka']); api.cd('jana', ['git', 'kucharka']);
      api.run('jana', 'git init', 100);
      api.write('jana', 'README.md', '# Moje kuchařka\n\nRecepty, které umím uvařit.\n'); api.write('jana', 'palacinky.md', PAL_TIP);
      api.run('jana', 'git add .', 99); api.run('jana', 'git commit -m "Začátek kuchařky"', 98);
      api.run('jana', 'git switch -c uprava', 60);
      api.write('jana', 'README.md', '# Moje kuchařka\n\nRecepty, které umím uvařit i já.\n'); api.run('jana', 'git commit -am "Úprava popisu"', 59);
      api.run('jana', 'git switch main', 40);
      api.write('jana', 'README.md', '# Moje kuchařka\n\nMoje nejoblíbenější recepty.\n'); api.run('jana', 'git commit -am "Jiný popis"', 39);
      api.open('jana', ['git', 'kucharka']);
    },
    tasks: [
      { text: 'Slouč větev <b>uprava</b> do <b>main</b>.',
        hint: '<pre>git merge uprava</pre>',
        question: 'Co Git vypsal? Které soubory jsou v konfliktu (git status)?',
        check: function (c) { var m = c.m('jana'), r = repoAt(m, H(m).concat(['git', 'kucharka'])); return !!r && (!!r.merge || c.world.commits[r.headHash()].parents.length === 2); } },
      { text: 'Otevři <b>README.md</b>. Mezi <code>&lt;&lt;&lt;&lt;&lt;&lt;&lt;</code> a <code>=======</code> je tvoje verze, pod ní ta druhá. Nech, co chceš, a <b>všechny značky smaž</b>. Ulož.',
        hint: 'Například:<pre># Moje kuchařka\n\nMoje nejoblíbenější recepty.\nRecepty, které umím uvařit i já.</pre>',
        check: function (c) { var m = c.m('jana'), d = m.dirAt(H(m).concat(['git', 'kucharka'])); var t = d && d.files['README.md']; return !!t && !/^(<{7}|={7}|>{7})/m.test(t) && (!!d.repo.merge || c.world.commits[d.repo.headHash()].parents.length === 2); } },
      { text: 'Označ konflikt za vyřešený a dokonči merge commitem.',
        hint: '<pre>git add README.md\ngit commit -m "Vyřešen konflikt v README"\ngit log --oneline --graph</pre>',
        check: function (c) { var m = c.m('jana'), r = repoAt(m, H(m).concat(['git', 'kucharka'])); return !!r && !r.merge && c.world.commits[r.headHash()].parents.length === 2 && !/^(<{7}|={7}|>{7})/m.test(headFile(c, r, 'README.md') || ''); } }
    ]
  });

  function GitMarkdownEsc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  root.GitScenarios = { list: S, PEOPLE: PEOPLE };
})(typeof window !== 'undefined' ? window : globalThis);
