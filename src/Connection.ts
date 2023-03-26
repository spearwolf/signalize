import {UnsubscribeFunc} from '@spearwolf/eventize';
import {queryObjectSignal} from '.';
import {getSignal} from './createSignal';
import {globalDestroySignalQueue, globalSignalQueue} from './global-queues';
import {Signal, SignalReader} from './types';

const globalSignalConnections = new WeakMap<
  Signal<unknown>,
  Connection<unknown>[]
>();

export class Connection<T> {
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
    return globalSignalConnections.get(getSignal(signalReader))?.slice();
  }

  static findConnection<C>(
    source: SignalReader<C>,
    target: SignalReader<C>,
  ): Connection<C> | undefined {
    const connections = globalSignalConnections.get(
      getSignal(source) as Signal<unknown>,
    );
    if (connections != null) {
      const targetSignal = getSignal(target);
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

  constructor(source: SignalReader<T>, target: SignalReader<T>) {
    const conn = Connection.findConnection(source, target);
    if (conn != null) {
      // eslint-disable-next-line no-constructor-return
      return conn;
    }

    this.#source = getSignal(source);
    this.#target = getSignal(target);

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

  #write(touch: boolean): Connection<T> {
    if (!this.#muted && !this.isDestroyed) {
      this.#target.writer(this.#source.value, touch ? {touch} : undefined);
    }
    return this;
  }

  touch(): Connection<T> {
    return this.#write(true);
  }

  mute(): Connection<T> {
    this.#muted = true;
    return this;
  }

  unmute(): Connection<T> {
    this.#muted = false;
    return this;
  }

  toggle(): boolean {
    this.#muted = !this.#muted;
    return this.#muted;
  }

  destroy(): void {
    if (!this.isDestroyed) {
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
