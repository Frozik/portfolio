import type { ISO } from '@frozik/utils/date/types';

/** Wall-clock source for timestamps; injected so tests and replays can pin the time. */
export type TNow = () => ISO;
