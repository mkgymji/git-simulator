"""Případy pro rozdílový test (skutečný Git × simulátor)."""
from difftest import Case

PAL1 = "# Palačinky\n\n## Suroviny\n\n- 250 ml mléka\n- 1 vejce\n- 120 g hladké mouky\n- špetka soli\n"
PAL2 = PAL1 + "\n## Postup\n\n1. Všechno smíchej v míse.\n2. Nech těsto 15 minut odpočinout.\n3. Smaž na rozpálené pánvi.\n"
LIV = "# Lívance\n\n## Suroviny\n\n- 300 ml mléka\n- 2 vejce\n- 200 g mouky\n"
README = "# Moje kuchařka\n\nRecepty, které umím uvařit.\n\n- [Palačinky](palacinky.md)\n- [Lívance](livance.md)\n"
CASES = []
def case(f):
    CASES.append(f); return f

@case
def zaklad():
    c = Case("zaklad").machine()
    c.g("status").g("config", "--global", "--list")
    c.cfg().g("config", "--global", "core.editor", "code --wait").g("config", "--global", "--list")
    c.g("config", "user.name").g("config", "--global", "user.email")
    c.mkdir("git").cd("git").mkdir("kucharka").cd("kucharka")
    c.g("init").g("init").g("status").g("log").g("branch").g("commit", "-m", "x").g("add").g("add", "nic.md")
    c.g("restore", "--staged", "x").g("push").g("pull").g("diff").g("log", "--oneline")
    c.w("palacinky.md", PAL1).g("status").g("diff").g("commit", "-m", "x").g("add", "palacinky.md").g("status")
    c.g("diff").g("diff", "--staged").g("commit", "-m", "Přidán recept na palačinky").g("status").g("log").g("log", "--oneline")
    c.w("palacinky.md", PAL2).w("livance.md", LIV).w("README.md", README)
    c.g("status").g("diff").g("commit", "-m", "nic").g("add", "palacinky.md").w("palacinky.md", "# P\n").g("status")
    c.g("diff").g("diff", "--staged").g("commit", "-m", "Přidán postup").g("restore", "palacinky.md").g("status")
    c.g("add", ".").g("status").g("commit", "-m", "Přidány lívance a README").g("log", "--oneline").g("log", "-1").g("log")
    c.rm("livance.md").g("status").g("diff").g("add", "livance.md").g("status").g("diff", "--staged")
    c.g("restore", "--staged", "livance.md").g("status").g("restore", "livance.md").g("status")
    c.g("restore", "nic.md").g("revert", "HEAD~5").g("switch", "x").g("merge", "x").g("branch", "main").g("switch", "main")
    c.g("comit").g("stauts").g("psuh").g("ad").g("lgo").g("xyzzy").g("commit").g("branch", "-a")
    return c

@case
def bez_nastaveni():
    # Chybějící jméno/e-mail: skutečný Git tu bere údaje z macOS (jméno účtu, hostname.local),
    # Git for Windows na školním PC bez domény skončí chybou. Tyto kroky se jen provedou.
    c = Case("bez_nastaveni").machine()
    c.mkdir("kucharka").cd("kucharka").g("init").g("status").w("a.md", "a\n").g("add", "a.md")
    c.g("config", "--global", "user.email", "novakovaj@jirovcovka.net")
    c.g("config", "--global", "user.name", "Jana Nováková").g("commit", "-m", "První").g("status").g("branch")
    c.w("palačinky.md", "x\n").g("status").g("add", ".").g("status").g("commit", "-m", "Diakritika v názvu").g("log", "--oneline")
    c.w("palačinky.md", "x\ny\n").g("diff").g("status").g("config", "--global", "core.quotepath", "false").g("diff").g("status")
    return c

