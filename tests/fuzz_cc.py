#!/usr/bin/env python3
# Git simulátor – Copyright (C) 2026 Michal Kočer
# SPDX-License-Identifier: GPL-2.0-only
"""Kombinovaný výpis (git diff při konfliktu): simulátor × skutečný Git na náhodných konfliktech."""
import json, os, random, shutil, subprocess, sys, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fuzz_text import rand_file, mutate, text, JSC, ROOT

def git(args, cwd, check=False):
    env = dict(os.environ, LC_ALL="C", GIT_CONFIG_GLOBAL="/dev/null", GIT_CONFIG_SYSTEM="/dev/null",
               GIT_AUTHOR_NAME="a", GIT_AUTHOR_EMAIL="a@a", GIT_COMMITTER_NAME="a", GIT_COMMITTER_EMAIL="a@a")
    return subprocess.run(["git"] + args, cwd=cwd, capture_output=True, env=env).stdout.decode("utf-8", "replace")

def main():
    count = int(sys.argv[1]) if len(sys.argv) > 1 else 150
    rnd = random.Random(int(sys.argv[2]) if len(sys.argv) > 2 else 1)
    cases, exp = [], []
    tmp = tempfile.mkdtemp()
    try:
        while len(cases) < count:
            d = os.path.join(tmp, "r%d" % len(cases)); os.makedirs(d)
            base = rand_file(rnd); a = mutate(rnd, base); b = mutate(rnd, base)
            def put(t):
                with open(os.path.join(d, "f.md"), "w", encoding="utf-8", newline="") as f: f.write(t)
            git(["init", "-q", "-b", "main"], d)
            put(text(rnd, base)); git(["add", "."], d); git(["commit", "-qm", "base"], d)
            git(["switch", "-qc", "x"], d); tb = text(rnd, b); put(tb); git(["commit", "-qam", "b"], d)
            git(["switch", "-q", "main"], d); ta = text(rnd, a); put(ta); git(["commit", "-qam", "a"], d)
            git(["merge", "x"], d)
            if "UU" not in git(["status", "--porcelain"], d):
                shutil.rmtree(d); continue
            work = open(os.path.join(d, "f.md"), encoding="utf-8").read()
            if rnd.random() < 0.5:
                work = text(rnd, mutate(rnd, work.split("\n")[:-1] if work.endswith("\n") else work.split("\n")))
                put(work)
            out = git(["diff", "--no-color"], d).split("\n")
            exp.append("\n".join(out[4:]).rstrip("\n"))
            cases.append({"ours": ta, "theirs": tb, "work": work})
            shutil.rmtree(d)
    finally:
        shutil.rmtree(tmp)
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8") as f:
        json.dump(cases, f); name = f.name
    p = subprocess.run([JSC, os.path.join(ROOT, "js/text.js"), os.path.join(ROOT, "tests/fuzz_cc.js"), "--", name], capture_output=True, text=True)
    os.unlink(name)
    got = json.loads(p.stdout)
    bad = 0
    for i, (g, e) in enumerate(zip(got, exp)):
        if g.rstrip("\n") != e:
            bad += 1
            if bad <= 2:
                print("=== ROZDÍL %d\n--- ours\n%s--- theirs\n%s--- work\n%s--- git\n%s\n--- sim\n%s" % (i, cases[i]["ours"], cases[i]["theirs"], cases[i]["work"], e, g))
    print("konfliktů: %d, rozdíly: %d" % (len(cases), bad))
    sys.exit(1 if bad else 0)

if __name__ == "__main__":
    main()
