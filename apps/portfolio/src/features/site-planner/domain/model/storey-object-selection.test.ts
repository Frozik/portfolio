import { describe, expect, it } from 'vitest';

import type { BuildingId } from './building';
import { createBuilding, storeysOf } from './building';
import type { Building } from './building';
import { createDuct } from './ducts';
import { createCeilingLight } from './electrical';
import { createStair } from './stairs';
import { addStoreyObject } from './storey-edits';
import {
  STOREY_OBJECT_SELECTORS,
  selectedStoreyObject,
  storeyObjectSelector,
} from './storey-object-selection';
import type { StoreyObject, StoreyObjectKind } from './storey-objects';
import { DEVICE_OBJECTS, DUCT_OBJECTS, STAIR_OBJECTS } from './storey-objects';

const AT = { x: 4, y: 4 };

/** A house of one storey with one object standing on it. */
function houseWith<TInstance extends StoreyObject>(
  kind: StoreyObjectKind<TInstance>,
  item: TInstance
): { readonly buildings: readonly Building[]; readonly buildingId: BuildingId } {
  const building = createBuilding({ name: 'Дом' });
  const [storey] = storeysOf(building);

  return {
    buildings: addStoreyObject([building], building.id, storey.id, kind, item),
    buildingId: building.id,
  };
}

describe('the storey-object selector table', () => {
  it('answers for every kind it describes', () => {
    for (const selector of STOREY_OBJECT_SELECTORS) {
      expect(storeyObjectSelector(selector.key)).toBe(selector);
    }
  });

  it('reads back what a selection names, and nothing from a foreign one', () => {
    const stair = createStair({ kind: 'straight', position: AT });
    const { buildingId } = houseWith(STAIR_OBJECTS, stair);
    const named = selectedStoreyObject({ kind: 'stair', buildingId, stairId: stair.id });

    expect(named?.selector.key).toBe('stair');
    expect(named?.id).toBe(stair.id);
    expect(named?.buildingId).toBe(buildingId);
  });

  it('names nothing for a selection outside the family', () => {
    expect(selectedStoreyObject(undefined)).toBeUndefined();
    expect(
      selectedStoreyObject({ kind: 'building', buildingId: '1' as BuildingId })
    ).toBeUndefined();
  });
});

describe('removing through the table', () => {
  it('takes the object off the storey it stood on', () => {
    const stair = createStair({ kind: 'straight', position: AT });
    const { buildings, buildingId } = houseWith(STAIR_OBJECTS, stair);
    const removed = storeyObjectSelector('stair').remove(buildings, buildingId, stair.id);

    expect(STAIR_OBJECTS.read(storeysOf(buildings[0])[0])).toHaveLength(1);
    expect(STAIR_OBJECTS.read(storeysOf(removed[0])[0])).toHaveLength(0);
  });

  it('unwires a device as it removes it', () => {
    const light = createCeilingLight(AT);
    const { buildings, buildingId } = houseWith(DEVICE_OBJECTS, light);
    const removed = storeyObjectSelector('device').remove(buildings, buildingId, light.id);
    const [storey] = storeysOf(removed[0]);

    expect(DEVICE_OBJECTS.read(storey)).toHaveLength(0);
    expect(storey.switchLinks ?? []).toEqual([]);
    expect(storey.groups ?? []).toEqual([]);
  });
});

describe('duplicating through the table', () => {
  it('offsets the copy, mints it an identity and names it back', () => {
    const duct = createDuct({ kind: 'vent', position: AT });
    const { buildings, buildingId } = houseWith(DUCT_OBJECTS, duct);
    const [storey] = storeysOf(buildings[0]);

    const copied = storeyObjectSelector('duct').duplicate?.({
      buildings,
      buildingId,
      storeyId: storey.id,
      id: duct.id,
      offset: { x: 1, y: 1 },
    });

    expect(copied).toBeDefined();

    const ducts = DUCT_OBJECTS.read(storeysOf(copied?.buildings[0] ?? buildings[0])[0]);

    expect(ducts).toHaveLength(2);
    expect(ducts[1].position).toEqual({ x: 5, y: 5 });
    expect(ducts[1].id).not.toBe(duct.id);
    expect(copied?.selection).toMatchObject({ kind: 'duct', ductId: ducts[1].id });
  });

  it('refuses a device: it hangs on a host, and an offset would tear it off', () => {
    expect(storeyObjectSelector('device').duplicate).toBeUndefined();
  });
});
