import type { Milliseconds } from '@frozik/utils/date/types';

const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 60_000;
const JITTER_FLOOR = 0.5;

/** Exponential backoff with jitter, so devices that collided do not collide again in step. */
export function retryDelay(attempt: number, unitRandom: number): Milliseconds {
  const ceiling = Math.min(BASE_DELAY_MS * 2 ** Math.max(0, attempt - 1), MAX_DELAY_MS);
  return Math.round(ceiling * (JITTER_FLOOR + unitRandom * (1 - JITTER_FLOOR))) as Milliseconds;
}
