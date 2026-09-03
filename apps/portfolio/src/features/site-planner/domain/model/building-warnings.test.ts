import { describe, expect, it } from 'vitest';

import type { MultiPolygon } from '../geometry/polygon-types';
import type { StoreyWarningInput } from './building-warnings';
import { collectBuildingWarnings } from './building-warnings';
import type { DuctId } from './ducts';
import type { FurnitureId } from './furniture';
import type { StairId } from './stairs';
import type { StoreyId } from './storeys';
import type { WallId } from './walls';

const STOREY_ID = 'storey-1' as StoreyId;

function square(x: number, y: number, size: number): MultiPolygon {
  return [
    {
      outer: [
        { x, y },
        { x: x + size, y },
        { x: x + size, y: y + size },
        { x, y: y + size },
      ],
      holes: [],
    },
  ];
}

function storey(overrides: Partial<StoreyWarningInput> = {}): StoreyWarningInput {
  return {
    storeyId: STOREY_ID,
    heightMeters: 2.7,
    footprint: square(0, 0, 10),
    stairwell: [],
    furniture: [],
    walls: [],
    stairs: [],
    supportPositions: [],
    footprintBelow: undefined,
    overhang: [],
    overhangMeters: 0,
    overhangAt: undefined,
    roofPitchDegrees: undefined,
    rooms: [],
    ventPositions: [],
    saunaStovePositions: [],
    strandedDucts: [],
    ...overrides,
  };
}

