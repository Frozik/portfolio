import type { TransportProtocol } from './connection';

export interface EchoLimits {
  readonly maxFileBytes: number;
  readonly bytesPerHour: number;
  readonly rateBytesPerSecond: number;
  readonly maxChunkBytes: number;
}

/** What the server reports once the whole file has gone through it. */
export interface EchoSummary {
  readonly bytes: number;
  readonly crc32: number;
  /** The most file bytes the server's handler held at once. */
  readonly maxBufferedBytes: number;
}

export interface EchoTally {
  readonly declaredBytes: number;
  readonly sentBytes: number;
  readonly sentCrc32: number;
  readonly receivedBytes: number;
  readonly receivedCrc32: number;
}

export type EchoVerdict = 'intact' | 'size-mismatch' | 'checksum-mismatch';

/** One finished echo, kept so runs over different transports can be compared. */
export interface EchoResult {
  readonly id: number;
  readonly fileName: string;
  readonly verdict: EchoVerdict;
  readonly summary: EchoSummary;
  readonly elapsedMs: number;
  /** The protocol the session ran on when the echo finished; undefined if it had already dropped. */
  readonly protocol: TransportProtocol | undefined;
}

/** The echo is intact when what left, what the server saw and what came back are the same bytes. */
export function verifyEcho(tally: EchoTally, summary: EchoSummary): EchoVerdict {
  const sizes = [tally.declaredBytes, tally.sentBytes, tally.receivedBytes, summary.bytes];
  if (sizes.some(size => size !== tally.declaredBytes)) {
    return 'size-mismatch';
  }
  const checksums = [tally.sentCrc32, tally.receivedCrc32, summary.crc32];
  return checksums.every(crc => crc === tally.sentCrc32) ? 'intact' : 'checksum-mismatch';
}

const MS_PER_SECOND = 1000;

export function bytesPerSecond(bytes: number, elapsedMs: number): number {
  return elapsedMs <= 0 ? 0 : (bytes / elapsedMs) * MS_PER_SECOND;
}
