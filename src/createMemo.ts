import {once, Priority} from '@spearwolf/eventize';
import {batch} from './batch.js';
import {collect, throwCollectedErrors} from './collect-errors.js';
import {createSignal} from './createSignal.js';
import {createEffect} from './effects.js';
import {globalDestroySignalQueue} from './global-queues.js';
import {getCurrentEffect} from './globalEffectStack.js';
import {SignalGroup} from './SignalGroup.js';
import {destroySignal, signalImpl} from './signal-core.js';
import {reportSignalizeError} from './signalize-error.js';
import type {SignalReader} from './types.js';

/**
 * Options for creating a memo (computed signal).
 */
export interface CreateMemoOptions {
  /** Attach the memo to a SignalGroup for lifecycle management */
  attach?: object | SignalGroup;
  /**
   * Optional name for the memo when attached to a group.
   *
   * Only has meaning together with `attach` — a name is a slot inside a
   * group. Passed on its own it does nothing, and every such call is
   * reported through `onSignalizeError()` with `source: 'ignored-option'`.
   *
   * An empty string is *no name*, not an empty one: `{name: ''}` behaves
   * exactly like a call without `name` — with `attach` the memo joins the
   * group unnamed and is not reachable through `group.signal('')`, without
   * `attach` nothing is reported. Only the empty string is degenerate; a
   * symbol is always a name, `Symbol('')` included.
   */
  name?: string | symbol;
  /** If true, the memo won't compute until first read (default: false) */
  lazy?: boolean;
  /** Effect priority for dependency tracking (default: Priority.C = 1000) */
  priority?: number;
  /**
   * Wrap each recompute in `batch()` (default: false).
   *
   * Only needed when `callback` itself writes to *other* signals as a side
   * effect — the batch groups those writes together with the memo's own
   * write, so a downstream effect that depends on both sees one
   * deduplicated run instead of one per write with a torn intermediate
   * state (some signals updated, others not yet).
   *
   * What that grouping costs depends on whether anything reacts. A memo
   * without a dependent effect defers nothing, and a batch with an empty
   * queue skips its flush entirely (PERF-002) — `true` then measures within
   * a few percent of the default, where it used to be 2.5x slower. With a
   * dependent effect the recompute pays a whole flush for that one deferred
   * effect: a `Set`, an array, two temporary queue subscriptions, a delivery
   * frame and a dispatch through eventize instead of a direct call, measured
   * at roughly 3x a recompute under the default. Which is why the default
   * stays `false`: the cost lands exactly where the option is used, and it
   * only pays off when one recompute would otherwise trigger the same
   * downstream effect more than once — writing to unrelated signals from a
   * `callback` is the exception, and the ordinary memo should not pay for it.
   *
   * The other half of that reasoning is gone. `true` used to mean that a
   * memo read from inside `callback` while dirty came back with its *stale*
   * pre-recompute value — not merely delayed but potentially permanent for a
   * `{lazy: true}` one — because `beforeRead` deferred the recompute like
   * any other run in an open batch. Since ASYNC-003 `beforeRead` recomputes
   * at the read regardless of an open batch, so composed memos read fresh
   * under either setting.
   */
  batchWrites?: boolean;
}

/**
 * Create a memoized (computed) signal that derives its value from other signals.
 * The memo automatically tracks dependencies and recomputes when they change.
 * Results are cached until dependencies change.
 *
 * A memo created inside another effect's body binds its signal's lifetime to
 * that effect: the memo's internal effect is registered there as a *child
 * effect* (dies on every parent rerun and on parent `destroy()`), and the
 * memo signal dies with it too — with and without `{attach}`. Passing
 * `{attach}` gives the signal a `SignalGroup` membership and, optionally, a
 * name, but not a lifetime of its own; it does not lift the signal out of
 * the creating effect's ownership, so `group.off()` destroys such a memo
 * signal along with the effect it belongs to, same as `outer.destroy()`
 * would. `hibernate()` around the creation is the only way to keep the memo
 * itself recomputing — and its signal alive — past the parent's rerun. A
 * memo created outside any effect body is unaffected either way; its signal
 * lives until destroyed explicitly (or via its group).
 *
 * A throw out of the first compute — the one this call runs itself, unless
 * `{lazy: true}` defers it to the first read — leaves neither the memo signal
 * nor its internal effect behind: without `attach` nothing holds them, this
 * call never returned a reader, and an abandoned memo signal is a leak no
 * counter ever gives back. So the creation is taken back and the error
 * arrives here. With `attach` both stay, because the group holds them and
 * `clear()` reaches them — the same rule and the same condition
 * `createEffect()` applies to itself. A failing signal teardown on top of the
 * compute error is reported next to it as an `AggregateError`, never in its
 * place.
 *
 * @param callback - Function that computes the derived value
 * @param options - Configuration options (attach, name, lazy, priority)
 * @returns A SignalReader function to get the computed value
 */
