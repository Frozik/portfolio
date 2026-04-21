import type { Milliseconds } from '@frozik/utils';

export const DEFAULT_BRAINSTORM_DURATION_MS = 600_000 as Milliseconds; // 10 min
export const DEFAULT_VOTES_PER_PARTICIPANT = 5;
export const SOFT_ACTION_ITEM_LIMIT = 3;

/** How often the UI should re-evaluate the live timer remaining value. */
export const TIMER_TICK_INTERVAL_MS = 500 as Milliseconds;

/** Warning threshold before timer expires — switches UI to a softer alert. */
export const TIMER_WARNING_THRESHOLD_MS = 60_000 as Milliseconds;

/** Placeholder shown instead of other users' card text during Brainstorm. */
export const REDACTED_CARD_PLACEHOLDER = '•••';

export const ANONYMOUS_AUTHOR_LABEL = 'Anonymous';

/** Tick cadence for presentation-layer timer updates. */
export const TIMER_TICK_MS = 500 as Milliseconds;

/** Duration of the card flip reveal animation when phase advances from Brainstorm. */
export const CARD_FLIP_DURATION_MS = 400 as Milliseconds;

/** Toast message auto-clear delay. */
export const TOAST_AUTOCLEAR_MS = 3_000 as Milliseconds;
