import {once, Priority} from '@spearwolf/eventize';
import {batch} from './batch.js';
import {collect, throwCollectedErrors} from './collect-errors.js';
import {createSignal} from './create-signal.js';
import {createEffect} from './effects.js';
import {getCurrentEffect} from './global-effect-stack.js';
import {globalDestroySignalQueue} from './global-queues.js';
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
   * Only meaningful together with `attach` — a name is a slot inside a
   * group. Passed on its own it does nothing, and every such call is
   * reported through `onSignalizeError()` with `source: 'ignored-option'`.
   */
  name?: string | symbol;
  /** If true, the memo won't compute until first read (default: false) */
  lazy?: boolean;
  /** Effect priority for dependency tracking (default: Priority.C = 1000) */
  priority?: number;
  /**
   * Wrap each recompute in `batch()` (default: `false`).
   *
   * Only needed when `callback` itself writes to *other* signals as a side
   * effect — the batch groups those writes with the memo's own, so a
   * downstream effect depending on both sees one run instead of one per
   * write with a torn intermediate state.
   *
   * `docs/api.md`, "Memos" → "createMemo<T>(computer, options?): SignalReader<T>"
   */
  batchWrites?: boolean;
}

/**
 * Derive a value from other signals. `computer` runs once up front and
 * tracks whatever it reads as dependencies; the cached result stands until
 * one of them changes and triggers a recompute.
 *
 * Created inside another effect's body, the memo is that effect's child —
 * the parent's rerun or `destroy()` takes the internal effect and the memo
 * signal down with it, with or without `{attach}`. `hibernate()` around the
 * creation is the only way past that.
 *
 * A throw out of the first compute — the one this call runs itself, unless
 * `{lazy: true}` defers it to the first read — arrives here either way, and
 * `attach` decides what survives it: without it the creation is taken back,
 * destroying the memo signal along with its internal effect; with it both
 * stay, because the group holds them. A failing signal teardown on top of
 * that compute error is reported next to it as an `AggregateError`, never
 * in its place.
 *
 * `docs/api.md`, "Memos" → "createMemo<T>(computer, options?): SignalReader<T>"
 *
 * @param options - See {@link CreateMemoOptions}
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
    // An empty name is no name at all. `''` is the only falsy
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
    // be deferred without being answered wrongly. The write the
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
      // The counterpart to the once() above, which binds the effect to the
      // signal's destruction. globalDestroySignalQueue is a permanent
      // module-level queue, so if the effect dies first — its last live
      // dependency destroyed, or a parent rerun tearing it down as a child
      // effect — the leftover subscription would hold the dead EffectImpl and
      // its closure alive for as long as the memo signal lives. For a memo
      // whose inputs are gone, that is forever.
      unsubscribeFromSignalDestroy();

      // A memo created inside an effect body belongs to that effect. Its
      // internal effect is registered there as a child effect and dies on
      // every parent rerun and on parent destroy() — without a matching
      // signal teardown, each rerun would leave a signal behind: orphaned
      // when unnamed and {attach}-less, piling up in the group when {attach}
      // is given. The named case self-heals through the rebind on
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