export function createMemo<Type>(
  callback: () => Type,
  options?: CreateMemoOptions,
): SignalReader<Type> {
  // Read before createEffect() runs: creating the memo's own effect pushes
  // *that* effect onto the stack while it autoruns, so "was there a parent"
  // must be captured now, at call time — not after.
  const parentEffect = getCurrentEffect();

  const si = createSignal<Type>();

  // The memo signal exists before its effect and has no holder until the
  // `return`: without {attach}, a throw in between is a signal nobody can
  // reach and no counter ever gives back. With {attach} the group holds it —
  // and its effect — so there is nothing to take back; same rule and same
  // condition as in createEffect().
  try {
    // CONS-015: an empty name is no name at all. `''` is the only falsy
    // value the `string | symbol` type admits besides null/undefined, so
    // one truthy test settles both branches below at once — the same rule
    // `decorators.ts` applies with `options?.name || context.name`.
    const name = options?.name || undefined;

    const group =
      options?.attach != null
        ? SignalGroup.findOrCreate(options.attach)
        : undefined;

    if (group != null) {
      if (name != null) {
        group.attachSignalByName(name, si);
      } else {
        group.attachSignal(si);
      }
    } else if (name != null) {
      // A name only exists inside a group, so without `attach` there is
      // nowhere to file it and the option does nothing. Reported on every
      // call, not once per process: this is a misspelled call, not a
      // deprecation notice.
      reportSignalizeError({
        level: 'warn',
        source: 'ignored-option',
        message: `[signalize] createMemo({name: ${String(name)}}) without {attach} is ignored: a name only exists within a SignalGroup. Pass {attach} as well, or drop the name.`,
      });
    }

    const useBatch = options?.batchWrites ?? false;

    const e = createEffect(
      () => {
        if (useBatch) {
          batch(() => {
            si.set(callback());
          });
        } else {
          si.set(callback());
        }
      },
      {
        autorun: !(options?.lazy ?? false),
        priority: options?.priority ?? Priority.C,
        attach: group,
      },
    );

    const sImpl = signalImpl(si);
    // Not `e.run`: that one defers while a batch is open, and a read cannot
    // be deferred without being answered wrongly (ASYNC-003). The write the
    // recompute makes still lands in the open batch.
    sImpl.beforeRead = e.runImmediately;

    // The memo signal takes its effect down with it (a destroyed memo has
    // nothing left to compute).
    const unsubscribeFromSignalDestroy = once(
      globalDestroySignalQueue,
      sImpl.id,
      e.destroy,
    );

    e.onDestroy(() => {
      // MEM-005: the once() above binds the effect to the signal's
      // destruction, but had no counterpart for the reverse direction.
      // globalDestroySignalQueue is a permanent module-level queue, so if the
      // effect dies first — its last live dependency was destroyed, or a
      // parent rerun tore it down as a child effect — the leftover
      // subscription holds the dead EffectImpl and its closure alive for as
      // long as the memo signal lives. For a memo whose inputs are gone, that
      // is forever. Unsubscribing here closes that side of the binding.
      unsubscribeFromSignalDestroy();

      // MEM-008: a memo created inside an effect body belongs to that effect.
      // Its internal effect is registered there as a child effect and dies on
      // every parent rerun and on parent destroy() — without a matching
      // signal teardown, each rerun leaves a signal behind: orphaned when
      // unnamed and {attach}-less, piling up in the group when {attach} is
      // given. The named case has always self-healed through the rebind on
      // recreation; this closes the same gap for the unnamed and the
      // {attach} case. A memo created outside any effect body is left alone
      // (see below) — {attach} gives the signal a group membership and,
      // optionally, a name, not a lifetime of its own; hibernate() around the
      // creation is the only way to keep such a memo alive past the parent's
      // rerun.
      if (parentEffect != null) {
        destroySignal(si);
      }

      // No parent effect (a standalone memo): its own effect only ever dies
      // when its last tracked dependency is destroyed
      // (`EffectImpl[$destroySignal]`) or `e.destroy()` is called directly.
      // Wiring the signal to that would destroy a memo signal — and cascade
      // into destroying any downstream effect depending on it — the moment
      // its *inputs* die, which regular (non-memo) signals never do and
      // callers don't expect.
    });

    return si.get;
    // The guarded region ends here, one step past what the rollback could
    // undo: a throw out of the last few statements — the `beforeRead` hook,
    // the two destroy bindings — would leave the effect wired to half a memo,
    // and `destroySignal(si)` alone would not unwire it. None of them can
    // throw today (assignments and a subscribe), so the gap is theoretical;
    // it stops being theoretical the moment something callable moves in here.
  } catch (err) {
    // Collect instead of replacing: destroySignal() can report failures of
    // its own, and neither error may swallow the other (see createEffect()).
    // No `return` and no `throw` behind this block: `throwCollectedErrors()`
    // always throws for a non-empty list, but its `: void` signature does not
    // say so, and only `strictNullChecks: false` keeps tsc from asking for a
    // trailing return. A `throw err` here would be dead code.
    const errors: unknown[] = [err];
    if (options?.attach == null) {
      collect(errors, () => destroySignal(si));
    }
    throwCollectedErrors(errors, 'creating a memo');
  }
}
