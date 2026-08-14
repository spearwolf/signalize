# Conventions

The rules this repository actually holds itself to — the ones a reviewer will
raise, and the ones a tool fails the build over. Written for two audiences at
once: a new contributor looking for "how is it done here", and a coding agent
that needs the rule stated rather than inferred.

This is the reference. The neighbours:

| Document | What it answers |
| --- | --- |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | How do I set up, change, verify and submit? The process. |
| [architecture.md](./architecture.md) | How does it work, and why is it built this way? Mechanics and decisions. |
| [AGENTS.md](../AGENTS.md) | The internals in depth — source map, eventize behaviour, measurements. |
| [api.md](./api.md) | What every export does. |

Where a rule below is enforced by a command, that command is named. Everything
else rests on review.

## Language

**English, everywhere that lands in the repository.** Source, comments, JSDoc,
test names, error messages, commit messages and every file under `docs/`.
Issues and pull requests may be discussed in any language; what gets committed
is English.

## Files and naming

- **Only `src/` is edited by hand.** `lib/` (tsc) and `dist/` (rollup) are
  generated and never committed.
- **Filenames in `src/` are kebab-case — the class module is the exception.**
  A module whose carrying export is a class is named after that class, so
  PascalCase (`SignalGroup.ts`, `EffectImpl.ts`, `UniqIdGen.ts`). Everything
  else — functions, infrastructure, types, constants — is kebab-case
  (`create-signal.ts`, `global-effect-stack.ts`, `signal-core.ts`).
- **The filename is not a transliteration of the export.** `be-quiet.ts`
  exports `beQuiet()`; the hyphen sits where the camel hump was.
- **A spec file inherits its module's name** (`create-signal.spec.ts`,
  `SignalGroup.spec.ts`). Segments after the first dot name a symbol or a
  behaviour and keep that symbol's casing (`effects.noAutorun.spec.ts`) — they
  are not module names. A spec with no module of its own is kebab-case
  throughout its head segment (`nested-effects-isolation.spec.ts`).
- **The rule covers `src/`.** `rollup/`, `scripts/`, `bench/` and `smoke/` sit
  outside it and are not pulled in.

## Imports and module layering

- **Imports carry a `.js` extension** inside `src/`, NodeNext-style:
  `import {x} from './foo.js'` even though the source is `foo.ts`. Always.
- **No import cycles.** `rollup.config.mjs` treats `CIRCULAR_DEPENDENCY` as an
  error, so a cycle fails `pnpm bundle`.
- **The layering is ranked, and the rank is checked.** A value import may
  only reach a strictly lower layer; sideways and upwards both fail
  `check:layering`, and with it `pnpm check`. The ladder itself lives in
  `scripts/check-layering.mjs`, and a new module in `src/` has to be given a
  rank there before the check passes.
- **`import type` for anything used only as a type.** Biome's
  `style/useImportType` is set to `error`, and it is what keeps the *value*
  import graph acyclic while type-only edges may point anywhere.
- **Leaf modules stay leaves.** `signal-core.ts` is the bottom of the signal
  graph and must never import `create-signal.ts`, `Signal.ts`, `SignalGroup.ts`
  or `effects.ts`. The layering, and the placeholder module that breaks the one
  cycle the design would otherwise need, is described in
  [architecture.md](./architecture.md).

## TypeScript

- **`strict: true` with `strictNullChecks: false`** is deliberate. Null-ish
  values travel freely. Do not add defensive `?:` or `!` to silence errors that
  this configuration does not raise.
- **Decorators are TC39 standard** — the `accessor` keyword and stage-3
  descriptor signatures. `experimentalDecorators` is off and stays off.
- **Explicit types on the public API, inference for internals.**
- **No top-level side effects.** `sideEffects: false` is a promise to bundlers;
  keep module top-levels free of observable work. The two measured exceptions
  that exist, and what each one costs, are documented in
  [architecture.md](./architecture.md) — a third one is a decision, not an
  edit.

## Public API surface

- **A new file in `src/` is invisible to consumers** until it is re-exported
  through `src/index.ts` (the `.` entry) or `src/decorators.ts` (the
  `./decorators` subpath).
- **Every export is named. No star, in either form.** `export *` publishes
  every future export of a module unasked; `export type *` does the same for
  its types. Publishing is meant to be an edit to the entry file, not a side
  effect of something new landing elsewhere in `src/`.
- **What holds it:** Biome's `performance/noReExportAll` fails `pnpm check` on
  a value star, and `index.public-surface.spec.ts` fails on both star forms and
  on any drift in the value list. The type half has no tool — tsc erases types
  — so it rests on this rule and on the witnesses in
  `types.public-surface.spec.ts`.

## Comments and inline documentation

Comments are held to a tighter standard here than code, because a wrong comment
outlives the code it described. The rules are worth reading in full; they are
the ones most often broken. Unlike the naming rules above, they hold for every
comment that lands in the repository — `scripts/`, `bench/` and `smoke/`
included.

**Comment only where the code cannot speak.** If a fact can be carried by a
function name, a variable name or a type, it needs no comment. Rename first,
then decide whether anything is left to say.

