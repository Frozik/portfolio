import { Code } from '@connectrpc/connect';
import type { CallRecord } from '@frozik/transport/server/call-recorder';
import { assertNever } from '@frozik/utils/assert/assertNever';

import type { IServerLogger } from '../../application/ports/IServerLogger';

/** Codes that mean the server, not the caller, went wrong: those lines carry the stack. */
const SERVER_FAULTS: ReadonlySet<Code> = new Set([
  Code.Unknown,
  Code.Internal,
  Code.Unimplemented,
  Code.Unavailable,
  Code.DataLoss,
]);

/**
 * One line per call, keyed by `trace_id` — the id the page shows next to an
 * error — so a support request finds what the client sent and how it ended.
 * All at debug: the production box runs at info and keeps none of them (a
 * demo server is not a log store), development shows them all. The client's
 * address stays out of the log.
 */
export function logCall(logger: IServerLogger, record: CallRecord): void {
  const fields = {
    trace_id: record.traceId,
    procedure: record.procedure,
    protocol: record.protocol,
    duration_ms: Math.round(record.durationMs),
    request_count: record.requestCount,
    response_count: record.responseCount,
    requests: record.requests,
  };
  const outcome = record.outcome;
  switch (outcome.kind) {
    case 'ok':
    case 'cancelled':
      logger.debug('transport.call', { ...fields, outcome: outcome.kind });
      return;
    case 'failed': {
      const failed = {
        ...fields,
        outcome: outcome.kind,
        code: Code[outcome.error.code],
        message: outcome.error.rawMessage,
      };
      const cause = outcome.error.cause instanceof Error ? outcome.error.cause : outcome.error;
      logger.debug(
        'transport.call',
        SERVER_FAULTS.has(outcome.error.code) ? { ...failed, stack: cause.stack } : failed
      );
      return;
    }
    default:
      assertNever(outcome);
  }
}
