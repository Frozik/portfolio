import { isNil } from 'lodash-es';
import { makeAutoObservable } from 'mobx';

import { storeysOf } from '../domain/model/building';
import { findBuilding } from '../domain/model/building-edits';
import type { BuildingLayerId } from '../domain/model/building-layers';
import {
  BUILDING_LAYER_IDS,
  countLayerObjects,
  cycleBuildingLayer,
  isSelectionOnLayer,
} from '../domain/model/building-layers';
import type { PlanLayerKind } from '../domain/view/plan-layers';
import type { PlanEditorCore } from './editor-core';

const NO_COUNTS: Readonly<Record<BuildingLayerId, number>> = {
  structure: 0,
  walls: 0,
  furniture: 0,
  electrical: 0,
  services: 0,
};

/**
 * The layers of the open building (`layers.md`): which one is being worked
 * in, and which are shown. Activity is the editor session's; visibility is
 * the viewport's, shared with the plan's own layers — this model is the one
 * place the two meet, so the invariant «the active layer is always visible»
 * has one owner.
 */
export class LayersModel {
  private readonly core: PlanEditorCore;

  constructor(core: PlanEditorCore) {
    this.core = core;

    makeAutoObservable<LayersModel, 'core'>(this, { core: false }, { autoBind: true });
  }

  /** The layer being worked in; nothing outside the building editor. */
  get activeLayer(): BuildingLayerId | undefined {
    const session = this.core.editorSession;

    return session?.kind === 'building' ? session.activeLayer : undefined;
  }

  /**
   * Aims the editor at a layer. What was selected and what was half-drawn
   * belongs to the layer being left, so it is dropped — as it is when the
   * storey changes — and a tool the new layer does not carry gives way to
   * selection. A hidden layer comes back into view: working in what cannot be
   * seen is not a state this editor has.
   */
  setActiveLayer(layer: BuildingLayerId): void {
    const session = this.core.editorSession;

    if (session?.kind !== 'building' || session.activeLayer === layer) {
      return;
    }

    session.setActiveLayer(layer);
    session.clearDraftWall();
    session.setPendingConnectDeviceId(undefined);

    if (!this.core.view.visibleLayers.has(layer)) {
      this.core.view.toggleLayerVisibility(layer);
    }

    this.core.setSelections(
      this.core.selections.filter(candidate => isSelectionOnLayer(candidate, layer))
    );
    this.core.setActiveTool('select');
  }

  /** Q and Shift+Q: the next layer round, the previous one back. */
  cycleActiveLayer(direction: 1 | -1): void {
    const { activeLayer } = this;

    if (!isNil(activeLayer)) {
      this.setActiveLayer(cycleBuildingLayer(activeLayer, direction));
    }
  }

  isLayerVisible(layer: PlanLayerKind): boolean {
    return this.core.view.visibleLayers.has(layer);
  }

  /** The active layer cannot be hidden: the eye of the layer in hand is refused. */
  canToggleLayerVisibility(layer: PlanLayerKind): boolean {
    return layer !== this.activeLayer;
  }

  toggleLayerVisibility(layer: PlanLayerKind): void {
    if (this.canToggleLayerVisibility(layer)) {
      this.core.view.toggleLayerVisibility(layer);
    }
  }

  /** Illustrator's «Hide Others»: only the active layer stays on the plan. */
  hideOtherLayers(): void {
    for (const layer of BUILDING_LAYER_IDS) {
      if (layer !== this.activeLayer && this.isLayerVisible(layer)) {
        this.core.view.toggleLayerVisibility(layer);
      }
    }
  }

  showAllLayers(): void {
    for (const layer of BUILDING_LAYER_IDS) {
      if (!this.isLayerVisible(layer)) {
        this.core.view.toggleLayerVisibility(layer);
      }
    }
  }

  /** What each layer holds on the active storey, for the layer menu. */
  get objectCounts(): Readonly<Record<BuildingLayerId, number>> {
    const session = this.core.editorSession;

    if (session?.kind !== 'building') {
      return NO_COUNTS;
    }

    const building = findBuilding(this.core.buildings, session.buildingId);
    const storey = isNil(building)
      ? undefined
      : storeysOf(building).find(candidate => candidate.id === this.core.activeStoreyId);

    return isNil(building) || isNil(storey) ? NO_COUNTS : countLayerObjects(building, storey);
  }

  /** Owns no timer or subscription; here so the store's teardown chain names every model. */
  dispose(): void {}
}
