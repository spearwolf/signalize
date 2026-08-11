import {
  assertEffectsCount,
  assertLinksCount,
  assertSignalsCount,
} from './__testing__/assert-helpers.js';
import {createSignal} from './createSignal.js';
import {link} from './link.js';
import {
  destroyObjectSignals,
  findObjectSignals,
  storeAsObjectSignal,
} from './object-signals.js';
import type {Signal} from './Signal.js';
import {SignalAutoMap} from './SignalAutoMap.js';
import {SignalGroup} from './SignalGroup.js';
import type {SignalLink, ValueCallback} from './SignalLink.js';
import {destroySignal, signalImpl} from './signal-core.js';
import type {ISignalImpl, SignalLike} from './types.js';

/**
 * The witness for TYPE-001 and TYPE-003.
 *
 * Everything this file guards is invisible to the rest of the gate: the
 * emitted JavaScript is unchanged, no other spec instantiates one of these
 * defaults where the difference bites, and `attw` reads module shape rather
 * than signatures. Without the `@ts-expect-error` lines below, a regression
 * back to `any` would pass `pnpm world` in full.
 *
 * `@ts-expect-error`, never `@ts-ignore`: a directive whose next line stops
 * failing is itself reported by `tsc`, which is what turns these comments
 * into a regression guard rather than decoration. They are checked by
 * `pnpm typecheck`, not by Vitest — the runtime assertions below exist so
 * the declarations are used (`noUnusedLocals`) and the values are real.
 */
describe('the published type surface', () => {
  beforeEach(() => {
    assertEffectsCount(0, 'beforeEach');
    assertSignalsCount(0, 'beforeEach');
    assertLinksCount(0, 'beforeEach');
    SignalGroup.clear();
  });

  afterEach(() => {
    SignalGroup.clear();
    assertEffectsCount(0, 'afterEach');
    assertSignalsCount(0, 'afterEach');
    assertLinksCount(0, 'afterEach');
  });

  it('hands out Signal<unknown>, not Signal<any>, where the container cannot know the value type (TYPE-001)', () => {
    const groupHost = {};
    const group = SignalGroup.findOrCreate(groupHost);
    const objectHost: Record<string, unknown> = {};
    const map = new SignalAutoMap();

    group.attachSignalByName('theme', createSignal('dark'));
    storeAsObjectSignal(objectHost, 'theme', createSignal('dark'));
    map.get<string>('theme').set('dark');

    try {
      // @ts-expect-error TYPE-001: a group holds heterogeneous signals and
      // cannot know what hides behind a name — `unknown`, not `any`.
      const fromGroup: string = group.signal('theme').value;

      // @ts-expect-error TYPE-001
      const fromObject: string = findObjectSignals(objectHost)[0].value;

      // @ts-expect-error TYPE-001
      const fromMap: string = [...map.signals()][0].value;

      // @ts-expect-error TYPE-001
      const fromEntries: string = [...map.entries()][0][1].value;

      // The repair is a type argument, not a cast:
      const declared: string = group.signal<string>('theme').value;

      expect([fromGroup, fromObject, fromMap, fromEntries, declared]).toEqual([
        'dark',
        'dark',
        'dark',
        'dark',
        'dark',
      ]);
    } finally {
      destroyObjectSignals(objectHost);
      map.clear();
      SignalGroup.delete(groupHost);
    }
  });

  it('makes a bare SignalLike / SignalLink / ValueCallback annotation say what it carries (TYPE-001)', () => {
    const source = createSignal(1);
    const target = createSignal(0);
    const theLink = link(source, target);
    const seen: number[] = [];

    try {
      // @ts-expect-error TYPE-001: `SignalLike` is `SignalLike<unknown>` now.
      const bare: SignalLike = source;
      const named: SignalLike<number> = source;

      // @ts-expect-error TYPE-001: `SignalLink` is `SignalLink<unknown>` now.
      const bareLink: SignalLink = theLink;
      const namedLink: SignalLink<number> = theLink;

      // @ts-expect-error TYPE-001: `ValueCallback` is `ValueCallback<unknown>`.
      const bareCallback: ValueCallback = (v: number) => seen.push(v);
      const namedCallback: ValueCallback<number> = (v) => seen.push(v);

      // @ts-expect-error TYPE-001: `ISignalImpl` is published through
      // `export type * from './types.js'`, so its default is public too.
      const bareImpl: ISignalImpl = signalImpl(source);
      const namedImpl: ISignalImpl<number> = signalImpl(source);

      bareCallback(7);
      namedCallback(8);

      expect(bare).toBe(source);
      expect(named).toBe(source);
      expect(bareLink).toBe(theLink);
      expect(namedLink).toBe(theLink);
      expect(bareImpl).toBe(namedImpl);
      expect(seen).toEqual([7, 8]);
    } finally {
      theLink.destroy();
      destroySignal(source, target);
    }
  });

  it('gives the caller their own type back from attach/detach (TYPE-003)', () => {
    const groupHost = {};
    const group = SignalGroup.findOrCreate(groupHost);
    const source = createSignal(1);
    const target = createSignal(0);
    const theLink = link(source, target);

    try {
      // Not `SignalLike<any>` — the argument type survives the round trip.
      // These three catch a return type flattened back to `SignalLike<any>`,
      // which lacks `get`/`set`/`value`…
      const attached: Signal<number> = group.attachSignal(source);
      const detached: Signal<number> = group.detachSignal(attached);
      const byName: Signal<number> = group.attachSignalByName('n', detached);

      // …and these three catch the other half of the same promise, which the
      // structural check above cannot see: a return type flattened to
      // `Signal<any>` would satisfy `Signal<number>` *and* `Signal<string>`.
      // @ts-expect-error TYPE-003: the value type rides along, unerased.
      const wrongAttached: Signal<string> = group.attachSignal(source);
      // @ts-expect-error TYPE-003
      const wrongDetached: Signal<string> = group.detachSignal(source);
      // @ts-expect-error TYPE-003
      const wrongByName: Signal<string> = group.attachSignalByName('n', source);

      const attachedLink: SignalLink<number> = group.attachLink(theLink);
      const detachedLink: SignalLink<number> = group.detachLink(attachedLink);

      // The link pair needs the wrong-type form to be guarded at all:
      // `SignalLink<any>` — the pre-TYPE-003 return type — is assignable to
      // `SignalLink<number>`, so the two lines above pass either way.
      // @ts-expect-error TYPE-003
      const wrongAttachedLink: SignalLink<string> = group.attachLink(theLink);
      // @ts-expect-error TYPE-003
      const wrongDetachedLink: SignalLink<string> = group.detachLink(theLink);

      // Calling it without a signal releases the name and is still legal —
      // which is why the return type is `S | undefined`.
      const released = group.attachSignalByName('n');

      expect(attached).toBe(source);
      expect(detached).toBe(source);
      expect(byName).toBe(source);
      expect(attachedLink).toBe(theLink);
      expect(detachedLink).toBe(theLink);
      expect(released).toBeUndefined();

      // Same objects — only the annotations above were a lie:
      expect(wrongAttached).toBe(source);
      expect(wrongDetached).toBe(source);
      expect(wrongByName).toBe(source);
      expect(wrongAttachedLink).toBe(theLink);
      expect(wrongDetachedLink).toBe(theLink);

      // The value type is still there, unerased:
      expect(attached.value + 1).toBe(2);
    } finally {
      theLink.destroy();
      destroySignal(source, target);
      SignalGroup.delete(groupHost);
    }
  });
});
