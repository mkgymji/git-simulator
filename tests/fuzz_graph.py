#!/usr/bin/env python3
"""Náhodné historie s větvemi a slučováním: git log (--graph, --oneline, --all) simulátor × Git.
Použití: python3 tests/fuzz_graph.py [počet historií] [semínko]"""
import os, random, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from difftest import Case, compare

def make(rnd, k):
    c = Case("graf%d" % k).machine().setup()
    branches, cur, n = ["main"], "main", 0
    c.w("start.md", "start\n").g("add", ".").g("commit", "-m", "Start", skip=True)
    for _ in range(rnd.randint(4, 16)):
        op = rnd.random()
        if op < 0.45:
            n += 1
            c.w("f%d.md" % n, "obsah %d\n" % n).g("add", ".", skip=True).g("commit", "-m", "Commit %d" % n, skip=True)
        elif op < 0.6 and len(branches) < 5:
            name = "v%d" % len(branches)
            branches.append(name); cur = name
            c.g("switch", "-c", name, skip=True)
        elif op < 0.78:
            cur = rnd.choice(branches)
            c.g("switch", cur, skip=True)
        else:
            other = rnd.choice(branches)
            c.g("merge", "--no-edit", other, skip=True)
    for args in (["log", "--oneline", "--graph", "--all"], ["log", "--graph", "--all"], ["log", "--oneline", "--all"],
                 ["log", "--oneline", "--graph"], ["log", "--graph", "-3"], ["log", "--all", "-2"]):
        c.g(*args)
    return c

count = int(sys.argv[1]) if len(sys.argv) > 1 else 40
rnd = random.Random(int(sys.argv[2]) if len(sys.argv) > 2 else 1)
bad = total = 0
for k in range(count):
    b, n = compare(make(rnd, k), verbose=(bad == 0))
    bad += b; total += 6
print("historií: %d, výpisů: %d, rozdílů: %d" % (count, total, bad))
sys.exit(1 if bad else 0)
