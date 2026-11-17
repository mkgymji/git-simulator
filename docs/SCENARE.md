# Jazyk scénářů (FORMAT 1)

*English: [SCENARIOS.md](SCENARIOS.md)*

Scénář je obyčejný textový soubor s příponou `.scenario` (kódování UTF-8). Napíšeš ho v libovolném
editoru, v simulátoru ho nahraješ tlačítkem **Vybrat scénář → Nahrát scénář** a simulátor z něj
sestaví počítače, repozitáře a úkoly. Scénář je **jen data**: nic se v něm neprogramuje, takže je
bezpečné nahrát scénář odkudkoliv.

Nejlepší vzor jsou vestavěné scénáře: v dialogu scénářů má každý odkaz **Stáhnout jako vzor**
(soubory jsou také ve složce [`scenarios/`](../scenarios/)).

## Ukázka

```text
FORMAT 1
SCENARIO  Historie jako graf
LABEL     Pracovní list 2 · úkol 8
SUMMARY   Commit s chybou a git revert – co se stane v grafu.
INTRO     Kuchařka má jeden commit. Vpravo vidíš **graf**: každý kroužek je commit.

SETUP
  MACHINE alice CONFIGURED
  REPOSITORY kucharka
  PS> mkdir kucharka
  PS> cd kucharka
  PS> git init
  FILE livance.md
    # Lívance

    - 300 ml mléka
  END
  PS> git add .
  PS> git commit -m "Přidány lívance"
  VSCODE kucharka
END

TASK Do livance.md přidej řádek `- 2 kg soli` a commitni ho jako **Přidána chyba**.
  HINT  git commit -am "Přidána chyba"
  CHECK file livance.md in commit "Přidána chyba" contains "2 kg soli"
END

TASK Najdi hash commitu **Přidána chyba** a commit vrať.
  HINT     git log --oneline
  HINT     git revert --no-edit HASH
  NOTE     Místo `HASH` napiš hash z výpisu.
  QUESTION Kolik kroužků je v grafu?
  CHECK    commit "Přidána chyba" is reverted
  CHECK    file livance.md in HEAD does not contain "2 kg soli"
END
```

## Pravidla zápisu

- Každý řádek začíná **klíčovým slovem velkými písmeny** (`SETUP`, `PS>`, `CHECK`…). Odsazení je jen
  kvůli čitelnosti a nic neznamená – výjimkou je obsah souboru v `FILE`.
- Řádky začínající `#` jsou komentáře (kromě obsahu `FILE`). Prázdné řádky se přeskakují.
- Texty pro studenty (`INTRO`, `TASK`, `NOTE`) mohou obsahovat `` `kód` ``, `**tučně**` a `*kurzívu*`.
- Struktura je **pevná** – části musí jít v tomto pořadí:

```text
FORMAT 1                 verze jazyka (povinné, první řádek)
SCENARIO název           povinné
LABEL text               štítek nad názvem (volitelné)
SUMMARY věta             popis v seznamu scénářů (volitelné)
INTRO odstavec           úvod nad úkoly (volitelné, může být víckrát = víc odstavců)

SETUP                    příprava (povinné, právě jednou)
  …
END

TASK text úkolu          libovolný počet úkolů
  HINT / NOTE …          nápověda (0× a víc)
  QUESTION …             otázka „Odpověz si“ (0–1×)
  CHECK …                podmínka (1× a víc; úkol je splněný, když platí všechny)
  AUTO [WHEN podmínka]   co simulátor udělá za studenta (0× a víc)
    …
  END
END
```

Simulátor hlásí chyby česky i s číslem řádku. Při nahrání navíc zkusí přípravu provést nanečisto
a ohlásí každý příkaz `PS>`, který skončí chybou (např. překlep `git innit`).

## SETUP – příprava

Nejdřív postavy a počítače, potom příkazy.

