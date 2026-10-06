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
import type { WireFormat } from '../shared/wire-format';
import { createTunnelHttpClient } from '../tunnel/tunnel-http-client';
import { traceInterceptor } from './call-trace';

export interface SessionTransportOptions {
  readonly openStream: () => Promise<IBidirectionalStream>;
  readonly baseUrl: string;
  readonly readMaxBytes: number;
  /** Read on every call, so the format can change between calls. */
  readonly wireFormat: () => WireFormat;
}

const COMPRESS_MIN_BYTES = 1024;

/** Connect over transport-session streams, with the codec `usesBinaryCodec` picks per call. */
export function createSessionTransport({
  openStream,
  baseUrl,
  readMaxBytes,
  wireFormat,
}: SessionTransportOptions): Transport {
  const common = {
    httpClient: createTunnelHttpClient(openStream),
    baseUrl,
    interceptors: [traceInterceptor],
    acceptCompression: [],
    sendCompression: null,
    compressMinBytes: COMPRESS_MIN_BYTES,
    readMaxBytes,
    writeMaxBytes: readMaxBytes,
  };
  const json = createConnectProtocolTransport({ ...common, useBinaryFormat: false });
  const binary = createConnectProtocolTransport({ ...common, useBinaryFormat: true });
  const codecFor = (method: DescMethodUnary | DescMethodStreaming) =>
    usesBinaryCodec(method, wireFormat()) ? binary : json;

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
