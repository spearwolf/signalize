# CLAUDE.md

Operational guidance for Claude Code in this repo. **Architecture, eventize internals, source-file map, and full public API surface are in `AGENTS.md` — read it before any non-trivial change.**

## Project

`@spearwolf/signalize` — synchronous signals/effects/memos/links library on top of `@spearwolf/eventize`. ESM-only, Node `>=24.13`, ES2023.

## Commands

Package manager: **pnpm** (`pnpm@10.6.5`). Never `npm install`.

| Command | Runs |
| --- | --- |
| `pnpm cbt` | `clean + compile + bundle + test` — local "done" gate |
| `pnpm world` | `clean + check + compile + bundle + test` — matches CI scope |
| `pnpm test` | Jest (ts-jest, ESM) |
| `pnpm test -- <file>` | single spec, e.g. `pnpm test -- createSignal.spec.ts` |
| `pnpm test -- -t "<name>"` | filter by test name |
| `pnpm check` / `pnpm fix` | Biome lint+format / Biome auto-fix |
| `pnpm lint` | Biome lint only |
| `pnpm format:write` | Biome format auto-fix |
| `pnpm bundle` | rollup → `dist/` |
| `pnpm compile` | tsc → `lib/` (types + sourcemaps) |
| `pnpm checkPkgTypes` | `attw --pack` |

**CI ≠ `pnpm cbt`.** `.github/workflows/ci.yml` runs `check + test`. Use `pnpm world` to match CI locally.

## Repo quirks (gotchas, not derivable from code)

- **Imports use `.js` extension** in `src/` (NodeNext): `import {x} from './foo.js'` — even though the source is `foo.ts`. Always.
- **`strict: true` but `strictNullChecks: false`** in `tsconfig.json` — intentional. Don't add `?:` defensively to "fix" null errors that aren't errors here.
- **Decorators are TC39 standard** (no `experimentalDecorators`). Use the `accessor` keyword and standard descriptor signatures, not legacy TS decorator forms.
- **Linting & formatting via Biome** (`biome.json`). ESLint and Prettier are gone. Disabled rules of note: `noUnsafeDeclarationMerging`, `noConstructorReturn`, `noTsIgnore`, `noAsyncPromiseExecutor`, `useArrowFunction` — all match intentional patterns in this codebase.
- **TypeScript 6 needs explicit `types`** in `tsconfig.json` (`["jest", "node"]`); auto-include from `node_modules/@types/*` no longer fires here. Removing it breaks `assert-helpers.ts` (uses Jest globals).
- **Edit only `src/`.** `lib/` (tsc) and `dist/` (rollup) are generated; don't commit.
- **Tests are `*.spec.ts` adjacent** to implementation. Jest is rooted at `src/` only.
- **`sideEffects: false`** — keep modules side-effect-free at top level (tree-shaking).
- **Public API surface lives in `src/index.ts` (default entry) and `src/decorators.ts` (`./decorators` subpath).** A new file in `src/` is invisible to consumers until re-exported through one of these.

## Verifying subscription leaks

For changes that touch subscribe/unsubscribe paths, assert no listener leaks. `src/assert-helpers.ts` (test-only) provides `getSubscriptionCount(queue, event?)`. Combine with public counters `getSignalsCount`, `getEffectsCount`, `getLinksCount`. Pattern: snapshot baseline → run scenario → destroy → assert restored. See `unsubscribeEffect.spec.ts`.

## Documentation sync

Public-API changes → `src/*.ts` JSDoc → `docs/full-api.md` → `docs/guide.md` → `README.md` "API at a Glance" → `CHANGELOG.md`. The previous top-level `skills/` folder was removed (commit `f08fb05`) — ignore older references to `SKILL.md` updates.

## CHANGELOG discipline

Every user-visible change (features, fixes, deps, build-system, breaking changes) gets an entry under `## Unreleased` in `CHANGELOG.md`. Pure internal refactors with no observable effect can be skipped.

- **Items must be short and precise** — one line, one fact. No wordy prose, no rationale paragraphs, no "why" essays. If context is needed, link a commit/PR; don't expand the line.
- **Never modify entries under released version headings** (`## v0.x.y`). Past releases are immutable history. Corrections go into a new `## Unreleased` entry.
- Group under existing `### Build System` / `### Bug Fixes` / `### Tests` / `### Documentation` / `### Chores` headings; create a new one only if none fit.
