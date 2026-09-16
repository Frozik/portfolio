import { describe, expect, it } from 'vitest';

import { cableAreaMm2, cableTypeById } from './cables';
import { defaultCableTypeFor } from './electrical';

describe('defaultCableTypeFor', () => {
  it('wires lighting in 1.5 mm² and anything with a socket in 2.5 mm²', () => {
    expect(defaultCableTypeFor(['light', 'light'])).toBe('vvg-3x1.5');
    expect(defaultCableTypeFor(['light', 'outlet'])).toBe('vvg-3x2.5');
    expect(defaultCableTypeFor([])).toBe('vvg-3x2.5');
  });
});

describe('cableAreaMm2', () => {
  it('reads the outer cross-section a cable takes of a bore', () => {
    expect(cableAreaMm2(cableTypeById('vvg-3x2.5'))).toBeCloseTo(67.9, 0);
  });
});
