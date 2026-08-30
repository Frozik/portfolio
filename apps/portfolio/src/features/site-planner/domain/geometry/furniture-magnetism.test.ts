import { describe, expect, it } from 'vitest';

import { createWall } from '../model/walls';
import { magnetizeFurnitureToWall } from './furniture-magnetism';

/** A brick wall along y = 8; its faces run at y = 8 ± 0.19. */
const WALL = {
  ...createWall({
    points: [
      { x: 6, y: 8 },
      { x: 14, y: 8 },
    ],
  }),
  thicknessMeters: 0.38,
};

describe('magnetizeFurnitureToWall', () => {
  it('turns the back to the wall and sits flush against the near face', () => {
    const caught = magnetizeFurnitureToWall({
      position: { x: 10, y: 8.6 },
      depthMeters: 0.95,
      walls: [WALL],
      thresholdMeters: 0.5,
    });

    expect(caught).toBeDefined();
    expect(caught?.position.x).toBeCloseTo(10);
    // Face at 8.19, plus half the depth.
    expect(caught?.position.y).toBeCloseTo(8.19 + 0.475);
    // The front faces +y — away from the wall.
    expect(caught?.rotationDegrees).toBeCloseTo(0);
  });

  it('catches from the other side with the pose flipped', () => {
    const caught = magnetizeFurnitureToWall({
      position: { x: 10, y: 7.4 },
      depthMeters: 0.95,
      walls: [WALL],
      thresholdMeters: 0.5,
    });

    expect(caught?.position.y).toBeCloseTo(7.81 - 0.475);
    expect(Math.abs(caught?.rotationDegrees ?? 0)).toBeCloseTo(180);
  });

  it('lets go beyond the threshold', () => {
    expect(
      magnetizeFurnitureToWall({
        position: { x: 10, y: 12 },
        depthMeters: 0.95,
        walls: [WALL],
        thresholdMeters: 0.5,
      })
    ).toBeUndefined();
  });
});
