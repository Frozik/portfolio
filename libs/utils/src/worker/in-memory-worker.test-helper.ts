import type { IRpcWorker } from './rpc-client';
import type { IRpcScope } from './rpc-server';

export interface IInMemoryWorkerPair {
  readonly worker: IRpcWorker;
  readonly scope: IRpcScope;
  readonly crash: (event: Event) => void;
  readonly isTerminated: () => boolean;
}

/** A worker and its global scope in one thread: messages are structured-cloned and buffers really transferred. */
export function createInMemoryWorkerPair(): IInMemoryWorkerPair {
  const toWorker = new EventTarget();
  const toClient = new EventTarget();
  let terminated = false;
  const deliver = (target: EventTarget, message: unknown, transfer: Transferable[]): void => {
    const data: unknown = structuredClone(message, { transfer });
    queueMicrotask(() => {
      if (!terminated) {
        target.dispatchEvent(new MessageEvent('message', { data }));
      }
    });
  };

  return {
    worker: {
      postMessage: (message, transfer) => deliver(toWorker, message, transfer),
      addEventListener: (type: string, listener: (event: MessageEvent) => void) =>
        toClient.addEventListener(type, listener as EventListener),
      terminate: () => {
        terminated = true;
      },
    },
    scope: {
      postMessage: (message, { transfer }) => deliver(toClient, message, transfer),
      addEventListener: (type, listener) =>
        toWorker.addEventListener(type, listener as EventListener),
    },
    crash: event => toClient.dispatchEvent(event),
    isTerminated: () => terminated,
  };
}
