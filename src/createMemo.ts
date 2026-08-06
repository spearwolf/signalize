import {once, Priority} from '@spearwolf/eventize';
import {batch} from './batch.js';
import {createSignal} from './createSignal.js';
import {createEffect} from './effects.js';
import {globalDestroySignalQueue} from './global-queues.js';
import {getCurrentEffect} from './globalEffectStack.js';
import {SignalGroup} from './SignalGroup.js';
import {destroySignal, signalImpl} from './signal-core.js';
import type {SignalReader} from './types.js';

/**
 * Options for creating a memo (computed signal).
 */
export interface CreateMemoOptions {
  /** Attach the memo to a SignalGroup for lifecycle management */
  attach?: object | SignalGroup;
  /** Optional name for the memo when attached to a group */
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
   * That grouping has a price, and it is the reason the default is `false`
   * rather than `true`: `EffectImpl.run()` defers *any* run while a batch is
   * open, and a memo's tracked read triggers its own recompute via exactly
   * that path (`beforeRead`). So a `callback` that reads another memo which
   * happens to be dirty at that moment gets that memo's *stale*
   * pre-recompute value instead of a fresh one — for a `{lazy: true}` memo
   * this is not just delayed but potentially permanent, since a lazy memo's
   * deferred run inside the batch flush is *also* a no-op (`autorun` is
   * `false`, so `[RECALL]` only marks it dirty without running it; nothing
   * but a later direct, unbatched read forces it to catch up).
   *
   * Reading other memos from inside a `callback` — composed memos — is
   * normal use; writing to unrelated signals as a side effect is not. `true`
   * trades read consistency for that side-effect grouping; the default
   * trades it back for read consistency, which is what composed memos rely
   * on (PERF-001).
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

  const group =
    options?.attach != null
      ? SignalGroup.findOrCreate(options.attach)
      : undefined;

  if (group != null) {
    if (options?.name) {
      group.attachSignalByName(options.name, si);
    } else {
      group.attachSignal(si);
    }
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
  sImpl.beforeRead = e.run;

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
}
