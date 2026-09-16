import { describe, expect, it } from 'vitest';

import { createWallDevice } from '../model/electrical';
import { createOpening } from '../model/openings';
import { createWall } from '../model/walls';
import { buildWallElevation } from './wall-elevation';

describe('buildWallElevation', () => {
  it('unfolds the wall with its own openings and devices, others left out', () => {
    const wall = createWall({
      points: [
        { x: 0, y: 0 },
        { x: 6, y: 0 },
      ],
    });
    const other = createWall({
      points: [
        { x: 0, y: 4 },
        { x: 6, y: 4 },
      ],
    });
    const elevation = buildWallElevation({
      wall,
      openings: [
        createOpening({ wallId: wall.id, offsetMeters: 2, preset: 'window' }),
        createOpening({ wallId: other.id, offsetMeters: 3, preset: 'door' }),
      ],
      devices: [
        createWallDevice({ kind: 'outlet', wallId: wall.id, offsetMeters: 4 }),
        createWallDevice({ kind: 'switch', wallId: other.id, offsetMeters: 1 }),
      ],
      storeyHeightMeters: 2.7,
    });

    expect(elevation.lengthMeters).toBeCloseTo(6);
    expect(elevation.openings).toHaveLength(1);
    expect(elevation.openings[0].fromMeters).toBeCloseTo(1.4);
    expect(elevation.devices).toEqual([
      expect.objectContaining({ kind: 'outlet', alongMeters: 4, heightMeters: 0.3 }),
    ]);
    expect(elevation.runHeightMeters).toBeCloseTo(2.55);
  });
});
