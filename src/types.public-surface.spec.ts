import {
  assertEffectsCount,
  assertLinksCount,
  assertSignalsCount,
} from './__testing__/assert-helpers.js';
import {createSignal} from './createSignal.js';
import type {Effect} from './Effect.js';
import type {EffectImpl} from './EffectImpl.js';
// The three effect-surface tests import through the entry point on purpose:
// the re-export is half of what API-002 and API-004 promise, and a module
// import would witness the signature while missing the delivery.
import {
  createEffect,
  type EffectDeps,
  type EffectOptions,
  type EffectOptionsWithNameDeps,
  type EffectOptionsWithSignalDeps,
  onCreateEffect,
  onDestroyEffect,
  onSignalizeError,
  type SignalizeErrorPayload,
  type SignalLikeDeps,
} from './index.js';
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
import type {
  ISignalImpl,
  LinkSource,
  SignalLike,
  SignalParams,
  SignalWriterParams,
} from './types.js';

// @ts-expect-error CONS-001: `reportSignalizeError` is internal — the entry
// point publishes the subscribe function and nothing else. `stripInternal`
// keeps it out of `lib/signalize-error.d.ts`; this keeps it out of the entry
// point, which no other gate would notice.
// The alias needs a use, or `noUnusedLocals` reports it — and the obvious
// `export type {…}` is out: Biome's `noExportsInTest` forbids exporting from
// a spec. So it is consumed by an annotation in the CONS-001 test below.
type _NoReporter = typeof import('./index.js').reportSignalizeError;

