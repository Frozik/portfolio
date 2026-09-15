import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { ISitePlanRepository } from '../domain/persistence/ISitePlanRepository';
import { SitePlannerStore } from './SitePlannerStore';

const NO_STORAGE: ISitePlanRepository = {
  loadPlan: () => Promise.resolve({ kind: 'empty' as const }),
  savePlan: () => Promise.resolve(),
};

describe('LayersModel', () => {
  let store: SitePlannerStore;

  const openHouse = (): void => {
    const building = store.building.addBuilding('Дом');

    store.enterEditMode({ kind: 'building', buildingId: building.id });
  };

  beforeEach(() => {
    store = new SitePlannerStore(NO_STORAGE);
  });

  afterEach(() => {
    store.dispose();
  });

  it('has no active layer outside the building editor and opens on the walls', () => {
    expect(store.layers.activeLayer).toBeUndefined();

    openHouse();

    expect(store.layers.activeLayer).toBe('walls');
  });

  it('drops the tool of the layer being left and the selection with it', () => {
    openHouse();
    store.setActiveTool('building:wall');
    store.setSelection({ kind: 'building', buildingId: store.buildings[0].id });

    store.layers.setActiveLayer('furniture');

    expect(store.activeTool).toBe('select');
    expect(store.layers.activeLayer).toBe('furniture');
    // A layerless selection survives the switch; only the left layer's goes.
    expect(store.selection?.kind).toBe('building');
  });

  it('drops a wall in progress with the layer it was drawn on', () => {
    openHouse();
    store.wallDraft.appendDraftWallPoint({ x: 0, y: 0 });
    store.wallDraft.appendDraftWallPoint({ x: 4, y: 0 });

    store.layers.setActiveLayer('furniture');

    expect(store.wallDraft.draftWallPoints).toHaveLength(0);
  });

  it('refuses to hide the active layer and shows a hidden one on activation', () => {
    openHouse();

    store.layers.toggleLayerVisibility('walls');

    expect(store.layers.isLayerVisible('walls')).toBe(true);

    store.layers.toggleLayerVisibility('furniture');

    expect(store.layers.isLayerVisible('furniture')).toBe(false);

    store.layers.setActiveLayer('furniture');

    expect(store.layers.isLayerVisible('furniture')).toBe(true);
  });

  it('hides every other layer and brings them all back', () => {
    openHouse();

    store.layers.hideOtherLayers();

    expect(store.layers.isLayerVisible('walls')).toBe(true);
    expect(store.layers.isLayerVisible('electrical')).toBe(false);

    store.layers.showAllLayers();

    expect(store.layers.isLayerVisible('electrical')).toBe(true);
  });

  it('keeps the visibility across editor visits but not the active layer', () => {
    openHouse();
    store.layers.setActiveLayer('electrical');
    store.layers.toggleLayerVisibility('furniture');
    store.exitEditMode();
    openHouse();

    expect(store.layers.activeLayer).toBe('walls');
    expect(store.layers.isLayerVisible('furniture')).toBe(false);
  });

  it('cycles through the layers in rail order and wraps', () => {
    openHouse();

    store.layers.cycleActiveLayer(-1);

    expect(store.layers.activeLayer).toBe('structure');

    store.layers.cycleActiveLayer(-1);

    expect(store.layers.activeLayer).toBe('services');
  });
});