| Příkaz | Význam |
|---|---|
| `PERSON id NAME "Jméno" EMAIL "e-mail" LOGIN "účet" LABEL "popisek"` | vlastní postava; povinné je jen `NAME`. Chybějící e-mail = `id@example.com`, chybějící účet = `id`, chybějící popisek = „Počítač (Jméno)“. `id` jsou malá písmena bez diakritiky. |
| `MACHINE id [CONFIGURED] [HIDDEN]` | počítač postavy. `CONFIGURED` = Git nastavený šesti řádky z PL1 (jméno, e-mail, `main`, `code --wait`, `pull.rebase false`, `core.quotepath false`). `HIDDEN` = počítač se nezobrazí (postava, která „mezitím“ něco udělala). První viditelný počítač je ten, u kterého student začíná. |
| `AS id` | další řádky se provedou na počítači `id` (na začátku je to první `MACHINE`) |
| `PS> příkaz` | příkaz do terminálu, přesně jako od studenta (`mkdir`, `cd`, `git …`). Začíná se v domovské složce. Časy commitů simulátor rozloží do minulosti sám. |
| `FILE název` … `END` | soubor v aktuální složce aktuálního počítače. Obsah se bere doslova; společné odsazení řádků se odstraní, koncové prázdné řádky také. |
| `GITHUB vlastník/název [PUBLIC] [README] [COLLABORATOR účet]…` | repozitář na GitHubu; výchozí je Private a prázdný. `README` = s prvním commitem, jako zaškrtnuté *Add a README file*. Vlastník musí být účet některé postavy. |
| `SHOW GITHUB` | zobrazí záložky GitHub (prohlížeč) |
| `REPOSITORY cesta` | repozitář, ke kterému se vztahují podmínky (cesta od domovské složky, např. `git/kucharka`) |
| `VSCODE cesta` | složka otevřená ve VS Code na aktuálním počítači |

Výchozí postavy (není potřeba je definovat):

| id | Jméno | E-mail | Účet |
|---|---|---|---|
| `alice` | Alice | `alice@example.com` | `alice` |
| `bob` | Bob | `bob@example.com` | `bob` |

## TASK – úkol

| Řádek | Význam |
|---|---|
| `TASK text` | zadání úkolu |
| `HINT text` | řádek nápovědy jako kód (příkaz, obsah souboru); prázdný `HINT` = prázdný řádek |
| `NOTE text` | řádek nápovědy jako běžný text |
| `QUESTION text` | otázka, kterou si student má zodpovědět |
| `CHECK podmínka` | podmínka splnění (viz slovník níže) |

Úkol se odškrtne sám, jakmile platí všechny jeho podmínky, a pak už zůstane splněný.

## AUTO – co simulátor udělá za studenta

V simulátoru jde o **kroky Gitu, ne o psaní**. Kde by student zbytečně opisoval (pět řádků
nastavení, celý recept), udělá to simulátor za něj a řekne mu to. Blok `AUTO` proběhne jednou:

- `AUTO WHEN podmínka` – jakmile platí podmínka (stejná jako u `CHECK`), i když úkol ještě není splněný;
- `AUTO` bez `WHEN` – hned po splnění úkolu.

| Řádek v AUTO | Význam |
|---|---|
| `NOTE text` | vysvětlivka, co simulátor udělal a proč. Ukáže se za „Doplnil simulátor:“ v terminálu a fialově u úkolu, takže ji piš jako pokračování věty. |
| `AS id` | další řádky na počítači `id` (jinak počítač z podmínky `WHEN`, nebo první viditelný) |
| `PS> příkaz` | příkaz, který simulátor „napíše“ za studenta. V terminálu je vidět i s výstupem a označením *doplnil simulátor*. Do kontrol `command … was run` se nepočítá. |
| `FILE název` … `END` | přepíše soubor |
| `APPEND název` … `END` | připíše text na konec souboru (prázdný první řádek = prázdný řádek před textem) |

