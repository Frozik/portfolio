import { describe, expect, it } from 'vitest';

import { createBuilding, storeysOf } from './building';
import { addStorey, updateStoreyHeight } from './storey-edits';
import { createStorey } from './storeys';

describe('storey height edits', () => {
  it('materializes storeys and sets the addressed height only', () => {
    const building = createBuilding({ name: 'Дом' });
    const groundId = storeysOf(building)[0].id;
    const withUpper = addStorey([building], building.id, createStorey({ heightMeters: 2.7 }));
    const upperId = storeysOf(withUpper[0])[1].id;

    const edited = updateStoreyHeight(withUpper, building.id, upperId, 3.2)[0];

    expect(storeysOf(edited)[1].heightMeters).toBe(3.2);
    expect(storeysOf(edited)[0].heightMeters).toBe(building.wallHeight);
    expect(storeysOf(edited)[0].id).toBe(groundId);
  });

  it('detaches the materialized ground storey from later wallHeight edits', () => {
    const building = createBuilding({ name: 'Дом' });
    const groundId = storeysOf(building)[0].id;

    const edited = updateStoreyHeight([building], building.id, groundId, 3.0)[0];
    const raised = { ...edited, wallHeight: 9 };

    expect(storeysOf(raised)[0].heightMeters).toBe(3.0);
  });
});
