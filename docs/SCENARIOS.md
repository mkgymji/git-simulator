# Scenario language (FORMAT 1)

*Česky: [SCENARE.md](SCENARE.md)*

A scenario is a plain text file with the extension `.scenario` (UTF-8). Write it in any editor,
upload it in the simulator with **scenario menu → Upload a scenario**, and the simulator builds the
computers, repositories and tasks from it. A scenario is **just data**: there is no programming in
it, so it is safe to upload a scenario from anywhere.

The best templates are the built-in scenarios: each one has a **Download as template** link in the
scenario menu (the files are also in [`scenarios/en/`](../scenarios/en/)).

## Example

```text
FORMAT 1
SCENARIO  History as a graph
LABEL     Worksheet 2 · task 8
SUMMARY   A commit with a mistake and git revert – what happens in the graph.
INTRO     The cookbook has one commit. On the right you see the **graph**: each circle is a commit.

SETUP
  MACHINE alice CONFIGURED
  REPOSITORY cookbook
  PS> mkdir cookbook
  PS> cd cookbook
  PS> git init
  FILE drop-scones.md
    # Drop scones

    - 300 ml milk
  END
  PS> git add .
  PS> git commit -m "Add drop scones"
  VSCODE cookbook
END

TASK Add the line `- 2 kg salt` to drop-scones.md and commit it as **Add mistake**.
  HINT  git commit -am "Add mistake"
  CHECK file drop-scones.md in commit "Add mistake" contains "2 kg salt"
END

TASK Find the hash of the commit **Add mistake** and revert it.
  HINT     git log --oneline
  HINT     git revert --no-edit HASH
  NOTE     Replace `HASH` with the hash from the output.
  QUESTION How many circles are in the graph?
  CHECK    commit "Add mistake" is reverted
  CHECK    file drop-scones.md in HEAD does not contain "2 kg salt"
END
```

## Writing rules

- Each line starts with an **uppercase keyword** (`SETUP`, `PS>`, `CHECK`…). Indentation is only
  for readability and means nothing – except for the content of a `FILE`.
- Lines starting with `#` are comments (except inside `FILE`). Empty lines are skipped.
- Texts for students (`INTRO`, `TASK`, `NOTE`) may contain `` `code` ``, `**bold**` and `*italics*`.
- The structure is **fixed** – the parts must come in this order:

```text
FORMAT 1                 language version (required, first line)
SCENARIO title           required
LABEL text               label above the title (optional)
SUMMARY sentence         description in the scenario menu (optional)
INTRO paragraph          introduction above the tasks (optional, may repeat = more paragraphs)

SETUP                    preparation (required, exactly once)
  …
END

TASK task text           any number of tasks
  HINT / NOTE …          hint lines (0 or more)
  QUESTION …             an "Answer for yourself" question (0–1)
  CHECK …                condition (1 or more; the task is complete when all of them hold)
  AUTO [WHEN condition]  what the simulator does for the student (0 or more)
    …
  END
END
```

The simulator reports errors with line numbers. When uploading, it also runs the setup as a dry run
and reports every `PS>` command that fails (e.g. a typo like `git innit`).

## SETUP – preparation

Characters and computers first, then commands.

| Line | Meaning |
|---|---|
| `PERSON id NAME "Name" EMAIL "e-mail" LOGIN "account" LABEL "label"` | a custom character; only `NAME` is required. Missing e-mail = `id@example.com`, missing account = `id`, missing label = "Computer (Name)". `id` is lowercase letters without accents. |
| `MACHINE id [CONFIGURED] [HIDDEN]` | the character's computer. `CONFIGURED` = Git set up with the six lines from worksheet 1 (name, e-mail, `main`, `code --wait`, `pull.rebase false`, `core.quotepath false`). `HIDDEN` = the computer is not shown (a character who did something "in the meantime"). The first visible computer is where the student starts. |
| `AS id` | the following lines run on computer `id` (at the start it is the first `MACHINE`) |
| `PS> command` | a terminal command, exactly as a student would type it (`mkdir`, `cd`, `git …`). It starts in the home folder. The simulator spreads commit times into the past by itself. |
| `FILE name` … `END` | a file in the current folder of the current computer. The content is taken literally; common indentation and trailing empty lines are removed. |
| `GITHUB owner/name [PUBLIC] [README] [COLLABORATOR account]…` | a repository on GitHub; the default is Private and empty. `README` = with a first commit, like ticking *Add a README file*. The owner must be the account of one of the characters. |
| `SHOW GITHUB` | shows the GitHub tabs (browser) |
| `REPOSITORY path` | the repository the conditions refer to (path from the home folder, e.g. `git/cookbook`) |
| `VSCODE path` | the folder open in VS Code on the current computer |

