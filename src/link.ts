import {once} from '@spearwolf/eventize';
import {$queueUnsubscribes, DESTROY} from './constants.js';
import {Signal} from './Signal.js';
import {
  SignalLink,
  SignalLinkToCallback,
  SignalLinkToSignal,
  ValueCallback,
} from './SignalLink.js';
import {signalImpl} from './signal-core.js';
import {ISignalImpl, SignalLike, SignalReader} from './types.js';

// Weak on the source signal: the search always goes through the source, so
// there is no need to iterate `gLinks` itself, and a WeakMap ties the *set*
// of links for a source to that source's own lifetime — once the source is
// gone, so is the Map holding its links (MEM-002).
//
// That WeakMap outer layer does not make an individual link collectible
// while its source is still reachable, though (MEM-007). The inner `Map` is
// a strong map: as long as the source signal is reachable, every link ever
// created on it — its callback closure, its target reference, all of its
// subscriptions on the global queues (two for a callback target, three for
// a signal target) — stays reachable too, and letting go of the returned
// `SignalLink` and waiting for GC does not change that. The only ways out
// *while the source lives* are `destroy()`, `unlink()`, or a cleared
// `{attach}` group. Explicitly destroying the source tears down every link
// on it the same way, fully — including their global-queue subscriptions.
// Destroying a signal *target* takes down the links that point at it, not
// the other links on the same source: with three links on one source,
// `destroySignal(t1)` leaves two.
//
// If a link and its source become unreachable *together* instead (the
// source was never `destroySignal()`d, just dropped along with every link
// on it), `gLinkFinalizer` below does eventually correct `getLinksCount()`
// to match, and releases the link's subscriptions on the two global queues
// along with it (MEM-001) — see that finalizer's comment for what that path
// still does not do; it is not equivalent to the three explicit ways above.
//
// Against a long-lived, still-reachable source, a hot path that keeps
// calling `link(src, freshCallback)` without ever tearing the old ones down
// grows this map without bound — measured: 1000 orphaned links on a live
// source stay 1000 after `gc()`, and each write to `src` gets linearly
// slower with the backlog (64.5 ms for 1000 writes at that count, vs. 75 µs
// warm / 116 µs cold with none). See `link()`'s "Lifetime" JSDoc below and
// `getLinksCount()` for the counter that makes this measurable in
// application code.
const gLinks = new WeakMap<
  ISignalImpl<any>,
  Map<object | Function, SignalLink<any>>
>();

// `getLinksCount()` without an argument used to iterate `gLinks.values()`,
// which a WeakMap cannot support. This tracks the same total explicitly.
let gLinksCount = 0;

// A link that is only dropped and garbage-collected — never explicitly
// destroy()ed — fires no DESTROY event, so the increment/decrement pair
// below can't see it. This registry catches that case: it fires once the
// link itself becomes unreachable, releases the link's subscriptions on the
// two module-level global queues, and corrects the counter. The `once(link,
// DESTROY, ...)` hook unregisters first on the explicit path, so a link that
// *is* destroyed is never double-counted (nor double-released) here.
//
// The held value is the link's own `[$queueUnsubscribes]` array — two
// handles for a callback target, three for a signal target. MEM-001: a
// dropped link never runs `destroy()`, so these handles are the *only* thing
// left that can take its subscriptions off two queues that live as long as
// the process does. The array is safe to hold: the handles reach only the
// constructor closures, and those know the link exclusively through a
// `WeakRef` (see `SignalLink`'s constructor), so there is no strong path
// from the held value back to the registered object — which there must not
// be, or this callback would never fire at all.
//
// Releasing before decrementing the counter reads well — `getLinksCount()
// === 0` then also means "every release has run" — but claim no more for it
// than that: this callback runs to completion synchronously either way, so
// a GC test that waits for the counter is just as settled with the two
// halves swapped. Nothing depends on the order, and no test guards it.
//
// What this still is *not* (MEM-007): a fourth-and-a-half teardown route. It
// emits no DESTROY, does not call `destroy()`, detaches nothing from a group
// (a group-attached link is held strongly by `SignalGroup#links` and is
// never collectible in the first place) and does not touch the target. It is
// neither schedulable nor observable — only the backlog it used to leave on
// the global queues is gone.
const gLinkFinalizer = new FinalizationRegistry<(() => void)[]>(
  (queueUnsubscribes) => {
    for (const unsubscribe of queueUnsubscribes) {
      try {
        unsubscribe();
      } catch (err) {
        // A throw out of a FinalizationRegistry callback has no caller to
        // reach — it would take the process down. Same channel and same
        // reason as `SignalGroup`'s finalizer.
        console.error(
          '[signalize] link: releasing the queue subscriptions of a collected link failed',
          err,
        );
      }
    }
    queueUnsubscribes.length = 0;
    if (gLinksCount > 0) {
      gLinksCount -= 1;
    }
  },
);

