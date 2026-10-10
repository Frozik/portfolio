import { assertNever } from '../assert/assertNever';
import type {
  IRpcCallMessage,
  TRpcContract,
  TRpcReplyMessage,
  TRpcRequest,
  TRpcResponse,
} from './rpc-protocol';
import { isRpcClientMessage } from './rpc-protocol';

export interface IRpcHandler<TRequest, TResponse> {
  handle(request: TRequest, signal: AbortSignal): TResponse | Promise<TResponse>;
  /** Buffers of the response handed over to the caller instead of copied. */
  transfer?(response: TResponse): readonly Transferable[];
}

export type TRpcHandlers<TContract extends TRpcContract<TContract>> = {
  readonly [Method in keyof TContract]: IRpcHandler<
    TRpcRequest<TContract, Method>,
    TRpcResponse<TContract, Method>
  >;
};

/** The part of a worker's global scope the server listens on. */
export interface IRpcScope {
  postMessage(message: unknown, options: { transfer: Transferable[] }): void;
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
}

/**
 * The worker half of a typed RPC: every call gets its own `AbortSignal`,
 * aborted by the client's cancel; an aborted call is not answered, the
 * client has settled it already. A thrown value that cannot be cloned is
 * answered with the `DataCloneError` instead, so every call settles.
 */
export function serveRpc<TContract extends TRpcContract<TContract>>(
  scope: IRpcScope,
  handlers: TRpcHandlers<TContract>
): void {
  const inFlight = new Map<number, AbortController>();
  const reply = (message: TRpcReplyMessage, transfer: readonly Transferable[] = []): void =>
    scope.postMessage(message, { transfer: [...transfer] });

  const replyThrown = (id: number, error: unknown): void => {
    try {
      reply({ kind: 'rpc-reply', id, outcome: 'threw', error });
    } catch (cloneError) {
      reply({ kind: 'rpc-reply', id, outcome: 'threw', error: cloneError });
    }
  };

  const run = async (call: IRpcCallMessage): Promise<void> => {
    const controller = new AbortController();
    inFlight.set(call.id, controller);
    try {
      const handler = findHandler(handlers, call.method);
      const response = await handler.handle(call.request, controller.signal);
      if (!controller.signal.aborted) {
        reply(
          { kind: 'rpc-reply', id: call.id, outcome: 'returned', response },
          handler.transfer?.(response)
        );
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        replyThrown(call.id, error);
      }
    } finally {
      inFlight.delete(call.id);
    }
  };

  scope.addEventListener('message', ({ data }) => {
    if (!isRpcClientMessage(data)) {
      return;
    }
    switch (data.kind) {
      case 'rpc-call':
        void run(data);
        return;
      case 'rpc-cancel':
        inFlight.get(data.id)?.abort();
        return;
      default:
        assertNever(data);
    }
  });
}

function findHandler<TContract extends TRpcContract<TContract>>(
  handlers: TRpcHandlers<TContract>,
  method: string
): IRpcHandler<unknown, unknown> {
  if (!Object.hasOwn(handlers, method)) {
    throw new Error(`Unknown RPC method "${method}"`);
  }
  return handlers[method as keyof TContract] as IRpcHandler<unknown, unknown>;
}
