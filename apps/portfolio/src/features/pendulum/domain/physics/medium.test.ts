import { dragAcceleration } from './medium';

describe('dragAcceleration', () => {
  it('opposes the velocity', () => {
    const drag = dragAcceleration({ x: 0.3, y: -0.4 });

    expect(drag.x).toBeLessThan(0);
    expect(drag.y).toBeGreaterThan(0);
    expect(drag.x / drag.y).toBeCloseTo(0.3 / -0.4);
  });

  it('grows with the square of the speed', () => {
    const slow = dragAcceleration({ x: 0.1, y: 0 });
    const fast = dragAcceleration({ x: 0.2, y: 0 });

    expect(fast.x / slow.x).toBeCloseTo(4);
  });

  it('vanishes at rest', () => {
    expect(dragAcceleration({ x: 0, y: 0 })).toEqual({ x: -0, y: -0 });
  });
});
