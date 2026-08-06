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
 * effect* (dies on every parent rerun and on parent `destroy()`), and — with
 * no `{attach}` — the memo signal now dies with it too, instead of being
 * orphaned. Pass `{attach}` to give the signal a lifetime of its own (a
 * `SignalGroup`); the memo's internal effect still dies with the parent
 * either way, so an attached memo only survives as a frozen value, not a
 * live one — `hibernate()` around the creation is the only way to keep the
 * memo itself recomputing past the parent's rerun. A memo created outside
 * any effect body is unaffected either way; its signal lives until
 * destroyed explicitly (or via its group).
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

  once(globalDestroySignalQueue, sImpl.id, e.destroy);

  // MEM-005: bind the memo signal to the effect's lifecycle, not just the
  // other way round (above) — but only when a parent effect actually owns
  // that lifecycle. A memo created inside an effect body has its internal
  // effect torn down as a child effect on every parent rerun, and nothing
  // used to follow that up on the signal side, orphaning it. Restricting the
  // hook to exactly that case matters:
  //
  // - No parent effect (a standalone memo): its own effect only ever dies
  //   when its last tracked dependency is destroyed
  //   (`EffectImpl[$destroySignal]`) or `e.destroy()` is called directly.
  //   Wiring the signal to that would destroy a memo signal — and cascade
  //   into destroying any downstream effect depending on it — the moment its
  //   *inputs* die, which regular (non-memo) signals never do and callers
  //   don't expect.
  // - `{attach}` given: the group owns the signal's lifetime and already
  //   promises callers that `group.off()` leaves attached signals alive and
  //   the group reusable. Hooking here as well would destroy the signal the
  //   instant the group tears down its effects, before its own
  //   signal-teardown loop even runs — breaking that promise silently.
  if (parentEffect != null && group == null) {
    e.onDestroy(() => destroySignal(si));
  }

  return si.get;
}
