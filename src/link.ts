import {once} from '@spearwolf/eventize';
import {DESTROY} from './constants.js';
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
// created on it — its callback closure, its target reference, both of its
// subscriptions on the global queues — stays reachable too, and letting go
// of the returned `SignalLink` and waiting for GC does not change that. The
// only ways out *while the source lives* are `destroy()`, `unlink()`, or a
// cleared `{attach}` group. Explicitly destroying the source (or a signal
// target) tears every link on it down the same way, fully — including their
// global-queue subscriptions.
//
// If a link and its source become unreachable *together* instead (the
// source was never `destroySignal()`d, just dropped along with every link
// on it), `gLinkFinalizer` below does eventually correct `getLinksCount()`
// to match — see that finalizer's comment for what that path does and does
// not clean up; it is not equivalent to the three explicit ways above.
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
// link itself becomes unreachable and corrects the counter. The `once(link,
// DESTROY, ...)` hook unregisters first on the explicit path, so a link that
// *is* destroyed is never double-counted here.
//
// This is bookkeeping for `getLinksCount()`, not a cleanup path (MEM-007):
// reaching this callback already required the link (and the strong entry in
// the inner `Map` above) to become unreachable, which — per that comment —
// only happens once its source signal is gone too. It corrects the *count*;
// it does not release anything. Both of the link's subscriptions on
// `globalSignalQueue`/`globalDestroySignalQueue` (see `SignalLink`'s
// constructor) are still registered when this fires, and stay registered
// for good — their closures go through a `WeakRef` (MEM-002), so once it
// derefs to `undefined` they are permanent no-ops, not gone. Measured: after
// 200 links are collected this way, `getSubscriptionCount(globalSignalQueue)`
// and `getSubscriptionCount(globalDestroySignalQueue)` both still read 200,
// unchanged from immediately before the collection.
const gLinkFinalizer = new FinalizationRegistry<void>(() => {
  if (gLinksCount > 0) {
    gLinksCount -= 1;
  }
});

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
 * garbage collection alone does not reclaim a link on a live source.
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
  gLinkFinalizer.register(newLink, undefined, newLink);

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
 * this count is eventually corrected too, but nondeterministically and
 * without releasing those subscriptions — see the `gLinkFinalizer` comment
 * above `link()`. That path is bookkeeping, not a fifth teardown route on
 * par with the four explicit ones.
 */
export function getLinksCount(source?: SignalLike<any>): number {
  if (source == null) {
    return gLinksCount;
  }
  const sourceSignal = signalImpl(source);
  return sourceSignal != null ? (gLinks.get(sourceSignal)?.size ?? 0) : 0;
}
