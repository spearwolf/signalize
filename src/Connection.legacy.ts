import {
  emit,
  off,
  on,
  once,
  retain,
  UnsubscribeFunc,
} from '@spearwolf/eventize';
import {isSignal, signalImpl} from './createSignal.js';
import {globalDestroySignalQueue, globalSignalQueue} from './global-queues.js';
import {findObjectSignals} from './object-signals.js';
import type {ISignalImpl, SignalLike} from './types.js';

/**
 * global map of all connections per signal
 */
const gSignalConnections = new WeakMap<
  ISignalImpl<unknown>,
  Set<Connection<unknown>>
>();

export type ConnectionTargetType = object | Function;

/**
 * global map of all connections per object/function
 */
const gOtherConnections = new WeakMap<
  ConnectionTargetType,
  Set<Connection<unknown>>
>();

export type ConnectionFunction<T = unknown> = (val: T) => void;

type ObjectProperties<Obj, PropType> = {
  [Key in keyof Obj as Obj[Key] extends PropType ? Key : never]: unknown;
};

export type ConnectionObjectProperty<
  T,
  O extends object = never,
  K extends keyof ObjectProperties<O, T> = never,
> = [O, K];

export type ConnectionTarget<T> =
  | SignalLike<T>
  | ConnectionFunction<T>
  | ConnectionObjectProperty<T>;

const isFunction = (value: unknown): value is Function =>
  typeof value === 'function';

export enum ConnectionType {
  Signal = 'S',
  Function = 'F',
  Property = 'P',
}

const attachSignal = (con: Connection<any>, signal: ISignalImpl<any>) => {
  let connections = gSignalConnections.get(signal);
  if (connections) {
    connections.add(con);
  } else {
    connections = new Set([con]);
    gSignalConnections.set(signal, connections);
  }
};

const attachTarget = (con: Connection<any>, target: ConnectionTargetType) => {
  let connections = gOtherConnections.get(target);
  if (connections) {
    connections.add(con);
  } else {
    connections = new Set([con]);
    gOtherConnections.set(target, connections);
  }
};

const detachSignal = (con: Connection<any>, signal: ISignalImpl<any>) => {
  const connections = gSignalConnections.get(signal);
  if (connections) {
    connections.delete(con);
    if (connections.size === 0) {
      gSignalConnections.delete(signal);
    }
  }
};

const detachTarget = (
  connection: Connection<any>,
  target: ConnectionTargetType,
) => {
  const connections = gOtherConnections.get(target);
  if (connections) {
    connections.delete(connection);
    if (connections.size === 0) {
      gOtherConnections.delete(target);
    }
  }
};

export class Connection<T> {
  static Value = 'value';
  static Mute = 'mute';
  static Unmute = 'unmute';
  static Destroy = 'destroy';

  static findBySignal(
    signalLike: SignalLike<any>,
  ): Set<Connection<unknown>> | undefined {
    return gSignalConnections.get(signalImpl(signalLike));
  }

  static findByTarget(
    target: ConnectionTargetType,
  ): Connection<unknown>[] | undefined {
    const connections = gOtherConnections.get(target);
    return connections ? Array.from(connections) : undefined;
  }

  static findByObject<O extends object>(
    source: O,
  ): Connection<unknown>[] | undefined {
    const connections = new Set<Connection<unknown>>();

    const signals = findObjectSignals(source);
    if (signals) {
      for (const con of signals.flatMap((si) => {
        const connectionsBySignal = Connection.findBySignal(si);
        return connectionsBySignal ? Array.from(connectionsBySignal) : [];
      })) {
        connections.add(con);
      }
    }

    const connectionsByTarget = Connection.findByTarget(source);
    if (connectionsByTarget) {
      for (const con of connectionsByTarget) {
        connections.add(con);
      }
    }

    return connections.size > 0 ? Array.from(connections) : undefined;
  }

