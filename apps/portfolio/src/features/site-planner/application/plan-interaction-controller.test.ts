import { assert } from '@frozik/utils/assert/assert';
import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CAR_LENGTH_METERS } from '../domain/constants';
import { anchorPlanPosition } from '../domain/geometry/shape-anchor';
import { OBJECT_EDITOR_SPECS } from '../domain/model/editor-mode';
import type { DeviceKind } from '../domain/model/electrical';
import type { CsgOperand, Shape } from '../domain/model/shapes';
import { createCircle, createRectangle, flattenShapes, isShapeGroup } from '../domain/model/shapes';
import { openingsOf, storeysOf, wallsOf } from '../domain/model/site-plan';
import { devicesOf, furnitureOf, groupsOf, switchLinksOf } from '../domain/model/storeys';
import type { ISitePlanRepository } from '../domain/persistence/ISitePlanRepository';
import type { PlanModifiers } from '../domain/view/plan-input';
import { NO_MODIFIERS } from '../domain/view/plan-input';
import type { PlanViewport } from '../domain/view/plan-viewport';
import { PlanInteractionController, TOOL_HOTKEYS } from './plan-interaction-controller';
import { ROTATION_HANDLE_GAP_PX } from './render/plan-draw/draw-selection';
import { SitePlannerStore } from './SitePlannerStore';

/** Keeps the interaction under test off IndexedDB and out of every other test's way. */
const NO_STORAGE: ISitePlanRepository = {
  loadPlan: () => Promise.resolve({ kind: 'empty' as const }),
  savePlan: () => Promise.resolve(),
};

/** Ten pixels per metre keeps the 8 px handle radius at a readable 0.8 m. */
const VIEWPORT: PlanViewport = {
  centerMeters: { x: 0, y: 0 },
  pixelsPerMeter: 10,
  widthPx: 400,
  heightPx: 400,
};

const ALT_HELD: PlanModifiers = { isAltPressed: true, isShiftPressed: false };
const SHIFT_HELD: PlanModifiers = { isAltPressed: false, isShiftPressed: true };

/** The default plot: a 30 × 40 rectangle whose centre sits at (15, 20). */
const PLOT_CENTER: Vector2 = { x: 15, y: 20 };
const PLOT_TOP_RIGHT: Vector2 = { x: 30, y: 40 };
/** The rotation handle floats 24 px — 2.4 m at this zoom — beyond the top edge. */
const PLOT_ROTATION_HANDLE: Vector2 = { x: 15, y: 42.4 };