// MEM-005: `gLinks` is weak on the source but strong on the inner Map, so
// every link ever created against a still-reachable source stays alive — and
// every write to that source pays for the backlog (measured: 1000 writes
// cost 0.60 ms with no links, 58 ms with 1000). Dropping the `SignalLink`
// and waiting for GC does not help; only the four explicit teardown routes
// do. There is no dev-mode flag to hang this off and no runtime switch to
// add (that would be public API), so it fires at most once per source
// signal, for good.
//
// A `WeakSet` rather than an equality test on the threshold: an application
// that builds up and tears down links around the mark would get a fresh
// warning on every rebuild — a warning about correct behaviour. The set
// holds nothing (weak on the source, like `gLinks` itself) and makes the
// stronger promise: once per source, for the life of the process.
const LINK_COUNT_WARN_THRESHOLD = 1000;
const gWarnedSources = new WeakSet<ISignalImpl<any>>();

type LinkableSource<ValueType> = SignalReader<ValueType> | Signal<ValueType>;
type LinkableTarget<ValueType> =
  | SignalReader<ValueType>
  | Signal<ValueType>
  | ValueCallback<ValueType>;

/**
 * Options for creating a signal link.
 */
export interface LinkOptions {
  /**
   * Attach the link to this group, so it will be destroyed when the group is destroyed.
   *
   * `link()` deduplicates by `(source, target)`: calling it again for a pair
   * that already has a link returns the existing instance. If that call
   * passes `attach`, the existing link is attached to that group *too* —
   * it is not replaced or ignored. A link with multiple attached groups is
   * destroyed as soon as any one of them clears; it does not wait for all
   * of them.
   */
  attach?: object;

  // /**
  //  * Enable two-bay binding between two signals.
  //  * Has no effect when the target is a callback function.
  //  */
  // twoWay?: boolean;
}

/**
 * Create a one-way data flow connection from a source signal to a target.
 * When the source signal changes, the target is automatically updated.
 * The target can be another signal or a callback function.
 *
 * @param source - The source signal to link from
 * @param target - The target signal or callback to link to
 * @param options - Configuration options (attach)
 * @returns A SignalLink object that can be destroyed to break the connection
 *
 * Lifetime: the returned `SignalLink` is held by an internal registry keyed
 * on `source`, and stays reachable there until one of four things happens —
 * `link.destroy()`, `unlink(source, target?)`, a `{attach}` group being
 * cleared, or `source`/a signal `target` being destroyed. Discarding the
 * return value is fine and does not shorten this: it only makes the link
 * unreachable to the caller, not to the registry. There is no fifth way —
 * garbage collection alone does not reclaim a link on a live source. (Once a
 * link becomes unreachable *together with* its source, the finalizer does
 * release its global-queue subscriptions as well as correcting the count —
 * but that is a backstop for a link nobody can reach any more, not a
 * teardown you can schedule.)
 *
 * Warns once per source signal, via `console.warn`, as soon as 1000 links
 * hang off it — the point where the linear cost of a write to that source
 * has grown two orders of magnitude (measured) and an unbounded register is
 * the likelier explanation than intent. Diagnostic only: nothing is thrown
 * and nothing is refused.
 */
