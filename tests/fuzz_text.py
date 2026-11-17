#!/usr/bin/env python3
# Git simulátor – Copyright (C) 2026 Michal Kočer
# SPDX-License-Identifier: GPL-2.0-only
"""Porovná diff a merge simulátoru se skutečným Gitem na náhodných souborech.

Použití: python3 tests/fuzz_text.py [počet] [semínko]
Potřebuje git a jsc (JavaScriptCore, součást macOS) nebo node.
"""
import json, os, random, shutil, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JSC = "/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc"

VOCAB = ["# Palačinky", "## Suroviny", "## Postup", "## Tip", "", "", "", "- 250 ml mléka", "- 1 vejce",
         "- 120 g hladké mouky", "- špetka soli", "1. Všechno smíchej v míse.", "2. Nech těsto odpočinout.",
         "3. Smaž na pánvi.", "Recepty, které umím uvařit.", "Moje kuchařka", "  odsazený řádek",
         "    víc odsazený", "> citace", "| a | b |", "|---|---|", "text", "text", "konec"]

def rand_file(rnd, n=None):
    n = rnd.randint(0, int(os.environ.get("MAXLINES", "14"))) if n is None else n
    return [rnd.choice(VOCAB) for _ in range(n)]

def mutate(rnd, lines):
    lines = list(lines)
    for _ in range(rnd.randint(1, 4)):
        op = rnd.choice("idrb")
        pos = rnd.randint(0, len(lines))
        if op == "i":
            lines[pos:pos] = rand_file(rnd, rnd.randint(1, 3))
        elif op == "d" and lines:
            pos = min(pos, len(lines) - 1)
            del lines[pos:pos + rnd.randint(1, 3)]
        elif op == "r" and lines:
            pos = min(pos, len(lines) - 1)
            lines[pos] = rnd.choice(VOCAB)
        elif op == "b":
            lines[pos:pos] = [""]
    return lines

def text(rnd, lines):
    if not lines:
        return ""
    return "\n".join(lines) + ("" if rnd.random() < 0.08 else "\n")

def run_js(script, payload):
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8") as f:
        json.dump(payload, f)
        name = f.name
    try:
        if os.path.exists(JSC):
            cmd = [JSC, os.path.join(ROOT, "js/text.js"), os.path.join(ROOT, "tests", script), "--", name]
        else:
            cmd = ["node", os.path.join(ROOT, "tests", script), name]
        out = subprocess.run(cmd, capture_output=True, text=True)
        if out.returncode != 0:
            sys.exit("JS selhal:\n" + out.stdout + out.stderr)
        return json.loads(out.stdout)
    finally:
        os.unlink(name)

def git(args, cwd):
    env = dict(os.environ, LC_ALL="C", GIT_CONFIG_GLOBAL="/dev/null", GIT_CONFIG_SYSTEM="/dev/null")
    return subprocess.run(["git"] + args, cwd=cwd, capture_output=True, env=env).stdout.decode("utf-8", "replace")

def main():
    count = int(sys.argv[1]) if len(sys.argv) > 1 else 300
    seed = int(sys.argv[2]) if len(sys.argv) > 2 else 1
    rnd = random.Random(seed)
    cases = []
    for _ in range(count):
        base = rand_file(rnd)
        a = mutate(rnd, base)
        b = mutate(rnd, base)
        cases.append({"base": text(rnd, base), "a": text(rnd, a), "b": text(rnd, b)})
    got = run_js("fuzz_text.js", cases)
    tmp = tempfile.mkdtemp()
    bad = {"myers": 0, "histogram": 0, "merge": 0}
    shown = 0
    try:
        for i, c in enumerate(cases):
            for name in ("base", "a", "b"):
                with open(os.path.join(tmp, name), "w", encoding="utf-8", newline="") as f:
                    f.write(c[name])
            exp = {}
            for alg, flag in (("myers", "--diff-algorithm=myers"), ("histogram", "--diff-algorithm=histogram")):
                out = git(["diff", "--no-index", "--no-color", flag, "base", "a"], tmp)
                exp[alg] = "\n".join(out.split("\n")[4:]) if out else ""
            exp["merge"] = git(["merge-file", "-p", "--diff-algorithm=histogram", "-L", "HEAD", "-L", "base",
                                "-L", "uprava", "a", "base", "b"], tmp)
            for key in ("myers", "histogram", "merge"):
                if got[i][key] != exp[key]:
                    bad[key] += 1
                    if shown < 3:
                        shown += 1
                        print("=== ROZDÍL (%s), případ %d" % (key, i))
                        print("--- base\n" + c["base"] + "--- a\n" + c["a"] + "--- b\n" + c["b"])
                        print("--- git\n" + exp[key] + "--- simulátor\n" + got[i][key])
    finally:
        shutil.rmtree(tmp)
    print("případů: %d, rozdíly: %s" % (count, bad))
    sys.exit(1 if any(bad.values()) else 0)

if __name__ == "__main__":
    main()
