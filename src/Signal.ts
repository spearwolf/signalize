import {$signal} from './constants.js';
import {requireCreateEffect} from './effect-hook.js';
import {destroySignal} from './signal-core.js';
import {touch} from './touch.js';
import type {
  ISignalImpl,
  SignalLike,
  SignalReader,
  SignalWriter,
  ValueChangedCallback,
  VoidFunc,
} from './types.js';
import {value} from './value.js';

/**
 * The object `createSignal()` returns: a stored value, a tracked and an
 * untracked read, and the lifecycle operations that go with it.
 * `docs/api.md`, "Signals" → "Signal<T> instance".
 */
export class Signal<ValueType> implements SignalLike<ValueType> {
  readonly [$signal]: ISignalImpl<ValueType>;

  constructor(sig: ISignalImpl<ValueType>) {
    this[$signal] = sig;
  }

  /**
   * The tracked read, as a callable reader.
   *
   * Called inside a running effect, it registers this signal as a dependency;
   * called anywhere else it just returns the value. Use `value` for a read
   * that does neither. `beforeRead` and lazy-memo recompute: `docs/api.md`,
   * "Signals" → "createSignal<T>(initial?, params?)".
   */
  get get(): SignalReader<ValueType> {
    return this[$signal].reader;
  }

  /**
   * The write, as a callable writer.
   *
   * `set(value, params?)` stores a value, with params that name only
   * declared options; `set(factory, {lazy: true})` stores a factory,
   * evaluated on the next read — a bare `set(fn)` and `{lazy: true}` on a
   * plain value are both compile errors. `docs/api.md`, "Signals" →
   * "Signal<T> instance", "What the exactness costs, as a rule and not a
   * list".
   */
  get set(): SignalWriter<ValueType> {
    return this[$signal].writer;
  }

  /**
   * The untracked read, and its matching write.
   *
   * Use `get()` for the tracked read; for `{touch}` or `{lazy}` on a write,
   * use `set()` directly. `docs/api.md`, "Signals" → "Signal<T> instance".
   */
  get value(): ValueType {
    return value(this.get);
  }

  set value(val: ValueType) {
    this.set(val);
  }

  /**
   * Run `action` whenever this signal's value changes.
   *
   * `action` drives a static-deps effect, so it does **not** fire on
   * subscribe. The returned function is one way to unsubscribe; destroying
   * the signal is another, and so is the parent when `onChange()` runs
   * inside an effect body — wrap it in `hibernate()` for its own lifetime.
   *
   * The parameter is {@link ValueChangedCallback}: a plain value is a compile
   * error — from untyped JS, though, a non-function return just counts as
   * "no cleanup". An `async` callback is refused too — use `createEffect()`
   * for one whose cleanup must survive. `docs/api.md`, "Signals" →
   * "Signal<T> instance", `onChange(cb)`.
   *
   * @returns Unsubscribe function
   */
  onChange(action: ValueChangedCallback<ValueType>): VoidFunc {
    const {destroy} = requireCreateEffect()(() => {
      // The reader, not `.value`: the callback reads like every other reader,
      // so a `beforeRead` hook fires for it and a `{lazy: true}` memo
      // recomputes first. Static deps suppress subscribe-on-read for the whole
      // callback, so this registers no dependency of its own.
      return action(this.get());
    }, [this.get]);
    return destroy;
  }

  /**
   * Whether notifications are paused.
   *
   * A muted signal still **stores** what `set()` writes — only the
   * notification is withheld. See `muteSignal()` for the unmuting
   * behaviour.
   */
  get muted(): boolean {
    return this[$signal].muted;
  }

  set muted(mute: boolean) {
    this[$signal].muted = mute;
  }

  /**
   * `true` once this signal has been destroyed.
   *
   * It stays usable as a plain value container — `set()` stores, reads
   * return — it just no longer notifies. There is no way back; see
   * {@link destroySignal}.
   */
  get destroyed(): boolean {
    return this[$signal].destroyed;
  }

  /**
   * Notify every dependent without changing the value.
   *
   * The way to announce a mutation this library cannot see — a pushed array,
   * a changed object property. A muted or destroyed signal stays silent; this
   * is not a way around either state.
   */
  touch() {
    touch(this);
  }

  /**
   * Destroy this signal — an alias for `destroySignal(this)`.
   *
   * See {@link destroyed} for what is left afterwards, and `docs/api.md`,
   * "SignalGroup" for what leaving a group means for its name.
   */
  destroy() {
    destroySignal(this);
  }
}
