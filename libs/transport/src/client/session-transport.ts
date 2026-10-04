import type {
  DescMessage,
  DescMethodStreaming,
  DescMethodUnary,
  MessageInitShape,
} from '@bufbuild/protobuf';
import type { ContextValues, StreamResponse, Transport, UnaryResponse } from '@connectrpc/connect';
import { createTransport as createConnectProtocolTransport } from '@connectrpc/connect/protocol-connect';

import { usesBinaryCodec } from '../codec/select-codec';
import type { IBidirectionalStream } from '../shared/session';
import { createTunnelHttpClient } from '../tunnel/tunnel-http-client';

export interface SessionTransportOptions {
  readonly openStream: () => Promise<IBidirectionalStream>;
  readonly baseUrl: string;
  readonly readMaxBytes: number;
}

const COMPRESS_MIN_BYTES = 1024;

/** Connect over transport-session streams, binary protobuf for methods that move bytes and JSON for the rest. */
export function createSessionTransport({
  openStream,
  baseUrl,
  readMaxBytes,
}: SessionTransportOptions): Transport {
  const common = {
    httpClient: createTunnelHttpClient(openStream),
    baseUrl,
    interceptors: [],
    acceptCompression: [],
    sendCompression: null,
    compressMinBytes: COMPRESS_MIN_BYTES,
    readMaxBytes,
    writeMaxBytes: readMaxBytes,
  };
  const json = createConnectProtocolTransport({ ...common, useBinaryFormat: false });
  const binary = createConnectProtocolTransport({ ...common, useBinaryFormat: true });
  const codecFor = (method: DescMethodUnary | DescMethodStreaming) =>
    usesBinaryCodec(method) ? binary : json;

  return {
    unary<I extends DescMessage, O extends DescMessage>(
      method: DescMethodUnary<I, O>,
      signal: AbortSignal | undefined,
      timeoutMs: number | undefined,
      header: HeadersInit | undefined,
      input: MessageInitShape<I>,
      contextValues?: ContextValues
    ): Promise<UnaryResponse<I, O>> {
      return codecFor(method).unary(method, signal, timeoutMs, header, input, contextValues);
    },
    stream<I extends DescMessage, O extends DescMessage>(
      method: DescMethodStreaming<I, O>,
      signal: AbortSignal | undefined,
      timeoutMs: number | undefined,
      header: HeadersInit | undefined,
      input: AsyncIterable<MessageInitShape<I>>,
      contextValues?: ContextValues
    ): Promise<StreamResponse<I, O>> {
      return codecFor(method).stream(method, signal, timeoutMs, header, input, contextValues);
    },
  };
}
