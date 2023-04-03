import {Eventize, UnsubscribeFunc} from '@spearwolf/eventize';
import {getSignalInstance, isSignal} from './createSignal';
import {globalDestroySignalQueue, globalSignalQueue} from './global-queues';
import {Signal, SignalReader} from './types';

const globalSignalConnections = new WeakMap<
  Signal<unknown>,
  Connection<unknown>[]
>();

export type ConnectionFunction<T = unknown> = (val: T) => void;
export type ConnectionProperty<O = any, K extends keyof O = any> = [O, K];

export type ConnectionTarget<T> =
  | SignalReader<T>
  | ConnectionFunction<T>
  | ConnectionProperty;

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

  static #addToGlobalStore(conn: Connection<any>): void {
    if (!conn.isDestroyed) {
      const signal = conn.#source;
      const connections = globalSignalConnections.get(signal) ?? [];
      const index = connections.indexOf(conn);
      if (index < 0) {
        connections.push(conn);
        if (connections.length === 1) {
          globalSignalConnections.set(signal, connections);
        }
      }
    }
  }

  static #removeFromGlobalStore(conn: Connection<any>): void {
    if (!conn.isDestroyed) {
      const signal = conn.#source;
      const connections = globalSignalConnections.get(signal);
      if (connections) {
        const index = connections.indexOf(conn);
        if (index >= 0) {
          if (connections.length === 1) {
            globalSignalConnections.delete(signal);
          } else {
            connections.splice(index, 1);
          }
        }
      }
    }
  }

  // TODO findConnectionsByObject()
  // TODO findConnectionsBetween(source, target)

  static findConnectionsBySignal(
    signalReader: SignalReader<any>,
  ): Connection<unknown>[] | undefined {
    return globalSignalConnections
      .get(getSignalInstance(signalReader))
      ?.slice();
  }

  static findConnection<C>(
    source: SignalReader<C>,
    target: ConnectionTarget<C>,
  ): Connection<C> | undefined {
    const connections = globalSignalConnections.get(
      getSignalInstance(source) as Signal<unknown>,
    );
    if (connections != null) {
      let index = -1;
      if (isSignal(target)) {
        const targetSignal = getSignalInstance(target);
        index = connections.findIndex((conn) => conn.#target === targetSignal);
      } else if (isFunction(target)) {
        index = connections.findIndex((conn) => conn.#target === target);
      } else {
        index = connections.findIndex((conn) => {
          if (conn.#type === ConnectionType.Property) {
            return (
              (conn.#target as ConnectionProperty)[0] === target[0] &&
              (conn.#target as ConnectionProperty)[1] === target[1]
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

  #source?: Signal<T>;

  #target?: Signal<T> | ConnectionFunction<T> | ConnectionProperty;
  #type: ConnectionType;

  constructor(source: SignalReader<T>, target: ConnectionTarget<T>) {
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

    Connection.#addToGlobalStore(this);

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
        const [obj, key] = this.#target as ConnectionProperty;
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
      Connection.#removeFromGlobalStore(this);
      this.#unsubscribe?.();
      this.#unsubscribe = undefined;
      this.#source = undefined;
      this.#target = undefined;
    }
  }

  get isDestroyed(): boolean {
    return this.#unsubscribe == null;
  }
}

// TODO unconnect(sourceObject)
// TODO unconnect(sourceObject, targetObject)
// TODO unconnect([sourceObject, 'sourceProp'], [targetObject, 'targetProp'])

export function unconnect<T = unknown>(
  ...args:
    | [source: SignalReader<T>]
    | [source: SignalReader<T>, target: SignalReader<T>]
): void {
  if (args.length === 1) {
    Connection.findConnectionsBySignal(args[0])?.forEach((conn) => {
      conn.destroy();
    });
  } else {
    Connection.findConnection(...args)?.destroy();
  }
}
