#!/bin/sh
# Git simulátor – Copyright (C) 2026 Michal Kočer
# SPDX-License-Identifier: GPL-2.0-only
# Všechny testy simulátoru proti skutečnému Gitu (potřebuje git, python3 a jsc nebo node).
set -e
cd "$(dirname "$0")/.."
JSC=/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc
CORE="js/i18n.js js/text.js js/world.js js/graph.js js/rename.js js/git.js js/shell.js js/session.js js/scenario-lang.js"
python3 tools/build_scenarios.py --check
$JSC $CORE js/scenarios-builtin.js tests/scenario_lang_test.js | tail -1
$JSC js/i18n.js js/i18n-en.js tests/lang_en.js ${CORE#js/i18n.js } tests/solutions.js tests/scenario_en_test.js -- scenarios | tail -1
python3 tools/i18n_check.py | tail -1
python3 tests/fuzz_text.py 2000 1
python3 tests/fuzz_cc.py 200 1
python3 tests/test_git.py
python3 tests/fuzz_graph.py 40 1
python3 tests/fuzz_repo.py 25 1
python3 tests/fuzz_rename.py 40 1
python3 tests/fuzz_remote.py 20 1
