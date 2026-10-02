/** The gRPC status codes: what went wrong decides what the chart does next (§4.6). */
export type TDataErrorCode =
  | 'CANCELLED'
  | 'UNKNOWN'
  | 'INVALID_ARGUMENT'
  | 'DEADLINE_EXCEEDED'
  | 'NOT_FOUND'
  | 'ALREADY_EXISTS'
  | 'PERMISSION_DENIED'
  | 'RESOURCE_EXHAUSTED'
  | 'FAILED_PRECONDITION'
  | 'ABORTED'
  | 'OUT_OF_RANGE'
  | 'UNIMPLEMENTED'
  | 'INTERNAL'
  | 'UNAVAILABLE'
  | 'DATA_LOSS'
  | 'UNAUTHENTICATED';

export class ChartDataError extends Error {
  constructor(
    readonly code: TDataErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'ChartDataError';
  }
}

const TRANSIENT_CODES: ReadonlySet<TDataErrorCode> = new Set([
  'UNAVAILABLE',
  'DEADLINE_EXCEEDED',
  'ABORTED',
  'RESOURCE_EXHAUSTED',
]);

const ABSENT_CODES: ReadonlySet<TDataErrorCode> = new Set(['NOT_FOUND', 'UNIMPLEMENTED']);

/** Whatever a source threw, as an error with a code; anything without one is `UNKNOWN`. */
export function toDataError(error: unknown): ChartDataError {
  if (error instanceof ChartDataError) {
    return error;
  }
  if (error instanceof Error && error.name === 'AbortError') {
    return new ChartDataError('CANCELLED', error.message);
  }
  return new ChartDataError('UNKNOWN', error instanceof Error ? error.message : String(error));
}

/** A failure worth retrying on its own: the server may answer next time. */
export function isTransient(code: TDataErrorCode): boolean {
  return TRANSIENT_CODES.has(code);
}

/** The data does not exist at all: asking again is pointless. */
export function isAbsent(code: TDataErrorCode): boolean {
  return ABSENT_CODES.has(code);
}
