import { describe, expect, it } from 'vitest';
import { buildContours, chooseContourLabels } from './contours';
import type { Heightfield } from './heightfield';

const RESOLUTION = 9;
const CELL_SIZE_METERS = 1;
/** Rise per metre of the test slope: an 8 m grid spans 2 m of elevation. */
const SLOPE_PER_METER = 0.25;
const CONTOUR_INTERVAL_METERS = 0.5;

/** A plane tilted along +x: height = 0.25 · x, so contours run north–south. */
function createSlopedField(): Heightfield {
  const heights = new Float32Array(RESOLUTION * RESOLUTION);

  for (let row = 0; row < RESOLUTION; row += 1) {
    for (let column = 0; column < RESOLUTION; column += 1) {
      heights[row * RESOLUTION + column] = column * CELL_SIZE_METERS * SLOPE_PER_METER;
    }
  }

  return {
    resolution: RESOLUTION,
    originMeters: { x: 0, y: 0 },
    cellSizeMeters: CELL_SIZE_METERS,
    heights,
  };
}

function createFlatField(elevation: number): Heightfield {
  return {
    resolution: RESOLUTION,
    originMeters: { x: 0, y: 0 },
    cellSizeMeters: CELL_SIZE_METERS,
    heights: new Float32Array(RESOLUTION * RESOLUTION).fill(elevation),
  };
}

describe('buildContours', () => {
  it('traces one straight line per level of a tilted plane', () => {
    const contours = buildContours(createSlopedField(), CONTOUR_INTERVAL_METERS);
    const levels = [...new Set(contours.map(contour => contour.level))].sort(
      (first, second) => first - second
    );

    expect(levels).toEqual([0.5, 1, 1.5]);

    for (const contour of contours) {
      const expectedX = contour.level / SLOPE_PER_METER;

      for (const point of contour.points) {
        expect(point.x).toBeCloseTo(expectedX, 5);
      }
    }
  });

  it('joins the segments of a level into a single chain spanning the grid', () => {
    const contours = buildContours(createSlopedField(), CONTOUR_INTERVAL_METERS);
    const atMidLevel = contours.filter(contour => contour.level === 1);

    expect(atMidLevel).toHaveLength(1);

    const [contour] = atMidLevel;
    const northings = contour.points.map(point => point.y);

    expect(Math.min(...northings)).toBeCloseTo(0, 5);
    expect(Math.max(...northings)).toBeCloseTo((RESOLUTION - 1) * CELL_SIZE_METERS, 5);
  });

  it('traces nothing across flat ground', () => {
    expect(buildContours(createFlatField(1.25), CONTOUR_INTERVAL_METERS)).toEqual([]);
  });

  it('traces nothing for a non-positive interval', () => {
    expect(buildContours(createSlopedField(), 0)).toEqual([]);
    expect(buildContours(createSlopedField(), Number.NaN)).toEqual([]);
  });

  it('refuses an interval that would bury the plan in lines', () => {
    expect(buildContours(createSlopedField(), 1e-4)).toEqual([]);
  });
});

describe('chooseContourLabels', () => {
  it('captions every level once, in the middle of its longest chain', () => {
    const labels = chooseContourLabels(buildContours(createSlopedField(), CONTOUR_INTERVAL_METERS));

    expect(labels.map(label => label.level).sort((first, second) => first - second)).toEqual([
      0.5, 1, 1.5,
    ]);

    for (const label of labels) {
      expect(label.position.x).toBeCloseTo(label.level / SLOPE_PER_METER, 5);
      expect(label.position.y).toBeGreaterThan(0);
      expect(label.position.y).toBeLessThan((RESOLUTION - 1) * CELL_SIZE_METERS);
    }
  });

  it('skips a level whose chain is too short to read', () => {
    expect(chooseContourLabels([{ level: 1, points: [{ x: 0, y: 0 }] }])).toEqual([]);
  });

  it('moves the caption to the accepted point nearest the middle', () => {
    const southernHalf = 2;
    const labels = chooseContourLabels(
      buildContours(createSlopedField(), CONTOUR_INTERVAL_METERS),
      position => position.y <= southernHalf
    );

    expect(labels).toHaveLength(3);

    for (const label of labels) {
      expect(label.position.y).toBe(southernHalf);
    }
  });

  it('leaves a level uncaptioned when its chain is refused outright', () => {
    expect(
      chooseContourLabels(buildContours(createSlopedField(), CONTOUR_INTERVAL_METERS), () => false)
    ).toEqual([]);
  });
});
