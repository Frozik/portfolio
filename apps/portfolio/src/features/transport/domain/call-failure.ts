import type { ExpressionErrorReason } from './plot';

type CallFailureReason =
  | {
      readonly kind: 'expression';
      readonly position: number;
      readonly reason: ExpressionErrorReason;
    }
  | { readonly kind: 'refused'; readonly message: string }
  | { readonly kind: 'quota'; readonly message: string }
  | { readonly kind: 'unreachable'; readonly message: string };

/**
 * A call that reached the server and was answered with an error, or never
 * reached it. `traceId` finds the call in the server's log; a failure that
 * never became a call has none.
 */
export type CallFailure = CallFailureReason & { readonly traceId?: string };

export class CallFailedError extends Error {
  override readonly name = 'CallFailedError';

  constructor(readonly failure: CallFailure) {
    super(failure.kind === 'expression' ? `expression: ${failure.reason}` : failure.message);
  }
}

export function toCallFailure(error: unknown): CallFailure {
  if (error instanceof CallFailedError) {
    return error.failure;
  }
  return { kind: 'unreachable', message: error instanceof Error ? error.message : String(error) };
}
