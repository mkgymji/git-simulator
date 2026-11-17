# Git simulátor – Copyright (C) 2026 Michal Kočer
# SPDX-License-Identifier: GPL-2.0-only
"""Rozdílový test: stejné kroky ve skutečném Gitu a v simulátoru, výstupy se musí shodovat."""
import json, os, subprocess, sys, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from realgit import Real, clean

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JSC = "/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc"
JS = ["js/text.js", "js/world.js", "js/graph.js", "js/rename.js", "js/git.js", "tests/sim_driver.js"]
T0 = 1794787200

class Case:
    """Zapisuje kroky; g() = příkaz gitu, w() = zápis souboru atd."""
    def __init__(self, name):
        self.name, self.steps, self.n = name, [], 0
    def machine(self, mid="jana", home=None, login=None):
        self.steps.append(dict(op="machine", id=mid, home=home or mid, login=login or mid)); return self
    def mkdir(self, name, m="jana"): self.steps.append(dict(op="mkdir", m=m, name=name)); return self
    def cd(self, name, m="jana"): self.steps.append(dict(op="cd", m=m, name=name)); return self
    def w(self, name, content, m="jana"): self.steps.append(dict(op="write", m=m, name=name, content=content)); return self
    def rm(self, name, m="jana"): self.steps.append(dict(op="rm", m=m, name=name)); return self
    def gh(self, owner, name, collab=()):
        self.steps.append(dict(op="gh", owner=owner, name=name, collab=list(collab))); return self
    def g(self, *argv, m="jana", skip=False):
        """skip=True: krok se provede, ale nesrovnává (známý a zdůvodněný rozdíl)."""
        self.n += 1
        self.steps.append(dict(op="git", m=m, argv=list(argv), i=self.n, ts=T0 + 60 * self.n, skip=skip)); return self
    def setup(self, m="jana", name="Jana Nováková", email="novakovaj@jirovcovka.net", folder="kucharka"):
        """Běžný začátek: nastavení, složka git/<folder>, git init."""
        self.cfg(m, name, email)
        self.mkdir("git", m).cd("git", m).mkdir(folder, m).cd(folder, m).g("init", m=m)
        return self
    def cfg(self, m="jana", name="Jana Nováková", email="novakovaj@jirovcovka.net"):
        self.g("config", "--global", "user.name", name, m=m).g("config", "--global", "user.email", email, m=m)
        self.g("config", "--global", "init.defaultBranch", "main", m=m)
        self.g("config", "--global", "pull.rebase", "false", m=m)
        self.g("config", "--global", "core.quotepath", "false", m=m)
        return self

def run_real(case):
    r = Real(); out = {}
    try:
        for s in case.steps:
            op = s["op"]
            if op == "machine": r.machine(s["id"], s["home"])
            elif op == "mkdir": os.makedirs(os.path.join(r.cwd[s["m"]], s["name"]))
            elif op == "cd": r.cwd[s["m"]] = os.path.normpath(os.path.join(r.cwd[s["m"]], s["name"]))
            elif op == "write":
                with open(os.path.join(r.cwd[s["m"]], s["name"]), "w", encoding="utf-8", newline="") as f: f.write(s["content"])
            elif op == "rm": os.remove(os.path.join(r.cwd[s["m"]], s["name"]))
            elif op == "gh": r.bare(s["owner"], s["name"])
            elif op == "git": out[s["i"]] = clean(r.run(s["m"], ["git"] + s["argv"], s["ts"]))
    finally:
        r.close()
    return out

def run_sim(case):
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8") as f:
        json.dump(case.steps, f); name = f.name
    try:
        p = subprocess.run([JSC] + [os.path.join(ROOT, j) for j in JS] + ["--", name], capture_output=True, text=True)
        if p.returncode != 0 or not p.stdout.strip().startswith("["):
            raise SystemExit("simulátor selhal (%s):\n%s%s" % (case.name, p.stdout, p.stderr))
        return {r["i"]: r["lines"] for r in json.loads(p.stdout)}
    finally:
        os.unlink(name)

def norm_segs(segs):
    out = []
    for t, c in segs:
        if not t: continue
        if out and out[-1][1] == c: out[-1] = (out[-1][0] + t, c)
        else: out.append((t, c))
    return out

def compare(case, verbose=True, colors=True, stop_on_note=False, stats=None):
    """stop_on_note: jakmile simulátor řekne, že případ neumí (poznámka "Simulátor:"),
    zbytek běhu se nesrovnává (stav se už rozešel). Počet se přičte do stats["neumi"]."""
    real, sim = run_real(case), run_sim(case)
    bad = 0
    for s in case.steps:
        if s["op"] != "git" or s.get("skip"): continue
        i = s["i"]
        if stop_on_note and any(l.get("k") == "note" and "neumí" in "".join(x[0] for x in l["s"]) for l in sim[i]):
            if stats is not None: stats["neumi"] = stats.get("neumi", 0) + 1
            break
        rl = real[i]
        sl = [l for l in sim[i] if l.get("k") != "progress"]
        rtext = [t for t, _ in rl]
        stext = ["".join(x[0] for x in l["s"]) for l in sl]
        ok = rtext == stext
        if ok and colors:
            for (t, rs), l in zip(rl, sl):
                if norm_segs(rs) != norm_segs([(x[0], x[1]) for x in l["s"]]):
                    ok = False
                    if verbose: print("    barvy: git %r\n           sim %r" % (norm_segs(rs), norm_segs([(x[0], x[1]) for x in l["s"]])))
                    break
        if not ok:
            bad += 1
            if verbose:
                print("ROZDÍL [%s] krok %d: git %s" % (case.name, i, " ".join(s["argv"])))
                print("  --- git"); [print("  | " + t) for t in rtext]
                print("  --- simulátor"); [print("  | " + t) for t in stext]
    return bad, case.n
