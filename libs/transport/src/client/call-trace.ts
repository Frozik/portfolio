import type { Interceptor } from '@connectrpc/connect';
import { ConnectError } from '@connectrpc/connect';

import type { TraceContext } from '../shared/trace-context';
import {
  formatTraceparent,
  newTraceContext,
  parseTraceparent,
  TRACEPARENT_HEADER,
} from '../shared/trace-context';

/** Where a failed call carries its trace id: the error's metadata, beside the server's headers and trailers. */
const TRACE_ID_METADATA = 'trace-id';

/**
 * Gives every call a W3C `traceparent` — the caller's own when it set one
 * (an OpenTelemetry span, say), a fresh one otherwise — and stamps the trace
 * id on any error the call ends with, whether it failed at once or mid-stream.
 */
export const traceInterceptor: Interceptor = next => async request => {
  const trace = parseTraceparent(request.header.get(TRACEPARENT_HEADER)) ?? newTraceContext();
  request.header.set(TRACEPARENT_HEADER, formatTraceparent(trace));
  try {
    const response = await next(request);
    return response.stream
      ? { ...response, message: stampedMessages(response.message, trace) }
      : response;
  } catch (error) {
    throw stamped(error, trace);
  }
};

/** The trace id of the call that failed with `error`; undefined for errors that did not come from a call. */
export function traceIdOf(error: unknown): string | undefined {
  return error instanceof ConnectError
    ? (error.metadata.get(TRACE_ID_METADATA) ?? undefined)
    : undefined;
}

async function* stampedMessages<T>(
  messages: AsyncIterable<T>,
  trace: TraceContext
): AsyncIterable<T> {
  try {
    yield* messages;
  } catch (error) {
    throw stamped(error, trace);
  }
}

function stamped(error: unknown, trace: TraceContext): ConnectError {
  const connectError = ConnectError.from(error);
  connectError.metadata.set(TRACE_ID_METADATA, trace.traceId);
  return connectError;
}
