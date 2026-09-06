import { assertNever } from '@frozik/utils/assert/assertNever';
import { isNil } from 'lodash-es';
import type { Selection } from '../domain/model/selection';
import { isSameSelection } from '../domain/model/selection';
import { selectedStoreyObject } from '../domain/model/storey-object-selection';
import type { Meters } from '../domain/units';
import type { BuildingModel } from './BuildingModel';
import type { CompositionModel } from './CompositionModel';
import type { PlanEditorCore } from './editor-core';
import type { ElevationMarksModel } from './ElevationMarksModel';
import type { OpeningsModel } from './OpeningsModel';
import type { SiteObjectsModel } from './SiteObjectsModel';
import type { StoreyObjectsEditorModel } from './StoreyObjectsEditorModel';
import type { StoreysModel } from './StoreysModel';
import type { UtilityNetworkModel } from './UtilityNetworkModel';
import type { WallEditorModel } from './WallEditorModel';

const NO_SELECTIONS: readonly Selection[] = [];

/** Every model a selected thing may belong to — where its removal is routed. */
export interface SelectionCommandModels {
  readonly composition: CompositionModel;
  readonly marks: ElevationMarksModel;
  readonly siteObjects: SiteObjectsModel;
  readonly utilities: UtilityNetworkModel;
  readonly building: BuildingModel;
  readonly storeys: StoreysModel;
  readonly walls: WallEditorModel;
  readonly openings: OpeningsModel;
  readonly storeyObjects: StoreyObjectsEditorModel;
}

/**
 * The selection as a whole: Shift-click adding to it, and the commands that
 * act on all of it — Delete and Ctrl+D — however many things of however many
 * kinds it names, as one history step.
 */
export class SelectionCommands {
  private readonly core: PlanEditorCore;
  private readonly models: SelectionCommandModels;

  constructor(core: PlanEditorCore, models: SelectionCommandModels) {
    this.core = core;
    this.models = models;
  }

  /**
   * Shift-click: adds what was clicked to the selection, or takes it back out.
   * The market's grammar — Figma, Blender, SketchUp all read Shift this way.
   */
  toggleSelection(selection: Selection): void {
    const without = this.core.selections.filter(
      candidate => !isSameSelection(candidate, selection)
    );

    this.core.setSelections(
      without.length === this.core.selections.length
        ? [...this.core.selections, selection]
        : without
    );
  }

  /** Whether this exact thing is among the selected — what the plan draws lit. */
  isSelected(selection: Selection): boolean {
    return this.core.selections.some(candidate => isSameSelection(candidate, selection));
  }

  /** Deletes everything selected — one step to undo, however many things. */
  removeSelected(): void {
    const { selections } = this.core;

    if (selections.length === 0) {
      return;
    }

    this.core.pushHistory();
    this.core.runBatched(() => {
      for (const selection of selections) {
        this.removeOneSelected(selection);
      }
    });
    this.core.setSelections(NO_SELECTIONS);
  }

  /**
   * Duplicates whatever is selected, offset by one grid step so the copies
   * are visible and grabbable rather than hidden exactly under the originals.
   * The copies become the selection, so a second Ctrl+D steps on again.
   */
  duplicateSelected(): void {
    const { selections } = this.core;

    if (selections.length === 0) {
      return;
    }

    this.core.pushHistory();

    const offset = this.core.settings.gridStepMeters;
    const copies: Selection[] = [];

    this.core.runBatched(() => {
      for (const selection of selections) {
        copies.push(...this.duplicateOne(selection, offset));
      }
    });

    if (copies.length > 0) {
      this.core.setSelections(copies);
    }
  }

  /**
   * One object's copy, placed a step away; nothing for what cannot be copied.
   *
   * Every storey object copies the same way — find it, mint an id, shift it,
   * put it on the active storey, hand back its selection — so that dance
   * lives once in {@link copyStoreyObject} and a kind contributes only what
   * is different about it. Adding the next kind is three lines here.
   */
  private duplicateOne(selection: Selection, offsetMeters: Meters): readonly Selection[] {
    const selected = selectedStoreyObject(selection);
    const storeyId = this.models.storeys.activeStoreyId;

    // Walls, openings, rooms and site shapes are not copied: each has a host or
    // a place in a tree that a blind offset would misplace, so their kinds
    // contribute no `duplicate` to the table.
    if (isNil(selected) || isNil(storeyId) || isNil(selected.selector.duplicate)) {
      return NO_SELECTIONS;
    }

    const copied = selected.selector.duplicate({
      buildings: this.core.buildings,
      buildingId: selected.buildingId,
      storeyId,
      id: selected.id,
      offset: { x: offsetMeters, y: offsetMeters },
    });

    if (isNil(copied)) {
      return NO_SELECTIONS;
    }

    this.core.buildings = copied.buildings;

    return [copied.selection];
  }

  private removeOneSelected(selection: Selection): void {
    switch (selection.kind) {
      case 'shape':
        this.models.composition.removeTerm(selection.owner, selection.shapeId);

        return;
      case 'group':
        this.models.composition.removeTerm(selection.owner, selection.groupId);

        return;
      case 'mark':
        this.models.marks.removeElevationMark(selection.markId);

        return;
      case 'tree':
        this.models.siteObjects.removeTree(selection.treeId);

        return;
      case 'car':
        this.models.siteObjects.removeCar(selection.carId);

        return;
      case 'path':
        this.models.siteObjects.removePath(selection.pathId);

        return;
      case 'utilityRoute':
        this.models.utilities.removeUtilityRoute(selection.routeId);

        return;
      case 'building':
        this.models.building.removeBuilding(selection.buildingId);

        return;
      case 'wall':
        this.models.walls.removeWall(selection.buildingId, selection.wallId);

        return;
      case 'opening':
        this.models.openings.removeOpening(selection.buildingId, selection.openingId);

        return;
      case 'furniture':
      case 'device':
      case 'stair':
      case 'support':
      case 'slab':
      case 'fireplace':
      case 'duct':
        this.models.storeyObjects.removeSelectedStoreyObject(selection);

        return;
      case 'utilityEntry':
        this.models.utilities.removeUtilityEntry(selection.buildingId, selection.entryId);

        return;
      default:
        assertNever(selection);
    }
  }
}
