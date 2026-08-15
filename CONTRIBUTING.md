# Contributing to @spearwolf/signalize

Thank you for your interest in contributing. This document is the process: how
to set up, how to change something, how to verify it, and how it gets released.

The rules your change has to follow — naming, imports, comments, tests, the
public surface — are in **[docs/conventions.md](./docs/conventions.md)**. Read
that one before writing code.

Please read our [Code of Conduct](./CODE_OF_CONDUCT.md) before participating.

## Where to look

| Question | Document |
| --- | --- |
| How is it done here? | [docs/conventions.md](./docs/conventions.md) |
| How does it work, and why is it built this way? | [docs/architecture.md](./docs/architecture.md) |
| What does this export do? | [docs/api.md](./docs/api.md) |
| The internals in depth — source map, eventize behaviour, measurements | [AGENTS.md](./AGENTS.md) |
| How do I *use* the library? | [docs/quickstart.md](./docs/quickstart.md), [docs/recipes.md](./docs/recipes.md) |

## Getting started

### Prerequisites

- **Node.js `>=22`** — the same floor as `engines.node` in `package.json`.
  Nothing in the build needs more: `pnpm world` runs green on Node 22 (measured
  against 22.13.1), and CI runs the full gate on Node 22 and Node 24. One
  devDependency is narrower than the floor — `npm-run-all2@9` declares
  `^22.22.2 || ^24.15.0 || >=26.0.0` — so on an older 22.x `pnpm install` prints
  an engine warning, and refuses outright with `engineStrict` turned on.
- **pnpm** (`pnpm@11.20.0`). `npm install` is not supported here.

### Setup

```shell
git clone https://github.com/spearwolf/signalize.git
cd signalize
pnpm install
```

## Commands

| Command | Runs |
| --- | --- |
| `pnpm cbt` | **The local gate** — clean + compile + bundle + test |
| `pnpm world` | clean + check + typecheck + compile + check:dts + bundle + test:smoke + checkPkgTypes + test + test:gc — the full blocking CI scope |
| `pnpm test` | Vitest with the coverage gate. Runs the `unit` and `gc` projects together, so every `src/**/*.gc.spec.ts` runs here too |
| `pnpm test <file>` | A single spec, e.g. `pnpm test create-signal.spec.ts` |
| `pnpm test -t "<name>"` | Only tests whose name matches |
| `pnpm test:watch` | Vitest in watch mode |
| `pnpm test:gc` | Every file serially (no file parallelism) with `--expose-gc` applied to the whole suite, not just the GC specs — that is what this adds, not the GC specs themselves |
| `pnpm test:smoke` | `smoke/dist-smoke.test.ts` on plain Node (`node --test`) against the built `dist/`, type-checked against the shipped `lib/*.d.ts`. Needs `pnpm dist` to have run |
| `pnpm smoke` | `pnpm dist` + `pnpm test:smoke` — builds first, no stale artifact |
| `pnpm bench` | The microbenchmark suite in `bench/`. Informative; CI runs it `continue-on-error` |
| `pnpm check` | Biome lint+format check plus the three guard scripts (`check:refs`, `check:banner`, `check:layering`) |
| `pnpm check:dts` | Type-checks the emitted `lib/**/*.d.ts` with `skipLibCheck` off, so a `@internal` marker that strips a symbol another `.d.ts` still references is caught. Needs `pnpm compile` to have run; not part of `pnpm check` because that runs before `compile` in `pnpm world` |
| `pnpm fix` | Biome with auto-fix |
| `pnpm typecheck` | `tsc --noEmit` over the whole project — the only stage that type-checks `src/**/*.spec.ts`, which `compile` excludes |
| `pnpm compile` | Two `tsc` passes → `lib/`: JS + sourcemaps, and `@internal`-free `.d.ts` |
| `pnpm bundle` | rollup → `dist/` |
| `pnpm dist` | clean + compile + bundle |
| `pnpm checkPkgTypes` | `attw --pack --profile esm-only` — checks the `exports` map and shipped `.d.ts` across the resolution modes that apply to an ESM-only package (`node16 (from ESM)`, `bundler`); `node10` and `node16 (from CJS)` are excluded by the profile because they cannot pass here by design |
| `pnpm clean` | Remove build artifacts |

