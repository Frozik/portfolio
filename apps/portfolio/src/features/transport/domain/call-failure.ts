import type { ExpressionErrorReason } from './plot';

/** A call that reached the server and was answered with an error, or never reached it. */
export type CallFailure =
  | {
      readonly kind: 'expression';
      readonly position: number;
      readonly reason: ExpressionErrorReason;
    }
  | { readonly kind: 'refused'; readonly message: string }
  | { readonly kind: 'quota'; readonly message: string }
  | { readonly kind: 'unreachable'; readonly message: string };

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
