import { assertNever } from '@frozik/utils/assert/assertNever';
import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';
import { makeAutoObservable, observableRef } from 'mobx';
import { DEFAULT_PATH_WIDTH_METERS } from '../domain/constants';
import { dropRepeatedPoints } from '../domain/geometry/dedupe-polyline';
import { buildPathRibbon } from '../domain/geometry/offset-polygon';
import { replaceBuilding as replaceBuildingIn } from '../domain/model/building-edits';
import type { ElevationMarkDraft } from '../domain/model/parse-elevation-csv';
import type { PlacedObject } from '../domain/model/placed-object';
import { CAR_PLACED_OBJECT, DEFAULT_PLACED_OBJECT } from '../domain/model/placed-object';
import type { Selection } from '../domain/model/selection';
import type { SiteObjectState } from '../domain/model/site-object';
import {
  addCar,
  addMark,
  addPath,
  addTree,
  insertPathPoint as insertPathPointIn,
  moveMark,
  movePathPoint as movePathPointIn,
  removeCar as removeCarFrom,
  removeMark,
  removePath as removePathFrom,
  removePathPoint as removePathPointIn,
  removeTree as removeTreeFrom,
  updateCar as replaceCarIn,
  updateTree as replaceTreeIn,
  setMarkElevation as setMarkElevationIn,
  setPathPointWidth as setPathPointWidthIn,
  setPathSegmentSurface as setPathSegmentSurfaceIn,
  updatePath as updatePathIn,
  updatePathWidth as updatePathWidthIn,
} from '../domain/model/site-object-edits';
import type {
  CarId,
  CarInstance,
  ElevationMark,
  MarkId,
  PathId,
  PathSurface,
  SitePath,
  TreeId,
  TreeInstance,
  TreeSpecies,
} from '../domain/model/site-plan';
import {
  createCar,
  createElevationMark,
  createSitePath,
  createTree,
  TREE_SPECIES_DEFAULT_SIZES,
} from '../domain/model/site-plan';
import type { Meters } from '../domain/units';
import type { PlanEditorCore } from './editor-core';
import type { PathDraft } from './render/plan-draw/draw-paths';
import type { UtilityNetworkModel } from './UtilityNetworkModel';

const NO_DRAFT_PATH_POINTS: readonly Vector2[] = [];
const NO_SELECTIONS: readonly Selection[] = [];
const MIN_PATH_POINT_COUNT = 2;
/** A mark starts level with the site datum. */
const NEW_MARK_ELEVATION_METERS: Meters = 0;

function findMark(marks: readonly ElevationMark[], markId: MarkId): ElevationMark | undefined {
  return marks.find(mark => mark.id === markId);
}

/**
 * What stands on the plot outside the buildings: elevation marks, trees, cars
 * and paths, plus the placement tool that drops the armed object. Owns the
 * path draft and the placement arming; the committed objects live in the
 * document (the core).
 */
export class SiteObjectsModel {
  /**
   * The polyline of the path being clicked out, before it reaches the plan. A
   * path is committed as a whole — one step to undo — so the points live here
   * until the user finishes the line.
   */
  draftPathPoints: readonly Vector2[] = NO_DRAFT_PATH_POINTS;

  /**
   * What the placing tool puts on the plan next, chosen from the flyout of the
   * palette's object button. It stays where it is between clicks: placing a row
   * of the same thing is the common case, and a list to pick from before every
   * click would be in the way of it.
   */
  nextPlacedObject: PlacedObject = DEFAULT_PLACED_OBJECT;
  /** The mark whose elevation is being typed into the field floating by its flag. */
  elevationInputMarkId: MarkId | undefined = undefined;

  private readonly core: PlanEditorCore;
  private readonly utilities: UtilityNetworkModel;

  constructor(core: PlanEditorCore, utilities: UtilityNetworkModel) {
    this.core = core;
    this.utilities = utilities;

    makeAutoObservable<SiteObjectsModel, 'core' | 'utilities'>(
      this,
      {
        core: false,
        utilities: false,
        draftPathPoints: observableRef,
        nextPlacedObject: observableRef,
      },
      { autoBind: true }
    );
  }

  /**
   * The live preview of the path being clicked out: the placed points with the
   * cursor as their provisional end, and the ribbon they would become. The
   * cursor is only read while a line is in flight, so pointer moves repaint the
   * plan for this and for nothing else.
   */
  get draftPathPreview(): PathDraft | undefined {
    const { draftPathPoints } = this;

    if (draftPathPoints.length === 0) {
      return undefined;
    }

    const cursor = this.core.cursorPlanPoint;
    const points = isNil(cursor) ? draftPathPoints : [...draftPathPoints, cursor];

    return { points, ribbon: buildPathRibbon(points, DEFAULT_PATH_WIDTH_METERS) };
  }

