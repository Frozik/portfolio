import type { ServiceImpl } from '@connectrpc/connect';
import { Code, ConnectError } from '@connectrpc/connect';
import type { PlotService } from '@frozik/proto/frozik/transport/v1/plot_pb';
import {
  ExpressionErrorReason,
  ExpressionErrorSchema,
} from '@frozik/proto/frozik/transport/v1/plot_pb';
import { assertNever } from '@frozik/utils/assert/assertNever';

import type { PlotFailure, PlotLimits } from '../../application/transport/samplePlot';
import { samplePlot } from '../../application/transport/samplePlot';
import type { ExpressionErrorReason as DomainReason } from '../../domain/expression/expression-error';

export function createPlotService(limits: PlotLimits): ServiceImpl<typeof PlotService> {
  return {
    getPlotLimits: () => ({
      expressionMaxLength: limits.maxLength,
      sampleMaxPoints: limits.maxPoints,
    }),
    async *sample(request) {
      const sampled = samplePlot(request, limits);
      if (!sampled.ok) {
        throw toConnectError(sampled.error);
      }
      for (const chunk of sampled.value) {
        yield { x: Array.from(chunk.x), y: Array.from(chunk.y) };
      }
    },
  };
}

function toConnectError(failure: PlotFailure): ConnectError {
  switch (failure.kind) {
    case 'range':
      return new ConnectError(`invalid sample range: ${failure.error}`, Code.InvalidArgument);
    case 'expression':
      return new ConnectError(
        `invalid expression: ${failure.error.reason} at ${failure.error.position}`,
        Code.InvalidArgument,
        undefined,
        [
          {
            desc: ExpressionErrorSchema,
            value: { position: failure.error.position, reason: toWireReason(failure.error.reason) },
          },
        ]
      );
    default:
      return assertNever(failure);
  }
}

function toWireReason(reason: DomainReason): ExpressionErrorReason {
  switch (reason) {
    case 'empty':
      return ExpressionErrorReason.EMPTY;
    case 'too-long':
      return ExpressionErrorReason.TOO_LONG;
    case 'too-deep':
      return ExpressionErrorReason.TOO_DEEP;
    case 'unexpected-character':
      return ExpressionErrorReason.UNEXPECTED_CHARACTER;
    case 'invalid-number':
      return ExpressionErrorReason.INVALID_NUMBER;
    case 'unknown-identifier':
      return ExpressionErrorReason.UNKNOWN_IDENTIFIER;
    case 'unexpected-token':
      return ExpressionErrorReason.UNEXPECTED_TOKEN;
    case 'unexpected-end':
      return ExpressionErrorReason.UNEXPECTED_END;
    default:
      return assertNever(reason);
  }
}
