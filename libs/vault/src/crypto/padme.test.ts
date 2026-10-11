import * as fc from 'fast-check';

import { pad, padmeLength, unpad } from './padme';

const PROPERTY_SEED = 20261010;
const MAX_OVERHEAD = 0.12;

describe('Padmé padding', () => {
  it.each([
    [2, 2],
    [9, 10],
    [15, 16],
    [17, 18],
    [100, 104],
    [1000, 1024],
    [1025, 1088],
    [65_537, 67_584],
    [1_000_000, 1_015_808],
  ])('rounds %i bytes up to %i, as the PURBs reference does', (length, padded) => {
    expect(padmeLength(length)).toBe(padded);
  });

  it('never adds more than 12 % and never shrinks', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1 << 30 }), length => {
        const padded = padmeLength(length);
        return padded >= length && padded - length <= length * MAX_OVERHEAD;
      }),
      { seed: PROPERTY_SEED }
    );
  });

  it('gets back exactly the content it padded, trailing zeros included', () => {
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 300 }), content => {
        const restored = unpad(pad(new Uint8Array(content)));
        return (
          restored.ok &&
          restored.value.length === content.length &&
          restored.value.every((byte, index) => byte === content[index])
        );
      }),
      { seed: PROPERTY_SEED }
    );
  });

  it('answers any bytes with content or `corrupted`, never with an exception', () => {
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 64 }), bytes => {
        const result = unpad(new Uint8Array(bytes));
        return result.ok || result.error === 'corrupted';
      }),
      { seed: PROPERTY_SEED }
    );
    expect(unpad(new Uint8Array(4))).toEqual({ ok: false, error: 'corrupted' });
    expect(unpad(Uint8Array.of(1, 2, 0x7f, 0))).toEqual({ ok: false, error: 'corrupted' });
  });
});