**Say the thing, not where the thing is written down.** Never reference an
issue, ticket, audit finding or bug number — no `PERF-002`, no `BUG-007`, no
tracker URL standing in for an explanation. A reader of the code has the code,
not the tracker. The number of a work package, a plan step, a rule in that plan
or a review round is the same borrowed authority one step further out — "package
7a", "Paket 12", "rule (d) from the plan", "Probe E from the audit" — and the
reader has a finished plan even less than the tracker. If a piece of code is
shaped by a specific hazard, name the hazard:

```ts
// Bad — the reader has to leave the file, and may find nothing.
// Validation first (BUG-007): reject an invalid source early.

// Good — the reason is here.
// Validate before touching the registry: a failed link() must not leave
// a permanent `undefined` key behind.
```

**No code archaeology.** Comments are not a place to discuss what the code used
to do, which release changed it, what a benchmark measured on which day, or how
a past defect behaved. "It used to …", "since …", "measured on …" and
"previously …" belong to `CHANGELOG.md` and to the commit history, both of which
keep them better. What stays is the present-tense reason the code is the way it
is.

**Keep it short.** A comment complements the code; it does not narrate it. Trim
to the shortest form that still carries the reason. Trimming an existing comment
asks two questions, not one: is what survives still true without what was cut —
dropping the condition of a claim leaves the claim standing, reading perfectly
well and being wrong — and did the cut sentence carry a second, independent
statement that the reason for cutting it never covered? A paragraph explaining a
three-line function is a signal that the function needs a better name or a
smaller body.

**No specifications in comments.** A constraint, an invariant or a boundary
condition that must hold is a test, not a sentence. Write the test; it is the
only form that fails when the constraint breaks. A one-line comment naming the
invariant next to the code is fine — a prose specification of behaviour is not.

**No architecture decisions in comments.** A decision with a radius beyond the
file — layering, packaging, lifetime strategy, what the library refuses to do —
is recorded in [architecture.md](./architecture.md). A pointer from the code to
that document is allowed and welcome where the local code would otherwise look
arbitrary. Decisions that are simply in force everywhere need no mention at
all.

**JSDoc is for consumers.** Public exports carry JSDoc describing what the
thing is for, in one to three sentences; the conditions under which it behaves
differently than a caller would expect; and what it returns or throws. Not what
the name already says — `@param signal - The signal to mute` on
`muteSignal(signal)` costs a line in every consumer's tooltip and pays nothing.
Internal reasoning does not belong there either — `compile:types` ships these
comments in `lib/*.d.ts`. Mark internals with `@internal` so they are stripped.

**The overflow goes to `docs/api.md`.** Measured edge cases, the shapes an
options object is accepted or refused in, inference behaviour — what a caller
genuinely needs and no symbol can carry without burying its own purpose — is
written in [api.md](./api.md) and linked from the JSDoc.

**A warning with no test behind it is a `//`, not JSDoc.** Where a regression
has nothing that would catch it — the order of two overloads is load-bearing,
say — the warning goes above the declaration as a line comment. `tsc` does not
emit `//` into `lib/*.d.ts`, so the note reaches a contributor reading `src/`
and stays out of every consumer's tooltip, which is the right split for a
sentence addressed to whoever edits the file next.

**An error code is consumer knowledge.** A sentence naming a concrete error
code, a message or a symptom stays at the symbol — however much it reads like
internal reasoning, and whether it stands alone or as a clause inside another
sentence. `TS2769` is what a caller finds on their screen; only the road that
led to it is internal.

## Error and warning messages

- **Every self-authored message starts with `[signalize] `.** The prefix is
  written at the call site, not added by a helper, so one rule holds across the
  whole tree. `message-prefix.spec.ts` checks it in one place.
- **`console` is not called directly.** `suspicious/noConsole` is `error`
  across `src/` with two named exemptions in `biome.json`. Diagnostics go
  through `onSignalizeError()`, which falls back to the console itself when
  nobody listens. The destructured alias (`const {warn} = console`) is invisible
  to the rule and is caught by `message-prefix.spec.ts` instead.
- **A message names the cause and the repair**, not just the symptom. The
  existing messages are the template.

## Tests

- **`*.spec.ts`, adjacent to the implementation.** Vitest is rooted at `src/`
  and matches `src/**/*.{spec,test}.ts`.
- **Globals are on** — `describe`, `it`, `expect` and `vi` need no import. The
  exception is `import type {MockInstance} from 'vitest'` when typing a spy.
- **Every public function has tests.** A new option, overload or error path
  arrives with the test that would fail without it.
- **Counter guards cover all three resource kinds by default.** A new spec
  file's `beforeEach`/`afterEach` carries `assertEffectsCount(0, …)`,
  `assertSignalsCount(0, …)` and `assertLinksCount(0, …)` together, in that
  order — not just the subset the first test happens to leak. Leave one out
  only with a comment at the `describe(` head saying why (a GC-timed counter no
  `finally` can pin down, a resource deliberately left dangling, a file that
  creates nothing a counter could see).