  get selectedTree(): TreeInstance | undefined {
    const { selection } = this.core;

    return isNil(selection) || selection.kind !== 'tree'
      ? undefined
      : this.core.trees.find(tree => tree.id === selection.treeId);
  }

  get selectedCar(): CarInstance | undefined {
    const { selection } = this.core;

    return isNil(selection) || selection.kind !== 'car'
      ? undefined
      : this.core.cars.find(car => car.id === selection.carId);
  }

  get selectedPath(): SitePath | undefined {
    const { selection } = this.core;

    return isNil(selection) || selection.kind !== 'path'
      ? undefined
      : this.core.paths.find(path => path.id === selection.pathId);
  }

  get selectedMark(): ElevationMark | undefined {
    const { selection } = this.core;

    return isNil(selection) || selection.kind !== 'mark'
      ? undefined
      : findMark(this.core.elevationMarks, selection.markId);
  }

  /** The mark the floating elevation field belongs to, or nothing while it is closed. */
  get elevationInputMark(): ElevationMark | undefined {
    const { elevationInputMarkId } = this;

    return isNil(elevationInputMarkId)
      ? undefined
      : findMark(this.core.elevationMarks, elevationInputMarkId);
  }

  /**
   * Places a mark and hands it straight to the user: it becomes the selection,
   * and the field by its flag opens so the surveyed elevation can be typed
   * without a trip to the properties panel.
   */
  addElevationMark(position: Vector2): ElevationMark {
    const mark = createElevationMark({ position, elevation: NEW_MARK_ELEVATION_METERS });

    this.core.pushHistory();
    this.core.elevationMarks = addMark(this.core.elevationMarks, mark);
    this.core.selections = [{ kind: 'mark', markId: mark.id }];
    this.elevationInputMarkId = mark.id;

    return mark;
  }

  /** A pasted batch lands as one step: the paste is what the user would undo. */
  addElevationMarks(drafts: readonly ElevationMarkDraft[]): void {
    if (drafts.length === 0) {
      return;
    }

    this.core.pushHistory();
    this.core.elevationMarks = [...this.core.elevationMarks, ...drafts.map(createElevationMark)];
  }

  moveElevationMark(markId: MarkId, position: Vector2): void {
    this.core.elevationMarks = moveMark(this.core.elevationMarks, markId, position);
  }

  setElevationMarkElevation(markId: MarkId, elevation: Meters): void {
    this.core.elevationMarks = setMarkElevationIn(this.core.elevationMarks, markId, elevation);
  }

  removeElevationMark(markId: MarkId): void {
    this.core.pushHistory();
    this.core.elevationMarks = removeMark(this.core.elevationMarks, markId);

    const { selection } = this.core;

    if (!isNil(selection) && selection.kind === 'mark' && selection.markId === markId) {
      this.core.selections = NO_SELECTIONS;
    }

    if (this.elevationInputMarkId === markId) {
      this.elevationInputMarkId = undefined;
    }
  }

  closeElevationInput(): void {
    this.elevationInputMarkId = undefined;
  }

  /** The flyout's choice: what the next click of the placing tool puts down. */
  setNextPlacedObject(nextPlacedObject: PlacedObject): void {
    this.nextPlacedObject = nextPlacedObject;
  }

  /** Puts whatever the catalogue has chosen on the plan, at the given point. */
  placeSelectedObject(position: Vector2): void {
    const object = this.nextPlacedObject;

    switch (object.kind) {
      case 'tree':
        this.plantTree(position, object.species);

        return;
      case 'car':
        this.placeCar(position);

        return;
      default:
        assertNever(object);
    }
  }

  /**
   * Plants a tree and hands it to the user selected, so its size can be typed
   * straight into the properties panel.
   */
  plantTree(position: Vector2, species: TreeSpecies): TreeInstance {
    const tree = createTree({ species, position, ...TREE_SPECIES_DEFAULT_SIZES[species] });

    this.core.pushHistory();
    this.core.trees = addTree(this.core.trees, tree);
    this.core.selections = [{ kind: 'tree', treeId: tree.id }];

    return tree;
  }

  /**
   * Replaces a tree whole; the caller announces the history step it belongs to.
   * Touching a tree also arms the catalogue with its species: a row of the same
   * kind is planted by clicking, not by choosing before every click.
   */
  updateTree(tree: TreeInstance): void {
    this.nextPlacedObject = { kind: 'tree', species: tree.species };
    this.core.trees = replaceTreeIn(this.core.trees, tree);
  }

