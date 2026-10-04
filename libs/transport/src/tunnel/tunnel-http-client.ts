import type {
  UniversalClientFn,
  UniversalClientRequest,
  UniversalClientResponse,
} from '@connectrpc/connect/protocol';

import { FrameReader, FrameWriter } from '../frame/frame-io';
import type { IBidirectionalStream } from '../shared/session';
import type { RequestHead } from './tunnel-heads';
import { EndSchema, headerEntries, ResponseHeadSchema, toHeaders } from './tunnel-heads';

const NO_TRAILER = { trailer: [] } as const;

/** Each request opens its own stream: request body and response body flow at the same time. */
export function createTunnelHttpClient(
  openStream: () => Promise<IBidirectionalStream>
): UniversalClientFn {
  return async request => {
    request.signal?.throwIfAborted();
    const stream = await openStream();
    const writer = new FrameWriter(stream.writable);
    const reader = new FrameReader(stream.readable);
    const teardown = (reason: unknown) => {
      writer.abort(reason);
      reader.cancel(reason);
    };
    request.signal?.addEventListener('abort', () => teardown(request.signal?.reason), {
      once: true,
    });

    sendRequest(request, writer).catch(teardown);
    try {
      const head = ResponseHeadSchema.parse(await reader.head());
      return responseOf(head.status, head.header, reader);
    } catch (error) {
      teardown(error);
      throw error;
    }
  };
}

async function sendRequest(request: UniversalClientRequest, writer: FrameWriter): Promise<void> {
  const head: RequestHead = {
    method: request.method,
    url: request.url,
    header: headerEntries(request.header),
  };
  await writer.head(head);
  if (request.body !== undefined) {
    await writer.body(request.body);
  }
  await writer.end(NO_TRAILER);
}

function responseOf(
  status: number,
  header: readonly (readonly [string, string])[],
  reader: FrameReader
): UniversalClientResponse {
  const trailer = new Headers();
  const body = reader.body(json => {
    for (const [name, value] of EndSchema.parse(json).trailer) {
      trailer.append(name, value);
    }
  });
  return { status, header: toHeaders(header), body, trailer };
}