**Which one to use:** `pnpm test` while iterating, `pnpm cbt` before you call a
change done, and `pnpm world` before pushing — it is the only task that also
runs Biome, the guard scripts, the type check over the specs, the dist smoke
test and the package types check.

A filtered run (`pnpm test <file>`, `pnpm test -t "<name>"`) always exits 1: the
per-file coverage gate fails for every file that did not run. That is the gate
reporting, not a failing test — read the test result above it.

## Project structure

Only `src/` is edited by hand. `lib/` and `dist/` are generated.

```
src/
├── index.ts                 # Public API surface — the `.` entry, every export named
├── decorators.ts            # @signal — the ./decorators subpath entry
│
├── signal-core.ts           # Leaf: isSignal, signalImpl, writeSignal, destroySignal, the counter
├── collect-errors.ts        # Leaf below signal-core: teardown error collection, isolated delivery
├── signalize-error.ts       # Leaf: onSignalizeError — the fallback diagnostics channel
├── instances.ts             # Leaf: the multi-copy sentinel
├── effect-hook.ts           # Leaf: the createEffect placeholder that keeps the graph acyclic
├── thenable-guard.ts        # Leaf: the isThenable predicate and the guard behind the thenable TypeError
│
├── Signal.ts                # Signal<T> — the public wrapper
├── create-signal.ts         # SignalImpl, createSignal()
├── Effect.ts                # Effect — the public wrapper
├── EffectImpl.ts            # Tracking and rerun core
├── effects.ts               # createEffect(), lifecycle hooks, the max-depth setting
├── effect-error-handlers.ts # Handler counter behind onEffectError()
├── create-memo.ts           # createMemo()
├── link.ts / SignalLink.ts  # link(), unlink() and the link classes
├── SignalGroup.ts           # Lifecycle container
├── SignalAutoMap.ts         # Auto-creating Map<key, Signal>
├── object-signals.ts        # Signals attached to host objects (the decorator path)
│
├── global-queues.ts         # The four global eventize buses
├── global-effect-stack.ts   # Effect execution context stack
├── batch.ts / be-quiet.ts / hibernate.ts / touch.ts / value.ts
├── deprecation-warnings.ts  # Once-per-process deprecation notices
├── constants.ts             # Symbols ($signal, $effect, RECALL, …)
├── types.ts                 # Public TypeScript types
├── UniqIdGen.ts             # Symbol-based unique id generator
├── __testing__/             # assert-helpers used by the specs
└── *.spec.ts                # Tests, adjacent to the implementation
```

The responsibility of each file, and the layering that must not be broken, is in
[docs/architecture.md](./docs/architecture.md).

## Making a change

1. **Read.** Start with the related source files and
   [docs/conventions.md](./docs/conventions.md). For anything non-trivial,
   [AGENTS.md](./AGENTS.md) is the deep map.
2. **Implement**, following the existing patterns.
3. **Test.** Add tests in the adjacent `*.spec.ts`. A new option, overload or
   error path arrives with the test that would fail without it.
