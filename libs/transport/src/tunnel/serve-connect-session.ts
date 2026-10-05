import type { ContextValues } from '@connectrpc/connect';
import type { UniversalHandler, UniversalServerResponse } from '@connectrpc/connect/protocol';

import { FrameReader, FrameWriter } from '../frame/frame-io';
import type { IBidirectionalStream, ITransportSession } from '../shared/session';
import { startIdleWatchdog } from './idle-watchdog';
import { EndSchema, headerEntries, RequestHeadSchema, toHeaders } from './tunnel-heads';

const HTTP_NOT_FOUND = 404;
const TUNNEL_HTTP_VERSION = '3';

export interface ServeConnectSessionOptions {
  readonly handlers: readonly UniversalHandler[];
  readonly maxStreams: number;
  /**
   * A stream where no bytes move either way for this long is reset: a peer
   * that never sends its request, or stops reading the response, must not hold
   * a stream — and whatever the handler reserved — forever.
   */
  readonly streamIdleTimeoutMs: number;
  /** Per-call values handlers read from `context.values`, such as the peer address. */
  readonly contextValues?: () => ContextValues;
  readonly onStreamError: (error: unknown) => void;
}

/** Serves every stream the peer opens until the session ends; never rejects. */
export async function serveConnectSession(
  session: ITransportSession,
  {
    handlers,
    maxStreams,
    streamIdleTimeoutMs,
    contextValues,
    onStreamError,
  }: ServeConnectSessionOptions
): Promise<void> {
  const byPath = new Map(handlers.map(handler => [handler.requestPath, handler]));
  const streams = session.incomingBidirectionalStreams.getReader();
  const context: StreamContext = { byPath, streamIdleTimeoutMs, contextValues, onStreamError };
  let active = 0;
  let slotFreed: (() => void) | undefined;
  try {
    for (;;) {
      // A handler whose stream was aborted may still be finishing when the
      // stream that replaced it arrives; waiting for its slot, instead of
      // refusing the newcomer, keeps a client that cancels and retries — a
      // chart while zooming — from seeing its live call reset. The transport
      // below already bounds the live streams, so the wait is short.
      while (active >= maxStreams) {
        await new Promise<void>(resolve => {
          slotFreed = resolve;
        });
      }
      const { value: stream, done } = await streams.read();
      if (done) {
        return;
      }
      active += 1;
      void serveStream(stream, context).finally(() => {
        active -= 1;
        slotFreed?.();
        slotFreed = undefined;
      });
    }
  } catch (error) {
    onStreamError(error);
  }
}

export class StreamIdleError extends Error {
  override readonly name = 'StreamIdleError';
}

interface StreamContext {
  readonly byPath: ReadonlyMap<string, UniversalHandler>;
  readonly streamIdleTimeoutMs: number;
  readonly contextValues: (() => ContextValues) | undefined;
  readonly onStreamError: (error: unknown) => void;
}

async function serveStream(
  stream: IBidirectionalStream,
  { byPath, streamIdleTimeoutMs, contextValues, onStreamError }: StreamContext
): Promise<void> {
  const aborted = new AbortController();
  const teardown = (error: unknown) => {
    if (aborted.signal.aborted) {
      return;
    }
    aborted.abort(error);
    writer.abort(error);
    reader.cancel(error);
    onStreamError(error);
  };
  const watchdog = startIdleWatchdog(streamIdleTimeoutMs, () =>
    teardown(new StreamIdleError(`no bytes moved for ${streamIdleTimeoutMs} ms`))
  );
  const reader = new FrameReader(stream.readable, watchdog.touch);
  const writer = new FrameWriter(stream.writable, watchdog.touch);
  // A client that cancels its call resets the stream; the handler learns it
  // through its signal at once, not on its next write or the idle timeout.
  writer.onFailure(teardown);
  try {
    const head = RequestHeadSchema.parse(await reader.head());
    const handler = byPath.get(new URL(head.url).pathname);
    const response: UniversalServerResponse =
      handler === undefined
        ? { status: HTTP_NOT_FOUND }
        : await handler({
            httpVersion: TUNNEL_HTTP_VERSION,
            url: head.url,
            method: head.method,
            header: toHeaders(head.header),
            body: reader.body(json => EndSchema.parse(json)),
            signal: aborted.signal,
            contextValues: contextValues?.(),
          });
    await writer.head({ status: response.status, header: headerEntries(response.header) });
    if (response.body !== undefined) {
      await writer.body(response.body);
    }
    await writer.end({ trailer: headerEntries(response.trailer) });
  } catch (error) {
    teardown(error);
  } finally {
    watchdog.stop();
  }
}
