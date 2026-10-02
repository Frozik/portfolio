import type { GroundPoint } from './mercator';
import { lonLatToWorld } from './mercator';
import { waveFieldAround } from './wave-field';

const BRIDGE: GroundPoint = lonLatToWorld({ lon: 30.306, lat: 59.944 });
const METRE_IN_UNITS = 5e-8;

/** Where the waves put a ground point, as the shader computes it from a frame around `origin`. */
function waveMetres(point: GroundPoint, origin: GroundPoint): GroundPoint {
  const { offset, metresPerUnit } = waveFieldAround(origin);
  return {
    x: (point.x - origin.x + offset.x) * metresPerUnit,
    y: (point.y - origin.y + offset.y) * metresPerUnit,
  };
}

describe('wave field', () => {
  it('keeps the waves where they are on the ground while the camera moves', () => {
    const farther: GroundPoint = {
      x: BRIDGE.x + 300 * METRE_IN_UNITS,
      y: BRIDGE.y - 200 * METRE_IN_UNITS,
    };

    const seenFromTheBridge = waveMetres(BRIDGE, BRIDGE);
    const seenFromFarther = waveMetres(BRIDGE, farther);

    expect(seenFromFarther.x).toBeCloseTo(seenFromTheBridge.x, 6);
    expect(seenFromFarther.y).toBeCloseTo(seenFromTheBridge.y, 6);
  });

  it('measures in ground metres at the latitude, from an anchor close enough for float32', () => {
    const { offset, metresPerUnit } = waveFieldAround(BRIDGE);
    const metresPerUnitAtTheEquator = 40_075_016.686;
    const anchorCell = 1 / 1024;

    expect(metresPerUnit / metresPerUnitAtTheEquator).toBeCloseTo(0.5, 2);
    expect(offset.x).toBeGreaterThanOrEqual(0);
    expect(offset.x).toBeLessThan(anchorCell);
    expect(offset.y).toBeGreaterThanOrEqual(0);
    expect(offset.y).toBeLessThan(anchorCell);
  });
});