describe('PlanInteractionController', () => {
  let store: SitePlannerStore;
  let controller: PlanInteractionController;

  const drag = (from: Vector2, to: Vector2, modifiers: PlanModifiers = NO_MODIFIERS): void => {
    controller.onPointerDown(from, modifiers);
    controller.onPointerMove(to, modifiers);
    controller.onPointerUp(to, modifiers);
  };

  const leafShape = (operand: CsgOperand): Shape => {
    assert(!isShapeGroup(operand), 'expected a primitive shape operand');

    return operand;
  };

  const boundaryShapes = () => store.boundary.terms.map(term => leafShape(term.operand));

  beforeEach(() => {
    store = new SitePlannerStore(NO_STORAGE);
    controller = new PlanInteractionController({ store, getViewport: () => VIEWPORT });
  });

  afterEach(() => {
    controller.dispose();
    store.dispose();
  });

  describe('the select tool', () => {
    beforeEach(() => {
      store.enterEditMode({ kind: 'site' });
    });

    it('selects the shape under the pointer', () => {
      controller.onPointerDown({ x: 10, y: 10 }, NO_MODIFIERS);

      expect(store.selection).toEqual({
        kind: 'shape',
        owner: 'boundary',
        shapeId: boundaryShapes()[0].id,
      });
    });

    it('picks a leaf that sits inside a group', () => {
      const plotId = boundaryShapes()[0].id;

      store.composition.wrapTermInGroup('boundary', plotId);
      store.setSelection(undefined);

      controller.onPointerDown({ x: 10, y: 10 }, NO_MODIFIERS);

      expect(store.selection).toEqual({ kind: 'shape', owner: 'boundary', shapeId: plotId });
    });

    it('picks a house term over the plot underneath it', () => {
      const houseShape = createRectangle({
        center: { x: 10, y: 10 },
        width: 6,
        length: 6,
        rotationDegrees: 0,
      });

      const building = store.building.addBuilding('Дом');

      store.composition.addShapeTerm(building.id, houseShape, 'union');

      controller.onPointerDown({ x: 10, y: 10 }, NO_MODIFIERS);

      expect(store.selection).toEqual({
        kind: 'shape',
        owner: building.id,
        shapeId: houseShape.id,
      });
    });

    it('clears the selection when the click lands on nothing', () => {
      controller.onPointerDown({ x: 10, y: 10 }, NO_MODIFIERS);
      controller.onPointerUp({ x: 10, y: 10 }, NO_MODIFIERS);

      controller.onPointerDown({ x: 100, y: 100 }, NO_MODIFIERS);

      expect(store.selection).toBeUndefined();
    });

    it('leaves an off-grid centre alone when the click only selects the shape', () => {
      const shape = createRectangle({
        center: { x: 10.34, y: 10.21 },
        width: 6,
        length: 6,
        rotationDegrees: 0,
      });

      const building = store.building.addBuilding('Дом');

      store.composition.addShapeTerm(building.id, shape, 'union');

      controller.onPointerDown({ x: 10.34, y: 10.21 }, NO_MODIFIERS);
      controller.onPointerUp({ x: 10.34, y: 10.21 }, NO_MODIFIERS);

      const houseComposition = store.buildings[0]?.composition;

      assert(houseComposition !== undefined, 'the building should still be there');
      expect(leafShape(houseComposition.terms[0].operand).center).toEqual({ x: 10.34, y: 10.21 });
    });

    it('drags the anchor with Shift over its mark, magnetised to a corner', () => {
      controller.onPointerDown({ x: 10, y: 10 }, NO_MODIFIERS);
      controller.onPointerUp({ x: 10, y: 10 }, NO_MODIFIERS);

      // The plot's centre (15, 20) wears the anchor mark; Shift-drag it to the
      // top-right corner's neighbourhood and let the magnet finish the move.
      controller.onPointerDown({ x: 15, y: 20 }, SHIFT_HELD);
      controller.onPointerMove({ x: 29.7, y: 39.6 }, SHIFT_HELD);
      controller.onPointerUp({ x: 29.7, y: 39.6 }, SHIFT_HELD);

      const [plot] = boundaryShapes();

      expect(plot.anchorFactors).toEqual({ x: 0.5, y: 0.5 });
      expect(plot.center).toEqual(PLOT_CENTER);
    });

    it('starts a rotation from the current angle even with the anchor off-centre', () => {
      controller.onPointerDown({ x: 10, y: 10 }, NO_MODIFIERS);
      controller.onPointerUp({ x: 10, y: 10 }, NO_MODIFIERS);

      controller.onPointerDown({ x: 15, y: 20 }, SHIFT_HELD);
      controller.onPointerMove({ x: 29.7, y: 39.6 }, SHIFT_HELD);
      controller.onPointerUp({ x: 29.7, y: 39.6 }, SHIFT_HELD);

      // A barely-moved grab of the rotate handle must not jump the shape: the
      // gesture reads the DELTA from the grab bearing, not the absolute one.
      drag(PLOT_ROTATION_HANDLE, { x: PLOT_ROTATION_HANDLE.x + 0.2, y: PLOT_ROTATION_HANDLE.y });

      const [plot] = boundaryShapes();

      expect(plot.kind === 'rectangle' ? plot.rotationDegrees : undefined).toBeLessThanOrEqual(1);
    });

    it('rotates around the anchor once it has been moved', () => {
      controller.onPointerDown({ x: 10, y: 10 }, NO_MODIFIERS);
      controller.onPointerUp({ x: 10, y: 10 }, NO_MODIFIERS);

      controller.onPointerDown({ x: 15, y: 20 }, SHIFT_HELD);
      controller.onPointerMove({ x: 29.7, y: 39.6 }, SHIFT_HELD);
      controller.onPointerUp({ x: 29.7, y: 39.6 }, SHIFT_HELD);

      drag(PLOT_ROTATION_HANDLE, { x: 5, y: 21 }, SHIFT_HELD);

      const [plot] = boundaryShapes();
      const anchor = anchorPlanPosition(plot);

      expect(anchor.x).toBeCloseTo(30, 9);
      expect(anchor.y).toBeCloseTo(40, 9);
      expect(plot.center).not.toEqual(PLOT_CENTER);
    });

    it('drags the body and snaps the centre to the grid', () => {
      drag({ x: 10, y: 10 }, { x: 12.2, y: 10 });

      expect(boundaryShapes()[0].center).toEqual({ x: 17, y: 20 });
    });

    it('leaves the centre unsnapped while Alt is held', () => {
      drag({ x: 10, y: 10 }, { x: 12.2, y: 10 }, ALT_HELD);

      expect(boundaryShapes()[0].center.x).toBeCloseTo(17.2, 9);
    });

    it('previews the gesture as a draft and only edits the plan on release', () => {
      controller.onPointerDown({ x: 10, y: 10 }, NO_MODIFIERS);
      controller.onPointerMove({ x: 15, y: 10 }, NO_MODIFIERS);

      expect(store.draftShape?.center).toEqual({ x: 20, y: 20 });
      expect(boundaryShapes()[0].center).toEqual(PLOT_CENTER);

      controller.onPointerUp({ x: 15, y: 10 }, NO_MODIFIERS);

      expect(store.draftShape).toBeUndefined();
      expect(boundaryShapes()[0].center).toEqual({ x: 20, y: 20 });
    });

    it('abandons the gesture when the pointer is cancelled', () => {
      controller.onPointerDown({ x: 10, y: 10 }, NO_MODIFIERS);
      controller.onPointerMove({ x: 15, y: 10 }, NO_MODIFIERS);
      controller.onPointerCancel();
      controller.onPointerUp({ x: 15, y: 10 }, NO_MODIFIERS);

      expect(store.draftShape).toBeUndefined();
      expect(boundaryShapes()[0].center).toEqual(PLOT_CENTER);
    });

    it('resizes from a corner handle with the opposite corner pinned', () => {
      controller.onPointerDown({ x: 10, y: 10 }, NO_MODIFIERS);
      controller.onPointerUp({ x: 10, y: 10 }, NO_MODIFIERS);

      drag(PLOT_TOP_RIGHT, { x: 20, y: 30 });

      const [plot] = boundaryShapes();

      expect(plot).toMatchObject({ width: 20, length: 30, center: { x: 10, y: 15 } });
    });

    it('rotates from the rotation handle in one-degree steps', () => {
      controller.onPointerDown({ x: 10, y: 10 }, NO_MODIFIERS);
      controller.onPointerUp({ x: 10, y: 10 }, NO_MODIFIERS);

      drag(PLOT_ROTATION_HANDLE, { x: 25, y: 21 });

      const [plot] = boundaryShapes();

      expect(plot.kind).toBe('rectangle');
      expect(plot.kind === 'rectangle' ? plot.rotationDegrees : undefined).toBeCloseTo(276, 9);
    });

    it('rotates in fifteen-degree steps while Shift is held', () => {
      controller.onPointerDown({ x: 10, y: 10 }, NO_MODIFIERS);
      controller.onPointerUp({ x: 10, y: 10 }, NO_MODIFIERS);

      drag(PLOT_ROTATION_HANDLE, { x: 25, y: 21 }, SHIFT_HELD);

      const [plot] = boundaryShapes();

      expect(plot.kind === 'rectangle' ? plot.rotationDegrees : undefined).toBeCloseTo(270, 9);
    });

    it('drags the radius handle of a selected circle', () => {
      const circle = createCircle({ center: { x: 10, y: 10 }, radius: 4 });

      store.composition.addShapeTerm('boundary', circle, 'union');
      store.setSelection({ kind: 'shape', owner: 'boundary', shapeId: circle.id });

      drag({ x: 14, y: 10 }, { x: 10, y: 16.2 });

      const resized = boundaryShapes()[1];

      expect(resized.kind === 'circle' ? resized.radius : undefined).toBe(6);
    });
  });

  describe('the shape tools', () => {
    beforeEach(() => {
      store.enterEditMode({ kind: 'site' });
    });

    it('rubber-bands a rectangle into the active group and selects it', () => {
      store.setActiveTool('rectangle');

      drag({ x: 1.1, y: 2.2 }, { x: 6.2, y: 8.1 });

      const shapes = boundaryShapes();

      expect(shapes).toHaveLength(2);
      expect(shapes[1]).toMatchObject({ center: { x: 3.5, y: 5 }, width: 5, length: 6 });
      expect(store.selection).toEqual({
        kind: 'shape',
        owner: 'boundary',
        shapeId: shapes[1].id,
      });
      expect(store.boundary.terms[1].operation).toBe('union');
    });

    it('draws an ellipse with the I tool, stated by the box it fills', () => {
      controller.onKeyDown('i', NO_MODIFIERS);

      expect(store.activeTool).toBe('ellipse');

      drag({ x: 2, y: 2 }, { x: 10, y: 8 });

      const shapes = boundaryShapes();

      expect(shapes[1]).toMatchObject({
        kind: 'ellipse',
        center: { x: 6, y: 5 },
        width: 8,
        length: 6,
      });
      // R30: a drawn shape hands the pointer back with itself selected, ready
      // for the exact width to be typed into СВОЙСТВА.
      expect(store.activeTool).toBe('select');
      expect(store.selection).toEqual({
        kind: 'shape',
        owner: 'boundary',
        shapeId: shapes[1].id,
      });
    });

    it('draws the footprint into the freshly added building', () => {
      store.building.addBuilding('Дом');
      store.setActiveTool('rectangle');

      drag({ x: 4, y: 4 }, { x: 10, y: 12 });

      expect(store.buildings[0]?.composition.terms).toHaveLength(1);
      expect(store.buildings[0]?.wallHeight).toBe(3);
      expect(boundaryShapes()).toHaveLength(1);
    });

    it('draws into the active group rather than into the root of the composition', () => {
      const plotId = boundaryShapes()[0].id;

      store.composition.wrapTermInGroup('boundary', plotId);

      const groupId = store.boundary.terms[0].operand.id;

      store.setActiveTool('rectangle');
      drag({ x: 1, y: 2 }, { x: 6, y: 8 });

      const group = store.boundary.terms[0].operand;

      expect(store.boundary.terms).toHaveLength(1);
      expect(isShapeGroup(group) ? group.terms : []).toHaveLength(2);
      expect(store.composition.resolvedActiveGroup).toEqual({ owner: 'boundary', groupId });
      expect(flattenShapes(store.boundary)).toHaveLength(2);
    });

    it('drops back to the root once the active group is gone', () => {
      const plotId = boundaryShapes()[0].id;

      store.composition.wrapTermInGroup('boundary', plotId);
      store.composition.ungroupTerm('boundary', store.boundary.terms[0].operand.id);

      store.setActiveTool('rectangle');
      drag({ x: 1, y: 2 }, { x: 6, y: 8 });

      expect(store.boundary.terms).toHaveLength(2);
      expect(store.boundary.terms[1].operand.kind).toBe('rectangle');
    });

    it('rubber-bands a circle from its centre', () => {
      store.setActiveTool('circle');

      drag({ x: 5, y: 5 }, { x: 5, y: 8.2 });

      const drawn = boundaryShapes()[1];

      expect(drawn.kind === 'circle' ? drawn.radius : undefined).toBe(3);
      expect(drawn.center).toEqual({ x: 5, y: 5 });
    });

    it('puts nothing on the plan when the drag never left the press point', () => {
      store.setActiveTool('rectangle');

      drag({ x: 5, y: 5 }, { x: 5, y: 5 });

      expect(boundaryShapes()).toHaveLength(1);
      expect(store.isPropertiesFocusPending).toBe(false);
    });

    it('hands the properties panel the keyboard once a shape is drawn', () => {
      store.setActiveTool('rectangle');

      drag({ x: 1, y: 2 }, { x: 6, y: 8 });

      expect(store.isPropertiesFocusPending).toBe(true);

      store.consumePropertiesFocus();

      expect(store.isPropertiesFocusPending).toBe(false);
    });
  });

  /**
   * Ten pixels of capture radius are one metre at this zoom, and the default
   * plot puts a key point at its centre (15, 20) and a corner at the origin.
   */
  describe('object snapping', () => {
    beforeEach(() => {
      store.enterEditMode({ kind: 'site' });
    });

    const HOUSE_CENTER: Vector2 = { x: 10, y: 10 };
    /** Leaves the house's far corner half a metre short of the plot's centre. */
    const DRAG_TARGET: Vector2 = { x: 12.4, y: 17.3 };
    const PLOT_CENTER_KEY_POINT: Vector2 = { x: 15, y: 20 };
    const PLOT_CORNER_KEY_POINT: Vector2 = { x: 0, y: 0 };
    /** Grid-snaps to (0.5, 0.5), which is within reach of the plot's corner. */
    const NEAR_PLOT_CORNER: Vector2 = { x: 0.3, y: 0.4 };
    const PRECISION_DIGITS = 9;

    const houseCenter = (): Vector2 | undefined => {
      const composition = store.buildings[0]?.composition;

      return composition === undefined ? undefined : leafShape(composition.terms[0].operand).center;
    };

    beforeEach(() => {
      const building = store.building.addBuilding('Дом');

      store.composition.addShapeTerm(
        building.id,
        createRectangle({ center: HOUSE_CENTER, width: 6, length: 6, rotationDegrees: 0 }),
        'union'
      );
      // The snapping tests draw into the plot; adding the building re-aimed it.
      store.composition.setActiveGroup('boundary');
    });

    it('catches a dragged shape on a key point of another one while Shift is held', () => {
      drag(HOUSE_CENTER, DRAG_TARGET, SHIFT_HELD);

      expect(houseCenter()?.x).toBeCloseTo(12, PRECISION_DIGITS);
      expect(houseCenter()?.y).toBeCloseTo(17, PRECISION_DIGITS);
    });

    it('leaves the drag on the grid without Shift', () => {
      drag(HOUSE_CENTER, DRAG_TARGET, NO_MODIFIERS);

      expect(houseCenter()).toEqual({ x: 12.5, y: 17.5 });
    });

    it('suspends the catch along with the grid while Alt is held', () => {
      drag(HOUSE_CENTER, DRAG_TARGET, { isAltPressed: true, isShiftPressed: true });

      expect(houseCenter()?.x).toBeCloseTo(DRAG_TARGET.x, PRECISION_DIGITS);
      expect(houseCenter()?.y).toBeCloseTo(DRAG_TARGET.y, PRECISION_DIGITS);
    });

    it('publishes the catch while the gesture runs and drops it on release', () => {
      controller.onPointerDown(HOUSE_CENTER, SHIFT_HELD);
      controller.onPointerMove(DRAG_TARGET, SHIFT_HELD);

      expect(store.activeKeyPointSnap?.targetPoint).toEqual(PLOT_CENTER_KEY_POINT);

      controller.onPointerUp(DRAG_TARGET, SHIFT_HELD);

      expect(store.activeKeyPointSnap).toBeUndefined();
    });

    it('drops the catch when the gesture is interrupted', () => {
      controller.onPointerDown(HOUSE_CENTER, SHIFT_HELD);
      controller.onPointerMove(DRAG_TARGET, SHIFT_HELD);
      controller.onPointerCancel();

      expect(store.activeKeyPointSnap).toBeUndefined();
    });

    it('catches the first corner of a drawn rectangle', () => {
      store.setActiveTool('rectangle');

      drag(NEAR_PLOT_CORNER, { x: 6, y: 8 }, SHIFT_HELD);

      expect(boundaryShapes()[1]).toMatchObject({ center: { x: 3, y: 4 }, width: 6, length: 8 });
    });

    it('catches the centre of a drawn circle', () => {
      store.setActiveTool('circle');

      drag(NEAR_PLOT_CORNER, { x: 0, y: 4.2 }, SHIFT_HELD);

      const drawn = boundaryShapes()[1];

      expect(drawn.center).toEqual(PLOT_CORNER_KEY_POINT);
      expect(drawn.kind === 'circle' ? drawn.radius : undefined).toBe(4);
    });

    it('leaves a drawn rectangle on the grid without Shift', () => {
      store.setActiveTool('rectangle');

      drag(NEAR_PLOT_CORNER, { x: 6, y: 8 }, NO_MODIFIERS);

      expect(boundaryShapes()[1]).toMatchObject({
        center: { x: 3.25, y: 4.25 },
        width: 5.5,
        length: 7.5,
      });
    });
  });

  describe('the measure tool', () => {
    beforeEach(() => {
      store.setActiveTool('measure');
    });

    it('collects clicked anchors as consecutive pairs', () => {
      controller.onPointerDown({ x: 1, y: 1 }, NO_MODIFIERS);
      controller.onPointerDown({ x: 4, y: 5 }, NO_MODIFIERS);
      controller.onPointerDown({ x: 8, y: 5 }, NO_MODIFIERS);

      expect(store.measurePoints).toEqual([
        { x: 1, y: 1 },
        { x: 4, y: 5 },
        { x: 8, y: 5 },
      ]);
    });

    it('drops the measurements on Escape and on a tool change', () => {
      controller.onPointerDown({ x: 1, y: 1 }, NO_MODIFIERS);
      controller.onKeyDown('Escape', NO_MODIFIERS);

      expect(store.measurePoints).toHaveLength(0);

      controller.onPointerDown({ x: 2, y: 2 }, NO_MODIFIERS);
      controller.onKeyDown('v', NO_MODIFIERS);

      expect(store.measurePoints).toHaveLength(0);
      expect(store.activeTool).toBe('select');
    });
  });

  describe('the placing tool', () => {
    beforeEach(() => {
      store.setActiveTool('tree');
    });

    it('plants a tree on the grid and selects it', () => {
      controller.onPointerDown({ x: 10.2, y: 10.1 }, NO_MODIFIERS);

      expect(store.trees).toHaveLength(1);

      const [tree] = store.trees;

      expect(tree.position).toEqual({ x: 10, y: 10 });
      expect(tree.species).toBe('spruce');
      expect(store.selection).toEqual({ kind: 'tree', treeId: tree.id });
    });

    it('plants the species the catalogue has chosen', () => {
      store.siteObjects.setNextPlacedObject({ kind: 'tree', species: 'thuja' });
      controller.onPointerDown({ x: 10, y: 10 }, NO_MODIFIERS);

      expect(store.trees[0].species).toBe('thuja');
    });

    it('parks a car once the catalogue has chosen one', () => {
      store.siteObjects.setNextPlacedObject({ kind: 'car' });
      controller.onPointerDown({ x: 10.2, y: 10.1 }, NO_MODIFIERS);

      expect(store.trees).toHaveLength(0);
      expect(store.cars).toHaveLength(1);

      const [car] = store.cars;

      expect(car.position).toEqual({ x: 10, y: 10 });
      expect(car.rotationDegrees).toBe(0);
      expect(store.selection).toEqual({ kind: 'car', carId: car.id });
    });

    it('undoes a planted tree', () => {
      controller.onPointerDown({ x: 10, y: 10 }, NO_MODIFIERS);
      controller.onUndo();

      expect(store.trees).toHaveLength(0);
    });

    it('plants the species chosen last', () => {
      controller.onPointerDown({ x: 10, y: 10 }, NO_MODIFIERS);
      store.siteObjects.updateTree({ ...store.trees[0], species: 'deciduous' });
      // A placed object hands the pointer back to the select tool (R30), so
      // planting a second one asks for the tool again.
      store.setActiveTool('tree');
      controller.onPointerDown({ x: 20, y: 10 }, NO_MODIFIERS);

      expect(store.trees[1].species).toBe('deciduous');
    });

    it('drags the tree under the pointer instead of planting another', () => {
      controller.onPointerDown({ x: 10, y: 10 }, NO_MODIFIERS);
      drag({ x: 10, y: 10 }, { x: 14, y: 12 });

      expect(store.trees).toHaveLength(1);
      expect(store.trees[0].position).toEqual({ x: 14, y: 12 });
    });

    it('leaves an off-grid tree where it stands when the pointer only clicks it', () => {
      controller.onPointerDown({ x: 12.34, y: 10.21 }, ALT_HELD);
      controller.onPointerUp({ x: 12.34, y: 10.21 }, ALT_HELD);

      controller.onPointerDown({ x: 12.34, y: 10.21 }, NO_MODIFIERS);
      controller.onPointerUp({ x: 12.34, y: 10.21 }, NO_MODIFIERS);

      expect(store.trees[0].position).toEqual({ x: 12.34, y: 10.21 });

      // The click left no step behind either: the only undo there is takes the
      // planting itself back.
      controller.onUndo();

      expect(store.trees).toHaveLength(0);
    });

    it('puts a tree back where it was grabbed when the drag is interrupted', () => {
      controller.onPointerDown({ x: 10, y: 10 }, NO_MODIFIERS);
      controller.onPointerDown({ x: 10, y: 10 }, NO_MODIFIERS);
      controller.onPointerMove({ x: 14, y: 12 }, NO_MODIFIERS);
      controller.onPointerCancel();

      expect(store.trees[0].position).toEqual({ x: 10, y: 10 });
    });

    it('deletes the selected tree', () => {
      controller.onPointerDown({ x: 10, y: 10 }, NO_MODIFIERS);

      expect(controller.onKeyDown('Delete', NO_MODIFIERS)).toBe(true);
      expect(store.trees).toHaveLength(0);
      expect(store.selection).toBeUndefined();
    });
  });

  describe('cars', () => {
    /** A car parked at the origin of the plot, facing plan east. */
    const CAR_POSITION: Vector2 = { x: 10, y: 10 };
    /** Where its rotation grip stands: the nose plus the 24 px gap, in metres. */
    const CAR_HANDLE: Vector2 = {
      x: CAR_POSITION.x + CAR_LENGTH_METERS / 2 + ROTATION_HANDLE_GAP_PX / VIEWPORT.pixelsPerMeter,
      y: CAR_POSITION.y,
    };

    const parkCar = (): void => {
      store.setActiveTool('tree');
      store.siteObjects.setNextPlacedObject({ kind: 'car' });
      controller.onPointerDown(CAR_POSITION, NO_MODIFIERS);
      controller.onPointerUp(CAR_POSITION, NO_MODIFIERS);
    };

    beforeEach(() => {
      parkCar();
      store.setActiveTool('select');
    });

    it('selects and drags the car under the pointer, snapping to the grid', () => {
      drag({ x: 10, y: 10 }, { x: 14.2, y: 12.1 });

      expect(store.cars).toHaveLength(1);
      expect(store.cars[0].position).toEqual({ x: 14, y: 12 });
      expect(store.selection).toEqual({ kind: 'car', carId: store.cars[0].id });
    });

    it('turns the car by its grip, a degree at a time', () => {
      controller.onPointerDown(CAR_HANDLE, NO_MODIFIERS);
      controller.onPointerMove({ x: 10, y: 20 }, NO_MODIFIERS);
      controller.onPointerUp({ x: 10, y: 20 }, NO_MODIFIERS);

      expect(store.cars[0].rotationDegrees).toBe(90);
      expect(store.cars[0].position).toEqual(CAR_POSITION);
    });

    it('snaps the turn to 15° while Shift is held', () => {
      controller.onPointerDown(CAR_HANDLE, SHIFT_HELD);
      controller.onPointerMove({ x: 14, y: 11 }, SHIFT_HELD);
      controller.onPointerUp({ x: 14, y: 11 }, SHIFT_HELD);

      // The pointer stands at about 14° off east; the nearest sixteenth of a
      // turn is 15°.
      expect(store.cars[0].rotationDegrees).toBe(15);
    });

    it('turns freely while Alt is held', () => {
      controller.onPointerDown(CAR_HANDLE, ALT_HELD);
      controller.onPointerMove({ x: 14, y: 11 }, ALT_HELD);
      controller.onPointerUp({ x: 14, y: 11 }, ALT_HELD);

      expect(store.cars[0].rotationDegrees).toBeCloseTo(14.0362, 3);
    });

    it('undoes a turn as one step', () => {
      controller.onPointerDown(CAR_HANDLE, NO_MODIFIERS);
      controller.onPointerMove({ x: 10, y: 20 }, NO_MODIFIERS);
      controller.onPointerUp({ x: 10, y: 20 }, NO_MODIFIERS);

      controller.onUndo();

      expect(store.cars[0].rotationDegrees).toBe(0);
    });

    it('puts the car back the way it stood when the gesture is interrupted', () => {
      controller.onPointerDown(CAR_POSITION, NO_MODIFIERS);
      controller.onPointerMove({ x: 16, y: 14 }, NO_MODIFIERS);
      controller.onPointerCancel();

      expect(store.cars[0].position).toEqual(CAR_POSITION);
    });

    it('picks the car over the tree standing under it', () => {
      store.setActiveTool('tree');
      store.siteObjects.setNextPlacedObject({ kind: 'tree', species: 'spruce' });
      controller.onPointerDown(CAR_POSITION, NO_MODIFIERS);
      controller.onPointerUp(CAR_POSITION, NO_MODIFIERS);
      store.setActiveTool('select');

      controller.onPointerDown(CAR_POSITION, NO_MODIFIERS);

      expect(store.selection).toEqual({ kind: 'car', carId: store.cars[0].id });
    });

    it('deletes the selected car', () => {
      controller.onPointerDown(CAR_POSITION, NO_MODIFIERS);

      expect(controller.onKeyDown('Delete', NO_MODIFIERS)).toBe(true);
      expect(store.cars).toHaveLength(0);
      expect(store.selection).toBeUndefined();
    });
  });

  describe('the path tool', () => {
    beforeEach(() => {
      store.setActiveTool('path');
    });

    const clickOut = (...points: readonly Vector2[]): void => {
      for (const point of points) {
        controller.onPointerDown(point, NO_MODIFIERS);
      }
    };

    it('collects clicked points without touching the plan', () => {
      clickOut({ x: 2.2, y: 2.1 }, { x: 6, y: 2 });

      expect(store.siteObjects.draftPathPoints).toEqual([
        { x: 2, y: 2 },
        { x: 6, y: 2 },
      ]);
      expect(store.paths).toHaveLength(0);
    });

    it('commits the polyline on Enter and selects the path', () => {
      clickOut({ x: 2, y: 2 }, { x: 6, y: 2 }, { x: 6, y: 8 });

      expect(controller.onKeyDown('Enter', NO_MODIFIERS)).toBe(true);
      expect(store.paths).toHaveLength(1);

      const [path] = store.paths;

      expect(path.points).toHaveLength(3);
      expect(store.selection).toEqual({ kind: 'path', pathId: path.id });
      expect(store.siteObjects.draftPathPoints).toHaveLength(0);
    });

    it('commits on a double click without keeping its repeated point', () => {
      clickOut({ x: 2, y: 2 }, { x: 6, y: 2 }, { x: 6, y: 2 });
      controller.onDoubleClick({ x: 6, y: 2 }, NO_MODIFIERS);

      expect(store.paths[0].points).toHaveLength(2);
    });

    it('drops a polyline with nothing but a single point', () => {
      clickOut({ x: 2, y: 2 });
      controller.onDoubleClick({ x: 2, y: 2 }, NO_MODIFIERS);

      expect(store.paths).toHaveLength(0);
      expect(store.siteObjects.draftPathPoints).toHaveLength(0);
    });

    it('abandons the polyline on Escape', () => {
      clickOut({ x: 2, y: 2 }, { x: 6, y: 2 });

      expect(controller.onKeyDown('Escape', NO_MODIFIERS)).toBe(true);
      expect(store.siteObjects.draftPathPoints).toHaveLength(0);
      expect(store.paths).toHaveLength(0);
    });

    it('undoes a committed path as one step', () => {
      clickOut({ x: 2, y: 2 }, { x: 6, y: 2 });
      controller.onDoubleClick({ x: 6, y: 2 }, NO_MODIFIERS);
      controller.onUndo();

      expect(store.paths).toHaveLength(0);
    });

    it('selects a path by its ribbon once the select tool is back', () => {
      clickOut({ x: 2, y: 2 }, { x: 6, y: 2 });
      controller.onDoubleClick({ x: 6, y: 2 }, NO_MODIFIERS);

      const [path] = store.paths;

      store.setActiveTool('select');
      // Committing selected the path already; picking is what is under test.
      store.setSelection(undefined);
      controller.onPointerDown({ x: 4, y: 2.2 }, NO_MODIFIERS);

      expect(store.selection).toEqual({ kind: 'path', pathId: path.id });
    });
  });

  describe('editing the points of a selected path', () => {
    /** Lays out a straight (2,2)–(6,2) path and opens its editor. */
    const layOutSelectedPath = (): void => {
      store.setActiveTool('path');
      controller.onPointerDown({ x: 2, y: 2 }, NO_MODIFIERS);
      controller.onPointerDown({ x: 6, y: 2 }, NO_MODIFIERS);
      controller.onDoubleClick({ x: 6, y: 2 }, NO_MODIFIERS);
      store.enterEditMode({ kind: 'path', pathId: store.paths[0].id });
    };

    beforeEach(layOutSelectedPath);

    it('drags a point by its square, snapped to the grid', () => {
      controller.onPointerDown({ x: 2, y: 2 }, NO_MODIFIERS);
      controller.onPointerMove({ x: 3.2, y: 4.1 }, NO_MODIFIERS);
      controller.onPointerUp({ x: 3.2, y: 4.1 }, NO_MODIFIERS);

      expect(store.paths[0].points[0].position).toEqual({ x: 3, y: 4 });
      expect(store.paths[0].points[1].position).toEqual({ x: 6, y: 2 });
    });

    it('undoes a point drag as one step', () => {
      controller.onPointerDown({ x: 2, y: 2 }, NO_MODIFIERS);
      controller.onPointerMove({ x: 3, y: 4 }, NO_MODIFIERS);
      controller.onPointerUp({ x: 3, y: 4 }, NO_MODIFIERS);
      controller.onUndo();

      expect(store.paths[0].points[0].position).toEqual({ x: 2, y: 2 });
    });

    it('plants a point by the midpoint ring and drags it into a bend', () => {
      controller.onPointerDown({ x: 4, y: 2 }, NO_MODIFIERS);
      controller.onPointerMove({ x: 4.1, y: 5.2 }, NO_MODIFIERS);
      controller.onPointerUp({ x: 4.1, y: 5.2 }, NO_MODIFIERS);

      expect(store.paths[0].points.map(point => point.position)).toEqual([
        { x: 2, y: 2 },
        { x: 4, y: 5 },
        { x: 6, y: 2 },
      ]);
    });

    it('puts the path back whole when a midpoint grab is interrupted', () => {
      controller.onPointerDown({ x: 4, y: 2 }, NO_MODIFIERS);
      controller.onPointerCancel();

      expect(store.paths[0].points.map(point => point.position)).toEqual([
        { x: 2, y: 2 },
        { x: 6, y: 2 },
      ]);
    });

    it('removes a point on a double click over its square', () => {
      controller.onPointerDown({ x: 4, y: 2 }, NO_MODIFIERS);
      controller.onPointerMove({ x: 4, y: 5 }, NO_MODIFIERS);
      controller.onPointerUp({ x: 4, y: 5 }, NO_MODIFIERS);

      controller.onDoubleClick({ x: 4, y: 5 }, NO_MODIFIERS);

      expect(store.paths[0].points.map(point => point.position)).toEqual([
        { x: 2, y: 2 },
        { x: 6, y: 2 },
      ]);
    });

    it('keeps the last two points however hard they are double clicked', () => {
      controller.onDoubleClick({ x: 2, y: 2 }, NO_MODIFIERS);

      expect(store.paths[0].points).toHaveLength(2);
    });

    it('lights the handle under the pointer and the one being dragged apart', () => {
      controller.onPointerMove({ x: 2.1, y: 2.2 }, NO_MODIFIERS);

      expect(store.pathHandleHighlight).toEqual({ kind: 'vertex', index: 0, state: 'hover' });

      controller.onPointerDown({ x: 2, y: 2 }, NO_MODIFIERS);

      expect(store.pathHandleHighlight).toEqual({ kind: 'vertex', index: 0, state: 'drag' });

      controller.onPointerUp({ x: 2, y: 2 }, NO_MODIFIERS);

      expect(store.pathHandleHighlight).toEqual({ kind: 'vertex', index: 0, state: 'hover' });

      controller.onPointerMove({ x: 20, y: 20 }, NO_MODIFIERS);

      expect(store.pathHandleHighlight).toBeUndefined();
    });

    it('lights the point a midpoint grab has just planted as the dragged one', () => {
      controller.onPointerDown({ x: 4, y: 2 }, NO_MODIFIERS);

      expect(store.pathHandleHighlight).toEqual({ kind: 'vertex', index: 1, state: 'drag' });

      controller.onPointerCancel();

      expect(store.pathHandleHighlight).toBeUndefined();
    });

    it('offers no midpoint ring on a segment too short to fit one', () => {
      // Pull the far point in until the segment is 2 m — 20 px, under the threshold.
      controller.onPointerDown({ x: 6, y: 2 }, NO_MODIFIERS);
      controller.onPointerMove({ x: 4, y: 2 }, NO_MODIFIERS);
      controller.onPointerUp({ x: 4, y: 2 }, NO_MODIFIERS);

      controller.onPointerDown({ x: 3, y: 2 }, NO_MODIFIERS);
      controller.onPointerUp({ x: 3, y: 2 }, NO_MODIFIERS);

      expect(store.paths[0].points).toHaveLength(2);
    });
  });

  describe('the elevation tool', () => {
    beforeEach(() => {
      store.enterEditMode({ kind: 'site' });
    });

    beforeEach(() => {
      store.setActiveTool('elevation');
    });

    it('surveys a point on the grid and hands it the floating field', () => {
      controller.onPointerDown({ x: 10.2, y: 10.1 }, NO_MODIFIERS);

      expect(store.elevationMarks).toHaveLength(1);

      const [mark] = store.elevationMarks;

      expect(mark.position).toEqual({ x: 10, y: 10 });
      expect(mark.elevation).toBe(0);
      expect(store.selection).toEqual({ kind: 'mark', markId: mark.id });
      expect(store.siteObjects.elevationInputMarkId).toBe(mark.id);
    });

    it('undoes a placed mark', () => {
      controller.onPointerDown({ x: 10, y: 10 }, NO_MODIFIERS);
      controller.onUndo();

      expect(store.elevationMarks).toHaveLength(0);
    });

    it('drags a mark as a draft and moves it once the pointer comes up', () => {
      controller.onPointerDown({ x: 10, y: 10 }, NO_MODIFIERS);

      const [mark] = store.elevationMarks;

      controller.onPointerDown({ x: 10, y: 10 }, NO_MODIFIERS);
      controller.onPointerMove({ x: 12.2, y: 10 }, NO_MODIFIERS);

      expect(store.draftMark?.position).toEqual({ x: 12, y: 10 });
      expect(store.elevationMarks[0].position).toEqual({ x: 10, y: 10 });

      controller.onPointerUp({ x: 12.2, y: 10 }, NO_MODIFIERS);

      expect(store.draftMark).toBeUndefined();
      expect(store.elevationMarks[0]).toEqual({ ...mark, position: { x: 12, y: 10 } });
    });

    it('undoes a dragged mark in one step', () => {
      controller.onPointerDown({ x: 10, y: 10 }, NO_MODIFIERS);
      controller.onKeyDown('Escape', NO_MODIFIERS);

      drag({ x: 10, y: 10 }, { x: 16, y: 14 });

      expect(store.elevationMarks[0].position).toEqual({ x: 16, y: 14 });

      controller.onUndo();

      expect(store.elevationMarks[0].position).toEqual({ x: 10, y: 10 });
    });

    it('deletes the selected mark', () => {
      controller.onPointerDown({ x: 10, y: 10 }, NO_MODIFIERS);

      expect(controller.onKeyDown('Delete', NO_MODIFIERS)).toBe(true);
      expect(store.elevationMarks).toHaveLength(0);
      expect(store.selection).toBeUndefined();
    });

    it('picks a mark over the plot under it while selecting', () => {
      controller.onPointerDown({ x: 10, y: 10 }, NO_MODIFIERS);

      const [mark] = store.elevationMarks;

      store.setActiveTool('select');
      controller.onPointerDown({ x: 10, y: 10 }, NO_MODIFIERS);

      expect(store.selection).toEqual({ kind: 'mark', markId: mark.id });
    });
  });

  describe('the keyboard', () => {
    it('switches tools by letter, whatever the case', () => {
      store.enterEditMode({ kind: 'site' });

      expect(controller.onKeyDown('R', NO_MODIFIERS)).toBe(true);
      expect(store.activeTool).toBe('rectangle');

      controller.onKeyDown('c', NO_MODIFIERS);
      expect(store.activeTool).toBe('circle');
    });

    it('reaches the tree and path tools with T and P', () => {
      expect(controller.onKeyDown('t', NO_MODIFIERS)).toBe(true);
      expect(store.activeTool).toBe('tree');

      expect(controller.onKeyDown('p', NO_MODIFIERS)).toBe(true);
      expect(store.activeTool).toBe('path');
    });

    it('leaves a letter no tool answers to the browser', () => {
      expect(controller.onKeyDown('q', NO_MODIFIERS)).toBe(false);
      expect(store.activeTool).toBe('select');
    });

    // Tab belongs to the feature shell, which listens in both view modes.
    it('leaves the view-mode hotkey to the shell', () => {
      expect(controller.onKeyDown('Tab', NO_MODIFIERS)).toBe(false);
      expect(store.viewMode).toBe('plan');
    });

    it('deletes the selected term', () => {
      store.enterEditMode({ kind: 'site' });
      controller.onPointerDown({ x: 10, y: 10 }, NO_MODIFIERS);
      controller.onPointerUp({ x: 10, y: 10 }, NO_MODIFIERS);

      expect(controller.onKeyDown('Delete', NO_MODIFIERS)).toBe(true);
      expect(boundaryShapes()).toHaveLength(0);
      expect(store.selection).toBeUndefined();
    });

    it('nudges the selection by one grid step, ten with Shift', () => {
      store.enterEditMode({ kind: 'site' });
      controller.onPointerDown({ x: 10, y: 10 }, NO_MODIFIERS);
      controller.onPointerUp({ x: 10, y: 10 }, NO_MODIFIERS);

      controller.onKeyDown('ArrowUp', NO_MODIFIERS);
      expect(boundaryShapes()[0].center).toEqual({ x: 15, y: 20.5 });

      controller.onKeyDown('ArrowRight', SHIFT_HELD);
      expect(boundaryShapes()[0].center).toEqual({ x: 20, y: 20.5 });
    });

    it('reports an unhandled key so the browser default survives', () => {
      expect(controller.onKeyDown('ArrowUp', NO_MODIFIERS)).toBe(false);
      expect(controller.onKeyDown('F5', NO_MODIFIERS)).toBe(false);
    });
  });

  describe('the history', () => {
    beforeEach(() => {
      store.enterEditMode({ kind: 'site' });
    });

    it('leaves a drag as a single step', () => {
      drag(PLOT_CENTER, { x: 20, y: 25 });

      expect(boundaryShapes()[0].center).toEqual({ x: 20, y: 25 });

      controller.onUndo();

      expect(boundaryShapes()[0].center).toEqual(PLOT_CENTER);
      expect(store.history.canUndo).toBe(false);
    });

    it('leaves no step behind a click that only selects', () => {
      controller.onPointerDown(PLOT_CENTER, NO_MODIFIERS);
      controller.onPointerUp(PLOT_CENTER, NO_MODIFIERS);

      expect(store.selection).toBeDefined();
      expect(store.history.canUndo).toBe(false);
    });

    it('undoes a drawn shape and redoes it again', () => {
      store.setActiveTool('rectangle');
      drag({ x: 1, y: 2 }, { x: 6, y: 8 });

      expect(boundaryShapes()).toHaveLength(2);

      controller.onUndo();

      expect(boundaryShapes()).toHaveLength(1);

      controller.onRedo();

      expect(boundaryShapes()).toHaveLength(2);
    });

    it('undoes a deleted term', () => {
      controller.onPointerDown(PLOT_CENTER, NO_MODIFIERS);
      controller.onPointerUp(PLOT_CENTER, NO_MODIFIERS);
      controller.onKeyDown('Delete', NO_MODIFIERS);

      expect(boundaryShapes()).toHaveLength(0);

      controller.onUndo();

      expect(boundaryShapes()).toHaveLength(1);
    });

    it('drops a gesture in flight rather than committing it over a restored plan', () => {
      drag(PLOT_CENTER, { x: 20, y: 25 });

      controller.onPointerDown({ x: 20, y: 25 }, NO_MODIFIERS);
      controller.onPointerMove({ x: 24, y: 25 }, NO_MODIFIERS);
      controller.onUndo();
      controller.onPointerUp({ x: 24, y: 25 }, NO_MODIFIERS);

      expect(boundaryShapes()[0].center).toEqual(PLOT_CENTER);
      expect(store.draftShape).toBeUndefined();
    });
  });

  describe('editor modes', () => {
    const layOutPath = (): void => {
      store.setActiveTool('path');
      controller.onPointerDown({ x: 2, y: 2 }, NO_MODIFIERS);
      controller.onPointerDown({ x: 6, y: 2 }, NO_MODIFIERS);
      controller.onDoubleClick({ x: 6, y: 2 }, NO_MODIFIERS);
      store.setActiveTool('select');
    };

    it('opens a path editor with a double click on its ribbon', () => {
      layOutPath();
      store.setSelection(undefined);

      controller.onDoubleClick({ x: 4, y: 2 }, NO_MODIFIERS);

      expect(store.editorMode).toEqual({
        kind: 'edit',
        target: { kind: 'path', pathId: store.paths[0].id },
      });
      expect(store.selection).toEqual({ kind: 'path', pathId: store.paths[0].id });
    });

    it('opens site editing with a double click on the plot', () => {
      controller.onDoubleClick({ x: 10, y: 10 }, NO_MODIFIERS);

      expect(store.editorMode).toEqual({ kind: 'edit', target: { kind: 'site' } });
    });

    it('opens the selected path with Enter, the Figma way', () => {
      layOutPath();

      expect(controller.onKeyDown('Enter', NO_MODIFIERS)).toBe(true);
      expect(store.editorMode.kind).toBe('edit');
    });

    it('does not pick individual shapes while viewing', () => {
      controller.onPointerDown({ x: 10, y: 10 }, NO_MODIFIERS);

      expect(store.selection).toBeUndefined();
    });

    it('plants no path point from a midpoint while viewing', () => {
      layOutPath();

      controller.onPointerDown({ x: 4, y: 2 }, NO_MODIFIERS);
      controller.onPointerUp({ x: 4, y: 2 }, NO_MODIFIERS);

      expect(store.paths[0].points).toHaveLength(2);
    });

    it('leaves the dimmed objects unclickable inside site editing', () => {
      layOutPath();
      store.enterEditMode({ kind: 'site' });

      controller.onPointerDown({ x: 4, y: 2 }, NO_MODIFIERS);

      expect(store.selection?.kind).not.toBe('path');
    });

    it('closes the editor with a double click on emptiness', () => {
      store.enterEditMode({ kind: 'site' });

      controller.onDoubleClick({ x: 100, y: 100 }, NO_MODIFIERS);

      expect(store.editorMode).toEqual({ kind: 'view' });
    });

    it('climbs out one level per Escape', () => {
      layOutPath();
      store.enterEditMode({ kind: 'path', pathId: store.paths[0].id });

      // The path arrives selected: first Escape drops the selection…
      controller.onKeyDown('Escape', NO_MODIFIERS);

      expect(store.editorMode.kind).toBe('edit');

      // …and only the next one closes the editor.
      controller.onKeyDown('Escape', NO_MODIFIERS);

      expect(store.editorMode).toEqual({ kind: 'view' });
    });

    it('refuses the hotkeys of the tools the mode does not carry', () => {
      expect(controller.onKeyDown('r', NO_MODIFIERS)).toBe(false);
      expect(store.activeTool).toBe('select');

      store.enterEditMode({ kind: 'site' });

      expect(controller.onKeyDown('t', NO_MODIFIERS)).toBe(false);
      expect(store.activeTool).toBe('select');
    });

    it('takes the selected point with Delete inside path editing', () => {
      layOutPath();
      store.enterEditMode({ kind: 'path', pathId: store.paths[0].id });

      controller.onPointerDown({ x: 4, y: 2 }, NO_MODIFIERS);
      controller.onPointerUp({ x: 4, y: 2 }, NO_MODIFIERS);

      expect(store.paths[0].points).toHaveLength(3);

      expect(controller.onKeyDown('Delete', NO_MODIFIERS)).toBe(true);
      expect(store.paths[0].points).toHaveLength(2);
      expect(store.paths).toHaveLength(1);
    });
  });

  describe('buildings in view mode', () => {
    const layOutBuilding = () => {
      store.enterEditMode({ kind: 'site' });

      const building = store.building.addBuilding('Дом');

      store.composition.addShapeTerm(
        building.id,
        createRectangle({ center: { x: 10, y: 10 }, width: 6, length: 6, rotationDegrees: 0 }),
        'union'
      );
      store.exitEditMode();

      return building;
    };

    it('drags the whole building as one object', () => {
      const building = layOutBuilding();

      drag({ x: 10, y: 10 }, { x: 14.2, y: 12.1 });

      expect(store.selection).toEqual({ kind: 'building', buildingId: building.id });

      const [term] = store.buildings[0].composition.terms;

      expect(term.operand).toMatchObject({ center: { x: 14, y: 12 } });
    });

    it('puts the building back whole when the drag is interrupted', () => {
      layOutBuilding();

      controller.onPointerDown({ x: 10, y: 10 }, NO_MODIFIERS);
      controller.onPointerMove({ x: 20, y: 20 }, NO_MODIFIERS);
      controller.onPointerCancel();

      expect(store.buildings[0].composition.terms[0].operand).toMatchObject({
        center: { x: 10, y: 10 },
      });
    });

    it('opens the building editor on a double click', () => {
      const building = layOutBuilding();

      controller.onDoubleClick({ x: 10, y: 10 }, NO_MODIFIERS);

      expect(store.editorMode).toEqual({
        kind: 'edit',
        target: { kind: 'building', buildingId: building.id },
      });
    });

    it('descends into the selected building with Enter', () => {
      const building = layOutBuilding();

      controller.onPointerDown({ x: 10, y: 10 }, NO_MODIFIERS);
      controller.onPointerUp({ x: 10, y: 10 }, NO_MODIFIERS);

      expect(controller.onKeyDown('Enter', NO_MODIFIERS)).toBe(true);
      expect(store.editorMode).toEqual({
        kind: 'edit',
        target: { kind: 'building', buildingId: building.id },
      });
    });
  });

  describe('paths in view mode', () => {
    /** Lays out a straight (2,2)–(6,2) path and leaves view mode selecting. */
    const layOutPath = (): void => {
      store.setActiveTool('path');
      controller.onPointerDown({ x: 2, y: 2 }, NO_MODIFIERS);
      controller.onPointerDown({ x: 6, y: 2 }, NO_MODIFIERS);
      controller.onDoubleClick({ x: 6, y: 2 }, NO_MODIFIERS);
      store.setActiveTool('select');
    };

    beforeEach(layOutPath);

    it('drags the whole path as one object by its ribbon', () => {
      drag({ x: 4, y: 2 }, { x: 5.2, y: 4.1 });

      expect(store.selection).toEqual({ kind: 'path', pathId: store.paths[0].id });
      expect(store.paths[0].points.map(point => point.position)).toEqual([
        { x: 3, y: 4 },
        { x: 7, y: 4 },
      ]);
    });

    it('undoes a whole-path drag as one step', () => {
      drag({ x: 4, y: 2 }, { x: 5, y: 4 });
      controller.onUndo();

      expect(store.paths[0].points.map(point => point.position)).toEqual([
        { x: 2, y: 2 },
        { x: 6, y: 2 },
      ]);
    });

    it('puts the path back whole when the drag is interrupted', () => {
      controller.onPointerDown({ x: 4, y: 2 }, NO_MODIFIERS);
      controller.onPointerMove({ x: 10, y: 10 }, NO_MODIFIERS);
      controller.onPointerCancel();

      expect(store.paths[0].points.map(point => point.position)).toEqual([
        { x: 2, y: 2 },
        { x: 6, y: 2 },
      ]);
    });

    it('still moves a single point by its square, not the whole path', () => {
      controller.onPointerDown({ x: 2, y: 2 }, NO_MODIFIERS);
      controller.onPointerMove({ x: 3, y: 4 }, NO_MODIFIERS);
      controller.onPointerUp({ x: 3, y: 4 }, NO_MODIFIERS);

      expect(store.paths[0].points.map(point => point.position)).toEqual([
        { x: 3, y: 4 },
        { x: 6, y: 2 },
      ]);
    });
  });

  describe('the building editor', () => {
    const openBuildingEditor = () => {
      store.enterEditMode({ kind: 'site' });

      const building = store.building.addBuilding('Дом');

      store.composition.addShapeTerm(
        building.id,
        createRectangle({ center: { x: 10, y: 10 }, width: 10, length: 8, rotationDegrees: 0 }),
        'union'
      );
      store.exitEditMode();
      store.enterEditMode({ kind: 'building', buildingId: building.id });

      return building;
    };

    const drawWall = (): void => {
      controller.onKeyDown('w', NO_MODIFIERS);
      controller.onPointerDown({ x: 6, y: 8 }, NO_MODIFIERS);
      controller.onPointerDown({ x: 14, y: 8 }, NO_MODIFIERS);
      controller.onKeyDown('Enter', NO_MODIFIERS);
      controller.onKeyDown('v', NO_MODIFIERS);
    };

    it('arms the wall tool by its W hotkey inside the editor alone', () => {
      expect(controller.onKeyDown('w', NO_MODIFIERS)).toBe(false);

      openBuildingEditor();

      expect(controller.onKeyDown('w', NO_MODIFIERS)).toBe(true);
      expect(store.activeTool).toBe('building:wall');
    });

    it('clicks out a wall and commits it with Enter, selected', () => {
      openBuildingEditor();
      controller.onKeyDown('w', NO_MODIFIERS);
      controller.onPointerDown({ x: 6, y: 8 }, NO_MODIFIERS);
      controller.onPointerDown({ x: 14, y: 8 }, NO_MODIFIERS);

      expect(store.walls.draftWallPoints).toHaveLength(2);
      expect(controller.onKeyDown('Enter', NO_MODIFIERS)).toBe(true);

      const walls = wallsOf(store.buildings[0]);

      expect(walls).toHaveLength(1);
      expect(walls[0].points).toEqual([
        { x: 6, y: 8 },
        { x: 14, y: 8 },
      ]);
      expect(store.selection).toMatchObject({ kind: 'wall', wallId: walls[0].id });
    });

    it('commits the polyline on a double click', () => {
      openBuildingEditor();
      controller.onKeyDown('w', NO_MODIFIERS);
      controller.onPointerDown({ x: 6, y: 8 }, NO_MODIFIERS);
      controller.onPointerDown({ x: 14, y: 8 }, NO_MODIFIERS);
      controller.onDoubleClick({ x: 14, y: 8 }, NO_MODIFIERS);

      expect(wallsOf(store.buildings[0])).toHaveLength(1);
      expect(store.walls.draftWallPoints).toHaveLength(0);
    });

    it('abandons the draft polyline on Escape', () => {
      openBuildingEditor();
      controller.onKeyDown('w', NO_MODIFIERS);
      controller.onPointerDown({ x: 6, y: 8 }, NO_MODIFIERS);

      expect(controller.onKeyDown('Escape', NO_MODIFIERS)).toBe(true);
      expect(store.walls.draftWallPoints).toHaveLength(0);
      expect(wallsOf(store.buildings[0])).toHaveLength(0);
    });

    it('selects a wall by its body and drags one of its points', () => {
      openBuildingEditor();
      drawWall();
      store.setSelection(undefined);

      controller.onPointerDown({ x: 10, y: 8 }, NO_MODIFIERS);
      controller.onPointerUp({ x: 10, y: 8 }, NO_MODIFIERS);

      const [wall] = wallsOf(store.buildings[0]);

      expect(store.selection).toMatchObject({ kind: 'wall', wallId: wall.id });

      drag({ x: 6, y: 8 }, { x: 6.2, y: 10.1 });

      expect(wallsOf(store.buildings[0])[0].points[0]).toEqual({ x: 6, y: 10 });
    });

    it('puts the wall back whole when a point drag is interrupted', () => {
      openBuildingEditor();
      drawWall();

      controller.onPointerDown({ x: 6, y: 8 }, NO_MODIFIERS);
      controller.onPointerMove({ x: 9, y: 12 }, NO_MODIFIERS);
      controller.onPointerCancel();

      expect(wallsOf(store.buildings[0])[0].points[0]).toEqual({ x: 6, y: 8 });
    });

    it('removes the selected wall with Delete', () => {
      openBuildingEditor();
      drawWall();

      expect(controller.onKeyDown('Delete', NO_MODIFIERS)).toBe(true);
      expect(wallsOf(store.buildings[0])).toHaveLength(0);
      expect(store.selection).toBeUndefined();
    });

    it('undoes a committed wall as one step', () => {
      openBuildingEditor();
      drawWall();
      controller.onUndo();

      expect(wallsOf(store.buildings[0])).toHaveLength(0);
    });

    it('closes the editor with a double click on emptiness', () => {
      openBuildingEditor();

      controller.onDoubleClick({ x: 100, y: 100 }, NO_MODIFIERS);

      expect(store.editorMode).toEqual({ kind: 'view' });
    });

    it('refuses the site editor tools by hotkey', () => {
      openBuildingEditor();

      expect(controller.onKeyDown('r', NO_MODIFIERS)).toBe(false);
      expect(store.activeTool).toBe('select');
    });

    it('plants a corner by pulling the midpoint ring of a segment', () => {
      openBuildingEditor();
      drawWall();

      drag({ x: 10, y: 8 }, { x: 10, y: 10 });

      expect(wallsOf(store.buildings[0])[0].points).toEqual([
        { x: 6, y: 8 },
        { x: 10, y: 10 },
        { x: 14, y: 8 },
      ]);
    });

    it('removes a corner with a double click on its square, never below a segment', () => {
      openBuildingEditor();
      drawWall();
      drag({ x: 10, y: 8 }, { x: 10, y: 10 });

      controller.onDoubleClick({ x: 10, y: 10 }, NO_MODIFIERS);

      expect(wallsOf(store.buildings[0])[0].points).toHaveLength(2);

      controller.onDoubleClick({ x: 6, y: 8 }, NO_MODIFIERS);

      expect(wallsOf(store.buildings[0])[0].points).toHaveLength(2);
    });

    it('commits a line clicked back onto its start as a closed contour', () => {
      openBuildingEditor();
      controller.onKeyDown('w', NO_MODIFIERS);
      controller.onPointerDown({ x: 7, y: 7 }, NO_MODIFIERS);
      controller.onPointerDown({ x: 13, y: 7 }, NO_MODIFIERS);
      controller.onPointerDown({ x: 13, y: 11 }, NO_MODIFIERS);
      controller.onPointerDown({ x: 7, y: 11 }, NO_MODIFIERS);
      controller.onPointerDown({ x: 7, y: 7 }, NO_MODIFIERS);
      controller.onKeyDown('Enter', NO_MODIFIERS);

      const [wall] = wallsOf(store.buildings[0]);

      expect(wall.isClosed).toBe(true);
      expect(wall.points).toHaveLength(4);
    });

    it('seals the ring when an endpoint is dragged onto the opposite end', () => {
      openBuildingEditor();
      controller.onKeyDown('w', NO_MODIFIERS);
      controller.onPointerDown({ x: 7, y: 7 }, NO_MODIFIERS);
      controller.onPointerDown({ x: 13, y: 7 }, NO_MODIFIERS);
      controller.onPointerDown({ x: 13, y: 11 }, NO_MODIFIERS);
      controller.onPointerDown({ x: 7, y: 11 }, NO_MODIFIERS);
      controller.onPointerDown({ x: 7, y: 8 }, NO_MODIFIERS);
      controller.onKeyDown('Enter', NO_MODIFIERS);
      controller.onKeyDown('v', NO_MODIFIERS);

      // Half a metre off the start — inside the handle's 0.8 m magnet reach.
      drag({ x: 7, y: 8 }, { x: 7, y: 7.5 });

      const [wall] = wallsOf(store.buildings[0]);

      expect(wall.isClosed).toBe(true);
      expect(wall.points).toEqual([
        { x: 7, y: 7 },
        { x: 13, y: 7 },
        { x: 13, y: 11 },
        { x: 7, y: 11 },
      ]);
    });

    it('cuts a ring open at a corner with Alt+double click', () => {
      openBuildingEditor();
      controller.onKeyDown('w', NO_MODIFIERS);
      controller.onPointerDown({ x: 7, y: 7 }, NO_MODIFIERS);
      controller.onPointerDown({ x: 13, y: 7 }, NO_MODIFIERS);
      controller.onPointerDown({ x: 13, y: 11 }, NO_MODIFIERS);
      controller.onPointerDown({ x: 7, y: 11 }, NO_MODIFIERS);
      controller.onPointerDown({ x: 7, y: 7 }, NO_MODIFIERS);
      controller.onKeyDown('Enter', NO_MODIFIERS);
      controller.onKeyDown('v', NO_MODIFIERS);

      controller.onDoubleClick({ x: 13, y: 7 }, ALT_HELD);

      const [wall] = wallsOf(store.buildings[0]);

      expect(wall.isClosed).toBe(false);
      expect(wall.points).toHaveLength(5);
      expect(wall.points[0]).toEqual({ x: 13, y: 7 });
      expect(wall.points[4]).toEqual({ x: 13, y: 7 });
    });

    it('counts only wall-enclosed regions as rooms — the slab frame is none', () => {
      openBuildingEditor();
      controller.onKeyDown('w', NO_MODIFIERS);
      // A closed ring drawn INSIDE the footprint (x ∈ [5,15], y ∈ [6,14])
      // leaves a frame of bare slab around it — concrete, but no room.
      controller.onPointerDown({ x: 6, y: 7 }, NO_MODIFIERS);
      controller.onPointerDown({ x: 14, y: 7 }, NO_MODIFIERS);
      controller.onPointerDown({ x: 14, y: 13 }, NO_MODIFIERS);
      controller.onPointerDown({ x: 6, y: 13 }, NO_MODIFIERS);
      controller.onPointerDown({ x: 6, y: 7 }, NO_MODIFIERS);
      controller.onKeyDown('Enter', NO_MODIFIERS);

      expect(store.building.editedStoreyScene?.rooms).toHaveLength(1);
    });

    it('still cuts rooms with edge-to-edge partitions when nothing encloses', () => {
      openBuildingEditor();
      // One wall across the whole footprint: the slab edge stands in for the
      // exterior walls, so the cut yields two rooms — the pre-ring workflow.
      controller.onKeyDown('w', NO_MODIFIERS);
      controller.onPointerDown({ x: 10, y: 6 }, NO_MODIFIERS);
      controller.onPointerDown({ x: 10, y: 14 }, NO_MODIFIERS);
      controller.onKeyDown('Enter', NO_MODIFIERS);

      expect(store.building.editedStoreyScene?.rooms).toHaveLength(2);
    });

    it('lights the room the КОМНАТЫ pointer rests on through the session', () => {
      openBuildingEditor();

      store.building.setHoveredRoomIndex(1);
      expect(store.building.hoveredRoomIndex).toBe(1);

      store.exitEditMode();
      expect(store.building.hoveredRoomIndex).toBeUndefined();
    });

    it('lands a wall click past the slab on the foundation edge', () => {
      openBuildingEditor();
      controller.onKeyDown('w', NO_MODIFIERS);
      // The footprint spans x ∈ [5, 15]: the second click aims well past it.
      controller.onPointerDown({ x: 6, y: 8 }, NO_MODIFIERS);
      controller.onPointerDown({ x: 25, y: 8 }, NO_MODIFIERS);
      controller.onKeyDown('Enter', NO_MODIFIERS);

      expect(wallsOf(store.buildings[0])[0].points).toEqual([
        { x: 6, y: 8 },
        { x: 15, y: 8 },
      ]);
    });

    it('holds a dragged corner onto the foundation slab', () => {
      openBuildingEditor();
      drawWall();

      drag({ x: 14, y: 8 }, { x: 25, y: 8 });

      expect(wallsOf(store.buildings[0])[0].points[1]).toEqual({ x: 15, y: 8 });
    });

    it('carries walls, furniture and lights along when the building moves', () => {
      openBuildingEditor();
      drawWall();

      const buildingId = store.buildings[0].id;

      store.storeyObjects.placeFurnitureAt(buildingId, { x: 9, y: 10 });
      store.storeyObjects.addCeilingLightAt(buildingId, { x: 11, y: 11 });
      store.exitEditMode();
      store.setSelection(undefined);

      drag({ x: 10, y: 12 }, { x: 13, y: 12 });

      const [building] = store.buildings;
      const storey = storeysOf(building)[0];

      expect(storey.walls[0].points).toEqual([
        { x: 9, y: 8 },
        { x: 17, y: 8 },
      ]);
      expect(furnitureOf(storey)[0].position).toEqual({ x: 12, y: 10 });

      const [light] = devicesOf(storey);

      assert(light.host.kind === 'ceiling', 'expected the ceiling light');
      expect(light.host.position).toEqual({ x: 14, y: 11 });
    });

    it('splits an open wall in two at an interior corner with Alt+double click', () => {
      openBuildingEditor();
      controller.onKeyDown('w', NO_MODIFIERS);
      controller.onPointerDown({ x: 6, y: 8 }, NO_MODIFIERS);
      controller.onPointerDown({ x: 10, y: 8 }, NO_MODIFIERS);
      controller.onPointerDown({ x: 14, y: 8 }, NO_MODIFIERS);
      controller.onKeyDown('Enter', NO_MODIFIERS);
      controller.onKeyDown('v', NO_MODIFIERS);

      controller.onDoubleClick({ x: 10, y: 8 }, ALT_HELD);

      const walls = wallsOf(store.buildings[0]);

      expect(walls).toHaveLength(2);
      expect(walls[0].points).toEqual([
        { x: 6, y: 8 },
        { x: 10, y: 8 },
      ]);
      expect(walls[1].points).toEqual([
        { x: 10, y: 8 },
        { x: 14, y: 8 },
      ]);
    });
  });

  describe('openings in the building editor', () => {
    const openWithWall = () => {
      store.enterEditMode({ kind: 'site' });

      const building = store.building.addBuilding('Дом');

      store.composition.addShapeTerm(
        building.id,
        createRectangle({ center: { x: 10, y: 10 }, width: 10, length: 8, rotationDegrees: 0 }),
        'union'
      );
      store.exitEditMode();
      store.enterEditMode({ kind: 'building', buildingId: building.id });
      controller.onKeyDown('w', NO_MODIFIERS);
      controller.onPointerDown({ x: 6, y: 8 }, NO_MODIFIERS);
      controller.onPointerDown({ x: 14, y: 8 }, NO_MODIFIERS);
      controller.onKeyDown('Enter', NO_MODIFIERS);
      store.setSelection(undefined);

      return building;
    };

    it('hangs the armed door on the wall by its O hotkey and click', () => {
      const building = openWithWall();

      expect(controller.onKeyDown('o', NO_MODIFIERS)).toBe(true);
      expect(store.activeTool).toBe('building:opening');

      controller.onPointerDown({ x: 10, y: 8 }, NO_MODIFIERS);

      const [opening] = openingsOf(store.buildings[0]);

      expect(opening).toMatchObject({ kind: 'door', sillMeters: 0 });
      expect(opening.offsetMeters).toBeCloseTo(4);
      expect(store.selection).toMatchObject({ kind: 'opening', openingId: opening.id });
      expect(building.id).toBe(store.buildings[0].id);
    });

    it('places окно в пол once the panoramic preset is armed', () => {
      openWithWall();
      controller.onKeyDown('o', NO_MODIFIERS);
      store.walls.setArmedOpeningPreset('panoramic');
      controller.onPointerDown({ x: 12, y: 8 }, NO_MODIFIERS);

      const [opening] = openingsOf(store.buildings[0]);

      expect(opening).toMatchObject({ kind: 'window', sillMeters: 0, headMeters: 2.5 });
    });

    it('slides the opening along its wall with the select tool', () => {
      openWithWall();
      controller.onKeyDown('o', NO_MODIFIERS);
      controller.onPointerDown({ x: 10, y: 8 }, NO_MODIFIERS);
      controller.onKeyDown('v', NO_MODIFIERS);

      drag({ x: 10, y: 8 }, { x: 12.1, y: 9 });

      const [opening] = openingsOf(store.buildings[0]);

      expect(opening.offsetMeters).toBeCloseTo(6);
    });

    it('puts the opening back when the slide is interrupted', () => {
      openWithWall();
      controller.onKeyDown('o', NO_MODIFIERS);
      controller.onPointerDown({ x: 10, y: 8 }, NO_MODIFIERS);
      controller.onKeyDown('v', NO_MODIFIERS);

      controller.onPointerDown({ x: 10, y: 8 }, NO_MODIFIERS);
      controller.onPointerMove({ x: 13, y: 8 }, NO_MODIFIERS);
      controller.onPointerCancel();

      expect(openingsOf(store.buildings[0])[0].offsetMeters).toBeCloseTo(4);
    });

    it('removes the selected opening with Delete, keeping the wall', () => {
      openWithWall();
      controller.onKeyDown('o', NO_MODIFIERS);
      controller.onPointerDown({ x: 10, y: 8 }, NO_MODIFIERS);
      controller.onKeyDown('v', NO_MODIFIERS);
      controller.onPointerDown({ x: 10, y: 8 }, NO_MODIFIERS);
      controller.onPointerUp({ x: 10, y: 8 }, NO_MODIFIERS);

      expect(controller.onKeyDown('Delete', NO_MODIFIERS)).toBe(true);
      expect(openingsOf(store.buildings[0])).toEqual([]);
      expect(wallsOf(store.buildings[0])).toHaveLength(1);
    });
  });

  describe('furniture in the building editor', () => {
    const openWithWall = () => {
      store.enterEditMode({ kind: 'site' });

      const building = store.building.addBuilding('Дом');

      store.composition.addShapeTerm(
        building.id,
        createRectangle({ center: { x: 10, y: 10 }, width: 10, length: 8, rotationDegrees: 0 }),
        'union'
      );
      store.exitEditMode();
      store.enterEditMode({ kind: 'building', buildingId: building.id });
      controller.onKeyDown('w', NO_MODIFIERS);
      controller.onPointerDown({ x: 6, y: 8 }, NO_MODIFIERS);
      controller.onPointerDown({ x: 14, y: 8 }, NO_MODIFIERS);
      controller.onKeyDown('Enter', NO_MODIFIERS);
      store.setSelection(undefined);

      return building;
    };

    const activeFurniture = () =>
      storeysOf(store.buildings[0]).flatMap(storey => storey.furniture ?? []);

    it('places the armed piece by its F hotkey and click, selected', () => {
      openWithWall();

      expect(controller.onKeyDown('f', NO_MODIFIERS)).toBe(true);
      expect(store.activeTool).toBe('building:furniture');

      store.storeyObjects.setArmedFurnitureId('sofa');
      controller.onPointerDown({ x: 10, y: 11 }, NO_MODIFIERS);

      const [item] = activeFurniture();

      expect(item).toMatchObject({ catalogId: 'sofa', elevationMeters: 0 });
      expect(item.position).toEqual({ x: 10, y: 11 });
      expect(store.selection).toMatchObject({ kind: 'furniture', furnitureId: item.id });
    });

    it('stays in hand so a room is furnished piece after piece (R32)', () => {
      openWithWall();
      controller.onKeyDown('f', NO_MODIFIERS);
      store.storeyObjects.setArmedFurnitureId('sofa');
      controller.onPointerDown({ x: 10, y: 11 }, NO_MODIFIERS);
      controller.onPointerUp({ x: 10, y: 11 }, NO_MODIFIERS);

      expect(store.activeTool).toBe('building:furniture');

      controller.onPointerDown({ x: 12, y: 11 }, NO_MODIFIERS);

      expect(activeFurniture()).toHaveLength(2);
    });

    it('snaps a dragged piece back-to-wall by the magnet', () => {
      openWithWall();
      controller.onKeyDown('f', NO_MODIFIERS);
      store.storeyObjects.setArmedFurnitureId('sofa');
      controller.onPointerDown({ x: 10, y: 11 }, NO_MODIFIERS);
      controller.onKeyDown('v', NO_MODIFIERS);

      drag({ x: 10, y: 11 }, { x: 10, y: 8.6 });

      const [item] = activeFurniture();

      // Flush against the wall face (8 + 0.19) plus half the sofa's depth.
      expect(item.position.y).toBeCloseTo(8.19 + 0.475, 2);
      expect(item.rotationDegrees).toBeCloseTo(0);
    });

    it('keeps the grid when Alt suspends the magnet', () => {
      openWithWall();
      controller.onKeyDown('f', NO_MODIFIERS);
      store.storeyObjects.setArmedFurnitureId('sofa');
      controller.onPointerDown({ x: 10, y: 11 }, NO_MODIFIERS);
      controller.onKeyDown('v', NO_MODIFIERS);

      drag({ x: 10, y: 11 }, { x: 10, y: 8.63 }, ALT_HELD);

      expect(activeFurniture()[0].position.y).toBeCloseTo(8.63, 2);
    });

    it('puts the piece back when the drag is interrupted', () => {
      openWithWall();
      controller.onKeyDown('f', NO_MODIFIERS);
      controller.onPointerDown({ x: 10, y: 11 }, NO_MODIFIERS);
      controller.onKeyDown('v', NO_MODIFIERS);

      controller.onPointerDown({ x: 10, y: 11 }, NO_MODIFIERS);
      controller.onPointerMove({ x: 12, y: 12 }, NO_MODIFIERS);
      controller.onPointerCancel();

      expect(activeFurniture()[0].position).toEqual({ x: 10, y: 11 });
    });

    it('removes the selected piece with Delete', () => {
      openWithWall();
      controller.onKeyDown('f', NO_MODIFIERS);
      controller.onPointerDown({ x: 10, y: 11 }, NO_MODIFIERS);
      controller.onKeyDown('v', NO_MODIFIERS);
      controller.onPointerDown({ x: 10, y: 11 }, NO_MODIFIERS);
      controller.onPointerUp({ x: 10, y: 11 }, NO_MODIFIERS);

      expect(controller.onKeyDown('Delete', NO_MODIFIERS)).toBe(true);
      expect(activeFurniture()).toEqual([]);
    });

    it('lands the piece on the ACTIVE storey', () => {
      openWithWall();
      store.building.addStoreyToEditedBuilding({ copyWalls: false });
      controller.onKeyDown('f', NO_MODIFIERS);
      controller.onPointerDown({ x: 10, y: 11 }, NO_MODIFIERS);

      const storeys = storeysOf(store.buildings[0]);

      expect(storeys[1].furniture ?? []).toHaveLength(1);
      expect(storeys[0].furniture ?? []).toHaveLength(0);
    });
  });

  describe('furniture in the 3D scene', () => {
    it('hands each piece over as a turned template instance at its storey level', () => {
      store.enterEditMode({ kind: 'site' });

      const building = store.building.addBuilding('Дом');

      store.composition.addShapeTerm(
        building.id,
        createRectangle({ center: { x: 10, y: 10 }, width: 10, length: 8, rotationDegrees: 0 }),
        'union'
      );
      store.exitEditMode();
      store.enterEditMode({ kind: 'building', buildingId: building.id });
      store.storeyObjects.setArmedFurnitureId('toilet');
      store.storeyObjects.placeFurnitureAt(building.id, { x: 12, y: 9 });

      const [piece] = store.scene.sceneFurniture;

      expect(piece.catalogId).toBe('toilet');
      expect(piece.rotationDegrees).toBe(0);
      // planToWorld: plan (x, y) → world (x, elevation, −y).
      expect(piece.position[0]).toBe(12);
      expect(piece.position[2]).toBe(-9);
      expect(Number.isFinite(piece.position[1])).toBe(true);
    });
  });

  describe('electrics in the building editor', () => {
    const openWithWall = () => {
      store.enterEditMode({ kind: 'site' });

      const building = store.building.addBuilding('Дом');

      store.composition.addShapeTerm(
        building.id,
        createRectangle({ center: { x: 10, y: 10 }, width: 10, length: 8, rotationDegrees: 0 }),
        'union'
      );
      store.exitEditMode();
      store.enterEditMode({ kind: 'building', buildingId: building.id });
      controller.onKeyDown('w', NO_MODIFIERS);
      controller.onPointerDown({ x: 6, y: 8 }, NO_MODIFIERS);
      controller.onPointerDown({ x: 14, y: 8 }, NO_MODIFIERS);
      controller.onKeyDown('Enter', NO_MODIFIERS);
      store.setSelection(undefined);

      return building;
    };

    const groundDevices = () => devicesOf(storeysOf(store.buildings[0])[0]);

    it('hangs the armed outlet on the wall at its conventional height', () => {
      openWithWall();

      expect(controller.onKeyDown('k', NO_MODIFIERS)).toBe(true);
      expect(store.activeTool).toBe('building:electric');

      controller.onPointerDown({ x: 10, y: 8 }, NO_MODIFIERS);

      const [device] = groundDevices();

      expect(device.kind).toBe('outlet');
      expect(device.host).toMatchObject({ kind: 'wall', heightMeters: 0.3 });
      expect(device.host.kind === 'wall' ? device.host.offsetMeters : undefined).toBeCloseTo(4);
      expect(store.selection).toMatchObject({ kind: 'device', deviceId: device.id });
    });

    it('puts a light on the ceiling at the clicked point', () => {
      openWithWall();
      controller.onKeyDown('k', NO_MODIFIERS);
      store.storeyObjects.setArmedDeviceKind('light');
      controller.onPointerDown({ x: 10, y: 11 }, NO_MODIFIERS);

      const [device] = groundDevices();

      expect(device.kind).toBe('light');
      expect(device.host).toEqual({ kind: 'ceiling', position: { x: 10, y: 11 } });
    });

    it('slides a wall device along its host with the select tool', () => {
      openWithWall();
      controller.onKeyDown('k', NO_MODIFIERS);
      controller.onPointerDown({ x: 10, y: 8 }, NO_MODIFIERS);
      controller.onKeyDown('v', NO_MODIFIERS);

      drag({ x: 10, y: 8 }, { x: 12.1, y: 8.6 });

      const [device] = groundDevices();

      expect(device.host.kind === 'wall' ? device.host.offsetMeters : undefined).toBeCloseTo(6);
    });

    it('wires the panel to a consumer and a switch to a light', () => {
      const building = openWithWall();

      // The electric tool is sticky (R32): one arming, then socket after socket.
      controller.onKeyDown('k', NO_MODIFIERS);

      const placeDevice = (kind: DeviceKind, at: Vector2): void => {
        store.storeyObjects.setArmedDeviceKind(kind);
        controller.onPointerDown(at, NO_MODIFIERS);
      };

      placeDevice('panel', { x: 7, y: 8 });
      placeDevice('outlet', { x: 12, y: 8 });
      placeDevice('switch', { x: 9, y: 8 });
      placeDevice('light', { x: 10, y: 12 });

      const [panel, outlet, wallSwitch, light] = groundDevices();

      expect(controller.onKeyDown('l', NO_MODIFIERS)).toBe(true);
      controller.onPointerDown({ x: 7, y: 8 }, NO_MODIFIERS);
      controller.onPointerDown({ x: 12, y: 8 }, NO_MODIFIERS);
      controller.onPointerDown({ x: 9, y: 8 }, NO_MODIFIERS);
      controller.onPointerDown({ x: 10, y: 12 }, NO_MODIFIERS);

      const storey = storeysOf(store.buildings[0])[0];

      expect(groupsOf(storey)).toHaveLength(1);
      expect(groupsOf(storey)[0]).toMatchObject({
        panelId: panel.id,
        deviceIds: [outlet.id],
      });
      expect(switchLinksOf(storey)).toEqual([{ switchId: wallSwitch.id, lightId: light.id }]);

      // The wiring derives: one circuit run along the wall, one dashed link.
      const scene = store.scene.buildingScenes[0].storeys[0];

      expect(scene.wires).toHaveLength(2);
      expect(scene.wires.filter(wire => wire.isSwitchLink)).toHaveLength(1);
      expect(building.id).toBe(store.buildings[0].id);
    });

    it('takes the wiring with a removed panel', () => {
      openWithWall();
      controller.onKeyDown('k', NO_MODIFIERS);
      store.storeyObjects.setArmedDeviceKind('panel');
      controller.onPointerDown({ x: 7, y: 8 }, NO_MODIFIERS);
      store.storeyObjects.setArmedDeviceKind('outlet');
      controller.onPointerDown({ x: 12, y: 8 }, NO_MODIFIERS);

      const [panel] = groundDevices();

      controller.onKeyDown('l', NO_MODIFIERS);
      controller.onPointerDown({ x: 7, y: 8 }, NO_MODIFIERS);
      controller.onPointerDown({ x: 12, y: 8 }, NO_MODIFIERS);

      store.storeyObjects.removeDevice(store.buildings[0].id, panel.id);

      const storey = storeysOf(store.buildings[0])[0];

      expect(devicesOf(storey)).toHaveLength(1);
      expect(groupsOf(storey)).toEqual([]);
      expect(store.scene.buildingScenes[0].storeys[0].wires).toEqual([]);
    });

    it('clears the pending half of a connect gesture with Escape', () => {
      openWithWall();
      controller.onKeyDown('k', NO_MODIFIERS);
      controller.onPointerDown({ x: 10, y: 8 }, NO_MODIFIERS);
      controller.onKeyDown('l', NO_MODIFIERS);
      controller.onPointerDown({ x: 10, y: 8 }, NO_MODIFIERS);

      expect(store.storeyObjects.pendingConnectDeviceId).toBeDefined();
      expect(controller.onKeyDown('Escape', NO_MODIFIERS)).toBe(true);
      expect(store.storeyObjects.pendingConnectDeviceId).toBeUndefined();
    });
  });

  describe('editor tool contributions', () => {
    it('keeps every contributed hotkey off the shared ones', () => {
      for (const spec of Object.values(OBJECT_EDITOR_SPECS)) {
        for (const tool of spec.ownTools) {
          if (!isNil(tool.hotkey)) {
            expect(TOOL_HOTKEYS[tool.hotkey]).toBeUndefined();
          }
        }
      }
    });
  });

  describe('the cursor readout', () => {
    it('follows the pointer and clears when it leaves the canvas', () => {
      controller.onPointerMove({ x: 3, y: 4 }, NO_MODIFIERS);
      expect(store.view.cursorPlanPoint).toEqual({ x: 3, y: 4 });

      controller.onPointerLeave();
      expect(store.view.cursorPlanPoint).toBeUndefined();
    });
  });

  describe('utility trenches in view mode', () => {
    it('clicks out a trench of the armed system and finishes on Enter', () => {
      store.utilities.setNextUtilitySystem('water');
      store.setActiveTool('utility');

      controller.onPointerDown({ x: 2, y: 2 }, NO_MODIFIERS);
      controller.onPointerDown({ x: 12, y: 2 }, NO_MODIFIERS);
      controller.onKeyDown('Enter', NO_MODIFIERS);

      expect(store.utilityRoutes).toHaveLength(1);
      expect(store.utilityRoutes[0].system).toBe('water');
      expect(store.utilityRoutes[0].points).toEqual([
        { x: 2, y: 2 },
        { x: 12, y: 2 },
      ]);
      expect(store.selection).toEqual({
        kind: 'utilityRoute',
        routeId: store.utilityRoutes[0].id,
      });
    });

    it('lands a click near the matching entry exactly on it', () => {
      const building = store.building.addBuilding('Дом');

      store.composition.addShapeTerm(
        building.id,
        createRectangle({ center: { x: 10, y: 10 }, width: 8, length: 8, rotationDegrees: 0 }),
        'union'
      );
      store.utilities.addUtilityEntry(building.id, 'water');

      const entryPoint = store.scene.buildingScenes[0].entryPoints[0].position;

      store.utilities.setNextUtilitySystem('water');
      store.setActiveTool('utility');

      // A metre off the entry — inside the 1.4 m snap reach at this zoom.
      controller.onPointerDown({ x: entryPoint.x + 1, y: entryPoint.y }, NO_MODIFIERS);
      controller.onPointerDown({ x: entryPoint.x + 10, y: entryPoint.y }, NO_MODIFIERS);
      controller.onKeyDown('Enter', NO_MODIFIERS);

      expect(store.utilityRoutes[0].points[0]).toEqual(entryPoint);
    });

    it('drops the polyline in flight on Escape and keeps the plan clean', () => {
      store.setActiveTool('utility');
      controller.onPointerDown({ x: 2, y: 2 }, NO_MODIFIERS);

      controller.onKeyDown('Escape', NO_MODIFIERS);

      expect(store.utilities.draftUtilityPoints).toHaveLength(0);
      expect(store.utilityRoutes).toHaveLength(0);
    });

    it('slides the whole trench rigidly with the select tool', () => {
      store.utilities.setNextUtilitySystem('power');
      store.setActiveTool('utility');
      controller.onPointerDown({ x: 2, y: 2 }, NO_MODIFIERS);
      controller.onPointerDown({ x: 12, y: 2 }, NO_MODIFIERS);
      controller.onKeyDown('Enter', NO_MODIFIERS);

      store.setActiveTool('select');
      drag({ x: 7, y: 2 }, { x: 7, y: 7 });

      expect(store.utilityRoutes[0].points).toEqual([
        { x: 2, y: 7 },
        { x: 12, y: 7 },
      ]);
    });

    it('removes the selected trench with Delete', () => {
      store.setActiveTool('utility');
      controller.onPointerDown({ x: 2, y: 2 }, NO_MODIFIERS);
      controller.onPointerDown({ x: 12, y: 2 }, NO_MODIFIERS);
      controller.onKeyDown('Enter', NO_MODIFIERS);

      controller.onKeyDown('Delete', NO_MODIFIERS);

      expect(store.utilityRoutes).toHaveLength(0);
      expect(store.selection).toBeUndefined();
    });

    it('reaches the tool by its N key only where the rail carries it', () => {
      expect(controller.onKeyDown('n', NO_MODIFIERS)).toBe(true);
      expect(store.activeTool).toBe('utility');

      const building = store.building.addBuilding('Дом');

      store.enterEditMode({ kind: 'building', buildingId: building.id });
      expect(controller.onKeyDown('n', NO_MODIFIERS)).toBe(false);
    });

    it('drags one bend by its square in view mode, the rest staying put', () => {
      store.setActiveTool('utility');
      controller.onPointerDown({ x: 2, y: 2 }, NO_MODIFIERS);
      controller.onPointerDown({ x: 12, y: 2 }, NO_MODIFIERS);
      controller.onKeyDown('Enter', NO_MODIFIERS);

      store.setActiveTool('select');
      drag({ x: 12, y: 2 }, { x: 12, y: 6 });

      expect(store.utilityRoutes[0].points).toEqual([
        { x: 2, y: 2 },
        { x: 12, y: 6 },
      ]);
    });

    it('digs a new entry against the edited frost depth', () => {
      const building = store.building.addBuilding('Дом');

      store.composition.addShapeTerm(
        building.id,
        createRectangle({ center: { x: 10, y: 10 }, width: 8, length: 8, rotationDegrees: 0 }),
        'union'
      );
      store.updateSettings({ frostDepthMeters: 2 });
      store.utilities.addUtilityEntry(building.id, 'water');

      // СП 31: the water service line sits half a metre below the frost line.
      expect(store.buildings[0].entries?.[0].depthMeters).toBeCloseTo(2.5);
    });
  });

  describe('the trench editor', () => {
    const drawRoute = (): void => {
      store.utilities.setNextUtilitySystem('water');
      store.setActiveTool('utility');
      controller.onPointerDown({ x: 2, y: 2 }, NO_MODIFIERS);
      controller.onPointerDown({ x: 12, y: 2 }, NO_MODIFIERS);
      controller.onKeyDown('Enter', NO_MODIFIERS);
    };

    it('opens on a double click over the run and closes over emptiness', () => {
      drawRoute();

      controller.onDoubleClick({ x: 7, y: 2 }, NO_MODIFIERS);

      expect(store.editorMode).toEqual({
        kind: 'edit',
        target: { kind: 'utilityRoute', routeId: store.utilityRoutes[0].id },
      });
      expect(store.selection?.kind).toBe('utilityRoute');

      controller.onDoubleClick({ x: 25, y: 25 }, NO_MODIFIERS);

      expect(store.editorMode.kind).toBe('view');
    });

    it('plants a bend by pulling a midpoint ring', () => {
      drawRoute();
      store.enterEditMode({ kind: 'utilityRoute', routeId: store.utilityRoutes[0].id });

      drag({ x: 7, y: 2 }, { x: 7, y: 6 });

      expect(store.utilityRoutes[0].points).toEqual([
        { x: 2, y: 2 },
        { x: 7, y: 6 },
        { x: 12, y: 2 },
      ]);
    });

    it('removes a bend with a double click on its square, never below a segment', () => {
      drawRoute();
      store.enterEditMode({ kind: 'utilityRoute', routeId: store.utilityRoutes[0].id });
      drag({ x: 7, y: 2 }, { x: 7, y: 6 });

      controller.onDoubleClick({ x: 7, y: 6 }, NO_MODIFIERS);

      expect(store.utilityRoutes[0].points).toEqual([
        { x: 2, y: 2 },
        { x: 12, y: 2 },
      ]);

      controller.onDoubleClick({ x: 2, y: 2 }, NO_MODIFIERS);

      expect(store.utilityRoutes[0].points).toHaveLength(2);
    });

    it('lands a dragged bend onto its system’s entry', () => {
      const building = store.building.addBuilding('Дом');

      store.composition.addShapeTerm(
        building.id,
        createRectangle({ center: { x: 20, y: 10 }, width: 8, length: 8, rotationDegrees: 0 }),
        'union'
      );
      store.utilities.addUtilityEntry(building.id, 'water');

      const entryPoint = store.scene.buildingScenes[0].entryPoints[0].position;

      drawRoute();
      store.enterEditMode({ kind: 'utilityRoute', routeId: store.utilityRoutes[0].id });

      drag({ x: 12, y: 2 }, { x: entryPoint.x + 1, y: entryPoint.y });

      expect(store.utilityRoutes[0].points[1]).toEqual(entryPoint);
    });

    it('puts an interrupted bend drag back whole on Escape', () => {
      drawRoute();
      store.enterEditMode({ kind: 'utilityRoute', routeId: store.utilityRoutes[0].id });

      controller.onPointerDown({ x: 12, y: 2 }, NO_MODIFIERS);
      controller.onPointerMove({ x: 12, y: 8 }, NO_MODIFIERS);
      controller.onKeyDown('Escape', NO_MODIFIERS);

      expect(store.utilityRoutes[0].points).toEqual([
        { x: 2, y: 2 },
        { x: 12, y: 2 },
      ]);
    });

    it('never lets Delete take the trench out from under its own editor', () => {
      drawRoute();
      store.enterEditMode({ kind: 'utilityRoute', routeId: store.utilityRoutes[0].id });

      controller.onKeyDown('Delete', NO_MODIFIERS);

      expect(store.utilityRoutes).toHaveLength(1);
      expect(store.editorMode.kind).toBe('edit');
    });
  });
  describe('stairs as objects on the canvas', () => {
    const openHouseWithStair = (): void => {
      const building = store.building.addBuilding('Дом');

      store.composition.addShapeTerm(
        building.id,
        createRectangle({ center: { x: 10, y: 10 }, width: 16, length: 16, rotationDegrees: 0 }),
        'union'
      );
      store.enterEditMode({ kind: 'building', buildingId: building.id });
      store.setActiveTool('building:stair');
      controller.onPointerDown({ x: 10, y: 10 }, NO_MODIFIERS);
      controller.onPointerUp({ x: 10, y: 10 }, NO_MODIFIERS);
      // The tool hands itself back to select the moment the stair lands (R30).
    };

    it('places a stair where the tool clicked', () => {
      openHouseWithStair();

      expect(store.building.editedStoreyScene?.stairs).toHaveLength(1);
    });

    it('takes hold of a stair by its body and drags it', () => {
      openHouseWithStair();

      const before = store.building.editedStoreyScene?.stairs[0].stair.position;

      drag({ x: 10, y: 10 }, { x: 7, y: 7 });

      const after = store.building.editedStoreyScene?.stairs[0].stair.position;

      expect(store.selection?.kind).toBe('stair');
      expect(after).not.toEqual(before);
    });

    it('adds a second stair to the selection with Shift', () => {
      openHouseWithStair();
      store.setActiveTool('building:stair');
      controller.onPointerDown({ x: 14, y: 14 }, NO_MODIFIERS);
      controller.onPointerUp({ x: 14, y: 14 }, NO_MODIFIERS);
      store.setActiveTool('select');

      controller.onPointerDown({ x: 10, y: 10 }, NO_MODIFIERS);
      controller.onPointerUp({ x: 10, y: 10 }, NO_MODIFIERS);
      controller.onPointerDown({ x: 14, y: 14 }, SHIFT_HELD);
      controller.onPointerUp({ x: 14, y: 14 }, SHIFT_HELD);

      expect(store.selections).toHaveLength(2);
    });

    it('hands the stair over to the select tool the moment it lands (R30)', () => {
      openHouseWithStair();

      expect(store.activeTool).toBe('select');
      expect(store.building.editedStoreyScene?.stairs).toHaveLength(1);

      // The very next click adjusts the stair rather than placing a second one.
      controller.onPointerDown({ x: 10, y: 10 }, NO_MODIFIERS);
      controller.onPointerUp({ x: 10, y: 10 }, NO_MODIFIERS);

      expect(store.building.editedStoreyScene?.stairs).toHaveLength(1);
      expect(store.selection?.kind).toBe('stair');
    });

    it('deletes the selected stair with the keyboard', () => {
      openHouseWithStair();
      controller.onPointerDown({ x: 10, y: 10 }, NO_MODIFIERS);
      controller.onPointerUp({ x: 10, y: 10 }, NO_MODIFIERS);
      controller.onKeyDown('Delete', NO_MODIFIERS);

      expect(store.building.editedStoreyScene?.stairs).toHaveLength(0);
    });
  });

  describe('posts and cancelled gestures', () => {
    const openHouse = (): void => {
      const building = store.building.addBuilding('Дом');

      store.composition.addShapeTerm(
        building.id,
        createRectangle({ center: { x: 10, y: 10 }, width: 16, length: 16, rotationDegrees: 0 }),
        'union'
      );
      store.enterEditMode({ kind: 'building', buildingId: building.id });
    };

    const placeWith = (tool: 'building:stair' | 'building:support', at: Vector2): void => {
      store.setActiveTool(tool);
      controller.onPointerDown(at, NO_MODIFIERS);
      controller.onPointerUp(at, NO_MODIFIERS);
      store.setActiveTool('select');
    };

    it('picks a post by clicking it and takes it away with Delete', () => {
      openHouse();
      placeWith('building:support', { x: 10, y: 10 });

      controller.onPointerDown({ x: 10, y: 10 }, NO_MODIFIERS);
      controller.onPointerUp({ x: 10, y: 10 }, NO_MODIFIERS);

      expect(store.selection?.kind).toBe('support');

      controller.onKeyDown('Delete', NO_MODIFIERS);

      expect(store.building.editedStoreyScene?.supports).toHaveLength(0);
    });

    it('puts a dragged stair back where it was when the gesture is cancelled', () => {
      openHouse();
      placeWith('building:stair', { x: 10, y: 10 });

      const before = store.building.editedStoreyScene?.stairs[0].stair.position;

      controller.onPointerDown({ x: 10, y: 10 }, NO_MODIFIERS);
      controller.onPointerMove({ x: 6, y: 6 }, NO_MODIFIERS);
      controller.onPointerCancel();

      expect(store.building.editedStoreyScene?.stairs[0].stair.position).toEqual(before);

      // And the gesture is over: moving the pointer again must not drag on.
      controller.onPointerMove({ x: 2, y: 2 }, NO_MODIFIERS);

      expect(store.building.editedStoreyScene?.stairs[0].stair.position).toEqual(before);
    });

    it('drops an editor-only selection when the building closes', () => {
      openHouse();
      placeWith('building:stair', { x: 10, y: 10 });

      controller.onPointerDown({ x: 10, y: 10 }, NO_MODIFIERS);
      controller.onPointerUp({ x: 10, y: 10 }, NO_MODIFIERS);

      expect(store.selection?.kind).toBe('stair');

      store.exitEditMode();

      // Otherwise Delete in view mode would reach into a building nobody sees.
      expect(store.selections).toHaveLength(0);
    });
  });

  describe('floor slabs', () => {
    /** A 16 × 16 house with a second storey open and one slab laid on it. */
    const openUpperStorey = (): void => {
      const building = store.building.addBuilding('Дом');

      store.composition.addShapeTerm(
        building.id,
        createRectangle({ center: { x: 10, y: 10 }, width: 16, length: 16, rotationDegrees: 0 }),
        'union'
      );
      store.enterEditMode({ kind: 'building', buildingId: building.id });
      store.building.addStoreyToEditedBuilding({ copyWalls: false });
    };

    const clickSlabAt = (at: Vector2): void => {
      store.setActiveTool('building:slab');
      controller.onPointerDown(at, NO_MODIFIERS);
      controller.onPointerUp(at, NO_MODIFIERS);
    };

    const openUpperStoreyWithSlab = (): void => {
      openUpperStorey();
      clickSlabAt({ x: 10, y: 10 });
    };

    it('lays a default plate with one click, selects it and hands back the select tool', () => {
      openUpperStoreyWithSlab();

      expect(store.storeyObjects.activeStoreySlabs).toHaveLength(1);
      expect(store.selection?.kind).toBe('slab');
      // R30: the next click adjusts the plate rather than laying a second one.
      expect(store.activeTool).toBe('select');
    });

    it('draws the armed primitive out with a rubber band', () => {
      openUpperStorey();
      store.setArmedShapeTool('ellipse');
      store.setActiveTool('building:slab');
      drag({ x: 6, y: 6 }, { x: 14, y: 12 });

      const [slab] = store.storeyObjects.activeStoreySlabs;

      assert(slab.kind === 'ellipse', 'the armed primitive is what is drawn');
      expect(slab.width).toBeCloseTo(8);
      expect(slab.length).toBeCloseTo(6);
      expect(store.activeTool).toBe('select');
    });

    it('takes the storey outline from the slabs, whatever shape they are', () => {
      openUpperStorey();
      store.setArmedShapeTool('circle');
      store.setActiveTool('building:slab');
      drag({ x: 10, y: 10 }, { x: 14, y: 10 });

      const [slab] = store.storeyObjects.activeStoreySlabs;

      assert(slab.kind === 'circle', 'the circle tool draws a circle');
      expect(slab.radius).toBeCloseTo(4);
      expect(store.building.editedStoreyScene?.footprint.length).toBe(1);
    });

    it('magnetises a dragged slab to the walls of the storey below', () => {
      const building = store.building.addBuilding('Дом');

      store.composition.addShapeTerm(
        building.id,
        createRectangle({ center: { x: 10, y: 10 }, width: 16, length: 16, rotationDegrees: 0 }),
        'union'
      );
      store.enterEditMode({ kind: 'building', buildingId: building.id });
      // A room downstairs whose corner stands at (5, 5).
      store.walls.appendDraftWallPoint({ x: 5, y: 5 });
      store.walls.appendDraftWallPoint({ x: 13, y: 5 });
      store.walls.commitDraftWall();
      store.building.addStoreyToEditedBuilding({ copyWalls: false });
      clickSlabAt({ x: 10, y: 10 });

      // The plate is 6 × 4 about (10, 10), so its lower-left corner sits at
      // (7, 8). Dragged to within a grip of the corner below, it lands ON it.
      drag({ x: 10, y: 10 }, { x: 8.2, y: 7.2 });

      const [slab] = store.storeyObjects.activeStoreySlabs;

      assert(slab.kind === 'rectangle', 'the default plate is a rectangle');
      expect(slab.center.x).toBeCloseTo(8);
      expect(slab.center.y).toBeCloseTo(7);
    });

    it('leaves the slab where the pointer put it while Alt suspends the magnet', () => {
      openUpperStoreyWithSlab();
      drag({ x: 10, y: 10 }, { x: 8.2, y: 7.2 }, ALT_HELD);

      const [slab] = store.storeyObjects.activeStoreySlabs;

      expect(slab.center).toEqual({ x: 8.2, y: 7.2 });
    });

    it('picks the slab under the pointer only where nothing else answers', () => {
      openUpperStoreyWithSlab();
      store.setSelection(undefined);

      controller.onPointerDown({ x: 11, y: 10 }, NO_MODIFIERS);
      controller.onPointerUp({ x: 11, y: 10 }, NO_MODIFIERS);

      expect(store.selection?.kind).toBe('slab');

      // Off the plate — 6 × 4 about (10, 10) — nothing is selected.
      controller.onPointerDown({ x: 10, y: 18 }, NO_MODIFIERS);
      controller.onPointerUp({ x: 10, y: 18 }, NO_MODIFIERS);

      expect(store.selection).toBeUndefined();
    });

    it('drags the slab by its body', () => {
      openUpperStoreyWithSlab();
      drag({ x: 10, y: 10 }, { x: 13, y: 10 });

      expect(store.storeyObjects.activeStoreySlabs[0].center).toEqual({ x: 13, y: 10 });
    });

    it('resizes the slab by an edge grip, holding the opposite edge', () => {
      openUpperStoreyWithSlab();

      // The east edge grip of a 6 × 4 plate centred on (10, 10), dragged out.
      drag({ x: 13, y: 10 }, { x: 15, y: 10 });

      const [slab] = store.storeyObjects.activeStoreySlabs;

      assert(slab.kind === 'rectangle', 'the default plate is a rectangle');
      expect(slab.width).toBeCloseTo(8);
      expect(slab.length).toBeCloseTo(4);
      expect(slab.center.x).toBeCloseTo(11);
    });

    it('puts a cancelled resize back the size it was', () => {
      openUpperStoreyWithSlab();

      const before = store.storeyObjects.activeStoreySlabs[0];

      controller.onPointerDown({ x: 13, y: 10 }, NO_MODIFIERS);
      controller.onPointerMove({ x: 18, y: 10 }, NO_MODIFIERS);
      controller.onPointerCancel();

      expect(store.storeyObjects.activeStoreySlabs[0]).toEqual(before);
    });

    it('deletes the selected slab with the keyboard', () => {
      openUpperStoreyWithSlab();
      controller.onKeyDown('Delete', NO_MODIFIERS);

      expect(store.storeyObjects.activeStoreySlabs).toHaveLength(0);
    });
  });

  describe('regression: selecting things in the building editor', () => {
    const openHouse = (): void => {
      const building = store.building.addBuilding('Дом');

      store.composition.addShapeTerm(
        building.id,
        createRectangle({ center: { x: 10, y: 10 }, width: 16, length: 16, rotationDegrees: 0 }),
        'union'
      );
      store.enterEditMode({ kind: 'building', buildingId: building.id });
    };

    it('selects a piece of furniture by clicking it', () => {
      openHouse();
      store.setActiveTool('building:furniture');
      controller.onPointerDown({ x: 10, y: 10 }, NO_MODIFIERS);
      controller.onPointerUp({ x: 10, y: 10 }, NO_MODIFIERS);
      store.setActiveTool('select');

      controller.onPointerDown({ x: 10, y: 10 }, NO_MODIFIERS);
      controller.onPointerUp({ x: 10, y: 10 }, NO_MODIFIERS);

      expect(store.selection?.kind).toBe('furniture');
    });
  });

  describe('wall junctions: the coincidence topology', () => {
    const drawWallBetween = (from: Vector2, to: Vector2): void => {
      controller.onKeyDown('w', NO_MODIFIERS);
      controller.onPointerDown(from, NO_MODIFIERS);
      controller.onPointerDown(to, NO_MODIFIERS);
      controller.onKeyDown('Enter', NO_MODIFIERS);
    };

    const groundWalls = () => storeysOf(store.buildings[0])[0].walls;

    const hasVertexAt = (points: readonly Vector2[], x: number, y: number) =>
      points.some(point => Math.abs(point.x - x) < 0.01 && Math.abs(point.y - y) < 0.01);

    /** A cross of two walls meeting at (10, 10), the across one selected. */
    const openWithCross = (): void => {
      store.enterEditMode({ kind: 'site' });

      const building = store.building.addBuilding('Дом');

      store.composition.addShapeTerm(
        building.id,
        createRectangle({ center: { x: 10, y: 10 }, width: 12, length: 12, rotationDegrees: 0 }),
        'union'
      );
      store.exitEditMode();
      store.enterEditMode({ kind: 'building', buildingId: building.id });
      drawWallBetween({ x: 6, y: 10 }, { x: 14, y: 10 });
      drawWallBetween({ x: 10, y: 6 }, { x: 10, y: 14 });
      controller.onKeyDown('v', NO_MODIFIERS);
      controller.onPointerDown({ x: 8, y: 10 }, NO_MODIFIERS);
      controller.onPointerUp({ x: 8, y: 10 }, NO_MODIFIERS);
    };

    const aimAtJunction = (): void => {
      controller.onPointerDown({ x: 10, y: 10 }, NO_MODIFIERS);
      controller.onPointerUp({ x: 10, y: 10 }, NO_MODIFIERS);
    };

    it('plants the crossing vertex in BOTH walls the moment the second one lands', () => {
      openWithCross();

      const [across, up] = groundWalls();

      expect(hasVertexAt(across.points, 10, 10)).toBe(true);
      expect(hasVertexAt(up.points, 10, 10)).toBe(true);
    });

    it('drags the junction as one: every wall through it follows', () => {
      openWithCross();

      drag({ x: 10, y: 10 }, { x: 11, y: 11 });

      for (const wall of groundWalls()) {
        expect(hasVertexAt(wall.points, 11, 11)).toBe(true);
        expect(hasVertexAt(wall.points, 10, 10)).toBe(false);
      }
    });

    it('aims the break UI with a plain click on the vertex: edges numbered', () => {
      openWithCross();
      aimAtJunction();

      expect(store.walls.selectedJunction).toBeDefined();
      expect(store.walls.selectedJunctionEdges).toHaveLength(4);
    });

    it('removes the numbered edge on its digit', () => {
      openWithCross();
      aimAtJunction();

      expect(controller.onKeyDown('1', NO_MODIFIERS)).toBe(true);

      // Edge 1 was the across wall's western run: no wall reaches (6, 10) now.
      expect(groundWalls().some(wall => hasVertexAt(wall.points, 6, 10))).toBe(false);
    });

    it('cuts the selected wall in two at the junction on S', () => {
      openWithCross();
      aimAtJunction();

      expect(controller.onKeyDown('s', NO_MODIFIERS)).toBe(true);
      expect(groundWalls()).toHaveLength(3);
    });

    it('tears an edge off the junction with D + digit and plants it where the click lands', () => {
      openWithCross();
      aimAtJunction();

      expect(controller.onKeyDown('d', NO_MODIFIERS)).toBe(true);
      expect(controller.onKeyDown('1', NO_MODIFIERS)).toBe(true);

      controller.onPointerMove({ x: 7, y: 12 }, NO_MODIFIERS);
      controller.onPointerDown({ x: 7, y: 12 }, NO_MODIFIERS);

      const [across, up] = groundWalls();

      // The across wall's end left the junction; the upright kept its vertex.
      expect(hasVertexAt(across.points, 7, 12)).toBe(true);
      expect(hasVertexAt(up.points, 10, 10)).toBe(true);
    });

    it('keeps s and d armed as tools while no junction is selected', () => {
      openWithCross();

      expect(controller.onKeyDown('s', NO_MODIFIERS)).toBe(true);
      expect(store.activeTool).toBe('building:stair');
    });
  });
});
