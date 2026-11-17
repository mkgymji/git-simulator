# Git simulátor

Simulátor Gitu a GitHubu v prohlížeči pro kurz **Git a GitHub – rychlý úvod**
(3. ročník gymnázia). Nahrazuje Visualizing Git a Learn Git Branching:

- **soubory a přípravná oblast** – vidíš pracovní složku, staging a repozitář vedle sebe;
- **VS Code** s náhledem Markdownu (Napíšeš / Uvidíš) a **terminál ve stylu PowerShellu**
  s promptem `PS kucharka>` jako v příručce;
- **graf commitů** a **GitHub v prohlížeči** (nový repozitář, úprava souboru na webu,
  pozvánka spolupracovníka), přihlášení přes Git Credential Manager;
- **dva počítače** (Anna a Petr) pro spolupráci ve dvojici;
- větev `main`, `git switch`, česká kuchařka, žádný rebase ani reklamy;
- po obnovení stránky začíná scénář znovu (nic se neukládá do prohlížeče).

Spuštění: otevři `index.html` (stačí z disku) nebo stránku na GitHub Pages.

## Scénáře

Scénáře jsou textové soubory v **jazyce scénářů** (`scenarios/*.scenario`, popis v
[`docs/SCENARE.md`](docs/SCENARE.md)). Učitel si může napsat vlastní a nahrát ho v dialogu
**Vybrat scénář → Nahrát scénář**; uloží se do „Mých scénářů“ jen v jeho prohlížeči.
Sdílet ho jde odkazem `#load=adresa-souboru`.

| Adresa | Scénář |
|---|---|
| `#volne` | volný režim – prázdný počítač |
| `#pl1` | PL1: nastavení Gitu, první repozitář a commity |
| `#pl2` | PL2: diff, log, restore, revert, .gitignore |
| `#revert` | PL2, úkol 8: commit s chybou a revert v grafu |
| `#pl3` | PL3: repozitář na GitHubu, push, úprava na webu, pull |
| `#odmitnuty-push` | PL4 nanečisto: odmítnutý push, pull s merge commitem |
| `#spoluprace` | PL4: Anna a Petr, pozvánka, klonování, spolupráce |
| `#vetve` | bonus: větve a merge |
| `#konflikt` | bonus: konflikt a jeho vyřešení |

## Jak věrný je Git v simulátoru

Výstupy Gitu odpovídají **Gitu 2.47 (Git for Windows)** – doslova, včetně barev a skutečných
SHA-1 hashů. Části Gitu jsou převzaté algoritmicky (diff a merge z xdiff, kombinovaný diff,
`git log --graph`, detekce přejmenování, přechod mezi větvemi z unpack-trees).

Ověřuje se to **rozdílovými testy proti skutečnému Gitu**: stejné kroky se provedou v Gitu
i v simulátoru a výstupy se porovnají (text i barvy). Rozdíly verzí Gitu, které na výstup
mají vliv (např. text `hint: Disable this message with "git config advice…"`), se v testech
převádějí na podobu z 2.47.

```sh
./tests/run_all.sh        # všechny testy (potřebuje git, python3 a jsc – JavaScriptCore z macOS)
python3 tests/test_git.py # pevné scénáře
python3 tests/fuzz_repo.py 25 7   # náhodná práce s repozitářem, semínko 7
```

Co simulátor **neumí** a řekne to česky šedou poznámkou: příkazy mimo kurz (rebase, reset,
stash…), podsložky v repozitáři a slučování, kde se přejmenovaný soubor potká s jiným
přejmenováním téhož souboru nebo s novým souborem stejného jména. Výstupy PowerShellu (`ls`, `pwd`, `mkdir`) napodobují anglický
Windows PowerShell 5.1; na českých Windows mohou vypadat jinak.

## Struktura

```
index.html              stránka
css/style.css           vzhled (barvy a písma z materiálů kurzu)
js/text.js              UTF-8, SHA-1, diff (Myers, histogram), merge, kombinovaný diff
js/world.js             objekty Gitu, počítače, GitHub
js/rename.js            detekce přejmenování (diffcore-rename)
js/graph.js             git log --graph
js/git.js               příkazy Gitu
js/shell.js             terminál (PowerShell)
js/markdown.js          náhled Markdownu
js/session.js           běh scénáře: sestavení světa, záznam příkazů, vyhodnocení úkolů
js/scenario-lang.js     jazyk scénářů: parser, podmínky CHECK, hlášení chyb
js/scenarios-builtin.js vestavěné scénáře zabalené do JS (generuje tools/build_scenarios.py)
js/scenarios.js         přeložení vestavěných scénářů
js/store.js             Moje scénáře (IndexedDB v prohlížeči)
js/ui.js                rozhraní
scenarios/              vestavěné scénáře (*.scenario) a jejich pořadí (PORADI)
docs/SCENARE.md         popis jazyka scénářů
tools/                  build vestavěných scénářů
fonts/                  Inter a DejaVu Sans Mono (podmnožina znaků, licence vedle)
tests/                  rozdílové testy proti skutečnému Gitu, testy jazyka scénářů
```

## Licence a zdroje

Copyright (C) 2026 Michal Kočer. Simulátor je svobodný software pod licencí
**GNU General Public License verze 2** (`GPL-2.0-only`, soubor `LICENSE`), stejně jako Git,
z jehož zdrojového kódu (verze 2.47.1) přebírá algoritmy a texty hlášek. Přehled převzatých
souborů, jejich autorů a licencí (xdiff LGPL-2.1+, histogramový diff Eclipse Distribution
License 1.0) a licence písem je v souboru `ZDROJE.md`; na stránce v patičce pod odkazem
**O simulátoru a zdrojích**.
