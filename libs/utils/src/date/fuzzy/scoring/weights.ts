import { ESlot } from '../slot';

/** How strongly a number reads as each slot; zero means it cannot be that slot at all. */
export type SlotWeights = Readonly<Record<ESlot, number>>;

export const IMPOSSIBLE = 0;
export const REMOTE = 10;
export const UNLIKELY = 20;
export const DOUBTFUL = 30;
export const EVEN = 50;
export const PLAUSIBLE = 60;
export const PROBABLE = 70;
export const LIKELY = 80;
export const VERY_LIKELY = 90;
export const CERTAIN = 100;

export const NO_WEIGHTS: SlotWeights = {
  [ESlot.Year]: IMPOSSIBLE,
  [ESlot.Month]: IMPOSSIBLE,
  [ESlot.Day]: IMPOSSIBLE,
  [ESlot.Hour]: IMPOSSIBLE,
  [ESlot.Minute]: IMPOSSIBLE,
  [ESlot.Second]: IMPOSSIBLE,
  [ESlot.Millisecond]: IMPOSSIBLE,
};

export function isPossible(weights: SlotWeights, slot: ESlot): boolean {
  return weights[slot] > IMPOSSIBLE;
}

export function closed(weights: SlotWeights, slots: readonly ESlot[]): SlotWeights {
  return { ...weights, ...Object.fromEntries(slots.map(slot => [slot, IMPOSSIBLE])) };
}
