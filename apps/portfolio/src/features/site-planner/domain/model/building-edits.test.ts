import { assert } from '@frozik/utils/assert/assert';
import { describe, expect, it } from 'vitest';
import { createBuilding, openingsOf, storeysOf } from './building';
import { translateBuilding } from './building-edits';
import { addDevice } from './device-edits';
import { createCeilingLight, createWallDevice } from './electrical';
import { createOpening } from './openings';
import { devicesOf } from './storeys';
import { addOpening, addWall } from './wall-edits';
import { createWall } from './walls';

describe('translateBuilding', () => {
  it('carries the whole interior with the slab and leaves hosted offsets alone', () => {
    const building = createBuilding({ name: 'Дом' });
    const wall = createWall({
      points: [
        { x: 0, y: 0 },
        { x: 6, y: 0 },
      ],
    });
    const storeyId = storeysOf(building)[0].id;
    const opening = createOpening({ wallId: wall.id, preset: 'window', offsetMeters: 2 });
    const outlet = createWallDevice({ kind: 'outlet', wallId: wall.id, offsetMeters: 4 });
    const light = createCeilingLight({ x: 3, y: 1 });
    const withInterior = addDevice(
      addDevice(
        addOpening(addWall([building], building.id, storeyId, wall), building.id, opening),
        building.id,
        storeyId,
        outlet
      ),
      building.id,
      storeyId,
      light
    );

    const moved = translateBuilding(withInterior[0], { x: 10, y: -2 });
    const storey = storeysOf(moved)[0];

    expect(storey.walls[0].points).toEqual([
      { x: 10, y: -2 },
      { x: 16, y: -2 },
    ]);

    const devices = devicesOf(storey);
    const movedLight = devices.find(device => device.kind === 'light');
    const movedOutlet = devices.find(device => device.kind === 'outlet');

    assert(movedLight?.host.kind === 'ceiling', 'expected the ceiling light');
    expect(movedLight.host.position).toEqual({ x: 13, y: -1 });
    // Hosted by offset along the wall — it rides the wall, no move needed.
    assert(movedOutlet?.host.kind === 'wall', 'expected the wall outlet');
    expect(movedOutlet.host.offsetMeters).toBeCloseTo(4);
    expect(openingsOf(moved)[0].offsetMeters).toBeCloseTo(2);
  });
});