Default characters (no need to define them):

| id | Name | E-mail | Account |
|---|---|---|---|
| `alice` | Alice | `alice@example.com` | `alice` |
| `bob` | Bob | `bob@example.com` | `bob` |

## TASK

| Line | Meaning |
|---|---|
| `TASK text` | the task |
| `HINT text` | a hint line shown as code (a command, file content); an empty `HINT` = an empty line |
| `NOTE text` | a hint line shown as normal text |
| `QUESTION text` | a question the student should answer for themselves |
| `CHECK condition` | a completion condition (see the vocabulary below) |

A task is ticked off automatically as soon as all its conditions hold, and then it stays complete.

## AUTO – what the simulator does for the student

In the simulator it is about **the Git steps, not about typing**. Where the student would copy text
needlessly (five setup lines, a whole recipe), the simulator does it for them and says so. An `AUTO`
block runs once:

- `AUTO WHEN condition` – as soon as the condition holds (same as for `CHECK`), even before the task is complete;
- `AUTO` without `WHEN` – right after the task is completed.

| Line in AUTO | Meaning |
|---|---|
| `NOTE text` | an explanation of what the simulator did and why. It is shown after “Filled in by the simulator:” in the terminal and in violet under the task, so write it as the rest of that sentence. |
| `AS id` | the following lines run on computer `id` (otherwise the computer of the `WHEN` condition, or the first visible one) |
| `PS> command` | a command the simulator "types" for the student. It is visible in the terminal with its output and marked *filled in by the simulator*. It does not count for `command … was run`. |
| `FILE name` … `END` | overwrites a file |
| `APPEND name` … `END` | appends text to the end of a file (an empty first line = an empty line before the text) |

Files are written to the repository folder from `REPOSITORY` (when it exists on the computer),
otherwise to the current folder. If the file is open in the editor, the change shows there right away.

```text
TASK Set your name. The simulator fills in the rest of the setup. Then list the setup.
  HINT  git config --global user.name "Alice"
  HINT  git config --global --list
  CHECK config user.name is set
  CHECK command "git config --global --list" was run after command "git config --global user.name..."
  AUTO WHEN config user.name is set
    NOTE the e-mail and the default branch. At school you will type them yourself.
    PS> git config --global user.email "alice@example.com"
    PS> git config --global init.defaultBranch main
  END
END

TASK Create recipe.md with the heading `# Buns` and save it. The simulator adds the ingredients.
  CHECK file recipe.md in HEAD contains line starting with "- "
  AUTO WHEN file recipe.md contains line starting with "# "
    NOTE the ingredients as bullet points.
    APPEND recipe.md

      - 500 g flour
      - 2 eggs
    END
  END
