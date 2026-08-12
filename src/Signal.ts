import {$signal} from './constants.js';
import {requireCreateEffect} from './effect-hook.js';
import {destroySignal} from './signal-core.js';
import {touch} from './touch.js';
import type {
  ISignalImpl,
  SignalLike,
  SignalReader,
  SignalWriter,
  VoidFunc,
} from './types.js';
import {value} from './value.js';

export class Signal<ValueType> implements SignalLike<ValueType> {
  readonly [$signal]: ISignalImpl<ValueType>;

  constructor(sig: ISignalImpl<ValueType>) {
    this[$signal] = sig;
  }

  /**
   * The tracked read, as a callable reader.
   *
   * Called inside the body of a running effect, it registers this signal as a
   * dependency of that effect; called anywhere else it just returns the
   * value. A `beforeRead` hook given to `createSignal()` runs on every such
   * read — that hook is what makes a `{lazy: true}` memo recompute at the
   * read. Use `value` for a read that does neither.
   */
  get get(): SignalReader<ValueType> {
    return this[$signal].reader;
  }

  /**
   * The write, as a callable writer.
   *
   * `set(value, params?)` stores a value — with params that name only
   * declared options and never a statically `true` `lazy`, which belongs to
   * the other branch and is a compile error here; `set(factory, {lazy:
   * true})` stores a factory and evaluates it on the next read. The `lazy`
   * must be statically `true` — a bare `set(fn)` is a compile error rather
   * than a silent store-the-function. See {@link SignalWriter} for why the
   * discrimination sits on the value argument, and for the nine params
   * shapes those two conditions cost.
   */
  get set(): SignalWriter<ValueType> {
    return this[$signal].writer;
  }

  /**
   * The untracked read, and its matching write.
   *
   * Reading `.value` registers no dependency, even inside a running effect,
   * and a `beforeRead` hook does **not** fire for it — so a `{lazy: true}`
   * memo read this way answers with what its last recompute stored:
   * `undefined` while none has run, the previous value once a dependency has
   * changed. Use `get()` for the tracked read.
   *
   * Writing `.value` is shorthand for `set(val)` with no params: no
   * `{touch}`, no `{lazy}`. Pass those to `set()` directly.
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
   * The callback does **not** run when you subscribe: it drives an effect
   * with static dependencies, which does not autorun. The first call comes
   * with the first change.
   *
   * The returned function destroys that internal effect — that is the
   * unsubscribe. It is not the only thing that ends the subscription:
   * destroying the signal ends it, and so does the parent when `onChange()`
   * was called inside an effect body. The internal effect is a *child effect*
   * there, and dies with that parent — or with a group holding it — while
   * the returned handle was never called. `hibernate()` around the
   * `onChange()` call gives it back its own lifetime.
   *
   * Two things about the callback itself: an effect created inside it is a
   * *child effect* and is destroyed on the next change, before the callback
   * runs again — wrap the creation in `hibernate()` to keep it. And whatever
   * the callback returns is passed on as the effect's cleanup, so returning
   * a non-function value is allowed and simply ignored.
   *
   * @param action - Receives the new value on every change
   * @returns Unsubscribe function
   */
  onChange(action: (val: ValueType) => any): VoidFunc {
    const {destroy} = requireCreateEffect()(() => {
      return action(this.value);
    }, [this.get]);
    return destroy;
  }

  /**
   * Whether notifications are paused.
   *
   * A muted signal still **stores** what `set()` writes — only the
   * notification is withheld, so effects and `onChange()` callbacks stay
   * where they are. Even `set(val, {touch: true})` stays silent. Unmuting
   * replays nothing: changes made while muted are not announced afterwards,
   * and a listener that has to see the current value reads it or gets a
   * `touch()`.
   */
  get muted(): boolean {
    return this[$signal].muted;
  }

  set muted(mute: boolean) {
    this[$signal].muted = mute;
  }

  /**
   * Whether this signal has been destroyed.
   *
   * A destroyed signal stays usable as a plain value container — `set()`
   * stores, reads return — it just no longer notifies. There is no way
   * back; see `destroySignal()`.
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
   * Dependent effects lose their dependency, and the signal leaves the group
   * that held it, its name in that group included. What is left is a quiet
   * value container that still stores and still reads; see `destroyed`.
   */
  destroy() {
    destroySignal(this);
  }
}
