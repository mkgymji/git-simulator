# Git simulátor – Copyright (C) 2026 Michal Kočer
# SPDX-License-Identifier: GPL-2.0-only
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from realgit import Real, clean
r = Real()
h = r.machine("jana", "jana")
ts = [1794787200]
def g(*a, show=True, mid="jana"):
    ts[0] += 60
    out = r.run(mid, ["git"] + list(a), ts[0])
    if show:
        print("$ git " + " ".join(a)); print(out, end="" if out.endswith("\n") or not out else "\n")
    return out
def w(name, content, mid="jana"):
    with open(os.path.join(r.cwd[mid], name), "w", encoding="utf-8", newline="") as f: f.write(content)
exec(open(sys.argv[1]).read())
r.close()
