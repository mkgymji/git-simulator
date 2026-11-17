# Git simulátor – Copyright (C) 2026 Michal Kočer
# SPDX-License-Identifier: GPL-2.0-only
"""Spouštění skutečného Gitu v pseudoterminálu (stejné výstupy a barvy jako v opravdovém terminálu)."""
import os, pty, re, select, shutil, subprocess, tempfile

class Real:
    def __init__(self):
        self.tmp = os.path.realpath(tempfile.mkdtemp(prefix="gitsim-"))
        self.github = os.path.join(self.tmp, "github")
        os.makedirs(self.github)
        # Vlastní git-remote-https: adresy https://github.com/... zůstanou beze změny
        # (i ve zprávách merge commitů), data se ale berou z místní složky.
        self.execpath = os.path.join(self.tmp, "exec")
        os.makedirs(self.execpath)
        real = subprocess.run(["git", "--exec-path"], capture_output=True, text=True).stdout.strip()
        for name in os.listdir(real):
            if name != "git-remote-https":
                os.symlink(os.path.join(real, name), os.path.join(self.execpath, name))
        helper = os.path.join(self.execpath, "git-remote-https")
        with open(helper, "w") as f:
            f.write('#!/bin/sh\n'
                    'p="${2#https://github.com/}"\n'
                    '[ -d "%s/$p" ] || p="$p.git"\n'
                    '[ -d "%s/$p" ] || { echo "fatal: repository not found" >&2; exit 128; }\n'
                    'exec git remote-ext "$1" "git %%s %s/$p"\n' % (self.github, self.github, self.github))
        os.chmod(helper, 0o755)
        self.homes = {}
        self.cwd = {}

    def close(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def machine(self, mid, home):
        h = os.path.join(self.tmp, "pc-" + mid, "Users", home)
        os.makedirs(h)
        self.homes[mid] = h
        self.cwd[mid] = h
        with open(os.path.join(h, ".gitconfig"), "w") as f:
            f.write("")
        return h

    def env(self, mid, ts=None, amend=False, editor="true"):
        e = {k: v for k, v in os.environ.items() if not k.startswith("GIT_")}
        e.update(HOME=self.homes[mid], LC_ALL="C", LANG="C", TERM="xterm-256color", COLUMNS="80",
                 GIT_CONFIG_NOSYSTEM="1", GIT_CONFIG_SYSTEM="/dev/null", GIT_PAGER="cat", GIT_EDITOR=editor,
                 GIT_TERMINAL_PROMPT="0", TZ="Europe/Prague",
                 GIT_EXEC_PATH=self.execpath,
                 GIT_CONFIG_COUNT="2",
                 GIT_CONFIG_KEY_0="protocol.ext.allow", GIT_CONFIG_VALUE_0="always",
                 GIT_CONFIG_KEY_1="protocol.file.allow", GIT_CONFIG_VALUE_1="always")
        if ts is not None:
            e["GIT_COMMITTER_DATE"] = "%d +0100" % ts
            if not amend:
                e["GIT_AUTHOR_DATE"] = "%d +0100" % ts
        return e

    def run(self, mid, argv, ts=None, editor="true"):
        """Vrátí výstup (stdout+stderr tak, jak by šly do terminálu)."""
        master, slave = pty.openpty()
        amend = "--amend" in argv
        p = subprocess.Popen(argv, cwd=self.cwd[mid], env=self.env(mid, ts, amend, editor),
                             stdin=slave, stdout=slave, stderr=slave, close_fds=True)
        os.close(slave)
        data = b""
        while True:
            r, _, _ = select.select([master], [], [], 20)
            if not r:
                p.kill()
                data += b"\n[TEST: CASOVY LIMIT]\n"
                break
            try:
                chunk = os.read(master, 65536)
            except OSError:
                break
            if not chunk:
                break
            data += chunk
        p.wait()
        os.close(master)
        self.pin_remote_head()
        text = data.decode("utf-8", "replace").replace("\r\n", "\n")
        # simulátor mluví jako Git for Windows 2.47 (hinty bez "set")
        text = text.replace('git config set advice.', 'git config advice.')
        text = text.replace("file://" + self.github + "/", "https://github.com/")
        text = text.replace(self.github + "/", "https://github.com/")
        for m, h in self.homes.items():
            base = os.path.dirname(os.path.dirname(h))
            text = text.replace(base, "C:")
        return text

    def pin_remote_head(self):
        """Git 2.48+ při fetch sám zakládá origin/HEAD, Git 2.47 ne. Vypneme to
        (remote.origin.followRemoteHEAD=never) v každém repozitáři, který má origin."""
        for home in self.homes.values():
            for dirpath, dirnames, filenames in os.walk(home):
                if os.path.basename(dirpath) == ".git":
                    dirnames[:] = []
                    cfg = os.path.join(dirpath, "config")
                    if os.path.exists(cfg):
                        text = open(cfg).read()
                        if '[remote "origin"]' in text and "followRemoteHEAD" not in text:
                            text = text.replace('[remote "origin"]\n', '[remote "origin"]\n\tfollowRemoteHEAD = never\n', 1)
                            open(cfg, "w").write(text)

    def bare(self, owner, name):
        path = os.path.join(self.github, owner, name + ".git")
        os.makedirs(os.path.dirname(path), exist_ok=True)
        subprocess.run(["git", "init", "-q", "--bare", "-b", "main", path], check=True,
                       env=dict(os.environ, GIT_CONFIG_GLOBAL="/dev/null"))
        return path

SGR = re.compile(r"\x1b\[([0-9;]*)m")
COLORS = {"41": "R", "31": "r", "32": "g", "33": "y", "36": "c", "1": "b", "35": "m", "34": "u"}

def parse_ansi(text):
    """Text s ANSI barvami -> seznam řádků, každý řádek seznam (text, barva)."""
    text = re.sub(r"\x1b\[K", "", text)
    lines, cur, attrs = [], [], []
    pos = 0
    def emit(s):
        nonlocal cur
        parts = s.split("\n")
        for i, part in enumerate(parts):
            if i > 0:
                lines.append(cur)
                cur = []
            if part:
                key = "".join(sorted(set(attrs)))
                if cur and cur[-1][1] == key:
                    cur[-1] = (cur[-1][0] + part, key)
                else:
                    cur.append((part, key))
    for m in SGR.finditer(text):
        emit(text[pos:m.start()])
        pos = m.end()
        codes = [c for c in m.group(1).split(";") if c != ""] or ["0"]
        for c in codes:
            if c == "0":
                attrs = []
            elif c in COLORS:
                attrs.append(COLORS[c])
            elif c == "22":
                attrs = [a for a in attrs if a != "b"]
            elif c == "39":
                attrs = [a for a in attrs if a == "b"]
    emit(text[pos:])
    if cur:
        lines.append(cur)
    return lines

PROGRESS = re.compile(r"^(remote: )?(Enumerating|Counting|Compressing|Writing|Receiving|Resolving|Unpacking|Total|Delta compression)")

def clean(text):
    """Řádky bez průběhu přenosu; každý řádek jako (čistý text, [(text, barva)])."""
    out = []
    for raw in parse_ansi(text):
        plain = "".join(t for t, _ in raw)
        if "\r" in plain:
            plain = plain.split("\r")[-1]
            raw = [(plain, "")]
        if PROGRESS.match(plain):
            continue
        out.append((plain, raw))
    return out
