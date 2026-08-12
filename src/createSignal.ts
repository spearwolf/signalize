import {$signal} from './constants.js';
import {requireCreateEffect} from './effect-hook.js';
import {Signal} from './Signal.js';
import {SignalGroup} from './SignalGroup.js';
import {
  incSignalsCount,
  isSignal,
  readSignal,
  signalImpl,
  writeSignal,
} from './signal-core.js';
import {reportSignalizeError} from './signalize-error.js';
import type {
  BeforeReadFunc,
  CompareFunc,
  ISignalImpl,
  SignalLike,
  SignalParams,
  SignalReader,
  SignalWriter,
  SignalWriterParams,
  ValueChangedCallback,
} from './types.js';
import {UniqIdGen} from './UniqIdGen.js';

const idCreator = new UniqIdGen('si');

// The three `SignalParams` keys the passthrough drops on the floor. `attach`
// is missing on purpose: it is applied behind the branch and works on both
// paths. The list is written out instead of derived from `Object.keys(params)`,
// and that is load bearing — `decorators.ts` hands its own options object
// straight to `createSignal()`, and the `name`/`readAsValue` in there are the
// decorator's own business, not dropped signal options. A derived list would
// report them and be wrong on the one call site this library makes itself.
//
// Kept honest by the trip wire below: a `SignalParams` key that is neither
// `attach` nor on this list fails `tsc` at `_checkPassthroughListCoversSignalParams`,
// not silently on the passthrough. Type-only — `declare const` erases on
// emit, so it costs nothing at runtime and nothing in the `.d.ts` (measured
// against `lib/createSignal.js` and `lib/createSignal.d.ts`, both after
// `pnpm compile`), and it needs no `export` to be checked: `tsc` evaluates a
// generic the moment it is referenced, whether or not the declaration using
// it is itself read afterwards.
const PASSTHROUGH_IGNORED_OPTIONS = ['lazy', 'compare', 'beforeRead'] as const;

type _AssertTrue<T extends true> = T;
type _PassthroughListCoversSignalParams =
  Exclude<
    keyof SignalParams<unknown>,
    (typeof PASSTHROUGH_IGNORED_OPTIONS)[number] | 'attach'
  > extends never
    ? true
    : [
        'PASSTHROUGH_IGNORED_OPTIONS is missing a SignalParams key — add it there if it is dropped on the passthrough, or to the Exclude<…> above if it is not (like attach)',
      ];
declare const _checkPassthroughListCoversSignalParams: _AssertTrue<_PassthroughListCoversSignalParams>;

let signalReaderCallbackDeprecationWarned = false;

// Module-private, so no `.d.ts` carries it and a deprecation tag here would
// reach no editor. The consumer-visible declaration of this same deprecation
// is the callback overload of `SignalReader` in `types.ts`, which does carry
// the tag.
function warnSignalReaderCallbackDeprecated(): void {
  if (signalReaderCallbackDeprecationWarned) return;
  signalReaderCallbackDeprecationWarned = true;
  reportSignalizeError({
    level: 'warn',
    source: 'deprecation',
    message:
      'signalReader(callback) is deprecated and will be removed in a future release. Use Signal.onChange(callback) instead — it returns an unsubscribe function for proper cleanup.',
  });
}

const createSignalReader = <Type>(
  signal: ISignalImpl<Type>,
): SignalReader<Type> => {
  const signalReader = (callback?: ValueChangedCallback<Type>) => {
    if (!signal.destroyed) {
      signal.beforeRead?.();
    }
    if (callback) {
      warnSignalReaderCallbackDeprecated();
      requireCreateEffect()(() => {
        if (!signal.destroyed) {
          readSignal(signal.id);
        }
        return callback(signal.value);
      }, [signalReader as SignalReader<Type>]);
    } else if (!signal.destroyed) {
      readSignal(signal.id);
    }
    return signal.value;
  };

  Object.defineProperty(signalReader, $signal, {
    value: signal,
  });

  return signalReader as SignalReader<Type>;
};

class SignalImpl<Type> implements ISignalImpl<Type> {
  id: symbol;

  lazy: boolean;

  get [$signal](): ISignalImpl<Type> {
    return this;
  }

  compare?: CompareFunc<Type>;
  beforeRead?: BeforeReadFunc;

  muted = false;
  destroyed = false;

  #value: Type | undefined = undefined;

  get value(): Type | undefined {
    if (this.lazy) {
      this.#value = this.valueFn();
      this.valueFn = undefined;
      this.lazy = false;
    }
    return this.#value;
  }

  set value(value: Type | undefined) {
    this.#value = value;
  }

  valueFn: () => Type | undefined;

  reader: SignalReader<Type>;

