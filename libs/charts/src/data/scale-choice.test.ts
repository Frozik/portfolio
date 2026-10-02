import { describe, expect, it } from 'vitest';

import { chooseScale } from './scale-choice';

const STEPS = [1, 5, 20, 100];

describe('choice of scale', () => {
  it('takes the finest step that leaves an element its pixels', () => {
    expect(chooseScale(STEPS, 1, 1)).toBe(0);
    expect(chooseScale(STEPS, 1, 6)).toBe(2);
    expect(chooseScale(STEPS, 4, 6)).toBe(3);
  });

  it('takes a step that fits exactly', () => {
    expect(chooseScale(STEPS, 5, 1)).toBe(1);
  });

  it('stays on the coarsest step when even it is too fine', () => {
    expect(chooseScale(STEPS, 1000, 6)).toBe(3);
  });
});
