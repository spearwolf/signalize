import {Connection} from './Connection';
import {SignalReader} from './types';

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