/**
 * The witness for TYPE-001, TYPE-002, TYPE-003, TYPE-005, API-001, API-002,
 * API-004 and CONS-001.
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
 *
 * One guard here runs the other way round: `leaves the value branch open to
 * any params` holds calls that must **keep** compiling, and its regression
 * proof is the mirror image — narrow the signature it names and the file
 * stops compiling.
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

      // API-007 gave this line back: with `source` narrowed to `LinkSource`,
      // `SignalLink<T>` carries `Type` in covariant positions only, so a
      // `SignalLink<number>` is a `SignalLink<unknown>` again. The TYPE-001
      // promise it used to witness now rides on the next two lines instead.
      const bareLink: SignalLink = theLink;
      // @ts-expect-error TYPE-001: …and it carries `unknown`, not `any`.
      const stillUnknown: string = bareLink.lastValue;
      const namedLink: SignalLink<number> = theLink;

      // @ts-expect-error TYPE-001: `ValueCallback` is `ValueCallback<unknown>`.
      const bareCallback: ValueCallback = (v: number) => seen.push(v);
      const namedCallback: ValueCallback<number> = (v) => seen.push(v);

      // @ts-expect-error TYPE-001: module-internal now (API-007), default
      // still `unknown`.
      const bareImpl: ISignalImpl = signalImpl(source);
      const namedImpl: ISignalImpl<number> = signalImpl(source);

      bareCallback(7);
      namedCallback(8);

      expect(bare).toBe(source);
      expect(named).toBe(source);
      expect(bareLink).toBe(theLink);
      expect(stillUnknown).toBe(theLink.lastValue);
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

  it('keeps the implementation layer out of the entry point and off the link (API-007)', () => {
    const source = createSignal(1);
    const target = createSignal(0);
    const theLink = link(source, target);

    try {
      // The directive sits on a one-line type alias with an inline
      // `import('./index.js')` on purpose: it catches exactly one `TS2694`,
      // and a multi-line `import type {…}` would report at the specifier
      // line rather than at the statement the directive covers.
      // @ts-expect-error API-007: `ISignalImpl` is module-internal now — the
      // entry point does not hand the implementation layer out any more.
      type PublicImpl = import('./index.js').ISignalImpl<number>;
      const stillReachableInside: PublicImpl = signalImpl(source);

      const narrow: LinkSource<number> = theLink.source;

      // @ts-expect-error API-007: no writer on the narrow view.
      const writer = theLink.source.writer;
      // @ts-expect-error API-007: no reader either.
      const reader = theLink.source.reader;
      // @ts-expect-error API-007: and no way back to the Signal wrapper.
      const object = theLink.source.object;
      // @ts-expect-error API-007: nor to the lazy factory.
      const valueFn = theLink.source.valueFn;

      const id: symbol = narrow.id;
      const val: number = narrow.value;
      const muted: boolean = narrow.muted;
      const gone: boolean = narrow.destroyed;

      expect(typeof id).toBe('symbol');
      expect(val).toBe(1);
      expect(muted).toBe(false);
      expect(gone).toBe(false);

      // What the rebuild does *not* do: the runtime object is untouched, it
      // is only typed down. `link.source` still *is* the implementation.
      expect(stillReachableInside).toBe(theLink.source);
      expect(typeof writer).toBe('function');
      expect(typeof reader).toBe('function');
      expect(object).toBe(source);
      // A non-lazy signal has no factory — expecting a function here would
      // be a red test.
      expect(valueFn).toBeUndefined();
    } finally {
      theLink.destroy();
      destroySignal(source, target);
    }
  });

  it('takes a factory only where {lazy: true} says so (TYPE-002)', () => {
    const count = createSignal(0);

    // @ts-expect-error TYPE-002: a bare factory has no overload to land on.
    // It used to compile, store the function as the value, and leave `.value`
    // claiming `number`.
    const lied = createSignal<number>(() => 42);

    // The two honest forms need no directive: the factory announces itself…
    const lazily = createSignal(() => 42, {lazy: true});
    // …or the signal really does hold a function, because `T` is one.
    const holdsAFunction = createSignal<() => number>(() => 42);

    try {
      // @ts-expect-error TYPE-002: same lie on the writer side.
      count.set(() => 7);

      count.set(() => 7, {lazy: true});

      expect(count.get()).toBe(7);
      expect(lazily.get()).toBe(42);
      expect(holdsAFunction.value()).toBe(42);
      // The one the directive above kept out of typed code, seen from the
      // runtime side: the function itself sits in the signal.
      expect(typeof lied.value).toBe('function');
    } finally {
      destroySignal(count, lied, lazily, holdsAFunction);
    }
  });

  it('leaves the value branch open to any params, variable or not (TYPE-002)', () => {
    // The discrimination sits on the *value* argument, so the value branch
    // puts no condition on its params at all — a variable, an explicit type
    // argument and a wrapper's pass-through argument all fit. Not a directive
    // test: this has to compile. Put a `lazy` condition back on the value
    // overload of `createSignal`/`SignalWriter` and every call below reports
    // TS2769 — which is exactly how the first two attempts at TYPE-002 broke.
    const params: SignalParams<number> = {};
    const fromVariable = createSignal(5, params);
    const withExplicitType = createSignal<number>(6, params);

    const make = <T>(v: T, p: SignalParams<T>) => createSignal(v, p);
    const wrapped = make(7, params);

    // Same on the writer side, including a params variable that holds a
    // `lazy` — `false` is a legal thing to say about a value write.
    const writerParams: SignalWriterParams<number> = {lazy: false};
    const written = createSignal(0);

    try {
      written.set(8, writerParams);

      expect(fromVariable.get()).toBe(5);
      expect(withExplicitType.get()).toBe(6);
      expect(wrapped.get()).toBe(7);
      expect(written.get()).toBe(8);
      // The value type survives the overload — no widening to `unknown`:
      expect(fromVariable.value + 1).toBe(6);
    } finally {
      destroySignal(fromVariable, withExplicitType, wrapped, written);
    }
  });

  it('refuses a factory whose {lazy: true} is only statically boolean (TYPE-002)', () => {
    // `SignalParams<T>`/`SignalWriterParams<T>` declare `lazy?: boolean`, and
    // `boolean` is not a promise that the flag is `true`. The factory branch
    // therefore does not open for a variable of the published options type,
    // however it was initialised — the runtime would be lazy here, the
    // checker just cannot know it. This is the breaking edge of TYPE-002.
    const lazyish: SignalParams<number> = {lazy: true};
    const writerLazyish: SignalWriterParams<number> = {lazy: true};

    // @ts-expect-error TYPE-002: `lazy?: boolean` does not reach `{lazy: true}`.
    const refused = createSignal(() => 42, lazyish);

    // The two measured repairs. `{...lazyish}` is *not* one of them — a spread
    // keeps `lazy?: boolean` and reports TS2769 exactly as the variable does.
    const pinned = createSignal(() => 42, {lazy: true} as const);
    const annotated: SignalParams<number> & {lazy: true} = {lazy: true};
    const viaAnnotation = createSignal(() => 42, annotated);

    const count = createSignal(0);

    try {
      // @ts-expect-error TYPE-002: same on the writer side.
      count.set(() => 7, writerLazyish);

      count.set(() => 7, {lazy: true});

      // Every one of them is lazy at runtime — including the refused call.
      // The directive keeps it out of typed code, it does not change what
      // the writer does with it.
      expect(refused.get()).toBe(42);
      expect(pinned.get()).toBe(42);
      expect(viaAnnotation.get()).toBe(42);
      expect(count.get()).toBe(7);
    } finally {
      destroySignal(refused, pinned, viaAnnotation, count);
    }
  });

  it('takes only string and symbol keys (TYPE-005)', () => {
    const map = new SignalAutoMap();
    const numericObj = {1: 'a'} as Record<number, string>;

    // @ts-expect-error TYPE-005: `Extract<number, string | symbol>` is
    // `never`, which is what makes a numeric key unnameable here.
    const numeric = SignalAutoMap.fromProps(numericObj, [1]);

    try {
      map.update(new Map<string, unknown>([['a', 1]]));

      // @ts-expect-error TYPE-005: a numeric key would land in a map whose
      // `keys()` promises `string | symbol`.
      map.update(new Map<number, unknown>([[1, 'x']]));

      // And there it is, the promise broken in plain sight — the string key
      // and the numeric one, side by side, out of a `keys()` typed
      // `string | symbol`:
      expect([...map.keys()]).toEqual(['a', 1]);
      expect([...numeric.keys()]).toEqual([1]);
    } finally {
      map.clear();
      numeric.clear();
    }
  });

  it('attachEffect takes the wrapper and gives it back (API-001)', () => {
    const host = {};
    const group = SignalGroup.findOrCreate(host);
    const effect = createEffect(() => {}, {autorun: false});

    // Declared, never called. `{}` carries no `[$effect]`, so the unwrapping
    // takes it for an instance, and `undefined.destroyed` is not truthy —
    // the guard lets it in and the next `clear()` dies with `TypeError:
    // effect.destroy is not a function`. Still true after this package: the
    // type is the whole defence here, which is why the call lives in type
    // position only. The runtime assertion below is there for
    // `noUnusedLocals`, nothing more.
    const rejected = () => {
      // @ts-expect-error API-001: a value that is neither shape stays out.
      group.attachEffect({});
    };

    try {
      // The positive half, and the one that catches a narrowing back to
      // `EffectImpl`: no directive, so it has to keep compiling.
      const back: Effect = group.attachEffect(effect);

      // @ts-expect-error API-001: what comes back is the caller's own type,
      // not the unwrapped instance — this catches a return flattened to `any`.
      const wrong: EffectImpl = group.attachEffect(effect);

      expect(back).toBe(effect);
      expect(wrong).toBe(effect);
      expect(typeof rejected).toBe('function');
    } finally {
      effect.destroy();
      SignalGroup.delete(host);
    }
  });

  it('types the two subscribe callbacks (API-002)', () => {
    const seen: symbol[] = [];

    // No annotation and no directive: under `noImplicitAny` these two used
    // to be TS7006, which is the form `docs/api.md` shows.
    const unsubCreate = onCreateEffect((eff) => {
      seen.push(eff.id);
    });
    const unsubDestroy = onDestroyEffect((eff) => {
      seen.push(eff.id);
    });

    // @ts-expect-error API-002: the callback is handed a `FailingEffect`;
    // a handler demanding more is refused — parameters are checked
    // contravariantly, and that is exactly what `(...args: unknown[])`
    // used to wave through.
    const unsubWide = onCreateEffect((eff: EffectImpl) => {
      void eff.callback;
    });

    // The second half of the signature — priority in second place — is a
    // behaviour promise, not a type one, and is guarded where behaviour
    // belongs: `onCreateEffect/onDestroyEffect deliver in priority order`
    // in `effects.spec.ts`.

    try {
      const effect = createEffect(() => {}, {autorun: false});
      effect.destroy();

      expect(seen).toHaveLength(2);
    } finally {
      unsubCreate();
      unsubDestroy();
      unsubWide();
    }
  });

  it('publishes the diagnostics channel and its payload (CONS-001)', () => {
    // Through the entry point, not the module: the re-export is half of what
    // this package promises, and `src/index.ts` carries a by-name list that
    // no step of `pnpm world` checks for completeness.
    let seen: SignalizeErrorPayload | undefined;
    // The use that keeps `_NoReporter` alive for `noUnusedLocals`; the
    // directive on its declaration is the actual assertion.
    const noReporter: _NoReporter = undefined;

    // No annotation and no directive — the callback parameter is typed by the
    // signature alone. Priority in second place, as everywhere in this
    // library (API-002).
    const unsubscribe = onSignalizeError((payload) => {
      seen = payload;
    }, 10);

    try {
      // The deprecated static is one of the eight call sites — nine counting
      // the effect-channel fallback in `EffectImpl`; using it here
      // keeps the witness on a real path rather than on the internal
      // reporter, which the entry point does not hand out (see `_NoReporter`).
      const host = {};
      SignalGroup.findOrCreate(host);
      SignalGroup.destroy(host);

      const level: 'error' | 'warn' = seen.level;
      const source: SignalizeErrorPayload['source'] = seen.source;
      // ARCH-001 added a member to that union, and the entry point is what
      // publishes it — an annotation, so `tsc` is the one asserting here.
      const multipleInstances: SignalizeErrorPayload['source'] =
        'multiple-instances';
      // API-009 added the next one, the same way and for the same reason.
      const ignoredOption: SignalizeErrorPayload['source'] = 'ignored-option';
      const message: string = seen.message;
      const error: unknown = seen.error;

      expect(level).toBe('warn');
      expect(source).toBe('deprecation');
      expect(message).toMatch(/SignalGroup\.destroy\(obj\) is deprecated/);
      // A notice carries no error — no `Error` is invented to fill the field.
      expect(error).toBeUndefined();
      expect(noReporter).toBeUndefined();
      expect(multipleInstances).toBe('multiple-instances');
      expect(ignoredOption).toBe('ignored-option');
    } finally {
      unsubscribe();
    }
  });

  it('names the option types at the call site (API-004)', () => {
    const host = {};
    const group = SignalGroup.findOrCreate(host);
    const source = createSignal(1);
    group.attachSignalByName('n', source);

    const narrow: EffectOptionsWithSignalDeps = {
      autorun: false,
      dependencies: [source],
    };
    const deps: SignalLikeDeps = [source];
    const wide: EffectOptions = {autorun: false};

    // The two name-carrying forms. A name is resolved through a group, so
    // `attach` is required here and optional in the two above — that is the
    // whole reason there are five names rather than two.
    const named: EffectOptionsWithNameDeps = {
      autorun: false,
      dependencies: ['n'],
      attach: host,
    };
    const wideDeps: EffectDeps = ['n'];

    const fromOptions = createEffect(() => {}, narrow);
    const fromDeps = createEffect(() => {}, deps, {autorun: false});
    const fromNamed = createEffect(() => {}, named);
    const fromWideDeps = createEffect(() => {}, wideDeps, {
      autorun: false,
      attach: host,
    });

    // @ts-expect-error API-004: the wide form reaches no overload. Its
    // `dependencies?: EffectDeps` may hold names while `attach` stays
    // optional — the one pairing the four overloads forbid, because a name
    // without a group throws at runtime. The repair is one of the two
    // narrow names above, not a fifth overload.
    const fromWide = createEffect(() => {}, wide);

    try {
      expect(
        [fromOptions, fromDeps, fromNamed, fromWideDeps, fromWide].every(
          Boolean,
        ),
      ).toBe(true);
    } finally {
      fromOptions.destroy();
      fromDeps.destroy();
      fromNamed.destroy();
      fromWideDeps.destroy();
      fromWide.destroy();
      SignalGroup.delete(host);
      destroySignal(source);
    }
  });
});
