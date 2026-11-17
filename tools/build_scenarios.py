#!/usr/bin/env python3
# Git simulátor – Copyright (C) 2026 Michal Kočer
# SPDX-License-Identifier: GPL-2.0-only
"""Zabalí vestavěné scénáře (scenarios/*.scenario v pořadí podle scenarios/PORADI)
do js/scenarios-builtin.js, aby simulátor fungoval i otevřený z disku bez serveru.

Použití: python3 tools/build_scenarios.py          (vygeneruje soubor)
         python3 tools/build_scenarios.py --check  (jen ověří, že je soubor aktuální)
"""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "scenarios")
OUT = os.path.join(ROOT, "js", "scenarios-builtin.js")

def build():
    order = [l.strip() for l in open(os.path.join(SRC, "PORADI"), encoding="utf-8") if l.strip() and not l.startswith("#")]
    files = sorted(f[:-9] for f in os.listdir(SRC) if f.endswith(".scenario"))
    missing = [f for f in files if f not in order]
    if missing:
        sys.exit("Scénáře chybí v scenarios/PORADI: " + ", ".join(missing))
    items = []
    for name in order:
        with open(os.path.join(SRC, name + ".scenario"), encoding="utf-8") as f:
            items.append({"id": name, "file": name + ".scenario", "text": f.read()})
    return ("/*\n * Git simulátor – Copyright (C) 2026 Michal Kočer\n * SPDX-License-Identifier: GPL-2.0-only\n *\n"
            " * VYGENEROVÁNO nástrojem tools/build_scenarios.py ze souborů scenarios/*.scenario.\n"
            " * Neupravuj ručně – uprav scénář a spusť build znovu.\n */\n"
            "(function (root) {\n  root.GitBuiltinScenarios = " + json.dumps(items, ensure_ascii=False, indent=2) + ";\n"
            "})(typeof window !== 'undefined' ? window : globalThis);\n")

if __name__ == "__main__":
    text = build()
    if "--check" in sys.argv:
        current = open(OUT, encoding="utf-8").read() if os.path.exists(OUT) else ""
        if current != text:
            sys.exit("js/scenarios-builtin.js není aktuální – spusť python3 tools/build_scenarios.py")
        print("js/scenarios-builtin.js je aktuální")
    else:
        open(OUT, "w", encoding="utf-8").write(text)
        print("vygenerováno: js/scenarios-builtin.js (%d scénářů)" % text.count('"file":'))
