#!/usr/bin/env python3
# Git simulátor – Copyright (C) 2026 Michal Kočer
# SPDX-License-Identifier: GPL-2.0-only
"""Náhodná práce s repozitářem (soubory, add, commit, restore, rm, větve, merge s konflikty,
revert, diff, status, log) – každý výstup se porovná se skutečným Gitem.
Použití: python3 tests/fuzz_repo.py [počet běhů] [semínko] [kroků]"""
import os, random, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from difftest import Case, compare

LINES = ["# Palačinky", "## Suroviny", "- mléko", "- vejce", "- mouka", "- sůl", "", "1. Smíchej.", "2. Smaž.",
         "Tip: marmeláda", "> citace", "text", "konec"]
NAMES = ["palacinky.md", "livance.md", "README.md", "buchty.md", "poznámky.md"]

def content(rnd, old=None):
    if old is not None and rnd.random() < 0.7:
        lines = old.split("\n")[:-1]
        for _ in range(rnd.randint(1, 3)):
            pos = rnd.randint(0, len(lines))
            r = rnd.random()
            if r < 0.4: lines.insert(pos, rnd.choice(LINES))
            elif r < 0.7 and lines: del lines[min(pos, len(lines) - 1)]
            elif lines: lines[min(pos, len(lines) - 1)] = rnd.choice(LINES)
        return "\n".join(lines) + "\n" if lines else ""
    return "\n".join(rnd.choice(LINES) for _ in range(rnd.randint(1, 8))) + "\n"

def make(rnd, k, steps):
    c = Case("repo%d" % k).machine().setup()
    if rnd.random() < 0.5:
        c.g("config", "--global", "core.quotepath", "true")
    files, branches, n = {}, ["main"], 0
    for _ in range(steps):
        r = rnd.random()
        if r < 0.25:
            name = rnd.choice(NAMES)
            files[name] = content(rnd, files.get(name))
            c.w(name, files[name])
        elif r < 0.30 and files:
            name = rnd.choice(sorted(files)); del files[name]; c.rm(name)
        elif r < 0.42:
            c.g("add", rnd.choice(["."] + NAMES + ["-A", "*.md"]))
        elif r < 0.52:
            n += 1
            c.g("commit", "-m", "Změna %d" % n) if rnd.random() < 0.8 else c.g("commit", "-am", "Změna %d" % n)
        elif r < 0.60:
            c.g("status")
        elif r < 0.68:
            c.g(*rnd.choice([["diff"], ["diff", "--staged"], ["diff", "HEAD"], ["diff", rnd.choice(NAMES)]]))
        elif r < 0.72:
            c.g("restore", rnd.choice(NAMES + ["."]))
        elif r < 0.75:
            c.g("restore", "--staged", rnd.choice(NAMES + ["."]))
        elif r < 0.78:
            c.g("rm", "--cached", rnd.choice(NAMES)) if rnd.random() < 0.5 else c.g("rm", rnd.choice(NAMES))
        elif r < 0.82 and len(branches) < 4:
            b = "vetev%d" % len(branches); branches.append(b); c.g("switch", "-c", b)
        elif r < 0.87:
            c.g("switch", rnd.choice(branches))
        elif r < 0.92:
            c.g("merge", "--no-edit", rnd.choice(branches))
        elif r < 0.94:
            c.g("merge", "--abort")
        elif r < 0.96:
            c.g("revert", "--no-edit", rnd.choice(["HEAD", "HEAD~1", "HEAD~2"]))
        else:
            c.g(*rnd.choice([["log", "--oneline"], ["log", "--oneline", "--graph", "--all"], ["branch"], ["log", "-1"]]))
        # soubory v pracovní složce mohl změnit Git – další úpravy stavíme na neznámém obsahu
        files = {k2: v for k2, v in files.items()} if rnd.random() < 0.5 else {}
    c.g("status").g("diff").g("log", "--oneline", "--graph", "--all")
    return c

if __name__ == "__main__":
    count = int(sys.argv[1]) if len(sys.argv) > 1 else 30
    rnd = random.Random(int(sys.argv[2]) if len(sys.argv) > 2 else 1)
    steps = int(sys.argv[3]) if len(sys.argv) > 3 else 40
    bad = total = shown = 0
    for k in range(count):
        case = make(rnd, k, steps)
        b, n = compare(case, verbose=(shown < 3))
        if b: shown += 1
        bad += b; total += n
    print("běhů: %d, příkazů: %d, rozdílů: %d" % (count, total, bad))
    sys.exit(1 if bad else 0)
