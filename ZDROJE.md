# Autorská práva, licence a použité zdroje

**Git simulátor**
Copyright (C) 2026 Michal Kočer

This program is free software; you can redistribute it and/or modify it under the terms
of the GNU General Public License version 2 as published by the Free Software Foundation.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
See the GNU General Public License for more details (file `LICENSE`).

Simulátor se šíří pod licencí **GNU GPL verze 2** (`GPL-2.0-only`), stejně jako Git,
ze kterého přebírá algoritmy a texty hlášek. Úplné znění licence je v souboru `LICENSE`.

## Git

Části simulátoru jsou převodem zdrojového kódu Gitu do JavaScriptu (verze **v2.47.1**,
<https://github.com/git/git/tree/v2.47.1>). Hlášky Gitu jsou převzaté doslova.

- **Git** – Copyright (C) Linus Torvalds, Junio C Hamano a další přispěvatelé projektu Git;
  GNU GPL verze 2. Některé soubory mají vlastní záhlaví, např. `diff.c` a `diffcore-rename.c`:
  Copyright (C) 2005 Junio C Hamano; `ws.c`: Copyright (C) 2007 Junio C Hamano.
- **xdiff** (knihovna pro diff a merge uvnitř Gitu) – Copyright (C) 2003 Davide Libenzi,
  `xmerge.c` Copyright (C) 2003–2006 Davide Libenzi, Johannes E. Schindelin;
  GNU LGPL verze 2.1 nebo pozdější (slučitelná s GPL-2.0).
- **xdiff/xhistogram.c** (histogramový diff) – Copyright (C) 2010, Google Inc. a další vlastníci
  práv uvedení v IP logu projektu JGit; Eclipse Distribution License v1.0 (licence typu BSD).
  Úplné znění licence je zachované v záhlaví souboru `js/text.js`.

| Soubor simulátoru | Převzato z Gitu 2.47.1 |
|---|---|
| `js/text.js` | `xdiff/xprepare.c` (příprava a úklid řádků), `xdiff/xdiffi.c` (Myersův diff, posouvání skupin změn, heuristika odsazení), `xdiff/xhistogram.c` (histogramový diff), `xdiff/xemit.c` a `xdiff/xutils.c` (záhlaví bloků diffu), `xdiff/xmerge.c` (třícestné sloučení a značky konfliktu), `combine-diff.c` (kombinovaný diff souboru v konfliktu) |
| `js/graph.js` | `graph.c` (`git log --graph`), `commit.c` (`sort_in_topological_order`) |
| `js/rename.js` | `diffcore-rename.c`, `diffcore-delta.c` (detekce přejmenování) |
| `js/git.js` | `unpack-trees.c` (`twoway_merge` – přepínání větví a kontrola místních změn), `merge-ort.c` (slučování, přejmenování, hlášky konfliktů), `sequencer.c` (`git revert`, shrnutí commitu), `wt-status.c` (`git status`), `diff.c` a `ws.c` (výpis diffu, zvýraznění chyb v mezerách), `remote.c` (stav vůči vzdálené větvi), `help.c` a `levenshtein.c` (návrh podobného příkazu), `advice.c` a `builtin/*.c` (texty hlášek příkazů), `transport.c` (výpis `git push`) |
| `js/world.js` | formát objektů Gitu (blob, tree, commit) a jejich SHA-1 |

Všechny převzaté části jsou upravené pro simulátor (JavaScript, repozitář bez podsložek,
v prohlížeči). Kde se simulátor od Gitu liší, je to uvedeno v `README.md`.

## Písma

- **Inter** – Copyright (c) 2016–2020 The Inter Project Authors; SIL Open Font License 1.1
  (`fonts/LICENSE-Inter.txt`), <https://github.com/rsms/inter>.
- **DejaVu Sans Mono** – Copyright (c) 2003 Bitstream, Inc. (Bitstream Vera), úpravy DejaVu
  jsou volné dílo; licence v `fonts/LICENSE-DejaVu.txt`, <https://dejavu-fonts.github.io/>.

Písma jsou zmenšená na potřebné znaky (fontTools), jinak se nemění.

## Ostatní

- SHA-1 podle normy FIPS 180-4, náhled Markdownu a rozhraní jsou vlastní implementace.
- Výpisy terminálu napodobují Windows PowerShell 5.1.
- Git je ochranná známka organizace Software Freedom Conservancy, GitHub je ochranná známka
  společnosti GitHub, Inc., PowerShell, Windows a Visual Studio Code jsou ochranné známky
  společnosti Microsoft. Simulátor s nimi není nijak spojen; jejich vzhled a texty napodobuje
  jen pro výuku.
