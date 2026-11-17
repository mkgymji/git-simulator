# Git simulátor

*English: [README.en.md](README.en.md)*

Simulátor Gitu a GitHubu v prohlížeči. Vznikl pro kurz **Git a GitHub – rychlý úvod**
(gymnázium), ale hodí se pro každého, kdo si chce Git bezpečně vyzkoušet: nic se neinstaluje,
nic se nemůže rozbít a vidíš, co se v Gitu děje.

**Spuštění:** <https://mkgymji.github.io/git-simulator/> (nebo otevři `index.html` z disku).

## Co na obrazovce uvidíš

Stránka má tři barevně oddělené zóny:

1. **Úkoly** (zelená) – zadání scénáře. Úkol se odškrtne sám, jakmile ho splníš. Pod úkolem je
   **Nápověda** s příkazy a u některých otázka *Odpověz si*. Když se v úkolu zamotáš, odkaz
   **Začít úkol znovu** vrátí stav na jeho začátek (splněné úkoly zůstanou). Co za tebe doplnil
   simulátor, je označené fialově.
2. **Počítač** (modrá) – to, co máš na školním počítači:
   - **VS Code** se seznamem souborů vlevo a editorem vpravo. Soubory `.md` mají náhled
     (*Napíšeš* / *Uvidíš*). Ukládá se **Ctrl+S**.
   - **Terminál** ve stylu PowerShellu. Píšeš do něj příkazy (`git status`, `cd`, `mkdir`…);
     přehled ukáže `help`, šipka nahoru vrátí předchozí příkaz, Tab doplní název.
   - Záložky nahoře přepínají mezi počítači (ve scénářích pro dvojici) a **GitHubem** v prohlížeči
     (nový repozitář, úprava souboru na webu, pozvánka spolupracovníka).
3. **Co se děje v Gitu** (oranžová) – co by na skutečném počítači vidět nebylo:
   - **Kde je která verze**: pracovní složka → přípravná oblast (staging) → repozitář;
   - **Historie** jako graf commitů (každý kroužek je commit);
   - stav repozitáře na **GitHubu**.

Nahoře jsou tlačítka **Návod** (tahle stránka), **Tahák** (nejdůležitější příkazy),
**Začít znovu** a přepínač jazyka **CS / EN**.

Hlášky Gitu jsou skutečné hlášky Gitu (anglicky, jako ve škole). Šedé poznámky začínající
*Simulátor:* jsou rady simulátoru – třeba když napíšeš příkaz, který kurz nepoužívá.

## Scénáře

Tlačítkem s názvem scénáře nahoře otevřeš nabídku. Splněný scénář dostane **zelenou fajfku**
(pamatuje si ji jen tento prohlížeč; odkazem *Zapomenout splněné* je smažeš). Volný režim
nemá úkoly, a proto ani fajfku.

| Adresa | Scénář |
|---|---|
| `#volne` | volný režim – prázdný počítač |
| `#pl1` | Pracovní list 1: nastavení Gitu, první repozitář a commity |
| `#pl2` | Pracovní list 2: diff, log, restore, revert, .gitignore |
| `#revert` | Pracovní list 2, úkol 8: commit s chybou a revert v grafu |
| `#pl3` | Pracovní list 3: repozitář na GitHubu, push, úprava na webu, pull |
| `#odmitnuty-push` | Pracovní list 4 nanečisto: odmítnutý push, pull s merge commitem |
| `#spoluprace` | Pracovní list 4: Anna a Petr, pozvánka, klonování, spolupráce |
| `#vetve` | bonus: větve a merge |
| `#konflikt` | bonus: konflikt a jeho vyřešení |

Adresu scénáře stačí připsat za adresu simulátoru, např.
`https://mkgymji.github.io/git-simulator/#vetve` (tak vedou i QR kódy v materiálech kurzu).

Po obnovení stránky (F5) nebo tlačítkem **Začít znovu** začíná celý scénář znovu.

## Vlastní scénáře (pro učitele)

Scénář je obyčejný textový soubor – žádné programování. Popis jazyka s ukázkou je v
[`docs/SCENARE.md`](docs/SCENARE.md); nejlepší vzor je vestavěný scénář (v nabídce
*Stáhnout jako vzor*).

- **Nahrání:** nabídka scénářů → *Nahrát scénář* (přetažení souboru, výběr souboru nebo vložení textu).
  Chyby simulátor ukáže i s číslem řádku.
- **Moje scénáře** jsou uložené jen v tomto prohlížeči (na jiném počítači nejsou).
- **Sdílení:** dej soubor na veřejnou adresu (např. do repozitáře na GitHubu) a pošli odkaz
  `https://mkgymji.github.io/git-simulator/#load=` + adresa souboru. Jde dát i do QR kódu.

## Jazyk

Simulátor je česky a anglicky. Jazyk se vybere podle prohlížeče (čeština → česky, jinak anglicky);
přepínač **CS / EN** nahoře volbu změní a prohlížeč si ji zapamatuje. Vestavěné scénáře mají obě
verze a adresy (`#pl1`…) jsou stejné. Přepnutím jazyka začne scénář znovu.

## Co simulátor neumí

Simulátor umí příkazy z kurzu: `init`, `status`, `add`, `commit`, `diff`, `log`, `restore`,
`revert`, `branch`, `switch`, `merge`, `remote`, `push`, `pull`, `clone`, `config`.
Příkazy, které kurz nepoužívá (`rebase`, `reset`, `stash`…), a podsložky v repozitáři
neumí a řekne to šedou poznámkou. Výstupy terminálu (`ls`, `pwd`, `mkdir`) napodobují
anglický Windows PowerShell 5.1; na českých Windows mohou vypadat jinak.

Výstupy Gitu odpovídají Gitu 2.47 (Git for Windows), včetně barev a skutečných SHA-1 hashů.
Jak se to ověřuje a jak je simulátor postavený: [`docs/VYVOJ.md`](docs/VYVOJ.md).

## Licence a zdroje

Copyright (C) 2026 Michal Kočer. Simulátor je svobodný software pod licencí
**GNU General Public License verze 2** (`GPL-2.0-only`, soubor [`LICENSE`](LICENSE)), stejně jako Git,
z jehož zdrojového kódu (verze 2.47.1) přebírá algoritmy a texty hlášek. Převzaté soubory, jejich
autoři a licence a licence písem jsou v [`ZDROJE.md`](ZDROJE.md); na stránce pod odkazem
**O simulátoru a zdrojích**.
