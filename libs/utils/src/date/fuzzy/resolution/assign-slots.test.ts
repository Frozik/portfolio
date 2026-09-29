import { describe, expect, it } from 'vitest';

import { ETokenKind } from '../lexer/token';
import type { ICandidate } from '../scoring/scoreboard';
import type { SlotWeights } from '../scoring/weights';
import { NO_WEIGHTS } from '../scoring/weights';
import { ESlot } from '../slot';
import { assignSlots } from './assign-slots';

function candidate(value: number, weights: Partial<SlotWeights>, position = 0): ICandidate {
  return {
    token: { kind: ETokenKind.Number, value, text: String(value) },
    position,
    weights: { ...NO_WEIGHTS, ...weights },
    changedBy: [],
  };
}

describe('assignSlots', () => {
  it('gives every number the slot it reads as most strongly', () => {
    expect(
      assignSlots([
        candidate(15, { [ESlot.Day]: 80, [ESlot.Hour]: 70 }),
        candidate(3, { [ESlot.Month]: 80, [ESlot.Day]: 50 }),
        candidate(2025, { [ESlot.Year]: 100 }),
      ])
    ).toEqual({ [ESlot.Day]: 15, [ESlot.Month]: 3, [ESlot.Year]: 2025 });
  });

  it('settles the most confident reading first and gives the rest what is left', () => {
    expect(
      assignSlots([
        candidate(10, { [ESlot.Hour]: 60, [ESlot.Minute]: 50 }),
        candidate(11, { [ESlot.Hour]: 90, [ESlot.Minute]: 30 }),
      ])
    ).toEqual({ [ESlot.Hour]: 11, [ESlot.Minute]: 10 });
  });

  it('gives a slot two numbers want equally to the one written first', () => {
    expect(
      assignSlots([
        candidate(1, { [ESlot.Day]: 80, [ESlot.Month]: 50 }),
        candidate(2, { [ESlot.Day]: 80, [ESlot.Month]: 50 }),
      ])
    ).toEqual({ [ESlot.Day]: 1, [ESlot.Month]: 2 });
  });

  it('writes a two-digit year out in full', () => {
    expect(assignSlots([candidate(27, { [ESlot.Year]: 50 })])).toEqual({ [ESlot.Year]: 2027 });
    expect(assignSlots([candidate(82, { [ESlot.Year]: 90 })])).toEqual({ [ESlot.Year]: 1982 });
  });

  it('assigns nothing when there are no numbers', () => {
    expect(assignSlots([])).toEqual({});
  });

  it('gives up when a number is left without a slot', () => {
    expect(
      assignSlots([candidate(10, { [ESlot.Hour]: 60 }), candidate(11, { [ESlot.Hour]: 90 })])
    ).toBeUndefined();
    expect(assignSlots([candidate(45, {})])).toBeUndefined();
  });
});
