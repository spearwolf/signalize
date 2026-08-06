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
// there is no need to iterate `gLinks` itself, and a WeakMap lets an orphaned
// link (never destroy()d, never attach()ed, no external references left)
// become collectible instead of pinned for the process lifetime (MEM-002).
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
 */
export function getLinksCount(source?: SignalLike<any>): number {
  if (source == null) {
    return gLinksCount;
  }
  const sourceSignal = signalImpl(source);
  return sourceSignal != null ? (gLinks.get(sourceSignal)?.size ?? 0) : 0;
}
