// One layer above `signalize-error.ts`, not a leaf: it needs
// `reportSignalizeError`, so it imports that module — and nothing else. The
// back edge is what must never exist: `signalize-error.ts` (or `instances.ts`
// below it) importing this module with a value use closes the ring. Measured
// 2026-08-12 on an isolated copy of the tree: `tsc` stays completely silent
// (exit 0, no diagnostic), and `pnpm bundle` fails with `Circular dependency:
// lib/deprecation-warnings.js -> lib/signalize-error.js ->
// lib/deprecation-warnings.js` (`rollup.config.mjs`'s `CIRCULAR_DEPENDENCY`
// branch). Same pattern `effect-error-handlers.ts` carries: the compiler is
// not the guard here, `pnpm bundle` is.

import {reportSignalizeError} from './signalize-error.js';

/**
 * The deprecated call sites this library knows about. A union rather than a
 * bare `string`, because two call sites sharing a key would silence the
 * second one — and it would be silent: no test fails, the notice just never
 * appears.
 *
 * @internal
 */
export type DeprecationKey =
  | 'signalReader(callback)'
  | 'SignalGroup.destroy'
  | 'SignalGroup#destroy';

// A plain allocation with no observable effect, tree-shakeable like anything
// else — the same argument `DEFAULT_EQUALS` in `createSignal.ts` carries.
// This is *not* a third exception to `sideEffects: false`; see AGENTS.md.
const gWarnedKeys = new Set<DeprecationKey>();

/**
 * Report a deprecation notice at most once per process, per call site.
 *
 * Deliberately once, unlike the `ignored-option` notices: a deprecated call
 * is a lifecycle fact about the codebase, not a typo in one call, and the
 * unconditional variant floods the console from a render loop (CONS-004).
 *
 * The `[signalize] ` prefix stays with the caller's message rather than being
 * built here, so that one rule holds across the whole tree — every
 * self-authored message begins with it — and `message-prefix.spec.ts` can
 * check it in one place instead of demanding its *absence* at these three
 * call sites (CONS-002).
 *
 * @param key - Which deprecated call site is reporting
 * @param message - The full notice, prefix included
 *
 * @internal
 */
export const warnDeprecatedOnce = (
  key: DeprecationKey,
  message: string,
): void => {
  if (gWarnedKeys.has(key)) return;
  gWarnedKeys.add(key);
  reportSignalizeError({level: 'warn', source: 'deprecation', message});
};
