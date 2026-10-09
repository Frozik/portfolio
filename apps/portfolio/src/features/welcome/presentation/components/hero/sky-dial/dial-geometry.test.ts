import { describe, expect, it } from 'vitest';

import { arcPoint, clockHands, DIAL_CENTER, pointAtAngle } from './dial-geometry';

describe('clockHands', () => {
  it('reads 15:30:45 on a twelve-hour dial', () => {
    const hands = clockHands(15, 30, 45);

    expect(hands.hourDegrees).toBeCloseTo(105.375);
    expect(hands.minuteDegrees).toBeCloseTo(184.5);
    expect(hands.secondDegrees).toBe(270);
  });

  it('puts midnight and noon on twelve', () => {
    expect(clockHands(0, 0, 0).hourDegrees).toBe(0);
    expect(clockHands(12, 0, 0).hourDegrees).toBe(0);
  });
});

describe('pointAtAngle', () => {
  it('measures clockwise from twelve', () => {
    expect(pointAtAngle(0, 10).y).toBeCloseTo(DIAL_CENTER - 10);
    expect(pointAtAngle(90, 10).x).toBeCloseTo(DIAL_CENTER + 10);
  });
});

describe('arcPoint', () => {
  it('runs from the left end over the summit to the right end', () => {
    const start = arcPoint(0);
    const middle = arcPoint(0.5);
    const end = arcPoint(1);

    expect(start.x).toBeLessThan(DIAL_CENTER);
    expect(end.x).toBeGreaterThan(DIAL_CENTER);
    expect(start.y).toBeCloseTo(end.y);
    expect(middle.x).toBeCloseTo(DIAL_CENTER);
    expect(middle.y).toBeLessThan(start.y);
  });
});
