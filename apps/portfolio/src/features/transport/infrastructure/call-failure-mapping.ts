import { Code, ConnectError } from '@connectrpc/connect';
import {
  ExpressionErrorReason as WireReason,
  ExpressionErrorSchema,
} from '@frozik/proto/frozik/transport/v1/plot_pb';
import { traceIdOf } from '@frozik/transport/client/call-trace';

import type { CallFailure } from '../domain/call-failure';
import { CallFailedError } from '../domain/call-failure';
import type { ExpressionErrorReason } from '../domain/plot';

const REASONS: ReadonlyMap<WireReason, ExpressionErrorReason> = new Map([
  [WireReason.EMPTY, 'empty'],
  [WireReason.TOO_LONG, 'too-long'],
  [WireReason.TOO_DEEP, 'too-deep'],
  [WireReason.UNEXPECTED_CHARACTER, 'unexpected-character'],
  [WireReason.INVALID_NUMBER, 'invalid-number'],
  [WireReason.UNKNOWN_IDENTIFIER, 'unknown-identifier'],
  [WireReason.UNEXPECTED_TOKEN, 'unexpected-token'],
  [WireReason.UNEXPECTED_END, 'unexpected-end'],
]);

/** Translates a Connect error into the page's vocabulary, keeping the expression detail when there is one. */
export function toCallFailedError(error: unknown): CallFailedError {
  if (error instanceof CallFailedError) {
    return error;
  }
  return new CallFailedError({
    ...callFailureOf(ConnectError.from(error)),
    traceId: traceIdOf(error),
  });
}

function callFailureOf(error: ConnectError): CallFailure {
  const detail = error.findDetails(ExpressionErrorSchema)[0];
  if (detail !== undefined) {
    return {
      kind: 'expression',
      position: detail.position,
      reason: REASONS.get(detail.reason) ?? 'unknown',
    };
  }
  switch (error.code) {
    case Code.InvalidArgument:
    case Code.FailedPrecondition:
      return { kind: 'refused', message: error.rawMessage };
    case Code.ResourceExhausted:
      return { kind: 'quota', message: error.rawMessage };
    default:
      return { kind: 'unreachable', message: error.rawMessage };
  }
}