  removeTree(treeId: TreeId): void {
    this.core.pushHistory();
    this.core.trees = removeTreeFrom(this.core.trees, treeId);

    const { selection } = this.core;

    if (!isNil(selection) && selection.kind === 'tree' && selection.treeId === treeId) {
      this.core.selections = NO_SELECTIONS;
    }
  }

  /** Parks a car facing plan east and hands it over selected, as a tree is planted. */
  placeCar(position: Vector2): CarInstance {
    const car = createCar({ position });

    this.core.pushHistory();
    this.core.cars = addCar(this.core.cars, car);
    this.core.selections = [{ kind: 'car', carId: car.id }];

    return car;
  }

  /** Replaces a car whole; the caller announces the history step it belongs to. */
  updateCar(car: CarInstance): void {
    this.nextPlacedObject = CAR_PLACED_OBJECT;
    this.core.cars = replaceCarIn(this.core.cars, car);
  }

  removeCar(carId: CarId): void {
    this.core.pushHistory();
    this.core.cars = removeCarFrom(this.core.cars, carId);

    const { selection } = this.core;

    if (!isNil(selection) && selection.kind === 'car' && selection.carId === carId) {
      this.core.selections = NO_SELECTIONS;
    }
  }

  /** Adds a point to the polyline being clicked out; the first one starts it. */
  appendDraftPathPoint(point: Vector2): void {
    this.draftPathPoints = [...this.draftPathPoints, point];
  }

  /**
   * Turns the polyline into a path, if it has a segment at all. The double click
   * that ends a line places its point first, so the repeated last point is
   * dropped rather than stored as a zero-length segment.
   */
  commitDraftPath(): void {
    const points = dropRepeatedPoints(this.draftPathPoints);

    this.draftPathPoints = NO_DRAFT_PATH_POINTS;

    if (points.length < MIN_PATH_POINT_COUNT) {
      return;
    }

    const path = createSitePath({ points, width: DEFAULT_PATH_WIDTH_METERS });

    this.core.pushHistory();
    this.core.paths = addPath(this.core.paths, path);
    this.core.selections = [{ kind: 'path', pathId: path.id }];
  }

  cancelDraftPath(): void {
    this.draftPathPoints = NO_DRAFT_PATH_POINTS;
  }

  setPathWidth(pathId: PathId, width: Meters): void {
    this.core.paths = updatePathWidthIn(this.core.paths, pathId, width);
  }

  /** Replaces a path whole — the restore half of an interrupted point drag. */
  updatePath(path: SitePath): void {
    this.core.paths = updatePathIn(this.core.paths, path);
  }

  /**
   * Writes one view-mode object back whole, whatever its kind — the single
   * store door the unified object drag commits and restores through. The
   * caller announces the history step it belongs to.
   */
  applySiteObject(object: SiteObjectState): void {
    switch (object.kind) {
      case 'tree':
        this.updateTree(object.tree);

        return;
      case 'car':
        this.updateCar(object.car);

        return;
      case 'building':
        // A moved slab carries its interior, so the building lands whole.
        this.core.buildings = replaceBuildingIn(this.core.buildings, object.building);

        return;
      case 'path':
        this.updatePath(object.path);

        return;
      case 'utilityRoute':
        this.utilities.updateUtilityRoute(object.route);

        return;
      default:
        assertNever(object);
    }
  }

  movePathPoint(pathId: PathId, pointIndex: number, point: Vector2): void {
    this.core.paths = movePathPointIn(this.core.paths, pathId, pointIndex, point);
  }

  insertPathPoint(pathId: PathId, segmentIndex: number, point: Vector2): void {
    this.core.paths = insertPathPointIn(this.core.paths, pathId, segmentIndex, point);
  }

  /** Refuses silently below two points; the caller announces the history step. */
  removePathPoint(pathId: PathId, pointIndex: number): void {
    const before = this.core.paths;

    this.core.paths = removePathPointIn(this.core.paths, pathId, pointIndex);

    if (this.core.paths !== before && this.core.selectedPathPointIndex === pointIndex) {
      this.core.setSelectedPathPointIndex(undefined);
    }
  }

  setPathPointWidth(pathId: PathId, pointIndex: number, width: Meters): void {
    this.core.paths = setPathPointWidthIn(this.core.paths, pathId, pointIndex, width);
  }

  setPathSegmentSurface(pathId: PathId, segmentIndex: number, surface: PathSurface): void {
    this.core.pushHistory();
    this.core.paths = setPathSegmentSurfaceIn(this.core.paths, pathId, segmentIndex, surface);
  }

  removePath(pathId: PathId): void {
    this.core.pushHistory();
    this.core.paths = removePathFrom(this.core.paths, pathId);

    const { selection } = this.core;

    if (!isNil(selection) && selection.kind === 'path' && selection.pathId === pathId) {
      this.core.selections = NO_SELECTIONS;
    }
  }
}
