/*
 * Git simulátor – https://github.com/mkgymji/git-simulator
 * Copyright (C) 2026 Michal Kočer
 * SPDX-License-Identifier: GPL-2.0-only
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License version 2 (see LICENSE).
 * Zdroje a autorská práva: ZDROJE.md
 */
/* =====================================================================
 *  i18n-en.js – anglické texty. Klíč = český text z tr('…') v kódu.
 *  Kontrola úplnosti: python3 tools/i18n_check.py
 * ===================================================================== */
GitI18n.add('en', {
  "Simulátor: v tomhle slučování se potkává přejmenovaný soubor s další změnou téhož souboru":
    "Simulator: this merge combines a renamed file with another change to the same file",
  "(smazání, jiné přejmenování nebo nový soubor se stejným jménem). Takový případ simulátor":
    "(a deletion, a different rename or a new file with the same name). The simulator cannot handle",
  "neumí, a proto nic nezměnil. Ve skutečném Gitu by vznikl konflikt.":
    "such a case, so it changed nothing. Real Git would report a conflict.",
  "Simulátor umí příkazy z kurzu: init, status, add, commit, diff, log, restore, revert,":
    "The simulator knows the course commands: init, status, add, commit, diff, log, restore, revert,",
  "branch, switch, merge, remote, push, pull, clone, config. Tahák najdeš pod tlačítkem Nápověda.":
    "branch, switch, merge, remote, push, pull, clone, config. The Cheat sheet button shows an overview.",
  "Simulátor: git init spouštěj bez názvu složky – nejdřív do složky přejdi (cd) a pak napiš git init.":
    "Simulator: run git init without a folder name – first go to the folder (cd), then type git init.",
  "Simulátor: tahle složka obsahuje další složky ({0}).":
    "Simulator: this folder contains other folders ({0}).",
  "Repozitář zakládej až ve složce projektu, např. cd {0} a potom git init.":
    "Create the repository inside the project folder, e.g. cd {0} and then git init.",
  "Simulátor: git status používáme bez přepínačů.":
    "Simulator: use git status without options.",
  "Zprávu commitu piš do uvozovek: git commit -m \"Zpráva o více slovech\"":
    "Put the commit message in quotes: git commit -m \"Message with several words\"",
  "Simulátor: git log zná --oneline, --graph, --all a -N (počet).":
    "Simulator: git log supports --oneline, --graph, --all and -N (count).",
  "Simulátor: git diff zná --staged a název souboru.":
    "Simulator: git diff supports --staged and a file name.",
  "Simulátor: vracej commity po jednom.":
    "Simulator: revert one commit at a time.",
  "Simulátor: napiš název větve, na kterou chceš přepnout.":
    "Simulator: type the name of the branch you want to switch to.",
  "Simulátor: novou větev zakládej z místa, kde právě jsi (git switch -c nazev).":
    "Simulator: create a new branch from where you are now (git switch -c name).",
  "Simulátor: v kurzu místo git checkout používáme novější příkazy:":
    "Simulator: instead of git checkout, this course uses the newer commands:",
  "  git switch nazev-vetve   (přepnutí větve)":
    "  git switch branch-name   (switch branches)",
  "  git restore soubor       (zahození změn v souboru)":
    "  git restore file         (discard changes in a file)",
  "Simulátor: git merge používáme bez přepínačů (jen název větve).":
    "Simulator: use git merge without options (just the branch name).",
  "Simulátor: slučuj vždy jen jednu větev.":
    "Simulator: merge only one branch at a time.",
  "Simulátor: vynucený push (--force) v kurzu nepoužíváme – přepsal by práci ostatních.":
    "Simulator: this course does not use force push (--force) – it would overwrite other people's work.",
  "Simulátor: git pull --rebase v kurzu nepoužíváme.":
    "Simulator: this course does not use git pull --rebase.",
  "Simulátor: máš nastaveno pull.rebase true, ale rebase v kurzu nepoužíváme.":
    "Simulator: you have pull.rebase set to true, but this course does not use rebase.",
  "Simulátor: jsi uvnitř repozitáře {0}. Klonuj o složku výš (cd ..), jinak by vznikl repozitář v repozitáři.":
    "Simulator: you are inside the repository {0}. Clone one folder up (cd ..), otherwise you would get a repository inside a repository.",
  "git rebase v kurzu nepoužíváme (přepisuje historii).":
    "git rebase is not used in this course (it rewrites history).",
  "git reset v kurzu nepoužíváme. Změny v souboru zahodíš přes git restore, commit vrátíš přes git revert.":
    "git reset is not used in this course. Discard changes in a file with git restore, undo a commit with git revert.",
  "git stash v kurzu nepoužíváme.":
    "git stash is not used in this course.",
  "git tag v kurzu nepoužíváme.":
    "git tag is not used in this course.",
  "git show simulátor neumí. Historii ukáže git log, změny git diff.":
    "The simulator does not support git show. Use git log for history and git diff for changes.",
  "git mv simulátor neumí.":
    "The simulator does not support git mv.",
  "git cherry-pick v kurzu nepoužíváme.":
    "git cherry-pick is not used in this course.",
  "git reflog simulátor neumí.":
    "The simulator does not support git reflog.",
  "git blame simulátor neumí.":
    "The simulator does not support git blame.",
  "git clean simulátor neumí.":
    "The simulator does not support git clean.",
  "Místo git stage piš git add.":
    "Use git add instead of git stage.",
  "Grafické nástroje simulátor nemá.":
    "The simulator has no graphical tools.",
  "Napiš příkaz Gitu, např. git status. Přehled příkazů je pod tlačítkem Nápověda.":
    "Type a Git command, e.g. git status. The Cheat sheet button shows an overview.",
  "Simulátor: {0}":
    "Simulator: {0}",
  "Simulátor: příkaz git {0} neumí (v kurzu ho nepotřebujeme).":
    "Simulator: the simulator does not support git {0} (this course does not need it).",
  "Simulátor umí tyto příkazy terminálu:":
    "The simulator knows these terminal commands:",
  "  ls             co je ve složce (také dir)":
    "  ls             what is in the folder (also dir)",
  "  cd nazev       jdi do složky (cd .. o složku výš, cd ~ domů)":
    "  cd name        go to a folder (cd .. one level up, cd ~ home)",
  "  mkdir nazev    nová složka":
    "  mkdir name     new folder",
  "  code -r .      otevři složku ve VS Code":
    "  code -r .      open the folder in VS Code",
  "  code soubor    otevři soubor v editoru":
    "  code file      open a file in the editor",
  "  cat soubor     vypiš obsah souboru (také type)":
    "  cat file       print a file (also type)",
  "  rm soubor      smaž soubor":
    "  rm file        delete a file",
  "  cls            vyčisti terminál (také clear)":
    "  cls            clear the terminal (also clear)",
  "  git ...        příkazy Gitu (přehled: tlačítko Tahák)":
    "  git ...        Git commands (overview: Cheat sheet button)",
  "Šipka nahoru vrátí předchozí příkaz, Tab doplní název.":
    "Arrow up recalls the previous command, Tab completes a name.",
  "Simulátor: v příkazu chybí uzavírací uvozovka. Zprávu piš takto: git commit -m \"Zpráva\"":
    "Simulator: the command is missing a closing quote. Write the message like this: git commit -m \"Message\"",
  "Simulátor: {0} je soubor, ne složka. Do souboru se přejít nedá.":
    "Simulator: {0} is a file, not a folder. You cannot go into a file.",
  "Simulátor: taková složka tu není. Co ve složce je, ukáže příkaz ls.":
    "Simulator: there is no such folder here. Type ls to see what the folder contains.",
  "Simulátor: napiš název souboru, např. New-Item recept.md":
    "Simulator: type a file name, e.g. New-Item recipe.md",
  "Simulátor: taková složka neexistuje.":
    "Simulator: no such folder exists.",
  "Simulátor: napiš název nové složky, např. mkdir git":
    "Simulator: type the name of the new folder, e.g. mkdir git",
  "Simulátor: nadřazená složka neexistuje.":
    "Simulator: the parent folder does not exist.",
  "Simulátor: takový název složky Windows nedovolí.":
    "Simulator: Windows does not allow such a folder name.",
  "Simulátor: ve škole používáme code -r . (otevře složku ve stejném okně).":
    "Simulator: at school we use code -r . (it opens the folder in the same window).",
  "Simulátor: napiš název souboru, např. cat palacinky.md":
    "Simulator: type a file name, e.g. cat pancakes.md",
  "Simulátor: napiš, co smazat, např. rm poznamky.md":
    "Simulator: type what to delete, e.g. rm notes.md",
  "Simulátor: mazání celých složek simulátor nedělá, aby sis omylem nesmazal repozitář.":
    "Simulator: the simulator does not delete whole folders, so that you cannot delete a repository by accident.",
  "Simulátor: terminál zůstane otevřený. Vyčistit ho můžeš příkazem cls.":
    "Simulator: the terminal stays open. You can clear it with cls.",
  "Simulátor: soubory upravuj v editoru (příkaz code soubor nebo klik na soubor v Průzkumníku).":
    "Simulator: edit files in the editor (the command code file, or click the file in the Explorer).",
  "Simulátor: za git patří mezera, např. git status":
    "Simulator: git must be followed by a space, e.g. git status",
  "Simulátor: takový příkaz neznám. Přehled příkazů ukáže help.":
    "Simulator: unknown command. Type help for a list of commands.",
  "Počítač ({0})":
    "Computer ({0})",
  "Simulátor: napiš příkaz a stiskni Enter. Přehled příkazů ukáže help.":
    "Simulator: type a command and press Enter. Type help for a list of commands.",
  "Scénář musí začínat řádkem FORMAT 1.":
    "The scenario must start with the line FORMAT 1.",
  "Za FORMAT patří číslo verze, např. FORMAT 1.":
    "FORMAT must be followed by a version number, e.g. FORMAT 1.",
  "Scénář je zapsaný ve verzi FORMAT {0}, tento simulátor umí jen FORMAT {1}. Aktualizuj simulátor.":
    "The scenario is written in FORMAT {0}, this simulator only supports FORMAT {1}. Update the simulator.",
  "Neznámá verze FORMAT {0}.":
    "Unknown version FORMAT {0}.",
  "Hlavička má pevné pořadí: SCENARIO, LABEL, SUMMARY, INTRO (každé jednou, INTRO víckrát).":
    "The header has a fixed order: SCENARIO, LABEL, SUMMARY, INTRO (each once, INTRO may repeat).",
  "{0} potřebuje text.":
    "{0} needs text.",
  "Chybí řádek SCENARIO s názvem scénáře (hned za FORMAT).":
    "Missing SCENARIO line with the scenario title (right after FORMAT).",
  "Po hlavičce musí následovat blok SETUP … END.":
    "The header must be followed by a SETUP … END block.",
  "Neznámý řádek v SETUP. Řádek musí začínat klíčovým slovem (MACHINE, PS>, FILE…).":
    "Unknown line in SETUP. A line must start with a keyword (MACHINE, PS>, FILE…).",
  "Blok SETUP není ukončený řádkem END.":
    "The SETUP block is not closed with END.",
  "PERSON a MACHINE patří na začátek SETUP, před příkazy.":
    "PERSON and MACHINE belong at the start of SETUP, before the commands.",
  "PERSON: chybí id postavy (malá písmena bez diakritiky), např. PERSON jana NAME \"Jana Nováková\".":
    "PERSON: missing character id (lowercase letters without accents), e.g. PERSON carol NAME \"Carol Smith\".",
  "PERSON: nerozumím části „{0}“. Povolené: NAME \"…\" EMAIL \"…\" LOGIN \"…\" LABEL \"…\".":
    "PERSON: I do not understand “{0}”. Allowed: NAME \"…\" EMAIL \"…\" LOGIN \"…\" LABEL \"…\".",
  "PERSON {0}: chybí NAME \"Jméno Příjmení\".":
    "PERSON {0}: missing NAME \"First Last\".",
  "PERSON {0}: LOGIN smí obsahovat jen písmena bez diakritiky, číslice a pomlčku.":
    "PERSON {0}: LOGIN may contain only letters without accents, digits and hyphens.",
  "MACHINE {0}: taková postava není. Nadefinuj ji řádkem PERSON, nebo použij alice / bob.":
    "MACHINE {0}: no such character. Define it with a PERSON line, or use alice / bob.",
  "MACHINE {0} je tu podruhé.":
    "MACHINE {0} appears twice.",
  "MACHINE: neznámá volba {0} (povolené CONFIGURED, HIDDEN).":
    "MACHINE: unknown option {0} (allowed: CONFIGURED, HIDDEN).",
  "Nejdřív nadefinuj počítač řádkem MACHINE.":
    "Define a computer with a MACHINE line first.",
  "AS {0}: takový počítač není (chybí MACHINE {1}).":
    "AS {0}: no such computer (MACHINE {1} is missing).",
  "PS> potřebuje příkaz.":
    "PS> needs a command.",
  "FILE potřebuje název souboru bez lomítek, např. FILE recept.md":
    "FILE needs a file name without slashes, e.g. FILE recipe.md",
  "FILE {0} není ukončený řádkem END.":
    "FILE {0} is not closed with END.",
  "GITHUB potřebuje vlastníka a název: GITHUB alice/kucharka":
    "GITHUB needs an owner and a name: GITHUB alice/cookbook",
  "GITHUB: neznámá volba {0} (povolené PUBLIC, PRIVATE, README, COLLABORATOR login).":
    "GITHUB: unknown option {0} (allowed: PUBLIC, PRIVATE, README, COLLABORATOR login).",
  "Známe jen SHOW GITHUB.":
    "Only SHOW GITHUB is supported.",
  "REPOSITORY může být jen jednou.":
    "REPOSITORY may appear only once.",
  "REPOSITORY potřebuje cestu od domovské složky, např. REPOSITORY git/kucharka":
    "REPOSITORY needs a path from the home folder, e.g. REPOSITORY git/cookbook",
  "VSCODE potřebuje složku od domovské složky, např. VSCODE git/kucharka":
    "VSCODE needs a folder path from the home folder, e.g. VSCODE git/cookbook",
  "Neznámé klíčové slovo {0} v SETUP. Povolené: PERSON, MACHINE, AS, PS>, FILE, GITHUB, SHOW GITHUB, REPOSITORY, VSCODE.":
    "Unknown keyword {0} in SETUP. Allowed: PERSON, MACHINE, AS, PS>, FILE, GITHUB, SHOW GITHUB, REPOSITORY, VSCODE.",
  "Scénář potřebuje aspoň jeden počítač (MACHINE v SETUP).":
    "The scenario needs at least one computer (MACHINE in SETUP).",
  "Aspoň jeden počítač musí být viditelný (bez HIDDEN).":
    "At least one computer must be visible (without HIDDEN).",
  "GITHUB {0}/{1}: účet {2} nepatří žádnému počítači ze scénáře.":
    "GITHUB {0}/{1}: account {2} does not belong to any computer in the scenario.",
  "Za SETUP mohou být jen bloky TASK … END.":
    "Only TASK … END blocks may follow SETUP.",
  "TASK potřebuje text úkolu.":
    "TASK needs the task text.",
  "TASK může mít jen jednu QUESTION.":
    "A TASK may have only one QUESTION.",
  "CHECK {0}: – takový počítač ve scénáři není.":
    "CHECK {0}: – no such computer in the scenario.",
  "Neznám podmínku „{0}“.":
    "Unknown condition “{0}”.",
  " Podmínky začínající „{0}“ jsou popsané v docs/SCENARE.md.":
    " Conditions starting with “{0}” are described in docs/SCENARIOS.md.",
  " Podmínka musí začínat jedním z: {0}.":
    " A condition must start with one of: {0}.",
  "Tahle podmínka se týká repozitáře – doplň do SETUP řádek REPOSITORY cesta/k/repozitari.":
    "This condition is about the repository – add a line REPOSITORY path/to/repository to SETUP.",
  "TASK není ukončený řádkem END.":
    "TASK is not closed with END.",
  "TASK potřebuje aspoň jednu podmínku CHECK.":
    "TASK needs at least one CHECK condition.",
  "Scénář":
    "Scenario",
  "Příkaz „{0}“ v SETUP skončil chybou: {1}":
    "The command “{0}” in SETUP failed: {1}",
  "Repozitář {0}/{1} na GitHubu už existuje.":
    "Repository {0}/{1} already exists on GitHub.",
  "Přípravu scénáře nejde provést: {0}":
    "The scenario setup cannot be run: {0}",
  "<div class=\"q\">Odpověz si: {0}</div>":
    "<div class=\"q\">Answer for yourself: {0}</div>",
  "Skrýt nápovědu":
    "Hide hint",
  "Nápověda":
    "Hint",
  "<b>Hotovo!</b> Všechny úkoly jsou splněné. Vyber si další scénář nahoře, nebo pokračuj ve zkoušení.":
    "<b>Done!</b> All tasks are complete. Pick another scenario at the top, or keep experimenting.",
  "<div class=\"intro\"><p>V tomhle režimu nejsou úkoly. Graf a tři oblasti vpravo ukazují, co se děje.</p></div>":
    "<div class=\"intro\"><p>This mode has no tasks. The graph and the three areas on the right show what is going on.</p></div>",
  "žádná otevřená složka":
    "no folder open",
  "<div class=\"folder\"><span class=\"grow\">Průzkumník</span></div><div class=\"empty\">Žádná složka není otevřená.<br>V terminálu přejdi do složky projektu a napiš <span class=\"cmd\">code -r .</span></div>":
    "<div class=\"folder\"><span class=\"grow\">Explorer</span></div><div class=\"empty\">No folder is open.<br>In the terminal, go to the project folder and type <span class=\"cmd\">code -r .</span></div>",
  "Nový soubor":
    "New file",
  "Název nového souboru":
    "New file name",
  "Git tento soubor ignoruje":
    "Git ignores this file",
  "Složka je prázdná. Nový soubor vytvoříš tlačítkem <b>+</b>.":
    "The folder is empty. Create a new file with the <b>+</b> button.",
  "Klikni na soubor vlevo, nebo vytvoř nový tlačítkem <b>+</b>.<br>Soubor ulož <kbd>Ctrl</kbd>+<kbd>S</kbd>. Uložení ale není commit – Git si změnu zapamatuje až po <span class=\"cmd\">git add</span> a <span class=\"cmd\">git commit</span>.":
    "Click a file on the left, or create a new one with the <b>+</b> button.<br>Save the file with <kbd>Ctrl</kbd>+<kbd>S</kbd>. Saving is not a commit, though – Git records the change only after <span class=\"cmd\">git add</span> and <span class=\"cmd\">git commit</span>.",
  "Tady se otevřou soubory. Nejdřív otevři složku: <span class=\"cmd\">code -r .</span>":
    "Files open here. First open a folder: <span class=\"cmd\">code -r .</span>",
  " <i style=\"color:#CF222E\">(smazáno)</i>":
    " <i style=\"color:#CF222E\">(deleted)</i>",
  "<span class=\"dirty\" title=\"Neuloženo\"></span>":
    "<span class=\"dirty\" title=\"Unsaved\"></span>",
  "Zavřít":
    "Close",
  "Náhled Markdownu (Ctrl+Shift+V)":
    "Markdown preview (Ctrl+Shift+V)",
  "Bez náhledu":
    "Hide preview",
  "Náhled":
    "Preview",
  "Uložit soubor (Ctrl+S)":
    "Save file (Ctrl+S)",
  "Uložit":
    "Save",
  "Napíšeš ({0})":
    "You write ({0})",
  "text":
    "text",
  "Obsah souboru {0}":
    "Contents of {0}",
  "Uvidíš (náhled)":
    "You see (preview)",
  "Soubor {0} ve složce není.":
    "File {0} is not in the folder.",
  "Neuloženo":
    "Unsaved",
  "Takový název souboru Windows nedovolí.":
    "Windows does not allow such a file name.",
  "Soubor {0} už existuje.":
    "File {0} already exists.",
  "<span>Terminál (PowerShell)</span><span class=\"grow\"></span>":
    "<span>Terminal (PowerShell)</span><span class=\"grow\"></span>",
  "Vyčistit (cls)":
    "Clear (cls)",
  "Vyčistit":
    "Clear",
  "Git čeká…":
    "Git is waiting…",
  "Příkazová řádka":
    "Command line",
  "Simulátor: tady se něco pokazilo ({0}). Zkus scénář začít znovu.":
    "Simulator: something went wrong here ({0}). Try restarting the scenario.",
  "Simulátor: soubor je mimo otevřenou složku. Otevři nejdřív jeho složku: code -r .":
    "Simulator: the file is outside the open folder. First open its folder: code -r .",
  "(VS Code se přenačetl a terminál začíná znovu ve složce {0})":
    "(VS Code reloaded and the terminal starts again in the folder {0})",
  "(otevřel se Vim – výchozí editor Gitu)":
    "(Vim opened – Git's default editor)",
  "(Git Credential Manager čeká na přihlášení)":
    "(Git Credential Manager is waiting for sign-in)",
  "Git spojuje dvě linie historie a připravil zprávu pro <b>merge commit</b>. Nic neměň, jen záložku zavři.":
    "Git is joining two lines of history and has prepared a message for the <b>merge commit</b>. Do not change anything, just close the tab.",
  "Git čeká na <b>zprávu commitu</b>. Napiš ji na první řádek, ulož a zavři. Řádky s <code>#</code> Git vynechá; prázdná zpráva commit zruší.":
    "Git is waiting for the <b>commit message</b>. Type it on the first line, save and close. Git skips lines starting with <code>#</code>; an empty message cancels the commit.",
  "Zavřít bez uložení":
    "Close without saving",
  "Uložit a zavřít záložku":
    "Save and close tab",
  "Tohle je <b>Vim</b>. Otevřel se, protože chybí nastavení <code>core.editor</code>. ":
    "This is <b>Vim</b>. It opened because the <code>core.editor</code> setting is missing. ",
  "Zprávu napiš nahoru, pak do řádku dole napiš <b>:wq</b> a Enter (uložit a odejít). <b>:q!</b> odejde bez uložení.<br>":
    "Type the message at the top, then type <b>:wq</b> in the line at the bottom and press Enter (save and quit). <b>:q!</b> quits without saving.<br>",
  "Příště: <code>git config --global core.editor \"code --wait\"</code>":
    "Next time: <code>git config --global core.editor \"code --wait\"</code>",
  "Příkaz Vimu":
    "Vim command",
  "uloženo – teď :q":
    "saved – now :q",
  "<div class=\"big\">Connect to GitHub</div><div class=\"muted\" style=\"color:#57606A\">Git potřebuje vědět, kdo jsi.</div>":
    "<div class=\"big\">Connect to GitHub</div><div class=\"muted\" style=\"color:#57606A\">Git needs to know who you are.</div>",
  "<p>Záložní cesta: na GitHubu vytvoř <b>token (classic)</b> se scope <code>repo</code> (Settings → Developer settings → Personal access tokens) a vlož ho sem.</p>":
    "<p>Fallback: on GitHub, create a <b>token (classic)</b> with the <code>repo</code> scope (Settings → Developer settings → Personal access tokens) and paste it here.</p>",
  "<p class=\"muted\" style=\"color:#57606A;font-size:13px\">V simulátoru projde libovolný text.</p>":
    "<p class=\"muted\" style=\"color:#57606A;font-size:13px\">In the simulator, any text works.</p>",
  "Prohlížeč – github.com":
    "Browser – github.com",
  "<p>Přihlášen(a) jako <b>{0}</b>. Git Credential Manager žádá o přístup k tvým repozitářům.</p>":
    "<p>Signed in as <b>{0}</b>. Git Credential Manager is requesting access to your repositories.</p>",
  "<p class=\"muted\" style=\"color:#57606A;font-size:13px\">Přihlášení se uloží do počítače. Na sdíleném počítači se proto po hodině odhlas.</p></div>":
    "<p class=\"muted\" style=\"color:#57606A;font-size:13px\">The sign-in is stored on the computer. On a shared computer, sign out after the lesson.</p></div>",
  "Přihlášení proběhlo. Git pokračuje.":
    "Signed in. Git continues.",
  "<div class=\"dhead\">Uložit změny v souboru?</div><div class=\"dbody\">Soubor má neuložené změny. Bez uložení se ztratí.</div>":
    "<div class=\"dhead\">Save changes to the file?</div><div class=\"dbody\">The file has unsaved changes. They will be lost if you do not save them.</div>",
  "Zrušit":
    "Cancel",
  "Neukládat":
    "Don't save",
  "<label class=\"radio\"><input type=\"radio\" name=\"vis\" value=\"public\"> <span>Public<small>Repozitář uvidí kdokoliv na internetu.</small></span></label>":
    "<label class=\"radio\"><input type=\"radio\" name=\"vis\" value=\"public\"> <span>Public<small>Anyone on the internet can see this repository.</small></span></label>",
  "<label class=\"radio\"><input type=\"radio\" name=\"vis\" value=\"private\" checked> <span>Private<small>Uvidíš ho jen ty a lidé, které pozveš.</small></span></label>":
    "<label class=\"radio\"><input type=\"radio\" name=\"vis\" value=\"private\" checked> <span>Private<small>Only you and the people you invite can see it.</small></span></label>",
  "<label class=\"radio\"><input type=\"checkbox\" id=\"nr-readme\"> <span>Add a README file<small>Repozitář nebude prázdný a půjde rovnou naklonovat.</small></span></label>":
    "<label class=\"radio\"><input type=\"checkbox\" id=\"nr-readme\"> <span>Add a README file<small>The repository will not be empty and can be cloned right away.</small></span></label>",
  "Název repozitáře smí mít jen písmena bez diakritiky, číslice, - _ a tečku.":
    "A repository name may contain only letters without accents, digits, - _ and dots.",
  "Repozitář {0} už máš.":
    "You already have a repository {0}.",
  "<b>{0}</b> tě zve ke spolupráci na <b>{1}</b>.":
    "<b>{0}</b> invited you to collaborate on <b>{1}</b>.",
  "<p class=\"muted\">Zatím tu nemáš žádný repozitář.</p>":
    "<p class=\"muted\">You do not have any repositories yet.</p>",
  "Pozvánka přijata. Teď můžeš do {0} pushovat.":
    "Invitation accepted. You can now push to {0}.",
  "<div class=\"frow muted\">Zatím nikoho nemáš.</div>":
    "<div class=\"frow muted\">Nobody yet.</div>",
  "</div><form style=\"margin-top:10px\"><label for=\"ad-name\">Add people</label><div style=\"display:flex;gap:6px\"><input type=\"text\" id=\"ad-name\" placeholder=\"uživatelské jméno\"><button class=\"gbtn green\" type=\"submit\">Add</button></div></form>":
    "</div><form style=\"margin-top:10px\"><label for=\"ad-name\">Add people</label><div style=\"display:flex;gap:6px\"><input type=\"text\" id=\"ad-name\" placeholder=\"username\"><button class=\"gbtn green\" type=\"submit\">Add</button></div></form>",
  "Uživatel {0} na GitHubu není.":
    "User {0} does not exist on GitHub.",
  "Vlastníka zvát nemusíš.":
    "You do not need to invite the owner.",
  "{0} už pozvánku má.":
    "{0} already has an invitation.",
  "Pozvánka odeslána. {0} ji musí přijmout.":
    "Invitation sent. {0} has to accept it.",
  "{0}<div class=\"box\"><div class=\"bhead\"><span class=\"grow\">Commits na větvi {1}</span></div>":
    "{0}<div class=\"box\"><div class=\"bhead\"><span class=\"grow\">Commits on {1}</span></div>",
  "Soubor se nezměnil – není co commitnout.":
    "The file has not changed – nothing to commit.",
  "<span class=\"grow\">Kde je která verze</span><span class=\"sub\">":
    "<span class=\"grow\">Where each version is</span><span class=\"sub\">",
  "Tady uvidíš pracovní složku, přípravnou oblast a repozitář, jakmile budeš ve složce s repozitářem (<span class=\"cmd\">git init</span> nebo <span class=\"cmd\">git clone</span>).":
    "Here you will see the working directory, the staging area and the repository once you are in a folder with a repository (<span class=\"cmd\">git init</span> or <span class=\"cmd\">git clone</span>).",
  "<span class=\"grow\">Historie (graf commitů)</span><span class=\"sub\">{0}</span>":
    "<span class=\"grow\">History (commit graph)</span><span class=\"sub\">{0}</span>",
  "Zatím žádný commit. První vznikne příkazem <span class=\"cmd\">git commit</span>.":
    "No commits yet. The first one is created by <span class=\"cmd\">git commit</span>.",
  "Žádný repozitář.":
    "No repository.",
  "Na téhle adrese zatím žádný repozitář není.":
    "There is no repository at this address yet.",
  "Repozitář na GitHubu je prázdný. Pošli do něj commity: <span class=\"cmd\">git push -u origin main</span>":
    "The repository on GitHub is empty. Send commits to it: <span class=\"cmd\">git push -u origin main</span>",
  "Soubor je v konfliktu. Vyřeš ho a pak git add.":
    "The file has a conflict. Resolve it, then git add.",
  "smazaný":
    "deleted",
  "Soubor je v přípravné oblasti, ale v pracovní složce chybí.":
    "The file is in the staging area but missing from the working directory.",
  "ignorovaný":
    "ignored",
  "Soubor je v .gitignore – Git si ho nevšímá.":
    "The file is in .gitignore – Git ignores it.",
  "nesledovaný":
    "untracked",
  "Git tenhle soubor zatím nesleduje. Přidej ho: git add":
    "Git does not track this file yet. Add it: git add",
  "změněný":
    "modified",
  "Změna, která ještě není v přípravné oblasti (git add).":
    "A change that is not in the staging area yet (git add).",
  "Stejné jako v přípravné oblasti.":
    "Same as in the staging area.",
  "Git čeká, až konflikt vyřešíš (git add).":
    "Git is waiting for you to resolve the conflict (git add).",
  "smazání":
    "deletion",
  "Příští commit soubor smaže.":
    "The next commit will delete the file.",
  "nový":
    "new",
  "Příští commit soubor přidá.":
    "The next commit will add the file.",
  "Příští commit uloží tuhle verzi.":
    "The next commit will store this version.",
  "Stejné jako v posledním commitu.":
    "Same as in the last commit.",
  "Verze uložená v posledním commitu.":
    "The version stored in the last commit.",
  "<div class=\"en\">zatím žádný commit</div>":
    "<div class=\"en\">no commits yet</div>",
  "<div class=\"area wd\"><h3>Pracovní složka</h3><div class=\"en\">working directory</div><div class=\"files\">":
    "<div class=\"area wd\"><h3>Working directory</h3><div class=\"en\">your files</div><div class=\"files\">",
  "<div class=\"none\">prázdná</div>":
    "<div class=\"none\">empty</div>",
  "<div class=\"area st\"><h3>Přípravná oblast</h3><div class=\"en\">staging area</div><div class=\"files\">":
    "<div class=\"area st\"><h3>Staging area</h3><div class=\"en\">ready for the next commit</div><div class=\"files\">",
  "<div class=\"area re\"><h3>Repozitář</h3>{0}<div class=\"files\">":
    "<div class=\"area re\"><h3>Repository</h3>{0}<div class=\"files\">",
  "Soubor <b>{0}</b> má neuložené změny v editoru – Git je zatím nevidí. Ulož ho (<kbd>Ctrl</kbd>+<kbd>S</kbd>).":
    "The file <b>{0}</b> has unsaved changes in the editor – Git cannot see them yet. Save it (<kbd>Ctrl</kbd>+<kbd>S</kbd>).",
  "Graf commitů":
    "Commit graph",
  "Tento scénář už máš v tomto prohlížeči splněný.":
    "You have already completed this scenario in this browser.",
  "Scénář má chyby, nejde spustit:":
    "The scenario has errors and cannot be started:",
  "ř. {0}":
    "line {0}",
  "… a dalších {0} chyb.":
    "… and {0} more errors.",
  "Popis jazyka:":
    "Language reference:",
  "Prohlížeč nedovolil uložení – scénář zmizí po zavření stránky.":
    "The browser does not allow saving – the scenario will disappear when you close the page.",
  "<div class=\"dhead\"><span class=\"grow\">Vyber scénář</span></div><div class=\"dbody\">":
    "<div class=\"dhead\"><span class=\"grow\">Choose a scenario</span></div><div class=\"dbody\">",
  "<h4 class=\"scen-h\">Vestavěné scénáře</h4><div class=\"scen-list\" id=\"sl-builtin\"></div>":
    "<h4 class=\"scen-h\">Built-in scenarios</h4><div class=\"scen-list\" id=\"sl-builtin\"></div>",
  "<h4 class=\"scen-h\">Moje scénáře <span class=\"small\">– uložené jen v tomto prohlížeči</span></h4><div class=\"scen-list\" id=\"sl-my\"><p class=\"small\">Načítám…</p></div>":
    "<h4 class=\"scen-h\">My scenarios <span class=\"small\">– stored only in this browser</span></h4><div class=\"scen-list\" id=\"sl-my\"><p class=\"small\">Loading…</p></div>",
  "<h4 class=\"scen-h\">Nahrát scénář</h4>":
    "<h4 class=\"scen-h\">Upload a scenario</h4>",
  "<div class=\"upload\"><div class=\"drop\" id=\"sl-drop\">Přetáhni sem soubor <code>.scenario</code>, nebo <label class=\"linkbtn\">vyber soubor<input type=\"file\" id=\"sl-file\" accept=\".scenario,.txt,text/plain\" hidden></label>.</div>":
    "<div class=\"upload\"><div class=\"drop\" id=\"sl-drop\">Drop a <code>.scenario</code> file here, or <label class=\"linkbtn\">choose a file<input type=\"file\" id=\"sl-file\" accept=\".scenario,.txt,text/plain\" hidden></label>.</div>",
  "<details><summary>…nebo vlož text scénáře</summary><textarea id=\"sl-text\" spellcheck=\"false\" placeholder=\"FORMAT 1&#10;SCENARIO …\"></textarea>":
    "<details><summary>…or paste the scenario text</summary><textarea id=\"sl-text\" spellcheck=\"false\" placeholder=\"FORMAT 1&#10;SCENARIO …\"></textarea>",
  "<p><button class=\"dbtn primary\" type=\"button\" id=\"sl-go\">Načíst a spustit</button></p></details>":
    "<p><button class=\"dbtn primary\" type=\"button\" id=\"sl-go\">Load and start</button></p></details>",
  "<p class=\"small\">Jak scénář napsat: <a href=\"{0}\" target=\"_blank\" rel=\"noopener\">popis jazyka scénářů</a>. Vestavěný scénář si můžeš stáhnout jako vzor. ":
    "<p class=\"small\">How to write a scenario: <a href=\"{0}\" target=\"_blank\" rel=\"noopener\">scenario language reference</a>. You can download a built-in scenario as a template. ",
  "Sdílet scénář jde odkazem: adresa simulátoru + <code>#load=</code> + adresa souboru (třeba na GitHubu).</p></div></div>":
    "You can share a scenario with a link: simulator address + <code>#load=</code> + file address (for example on GitHub).</p></div></div>",
  "Splněno":
    "Completed",
  "Stáhnout":
    "Download",
  "Stáhnout jako vzor":
    "Download as template",
  "Odebrat":
    "Remove",
  "Scénář odebrán z tohoto prohlížeče.":
    "Scenario removed from this browser.",
  "Fajfky u splněných scénářů jsou uložené jen v tomto prohlížeči.":
    "Checkmarks of completed scenarios are stored only in this browser.",
  "Zapomenout splněné":
    "Forget completed",
  "Splněné scénáře jsou zapomenuté.":
    "Completed scenarios have been forgotten.",
  "<p class=\"small\">Zatím žádné. Nahraný scénář se sem uloží.</p>":
    "<p class=\"small\">None yet. An uploaded scenario will be saved here.</p>",
  "Scénář má chyby.":
    "The scenario has errors.",
  "vložený text":
    "pasted text",
  "Nastavení (jednou na počítači)":
    "Setup (once per computer)",
  "git config --global user.name \"Jméno\"":
    "git config --global user.name \"Name\"",
  "kdo jsem":
    "who I am",
  "git config --global user.email \"e-mail\"":
    "git config --global user.email \"e-mail\"",
  "můj e-mail (stejný jako na GitHubu)":
    "my e-mail (the same as on GitHub)",
  "Nový projekt":
    "New project",
  "ze složky udělá repozitář":
    "turns the folder into a repository",
  "git clone adresa":
    "git clone address",
  "stáhne repozitář z GitHubu":
    "downloads a repository from GitHub",
  "Každodenní práce":
    "Everyday work",
  "co se děje?":
    "what is going on?",
  "git add soubor":
    "git add file",
  "připrav soubor do commitu":
    "stage a file for the commit",
  "připrav všechny změny":
    "stage all changes",
  "git commit -m \"zpráva\"":
    "git commit -m \"message\"",
  "ulož verzi":
    "save a version",
  "co jsem změnil od posledního commitu?":
    "what did I change since the last commit?",
  "Historie":
    "History",
  "stručná historie":
    "short history",
  "git restore soubor":
    "git restore file",
  "zahoď neuložené změny":
    "discard changes in the file",
  "git restore --staged soubor":
    "git restore --staged file",
  "vyndej soubor ze stagingu":
    "unstage a file",
  "git restore --source=hash soubor":
    "git restore --source=hash file",
  "vytáhni starou verzi souboru":
    "get an old version of a file",
  "git revert hash":
    "git revert hash",
  "vrať commit novým commitem":
    "undo a commit with a new commit",
  "git remote add origin adresa":
    "git remote add origin address",
  "propoj repozitář s GitHubem (jednou)":
    "link the repository to GitHub (once)",
  "první push":
    "first push",
  "pošli commity na GitHub":
    "send commits to GitHub",
  "stáhni commity z GitHubu":
    "get commits from GitHub",
  "Větve":
    "Branches",
  "seznam větví":
    "list branches",
  "git switch -c nazev":
    "git switch -c name",
  "vytvoř větev a přepni se na ni":
    "create a branch and switch to it",
  "git switch nazev":
    "git switch name",
  "přepni se na větev":
    "switch to a branch",
  "git merge nazev":
    "git merge name",
  "slouč větev do té, na které jsi":
    "merge a branch into the one you are on",
  "zruš rozdělaný merge":
    "abort an unfinished merge",
  "Terminál":
    "Terminal",
  "pwd   ls   cd nazev   cd ..":
    "pwd   ls   cd name   cd ..",
  "kde jsem · co tu je · jdi do složky · o složku výš":
    "where am I · what is here · go to a folder · one folder up",
  "mkdir nazev   code -r .":
    "mkdir name   code -r .",
  "nová složka · otevři složku ve VS Code":
    "new folder · open the folder in VS Code",
  "Tab · ↑ · cls":
    "Tab · ↑ · cls",
  "doplní název · předchozí příkaz · vyčistí terminál":
    "completes a name · previous command · clears the terminal",
  "<div class=\"dhead\"><span class=\"grow\">Tahák (z příručky, kap. 10)</span></div><div class=\"dbody\"><table>{0}</table></div>":
    "<div class=\"dhead\"><span class=\"grow\">Cheat sheet</span></div><div class=\"dbody\"><table>{0}</table></div>",
  "<div class=\"dhead\"><span class=\"grow\">O simulátoru</span></div><div class=\"dbody\">":
    "<div class=\"dhead\"><span class=\"grow\">About the simulator</span></div><div class=\"dbody\">",
  "<p style=\"margin-top:0\"><b>Git simulátor</b> pro kurz Git a GitHub – rychlý úvod<br>Copyright © 2026 Michal Kočer</p>":
    "<p style=\"margin-top:0\"><b>Git simulator</b> for the course Git and GitHub – a quick introduction<br>Copyright © 2026 Michal Kočer</p>",
  "<p>Simulátor je svobodný software pod licencí <a href=\"https://github.com/mkgymji/git-simulator/blob/main/LICENSE\" target=\"_blank\" rel=\"noopener\">GNU General Public License verze 2</a>, ":
    "<p>The simulator is free software under the <a href=\"https://github.com/mkgymji/git-simulator/blob/main/LICENSE\" target=\"_blank\" rel=\"noopener\">GNU General Public License version 2</a>, ",
  "stejně jako Git. Smíš ho používat, upravovat a šířit; upravenou verzi ale jen pod stejnou licencí a se zdrojovým kódem. ":
    "just like Git. You may use, modify and share it; a modified version only under the same licence and with its source code. ",
  "Je poskytován bez jakékoli záruky.</p>":
    "It comes with no warranty.</p>",
  "<h4>Převzato z Gitu 2.47.1</h4>":
    "<h4>Taken from Git 2.47.1</h4>",
  "<p class=\"small\" style=\"margin:0 0 4px\">Algoritmy jsou převedené do JavaScriptu, hlášky Gitu převzaté doslova. Git: © Linus Torvalds, Junio C Hamano a přispěvatelé, GPL-2.0.</p>":
    "<p class=\"small\" style=\"margin:0 0 4px\">The algorithms are ported to JavaScript, Git's messages are taken verbatim. Git: © Linus Torvalds, Junio C Hamano and contributors, GPL-2.0.</p>",
  "<li>histogramový diff: {0} <span class=\"small\">(© 2010 Google Inc., Eclipse Distribution License 1.0)</span></li>":
    "<li>histogram diff: {0} <span class=\"small\">(© 2010 Google Inc., Eclipse Distribution License 1.0)</span></li>",
  "<li>diff souboru v konfliktu: {0}</li>":
    "<li>diff of a conflicted file: {0}</li>",
  "<li>přejmenování: {0}, {1}</li>":
    "<li>renames: {0}, {1}</li>",
  "<li>přepínání větví a místní změny: {0}; slučování: {1}; revert: {2}</li>":
    "<li>switching branches and local changes: {0}; merging: {1}; revert: {2}</li>",
  "<li>výpisy: {0}, {1}, {2}, {3}, {4}, {5}, {6} a <code>builtin/*.c</code></li>":
    "<li>messages: {0}, {1}, {2}, {3}, {4}, {5}, {6} and <code>builtin/*.c</code></li>",
  "<h4>Písma</h4><ul>":
    "<h4>Fonts</h4><ul>",
  "© Bitstream, Inc. (Bitstream Vera) a DejaVu, licence Bitstream Vera":
    "© Bitstream, Inc. (Bitstream Vera) and DejaVu, Bitstream Vera licence",
  "<h4>Ochranné známky</h4><p class=\"small\" style=\"margin:0\">Git je ochranná známka Software Freedom Conservancy, GitHub ochranná známka GitHub, Inc., ":
    "<h4>Trademarks</h4><p class=\"small\" style=\"margin:0\">Git is a trademark of Software Freedom Conservancy, GitHub is a trademark of GitHub, Inc., ",
  "PowerShell, Windows a Visual Studio Code ochranné známky společnosti Microsoft. Simulátor s nimi není spojen, jejich vzhled a texty napodobuje jen pro výuku.</p>":
    "PowerShell, Windows and Visual Studio Code are trademarks of Microsoft. The simulator is not affiliated with them; it imitates their look and texts for teaching only.</p>",
  "<p class=\"small\">Úplný přehled: <a href=\"https://github.com/mkgymji/git-simulator/blob/main/ZDROJE.md\" target=\"_blank\" rel=\"noopener\">ZDROJE.md</a></p></div>":
    "<p class=\"small\">Full list (in Czech): <a href=\"https://github.com/mkgymji/git-simulator/blob/main/ZDROJE.md\" target=\"_blank\" rel=\"noopener\">ZDROJE.md</a></p></div>",
  "<div class=\"dhead\">Začít scénář znovu?</div><div class=\"dbody\">Všechno, co jsi v tomhle scénáři udělal(a), zmizí.</div>":
    "<div class=\"dhead\">Restart the scenario?</div><div class=\"dbody\">Everything you did in this scenario will be lost.</div>",
  "Začít znovu":
    "Start over",
  "Git simulátor – {0}":
    "Git simulator – {0}",
  "Vybrat jiný scénář":
    "Choose another scenario",
  "Scénář z odkazu nejde spustit":
    "The scenario from the link cannot be started",
  "Scénář se nepodařilo stáhnout":
    "The scenario could not be downloaded",
  "<p>Adresa <code>{0}</code> nejde načíst ({1}).</p>":
    "<p>The address <code>{0}</code> cannot be loaded ({1}).</p>",
  "<p class=\"small\">Soubor musí být veřejně dostupný a server musí povolit stažení z jiné stránky (např. raw.githubusercontent.com to umí).</p>":
    "<p class=\"small\">The file must be publicly available and the server must allow downloads from other sites (raw.githubusercontent.com does).</p>",
  "Scénář nenalezen":
    "Scenario not found",
  "<p>Tenhle scénář v tomto prohlížeči uložený není. Moje scénáře jsou vždy jen v prohlížeči, kde je nahraješ.</p>":
    "<p>This scenario is not stored in this browser. My scenarios always live only in the browser where you uploaded them.</p>",
  "Scénář nejde spustit":
    "The scenario cannot be started",
  "Git a GitHub – rychlý úvod":
    "Git and GitHub – a quick introduction",
  "Git simulátor":
    "Git simulator",
  "Návod":
    "Guide",
  "Jak simulátor používat (otevře se v nové záložce)":
    "How to use the simulator (opens in a new tab)",
  "Tahák":
    "Cheat sheet",
  "Jazyk":
    "Language",
  "Úkoly":
    "Tasks",
  "Počítač":
    "Computer",
  "terminál, VS Code a prohlížeč":
    "terminal, VS Code and browser",
  "Co se děje v Gitu":
    "What happens in Git",
  "verze souborů, historie, GitHub":
    "file versions, history, GitHub",
  "Výukový simulátor, odpovídá Gitu 2.47 (Git for Windows). Vzhled GitHubu a VS Code napodobuje jen pro výuku – <a href=\"{0}\">ochranné známky</a>.":
    "An educational simulator matching Git 2.47 (Git for Windows). It imitates the look of GitHub and VS Code for teaching only – <a href=\"{0}\">trademarks</a>.",
  "licence <a href=\"{0}\">GNU GPL v2</a> · obsahuje kód převzatý z <a href=\"{1}\">Gitu 2.47.1</a>":
    "licence <a href=\"{0}\">GNU GPL v2</a> · contains code taken from <a href=\"{1}\">Git 2.47.1</a>",
  "O simulátoru a zdrojích":
    "About the simulator and sources",
  "zdrojový kód":
    "source code",
  "{0} patří před QUESTION, CHECK a AUTO.":
    "{0} belongs before QUESTION, CHECK and AUTO.",
  "QUESTION patří před CHECK a AUTO.":
    "QUESTION belongs before CHECK and AUTO.",
  "Za AUTO může být jen WHEN a podmínka, např. AUTO WHEN config user.name is set":
    "AUTO may only be followed by WHEN and a condition, e.g. AUTO WHEN config user.name is set",
  "Neznámý řádek v AUTO (povolené NOTE, AS, PS>, FILE, APPEND, END).":
    "Unknown line in AUTO (allowed: NOTE, AS, PS>, FILE, APPEND, END).",
  "NOTE potřebuje text.":
    "NOTE needs text.",
  "{0} potřebuje název souboru bez lomítek, např. {0} recept.md":
    "{0} needs a file name without slashes, e.g. {0} recipe.md",
  "{0} {1} není ukončený řádkem END.":
    "{0} {1} is not closed with END.",
  "Neznámé klíčové slovo {0} v AUTO. Povolené: NOTE, AS, PS>, FILE, APPEND, END.":
    "Unknown keyword {0} in AUTO. Allowed: NOTE, AS, PS>, FILE, APPEND, END.",
  "AUTO je prázdný – patří do něj NOTE, PS>, FILE nebo APPEND.":
    "AUTO is empty – it should contain NOTE, PS>, FILE or APPEND.",
  "← simulátor":
    "← simulator",
  "Simulátor: do souboru {0} doplnil text – podívej se do editoru.":
    "Simulator: added text to the file {0} – have a look in the editor.",
  "Doplnil simulátor:":
    "Filled in by the simulator:",
  "Doplnil simulátor: {0}":
    "Filled in by the simulator: {0}",
  "HTTPS adresa:":
    "HTTPS address:",
  "Naklonovat:":
    "Clone:",
  "Kopírovat":
    "Copy",
  "Adresa je zkopírovaná. V terminálu ji vložíš Ctrl+V.":
    "The address has been copied. Paste it in the terminal with Ctrl+V.",
  "Vrátí stav na začátek tohoto úkolu. Splněné úkoly zůstanou.":
    "Returns everything to the start of this task. Completed tasks stay completed.",
  "Začít úkol znovu":
    "Restart this task",
  "Začít úkol {0} znovu?":
    "Restart task {0}?",
  "Vrátí se stav ze začátku tohoto úkolu: soubory, repozitáře, GitHub i terminál. Splněné úkoly zůstanou splněné.":
    "Everything returns to how it was at the start of this task: files, repositories, GitHub and the terminal. Completed tasks stay completed.",
  "Úkol {0} začíná znovu.":
    "Task {0} starts again.",
  "Simulátor: úkol 1 udělal za tebe, začínáš úkolem 2.":
    "Simulator: task 1 was done for you, you start with task 2.",
  "Simulátor: úkoly 1–{0} udělal za tebe, začínáš úkolem {1}.":
    "Simulator: tasks 1–{0} were done for you, you start with task {1}.",
  "Za SOLVE nic nepatří – kroky napiš na další řádky.":
    "Nothing may follow SOLVE – write the steps on the next lines.",
  "Neznámý řádek v SOLVE (povolené AS, PS>, FILE, APPEND, END).":
    "Unknown line in SOLVE (allowed: AS, PS>, FILE, APPEND, END).",
  "Neznámé klíčové slovo {0} v SOLVE. Povolené: AS, PS>, FILE, APPEND, END.":
    "Unknown keyword {0} in SOLVE. Allowed: AS, PS>, FILE, APPEND, END.",
  "{0} není ukončený řádkem END.":
    "{0} is not closed with END.",
  "SOLVE je prázdný – patří do něj PS>, FILE nebo APPEND.":
    "SOLVE is empty – it should contain PS>, FILE or APPEND.",
  "Neznámý řádek v TASK (povolené HINT, NOTE, QUESTION, CHECK, AUTO, SOLVE, JUMP, END).":
    "Unknown line in TASK (allowed: HINT, NOTE, QUESTION, CHECK, AUTO, SOLVE, JUMP, END).",
  "TASK může mít jen jeden SOLVE.":
    "A TASK may have only one SOLVE.",
  "JUMP potřebuje štítek z malých písmen, číslic a pomlček, např. JUMP revert":
    "JUMP needs a label of lowercase letters, digits and hyphens, e.g. JUMP revert",
  "Štítek JUMP {0} už je v úkolu na řádku {1}.":
    "The JUMP label {0} is already used in the task on line {1}.",
  "Neznámé klíčové slovo {0} v TASK. Povolené: HINT, NOTE, QUESTION, CHECK, AUTO, SOLVE, JUMP, END.":
    "Unknown keyword {0} in TASK. Allowed: HINT, NOTE, QUESTION, CHECK, AUTO, SOLVE, JUMP, END.",
  "Na úkol se štítkem JUMP {0} se skáče přes tento úkol – potřebuje blok SOLVE (jak ho simulátor vyřeší).":
    "A jump to the task labelled JUMP {0} skips this task – it needs a SOLVE block (how the simulator solves it).",
  "Skok na JUMP {0}: úkol {1} se blokem SOLVE nesplnil.":
    "Jump to JUMP {0}: task {1} was not completed by its SOLVE block.",
  "Na úkol „{0}“ se v tomto scénáři skočit nedá.":
    "You cannot jump to the task “{0}” in this scenario.",
  "Úkol 1 udělal simulátor, začínáš úkolem 2.":
    "Task 1 was done by the simulator, you start with task 2.",
  "Úkoly 1–{0} udělal simulátor, začínáš úkolem {1}.":
    "Tasks 1–{0} were done by the simulator, you start with task {1}.",
  "Úkol 1 udělal simulátor za tebe – jeho commity vidíš v grafu. Pokračuj úkolem 2.":
    "Task 1 was done for you by the simulator – you can see its commits in the graph. Continue with task 2.",
  "Úkoly 1–{0} udělal simulátor za tebe – jejich commity vidíš v grafu. Pokračuj úkolem {1}.":
    "Tasks 1–{0} were done for you by the simulator – you can see their commits in the graph. Continue with task {1}."
});
