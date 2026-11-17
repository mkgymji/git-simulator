#!/bin/sh
# Všechny testy simulátoru proti skutečnému Gitu (potřebuje git, python3 a jsc nebo node).
set -e
cd "$(dirname "$0")/.."
python3 tests/fuzz_text.py 2000 1
python3 tests/fuzz_cc.py 200 1
python3 tests/test_git.py
python3 tests/fuzz_graph.py 40 1
python3 tests/fuzz_repo.py 25 1
python3 tests/fuzz_rename.py 40 1
python3 tests/fuzz_remote.py 20 1