@case
def historie():
    c = Case("historie").machine().setup()
    c.w("palacinky.md", PAL1).g("add", ".").g("commit", "-m", "Přidán recept na palačinky")
    c.w("palacinky.md", PAL2).g("add", ".").g("commit", "-m", "Přidán postup")
    c.w("livance.md", LIV).g("add", ".").g("commit", "-m", "Přidány lívance")
    c.w("palacinky.md", "# Palačinky\n").g("diff").g("restore", "palacinky.md").g("status").g("diff")
    c.g("restore", "--source=HEAD~2", "palacinky.md").g("status").g("diff").g("restore", "palacinky.md")
    c.w("livance.md", LIV + "- 2 kg soli\n").g("add", ".").g("commit", "-m", "Přidána chyba").g("log", "--oneline")
    c.g("revert", "--no-edit", "HEAD").g("log", "--oneline").g("log", "-2").g("status")
    c.g("revert", "HEAD~3").g("log", "--oneline").g("revert", "--no-edit", "HEAD~1").g("status")
    c.w("poznamky-pro-me.md", "tajné\n").g("status").w(".gitignore", "poznamky-pro-me.md\n").g("status")
    c.g("add", "poznamky-pro-me.md").g("add", ".").g("status").g("commit", "-m", "Přidán .gitignore").g("status")
    c.g("commit", "--amend", "-m", "Přidán soubor .gitignore").g("log", "-1").g("log", "--oneline")
    c.w("livance.md", LIV + "tip\n").g("commit", "-am", "Tip k lívancům").g("status")
    c.w("a.md", "a\n").g("add", "a.md").g("rm", "--cached", "a.md").g("status").g("add", "a.md").g("commit", "-m", "a")
    c.g("rm", "a.md").g("status").g("commit", "-m", "a pryč").g("rm", "nic").w("livance.md", "x\n").g("rm", "livance.md")
    c.g("restore", ".").g("status").g("revert", "nesmysl").g("revert", "HEAD", "--no-edit")
    return c

@case
def vetve():
    c = Case("vetve").machine().setup()
    c.w("README.md", "# Moje kuchařka\n\nMoje nejoblíbenější recepty.\n").g("add", ".").g("commit", "-m", "README")
    c.g("branch").g("switch", "-c", "nove-recepty").g("branch").g("status")
    c.w("livance.md", "# Lívance\n").g("add", ".").g("commit", "-m", "Přidány lívance").g("switch", "main").g("branch")
    c.g("merge", "nove-recepty").g("log", "--oneline").g("merge", "nove-recepty").g("branch", "-d", "nove-recepty").g("branch")
    c.g("switch", "-c", "uprava").w("README.md", "# Moje kuchařka\n\nRecepty, které umím uvařit i já.\n").g("commit", "-am", "Úprava README")
    c.g("switch", "main").w("README.md", "# Moje kuchařka\n\nMoje nejoblíbenější recepty z domova.\n").g("commit", "-am", "Jiná úprava README")
    c.g("branch", "-d", "uprava").g("merge", "uprava").g("status").g("diff").g("commit", "-m", "x").g("merge", "uprava").g("switch", "uprava")
    c.g("merge", "--abort").g("status").g("merge", "uprava")
    c.w("README.md", "# Moje kuchařka\n\nRecepty, které umím uvařit i já.\nMoje nejoblíbenější recepty z domova.\n")
    c.g("status").g("add", "README.md").g("status").g("merge", "uprava").g("commit", "-m", "Vyřešen konflikt v README").g("log", "--oneline").g("log", "-1").g("status")
    c.g("switch", "-c", "a").w("a.md", "a\n").g("add", ".").g("commit", "-m", "a").g("switch", "main").w("b.md", "b\n").g("add", ".").g("commit", "-m", "b")
    c.g("merge", "a").g("log", "--oneline").g("log", "-1").g("branch").g("switch", "-c", "main").g("switch", "-c", "a").g("branch", "x y")
    c.g("merge", "--abort").g("branch", "-D", "a").g("branch", "-d", "main").g("branch", "-d", "nic").g("branch", "-M", "hlavni").g("branch").g("status")
    return c

@case
def prepinani_se_zmenami():
    c = Case("prepinani").machine().setup()
    c.w("a.md", "a\n").w("b.md", "b\n").g("add", ".").g("commit", "-m", "start")
    c.g("switch", "-c", "druha").w("a.md", "a2\n").g("commit", "-am", "a2").g("switch", "main")
    c.w("b.md", "b lokálně\n").g("switch", "druha").g("status").g("switch", "main")
    c.w("a.md", "a lokálně\n").g("switch", "druha").g("merge", "druha").g("restore", "a.md").g("restore", "b.md")
    c.w("c.md", "c\n").g("add", "c.md").g("switch", "druha").g("switch", "main").g("commit", "-m", "c")
    c.g("switch", "druha").w("c.md", "nesledovaný\n").g("switch", "main").g("merge", "main").rm("c.md")
    c.w("b.md", "b ve druhé\n").g("commit", "-am", "b ve druhé").g("switch", "main").w("b.md", "b v main\n").g("add", ".").g("merge", "druha")
    c.g("commit", "-m", "b v main").w("a.md", "rozdělané\n").g("merge", "druha").g("restore", "a.md").g("merge", "druha").g("status")
    return c

