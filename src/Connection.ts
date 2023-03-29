import {Eventize, UnsubscribeFunc} from '@spearwolf/eventize';
import {queryObjectSignal} from '.';
import {getSignalInstance} from './createSignal';
import {globalDestroySignalQueue, globalSignalQueue} from './global-queues';
import {Signal, SignalReader} from './types';

const globalSignalConnections = new WeakMap<
  Signal<unknown>,
  Connection<unknown>[]
>();

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
    target: SignalReader<C>,
  ): Connection<C> | undefined {
    const connections = globalSignalConnections.get(
      getSignalInstance(source) as Signal<unknown>,
    );
    if (connections != null) {
      const targetSignal = getSignalInstance(target);
      const index = connections.findIndex(
        (conn) => conn.#target === targetSignal,
      );
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
  #target?: Signal<T>;

  // TODO Connection: allow to pass a function (or object plus method tuple) as target

  constructor(source: SignalReader<T>, target: SignalReader<T>) {
    const conn = Connection.findConnection(source, target);
    if (conn != null) {
      // eslint-disable-next-line no-constructor-return
      return conn;
    }

    super();

    this.retain(Connection.Value);

    this.#source = getSignalInstance(source);
    this.#target = getSignalInstance(target);

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
      this.#target.writer(value, touch ? {touch} : undefined);
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

export function connect<Type>(
  source: SignalReader<Type>,
  target: SignalReader<Type>,
): Connection<Type>;
export function connect<
  Object,
  Key extends keyof Object,
  Type extends Object[Key],
>(source: [Object, Key], target: SignalReader<Type>): Connection<Type>;
export function connect<
  Object,
  Key extends keyof Object,
  Type extends Object[Key],
>(source: SignalReader<Type>, target: [Object, Key]): Connection<Type>;
export function connect<
  SourceObject,
  TargetObject,
  SourceKey extends keyof SourceObject,
  TargetKey extends keyof TargetObject,
  Type extends SourceObject[SourceKey] & TargetObject[TargetKey],
>(
  source: [SourceObject, SourceKey],
  target: [TargetObject, TargetKey],
): Connection<Type>;
export function connect(source: any, target: any) {
  return new Connection(
    Array.isArray(source)
      ? queryObjectSignal(...(source as [any, any]))
      : source,
    Array.isArray(target)
      ? queryObjectSignal(...(target as [any, any]))
      : target,
  );
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