4. **Document**, if the public API moved — the sync order is in
   [docs/conventions.md](./docs/conventions.md#documentation).
5. **Verify** with `pnpm cbt`, then `pnpm world` before you push.

### Common patterns

| Change | Touch |
| --- | --- |
| New `Signal` method | `types.ts` interface → `SignalImpl` in `create-signal.ts` → the `Signal` wrapper → tests in the adjacent spec |
| New effect option | `EffectOptions` in `EffectImpl.ts` → handle it in the constructor or in `createEffect()` → export the type from `index.ts` → document it in the Types table of `docs/api.md` → tests in `effects.spec.ts` or a new `effects.<feature>.spec.ts` |
| New utility function | `src/<name>.ts` → **give it a rank in the ladder in `scripts/check-layering.mjs`** → re-export from `src/index.ts` → adjacent `<name>.spec.ts` |
| New published type | `types.ts` → add the name to the type-export list in `index.ts` → a `@ts-expect-error` witness in `types.public-surface.spec.ts` if the type carries a promise no other test would catch |
| New published value | the module → add the name to that module's export line in `index.ts` → add the name to the list in `index.public-surface.spec.ts` |
| Core reactivity | `EffectImpl.ts` (subscribe paths) + `signal-core.ts` (emit paths) + `global-queues.ts`; add subscription-count assertions to the tests |

A new file in `src/` does nothing for consumers until it is wired through
`src/index.ts` or `src/decorators.ts`. And it fails `check:layering` — and with
it `pnpm check` — until the ladder in `scripts/check-layering.mjs` gives it a
rank. The rank is what decides which modules it may import: strictly lower ones,
never a sibling and never one above it.

## Testing

Tests are `*.spec.ts` files next to the implementation; globals are on, so
`describe` / `it` / `expect` / `vi` need no import. The guard scripts in
`scripts/` are the one addition: their `*.spec.mjs` files sit next to them
and run in the same `unit` project.

The conventions that a reviewer will check — counter guards in the hooks,
teardown in a `finally`, subscription-leak assertions, what a test name looks
like — are in
[docs/conventions.md](./docs/conventions.md#tests). The short version:

- Use `getSignalsCount()`, `getEffectsCount()` and `getLinksCount()` to verify
  cleanup, and snapshot `getSubscriptionCount(queue)` for anything touching
  subscribe or unsubscribe paths.
- Always destroy signals, effects and links in tests, from a `finally`.
- `SignalGroup.clear()` in `afterEach` for more involved setups.

## Pull requests

1. Fork the repository and create a branch.
2. Make the change, following [docs/conventions.md](./docs/conventions.md).
3. Add an entry under `## Unreleased` in `CHANGELOG.md` for anything
   user-visible.
4. Run `pnpm world`.
5. Open the pull request with a clear description of what changed and why.

Keep a pull request focused on a single concern. Include tests for new
behaviour, update the documentation for API changes, and write commit messages
that explain the *why* — the diff already shows the *what*.

## Releasing

There is no separate release step. `.github/workflows/main.yml` runs the full CI
workflow on every push to `main` and, if it passes, runs `pnpm publish:pkg` right
after — so **the `version` field in `package.json` is the release trigger**.
`scripts/publishPackage.cjs` reads that field and takes two decisions from it:
whether to publish at all, and under which npm dist-tag.

| `version` | What happens |
| --- | --- |
| `1.2.3` | published under `latest` |
| `1.2.3-alpha.0`, `-beta.1`, `-rc.2`, `-next.7` | published under `alpha`, `beta`, `rc`, `next` — `latest` stays where it is |
| `1.2.3-dev` | skipped as a development version |
| anything else | the job fails, nothing is published |

A version that already exists on npm is skipped as released, whichever tag it
would have gone under. The tag list is closed on purpose: a prerelease
identifier with no tag assigned to it is a typo, and both ways of guessing at
it are worse than stopping. Publishing `1.2.3-btea.1` untagged would move
`latest` onto a prerelease that every plain `npm install` then picks up;
publishing it under its own name would create a dist-tag that outlives the
mistake.

`latest` only ever moves forward. A release older than the version that tag
currently points at fails the job rather than publishing, because a patch on a
superseded line would otherwise hand every plain `npm install` the older
library. A prerelease is exempt, having no business with that tag in the first
place — so a fix on an old line ships as `0.32.1-beta.1` and `latest` stays
where it is. Releasing it as a plain `0.32.1` takes a manual `npm publish`, and
then owning the tag by hand.

Two consequences before you touch that field:

- **The `-dev` suffix is the safety catch, and dropping it is the release.**
  There is no tag, no GitHub release and no manual approval between merging to
  `main` and `npm publish`. Going to a prerelease identifier first keeps
  `latest` where it is, but the publish itself is just as immediate.
- **A version number is spent once.** Publishing cannot be taken back in any way
  a consumer would notice, and the guard against republishing only covers
  versions that already exist — never the one you just created.

So a pull request leaves `version` alone unless releasing is the point of that
pull request. What a given version number promises a consumer is in
[Versioning & stability](./README.md#versioning--stability); a breaking change
shipped under a version that does not allow one cannot be repaired afterwards.

## Reporting issues

1. Check whether the issue already exists.
2. Provide a minimal reproduction.
3. Include your environment (Node version, package manager, bundler).
4. Describe expected versus actual behaviour.

## Questions

Open an issue for questions or discussions. The documentation index is in the
[README](./README.md#documentation), and the test files are the most honest
usage examples in the repository.

## License

By contributing, you agree that your contributions will be licensed under the
Apache-2.0 License.
