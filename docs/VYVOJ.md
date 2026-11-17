# Git simulátor – pro vývojáře

Uživatelský návod je v [README.md](../README.md). Tady je, jak je simulátor postavený a ověřený.

## Jak věrný je Git v simulátoru

Výstupy Gitu odpovídají **Gitu 2.47 (Git for Windows)** – doslova, včetně barev a skutečných
SHA-1 hashů. Části Gitu jsou převzaté algoritmicky (diff a merge z xdiff, kombinovaný diff,
`git log --graph`, detekce přejmenování, přechod mezi větvemi z unpack-trees).

Ověřuje se to **rozdílovými testy proti skutečnému Gitu**: stejné kroky se provedou v Gitu
i v simulátoru a výstupy se porovnají (text i barvy). Rozdíly verzí Gitu, které na výstup
mají vliv (např. text `hint: Disable this message with "git config advice…"`), se v testech
převádějí na podobu z 2.47.

Co simulátor neumí, řekne šedou poznámkou: příkazy mimo kurz (rebase, reset, stash…),
podsložky v repozitáři a slučování, kde se přejmenovaný soubor potká s jiným přejmenováním
téhož souboru nebo s novým souborem stejného jména.

## Testy

```sh
./tests/run_all.sh        # všechno (potřebuje git, python3 a jsc – JavaScriptCore z macOS)
python3 tests/test_git.py # pevné scénáře proti Gitu
python3 tests/fuzz_repo.py 25 7   # náhodná práce s repozitářem, semínko 7
```

`run_all.sh` navíc kontroluje:

- `tools/build_scenarios.py --check` – `js/scenarios-builtin.js` odpovídá souborům `scenarios/`;
- `tests/scenario_lang_test.js` – jazyk scénářů (chyby s čísly řádků, podmínky, příprava);
- `tests/scenario_en_test.js` – vestavěné scénáře jdou vyřešit (řešení v `tests/solutions.js`, se
  zprávami commitů jinými než v nápovědě), každý blok `AUTO` proběhne a anglická verze se řeší stejnými
  kroky jako česká a odškrtává úkoly ve stejném okamžiku; uprostřed každého úkolu ho test vrátí
  na začátek („Začít úkol znovu“), porovná stav se začátkem úkolu a řešení dokončí;
- `tools/i18n_check.py` – každý text rozhraní má anglický překlad.

## Překlady

Texty jsou v kódu česky a obalené `tr('…')`; klíčem překladu je český text, anglické znění je
v `js/i18n-en.js`. Zástupná místa: `tr('Soubor {0} už existuje.', name)`. Jazyk určuje
`js/i18n.js`: `?lang=cs|en` v adrese, pak volba přepínačem (localStorage), pak jazyk prohlížeče.

Po přidání nebo změně textu:

```sh
python3 tools/i18n_check.py --keys   # vypíše texty bez překladu
python3 tools/i18n_check.py          # kontrola úplnosti a zástupných míst
```

Vestavěný scénář má českou verzi `scenarios/<id>.scenario` a anglickou `scenarios/en/<id>.scenario`
se stejným `<id>`. Po změně spusť `python3 tools/build_scenarios.py` a uprav řešení v
`tests/solutions.js`, pokud se změnily názvy nebo kroky.

## Struktura

```
index.html              stránka (texty doplní ui.js podle jazyka)
css/style.css           vzhled (barvy a písma z materiálů kurzu)
js/i18n.js              volba jazyka a funkce tr()
js/i18n-en.js           anglické texty (klíč = český text)
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
js/scenarios.js         přeložení vestavěných scénářů v jazyce stránky
js/store.js             Moje scénáře (IndexedDB) a splněné scénáře (localStorage)
js/ui.js                rozhraní
scenarios/              vestavěné scénáře (*.scenario), pořadí (PORADI), anglické verze (en/)
docs/SCENARE.md         popis jazyka scénářů (anglicky docs/SCENARIOS.md)
tools/                  build vestavěných scénářů, kontrola překladů
fonts/                  Inter a DejaVu Sans Mono (podmnožina znaků, licence vedle)
tests/                  rozdílové testy proti Gitu, testy jazyka scénářů a překladů
```

Pořadí skriptů v `index.html`: i18n → i18n-en → text → world → graph → rename → git → shell →
markdown → session → scenario-lang → scenarios-builtin → scenarios → store → ui.

## Nasazení

GitHub Pages z větve `main` (push = nasazení). Experimenty na větvi `working`.
