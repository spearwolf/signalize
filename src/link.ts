import {once} from '@spearwolf/eventize';
import {DESTROY} from './constants.js';
import {signalImpl} from './createSignal.js';
import {Signal} from './Signal.js';
import {
  SignalLink,
  SignalLinkToCallback,
  SignalLinkToSignal,
  ValueCallback,
} from './SignalLink.js';
import {ISignalImpl, SignalLike, SignalReader} from './types.js';

const gLinks = new Map<
  ISignalImpl<any>,
  Map<object | Function, SignalLink<any>>
>();

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
   * Attach the link to this group, so it will be destroyed when the group is destroyed
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
  const sourceSignal = signalImpl(source);
  let links: Map<object | Function, SignalLink<any>>;

  if (gLinks.has(sourceSignal)) {
    links = gLinks.get(sourceSignal)!;

    const _target = signalImpl(target as SignalLike<ValueType>) ?? target;
    if (links.has(_target)) {
      return links.get(_target);
    }
  } else {
    links = new Map<object | Function, SignalLink<any>>();
    gLinks.set(sourceSignal, links);
  }

  const targetSignal = signalImpl(target as SignalLike<ValueType>);
  const link =
    targetSignal != null
      ? new SignalLinkToSignal(source, targetSignal)
      : new SignalLinkToCallback(source, target as ValueCallback<ValueType>);

  const attachToGroup = options?.attach;
  if (attachToGroup) {
    link.attach(attachToGroup);
  }

  const _target = targetSignal ?? target;
  links.set(_target, link);

  once(link, DESTROY, () => {
    links.delete(_target);
    if (links.size === 0) {
      gLinks.delete(sourceSignal);
    }
  });

  return link;
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
  let counter = 0;
  if (source == null) {
    for (const links of gLinks.values()) {
      counter += links.size;
    }
  } else {
    const sourceSignal = signalImpl(source);
    if (gLinks.has(sourceSignal)) {
      counter = gLinks.get(sourceSignal)!.size;
    }
  }
  return counter;
}
