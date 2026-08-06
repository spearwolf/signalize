// Leaf module — imports nothing, not even from this package. It sits below
// `signal-core.ts` in the layering, so anything may reach down to it without
// risking a cycle (`rollup.config.mjs` fails the bundle on CIRCULAR_DEPENDENCY).

/**
 * Re-raise errors collected while tearing something down.
 *
 * A single error is rethrown unchanged, so the common case keeps the exact
 * error the userland cleanup threw. Several errors are bundled into an
 * `AggregateError` — none of them may be dropped just because a sibling
 * failed first.
 *
 * @param errors - The failures collected during the teardown, in teardown order
 * @param what - What was being torn down, phrased to follow "errors while ",
 *   e.g. `'destroying an effect'` or `'clearing a signal group'`
 */
export const throwCollectedErrors = (errors: unknown[], what: string): void => {
  if (errors.length === 0) return;
  if (errors.length === 1) throw errors[0];
  throw new AggregateError(
    errors,
    `[signalize] ${errors.length} errors while ${what}`,
  );
};