Soubory se zapisují do složky repozitáře z `REPOSITORY` (když na počítači je), jinak do aktuální složky.
Pokud je soubor otevřený v editoru, změna se v něm hned ukáže.

```text
TASK Nastav své jméno. Zbytek nastavení doplní simulátor. Pak si nastavení vypiš.
  HINT  git config --global user.name "Alice"
  HINT  git config --global --list
  CHECK config user.name is set
  CHECK command "git config --global --list" was run after command "git config --global user.name..."
  AUTO WHEN config user.name is set
    NOTE e-mail a výchozí větev. Ve škole je napíšeš sám.
    PS> git config --global user.email "alice@example.com"
    PS> git config --global init.defaultBranch main
  END
END

TASK Vytvoř recept.md s nadpisem `# Buchty` a ulož. Suroviny doplní simulátor.
  CHECK file recept.md in HEAD contains line starting with "- "
  AUTO WHEN file recept.md contains line starting with "# "
    NOTE suroviny jako odrážky.
    APPEND recept.md

      - 500 g mouky
      - 2 vejce
    END
  END
END
```

**Tolerance:** student nemusí psát přesně tvoje texty. Kontroluj kroky Gitu, ne text: zprávu commitu
vůbec, obsah souboru jen tam, kde je smyslem úkolu (nadpis, odkaz, kurzíva). Pomůžou podmínky
`some commit is reverted`, `commit count is at least N`, `commit adding "T"` a `file X in any commit`.
V `HINT` dej texty jen jako příklad.

## CHECK – slovník podmínek

Podmínka se vztahuje k prvnímu viditelnému počítači. Jinému počítači ji přiřadíš předponou:
`CHECK bob: repository exists`. Texty v uvozovkách píšeš v `"…"` (fungují i české „…“).

### Soubory

| Podmínka | Kdy platí |
|---|---|
| `file X exists` / `file X does not exist` | soubor je / není v pracovní složce repozitáře |
| `file X contains "T"` / `file X does not contain "T"` | soubor obsahuje / neobsahuje text (záleží na velikosti písmen) |
| `file X contains line starting with "T"` | některý řádek souboru začíná textem |
| `file X has no conflict markers` | v souboru nejsou značky konfliktu `<<<<<<<`, `=======`, `>>>>>>>` |

Za název souboru lze dát místo (jinak se myslí pracovní složka):

| Místo | Význam |
|---|---|
| `file X in HEAD …` | soubor v posledním commitu |
| `file X in any commit …` | aspoň v jednom commitu historie (nezávisí na zprávě) |
| `file X in commit "zpráva" …` | v nejnovějším commitu, jehož zpráva obsahuje text (bez ohledu na velikost písmen; commity „Revert …“ se nepočítají, pokud je výslovně nehledáš) |
| `file X in branch B …` | v posledním commitu větve |
| `file X on github vlastník/název …` | na GitHubu (výchozí větev) |

### Repozitář a historie (potřebují `REPOSITORY`)

| Podmínka | Kdy platí |
|---|---|
| `repository exists` | ve složce z `REPOSITORY` je repozitář |
| `commit "zpráva" exists` | v historii je commit, jehož zpráva obsahuje text |
| `commit "zpráva" is reverted` | takový commit existuje a v historii je i jeho revert |
| `commit adding "T" exists` | v historii je commit, který text T přidal (v souboru je, v předchozí verzi nebyl) – **nezávisí na zprávě** |
| `commit adding "T" is reverted` | takový commit existuje a je vrácený revertem |
| `some commit is reverted` | některý commit historie je vrácený revertem – nezáleží na textu, souboru ani zprávě |
| `commit count is at least N` | na aktuální větvi je aspoň N commitů |
| `HEAD is a merge` | poslední commit má dva předchůdce |
| `merge is in progress` / `no merge is in progress` | rozdělaný merge (konflikt) je / není |
| `branch B exists` | větev existuje |
| `on branch B` | student je na větvi B |
| `branches A and B have diverged` | historie větví se rozdvojila |

### Příkazy studenta

| Podmínka | Kdy platí |
|---|---|
| `command "C" was run` | student zadal příkaz C |
| `command "C" was run after command "D"` | příkaz C byl zadán až po příkazu D |
| `output of "C" contains "T"` | některý výstup příkazu C obsahuje text |
| `output of "C" does not contain "T"` | některý výstup příkazu C text neobsahuje |
| `output of "C" contains line starting with "T"` | ve výstupu je řádek začínající textem |

Příkaz se porovnává **celý** (vícenásobné mezery nevadí): `command "git log" was run` nesplní
`git log --oneline`. Když má stačit začátek, ukonči vzor třemi tečkami:
`command "git log..." was run`, `output of "git push..." contains "[rejected]"`.

### Nastavení a VS Code

| Podmínka | Kdy platí |
|---|---|
| `config KLÍČ is set` | nastavení existuje (např. `config user.name is set`) |
| `config KLÍČ is "hodnota"` | má přesně tuto hodnotu |
| `config KLÍČ contains "text"` | hodnota obsahuje text |
| `vscode folder is cesta` | ve VS Code je otevřená tato složka |

### GitHub

| Podmínka | Kdy platí |
|---|---|
| `github vlastník/název exists` | repozitář na GitHubu existuje |
| `github vlastník/název has branch B` | má větev B |
| `github vlastník/název has collaborator účet` | účet přijal pozvánku |
| `github vlastník/název B equals HEAD` | větev B na GitHubu je stejná jako poslední commit v počítači |
| `github vlastník/název B is a merge` | poslední commit větve B má dva předchůdce |

## Nahrání, uložení a sdílení

- **Nahrání:** dialog **Vybrat scénář → Nahrát scénář** – přetažení souboru, výběr souboru nebo vložení
  textu. Scénář se uloží do **Mých scénářů**.
- **Moje scénáře** jsou uložené **jen v tomto prohlížeči** (databáze prohlížeče). Na jiném počítači ani
  v jiném prohlížeči nejsou; na školních počítačích, kde se po odhlášení maže profil, zmizí. Ukládá se
  jen text scénáře – po obnovení stránky začíná scénář znovu.
- **Sdílení odkazem:** dej soubor na veřejnou adresu (např. do repozitáře na GitHubu) a pošli odkaz
  na simulátor s `#load=` a adresou souboru:

  ```text
  https://mkgymji.github.io/git-simulator/#load=https://raw.githubusercontent.com/UZIVATEL/REPO/main/muj.scenario
  ```

  Odkaz jde dát i do QR kódu. Server se souborem musí dovolit stažení z jiné stránky
  (`raw.githubusercontent.com` to dovoluje).

## Jazyk

Klíčová slova jsou vždy anglicky, texty pro studenty (`SCENARIO`, `TASK`, `NOTE`…) piš v jazyce,
ve kterém má scénář být. Chybové hlášky simulátor píše v jazyce stránky (přepínač **CS / EN**).

## Pro správce simulátoru: vestavěné scénáře

Vestavěné scénáře jsou soubory `scenarios/*.scenario`, anglické verze se stejným názvem jsou
v `scenarios/en/`. Pořadí v nabídce určuje `scenarios/PORADI`.
Aby simulátor fungoval i otevřený z disku, zabalí je build do `js/scenarios-builtin.js`:

```sh
python3 tools/build_scenarios.py          # po každé změně scénáře
python3 tools/build_scenarios.py --check  # ověří, že je soubor aktuální (je i v tests/run_all.sh)
```

Nové klíčové slovo nebo podmínku je potřeba doplnit do `js/scenario-lang.js`, do tohoto popisu
i do anglického `SCENARIOS.md`.
Při nekompatibilní změně jazyka se zvýší `FORMAT`.
