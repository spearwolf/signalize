import {getSubscriptionCount} from '@spearwolf/eventize';

import {getEffectsCount} from './createEffect';

import {globalDestroySignalQueue, globalEffectQueue} from './globalQueues';

export function assertEffectsCount(count: number) {
  expect(
    getEffectsCount(),
    `Number of active effects should be ${count} but is ${getEffectsCount()}`,
  ).toBe(count);
}

let g_initialEffectCount = 0;
let g_effectCount = 0;

export const saveEffectSubscriptionsCount = (initial?: boolean) => {
  g_effectCount = getSubscriptionCount(globalEffectQueue);
  if (initial) {
    g_initialEffectCount = g_effectCount;
  }
  return g_effectCount;
};

export function assertEffectSubscriptionsCountChange(deltaCount: number) {
  const beforeCount = g_effectCount - g_initialEffectCount;
  const count = saveEffectSubscriptionsCount() - g_initialEffectCount;
  expect(
    count,
    `Effect subscriptions count change delta should be ${deltaCount} but is ${
      count - beforeCount
    }`,
  ).toBe(beforeCount + g_initialEffectCount + deltaCount);
}

export function assertEffectSubscriptionsCount(count: number) {
  expect(
    count,
    `Effect subscriptions count should be ${count} but is ${
      getSubscriptionCount(globalEffectQueue) - g_initialEffectCount
    }`,
  ).toBe(getSubscriptionCount(globalEffectQueue) - g_initialEffectCount);
}

let g_initialSignalDestroySubscriptionsCount = 0;
let g_signalDestroySubscriptionsCount = 0;

export const saveSignalDestroySubscriptionsCount = (initial?: boolean) => {
  g_signalDestroySubscriptionsCount = getSubscriptionCount(
    globalDestroySignalQueue,
  );
  if (initial) {
    g_initialSignalDestroySubscriptionsCount =
      g_signalDestroySubscriptionsCount;
  }
  return g_signalDestroySubscriptionsCount;
};

export function assertSignalDestroySubscriptionsCountChange(
  deltaCount: number,
) {
  const beforeCount =
    g_signalDestroySubscriptionsCount -
    g_initialSignalDestroySubscriptionsCount;
  const count = saveSignalDestroySubscriptionsCount();
  expect(beforeCount + deltaCount).toBe(
    count - g_initialSignalDestroySubscriptionsCount,
  );
}

export function assertSignalDestroySubscriptionsCount(count: number) {
  expect(
    count,
    `Signal destroy subscriptions count should be ${count} but is ${
      getSubscriptionCount(globalDestroySignalQueue) -
      g_initialSignalDestroySubscriptionsCount
    }`,
  ).toBe(
    getSubscriptionCount(globalDestroySignalQueue) -
      g_initialSignalDestroySubscriptionsCount,
  );
}