export function link<ValueType>(
  source: LinkableSource<ValueType>,
  target: LinkableTarget<ValueType>,
  options?: LinkOptions,
): SignalLink<ValueType> {
  // Validation first (BUG-007): reject an invalid source before any registry
  // entry exists. Previously `gLinks.set(sourceSignal, links)` ran before
  // the SignalLink constructor's own `signalImpl(source)` check, so a
  // failed `link()` left a permanent `undefined` key with an empty Map.
  const sourceSignal = signalImpl(source);
  if (sourceSignal == null) {
    throw new TypeError('[signalize] link: source must be a signal');
  }

  const targetSignal = signalImpl(target as SignalLike<ValueType>);
  const targetKey: object | Function =
    targetSignal ?? (target as object | Function);

  let links = gLinks.get(sourceSignal);
  if (links == null) {
    links = new Map<object | Function, SignalLink<any>>();
    gLinks.set(sourceSignal, links);
  } else if (links.has(targetKey)) {
    // Cache hit (BUG-004): attach the existing link to the newly requested
    // group too, instead of silently dropping `options.attach`. The link
    // now dies with whichever of its attached groups clears first — see the
    // `LinkOptions.attach` JSDoc.
    const cachedLink = links.get(targetKey)!;
    const attachToGroup = options?.attach;
    if (attachToGroup) {
      cachedLink.attach(attachToGroup);
    }
    return cachedLink;
  }

  // Construction, then registration (`set()`).
  const newLink =
    targetSignal != null
      ? new SignalLinkToSignal(source, targetSignal)
      : new SignalLinkToCallback(source, target as ValueCallback<ValueType>);

  const attachToGroup = options?.attach;
  if (attachToGroup) {
    newLink.attach(attachToGroup);
  }

  links.set(targetKey, newLink);
  gLinksCount += 1;
  gLinkFinalizer.register(newLink, newLink[$queueUnsubscribes], newLink);

  if (
    links.size >= LINK_COUNT_WARN_THRESHOLD &&
    !gWarnedSources.has(sourceSignal)
  ) {
    gWarnedSources.add(sourceSignal);
    console.warn(
      `[signalize] link(): ${links.size} links on a single source signal. A link is held until destroy(), unlink(), a cleared {attach} group, or the destruction of source/target — garbage collection alone does not reclaim one on a live source. If this is a hot path creating fresh callbacks, tear the old links down; getLinksCount(source) is the number to watch.`,
    );
  }

  once(newLink, DESTROY, () => {
    links.delete(targetKey);
    if (links.size === 0) {
      gLinks.delete(sourceSignal);
    }
    gLinkFinalizer.unregister(newLink);
    if (gLinksCount > 0) {
      gLinksCount -= 1;
    }
  });

  return newLink;
}

/**
 * Remove a link between a source signal and a target.
 * If no target is specified, all links from the source are removed.
 *
 * @param source - The source signal
 * @param target - Optional specific target to unlink (if omitted, all targets are unlinked)
 */
export function unlink<ValueType>(
  source: LinkableSource<ValueType>,
  target?: LinkableTarget<ValueType>,
): void {
  const sourceSignal = signalImpl(source);

  if (gLinks.has(sourceSignal)) {
    const links = gLinks.get(sourceSignal)!;

    if (target == null) {
      for (const link of links.values()) {
        link.destroy();
      }
      links.clear();
    } else {
      const link = links.get(
        signalImpl(target as SignalLike<ValueType>) ?? target,
      );
      if (link != null) {
        link.destroy();
      }
    }

    if (links.size === 0) {
      gLinks.delete(sourceSignal);
    }
  }
}

/**
 * Get the count of active links.
 * If a source is provided, returns only links from that source.
 * If no source is provided, returns the total count of all links.
 *
 * @param source - Optional source signal to count links for
 * @returns The number of active links
 *
 * This counts exactly the links held by the registry described in `link()`'s
 * "Lifetime" section. While its source signal is reachable, a link never
 * drops out of this count through garbage collection alone — only
 * `destroy()`, `unlink()`, a cleared `{attach}` group, or destroying the
 * source/signal target does that, and each of those also releases the
 * link's subscriptions on the global queues. If a link becomes unreachable
 * *together with* its source instead (dropped, never explicitly destroyed),
 * this count is eventually corrected too — nondeterministically, but these
 * days including those subscriptions (MEM-001); see the `gLinkFinalizer`
 * comment above `link()`. That path is still a backstop, not a fifth
 * teardown route on par with the four explicit ones: it emits no DESTROY,
 * detaches from no group and cannot be scheduled or observed.
 */
export function getLinksCount(source?: SignalLike<any>): number {
  if (source == null) {
    return gLinksCount;
  }
  const sourceSignal = signalImpl(source);
  return sourceSignal != null ? (gLinks.get(sourceSignal)?.size ?? 0) : 0;
}
