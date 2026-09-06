import { assertNever } from '@frozik/utils/assert/assertNever';
import { isNil } from 'lodash-es';
import { makeAutoObservable, observableRef } from 'mobx';
import {
  findBuilding as findBuildingIn,
  updateBuilding as updateBuildingIn,
} from '../domain/model/building-edits';
import {
  addTerm,
  moveTerm as moveTermIn,
  removeTerm as removeTermFrom,
  reorderTerm as reorderTermIn,
  updateShape as replaceShapeIn,
  setTermOperation as setTermOperationIn,
  ungroupTerm as ungroupTermIn,
  wrapTermInGroup as wrapTermInGroupIn,
} from '../domain/model/composition-edits';

import type { ActiveGroup, Selection, ShapeOwner } from '../domain/model/selection';
import type {
  CsgOperation,
  CsgTerm,
  GroupTerm,
  Shape,
  ShapeComposition,
  ShapeId,
} from '../domain/model/shapes';
import {
  createShapeId,
  findGroupTerm,
  findShape,
  findTerm,
  flattenShapes,
  shapesExcept,
} from '../domain/model/shapes';
import type { Building, BuildingId } from '../domain/model/site-plan';
import type { PlanEditorCore } from './editor-core';

const NO_SHAPES: readonly Shape[] = [];
const DEFAULT_ACTIVE_GROUP: ActiveGroup = { owner: 'boundary', groupId: undefined };
const NO_SELECTIONS: readonly Selection[] = [];

/** What a selection points at, for the two kinds that point at a term operand. */
interface SelectedOperand {
  readonly owner: ShapeOwner;
  readonly operandId: ShapeId;
}

function selectedOperand(selection: Selection | undefined): SelectedOperand | undefined {
  if (isNil(selection)) {
    return undefined;
  }

  switch (selection.kind) {
    case 'shape':
      return { owner: selection.owner, operandId: selection.shapeId };
    case 'group':
      return { owner: selection.owner, operandId: selection.groupId };
    case 'mark':
    case 'tree':
    case 'car':
    case 'path':
    case 'building':
    case 'wall':
    case 'opening':
    case 'furniture':
    case 'device':
    case 'stair':
    case 'support':
    case 'slab':
    case 'fireplace':
    case 'duct':
    case 'utilityRoute':
    case 'utilityEntry':
      return undefined;
    default:
      return assertNever(selection);
  }
}

/**
 * Free function rather than a method: `makeAutoObservable` turns methods into
 * actions, and an action runs untracked — the section reads would not register
 * as dependencies of the computed that calls it.
 */
function resolveComposition(
  owner: ShapeOwner,
  boundary: ShapeComposition,
  buildings: readonly Building[]
): ShapeComposition | undefined {
  return owner === 'boundary' ? boundary : findBuildingIn(buildings, owner)?.composition;
}

/**
 * The CSG side of the plan: the boundary's and every building's composition —
 * terms added, shaped, folded into groups and removed — plus what the current
 * selection names inside them. Owns the active-group arming; the compositions
 * themselves live in the document (the core).
 */
export class CompositionModel {
  /** Where a newly drawn shape joins the tree, chosen in the structure panel. */
  activeGroup: ActiveGroup = DEFAULT_ACTIVE_GROUP;

  private readonly core: PlanEditorCore;

  constructor(core: PlanEditorCore) {
    this.core = core;

    makeAutoObservable<CompositionModel, 'core'>(
      this,
      { core: false, activeGroup: observableRef },
      { autoBind: true }
    );
  }

  /**
   * The shape the properties panel and the plan chrome act on. A floor slab is
   * a shape like any other, so it answers here too — which is what gives it the
   * selection outline, the grips, the dimension lines and the typed fields
   * without a second implementation of any of them.
   */
  get selectedShape(): Shape | undefined {
    const { selection } = this.core;

    if (selection?.kind === 'slab') {
      return this.core.activeStoreySlabs.find(candidate => candidate.id === selection.slabId);
    }

    if (isNil(selection) || selection.kind !== 'shape') {
      return undefined;
    }

    const composition = resolveComposition(
      selection.owner,
      this.core.boundary,
      this.core.buildings
    );

    return isNil(composition) ? undefined : findShape(composition, selection.shapeId);
  }

  /**
   * The group the structure panel has selected, with the operation it joins its
   * parent fold with — the two things the properties panel shows for it.
   */
  get selectedGroupTerm(): GroupTerm | undefined {
    const { selection } = this.core;

    if (isNil(selection) || selection.kind !== 'group') {
      return undefined;
    }

    const composition = resolveComposition(
      selection.owner,
      this.core.boundary,
      this.core.buildings
    );

    return isNil(composition) ? undefined : findGroupTerm(composition, selection.groupId);
  }

  /**
   * Where a shape drawn now would actually land. The chosen group is checked
   * against the plan every time it is read: an undo, an import or the removal of
   * an ancestor can take a group away, and a shape aimed at one that is no longer
   * there has to land in the root of its composition rather than nowhere at all.
   */
  get resolvedActiveGroup(): ActiveGroup {
    const { activeGroup } = this;
    const { owner, groupId } = activeGroup;

    if (isNil(groupId)) {
      return activeGroup;
    }

    const composition = resolveComposition(owner, this.core.boundary, this.core.buildings);
    const isPresent = !isNil(composition) && !isNil(findGroupTerm(composition, groupId));

    return isPresent ? activeGroup : { owner, groupId: undefined };
  }

  /** Every parametric shape on the plan, the plot's terms before the house's. */
  get allShapes(): readonly Shape[] {
    return [
      ...flattenShapes(this.core.boundary),
      ...this.core.buildings.flatMap(building => flattenShapes(building.composition)),
    ];
  }