@case
def github():
    c = Case("github").machine().setup()
    c.w("palacinky.md", PAL1).g("add", ".").g("commit", "-m", "Přidán recept na palačinky")
    c.g("remote", "-v").g("remote").g("push").g("remote", "add", "origin", "https://github.com/jana/kucharka.git")
    c.g("remote", "add", "origin", "x").g("remote", "-v").g("remote").g("push").g("pull", skip=True).g("branch", "-M", "main")
    # skip (zde i u "pull origin nic" a klonu neexistujícího repa): testovací náhrada GitHubu
    # nepoužívá HTTPS, a tak přidá řádek "remote end hung up" / jinou chybu. Skutečný GitHub:
    # "remote: Repository not found." + "fatal: repository '...' not found", resp. jen
    # "fatal: couldn't find remote ref nic" – to vypisuje simulátor.
    # skip: repozitář na GitHubu ještě neexistuje – skutečný GitHub hlásí "Repository not found",
    # testovací náhrada (složka na disku) hlásí "does not appear to be a git repository"
    c.gh("jana", "kucharka").g("push").g("pull").g("status").g("push", "-u", "origin", "main").g("status").g("push").g("pull").g("branch", "-a").g("log", "--oneline")
    c.w("palacinky.md", PAL2).g("commit", "-am", "Přidán postup").g("status").g("log", "--oneline").g("push").g("status").g("log", "--oneline")
    c.g("remote", "set-url", "origin", "https://github.com/jana/kucharka").g("remote", "-v").g("remote", "set-url", "x", "y").g("remote", "remove", "x")
    c.g("push", "origin", "main").g("push", "nic").g("pull", "origin", "main").g("pull", "origin", "nic", skip=True)
    return c

@case
def dvojice():
    c = Case("dvojice").machine("anna").machine("petr")
    c.cfg("anna", "Anna Svobodová", "svobodovaa@jirovcovka.net").cfg("petr", "Petr Dvořák", "dvorakp@jirovcovka.net")
    c.mkdir("git", "anna").cd("git", "anna").mkdir("git", "petr").cd("git", "petr")
    c.gh("anna", "spolecna-kucharka", collab=["petr"])
    c.g("clone", "https://github.com/anna/spolecna-kucharka.git", m="anna").cd("spolecna-kucharka", "anna")
    c.g("status", m="anna").w("README.md", "# spolecna-kucharka\n", "anna").g("add", ".", m="anna").g("commit", "-m", "Initial commit", m="anna")
    c.g("push", m="anna").g("status", m="anna")
    c.g("clone", "https://github.com/anna/spolecna-kucharka.git", m="petr").g("clone", "https://github.com/anna/spolecna-kucharka.git", m="petr")
    c.g("clone", "https://github.com/anna/nic.git", m="petr", skip=True).cd("spolecna-kucharka", "petr").g("status", m="petr").g("log", "--oneline", m="petr").g("remote", "-v", m="petr")
    c.w("bramboracka.md", "# Bramboračka\n", "anna").g("add", ".", m="anna").g("commit", "-m", "Přidána bramboračka", m="anna").g("push", m="anna")
    c.w("buchty.md", "# Buchty\n", "petr").g("add", ".", m="petr").g("commit", "-m", "Přidány buchty", m="petr").g("status", m="petr")
    c.g("push", m="petr").g("status", m="petr").g("pull", m="petr").g("status", m="petr").g("log", "--oneline", m="petr").g("log", "-1", m="petr")
    c.g("push", m="petr").g("status", m="petr").g("pull", m="anna").g("log", "--oneline", m="anna").g("pull", m="anna").g("status", m="anna")
    # konflikt v README
    c.w("README.md", "# spolecna-kucharka\n\n> Kuchařka, kterou píšeme ve dvou.\n", "anna").g("commit", "-am", "Citace v README", m="anna").g("push", m="anna")
    c.w("README.md", "# spolecna-kucharka\n\nNaše společná kuchařka.\n", "petr").g("commit", "-am", "Popis v README", m="petr")
    c.g("push", m="petr").g("pull", m="petr").g("status", m="petr").g("pull", m="petr").g("push", m="petr")
    c.w("README.md", "# spolecna-kucharka\n\n> Kuchařka, kterou píšeme ve dvou.\n\nNaše společná kuchařka.\n", "petr")
    c.g("add", "README.md", m="petr").g("status", m="petr").g("commit", "-m", "Vyřešen konflikt", m="petr").g("push", m="petr").g("log", "--oneline", m="petr")
    c.g("pull", m="anna").g("log", "--oneline", m="anna").g("status", m="anna")
    # push zpět: fetch dřív, pak non-fast-forward
    c.w("a.md", "a\n", "anna").g("add", ".", m="anna").g("commit", "-m", "a", m="anna").g("push", m="anna")
    c.g("fetch", m="petr").g("status", m="petr").w("b.md", "b\n", "petr").g("add", ".", m="petr").g("commit", "-m", "b", m="petr").g("status", m="petr").g("push", m="petr")
    c.g("pull", m="petr").g("push", m="petr")
    return c

