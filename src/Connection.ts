import {Eventize, UnsubscribeFunc} from '@spearwolf/eventize';
import {getSignalInstance, isSignal} from './createSignal';
import {globalDestroySignalQueue, globalSignalQueue} from './global-queues';
import {queryObjectSignals} from './object-signals-and-effects';
import {Signal, SignalReader} from './types';

const globalSignalConnections = new WeakMap<
  Signal<unknown>,
  Set<Connection<unknown>>
>();

export type ConnectionTargetType = object | Function;

const globalConnectionTargets = new WeakMap<
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
  | SignalReader<T>
  | ConnectionFunction<T>
  | ConnectionProperty<T>;

const isFunction = (value: unknown): value is Function =>
  typeof value === 'function';

export enum ConnectionType {
  Signal = 'signal',
  Function = 'function',
  Property = 'property',
}

export class Connection<T> extends Eventize {
  static Value = 'value';
  static Mute = 'mute';
  static Unmute = 'unmute';
  static Destroy = 'destroy';

  static #attachToSignal(connection: Connection<any>): void {
    if (!connection.isDestroyed) {
      const signal = connection.#source;
      let connections = globalSignalConnections.get(signal);
      if (connections) {
        connections.add(connection);
      } else {
        connections = new Set([connection]);
        globalSignalConnections.set(signal, connections);
      }
    }
  }

  static #detachFromSignal(connection: Connection<any>): void {
    if (!connection.isDestroyed) {
      const signal = connection.#source;
      const connections = globalSignalConnections.get(signal);
      if (connections) {
        connections.delete(connection);
        if (connections.size === 0) {
          globalSignalConnections.delete(signal);
        }
      }
    }
  }

  static #attachToTarget(
    target: ConnectionTargetType,
    connection: Connection<any>,
  ): void {
    if (!connection.isDestroyed) {
      let connections = globalConnectionTargets.get(target);
      if (connections) {
        connections.add(connection);
      } else {
        connections = new Set([connection]);
        globalConnectionTargets.set(target, connections);
      }
    }
  }

  static #detachFromTarget(
    target: ConnectionTargetType,
    connection: Connection<any>,
  ): void {
    if (!connection.isDestroyed) {
      const connections = globalConnectionTargets.get(target);
      if (connections) {
        connections.delete(connection);
        if (connections.size === 0) {
          globalConnectionTargets.delete(target);
        }
      }
    }
  }

  static findConnectionsBySignal(
    signalReader: SignalReader<any>,
  ): Connection<unknown>[] | undefined {
    const connections = globalSignalConnections.get(
      getSignalInstance(signalReader),
    );
    return connections ? Array.from(connections) : undefined;
  }

  static findConnectionsByTarget(
    target: ConnectionTargetType,
  ): Connection<unknown>[] | undefined {
    const connections = globalConnectionTargets.get(target);
    return connections ? Array.from(connections) : undefined;
  }

  static findConnectionsByObject<O extends object>(
    source: O,
  ): Connection<unknown>[] | undefined {
    const connections = new Set<Connection<unknown>>();

    const signals = queryObjectSignals(source);
    if (signals) {
      for (const con of signals.flatMap(
        (sig) => Connection.findConnectionsBySignal(sig) ?? [],
      )) {
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

  // TODO findConnectionsBetween(source, target)
  //
  // static findConnectionsBetween<S extends object, T extends object>(
  //   source: S,
  //   target: T,
  // ): Connection<unknown>[] | undefined {
  //   const sourceConnections = Connection.findConnectionsByObject(source);
  //   const sourceSignals = queryObjectSignals(source);
  //   const targetConnections = Connection.findConnectionsByObject(target);
  //   const targetSignals = queryObjectSignals(target);
  //   if (sourceConnections) {
  //   }
  // }

  static findConnection<C>(
    source: SignalReader<C>,
    target: ConnectionTarget<C>,
  ): Connection<C> | undefined {
    const conSet = globalSignalConnections.get(
      getSignalInstance(source) as Signal<unknown>,
    );
    if (conSet != null) {
      const connections = Array.from(conSet);
      let index = -1;
      if (isSignal(target)) {
        const targetSignal = getSignalInstance(target);
        index = connections.findIndex((conn) => conn.#target === targetSignal);
      } else if (isFunction(target)) {
        index = connections.findIndex((conn) => conn.#target === target);
      } else {
        index = connections.findIndex((conn) => {
          if (conn.#type === ConnectionType.Property) {
            const connTarget = conn.#target as ConnectionProperty<C>;
            return connTarget[0] === target[0] && connTarget[1] === target[1];
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

  #source?: Signal<T>;

  #target?: Signal<T> | ConnectionFunction<T> | ConnectionProperty<T>;
  #connectionTarget?: ConnectionTargetType;

  #type: ConnectionType;

  constructor(
    source: SignalReader<T>,
    target: ConnectionTarget<T>,
    connectionTarget?: ConnectionTargetType,
  ) {
    const conn = Connection.findConnection(source, target);
    if (conn != null) {
      // eslint-disable-next-line no-constructor-return
      return conn;
    }

    super();

    this.retain(Connection.Value);

    this.#source = getSignalInstance(source);

    if (isSignal(target)) {
      this.#target = getSignalInstance(target) as Signal<T>;
      this.#type = ConnectionType.Signal;
    } else if (isFunction(target)) {
      this.#target = target as () => void;
      this.#type = ConnectionType.Function;
    } else {
      this.#target = target;
      this.#type = ConnectionType.Property;
    }

    this.#connectionTarget = connectionTarget;

    this.#unsubscribe = globalSignalQueue.on(
      this.#source.id,
      (_value, params) => {
        if (params?.touch === true) {
          this.touch();
        } else {
          this.#write(false);
        }
      },
    );

    globalDestroySignalQueue.once(this.#source.id, 'destroy', this);

    Connection.#attachToSignal(this);

    if (connectionTarget != null) {
      Connection.#attachToTarget(connectionTarget, this);
    }

    this.touch();
  }

  // TODO Connection<T>.nextValue(): Promise<T> - returns a promise that resolves with the next value

  #write(touch: boolean): Connection<T> {
    if (!this.#muted && !this.isDestroyed) {
      const {value} = this.#source;

      if (this.#type === ConnectionType.Signal) {
        (this.#target as Signal<T>).writer(value, touch ? {touch} : undefined);
      } else if (this.#type === ConnectionType.Function) {
        (this.#target as (val: T) => void)(value);
      } else {
        const [obj, key] = this.#target as ConnectionProperty<T>;
        (obj[key] as (val: T) => void)(value);
      }

      this.emit(Connection.Value, value);
    }
    return this;
  }

  touch(): Connection<T> {
    return this.#write(true);
  }

  mute(): Connection<T> {
    if (!this.#muted) {
      this.#muted = true;
      this.emit(Connection.Mute, this);
    }
    return this;
  }

  unmute(): Connection<T> {
    if (this.#muted) {
      this.#muted = false;
      this.emit(Connection.Unmute, this);
    }
    return this;
  }

  toggle(): boolean {
    this.#muted = !this.#muted;
    this.emit(this.#muted ? Connection.Mute : Connection.Unmute, this);
    return this.#muted;
  }

  destroy(): void {
    if (!this.isDestroyed) {
      this.emit(Connection.Destroy, this);
      this.off();
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
}