END
```

**Tolerance:** students do not have to type exactly your texts. Do not check the commit message –
the conditions `commit adding "T"` and `file X in any commit` look at the content, not the message.
Give the message in a `HINT` only as an example.

## CHECK – condition vocabulary

A condition refers to the first visible computer. Assign it to another computer with a prefix:
`CHECK bob: repository exists`. Quoted texts are written in `"…"` (Czech „…“ also works).

### Files

| Condition | Holds when |
|---|---|
| `file X exists` / `file X does not exist` | the file is / is not in the working directory of the repository |
| `file X contains "T"` / `file X does not contain "T"` | the file contains / does not contain the text (case-sensitive) |
| `file X contains line starting with "T"` | a line of the file starts with the text |
| `file X has no conflict markers` | the file has no conflict markers `<<<<<<<`, `=======`, `>>>>>>>` |

After the file name you can give a place (otherwise the working directory is meant):

| Place | Meaning |
|---|---|
| `file X in HEAD …` | the file in the last commit |
| `file X in any commit …` | in at least one commit of the history (independent of the message) |
| `file X in commit "message" …` | in the newest commit whose message contains the text (case-insensitive; "Revert …" commits do not count unless you search for them explicitly) |
| `file X in branch B …` | in the last commit of the branch |
| `file X on github owner/name …` | on GitHub (default branch) |

### Repository and history (need `REPOSITORY`)

| Condition | Holds when |
|---|---|
| `repository exists` | there is a repository in the `REPOSITORY` folder |
| `commit "message" exists` | the history has a commit whose message contains the text |
| `commit "message" is reverted` | such a commit exists and the history also has its revert |
| `commit adding "T" exists` | the history has a commit that added the text T (the file has it, the previous version did not) – **independent of the message** |
| `commit adding "T" is reverted` | such a commit exists and has been reverted |
| `commit count is at least N` | the current branch has at least N commits |
| `HEAD is a merge` | the last commit has two parents |
| `merge is in progress` / `no merge is in progress` | an unfinished merge (conflict) is / is not in progress |
| `branch B exists` | the branch exists |
| `on branch B` | the student is on branch B |
| `branches A and B have diverged` | the histories of the branches have split |

### Student's commands

| Condition | Holds when |
|---|---|
| `command "C" was run` | the student typed command C |
| `command "C" was run after command "D"` | command C was typed after command D |
| `output of "C" contains "T"` | some output of command C contains the text |
| `output of "C" does not contain "T"` | some output of command C does not contain the text |
| `output of "C" contains line starting with "T"` | the output has a line starting with the text |

The command is compared **as a whole** (extra spaces do not matter): `command "git log" was run`
is not satisfied by `git log --oneline`. When the beginning is enough, end the pattern with three
dots: `command "git log..." was run`, `output of "git push..." contains "[rejected]"`.

### Settings and VS Code

| Condition | Holds when |
|---|---|
| `config KEY is set` | the setting exists (e.g. `config user.name is set`) |
| `config KEY is "value"` | it has exactly this value |
| `config KEY contains "text"` | the value contains the text |
| `vscode folder is path` | this folder is open in VS Code |

### GitHub

| Condition | Holds when |
|---|---|
| `github owner/name exists` | the repository exists on GitHub |
| `github owner/name has branch B` | it has branch B |
| `github owner/name has collaborator account` | the account accepted the invitation |
| `github owner/name B equals HEAD` | branch B on GitHub is the same as the last commit on the computer |
| `github owner/name B is a merge` | the last commit of branch B has two parents |

## Language

Keywords are always in English; write the texts for students (`SCENARIO`, `TASK`, `NOTE`…) in the
language the scenario should be in. The simulator reports errors in the page language (**CS / EN**
switch).

## Upload, storage and sharing

- **Upload:** **scenario menu → Upload a scenario** – drop a file, choose a file or paste the text.
  The scenario is saved to **My scenarios**.
- **My scenarios** are stored **only in this browser** (the browser's database). They are not on
  other computers or in other browsers; on school computers that wipe the profile at logout they
  disappear. Only the scenario text is stored – after a reload the scenario starts again.
- **Sharing with a link:** put the file at a public address (e.g. in a GitHub repository) and share
  a link to the simulator with `#load=` and the file address:

  ```text
  https://mkgymji.github.io/git-simulator/#load=https://raw.githubusercontent.com/USER/REPO/main/my.scenario
  ```

  The link also works in a QR code. The server with the file must allow downloads from other sites
  (`raw.githubusercontent.com` does).

## For maintainers: built-in scenarios

Built-in scenarios are the files `scenarios/*.scenario` (Czech) and `scenarios/en/*.scenario`
(English, same names). Their order in the menu is given by `scenarios/PORADI`. So that the simulator
also works when opened from disk, the build packs them into `js/scenarios-builtin.js`:

```sh
python3 tools/build_scenarios.py          # after every change to a scenario
python3 tools/build_scenarios.py --check  # checks that the file is up to date (also in tests/run_all.sh)
```

A new keyword or condition must be added to `js/scenario-lang.js`, to this description and to the
Czech `SCENARE.md`. An incompatible change of the language increases `FORMAT`.
