#!/usr/bin/env python3
"""Dvojice přes GitHub: náhodné commity, push, pull, fetch, status, log – simulátor × Git.
Použití: python3 tests/fuzz_remote.py [počet] [semínko] [kroků]"""
import os, random, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from difftest import Case, compare
from fuzz_repo import content, NAMES

def make(rnd, k, steps):
    c = Case("remote%d" % k).machine("anna").machine("petr")
    c.cfg("anna", "Anna Svobodová", "svobodovaa@jirovcovka.net").cfg("petr", "Petr Dvořák", "dvorakp@jirovcovka.net")
    c.gh("anna", "spolecna-kucharka", collab=["petr"])
    c.mkdir("git", "anna").cd("git", "anna").mkdir("git", "petr").cd("git", "petr")
    if rnd.random() < 0.5:
        c.mkdir("spolecna-kucharka", "anna").cd("spolecna-kucharka", "anna").g("init", m="anna")
        c.w("README.md", "# spolecna-kucharka\n", "anna").g("add", ".", m="anna").g("commit", "-m", "Začátek", m="anna")
        c.g("remote", "add", "origin", "https://github.com/anna/spolecna-kucharka.git", m="anna").g("push", "-u", "origin", "main", m="anna")
    else:
        c.g("clone", "https://github.com/anna/spolecna-kucharka.git", m="anna").cd("spolecna-kucharka", "anna")
        c.w("README.md", "# spolecna-kucharka\n", "anna").g("add", ".", m="anna").g("commit", "-m", "Začátek", m="anna").g("push", m="anna")
    c.g("clone", "https://github.com/anna/spolecna-kucharka.git", m="petr").cd("spolecna-kucharka", "petr")
    files = {"anna": {}, "petr": {}}
    n = 0
    for _ in range(steps):
        m = rnd.choice(["anna", "petr"])
        r = rnd.random()
        if r < 0.28:
            name = rnd.choice(NAMES)
            files[m][name] = content(rnd, files[m].get(name))
            c.w(name, files[m][name], m)
        elif r < 0.40:
            c.g("add", ".", m=m)
        elif r < 0.52:
            n += 1; c.g("commit", "-m", "Změna %d" % n, m=m)
        elif r < 0.64:
            c.g("push", m=m)
        elif r < 0.76:
            c.g("pull", m=m)
        elif r < 0.80:
            c.g("fetch", m=m)
        elif r < 0.88:
            c.g("status", m=m)
        elif r < 0.92:
            c.g("log", "--oneline", "--graph", "--all", m=m)
        elif r < 0.96:
            c.g("diff", m=m)
        else:
            c.g("add", "-A", m=m); c.g("commit", "-m", "Vyřešeno %d" % n, m=m)
        files[m] = {} if rnd.random() < 0.3 else files[m]
    for m in ("anna", "petr"):
        c.g("status", m=m).g("log", "--oneline", "--graph", "--all", m=m)
    return c

if __name__ == "__main__":
    count = int(sys.argv[1]) if len(sys.argv) > 1 else 20
    rnd = random.Random(int(sys.argv[2]) if len(sys.argv) > 2 else 1)
    steps = int(sys.argv[3]) if len(sys.argv) > 3 else 40
    bad = total = shown = 0
    for k in range(count):
        b, n = compare(make(rnd, k, steps), verbose=(shown < 2))
        if b: shown += 1
        bad += b; total += n
    print("běhů: %d, příkazů: %d, rozdílů: %d" % (count, total, bad))
    sys.exit(1 if bad else 0)
