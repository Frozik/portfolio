import { createContextKey } from '@connectrpc/connect';

/** W3C Trace Context: what OpenTelemetry and every tracing backend read and write. */
export const TRACEPARENT_HEADER = 'traceparent';

export interface TraceContext {
  /** 32 lowercase hex digits; the one id that ties the client's call to every server log line. */
  readonly traceId: string;
  /** 16 lowercase hex digits naming the caller's own span. */
  readonly spanId: string;
}

/** The call's trace, as RPC handlers and interceptors see it in `context.values`. */
export const TRANSPORT_TRACE = createContextKey<TraceContext | undefined>(undefined, {
  description: 'transport trace context',
});

const TRACEPARENT_VERSION = '00';
const SAMPLED_FLAGS = '01';
const TRACE_ID_BYTES = 16;
const SPAN_ID_BYTES = 8;
const TRACEPARENT =
  /^(?<version>[\da-f]{2})-(?<traceId>[\da-f]{32})-(?<spanId>[\da-f]{16})-[\da-f]{2}$/;
const INVALID_VERSION = 'ff';
const ALL_ZEROS = /^0+$/;

export function newTraceContext(): TraceContext {
  return { traceId: randomHex(TRACE_ID_BYTES), spanId: randomHex(SPAN_ID_BYTES) };
}

export function formatTraceparent({ traceId, spanId }: TraceContext): string {
  return `${TRACEPARENT_VERSION}-${traceId}-${spanId}-${SAMPLED_FLAGS}`;
}

/** Undefined for anything the specification tells a receiver to ignore: bad shape, version ff, all-zero ids. */
export function parseTraceparent(value: string | null): TraceContext | undefined {
  const groups = TRACEPARENT.exec(value?.trim() ?? '')?.groups;
  if (groups === undefined) {
    return undefined;
  }
  const { version, traceId, spanId } = groups;
  if (
    version === INVALID_VERSION ||
    traceId === undefined ||
    spanId === undefined ||
    ALL_ZEROS.test(traceId) ||
    ALL_ZEROS.test(spanId)
  ) {
    return undefined;
  }
  return { traceId, spanId };
}

function randomHex(bytes: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), byte =>
    byte.toString(16).padStart(2, '0')
  ).join('');
}
