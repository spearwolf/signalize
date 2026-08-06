import {
  type EventizedObject,
  emit,
  eventize,
  off,
  on,
  once,
  retain,
  retainClear,
} from '@spearwolf/eventize';
import {DESTROY, MUTE, UNMUTE, VALUE} from './constants.js';
import {globalDestroySignalQueue, globalSignalQueue} from './global-queues.js';
import {SignalGroup} from './SignalGroup.js';
import {signalImpl} from './signal-core.js';
import {ISignalImpl, SignalLike} from './types.js';

export type ValueCallback<ValueType = any> = (value: ValueType) => void;

// Eventize injects EventizedObject members at runtime via eventize(this) in
// the constructor — declaration merging tells TS the brand is present.
// biome-ignore lint/correctness/noUnusedVariables: declaration merging requires the same type-parameter name as the class
export interface SignalLink<ValueType = any> extends EventizedObject {}

export abstract class SignalLink<ValueType = any> {
  #muted = false;
  #unsubscribe?: () => void;
  #attachedGroups?: Set<SignalGroup>;

  readonly source: ISignalImpl<ValueType>;

  lastValue?: ValueType;

  isDestroyed = false;

  constructor(source: SignalLike<ValueType>) {
    eventize(this);

    this.source = signalImpl(source);

    // Weak self-reference (MEM-002): these two callbacks subscribe on
    // module-level global queues that live for the whole process. A plain
    // `this` closure here would keep the link (and everything it reaches —
    // the source signal, the target, a callback's closure) permanently
    // reachable, even after every external reference to the link is
    // dropped and `gLinks` no longer pins it. Going through a WeakRef lets
    // an orphaned link (never destroy()d, never attach()ed) become
    // collectible; once collected, the dereffed callbacks are silent no-ops.
    const selfRef = new WeakRef(this);

    this.#unsubscribe = on(globalSignalQueue, this.source.id, (_, params) => {
      const self = selfRef.deref();
      if (self != null && !self.#muted && !self.isDestroyed) {
        if (params?.touch === true) {
          self.touch();
        } else {
          self.write();
        }
      }
    });

    once(globalDestroySignalQueue, this.source.id, () =>
      selfRef.deref()?.destroy(),
    );
  }

  attach(to: object) {
    const group = SignalGroup.findOrCreate(to);

    // `group.attachLink()` runs on every call, unconditionally — it's an
    // idempotent `Set.add`, it's what actually (re-)establishes membership,
    // and it must run (and throw, for a destroyed link) before anything
    // touches `#attachedGroups` below. Skipping it on a re-attach is exactly
    // the bug this used to have: `SignalGroup.detachLink()` (public API) can
    // remove the link from the group without destroying it or clearing the
    // guard, so a later `attach(sameGroup)` needs to actually re-add it, not
    // just see "already known" and return early.
    group.attachLink(this);

    // The `once(this, DESTROY, ...)` subscription below, unlike
    // `attachLink()`, is *not* deduplicated by eventize (a plain function
    // listener isn't recognized as "similar" to a previous one) — so it
    // still needs its own guard, or re-attaching the same group (e.g. on
    // every `link()` cache hit that passes `{attach}`) would grow the
    // link's DESTROY listener list without bound.
    this.#attachedGroups ??= new Set();
    if (this.#attachedGroups.has(group)) {
      return group;
    }
    this.#attachedGroups.add(group);

    once(this, DESTROY, () => {
      group.detachLink(this);
    });
    return group;
  }

  nextValue(): Promise<ValueType> {
    return new Promise((resolve, reject) => {
      const subscriptions: (() => void)[] = [];
      const unsubscribe = () =>
        subscriptions.forEach((unsub) => {
          unsub();
        });

      subscriptions.push(
        // we can not just use 'once' here because the value is retained
        once(this, VALUE, (val) => {
          unsubscribe();
          resolve(val);
        }),
        once(this, DESTROY, () => {
          unsubscribe();
          reject();
        }),
      );
    });
  }

  async *asyncValues(
    stopAction?: (value: ValueType, index: number) => boolean,
  ) {
    retain(this, VALUE);
    try {
      let i = 0;
      while (!this.isDestroyed) {
        try {
          const next = await this.nextValue();
          if (stopAction?.(next, i++)) break;
          yield next;
        } catch {
          break;
        }
      }
    } finally {
      retainClear(this, VALUE);
    }
  }

  destroy() {
    if (this.isDestroyed) return;

    this.#unsubscribe?.();
    this.#unsubscribe = undefined;

    emit(this, DESTROY, this);
    retainClear(this, VALUE);
    off(this);

    this.lastValue = undefined;

    this.isDestroyed = true;

    Object.freeze(this);
  }

  get isMuted(): boolean {
    return this.#muted;
  }

  mute(): this {
    if (!this.isDestroyed && !this.#muted) {
      this.#muted = true;
      emit(this, MUTE, this);
    }
    return this;
  }

  unmute(): this {
    if (!this.isDestroyed && this.#muted) {
      this.#muted = false;
      emit(this, UNMUTE, this);
    }
    return this;
  }

  toggleMute(): boolean {
    if (!this.isDestroyed) {
      this.#muted = !this.#muted;
      emit(this, this.#muted ? MUTE : UNMUTE, this);
    }
    return this.#muted;
  }

  abstract touch(): this;
  protected abstract write(): void;

  protected updateValue(action: (value: ValueType) => void) {
    if (!this.#muted && !this.isDestroyed) {
      const {value} = this.source;
      action(value);
      emit(this, VALUE, value);
      this.lastValue = value;
    }
  }
}

export class SignalLinkToSignal<ValueType = any> extends SignalLink<ValueType> {
  readonly target: ISignalImpl<ValueType>;

  constructor(source: SignalLike<ValueType>, target: SignalLike<ValueType>) {
    super(source);
    this.target = signalImpl(target);
    // Weak self-reference, same reasoning as the base constructor
    // (MEM-002): `globalDestroySignalQueue` is a permanent module-level
    // root, so a plain `this` closure here would pin this link — and
    // through it `source`/`target` — for the process lifetime, same as the
    // base class's two subscriptions did before they were fixed.
    const selfRef = new WeakRef(this);
    once(globalDestroySignalQueue, this.target.id, () =>
      selfRef.deref()?.destroy(),
    );
    this.touch();
  }

  touch(): this {
    this.updateValue((value) => {
      this.target.writer(value, {touch: true});
    });
    return this;
  }

  protected write() {
    this.updateValue((value) => {
      this.target.writer(value);
    });
  }
}

export class SignalLinkToCallback<
  ValueType = any,
> extends SignalLink<ValueType> {
  readonly target: ValueCallback<ValueType>;

  constructor(source: SignalLike<ValueType>, target: ValueCallback<ValueType>) {
    super(source);
    this.target = target;
    this.touch();
  }

  touch() {
    this.updateValue((value) => {
      this.target(value);
    });
    return this;
  }

  protected write() {
    this.updateValue((value) => {
      this.target(value);
    });
  }
}
