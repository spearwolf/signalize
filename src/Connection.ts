import {
  emit,
  eventize,
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
const g_sigConnects = new WeakMap<
  ISignalImpl<unknown>,
  Set<Connection<unknown>>
>();

export type ConnectionTargetType = object | Function;

/**
 * global map of all connections per object/function
 */
const g_otherConnects = new WeakMap<
  ConnectionTargetType,
  Set<Connection<unknown>>
>();

export type ConnectionFunction<T = unknown> = (val: T) => void;

type ObjectProps<Obj, PropType> = {
  [Key in keyof Obj as Obj[Key] extends PropType ? Key : never]: unknown;
};

export type ConnectionProperty<
  T,
  O extends object = never,
  K extends keyof ObjectProps<O, T> = never,
> = [O, K];

export type ConnectionTarget<T> =
  | SignalLike<T>
  | ConnectionFunction<T>
  | ConnectionProperty<T>;

const isFunction = (value: unknown): value is Function =>
  typeof value === 'function';

export enum ConnectionType {
  Signal = 'signal',
  Function = 'function',
  Property = 'property',
}

export class Connection<T> {
  static Value = 'value';
  static Mute = 'mute';
  static Unmute = 'unmute';
  static Destroy = 'destroy';

  static #attachToSignal(connection: Connection<any>): void {
    if (!connection.isDestroyed) {
      const signal = connection.#source;
      let connections = g_sigConnects.get(signal);
      if (connections) {
        connections.add(connection);
      } else {
        connections = new Set([connection]);
        g_sigConnects.set(signal, connections);
      }
    }
  }

  static #detachFromSignal(connection: Connection<any>): void {
    if (!connection.isDestroyed) {
      const signal = connection.#source;
      const connections = g_sigConnects.get(signal);
      if (connections) {
        connections.delete(connection);
        if (connections.size === 0) {
          g_sigConnects.delete(signal);
        }
      }
    }
  }

  static #attachToTarget(
    target: ConnectionTargetType,
    connection: Connection<any>,
  ): void {
    if (!connection.isDestroyed) {
      let connections = g_otherConnects.get(target);
      if (connections) {
        connections.add(connection);
      } else {
        connections = new Set([connection]);
        g_otherConnects.set(target, connections);
      }
    }
  }

  static #detachFromTarget(
    target: ConnectionTargetType,
    connection: Connection<any>,
  ): void {
    if (!connection.isDestroyed) {
      const connections = g_otherConnects.get(target);
      if (connections) {
        connections.delete(connection);
        if (connections.size === 0) {
          g_otherConnects.delete(target);
        }
      }
    }
  }

  static findConnectionsBySignal(
    signalLike: SignalLike<any>,
  ): Set<Connection<unknown>> | undefined {
    return g_sigConnects.get(signalImpl(signalLike));
  }

  static findConnectionsByTarget(
    target: ConnectionTargetType,
  ): Connection<unknown>[] | undefined {
    const connections = g_otherConnects.get(target);
    return connections ? Array.from(connections) : undefined;
  }

  static findConnectionsByObject<O extends object>(
    source: O,
  ): Connection<unknown>[] | undefined {
    const connections = new Set<Connection<unknown>>();

    const signals = findObjectSignals(source);
    if (signals) {
      for (const con of signals.flatMap((sig) => {
        const connectionsBySignal = Connection.findConnectionsBySignal(sig);
        return connectionsBySignal ? Array.from(connectionsBySignal) : [];
      })) {
        connections.add(con);
      }
    }

    const connectionsByTarget = Connection.findConnectionsByTarget(source);
    if (connectionsByTarget) {
      for (const con of connectionsByTarget) {
        connections.add(con);
      }
    }

    return connections.size > 0 ? Array.from(connections) : undefined;
  }

  static findConnection<C>(
    source: SignalLike<C>,
    target: ConnectionTarget<C>,
  ): Connection<C> | undefined {
    const connectionsBySignal = g_sigConnects.get(
      signalImpl(source) as ISignalImpl<unknown>,
    );
    if (connectionsBySignal != null) {
      const connections = Array.from(connectionsBySignal);
      let index = -1;
      if (isSignal(target)) {
        const targetSignal = signalImpl(target);
        index = connections.findIndex((conn) => conn.#target === targetSignal);
      } else if (isFunction(target)) {
        index = connections.findIndex((conn) => conn.#target === target);
      } else {
        index = connections.findIndex((conn) => {
          if (conn.#type === ConnectionType.Property) {
            const connTarget = conn.#target as ConnectionProperty<C>;
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
  #target?: ISignalImpl<T> | ConnectionFunction<T> | ConnectionProperty<T>;

  #type: ConnectionType;
  #connectionTarget?: ConnectionTargetType;

  constructor(
    source: SignalLike<T>,
    target: ConnectionTarget<T>,
    connectionTarget?: ConnectionTargetType,
  ) {
    const conn = Connection.findConnection(source, target);
    if (conn != null) {
      return conn;
    }

    eventize(this);

    retain(this, Connection.Value);

    this.#source = signalImpl(source);

    if (isSignal(target)) {
      this.#target = signalImpl(target) as ISignalImpl<T>;
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

    Connection.#attachToSignal(this);

    if (connectionTarget != null) {
      Connection.#attachToTarget(connectionTarget, this);
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
        const [obj, key] = this.#target as ConnectionProperty<T>;
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
    if (!this.isDestroyed) {
      emit(this, Connection.Destroy, this);
      off(this);
      Connection.#detachFromSignal(this);
      this.#unsubscribe?.();
      this.#unsubscribe = undefined;
      this.#source = undefined;
      this.#target = undefined;
      if (this.#connectionTarget != null) {
        Connection.#detachFromTarget(this.#connectionTarget, this);
        this.#connectionTarget = undefined;
      }
    }
  }

  get isDestroyed(): boolean {
    return this.#unsubscribe == null;
  }

  hasTarget(target: ConnectionTargetType): boolean {
    return this.#connectionTarget === target;
  }
}
