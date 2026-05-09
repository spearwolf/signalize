# using-signalize — Skill

A Claude Code / Claude Agent skill that primes an AI coding agent with the
public API, mental model, and quirks of [`@spearwolf/signalize`](https://github.com/spearwolf/signalize).
The skill activates whenever an agent sees an import from `@spearwolf/signalize`
or `@spearwolf/signalize/decorators`, or when the user mentions *signalize*
in their prompt.

The content is targeted at LLMs, not humans: it is dense, table-heavy, and
front-loads the gotchas that AI coding agents most often get wrong (e.g.
React-style `set(prev => prev + 1)` updater functions, `.get()` vs `.value`
tracking, eager vs lazy memos, static-deps disabling autorun).

For the human-facing documentation see the project [`docs/`](../../docs) folder.

## Installation

Skills are auto-discovered when their `SKILL.md` lives under one of these
locations:

| Scope | Path |
| --- | --- |
| Per-project | `<repo-root>/.claude/skills/using-signalize/SKILL.md` |
| Per-user (global) | `~/.claude/skills/using-signalize/SKILL.md` |
| Plugin-bundled | inside any installed Claude Code plugin's `skills/` folder |

Pick one of the following install methods.

### Option A — Per-project (recommended)

Symlink (or copy) the skill into your repo's `.claude/skills/` directory:

```shell
mkdir -p .claude/skills
ln -s "$(pwd)/node_modules/@spearwolf/signalize/skills/using-signalize" \
      .claude/skills/using-signalize
```

If you don't have the package installed locally, copy this folder directly
into `.claude/skills/`:

```shell
mkdir -p .claude/skills
cp -r path/to/signalize/skills/using-signalize .claude/skills/
```

Commit `.claude/skills/using-signalize/` to share the skill with the rest of
the team.

### Option B — Per-user (all projects)

Drop the skill folder into your global Claude config:

```shell
mkdir -p ~/.claude/skills
cp -r path/to/signalize/skills/using-signalize ~/.claude/skills/
```

### Option C — From the npm package (zero-config)

`@spearwolf/signalize` ships this skill in `node_modules/@spearwolf/signalize/skills/`.
Some Claude Code setups auto-discover skills inside `node_modules`; if yours
does not, fall back to Option A and create a symlink.

## Verifying it loaded

Start a new Claude Code session in the project and ask:

```
which skills do you have available?
```

`using-signalize` should appear in the list. You can also force-invoke it:

```
/skill using-signalize
```

If the skill is installed correctly, the agent will load this `SKILL.md` and
acknowledge `signalize` context before continuing.

## Uninstall

Remove the folder (or symlink) from the install location chosen above:

```shell
rm -rf .claude/skills/using-signalize
# or: rm -rf ~/.claude/skills/using-signalize
```

## Updating

When `@spearwolf/signalize` releases a new version, refresh the skill the
same way you installed it. If you symlinked from `node_modules`, an
`npm install` is enough.

## License

Apache-2.0, same as the parent project.
