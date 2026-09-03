import { assert } from '@frozik/utils/assert/assert';
import { describe, expect, it } from 'vitest';
import { addDevice } from './device-edits';
import { createWallDevice } from './electrical';
import { createOpening } from './openings';
import { createBuilding, openingsOf, storeysOf, wallsOf } from './site-plan';
import { devicesOf } from './storeys';
import { addOpening, addWall, closeWallRing, cutWallAtPoint, removeWallPoint } from './wall-edits';
import { createWall } from './walls';

describe('wall contour edits', () => {
  const RING_POINTS = [
    { x: 0, y: 0 },
    { x: 6, y: 0 },
    { x: 6, y: 6 },
    { x: 0, y: 6 },
  ];

  const buildRing = () => {
    const building = createBuilding({ name: 'Дом' });
    const wall = { ...createWall({ points: RING_POINTS }), isClosed: true };
    const storeyId = storeysOf(building)[0].id;
    const withWall = addWall([building], building.id, storeyId, wall);

    return { buildings: withWall, building, wall, storeyId };
  };

  it('closes an open wall into a ring, collapsing coincident ends', () => {
    const building = createBuilding({ name: 'Дом' });
    const wall = createWall({ points: [...RING_POINTS, RING_POINTS[0]] });
    const withWall = addWall([building], building.id, storeysOf(building)[0].id, wall);

    const closed = wallsOf(closeWallRing(withWall, building.id, wall.id)[0])[0];

    expect(closed.isClosed).toBe(true);
    expect(closed.points).toEqual(RING_POINTS);
  });

  it('refuses to close below a triangle of corners', () => {
    const building = createBuilding({ name: 'Дом' });
    const wall = createWall({ points: RING_POINTS.slice(0, 2) });
    const withWall = addWall([building], building.id, storeysOf(building)[0].id, wall);

    expect(wallsOf(closeWallRing(withWall, building.id, wall.id)[0])[0].isClosed).toBeUndefined();
  });

  it('cuts a ring open at a corner and rotates every hosted offset with it', () => {
    const { buildings, building, wall, storeyId } = buildRing();
    // Offset 8 on the 24 m loop: two metres past the second corner.
    const opening = createOpening({ wallId: wall.id, preset: 'window', offsetMeters: 8 });
    const device = createWallDevice({ kind: 'outlet', wallId: wall.id, offsetMeters: 20 });
    const withHosted = addDevice(
      addOpening(buildings, building.id, opening),
      building.id,
      storeyId,
      device
    );

    const cut = cutWallAtPoint(withHosted, building.id, wall.id, 1);
    const [cutWall] = wallsOf(cut[0]);

    // Re-rooted at the cut corner, ends coincident but no longer joined.
    expect(cutWall.isClosed).toBe(false);
    expect(cutWall.points[0]).toEqual(RING_POINTS[1]);
    expect(cutWall.points[cutWall.points.length - 1]).toEqual(RING_POINTS[1]);

    // The cut sits 6 m into the old loop, so 8 → 2 and 20 → 14.
    expect(openingsOf(cut[0])[0].offsetMeters).toBeCloseTo(2);

    const [movedDevice] = devicesOf(storeysOf(cut[0])[0]);

    assert(movedDevice.host.kind === 'wall', 'expected a wall-hosted device');
    expect(movedDevice.host.offsetMeters).toBeCloseTo(14);
  });

  it('splits an open wall in two at an interior corner, dealing hosted things out', () => {
    const building = createBuilding({ name: 'Дом' });
    const wall = { ...createWall({ points: RING_POINTS.slice(0, 3) }), thicknessMeters: 0.5 };
    const storeyId = storeysOf(building)[0].id;
    const opening = createOpening({ wallId: wall.id, preset: 'window', offsetMeters: 8 });
    const withHosted = addOpening(
      addWall([building], building.id, storeyId, wall),
      building.id,
      opening
    );

    const split = cutWallAtPoint(withHosted, building.id, wall.id, 1);
    const walls = wallsOf(split[0]);

    expect(walls).toHaveLength(2);
    expect(walls[0].points).toEqual(RING_POINTS.slice(0, 2));
    expect(walls[1].points).toEqual(RING_POINTS.slice(1, 3));
    // The second half inherits the construction, not the material default.
    expect(walls[1].thicknessMeters).toBeCloseTo(0.5);

    const [movedOpening] = openingsOf(split[0]);

    expect(movedOpening.wallId).toBe(walls[1].id);
    expect(movedOpening.offsetMeters).toBeCloseTo(2);
  });

  it("refuses a cut at an open wall's endpoint", () => {
    const building = createBuilding({ name: 'Дом' });
    const wall = createWall({ points: RING_POINTS.slice(0, 3) });
    const withWall = addWall([building], building.id, storeysOf(building)[0].id, wall);

    expect(cutWallAtPoint(withWall, building.id, wall.id, 0)).toEqual(withWall);
  });

  it('keeps a ring at its triangle and an open run at its segment', () => {
    const { buildings, building, wall } = buildRing();
    const triangle = removeWallPoint(buildings, building.id, wall.id, 0);

    expect(wallsOf(triangle[0])[0].points).toHaveLength(3);
    expect(wallsOf(removeWallPoint(triangle, building.id, wall.id, 0)[0])[0].points).toHaveLength(
      3
    );
  });
});
