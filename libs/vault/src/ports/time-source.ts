import type { Milliseconds } from '@frozik/utils/date/types';
import type { TResult } from '@frozik/utils/result/result';

/**
 * One exchange with a time service, measured SNTP-style:
 * the round trip on the monotonic clock, the server's time, and this
 * device's wall clock when the answer arrived.
 */
export interface ITimeSample {
  readonly roundTrip: Milliseconds;
  readonly serverEpochMs: number;
  readonly localEpochMsAtReceipt: number;
}

export interface ITimeSource {
  readonly name: string;
  sample(signal: AbortSignal): Promise<TResult<ITimeSample, 'unavailable' | 'aborted'>>;
}
