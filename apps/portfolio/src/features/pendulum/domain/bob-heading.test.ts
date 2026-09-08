import { firstBobHeading } from './bob-heading';
import { createWorld } from './physics/createWorld';

describe('firstBobHeading', () => {
  it('reads −π/2 for a bob hanging down and +π/2 for one balanced upright', () => {
    expect(firstBobHeading(createWorld({ bobsCount: 1 }))).toBeCloseTo(-Math.PI / 2);
    expect(firstBobHeading({ ...createWorld({ bobsCount: 1 }), angles: [Math.PI] })).toBeCloseTo(
      Math.PI / 2
    );
  });

  it('reads 0 pointing left and ±π pointing right', () => {
    expect(
      firstBobHeading({ ...createWorld({ bobsCount: 1 }), angles: [-Math.PI / 2] })
    ).toBeCloseTo(0);
    expect(
      Math.abs(firstBobHeading({ ...createWorld({ bobsCount: 1 }), angles: [Math.PI / 2] }))
    ).toBeCloseTo(Math.PI);
  });

  it('is positive exactly while the bob is above the pivot', () => {
    expect(firstBobHeading({ ...createWorld({ bobsCount: 1 }), angles: [2] })).toBeGreaterThan(0);
    expect(firstBobHeading({ ...createWorld({ bobsCount: 1 }), angles: [-2] })).toBeGreaterThan(0);
    expect(firstBobHeading({ ...createWorld({ bobsCount: 1 }), angles: [1] })).toBeLessThan(0);
  });
});
