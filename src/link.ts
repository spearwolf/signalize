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

// TODO add two-way binding option to link(src, trgt, {twoWay: true}) ?

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

// TODO add tests for unlink()

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