- **Per-test teardown belongs in a `finally`.** In a file whose hooks carry
  counter guards, a test that fails without tearing down poisons every test
  behind it and the real finding drowns. Three rules make it work: arrange
  *before* the `try`, so every resource has a handle the `finally` can reach; a
  `destroy()` with an assertion after it stays in the `try`, where the `finally`
  only adds the idempotent belt; and a teardown that can throw goes into a
  `try { … } catch { /* ignore */ }` **inside** the `finally`, or it replaces
  the error message with its own. `link.spec.ts` is the template.
- **Subscription-leak verification** for anything touching subscribe or
  unsubscribe paths: snapshot `getSubscriptionCount(queue)` — imported straight
  from `@spearwolf/eventize` — together with `getSignalsCount`,
  `getEffectsCount` and `getLinksCount`, run the scenario, destroy, assert
  restored. `unsubscribe-effect.spec.ts` is the reference.
- **Test names describe behaviour**, in English, without an issue number. "does
  not unsubscribe a dependency when the callback throws" — not "regression test
  for the throwing-callback bug".
- **Unreachable code fails the gate.** Several files stand under a 100 %
  coverage threshold in `vitest.config.ts`; a defensive branch that no test can
  reach breaks the build rather than passing unnoticed. Where an invariant makes
  a guard unreachable, state the invariant and leave the guard out.
- **A filtered run always exits 1** (`pnpm test <file>`, `pnpm test -t "…"`) —
  the per-file coverage gate fails for every file that did not run. Read the
  test result above it; that exit code is the gate, not a failure.
- **`smoke/` is the one exception to all of the above.** It runs on plain Node
  against the built `dist/`, type-checked against the shipped `.d.ts`, and is
  the only place where **tsc** — not SWC — lowers a `@signal() accessor`. It
  never runs under Vitest and never moves into `src/`.

## Tooling

- **pnpm only** (`pnpm@11.20.0`). `npm install` is not supported here. Settings
  live in `pnpm-workspace.yaml`; pnpm 11 ignores the `pnpm` field in
  `package.json`.
- **Biome is the only linter and formatter.** ESLint and Prettier are gone.
  Read the rule block in `biome.json` rather than a copy of it; several rules
  are deliberately off because the code uses the pattern they forbid.
- **`biome.json` takes no comments.** It is parsed as strict JSON — a `//` or
  `/* … */` anywhere in it fails `pnpm check` with a parse error, and depending
  on placement buries that error under a few hundred unrelated diagnostics from
  a fallback config. Reasons for a rule belong in this file or in
  `CONTRIBUTING.md`, not there.
- **No file-and-line references in prose docs.** A source path with a line
  number appended fails `check:refs`, and with it `pnpm check`, in `README.md`,
  `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `docs/` and `skills/`. Name the
  symbol instead — line numbers rot, symbol names do not. `CHANGELOG.md` and
  `remediation-plan.md` are history and are exempt.

## Documentation

When the public API changes, sync in this order:

1. Source JSDoc
2. `docs/api.md`
3. `docs/recipes.md` — if a quirk or pattern is involved
4. `docs/cheat-sheet.md`
5. `skills/using-signalize/` — `SKILL.md` for the mental model and the
   top-six list, `references/` for the detail
6. `README.md` → "API at a glance"
7. `CHANGELOG.md` → `## Unreleased`

**No code archaeology in the prose either.** A published page describes how the
library behaves today. "used to", "no longer", "an earlier revision of this page
said" — same rule as for comments, same reason: the reader has the page, not the
history. What changed between versions is `CHANGELOG.md`'s job, and it already
does it. The one exception is the **Consequence** paragraph of an architecture
decision in [architecture.md](./architecture.md), where a before and an after
are the format.

Keep `SKILL.md` lean: it carries the mental model, the silently-wrong
behaviours and the pointer table. New API detail belongs in
`references/api.md`, new quirks in `references/pitfalls.md`, new idioms in
`references/patterns.md`. A quirk graduates into `SKILL.md` only when it is
both common and silent.

Older doc filenames (`introduction.md`, `guide.md`, `full-api.md`) were
superseded. Do not recreate them.

## CHANGELOG

- **Every user-visible change gets an entry under `## Unreleased`** — features,
  fixes, dependency bumps, build system, breaking changes. A pure internal
  refactor with no observable effect can be skipped.
- **One line, one fact.** If context is needed, link a commit or a pull request
  rather than expanding the line.
- **Never modify entries under a released heading.** Past releases are
  immutable; a correction becomes a new `## Unreleased` entry.
- Group under the existing `### Build System` / `### Bug Fixes` / `### Tests` /
  `### Documentation` / `### Chores` headings. Add a new heading only when none
  fits.

## Versioning

The `version` field in `package.json` is the release trigger — a push to `main`
publishes it unless it ends in `-dev`. A pull request leaves that field alone
unless releasing is the point of the pull request. What a given version number
promises a consumer is in
[Versioning & stability](../README.md#versioning--stability); the details of the
release path are in [CONTRIBUTING.md](../CONTRIBUTING.md#releasing).
