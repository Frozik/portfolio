import { distanceToGroundRect, frustumPlanes, intersectsGroundRect } from './frustum';
import { cameraGeometry, createMapCamera } from './map-camera';
import { DEFAULT_VIEW } from './map-view';
import { lonLatToWorld } from './mercator';

const VIEWPORT = { widthPx: 1600, heightPx: 900 };
const NEAR_HALF_SIZE = 1e-5;
const FAR_OFFSET = 0.2;

function squareAround(x: number, y: number, halfSize: number) {
  return { minX: x - halfSize, minY: y - halfSize, maxX: x + halfSize, maxY: y + halfSize };
}

describe('frustum', () => {
  it('keeps the ground under the target and culls ground far behind the camera', () => {
    const state = createMapCamera({ ...DEFAULT_VIEW, pitchDeg: 50, bearingDeg: 0 });
    const geometry = cameraGeometry(state, VIEWPORT);
    const planes = frustumPlanes(geometry.viewProjection, geometry.origin);
    const target = lonLatToWorld(DEFAULT_VIEW);

    expect(intersectsGroundRect(planes, squareAround(target.x, target.y, NEAR_HALF_SIZE))).toBe(
      true
    );
    expect(
      intersectsGroundRect(planes, squareAround(target.x, target.y + FAR_OFFSET, NEAR_HALF_SIZE))
    ).toBe(false);
  });

  it('measures the distance to a rectangle from its nearest edge, not its centre', () => {
    const position = { x: 0.5, y: 0.1, z: 0.5 };

    expect(distanceToGroundRect(position, squareAround(0.5, 0.5, 0.01))).toBeCloseTo(0.1, 12);
    expect(
      distanceToGroundRect(position, { minX: 0.6, minY: 0.4, maxX: 0.7, maxY: 0.6 })
    ).toBeCloseTo(Math.hypot(0.1, 0.1), 12);
  });
});
