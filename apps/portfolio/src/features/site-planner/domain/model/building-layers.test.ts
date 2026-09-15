import { describe, expect, it } from 'vitest';

import { createBuilding } from './building';
import {
  BUILDING_LAYER_IDS,
  cycleBuildingLayer,
  isSelectionOnLayer,
  layerOfSelection,
  layerOfWarning,
} from './building-layers';
import { createPathId } from './plot-objects';
import type { StoreyId } from './storeys';
import type { WallId } from './walls';

describe('cycleBuildingLayer', () => {
  it('walks the layers in rail order and wraps at both ends', () => {
    const first = BUILDING_LAYER_IDS[0];
    const last = BUILDING_LAYER_IDS[BUILDING_LAYER_IDS.length - 1];

    expect(cycleBuildingLayer(first, 1)).toBe(BUILDING_LAYER_IDS[1]);
    expect(cycleBuildingLayer(last, 1)).toBe(first);
    expect(cycleBuildingLayer(first, -1)).toBe(last);
  });
});

describe('layerOfSelection', () => {
  const building = createBuilding({ name: 'Дом' });
  const wallId = 'wall-1' as WallId;

  it('places a wall on the walls layer and a path on none', () => {
    expect(layerOfSelection({ kind: 'wall', buildingId: building.id, wallId })).toBe('walls');
    expect(layerOfSelection({ kind: 'path', pathId: createPathId() })).toBeUndefined();
  });

  it('lets a selection through on its own layer and a layerless one on any', () => {
    const wall = { kind: 'wall', buildingId: building.id, wallId } as const;

    expect(isSelectionOnLayer(wall, 'walls')).toBe(true);
    expect(isSelectionOnLayer(wall, 'furniture')).toBe(false);
    expect(isSelectionOnLayer({ kind: 'building', buildingId: building.id }, 'furniture')).toBe(
      true
    );
  });
});

describe('layerOfWarning', () => {
  it('sends a finding to the layer its fix is made on', () => {
    const storeyId = 'storey-1' as StoreyId;
    const at = { x: 0, y: 0 };

    expect(layerOfWarning({ kind: 'sauna-without-stove', storeyId, at })).toBe('services');
    expect(layerOfWarning({ kind: 'storey-too-low', storeyId, at, heightMeters: 2 })).toBe(
      'structure'
    );
  });
});