describe('collectBuildingWarnings', () => {
  it('says nothing about a plain, sound storey', () => {
    expect(collectBuildingWarnings([storey()])).toHaveLength(0);
  });

  it('flags a piece of furniture standing over the stairwell', () => {
    const warnings = collectBuildingWarnings([
      storey({
        stairwell: square(2, 2, 2),
        furniture: [
          { id: 'over' as FurnitureId, position: { x: 3, y: 3 } },
          { id: 'beside' as FurnitureId, position: { x: 8, y: 8 } },
        ],
      }),
    ]);

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ kind: 'furniture-over-stairwell', furnitureId: 'over' });
  });

  it('flags a wall drawn across the stairwell', () => {
    const warnings = collectBuildingWarnings([
      storey({
        stairwell: square(2, 2, 2),
        walls: [{ id: 'crossing' as WallId, body: square(1, 2.5, 5) }],
      }),
    ]);

    expect(warnings[0]).toMatchObject({ kind: 'wall-over-stairwell', wallId: 'crossing' });
  });

  it('flags a stair whose steps left the comfortable bands', () => {
    const warnings = collectBuildingWarnings([
      storey({
        stairs: [
          { id: 'steep' as StairId, position: { x: 4, y: 4 }, isComfortable: false },
          { id: 'fine' as StairId, position: { x: 6, y: 6 }, isComfortable: true },
        ],
      }),
    ]);

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ kind: 'stair-uncomfortable', stairId: 'steep' });
  });

  it('leaves a modest overhang alone and flags a long one', () => {
    const modest = collectBuildingWarnings([
      storey({
        footprintBelow: square(0, 0, 10),
        overhang: square(10, 4, 1),
        overhangMeters: 0.4,
        overhangAt: { x: 10.5, y: 4.5 },
      }),
    ]);
    const long = collectBuildingWarnings([
      storey({
        footprintBelow: square(0, 0, 10),
        overhang: square(10, 4, 2),
        overhangMeters: 1.2,
        overhangAt: { x: 11, y: 5 },
      }),
    ]);

    expect(modest).toHaveLength(0);
    expect(long[0]).toMatchObject({ kind: 'cantilever-unsupported', needsEngineering: false });
  });

  it('clears the overhang finding once a post stands under it', () => {
    const warnings = collectBuildingWarnings([
      storey({
        footprintBelow: square(0, 0, 10),
        overhang: square(10, 4, 2),
        overhangMeters: 1.2,
        overhangAt: { x: 11, y: 5 },
        supportPositions: [{ x: 11, y: 5 }],
      }),
    ]);

    expect(warnings).toHaveLength(0);
  });

  it('does not count a post standing on the storey below as holding the overhang', () => {
    const warnings = collectBuildingWarnings([
      storey({
        footprintBelow: square(0, 0, 10),
        overhang: square(10, 4, 2),
        overhangMeters: 1.2,
        overhangAt: { x: 11, y: 5 },
        supportPositions: [{ x: 5, y: 5 }],
      }),
    ]);

    expect(warnings).toHaveLength(1);
  });

  it('does not count a post standing away in the garden either', () => {
    const warnings = collectBuildingWarnings([
      storey({
        footprintBelow: square(0, 0, 10),
        overhang: square(10, 4, 2),
        overhangMeters: 1.2,
        overhangAt: { x: 11, y: 5 },
        // Outside the storey below, but nowhere near what it would hold up.
        supportPositions: [{ x: 30, y: 30 }],
      }),
    ]);

    expect(warnings).toHaveLength(1);
  });

  it('says an overhang past the engineered limit needs a calculation', () => {
    const warnings = collectBuildingWarnings([
      storey({
        footprintBelow: square(0, 0, 10),
        overhang: square(10, 4, 3),
        overhangMeters: 2,
        overhangAt: { x: 11, y: 5 },
      }),
    ]);

    expect(warnings[0]).toMatchObject({ needsEngineering: true });
  });

  it('asks a wet room for a shaft of its own, and stops once it has one', () => {
    const bathroom = {
      roomTypeId: 'bathroom' as const,
      polygons: square(0, 0, 3),
      at: { x: 1.5, y: 1.5 },
    };

    expect(collectBuildingWarnings([storey({ rooms: [bathroom] })])[0]).toMatchObject({
      kind: 'room-without-exhaust',
      roomTypeId: 'bathroom',
    });
    // A shaft elsewhere on the storey is not this room's ventilation.
    expect(
      collectBuildingWarnings([storey({ rooms: [bathroom], ventPositions: [{ x: 8, y: 8 }] })])
    ).toHaveLength(1);
    expect(
      collectBuildingWarnings([storey({ rooms: [bathroom], ventPositions: [{ x: 1.5, y: 1.5 }] })])
    ).toHaveLength(0);
    // A living room breathes through its window.
    expect(
      collectBuildingWarnings([storey({ rooms: [{ ...bathroom, roomTypeId: 'living' as const }] })])
    ).toHaveLength(0);
  });

  it('asks a sauna for a stove as well as for its shaft', () => {
    const sauna = {
      roomTypeId: 'sauna' as const,
      polygons: square(0, 0, 3),
      at: { x: 1.5, y: 1.5 },
    };
    const ventilated = { rooms: [sauna], ventPositions: [{ x: 1.5, y: 1.5 }] };

    expect(collectBuildingWarnings([storey(ventilated)])[0]).toMatchObject({
      kind: 'sauna-without-stove',
    });
    expect(
      collectBuildingWarnings([storey({ ...ventilated, saunaStovePositions: [{ x: 1, y: 1 }] })])
    ).toHaveLength(0);
  });

  it('says a shaft standing off the roof comes out of nothing', () => {
    const warnings = collectBuildingWarnings([
      storey({ strandedDucts: [{ id: 'flue' as DuctId, at: { x: 20, y: 20 } }] }),
    ]);

    expect(warnings[0]).toMatchObject({ kind: 'duct-outside-roof', ductId: 'flue' });
  });

  it('says a roof too flat to shed will hold the snow', () => {
    const warnings = collectBuildingWarnings([storey({ roofPitchDegrees: 8 })]);

    expect(warnings[0]).toMatchObject({ kind: 'roof-too-flat', pitchDegrees: 8 });
    expect(collectBuildingWarnings([storey({ roofPitchDegrees: 30 })])).toHaveLength(0);
  });

  it('flags a storey nobody could live on', () => {
    const warnings = collectBuildingWarnings([storey({ heightMeters: 1.9 })]);

    expect(warnings[0]).toMatchObject({ kind: 'storey-too-low', heightMeters: 1.9 });
  });
});
