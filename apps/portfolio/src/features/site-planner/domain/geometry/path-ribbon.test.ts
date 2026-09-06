import { describe, expect, it } from 'vitest';

import { createPathId } from '../model/plot-objects';
import { multiPolygonArea } from './building-outline';
import { buildPathRibbons } from './path-ribbon';
import { intersectPolygons } from './polygon-booleans';

describe('buildPathRibbons', () => {
  it('keeps a uniformly paved path one piece sharing the whole ribbon', () => {
    const [ribbon] = buildPathRibbons([
      {
        id: createPathId(),
        points: [
          { position: { x: 0, y: 0 }, width: 1 },
          { position: { x: 4, y: 0 }, width: 1 },
          { position: { x: 8, y: 0 }, width: 1 },
        ],
      },
    ]);

    expect(ribbon.pieces).toHaveLength(1);
    expect(ribbon.pieces[0].surface).toBe('asphalt');
    expect(ribbon.pieces[0].polygons).toBe(ribbon.polygons);
  });

  it('cuts a mixed path into one piece per run of paving', () => {
    const [ribbon] = buildPathRibbons([
      {
        id: createPathId(),
        points: [
          { position: { x: 0, y: 0 }, width: 1, surface: 'dirt' },
          { position: { x: 4, y: 0 }, width: 1, surface: 'dirt' },
          { position: { x: 8, y: 0 }, width: 1, surface: 'asphalt' },
          { position: { x: 12, y: 0 }, width: 1 },
        ],
      },
    ]);

    expect(ribbon.pieces.map(piece => piece.surface)).toEqual(['dirt', 'asphalt']);
    expect(ribbon.pieces[0].polygons.length).toBeGreaterThan(0);
    expect(ribbon.pieces[1].polygons.length).toBeGreaterThan(0);
  });

  it("tiles a mixed ribbon with no overlap — the seam disc wears the point's own paving", () => {
    const [ribbon] = buildPathRibbons([
      {
        id: createPathId(),
        points: [
          { position: { x: 0, y: 0 }, width: 1, surface: 'asphalt' },
          { position: { x: 6, y: 0 }, width: 1, surface: 'dirt' },
          { position: { x: 6, y: 6 }, width: 1 },
        ],
      },
    ]);
    const [asphalt, dirt] = ribbon.pieces;
    const [blend] = ribbon.seamBlends;

    // Translucent fills blend wherever they overlap, so nothing may: not the
    // flat pieces with each other, and not either of them with the gradient.
    expect(multiPolygonArea(intersectPolygons(asphalt.polygons, dirt.polygons))).toBeCloseTo(0, 3);
    expect(multiPolygonArea(intersectPolygons(asphalt.polygons, blend.polygons))).toBeCloseTo(0, 3);
    expect(multiPolygonArea(intersectPolygons(dirt.polygons, blend.polygons))).toBeCloseTo(0, 3);
    // Pieces and the gradient strip together still cover the whole ribbon.
    expect(
      multiPolygonArea(asphalt.polygons) +
        multiPolygonArea(dirt.polygons) +
        multiPolygonArea(blend.polygons)
    ).toBeCloseTo(multiPolygonArea(ribbon.polygons), 1);
    // The strip runs from asphalt into dirt, centred on the seam point: its
    // gradient axis reaches 0.75 widths to each side along the centreline.
    expect(blend.fromSurface).toBe('asphalt');
    expect(blend.toSurface).toBe('dirt');
    expect(blend.start).toEqual({ x: 5.25, y: 0 });
    expect(blend.end).toEqual({ x: 6, y: 0.75 });
  });
});
