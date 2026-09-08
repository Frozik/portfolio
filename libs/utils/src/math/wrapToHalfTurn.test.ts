import { wrapToHalfTurn } from './wrapToHalfTurn';

describe('wrapToHalfTurn', () => {
  it('leaves angles inside [−π, π) alone', () => {
    expect(wrapToHalfTurn(1)).toBe(1);
    expect(wrapToHalfTurn(-3)).toBe(-3);
  });

  it('brings whole turns back into the range', () => {
    expect(wrapToHalfTurn(2 * Math.PI + 0.5)).toBeCloseTo(0.5);
    expect(wrapToHalfTurn(-4 * Math.PI - 0.5)).toBeCloseTo(-0.5);
  });

  it('maps both half turns to −π', () => {
    expect(wrapToHalfTurn(Math.PI)).toBe(-Math.PI);
    expect(wrapToHalfTurn(-Math.PI)).toBe(-Math.PI);
  });
});
