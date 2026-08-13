import {
  assertEffectsCount,
  assertLinksCount,
  assertSignalsCount,
} from './__testing__/assert-helpers.js';
import {createSignal} from './create-signal.js';
import type {Effect} from './Effect.js';
import type {EffectImpl} from './EffectImpl.js';
// The three effect-surface tests import through the entry point on purpose:
// the re-export is half of the promise, and a module import would witness
// the signature while missing the delivery. The `hibernate`/`NonThenable`
// witness rides on the same reasoning.
import {
  createEffect,
  type EffectDeps,
  type EffectOptions,
  type EffectOptionsWithNameDeps,
  type EffectOptionsWithSignalDeps,
  hibernate,
  type NonThenable,
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

// @ts-expect-error `reportSignalizeError` is internal — the entry
// point publishes the subscribe function and nothing else. `stripInternal`
// keeps it out of `lib/signalize-error.d.ts`; this keeps it out of the entry
// point, which no other gate would notice.
// The alias needs a use, or `noUnusedLocals` reports it — and the obvious
// `export type {…}` is out: Biome's `noExportsInTest` forbids exporting from
// a spec. So it is consumed by an annotation in the reporter test below.
type _NoReporter = typeof import('./index.js').reportSignalizeError;

/**
 * The witness for every type-level promise the published surface makes.
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

  it('hands out Signal<unknown>, not Signal<any>, where the container cannot know the value type', () => {
    const groupHost = {};
    const group = SignalGroup.findOrCreate(groupHost);
    const objectHost: Record<string, unknown> = {};
    const map = new SignalAutoMap();

    group.attachSignalByName('theme', createSignal('dark'));
    storeAsObjectSignal(objectHost, 'theme', createSignal('dark'));
    map.get<string>('theme').set('dark');

    try {
      // @ts-expect-error a group holds heterogeneous signals and
      // cannot know what hides behind a name — `unknown`, not `any`.
      const fromGroup: string = group.signal('theme').value;

      // @ts-expect-error
      const fromObject: string = findObjectSignals(objectHost)[0].value;

      // @ts-expect-error
      const fromMap: string = [...map.signals()][0].value;

      // @ts-expect-error
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

  it('makes a bare SignalLike / SignalLink / ValueCallback annotation say what it carries', () => {
    const source = createSignal(1);
    const target = createSignal(0);
    const theLink = link(source, target);
    const seen: number[] = [];

    try {
      // @ts-expect-error `SignalLike` is `SignalLike<unknown>` now.
      const bare: SignalLike = source;
      const named: SignalLike<number> = source;

      // With `source` narrowed to `LinkSource`, `SignalLink<T>` carries
      // `Type` in covariant positions only, so a `SignalLink<number>` is a
      // `SignalLink<unknown>` again. The heterogeneity promise rides on the
      // next two lines instead.
      const bareLink: SignalLink = theLink;
      // @ts-expect-error …and it carries `unknown`, not `any`.
      const stillUnknown: string = bareLink.lastValue;
      const namedLink: SignalLink<number> = theLink;

      // @ts-expect-error `ValueCallback` is `ValueCallback<unknown>`.
      const bareCallback: ValueCallback = (v: number) => seen.push(v);
      const namedCallback: ValueCallback<number> = (v) => seen.push(v);

      // @ts-expect-error module-internal now, default
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

  it('gives the caller their own type back from attach/detach', () => {
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
      // @ts-expect-error the value type rides along, unerased.
      const wrongAttached: Signal<string> = group.attachSignal(source);
      // @ts-expect-error
      const wrongDetached: Signal<string> = group.detachSignal(source);
      // @ts-expect-error
      const wrongByName: Signal<string> = group.attachSignalByName('n', source);

      const attachedLink: SignalLink<number> = group.attachLink(theLink);
      const detachedLink: SignalLink<number> = group.detachLink(attachedLink);

      // The link pair needs the wrong-type form to be guarded at all:
      // `SignalLink<any>` — a return type that erases the value — is assignable to
      // `SignalLink<number>`, so the two lines above pass either way.
      // @ts-expect-error
      const wrongAttachedLink: SignalLink<string> = group.attachLink(theLink);
      // @ts-expect-error
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

  it('keeps the implementation layer out of the entry point and off the link', () => {
    const source = createSignal(1);
    const target = createSignal(0);
    const theLink = link(source, target);

    try {
      // The directive sits on a one-line type alias with an inline
      // `import('./index.js')` on purpose: it catches exactly one `TS2694`,
      // and a multi-line `import type {…}` would report at the specifier
      // line rather than at the statement the directive covers.
      // @ts-expect-error `ISignalImpl` is module-internal now — the
      // entry point does not hand the implementation layer out any more.
      type PublicImpl = import('./index.js').ISignalImpl<number>;
      const stillReachableInside: PublicImpl = signalImpl(source);

      const narrow: LinkSource<number> = theLink.source;

      // @ts-expect-error no writer on the narrow view.
      const writer = theLink.source.writer;
      // @ts-expect-error no reader either.
      const reader = theLink.source.reader;
      // @ts-expect-error and no way back to the Signal wrapper.
      const object = theLink.source.object;
      // @ts-expect-error nor to the lazy factory.
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

  it('takes a factory only where {lazy: true} says so', () => {
    const count = createSignal(0);

    // @ts-expect-error a bare factory has no overload to land on.
    // It used to compile, store the function as the value, and leave `.value`
    // claiming `number`.
    const lied = createSignal<number>(() => 42);

    // The two honest forms need no directive: the factory announces itself…
    const lazily = createSignal(() => 42, {lazy: true});
    // …or the signal really does hold a function, because `T` is one.
    const holdsAFunction = createSignal<() => number>(() => 42);

    try {
      // @ts-expect-error same lie on the writer side.
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

  it('leaves the value branch open to any params, variable or not', () => {
    // The discrimination sits on the *value* argument. For `createSignal` the
    // value branch puts no condition on its params at all; for `set` the only
    // condition is a statically `true` `lazy` — everything else
    // passes it, a variable, an explicit type argument and a wrapper's
    // pass-through argument alike. Not a directive test: this has to compile.
    // Put a wider `lazy` condition on the value overload of
    // `createSignal`/`SignalWriter` and every call below reports TS2769 —
    // which is exactly how a wider condition here breaks every caller.
    const params: SignalParams<number> = {};
    const fromVariable = createSignal(5, params);
    const withExplicitType = createSignal<number>(6, params);

    const make = <T>(v: T, p: SignalParams<T>) => createSignal(v, p);
    const wrapped = make(7, params);

    // Same on the writer side, including a params variable that holds a
    // `lazy` — `false` is a legal thing to say about a value write.
    const writerParams: SignalWriterParams<number> = {lazy: false};
    const written = createSignal(0);

    const writeThrough = <T>(sig: Signal<T>, v: T, p: SignalWriterParams<T>) =>
      sig.set(v, p);

    try {
      written.set(8, writerParams);
      written.set(9, {lazy: false});
      written.set(10, {...writerParams});
      written.set(11, {touch: true, compare: (a, b) => a === b});
      writeThrough(written, 12, writerParams);

      expect(fromVariable.get()).toBe(5);
      expect(withExplicitType.get()).toBe(6);
      expect(wrapped.get()).toBe(7);
      expect(written.get()).toBe(12);
      // The value type survives the overload — no widening to `unknown`:
      expect(fromVariable.value + 1).toBe(6);
    } finally {
      destroySignal(fromVariable, withExplicitType, wrapped, written);
    }
  });

  it('refuses a factory whose {lazy: true} is only statically boolean', () => {
    // `SignalParams<T>`/`SignalWriterParams<T>` declare `lazy?: boolean`, and
    // `boolean` is not a promise that the flag is `true`. The factory branch
    // therefore does not open for a variable of the published options type,
    // however it was initialised — the runtime would be lazy here, the
    // checker just cannot know it. This is the breaking edge of the rule.
    const lazyish: SignalParams<number> = {lazy: true};
    const writerLazyish: SignalWriterParams<number> = {lazy: true};

    // @ts-expect-error `lazy?: boolean` does not reach `{lazy: true}`.
    const refused = createSignal(() => 42, lazyish);

    // The two measured repairs. `{...lazyish}` is *not* one of them — a spread
    // keeps `lazy?: boolean` and reports TS2769 exactly as the variable does.
    const pinned = createSignal(() => 42, {lazy: true} as const);
    const annotated: SignalParams<number> & {lazy: true} = {lazy: true};
    const viaAnnotation = createSignal(() => 42, annotated);

    const count = createSignal(0);

    try {
      // @ts-expect-error same on the writer side.
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

  it('refuses a lazy flag on a value write', () => {
    const count = createSignal(0);
    const pinned = {lazy: true} as const;
    const annotated: SignalWriterParams<number> & {lazy: true} = {lazy: true};

    try {
      // @ts-expect-error a value is not a factory. This used to
      // compile, store 5 in `valueFn`, and leave the next read to die.
      count.set(5, {lazy: true});
      // @ts-expect-error pinning the literal changes nothing.
      count.set(5, pinned);
      // @ts-expect-error nor does annotating the variable.
      count.set(5, annotated);

      // The damage the type now prevents, from the runtime side:
      expect(() => count.get()).toThrow(TypeError);

      // A plain write repairs it — the lazy flag is cleared on the value path.
      count.set(6);
      expect(count.get()).toBe(6);
    } finally {
      destroySignal(count);
    }
  });

  it('keeps a stray key out of the value branch', () => {
    // The generic `P` that closes the branch for a statically true `lazy`
    // would otherwise take the excess property check with it: an inferred
    // type parameter is checked against its constraint, and freshness does
    // not survive that. The exactness clause on the params puts the check
    // back. It matters most for the typo it catches first — `lasy` is the
    // neighbour of the very flag this package is about, and `createSignal`
    // has always rejected both spellings.
    const count = createSignal(0);

    try {
      // @ts-expect-error `comapre` is not `compare`.
      count.set(5, {touch: true, comapre: (a: number, b: number) => a === b});
      // @ts-expect-error `lasy` is not `lazy` — the one typo that
      // would otherwise buy silence on the branch this package closes.
      count.set(6, {lasy: true, touch: true});

      // Both wrote their value; only the misspelled option did nothing.
      expect(count.get()).toBe(6);
    } finally {
      destroySignal(count);
    }
  });

  it('lets a params object with an index signature through', () => {
    // The other side of the exactness clause, and the reason it is guarded:
    // for a params type carrying an index signature `keyof P` *is* `string`
    // (or `number`, or `symbol`), so `Record<Exclude<keyof P, …>, never>`
    // would demand that every key be `never` and refuse a caller who did
    // nothing wrong — no stray key in sight. Not a directive test: these have
    // to compile. The guard is three branches and each one is witnessed
    // below, measured by deleting one branch at a time: without the `string`
    // branch `widened` and `asserted` report TS2769, without the `number`
    // branch `numeric` does, without the `symbol` branch `bySymbol` does.
    // Delete the guard outright and all five do — `loose` only holds that
    // last, blunter form of the rollback, because with a branch still present
    // the conditional stays deferred and `P` falls back to its constraint.
    //
    // The guard cannot buy a typo any silence, which is measured rather than
    // argued: a literal *can* carry an index signature — a computed key or
    // the spread of such a variable gives it one — and `set(5, {[k]: 1, lasy:
    // true})` is still TS2769, with the exactness clause deleted outright as
    // much as with it. The constraint check catches those on its own.
    const count = createSignal(0);
    const loose: {[k: string]: unknown} = {touch: true};
    const widened: SignalWriterParams<number> & Record<string, unknown> = {
      touch: true,
    };
    const asserted = {touch: true} as Record<string, any>;
    const numeric: {[k: number]: unknown} = {};
    const bySymbol: Record<symbol, unknown> = {};

    try {
      count.set(5, loose);
      count.set(6, widened);
      count.set(7, asserted);
      count.set(8, numeric);
      count.set(9, bySymbol);

      expect(count.get()).toBe(9);
    } finally {
      destroySignal(count);
    }
  });

  it('refuses a lazy flag on a value at construction', () => {
    // The constructor half of the promise `set()` carries above. All four of
    // these used to compile, put the value where the factory belongs, and
    // leave the first read to die with `TypeError: this.valueFn is not a
    // function` — the same damage, one call earlier.
    const pinned = {lazy: true} as const;
    const annotated: SignalParams<number> & {lazy: true} = {lazy: true};
    // Declared `boolean`, narrowed to `true` by control flow: the fourth
    // statically-true form, and the one that does not look like one.
    const flag: boolean = true;
    const cmpNum = (a: number, b: number) => a === b;

    // @ts-expect-error a value is not a factory.
    const lazySig = createSignal(5, {lazy: true});
    // @ts-expect-error pinning the literal changes nothing.
    const fromPinned = createSignal(5, pinned);
    // @ts-expect-error nor does annotating the variable.
    const fromAnnotated = createSignal(5, annotated);
    // @ts-expect-error nor does hiding the flag in a variable the
    // checker has already narrowed to `true`.
    const fromFlag = createSignal(5, {lazy: flag});

    // `undefined` is the one value that reaches the no-init overload, so that
    // overload carries the same clauses — otherwise it is the hole all four
    // forms above fall through. Only the stray-key half can be witnessed here:
    // `createSignal(undefined, {lazy: true})` is refused under
    // `strictNullChecks: true` alone, because with the flag off `undefined` is
    // assignable to `() => Type` and the call lands on the factory overload
    // instead. That half is witnessed in `smoke/dist-smoke.test.ts`.
    const stray = {label: 'x', compare: cmpNum};
    // @ts-expect-error a stray key is refused with no value too.
    const fromStray = createSignal(undefined, stray);

    try {
      // The damage the type now prevents, from the runtime side:
      expect(() => lazySig.get()).toThrow(TypeError);
      expect(() => fromPinned.get()).toThrow(TypeError);
      expect(() => fromAnnotated.get()).toThrow(TypeError);
      expect(() => fromFlag.get()).toThrow(TypeError);

      // A plain write repairs it here too — the lazy flag is cleared on the
      // value path.
      lazySig.set(6);
      expect(lazySig.get()).toBe(6);

      // The stray-key call did build a signal — the option was simply
      // ignored, which is precisely why the compiler has to be the one to
      // object.
      expect(fromStray.value).toBeUndefined();
    } finally {
      destroySignal(lazySig, fromPinned, fromAnnotated, fromFlag, fromStray);
    }
  });

  it('keeps a stray key out of createSignal params', () => {
    // Same trade the writer makes above, for the same reason: the generic `P`
    // that closes the branch for a statically true `lazy` takes the excess
    // property check with it, and the exactness clause puts it back. Without
    // the clause these two compile — with it they do not, and `createSignal`
    // keeps the typo protection it has always had.
    //
    // Both need a *valid* key beside the typo, or they witness the wrong
    // mechanism: a literal carrying nothing but stray keys is already refused
    // by freshness ("Object literal may only specify known properties"), which
    // the clause has nothing to do with. Not the weak-type check — generic
    // params gave that up, which is the other half of this trade. Both calls
    // stay on one line, too: the excess property error is reported at the
    // offending *key*, so a multi-line literal puts it out of the directive's
    // one-line reach.
    const cmp = (a: number, b: number) => a === b;

    // @ts-expect-error `lasy` is not `lazy` — the one typo that would
    // otherwise buy silence on the branch this package closes.
    const typoLazy = createSignal(5, {lasy: true, compare: cmp});
    // @ts-expect-error `comapre` is not `compare`.
    const typoCompare = createSignal(6, {comapre: cmp, lazy: false});

    try {
      // Both stored their value; only the misspelled option did nothing.
      expect(typoLazy.get()).toBe(5);
      expect(typoCompare.get()).toBe(6);
    } finally {
      destroySignal(typoLazy, typoCompare);
    }
  });

  it('lets a params object with an index signature through createSignal', () => {
    // The other side of the exactness clause, and the reason it needs a guard
    // in front of it: for a params type carrying an index signature `keyof P`
    // *is* `string` (or `number`, or `symbol`), so `Record<Exclude<keyof P,
    // …>, never>` would demand that every key be `never` and refuse a caller
    // with no stray key in sight. Not a directive test: these have to compile.
    //
    // Measured against the generated `.d.ts`, one guard branch deleted at a
    // time — the same result the `set()` twin above records: without the
    // `string` branch `fromWidened` and `fromAsserted` report TS2769, without
    // the `number` branch `fromNumeric` does, without the `symbol` branch
    // `fromSymbol` does. `fromLoose` only falls to the blunter rollback of
    // deleting the guard outright, because with any branch still in place the
    // conditional stays deferred and `P` falls back to its constraint. Delete
    // the exactness clause instead and the two typos above start compiling.
    const loose: {[k: string]: unknown} = {};
    const widened: SignalParams<number> & Record<string, unknown> = {};
    const asserted = {} as Record<string, any>;
    const numeric: {[k: number]: unknown} = {};
    const bySymbol: Record<symbol, unknown> = {};

    const fromLoose = createSignal(1, loose);
    const fromWidened = createSignal(2, widened);
    const fromAsserted = createSignal(3, asserted);
    const fromNumeric = createSignal(4, numeric);
    const fromSymbol = createSignal(5, bySymbol);

    try {
      expect([
        fromLoose.get(),
        fromWidened.get(),
        fromAsserted.get(),
        fromNumeric.get(),
        fromSymbol.get(),
      ]).toEqual([1, 2, 3, 4, 5]);
    } finally {
      destroySignal(
        fromLoose,
        fromWidened,
        fromAsserted,
        fromNumeric,
        fromSymbol,
      );
    }
  });

  it('types the onChange callback by what its return value means', () => {
    const sig = createSignal(1);
    const seen: number[] = [];
    const cleaned: number[] = [];

    // The two shapes the contract names. No directive: both must keep
    // compiling.
    const offVoid = sig.onChange((v) => {
      seen.push(v);
    });
    const offCleanup = sig.onChange((v) => () => {
      cleaned.push(v);
    });

    // Four more forms that keep compiling too. None of them carries a
    // directive, so all four have to compile — but only two would notice a
    // future narrowing. Tightening `ValueChangedCallback` to `(value: T) =>
    // VoidFunc` turns `offNullary` and `offWiderParam` red (TS2345, `void` is
    // not a `VoidFunc`) and leaves `offConditional` and `offAnyVariable`
    // green: `strictNullChecks: false` admits the `undefined` branch, and
    // `any` goes anywhere.
    const takeCleanup = true;
    const conditionalCleanup = () => cleaned.push(-1);
    const offConditional = sig.onChange((_v) =>
      takeCleanup ? conditionalCleanup : undefined,
    );

    let nullaryRuns = 0;
    const offNullary = sig.onChange(() => {
      nullaryRuns++;
    });

    const anyTyped: (v: number) => any = (v) => v;
    const offAnyVariable = sig.onChange(anyTyped);

    let widerRuns = 0;
    const widerParam: (v: unknown) => void = () => {
      widerRuns++;
    };
    const offWiderParam = sig.onChange(widerParam);

    // @ts-expect-error a returned value is not a cleanup. It used
    // to be swallowed by `any`; the runtime still ignores it.
    const offValue = sig.onChange((v) => v * 2);

    // @ts-expect-error `ValueChangedCallback` is synchronous, and
    // that is the whole reason this is refused — not because the resolved
    // return of an `async` callback goes unused. It doesn't:
    // EffectImpl#storeCleanupCallback() honors a cleanup arriving late from
    // a resolved promise the same way it honors a synchronous one.
    // createEffect() is the way to drive an `async` callback and keep that
    // cleanup; onChange()'s contract does not admit a pending value at all.
    const offAsync = sig.onChange(async (v) => {
      seen.push(v);
    });

    // A pre-typed callback that widened its return type is refused at the
    // argument (TS2345), not at the return expression (TS2322).
    const unknownCb: (v: number) => unknown = (v) => v;
    // @ts-expect-error
    const offUnknown = sig.onChange(unknownCb);

    try {
      sig.set(2);
      expect(seen).toEqual([2, 2]);
      expect(cleaned).toEqual([]);
      expect(nullaryRuns).toBe(1);
      expect(widerRuns).toBe(1);

      sig.set(3);
      expect(cleaned).toEqual([2, -1]);
      expect(nullaryRuns).toBe(2);
      expect(widerRuns).toBe(2);
    } finally {
      offVoid();
      offCleanup();
      offConditional();
      offNullary();
      offAnyVariable();
      offWiderParam();
      offValue();
      offAsync();
      offUnknown();
      destroySignal(sig);
    }
  });

  it('refuses an async callback in hibernate()', () => {
    const sig = createSignal(21);

    try {
      expect(() => {
        // @ts-expect-error the saved batch, quiet counter and effect
        // stack are restored by the `finally` at the first `await`, so
        // everything after it runs outside hibernation.
        hibernate(async () => sig.get());
      }).toThrow(TypeError);

      // The documented repair for a generic pass-through wrapper, which the
      // narrowing breaks the same way it breaks `beQuiet()`'s:
      const through = <T>(fn: () => NonThenable<T>): T => hibernate(fn);
      expect(through(() => sig.get())).toBe(21);
    } finally {
      destroySignal(sig);
    }
  });

  it('infers the zero-argument read from a SignalReader', () => {
    // The overload order on `SignalReader<T>` is load-bearing: the
    // parameter-less read must stay the last signature. The wrapper's
    // parameter is written as a call signature — a bare type parameter
    // (`<F>(fn: F) => F`) witnesses nothing.
    const asCallSignature =
      <Args extends unknown[], Result>(fn: (...args: Args) => Result) =>
      (...args: Args): Result =>
        fn(...args);

    const sig = createSignal(1);
    const read = asCallSignature(sig.get);
    const onValue = (_v: number) => {};

    try {
      const seen: number = read();

      // @ts-expect-error the inferred wrapper takes no argument.
      read(onValue);

      expect(seen).toBe(1);
    } finally {
      destroySignal(sig);
    }
  });

  it('types a link callback target from its source', () => {
    const source = createSignal(1);
    const target = createSignal(0);
    const seen: number[] = [];

    // No annotation and no directive: under `noImplicitAny` this used to be
    // TS7006, and `docs/api.md` carried the annotate-it workaround.
    const toCallback = link(source, (v) => {
      // @ts-expect-error `v` is `number`, not `any` — an `any`
      // would take this assignment in silence.
      const wrong: string = v;
      void wrong;
      seen.push(v);
    });

    // The signal half has to keep compiling — no directive.
    const toSignal: SignalLink<number> = link(source, target);
    const toReader: SignalLink<number> = link(source, target.get);

    // The measured cost of the split: a target whose static type is a union
    // mixing a callback with a signal reaches neither overload.
    const eitherOr = target as Signal<number> | ValueCallback<number>;
    // @ts-expect-error TS2769 — narrow it or split the call.
    link(source, eitherOr);

    try {
      // `target` and `target.get` share one registry key, so these are the
      // same link — two links on `source`, not three.
      expect(toReader).toBe(toSignal);

      source.set(2);
      expect(seen).toEqual([1, 2]);
      expect(target.value).toBe(2);
    } finally {
      toCallback.destroy();
      toSignal.destroy();
      destroySignal(source, target);
    }
  });

  it('reduces link() to its callback signature', () => {
    // Both `link()` overloads return the same type, so swapping them
    // compiles clean — it only shows where the overloaded type is reduced
    // to one signature, and that has to stay the callback one
    // (`pitfalls.md`, 17b).
    type LinkTarget = Parameters<typeof link>[1];

    const sig = createSignal(1);
    const target: LinkTarget = (value: unknown) => {
      void value;
    };
    const asCallback: ValueCallback<unknown> = target;

    // @ts-expect-error a signal is not a callback.
    const wrong: LinkTarget = sig;

    try {
      expect(typeof asCallback).toBe('function');
      expect(wrong).toBe(sig);
    } finally {
      destroySignal(sig);
    }
  });

  it('takes only string and symbol keys', () => {
    const map = new SignalAutoMap();
    const numericObj = {1: 'a'} as Record<number, string>;

    // @ts-expect-error `Extract<number, string | symbol>` is
    // `never`, which is what makes a numeric key unnameable here.
    const numeric = SignalAutoMap.fromProps(numericObj, [1]);

    try {
      map.update(new Map<string, unknown>([['a', 1]]));

      // @ts-expect-error a numeric key would land in a map whose
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

  it('attachEffect takes the wrapper and gives it back', () => {
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
      // @ts-expect-error a value that is neither shape stays out.
      group.attachEffect({});
    };

    try {
      // The positive half, and the one that catches a narrowing back to
      // `EffectImpl`: no directive, so it has to keep compiling.
      const back: Effect = group.attachEffect(effect);

      // @ts-expect-error what comes back is the caller's own type,
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

  it('types the two subscribe callbacks', () => {
    const seen: symbol[] = [];

    // No annotation and no directive: under `noImplicitAny` these two used
    // to be TS7006, which is the form `docs/api.md` shows.
    const unsubCreate = onCreateEffect((eff) => {
      seen.push(eff.id);
    });
    const unsubDestroy = onDestroyEffect((eff) => {
      seen.push(eff.id);
    });

    // @ts-expect-error the callback is handed a `FailingEffect`;
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

  it('publishes the diagnostics channel and its payload', () => {
    // Through the entry point, not the module: the re-export is half of what
    // this package promises, and `src/index.ts` carries a by-name list that
    // no step of `pnpm world` checks for completeness. Still true for the
    // type list; the value list gained a witness in Paket 5
    // (`index.public-surface.spec.ts`) and no longer qualifies.
    let seen: SignalizeErrorPayload | undefined;
    // The use that keeps `_NoReporter` alive for `noUnusedLocals`; the
    // directive on its declaration is the actual assertion.
    const noReporter: _NoReporter = undefined;

    // No annotation and no directive — the callback parameter is typed by the
    // signature alone. Priority in second place, as everywhere in this
    // library.
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
      // The multi-copy sentinel added a member to that union, and the entry point is what
      // publishes it — an annotation, so `tsc` is the one asserting here.
      const multipleInstances: SignalizeErrorPayload['source'] =
        'multiple-instances';
      // The ignored-option notice added the next one, the same way.
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

  it('names the option types at the call site', () => {
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

    // @ts-expect-error the wide form reaches no overload. Its
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
