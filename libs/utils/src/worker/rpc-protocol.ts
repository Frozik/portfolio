export interface IRpcMethod {
  readonly request: unknown;
  readonly response: unknown;
}

/** A worker's surface as data: `{ decode: { request: …; response: … } }`, shared by both halves. */
export type TRpcContract<TContract> = { readonly [Method in keyof TContract]: IRpcMethod };

export type TRpcMethodName<TContract> = keyof TContract & string;

export type TRpcRequest<
  TContract,
  Method extends keyof TContract,
> = TContract[Method] extends IRpcMethod ? TContract[Method]['request'] : never;

export type TRpcResponse<
  TContract,
  Method extends keyof TContract,
> = TContract[Method] extends IRpcMethod ? TContract[Method]['response'] : never;

export interface IRpcCallMessage {
  readonly kind: 'rpc-call';
  readonly id: number;
  readonly method: string;
  readonly request: unknown;
}

export interface IRpcCancelMessage {
  readonly kind: 'rpc-cancel';
  readonly id: number;
}

export type TRpcReplyMessage =
  | {
      readonly kind: 'rpc-reply';
      readonly id: number;
      readonly outcome: 'returned';
      readonly response: unknown;
    }
  | {
      readonly kind: 'rpc-reply';
      readonly id: number;
      readonly outcome: 'threw';
      readonly error: unknown;
    };

export type TRpcClientMessage = IRpcCallMessage | IRpcCancelMessage;

const CLIENT_MESSAGE_KINDS: ReadonlySet<unknown> = new Set(['rpc-call', 'rpc-cancel']);

export function isRpcClientMessage(data: unknown): data is TRpcClientMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    'kind' in data &&
    CLIENT_MESSAGE_KINDS.has(data.kind)
  );
}

export function isRpcReplyMessage(data: unknown): data is TRpcReplyMessage {
  return typeof data === 'object' && data !== null && 'kind' in data && data.kind === 'rpc-reply';
}
