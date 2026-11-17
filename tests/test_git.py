#!/usr/bin/env python3
# Git simulátor – Copyright (C) 2026 Michal Kočer
# SPDX-License-Identifier: GPL-2.0-only
"""Spustí všechny rozdílové testy: python3 tests/test_git.py [filtr]"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from difftest import Case, compare
from cases import CASES

flt = sys.argv[1] if len(sys.argv) > 1 else ""
total = bad = 0
for make in CASES:
    c = make()
    if flt and flt not in c.name: continue
    b, n = compare(c)
    total += n; bad += b
    print("%-34s %3d příkazů, rozdílů: %d" % (c.name, n, b))
print("CELKEM %d příkazů, rozdílů: %d" % (total, bad))
sys.exit(1 if bad else 0)
