#!/usr/bin/env python3
# Git simulátor – Copyright (C) 2026 Michal Kočer
# SPDX-License-Identifier: GPL-2.0-only
"""Kontrola překladů: každý text tr('…') v js/*.js musí mít anglický překlad
v js/i18n-en.js se stejnými zástupnými místy {0}, {1}…, a v překladech nesmí
zůstat nepoužité klíče.

  python3 tools/i18n_check.py          kontrola (návratový kód 1 při chybě)
  python3 tools/i18n_check.py --keys   vypíše klíče bez překladu
"""
import json, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JSC = '/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc'
FILES = ['js/git.js', 'js/shell.js', 'js/session.js', 'js/scenario-lang.js', 'js/ui.js']
LIT = re.compile(r"tr\('((?:[^'\\\n]|\\.)*)'")

def unescape(s):
    return json.loads('"' + s.replace('"', '\\"').replace("\\'", "'") + '"')

def keys():
    out = {}
    for f in FILES:
        for i, line in enumerate(open(os.path.join(ROOT, f), encoding='utf-8'), 1):
            for m in LIT.finditer(line):
                out.setdefault(unescape(m.group(1)), '%s:%d' % (f, i))
    return out

def dictionary():
    code = "print(JSON.stringify(GitI18n.dict('en')))"
    p = subprocess.run([JSC, 'js/i18n.js', 'js/i18n-en.js', '-e', code], cwd=ROOT, capture_output=True, text=True)
    if p.returncode or not p.stdout.strip():
        sys.exit('i18n-en.js nejde načíst: ' + p.stderr + p.stdout)
    return json.loads(p.stdout)

def main():
    k = keys()
    if '--keys' in sys.argv:
        d = dictionary() if os.path.exists(os.path.join(ROOT, 'js/i18n-en.js')) else {}
        for key, where in k.items():
            if key not in d: print(json.dumps(key, ensure_ascii=False))
        return
    d = dictionary()
    bad = 0
    for key, where in k.items():
        if key not in d:
            print('chybí překlad (%s): %s' % (where, key)); bad += 1
        elif sorted(set(re.findall(r'\{\d+\}', key))) != sorted(set(re.findall(r'\{\d+\}', d[key]))):
            print('nesedí {n} (%s): %s' % (where, key)); bad += 1
    for key in d:
        if key not in k:
            print('nepoužitý překlad: %s' % key); bad += 1
    print('překladů: %d, chyb: %d' % (len(k), bad))
    sys.exit(1 if bad else 0)

main()
