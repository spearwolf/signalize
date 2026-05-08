# CLAUDE.md

Operational guidance for Claude Code in this repo. **Architecture, eventize internals, source-file map, and full public API surface are in `AGENTS.md` — read it before any non-trivial change.**

## Project

`@spearwolf/signalize` — synchronous signals/effects/memos/links library on top of `@spearwolf/eventize`. ESM-only, Node `>=24.13`, ES2023.

## Commands

Package manager: **pnpm** (`pnpm@10.6.5`). Never `npm install`.

| Command | Runs |
| --- | --- |
| `pnpm cbt` | `clean + compile + bundle + test` — local "done" gate |
| `pnpm world` | `clean + lint + prettier:check + compile + bundle + test` — matches CI scope |
| `pnpm test` | Jest (ts-jest, ESM) |
| `pnpm test -- <file>` | single spec, e.g. `pnpm test -- createSignal.spec.ts` |
| `pnpm test -- -t "<name>"` | filter by test name |
| `pnpm lint` / `pnpm fix` | ESLint / lint:fix + prettier:write |
| `pnpm bundle` | rollup → `dist/` |
| `pnpm compile` | tsc → `lib/` (types + sourcemaps) |
| `pnpm checkPkgTypes` | `attw --pack` |

**CI ≠ `pnpm cbt`.** `.github/workflows/ci.yml` runs `lint + prettier:check + test`. Use `pnpm world` to match CI locally.

## Repo quirks (gotchas, not derivable from code)

- **Imports use `.js` extension** in `src/` (NodeNext): `import {x} from './foo.js'` — even though the source is `foo.ts`. Always.
- **`strict: true` but `strictNullChecks: false`** in `tsconfig.json` — intentional. Don't add `?:` defensively to "fix" null errors that aren't errors here.
- **Decorators are TC39 standard** (no `experimentalDecorators`). Use the `accessor` keyword and standard descriptor signatures, not legacy TS decorator forms.
- **Edit only `src/`.** `lib/` (tsc) and `dist/` (rollup) are generated; don't commit.
- **Tests are `*.spec.ts` adjacent** to implementation. Jest is rooted at `src/` only.
- **`sideEffects: false`** — keep modules side-effect-free at top level (tree-shaking).
- **Public API surface lives in `src/index.ts` (default entry) and `src/decorators.ts` (`./decorators` subpath).** A new file in `src/` is invisible to consumers until re-exported through one of these.

## Verifying subscription leaks

For changes that touch subscribe/unsubscribe paths, assert no listener leaks. `src/assert-helpers.ts` (test-only) provides `getSubscriptionCount(queue, event?)`. Combine with public counters `getSignalsCount`, `getEffectsCount`, `getLinksCount`. Pattern: snapshot baseline → run scenario → destroy → assert restored. See `unsubscribeEffect.spec.ts`.

## Documentation sync

Public-API changes → `src/*.ts` JSDoc → `docs/full-api.md` → `docs/guide.md` → `README.md` "API at a Glance" → `CHANGELOG.md`. The previous top-level `skills/` folder was removed (commit `f08fb05`) — ignore older references to `SKILL.md` updates.