@case
def bez_pull_rebase():
    c = Case("bez_pull_rebase").machine("anna").machine("petr")
    for m in ("anna", "petr"):
        c.g("config", "--global", "user.name", m, m=m).g("config", "--global", "user.email", m + "@x.cz", m=m).g("config", "--global", "init.defaultBranch", "main", m=m)
    c.gh("anna", "k", collab=["petr"]).mkdir("k", "anna").cd("k", "anna").g("init", m="anna").w("a.md", "a\n", "anna").g("add", ".", m="anna").g("commit", "-m", "a", m="anna")
    c.g("remote", "add", "origin", "https://github.com/anna/k.git", m="anna").g("push", "-u", "origin", "main", m="anna")
    c.g("clone", "https://github.com/anna/k.git", "kopie", m="petr").cd("kopie", "petr")
    c.w("b.md", "b\n", "anna").g("add", ".", m="anna").g("commit", "-m", "b", m="anna").g("push", m="anna")
    c.w("c.md", "c\n", "petr").g("add", ".", m="petr").g("commit", "-m", "c", m="petr").g("pull", m="petr").g("status", m="petr")
    c.g("config", "pull.rebase", "false", m="petr").g("pull", m="petr").g("log", "--oneline", m="petr")
    return c

@case
def prejmenovani():
    BASE = "# Palačinky\n\n## Suroviny\n\n- 250 ml mléka\n- 1 vejce\n- 120 g hladké mouky\n- špetka soli\n\n## Postup\n\n1. Smíchej.\n2. Smaž.\n"
    c = Case("prejmenovani").machine().setup()
    c.w("palacinky.md", BASE).g("add", ".").g("commit", "-m", "Recept")
    # přejmenování beze změny a se změnou: status, commit, diff
    c.rm("palacinky.md").w("palačinky.md", BASE).g("status").g("add", "-A").g("status").g("diff", "--staged").g("commit", "-m", "Přejmenováno")
    c.rm("palačinky.md").w("recept.md", BASE.replace("2. Smaž.", "2. Smaž na pánvi.")).g("add", "-A").g("status").g("diff", "--staged").g("diff", "HEAD~1").g("commit", "-m", "Znovu")
    c.g("log", "--oneline")
    # větev přejmenuje, main upraví -> merge
    c.g("switch", "-c", "prejmenuj").rm("recept.md").w("palacinky.md", BASE.replace("2. Smaž.", "2. Smaž na pánvi.")).g("add", "-A").g("commit", "-m", "Zpět na palacinky")
    c.g("switch", "main").w("recept.md", BASE.replace("- 1 vejce", "- 2 vejce").replace("2. Smaž.", "2. Smaž na pánvi.")).g("commit", "-am", "Dvě vejce")
    c.g("merge", "--no-edit", "prejmenuj").g("status").g("log", "--oneline", "--graph").g("diff", "HEAD~1")
    return c

@case
def diakritika_merge():
    # core.quotepath zůstává výchozí (true): status uvozuje, merge ne
    c = Case("diakritika_merge").machine()
    c.g("config", "--global", "user.name", "Jana").g("config", "--global", "user.email", "j@x.cz").g("config", "--global", "init.defaultBranch", "main")
    c.mkdir("k").cd("k").g("init").w("poznámky.md", "a\n").w("č.md", "x\n").w("recept.md", "- 1 mléko\n- 2 vejce\n- 3 mouka\n- 4 sůl\n")
    c.g("add", ".").g("commit", "-m", "A").g("switch", "-c", "x").w("poznámky.md", "b\n").rm("č.md")
    c.rm("recept.md").w("palačinky.md", "- 1 mléko\n- 2 vejce\n- 3 mouka\n- 5 sůl\n").g("add", "-A").g("commit", "-m", "B")
    c.g("switch", "main").w("poznámky.md", "c\n").w("č.md", "y\n").rm("recept.md").g("add", "-A").g("commit", "-m", "C")
    c.g("merge", "x").g("status").g("diff").g("diff", "--staged").g("add", "-A").g("status").g("commit", "-m", "Vyřešeno")
    c.g("log", "--oneline", "--graph").g("switch", "-c", "y", "HEAD~1", skip=True)
    return c
