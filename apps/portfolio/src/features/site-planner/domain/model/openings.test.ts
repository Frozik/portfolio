import { describe, expect, it } from 'vitest';

import { createOpening } from './openings';
import { createWall } from './walls';

describe('createOpening', () => {
  const wall = createWall({
    points: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ],
  });

  it('mints a door at the floor and a window on a sill', () => {
    const door = createOpening({ wallId: wall.id, preset: 'door', offsetMeters: 3 });
    const window = createOpening({ wallId: wall.id, preset: 'window', offsetMeters: 5 });

    expect(door).toMatchObject({ kind: 'door', sillMeters: 0, headMeters: 2.1, widthMeters: 0.9 });
    expect(window).toMatchObject({ kind: 'window', sillMeters: 0.9, widthMeters: 1.2 });
  });

  it('mints окно в пол as a window whose sill starts at the floor', () => {
    const panoramic = createOpening({ wallId: wall.id, preset: 'panoramic', offsetMeters: 5 });

    expect(panoramic).toMatchObject({
      kind: 'window',
      sillMeters: 0,
      headMeters: 2.5,
      widthMeters: 2.4,
    });
  });
});
