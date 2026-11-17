# Git simulator

*Česky: [README.md](README.md)*

A Git and GitHub simulator in the browser. It was made for the Czech course **Git a GitHub –
rychlý úvod** (Git and GitHub – a quick introduction) at a secondary school, but anyone who wants
to try Git safely can use it: nothing to install, nothing to break, and you can see what happens
inside Git.

**Start:** <https://mkgymji.github.io/git-simulator/> (or open `index.html` from disk).

## What you see on the screen

The page has three colour-coded zones:

1. **Tasks** (green) – the scenario's tasks. A task is ticked off automatically as soon as you
   complete it. Each task has a **Hint** with commands, and some have an *Answer for yourself* question.
   If you get stuck in a task, **Restart this task** returns everything to its start (completed tasks
   stay completed). What the simulator fills in for you is marked in violet.
2. **Computer** (blue) – what you have on a school computer:
   - **VS Code** with the file list on the left and the editor on the right. `.md` files have a
     preview (*You write* / *You see*). Save with **Ctrl+S**.
   - A **terminal** in the style of PowerShell. Type commands into it (`git status`, `cd`, `mkdir`…);
     `help` lists them, arrow up recalls the previous command, Tab completes a name.
   - The tabs at the top switch between computers (in scenarios for two people) and **GitHub** in a
     browser (a new repository, editing a file on the web, inviting a collaborator).
3. **What happens in Git** (orange) – what you would not see on a real computer:
   - **Where each version is**: working directory → staging area → repository;
   - the **history** as a commit graph (each circle is a commit);
   - the state of the repository on **GitHub**.

At the top are the buttons **Guide** (this page), **Cheat sheet** (the most important commands),
**Start over** and the language switch **CS / EN**.

Git's messages are real Git messages. Grey notes starting with *Simulator:* are the simulator's
advice – for example when you type a command the course does not use.

## Scenarios

The button with the scenario name at the top opens the scenario menu. A completed scenario gets a
**green checkmark** (only this browser remembers it; *Forget completed* clears them). Free mode has
no tasks, so it never gets a checkmark.

| Address | Scenario |
|---|---|
| `#volne` | free mode – an empty computer |
| `#pl1` | Worksheet 1: Git setup, the first repository and commits |
| `#pl2` | Worksheet 2: diff, log, restore, revert, .gitignore |
| `#revert` | Worksheet 2 starting at task 7: a commit with a mistake and revert in the graph (the simulator does the earlier tasks) |
| `#pl3` | Worksheet 3: a repository on GitHub, push, an edit on the web, pull |
| `#odmitnuty-push` | Worksheet 4 dry run: a rejected push, pull with a merge commit |
| `#spoluprace` | Worksheet 4: Anna and Petr, invitation, cloning, collaboration |
| `#vetve` | bonus: branches and merging |
| `#konflikt` | bonus: a conflict and how to resolve it |

Add the scenario address to the simulator address, e.g.
`https://mkgymji.github.io/git-simulator/#vetve`. A task marked with a label in the scenario can be
opened directly (`#revert`); the simulator then does the earlier tasks.

Reloading the page (F5) or the **Start over** button restarts the whole scenario.

## Your own scenarios (for teachers)

A scenario is a plain text file – no programming. The language is described with an example in
[`docs/SCENARIOS.md`](docs/SCENARIOS.md); the best template is a built-in scenario (*Download as
template* in the menu).

- **Upload:** scenario menu → *Upload a scenario* (drop a file, choose a file or paste the text).
  The simulator reports errors with line numbers.
- **My scenarios** are stored only in this browser (they are not on other computers).
- **Sharing:** put the file at a public address (e.g. in a GitHub repository) and share the link
  `https://mkgymji.github.io/git-simulator/#load=` + the file address. It also works in a QR code.

## Language

The simulator is in Czech and English. The language follows the browser (Czech → Czech, anything
else → English); the **CS / EN** switch at the top changes it and the browser remembers the choice.
Built-in scenarios exist in both languages under the same addresses (`#pl1`…). Switching the
language restarts the scenario.

## What the simulator cannot do

The simulator supports the course commands: `init`, `status`, `add`, `commit`, `diff`, `log`,
`restore`, `revert`, `branch`, `switch`, `merge`, `remote`, `push`, `pull`, `clone`, `config`.
Commands the course does not use (`rebase`, `reset`, `stash`…) and subfolders in a repository are
not supported; the simulator says so in a grey note. Terminal output (`ls`, `pwd`, `mkdir`) imitates
English Windows PowerShell 5.1.

Git's output matches Git 2.47 (Git for Windows), including colours and real SHA-1 hashes.
How this is verified and how the simulator is built: [`docs/VYVOJ.md`](docs/VYVOJ.md) (in Czech).

## Licence and sources

Copyright (C) 2026 Michal Kočer. The simulator is free software under the
**GNU General Public License version 2** (`GPL-2.0-only`, file [`LICENSE`](LICENSE)), just like Git,
from whose source code (version 2.47.1) it takes algorithms and message texts. The files taken,
their authors and licences, and the font licences are listed in [`ZDROJE.md`](ZDROJE.md) (in Czech);
on the page under **About the simulator and sources**.
