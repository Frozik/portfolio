import type { EchoLimits, EchoSummary, EchoTally } from '../echo';

export interface EchoCounters {
  readonly sentBytes: number;
  readonly receivedBytes: number;
}

export interface EchoRequest {
  /** A `File` fits: anything with a name, a size and a byte stream. */
  readonly source: {
    readonly name: string;
    readonly size: number;
    stream(): ReadableStream<Uint8Array>;
  };
  readonly destination: WritableStream<Uint8Array>;
  readonly maxChunkBytes: number;
  readonly signal: AbortSignal;
  readonly onProgress: (counters: EchoCounters) => void;
}

export interface EchoOutcome {
  readonly summary: EchoSummary;
  readonly tally: EchoTally;
}

/** The file echo service: a file goes to the server and comes back into `destination`. */
export interface IFileEcho {
  limits(signal: AbortSignal): Promise<EchoLimits>;
  /** Closes `destination` on success and aborts it on failure; rejects with `CallFailedError`. */
  echo(request: EchoRequest): Promise<EchoOutcome>;
}
