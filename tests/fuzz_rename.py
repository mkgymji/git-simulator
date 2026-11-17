#!/usr/bin/env python3
"""Přejmenování souborů na větvích a slučování / revert: simulátor × Git.
Použití: python3 tests/fuzz_rename.py [počet] [semínko]"""
import os, random, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from difftest import Case, compare

WORDS = ["mléko", "vejce", "mouka", "sůl", "cukr", "máslo", "droždí", "tvaroh", "jablka", "skořice"]

def recipe(rnd, n=None):
    return "".join("- %d g %s\n" % (rnd.randint(1, 500), rnd.choice(WORDS)) for _ in range(n or rnd.randint(4, 9)))

def edit(rnd, text):
    lines = text.split("\n")[:-1]
    for _ in range(rnd.randint(1, 2)):
        i = rnd.randrange(len(lines))
        r = rnd.random()
        if r < 0.5: lines[i] = "- %d g %s" % (rnd.randint(1, 500), rnd.choice(WORDS))
        elif r < 0.8: lines.insert(i, "- %d g %s" % (rnd.randint(1, 500), rnd.choice(WORDS)))
        elif len(lines) > 2: del lines[i]
    return "\n".join(lines) + "\n"

def make(rnd, k):
    c = Case("ren%d" % k).machine().setup()
    names = ["palacinky.md", "livance.md", "buchty.md"]
    files = {n: recipe(rnd) for n in names}
    for n, t in files.items(): c.w(n, t)
    c.g("add", ".", skip=True).g("commit", "-m", "Základ", skip=True)
    src = rnd.choice(names)
    new = rnd.choice(["recept.md", "palačinky.md", "zz.md", "aa.md"])
    # větev: přejmenuje (někdy s úpravou)
    c.g("switch", "-c", "prejmenuj", skip=True)
    c.rm(src).w(new, files[src] if rnd.random() < 0.5 else edit(rnd, files[src]))
    if rnd.random() < 0.3:
        other = rnd.choice([n for n in names if n != src]); c.w(other, edit(rnd, files[other]))
    c.g("add", "-A", skip=True).g("commit", "-m", "Přejmenování", skip=True)
    # main: upraví zdroj / smaže / přejmenuje jinam / přidá stejné jméno / nic
    c.g("switch", "main", skip=True)
    r = rnd.random()
    if r < 0.55: c.w(src, edit(rnd, files[src]))
    elif r < 0.65: c.rm(src)
    elif r < 0.75: c.rm(src).w("jine.md", files[src])
    elif r < 0.85: c.w(new, recipe(rnd))
    else:
        other = rnd.choice([n for n in names if n != src]); c.w(other, edit(rnd, files[other]))
    c.g("add", "-A", skip=True).g("commit", "-m", "Úprava", skip=True)
    who = rnd.random()
    if who < 0.7:
        c.g("merge", "--no-edit", "prejmenuj")
    else:
        c.g("switch", "prejmenuj").g("merge", "--no-edit", "main")
    c.g("status").g("diff").g("diff", "HEAD")
    c.g("add", "-A").g("commit", "-m", "Hotovo").g("log", "--oneline", "--graph").g("diff", "HEAD~1")
    c.g("revert", "--no-edit", "HEAD~1").g("status")
    return c

count = int(sys.argv[1]) if len(sys.argv) > 1 else 40
rnd = random.Random(int(sys.argv[2]) if len(sys.argv) > 2 else 1)
bad = total = shown = 0
stats = {}
for k in range(count):
    b, n = compare(make(rnd, k), verbose=(shown < 2), stop_on_note=True, stats=stats)
    if b: shown += 1
    bad += b; total += n
print("běhů: %d, příkazů: %d, rozdílů: %d, nepodporováno (běh ukončen): %d" % (count, total, bad, stats.get("neumi", 0)))
sys.exit(1 if bad else 0)
