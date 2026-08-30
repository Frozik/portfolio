import { describe, expect, it } from 'vitest';

import { computeSceneNorthAngleDegrees } from './scene-compass';

const ALIGNED_WITH_GEOGRAPHIC_NORTH = 0;

describe('computeSceneNorthAngleDegrees', () => {
  it('points the needle straight up while the camera looks north', () => {
    expect(
      computeSceneNorthAngleDegrees({
        cameraYawDegrees: 0,
        northOffsetDegrees: ALIGNED_WITH_GEOGRAPHIC_NORTH,
      })
    ).toBe(0);
  });

  it('turns the needle to the right when the camera turns to face west', () => {
    // Looking west puts north on the right-hand side of the screen.
    expect(
      computeSceneNorthAngleDegrees({
        cameraYawDegrees: 90,
        northOffsetDegrees: ALIGNED_WITH_GEOGRAPHIC_NORTH,
      })
    ).toBe(90);
  });

  it("turns the needle back by the plan's own north offset", () => {
    expect(computeSceneNorthAngleDegrees({ cameraYawDegrees: 90, northOffsetDegrees: 30 })).toBe(
      60
    );
  });

  it('wraps an orbited-away yaw into a single turn', () => {
    expect(
      computeSceneNorthAngleDegrees({
        cameraYawDegrees: 725,
        northOffsetDegrees: ALIGNED_WITH_GEOGRAPHIC_NORTH,
      })
    ).toBe(5);
    expect(
      computeSceneNorthAngleDegrees({
        cameraYawDegrees: -90,
        northOffsetDegrees: ALIGNED_WITH_GEOGRAPHIC_NORTH,
      })
    ).toBe(270);
  });
});
