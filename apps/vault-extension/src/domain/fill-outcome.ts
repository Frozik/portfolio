import type { TFillOutcome } from './messages';

/** Which frame's answer the popup hears: a fill anywhere wins, then what the user can act on. */
const PRIORITY: readonly TFillOutcome[] = [
  'filled',
  'insecure-page',
  'no-form',
  'other-site',
  'not-allowed',
  'locked',
];

/** Every frame filled or refused on its own; the page's answer is the most useful of them. */
export function combineOutcomes(outcomes: readonly TFillOutcome[]): TFillOutcome {
  return PRIORITY.find(outcome => outcomes.includes(outcome)) ?? 'no-form';
}
