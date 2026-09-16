import { describe, expect, it } from 'vitest';

import { createWiringRoute } from '../model/wiring-routes';
import { magnetizeBesideRoutes } from './route-magnetism';

const TRUNK = createWiringRoute({
  points: [
    { x: 0, y: 8 },
    { x: 10, y: 8 },
  ],
});
const WIDTH = 0.02;

describe('magnetizeBesideRoutes', () => {
  it('lands a nearby point beside the route, one conduit width off it', () => {
    const at = magnetizeBesideRoutes({
      routes: [TRUNK],
      point: { x: 4, y: 8.3 },
      widthMeters: WIDTH,
      reachMeters: 1,
      widthOf: () => WIDTH,
    });

    expect(at?.x).toBeCloseTo(4);
    expect(at?.y).toBeCloseTo(8.02);
  });

  it('opens the gap to what the sheet can show when the real one is finer', () => {
    const at = magnetizeBesideRoutes({
      routes: [TRUNK],
      point: { x: 4, y: 8.3 },
      widthMeters: WIDTH,
      reachMeters: 1,
      minGapMeters: 0.25,
      widthOf: () => WIDTH,
    });

    expect(at?.y).toBeCloseTo(8.25);
  });

  it('turns with the neighbour: near its bend the point lands on the companion mitre', () => {
    const corner = createWiringRoute({
      points: [
        { x: 0, y: 8 },
        { x: 10, y: 8 },
        { x: 10, y: 0 },
      ],
    });
    const at = magnetizeBesideRoutes({
      routes: [corner],
      point: { x: 10.3, y: 8.3 },
      widthMeters: WIDTH,
      reachMeters: 1,
      widthOf: () => WIDTH,
    });

    // The outer companion's corner: both offset stretches meet at (10.02, 8.02).
    expect(at?.x).toBeCloseTo(10.02);
    expect(at?.y).toBeCloseTo(8.02);
  });

  it("slides along the companion where the hand stops, not to the neighbour's end", () => {
    const at = magnetizeBesideRoutes({
      routes: [TRUNK],
      point: { x: 7.4, y: 8.3 },
      widthMeters: WIDTH,
      reachMeters: 1,
      widthOf: () => WIDTH,
    });

    expect(at?.x).toBeCloseTo(7.4);
  });

  it('takes the side the point came from', () => {
    const at = magnetizeBesideRoutes({
      routes: [TRUNK],
      point: { x: 4, y: 7.7 },
      widthMeters: WIDTH,
      reachMeters: 1,
      widthOf: () => WIDTH,
    });

    expect(at?.y).toBeCloseTo(7.98);
  });

  it('reaches nothing beyond the radius or past the ends of the stretch', () => {
    expect(
      magnetizeBesideRoutes({
        routes: [TRUNK],
        point: { x: 4, y: 12 },
        widthMeters: WIDTH,
        reachMeters: 1,
        widthOf: () => WIDTH,
      })
    ).toBeUndefined();
    expect(
      magnetizeBesideRoutes({
        routes: [TRUNK],
        point: { x: 12, y: 8.1 },
        widthMeters: WIDTH,
        reachMeters: 1,
        widthOf: () => WIDTH,
      })
    ).toBeUndefined();
  });
});
