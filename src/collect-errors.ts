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

/*
 * The delivery frame.
 *
 * A signal write hands control to application code once per subscribed
 * effect, and eventize's dispatch loop has no `try` of its own: the first
 * throw ends the delivery and every effect behind it — every effect with a
 * lower priority — never learns that the value changed. So the failure is
 * caught at the listener (see `EffectImpl[RECALL]`) and parked here until
 * the write is done, which is the only moment at which throwing it costs
 * nobody else their notification.
 *
 * Save-and-restore rather than a stack, and a counter rather than a flag,
 * for the same reason `#suppressAutoTracking` is saved and restored: an
 * effect callback may write a signal itself. That nested write opens its
 * own frame, and it must neither empty the outer one nor add to it — its
 * errors belong to *its* `set()` call site, inside the callback. If the
 * callback lets them through, they arrive here again through the outer
 * frame's `[RECALL]`, as that effect's failure. Exactly one entry per
 * failing effect, either way.
 *
 * The array is created on the first failure, not per write: `writeSignal()`
 * is the hot path of the whole library and the overwhelming majority of
 * deliveries collect nothing.
 */
let g_deliveryDepth = 0;
let g_deliveryErrors: unknown[] | undefined;

/**
 * Open a delivery frame. The return value belongs to the caller and must
 * be handed back to {@link endIsolatedDelivery} in a `finally`.
 * @internal
 */
export const beginIsolatedDelivery = (): unknown[] | undefined => {
  g_deliveryDepth++;
  const outer = g_deliveryErrors;
  g_deliveryErrors = undefined;
  return outer;
};

/**
 * Close the frame opened by {@link beginIsolatedDelivery} and re-raise what
 * it collected — nothing, the single error unchanged, or an
 * `AggregateError` in delivery order.
 *
 * The state is restored *before* the throw, so the frame is intact for
 * whoever catches it — including the outer frame this one is nested in.
 * @internal
 */
export const endIsolatedDelivery = (
  outer: unknown[] | undefined,
  what: string,
): void => {
  const errors = g_deliveryErrors;
  g_deliveryErrors = outer;
  g_deliveryDepth--;
  if (errors !== undefined) throwCollectedErrors(errors, what);
};

/**
 * Park a failure in the open delivery frame.
 *
 * @returns `false` when there is no frame — then the caller must rethrow.
 *   A `run()` invoked directly, by `effect.run()` or by `createEffect()`'s
 *   autorun, has a caller who asked for it and gets its error at once.
 * @internal
 */
export const collectDeliveryError = (error: unknown): boolean => {
  if (g_deliveryDepth === 0) return false;
  if (g_deliveryErrors === undefined) g_deliveryErrors = [];
  g_deliveryErrors.push(error);
  return true;
};