  /**
   * The shapes drawn as skeletons while a gesture is running: every one of both
   * groups but the one being shaped. Nothing while nothing is in flight — the
   * skeletons are there to aim at, and a still plan has nothing to aim.
   */
  get gestureSkeletonShapes(): readonly Shape[] {
    const { draftShape } = this.core;

    return isNil(draftShape) ? NO_SHAPES : shapesExcept(this.allShapes, draftShape.id);
  }

  /** Nothing for the group means the root term list of the owning composition. */
  setActiveGroup(owner: ShapeOwner, groupId?: ShapeId): void {
    this.activeGroup = { owner, groupId };
  }

  /** Replaces a building's whole footprint — a drag in flight, or its restore. */
  setBuildingComposition(buildingId: BuildingId, composition: ShapeComposition): void {
    this.core.buildings = updateBuildingIn(this.core.buildings, buildingId, { composition });
  }

  /**
   * Appends a term to the named group, or to the root of the composition when no
   * group is named. The first shape drawn into the house also creates the
   * footprint — which has no groups yet, so that term can only land at its root.
   */
  addShapeTerm(owner: ShapeOwner, shape: Shape, operation: CsgOperation, groupId?: ShapeId): void {
    const term: CsgTerm = { operand: shape, operation };

    this.core.pushHistory();
    this.updateComposition(owner, composition => addTerm(composition, term, groupId));
  }

  updateShape(owner: ShapeOwner, shape: Shape): void {
    this.updateComposition(owner, composition => replaceShapeIn(composition, shape));
  }

  /** The keyboard path of R20: the properties panel edits whatever is selected. */
  updateSelectedShape(shape: Shape): void {
    const { selection } = this.core;

    if (selection?.kind === 'slab') {
      this.core.updateSlab(selection.buildingId, shape);

      return;
    }

    if (isNil(selection) || selection.kind !== 'shape') {
      return;
    }

    this.updateShape(selection.owner, shape);
  }

  toggleTermOperation(owner: ShapeOwner, operandId: ShapeId): void {
    this.core.pushHistory();
    this.updateComposition(owner, composition => {
      const term = findTerm(composition, operandId);

      if (isNil(term)) {
        return composition;
      }

      return setTermOperationIn(
        composition,
        operandId,
        term.operation === 'union' ? 'subtract' : 'union'
      );
    });
  }

  reorderTerm(owner: ShapeOwner, operandId: ShapeId, targetIndex: number): void {
    this.core.pushHistory();
    this.updateComposition(owner, composition =>
      reorderTermIn(composition, operandId, targetIndex)
    );
  }

  /**
   * Drags a term to another place in the tree: into the named group, or into the
   * root of its composition when none is named. The edit is run before the step
   * is announced — a drop that changes nothing (onto its own place, or into the
   * term's own subtree) must not cost the user an empty undo.
   */
  moveTerm(
    owner: ShapeOwner,
    operandId: ShapeId,
    targetGroupId: ShapeId | undefined,
    targetIndex: number
  ): void {
    const composition = resolveComposition(owner, this.core.boundary, this.core.buildings);

    if (isNil(composition)) {
      return;
    }

    const moved = moveTermIn(composition, operandId, targetGroupId, targetIndex);

    if (moved === composition) {
      return;
    }

    this.core.pushHistory();
    this.updateComposition(owner, () => moved);
  }

  /**
   * Puts the term into a group of its own. The new group is handed straight to
   * the user — selected, and active — so the next shape drawn lands inside it,
   * which is the whole reason for wrapping a term in the first place.
   */
  wrapTermInGroup(owner: ShapeOwner, operandId: ShapeId): void {
    const groupId = createShapeId();

    this.core.pushHistory();
    this.updateComposition(owner, composition =>
      wrapTermInGroupIn(composition, operandId, groupId)
    );

    const composition = resolveComposition(owner, this.core.boundary, this.core.buildings);

    if (!isNil(composition) && !isNil(findGroupTerm(composition, groupId))) {
      this.core.selections = [{ kind: 'group', owner, groupId }];
      this.activeGroup = { owner, groupId };
    }
  }

  /** Inlines the terms of the group in its place; the group itself ceases to be. */
  ungroupTerm(owner: ShapeOwner, groupId: ShapeId): void {
    this.core.pushHistory();
    this.updateComposition(owner, composition => ungroupTermIn(composition, groupId));
    this.dropSelectionOf(owner, groupId);
  }

  removeTerm(owner: ShapeOwner, operandId: ShapeId): void {
    this.core.pushHistory();
    this.updateComposition(owner, composition => removeTermFrom(composition, operandId));
    this.dropSelectionOf(owner, operandId);
  }

  /** Drops the selection when the operand it named has just left the plan. */
  private dropSelectionOf(owner: ShapeOwner, operandId: ShapeId): void {
    const selected = selectedOperand(this.core.selection);

    if (!isNil(selected) && selected.owner === owner && selected.operandId === operandId) {
      this.core.selections = NO_SELECTIONS;
    }
  }

  private updateComposition(
    owner: ShapeOwner,
    update: (composition: ShapeComposition) => ShapeComposition
  ): void {
    if (owner === 'boundary') {
      this.core.boundary = update(this.core.boundary);

      return;
    }

    const building = findBuildingIn(this.core.buildings, owner);

    if (isNil(building)) {
      return;
    }

    this.core.buildings = updateBuildingIn(this.core.buildings, owner, {
      composition: update(building.composition),
    });
  }

  /** Owns no timer or subscription; here so the store's teardown chain names every model. */
  dispose(): void {}
}