  static find<C>(
    source: SignalLike<C>,
    target: ConnectionTarget<C>,
  ): Connection<C> | undefined {
    const signalConnections = gSignalConnections.get(
      signalImpl(source) as ISignalImpl<unknown>,
    );
    if (signalConnections != null) {
      const connections = Array.from(signalConnections);
      let index = -1;
      if (isSignal(target)) {
        // signal
        const tsi = signalImpl(target);
        index = connections.findIndex((conn) => conn.#target === tsi);
      } else if (isFunction(target)) {
        // function
        index = connections.findIndex((conn) => conn.#target === target);
      } else {
        // object + property
        index = connections.findIndex((conn) => {
          if (conn.#type === ConnectionType.Property) {
            const connTarget = conn.#target as ConnectionObjectProperty<C>;
            return (
              connTarget[0] === (target as any)[0] &&
              connTarget[1] === (target as any)[1]
            );
          }
          return false;
        });
      }
      if (index >= 0) {
        return connections[index] as Connection<C>;
      }
    }
    return undefined;
  }

  #unsubscribe?: UnsubscribeFunc;

  #muted = false;

  get isMuted(): boolean {
    return this.#muted;
  }

  #source?: ISignalImpl<T>;
  #target?:
    | ISignalImpl<T>
    | ConnectionFunction<T>
    | ConnectionObjectProperty<T>;

  #type: ConnectionType;
  #connectionTarget?: ConnectionTargetType;

  constructor(
    source: SignalLike<T>,
    target: ConnectionTarget<T>,
    connectionTarget?: ConnectionTargetType,
  ) {
    const con = Connection.find(source, target);
    if (con != null) {
      return con;
    }

    retain(this, Connection.Value);

    this.#source = signalImpl(source);

    if (isSignal(target)) {
      this.#target = signalImpl<T>(target as SignalLike<T>);
      this.#type = ConnectionType.Signal;
    } else if (isFunction(target)) {
      this.#target = target as () => void;
      this.#type = ConnectionType.Function;
    } else {
      this.#target = target as any;
      this.#type = ConnectionType.Property;
    }

    this.#connectionTarget = connectionTarget;

    this.#unsubscribe = on(
      globalSignalQueue,
      this.#source.id,
      (_value, params) => {
        if (params?.touch === true) {
          this.touch();
        } else {
          this.#write(false);
        }
      },
    );

    once(globalDestroySignalQueue, this.#source.id, 'destroy', this);

    attachSignal(this, this.#source);

    if (connectionTarget) {
      attachTarget(this, connectionTarget);
    }

    this.touch();
  }

  nextValue(): Promise<T> {
    return new Promise((resolve, reject) => {
      // we can not just use 'once' here because the value is retained
      let valEmitCount = 0;
      const unsubscribe = [
        on(this, Connection.Value, (val) => {
          if (valEmitCount === 1) {
            unsubscribe.forEach((unsub) => {
              unsub();
            });
            resolve(val);
          } else {
            ++valEmitCount;
          }
        }),
        on(this, Connection.Destroy, () => {
          unsubscribe.forEach((unsub) => {
            unsub();
          });
          reject();
        }),
      ];
    });
  }

  #write(touch: boolean): Connection<T> {
    if (!this.#muted && !this.isDestroyed) {
      const {value} = this.#source;

      if (this.#type === ConnectionType.Signal) {
        (this.#target as ISignalImpl<T>).writer(
          value,
          touch ? {touch} : undefined,
        );
      } else if (this.#type === ConnectionType.Function) {
        (this.#target as (val: T) => void)(value);
      } else {
        const [obj, key] = this.#target as ConnectionObjectProperty<T>;
        (obj[key] as (val: T) => void)(value);
      }

      emit(this, Connection.Value, value);
    }
    return this;
  }

  touch(): Connection<T> {
    return this.#write(true);
  }

  mute(): Connection<T> {
    if (!this.isDestroyed && !this.#muted) {
      this.#muted = true;
      emit(this, Connection.Mute, this);
    }
    return this;
  }

  unmute(): Connection<T> {
    if (!this.isDestroyed && this.#muted) {
      this.#muted = false;
      emit(this, Connection.Unmute, this);
    }
    return this;
  }

  toggle(): boolean {
    if (!this.isDestroyed) {
      this.#muted = !this.#muted;
      emit(this, this.#muted ? Connection.Mute : Connection.Unmute, this);
    }
    return this.#muted;
  }

  destroy(): void {
    if (this.isDestroyed) return;

    emit(this, Connection.Destroy, this);
    off(this);
    detachSignal(this, this.#source);

    this.#unsubscribe?.();
    this.#unsubscribe = undefined;
    this.#source = undefined;
    this.#target = undefined;
    if (this.#connectionTarget != null) {
      detachTarget(this, this.#connectionTarget);
      this.#connectionTarget = undefined;
    }

    Object.freeze(this);
  }

  get isDestroyed(): boolean {
    return this.#unsubscribe == null;
  }

  hasTarget(target: ConnectionTargetType): boolean {
    return this.#connectionTarget === target;
  }
}