  writer: SignalWriter<Type> = (
    nextValue: Type | (() => Type),
    params?: SignalWriterParams<Type>,
  ) => {
    const lazy = params?.lazy ?? false;

    const compare = params?.compare ?? this.compare;
    const equals: CompareFunc<Type> =
      compare ?? ((a: Type, b: Type) => a === b);

    if (
      lazy !== this.lazy ||
      (lazy && nextValue !== this.valueFn) ||
      (!lazy && !equals(nextValue as Type, this.#value))
    ) {
      if (lazy) {
        this.#value = undefined;
        this.valueFn = nextValue as () => Type;
        this.lazy = true;
      } else {
        this.#value = nextValue as Type;
        this.valueFn = undefined;
        this.lazy = false;
      }
      if (!this.muted && !this.destroyed) {
        writeSignal(this.id, this.#value);
        return;
      }
    }

    const touch = params?.touch ?? false;

    if (touch && !this.muted && !this.destroyed) {
      writeSignal(this.id, this.#value, {touch: true});
    }
  };

  readonly object: Signal<Type>;

  constructor(lazy: boolean, initialValue?: Type | (() => Type) | undefined) {
    this.id = idCreator.make();

    incSignalsCount(this);

    this.lazy = lazy;

    if (this.lazy) {
      this.value = undefined;
      this.valueFn = initialValue as () => Type;
    } else {
      this.value = initialValue as Type;
      this.valueFn = undefined;
    }

    this.reader = createSignalReader(this);

    this.object = new Signal(this);
  }
}

/**
 * Create a new reactive signal from a factory, evaluated on the first read.
 *
 * `{lazy: true}` is required here, not optional, and it has to be statically
 * `true` — that is the whole mechanism. A bare `createSignal<T>(fn)` has no
 * overload to land on and is rejected instead of silently storing the
 * function as the value (TYPE-002).
 *
 * This overload is declared **first** so a factory call wins the inference:
 * `createSignal(() => 42, {lazy: true})` is a `Signal<number>`, not a
 * `Signal<() => number>`.
 *
 * A params *variable* typed `SignalParams<T>` does not fit — that type says
 * `lazy?: boolean`, which is not a promise that it is `true`. Write the
 * literal, pin it (`{lazy: true} as const`), or annotate the variable
 * `SignalParams<T> & {lazy: true}`. Spreading (`{...params}`) does *not*
 * help: the spread keeps `lazy?: boolean`.
 *
 * A `SignalReader<T>` — `sig.get` off an existing signal — is also a
 * `() => T`, so `createSignal(sig.get, {lazy: true})` type-checks against
 * this very overload (API-012). At runtime `isSignal()` recognises that same
 * reader and routes the call into the passthrough below instead of building
 * a new lazy signal from it: `sig.get` is not called as a factory, the
 * returned signal is `sig` itself, and the dropped options are reported the
 * same way the value overload's passthrough reports them.
 *
 * @param initialValue - Factory evaluated on the first read
 * @param params - Configuration, with a statically `true` `lazy`
 * @returns A Signal object with get/set methods
 */
export function createSignal<Type = unknown>(
  initialValue: () => Type,
  params: SignalParams<Type> & {lazy: true},
): Signal<Type>;
/**
 * Create a new reactive signal with no initial value.
 *
 * The signal holds `undefined` until the first write, and the type says so:
 * `createSignal<number>()` is a `Signal<number | undefined>`, so
 * `const n: number = sig.value` is a compile error rather than a runtime
 * `undefined` wearing a `number` label (API-013). Under
 * `strictNullChecks: false` the union collapses back to `Type` and nothing
 * about this changes — the promise only exists for consumers who asked for it.
 *
 * The parameter is `initialValue?: undefined` rather than absent because
 * `createSignal<T>(undefined, {attach: this})` is a real call — no value, but
 * a holder. `5` is not `undefined`, so this overload steals nothing from the
 * value overload below it.
 *
 * Without a type argument the result stays `Signal<unknown>`; `unknown |
 * undefined` *is* `unknown`.
 *
 * **Its params carry the same three clauses as the value overload below**, and
 * not for symmetry: without them this overload is the hole every one of them
 * falls through. `undefined` is the one value that reaches here, so
 * `createSignal(undefined, {lazy: true})` — a factory flag with no factory —
 * and `createSignal(undefined, someStrayOptions)` would be accepted while the
 * same params on a real value are refused. The first builds a signal whose
 * first read dies with `TypeError: this.valueFn is not a function`, which is
 * the damage the value overload's clause exists to prevent.
 *
 * A profile difference worth knowing when writing a witness for this:
 * `createSignal(undefined, {lazy: true})` is only refused under
 * `strictNullChecks: true`. With the flag off, `undefined` is assignable to
 * `() => Type` and the call lands on the factory overload above instead —
 * measured, both ways. The witness therefore lives in
 * `smoke/dist-smoke.test.ts`, which compiles as a consumer, not in `src/`.
 *
 * @param initialValue - Nothing, or an explicit `undefined`
 * @param params - Optional configuration (compare, beforeRead, attach), with
 *   no `lazy: true` and no key beyond `SignalParams<Type>`
 * @returns A Signal object with get/set methods, possibly holding `undefined`
 */
export function createSignal<
  Type = unknown,
  P extends SignalParams<Type> = SignalParams<Type>,
>(
  initialValue?: undefined,
  params?: P &
    (P['lazy'] extends true ? never : unknown) &
    (string extends keyof P
      ? unknown
      : number extends keyof P
        ? unknown
        : symbol extends keyof P
          ? unknown
          : Record<Exclude<keyof P, keyof SignalParams<Type>>, never>),
): Signal<Type | undefined>;
/**
 * Create a new reactive signal with an initial value.
 *
 * If passed an existing signal, that signal is returned and no new one is
 * created — which is also why nothing in `params` configures it. `attach` is
 * the single exception, because it is applied behind the branch and belongs
 * to both paths; `lazy`, `compare` and `beforeRead` are dropped, and every
 * such call reports the ones it was given through `onSignalizeError()` with
 * `source: 'ignored-option'` (API-012). The line worth keeping is the
 * branch, not the three names: an option that configures a *new* signal has
 * nothing to configure when no new signal is made, and that stays true as
 * the options change. The same call also reaches here through the factory
 * overload above: `createSignal(sig.get, {lazy: true})` compiles there,
 * because a `SignalReader<T>` is both a `SignalLike<T>` and the `() => T`
 * that overload asks for, and `isSignal()` still recognises the same object
 * at runtime and routes it into this same passthrough — reported the same
 * way.
 *
 * A function reaching this overload is stored **as the value** — which is
 * only possible when `Type` is itself a function type, either because it was
 * named (`createSignal<() => number>(fn)`) or because it was inferred from
 * the argument (`createSignal(fn)` is a `Signal<() => R>`).
 *
 * **The params carry the same three clauses `SignalWriter<T>` carries**, and
 * for the same reasons — this is the constructor half of BUG-014:
 *
 * - A statically `true` `lazy` is refused. A value is not a factory; the
 *   factory overload above is where `{lazy: true}` belongs. It used to
 *   compile, store the value where the factory belongs, and leave the first
 *   read to die with `TypeError: this.valueFn is not a function`. Four forms
 *   qualify as statically true: the literal, `{lazy: true} as const`, a
 *   variable annotated `SignalParams<T> & {lazy: true}`, and `{lazy: flag}`
 *   with `flag` already narrowed to `true` — a `const flag: boolean = true`
 *   does exactly that. A `SignalParams<T>` variable holding `{lazy: true}`
 *   still passes: `lazy?: boolean` is not a promise that it is `true`, and
 *   that boundary is TYPE-002. Spreading (`{...params}`) does not change it.
 * - A key `SignalParams<Type>` does not declare is refused outright. Inferring
 *   `P` from the argument is what makes the `lazy` clause possible at all, and
 *   it costs the excess property check on the way — a type parameter is
 *   checked against its constraint, and freshness does not survive that step.
 *   Without the `Record<Exclude<…>, never>` clause, `createSignal(5, {lasy:
 *   true, compare})` compiles. `lasy` buying silence on the very branch this
 *   signature exists to close is the worst trade available here.
 * - The index-signature guard in front of it exempts a params type whose
 *   `keyof P` *is* `string`, `number` or `symbol` — for those the exactness
 *   clause would demand every key be `never` and refuse a caller with no
 *   stray key in sight. A *pattern* index signature (`data-${string}`) is not
 *   exempt; no branch fires for it.
 *
 * **What it costs, as a rule rather than a list.** The clause tests the key
 * set of the params type the compiler infers for `P`, so what a call gets
 * depends on what that inference produces — three outcomes, all measured
 * against the generated `.d.ts`:
 *
 * - **It resolves to a concrete key set** → refused if that set holds a key
 *   `SignalParams<Type>` does not declare, required or optional, declared or
 *   inferred. Whether the type *also* shares keys with the options makes no
 *   difference: a *pattern* index key such as `data-${string}` survives
 *   `Exclude` whole, so its entire key set counts as beyond and it is refused
 *   although it shares nothing. Examples, not an exhaustive list: an interface
 *   extending `SignalParams<T>`; a variable whose inferred type carries a
 *   stray key; an annotated foreign type with an optional stray key; an
 *   intersection; a class instance with a field of its own; the rest object of
 *   a destructuring that kept a valid key; the pattern index key above.
 * - **It resolves to nothing testable** → refused outright, and no stray key
 *   is needed. That is a bare type parameter, which is exactly what a wrapper
 *   generic in its own params hands over (`<Q extends SignalParams<T>>(q: Q)
 *   => createSignal(5, q)`): `keyof Q` is unknown, the conditional stays
 *   deferred, and no argument is assignable to a deferred conditional.
 * - **It never gets that far**, because the argument does not satisfy `P`'s
 *   constraint → inference falls back to `SignalParams<Type>`, the clause goes
 *   vacuous, and the call is accepted. For an all-optional options type that
 *   means a params type with no key in common *and* no index signature. This
 *   is the second cost, and it runs the other way: TypeScript's weak-type
 *   check ("has no properties in common with") used to refuse precisely that
 *   shape, and generic params give it up, because an intersection is never
 *   weak. So `createSignal(5, {label: 'x'})` is still an error — through
 *   freshness, reported as "Object literal may only specify known properties"
 *   — while a *variable* typed `{label: string}` is accepted in silence and
 *   does nothing at runtime. `SignalWriter<T>` paid the same price for the
 *   same reason when it turned generic (BUG-014, package 3a); the loss is new
 *   for `createSignal` and shared by both from here on.
 *
 * A plain `string`, `number` or `symbol` index signature is exempt from the
 * first outcome — that is what the guard in front of the clause is for. The
 * repair for everything the first two outcomes refuse is to name the params
 * type: annotate the variable `SignalParams<T>`, assert it at the call site,
 * or — for the wrapper — drop the type parameter and type the argument
 * `SignalParams<T>`. A spread repairs none of them: it drops freshness, not
 * keys.
 *
 * **One gap, and it is structural.** Naming the type argument switches both
 * params conditions off: `createSignal<number>(5, {lazy: true})` still
 * compiles where `createSignal(5, {lazy: true})` does not. TypeScript has no
 * partial type argument inference — naming `Type` makes `P` fall back to its
 * default instead of being inferred from the argument, and a `P` that is not
 * inferred carries no information to test. The repair is to drop the type
 * argument; the value infers it anyway. Exactness is unaffected, because
 * freshness still applies there (`createSignal<number>(5, {lasy: true})`
 * remains an error).
 *
 * @param initialValue - Initial value, or an existing signal to pass through
 *   (every option but `attach` is then dropped and reported)
 * @param params - Optional configuration (compare, beforeRead, attach), with
 *   no `lazy: true` and no key beyond `SignalParams<Type>`
 * @returns A Signal object with get/set methods
 */
export function createSignal<
  Type = unknown,
  P extends SignalParams<Type> = SignalParams<Type>,
>(
  initialValue?: Type | SignalLike<Type>,
  params?: P &
    (P['lazy'] extends true ? never : unknown) &
    (string extends keyof P
      ? unknown
      : number extends keyof P
        ? unknown
        : symbol extends keyof P
          ? unknown
          : Record<Exclude<keyof P, keyof SignalParams<Type>>, never>),
): Signal<Type>;
export function createSignal<Type = unknown>(
  initialValue: Type | SignalLike<Type> | (() => Type) = undefined,
  params?: SignalParams<Type>,
): Signal<Type> {
  let signal!: ISignalImpl<Type>;

  if (isSignal(initialValue)) {
    // NOTE createSignal(otherSignal) returns otherSignal and does NOT create a new signal
    signal = signalImpl(initialValue as SignalLike<Type>);

    // API-012: the signal that comes back is the one that went in, so nothing
    // in `params` has anything to configure — `attach` below is the exception
    // and applies to both branches. Reported on every such call, not once per
    // process: this marks a misspelled call, not a lifecycle event, and the
    // module-level flag the deprecation notice above uses would also outlive
    // the test that installed it.
    const ignoredOptions = PASSTHROUGH_IGNORED_OPTIONS.filter(
      (key) => params?.[key] != null,
    );
    if (ignoredOptions.length > 0) {
      reportSignalizeError({
        level: 'warn',
        source: 'ignored-option',
        message: `createSignal(existingSignal, {${ignoredOptions.join(', ')}}) is a passthrough: it returns the signal that was passed in, so nothing in those braces is applied. Only {attach} works on this path. Configure the signal where it is created, or drop the options.`,
      });
    }
  } else {
    // === Create a new signal ===
    const lazy = params?.lazy ?? false;
    signal = new SignalImpl(lazy, initialValue) as ISignalImpl<Type>;
    signal.beforeRead = params?.beforeRead;
    signal.compare = params?.compare;
  }

  if (params?.attach != null) {
    SignalGroup.findOrCreate(params.attach).attachSignal(signal);
  }

  return signal.object;
}
