import { pointAt } from './pattern-geometry';

const PAD = 300;

describe('the point under a finger on the pattern pad', () => {
  it('is the middle point at the pad’s centre and the last at its far corner’s point', () => {
    expect([pointAt(150, 150, PAD), pointAt(250, 250, PAD)]).toEqual([4, 8]);
  });

  it('is none between two points, so a finger passing by joins nothing', () => {
    expect(pointAt(100, 50, PAD)).toBeNull();
  });

  it('is none outside the pad', () => {
    expect([pointAt(-10, 50, PAD), pointAt(50, 310, PAD)]).toEqual([null, null]);
  });
});
