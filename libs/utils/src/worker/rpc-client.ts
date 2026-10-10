import type { TResult } from '../result/result';
import { err, ok } from '../result/result';
import type {
  TRpcContract,
  TRpcClientMessage,
  TRpcMethodName,
  TRpcRequest,
  TRpcResponse,
} from './rpc-protocol';
import { isRpcReplyMessage } from './rpc-protocol';

export type TRpcError =
  | { readonly kind: 'aborted' }
  | { readonly kind: 'not-sent'; readonly error: unknown }
  | { readonly kind: 'worker-crashed'; readonly reason: unknown }
  | { readonly kind: 'handler-threw'; readonly error: unknown }
  | { readonly kind: 'disposed' };

export interface IRpcCallOptions {
  readonly signal?: AbortSignal;
  readonly transfer?: readonly Transferable[];
}

export interface IRpcClient<TContract extends TRpcContract<TContract>> {
  call<Method extends TRpcMethodName<TContract>>(
    method: Method,
    request: TRpcRequest<TContract, Method>,
    options?: IRpcCallOptions
  ): Promise<TResult<TRpcResponse<TContract, Method>, TRpcError>>;
  /** Terminates the worker; every call still in flight settles with `disposed`. */
  dispose(): void;
}

/** The part of a `Worker` the client drives; a test passes an in-memory pair. */
export interface IRpcWorker {
  postMessage(message: unknown, transfer: Transferable[]): void;
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
  addEventListener(type: 'error' | 'messageerror', listener: (event: Event) => void): void;
  terminate(): void;
}

type TSettle = (result: TResult<unknown, TRpcError>) => void;

/**
 * The main-thread half of a typed worker RPC: calls are answered by id, an
 * aborted call settles at once and tells the server to abort its handler, and
 * a worker error settles everything in flight with `worker-crashed` — the
 * client is spent after that and the owner creates a new one. A request that
 * cannot be cloned settles with `not-sent`.
 */
export function createRpcClient<TContract extends TRpcContract<TContract>>(
  worker: IRpcWorker
): IRpcClient<TContract> {
  const pending = new Map<number, TSettle>();
  let nextId = 0;
  let terminal: TRpcError | null = null;

  const settleAll = (error: TRpcError): void => {
    if (terminal !== null) {
      return;
    }
    terminal = error;
    worker.terminate();
    for (const settle of pending.values()) {
      settle(err(error));
    }
    pending.clear();
  };
  const post = (message: TRpcClientMessage, transfer: readonly Transferable[] = []): void =>
    worker.postMessage(message, [...transfer]);

  worker.addEventListener('message', ({ data }) => {
    if (!isRpcReplyMessage(data)) {
      return;
    }
    const settle = pending.get(data.id);
    pending.delete(data.id);
    settle?.(
      data.outcome === 'returned'
        ? ok(data.response)
        : err({ kind: 'handler-threw', error: data.error })
    );
  });
  worker.addEventListener('error', event =>
    settleAll({ kind: 'worker-crashed', reason: crashReason(event) })
  );
  worker.addEventListener('messageerror', event =>
    settleAll({ kind: 'worker-crashed', reason: crashReason(event) })
  );

  return {
    call<Method extends TRpcMethodName<TContract>>(
      method: Method,
      request: TRpcRequest<TContract, Method>,
      { signal, transfer }: IRpcCallOptions = {}
    ): Promise<TResult<TRpcResponse<TContract, Method>, TRpcError>> {
      if (terminal !== null) {
        return Promise.resolve(err(terminal));
      }
      if (signal?.aborted === true) {
        return Promise.resolve(err({ kind: 'aborted' }));
      }
      const id = nextId++;
      return new Promise(resolve => {
        const onAbort = (): void => {
          if (pending.delete(id)) {
            post({ kind: 'rpc-cancel', id });
            resolve(err({ kind: 'aborted' }));
          }
        };
        pending.set(id, result => {
          signal?.removeEventListener('abort', onAbort);
          resolve(result as TResult<TRpcResponse<TContract, Method>, TRpcError>);
        });
        signal?.addEventListener('abort', onAbort, { once: true });
        try {
          post({ kind: 'rpc-call', id, method, request }, transfer);
        } catch (error) {
          pending.get(id)?.(err({ kind: 'not-sent', error }));
          pending.delete(id);
        }
      });
    },
    dispose(): void {
      settleAll({ kind: 'disposed' });
    },
  };
}

function crashReason(event: Event): unknown {
  return event instanceof ErrorEvent ? (event.error ?? event.message) : event;
}
