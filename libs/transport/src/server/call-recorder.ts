import type { DescMessage, JsonValue, MessageShape } from '@bufbuild/protobuf';
import type { Interceptor } from '@connectrpc/connect';
import { Code, ConnectError } from '@connectrpc/connect';

import type { TransportProtocol } from '../shared/session';
import { TRANSPORT_TRACE } from '../shared/trace-context';
import { summarizeMessage } from './message-summary';
import { TRANSPORT_CLIENT_ADDRESS, TRANSPORT_PROTOCOL } from './peer';

/** What the caller sent is kept for the record only this far: enough to replay a failure, not a file. */
const RECORDED_REQUESTS = 3;

export type CallOutcome =
  | { readonly kind: 'ok' }
  | { readonly kind: 'cancelled' }
  | { readonly kind: 'failed'; readonly error: ConnectError };

/** One RPC from start to end, keyed by the trace id the client shows its user. */
export interface CallRecord {
  readonly traceId: string | undefined;
  /** `frozik.transport.v1.PlotService/Sample`. */
  readonly procedure: string;
  readonly protocol: TransportProtocol;
  readonly clientAddress: string | undefined;
  readonly durationMs: number;
  /** The first request messages, summarized (`summarizeMessage`). */
  readonly requests: readonly JsonValue[];
  readonly requestCount: number;
  readonly responseCount: number;
  readonly outcome: CallOutcome;
}

/**
 * A server interceptor that reports every call once, when it ends — however
 * it ends — so an application writes one log line per call under its trace id.
 */
export function createCallRecorder(
  onCall: (record: CallRecord) => void,
  now: () => number = () => performance.now()
): Interceptor {
  return next => async request => {
    const startedAt = now();
    const requests: JsonValue[] = [];
    let requestCount = 0;
    let responseCount = 0;
    const received = (message: MessageShape<DescMessage>) => {
      requestCount += 1;
      if (requests.length < RECORDED_REQUESTS) {
        requests.push(summarizeMessage(request.method.input, message));
      }
    };
    const finish = (error: unknown) =>
      onCall({
        traceId: request.contextValues.get(TRANSPORT_TRACE)?.traceId,
        procedure: `${request.service.typeName}/${request.method.name}`,
        protocol: request.contextValues.get(TRANSPORT_PROTOCOL),
        clientAddress: request.contextValues.get(TRANSPORT_CLIENT_ADDRESS),
        durationMs: now() - startedAt,
        requests,
        requestCount,
        responseCount,
        outcome: outcomeOf(error, request.signal),
      });

    if (request.stream) {
      request = { ...request, message: tapped(request.message, received) };
    } else {
      received(request.message);
    }
    let response: Awaited<ReturnType<typeof next>>;
    try {
      response = await next(request);
    } catch (error) {
      finish(error);
      throw error;
    }
    if (!response.stream) {
      responseCount = 1;
      finish(undefined);
      return response;
    }
    return {
      ...response,
      message: recorded(response.message, () => (responseCount += 1), finish),
    };
  };
}

async function* tapped<T>(
  messages: AsyncIterable<T>,
  onMessage: (message: T) => void
): AsyncIterable<T> {
  for await (const message of messages) {
    onMessage(message);
    yield message;
  }
}

async function* recorded<T>(
  messages: AsyncIterable<T>,
  onMessage: () => void,
  finish: (error: unknown) => void
): AsyncIterable<T> {
  let failure: unknown;
  try {
    for await (const message of messages) {
      onMessage();
      yield message;
    }
  } catch (error) {
    failure = error;
    throw error;
  } finally {
    finish(failure);
  }
}

function outcomeOf(error: unknown, signal: AbortSignal): CallOutcome {
  if (signal.aborted) {
    return { kind: 'cancelled' };
  }
  if (error === undefined) {
    return { kind: 'ok' };
  }
  const connectError = ConnectError.from(error);
  return connectError.code === Code.Canceled
    ? { kind: 'cancelled' }
    : { kind: 'failed', error: connectError };
}
