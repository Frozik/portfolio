import { assertNever } from '@frozik/utils/assert/assertNever';
import type { Vector2 } from '@frozik/utils/math/vector2';
import { isEqual, isNil } from 'lodash-es';

import {
  anchorPlanPosition,
  magnetizeAnchor,
  rotateRectangleAroundAnchor,
  setAnchorPlanPosition,
} from '../../domain/geometry/shape-anchor';
import { getShapeKeyPoints } from '../../domain/geometry/shape-key-points';
import type { RectangleHandleFactors } from '../../domain/geometry/transform-shape';
import {
  fitRectangleToDiagonal,
  MIN_SHAPE_EXTENT_METERS,
  moveShape,
  resizeRectangle,
  rotationDegreesTowards,
  setCircleRadius,
} from '../../domain/geometry/transform-shape';
import type { ShapeOwner } from '../../domain/model/selection';
import type { CircleShape, RectangleShape, Shape, ShapeId } from '../../domain/model/shapes';
import { createCircle, createRectangle, shapesExcept } from '../../domain/model/shapes';
import type { ElevationMark } from '../../domain/model/site-plan';
import type { ShapeHandle } from '../../domain/plan-draw/draw-selection';
import { computeShapeHandles, rectangleHandleFactors } from '../../domain/plan-draw/draw-selection';
import type { Meters } from '../../domain/units';
import { normalizeTurnDegrees } from '../../domain/units';
import type { KeyPointSnap } from '../../domain/view/object-snapping';
import { findKeyPointSnap } from '../../domain/view/object-snapping';
import type { PlanModifiers } from '../../domain/view/plan-input';
import { planToScreen } from '../../domain/view/plan-viewport';
import { rotationStepDegrees, snapLength } from '../../domain/view/snapping';
import type { EditorInteraction, InteractionContext } from './editor-interaction';
import { offsetBetween, snapPointToGrid, snapRadiusToGrid } from './grid-snapping';
import { findHandleAt, pickMark, pickShape } from './plan-picking';

/**
 * How near a key point of another shape has to come before a Shift-held gesture
 * is caught by it. Read in pixels rather than metres so the catch feels the same
 * at every zoom, the way every other grab radius on the plan does.
 */
const KEY_POINT_SNAP_RADIUS_PX = 10;
/**
 * A drawing gesture smaller than this puts nothing on the plan. It sits above
 * {@link MIN_SHAPE_EXTENT_METERS} on purpose: a stray click snaps down to that
 * floor, and only a deliberate drag clears this bar.
 */
const MIN_DRAWN_EXTENT_METERS: Meters = 0.2;
/** Shift multiplies the arrow-key nudge, as it does the rotation step. */
const COARSE_NUDGE_FACTOR = 10;
/** History group of the arrow-key nudge; the shape's id is appended to it. */
const NUDGE_HISTORY_GROUP = 'nudge';
/** Grab radius of the anchor mark, generous around the drawn ring. */
const ANCHOR_PICK_RADIUS_PX = 12;
/** How near a shape's own special point pulls the dragged anchor in. */
const ANCHOR_MAGNET_RADIUS_PX = 10;

const ARROW_STEPS: Readonly<Record<string, Vector2 | undefined>> = {
  ArrowUp: { x: 0, y: 1 },
  ArrowDown: { x: 0, y: -1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
};

/**
 * What the pointer is doing between press and release. Each variant carries the
 * shape as it was when the gesture began, so every move recomputes from that
 * origin instead of accumulating rounding through the snapped intermediates.
 */
type PlanGesture =
  | {
      readonly kind: 'move';
      readonly owner: ShapeOwner;
      readonly startShape: Shape;
      readonly grabOffset: Vector2;
    }
  | {
      readonly kind: 'resize';
      readonly owner: ShapeOwner;
      readonly startShape: RectangleShape;
      readonly factors: RectangleHandleFactors;
    }
  | {
      readonly kind: 'rotate';
      readonly owner: ShapeOwner;
      readonly startShape: RectangleShape;
      /**
       * The pointer's bearing around the anchor at the moment of the grab. The
       * gesture applies the DELTA from it — an absolute reading would snap the
       * shape to wherever the handle happens to lie the instant it is taken,
       * a ~90° jump whenever the anchor is off the centre.
       */
      readonly grabRotationDegrees: number;
    }
  | { readonly kind: 'anchor'; readonly owner: ShapeOwner; readonly startShape: Shape }
  | { readonly kind: 'resize-radius'; readonly owner: ShapeOwner; readonly startShape: CircleShape }
  | {
      readonly kind: 'draw-rectangle';
      readonly owner: ShapeOwner;
      /** The group the shape joins, captured when the gesture began. */
      readonly groupId: ShapeId | undefined;
      readonly startShape: RectangleShape;
      readonly anchor: Vector2;
    }
  | {
      readonly kind: 'draw-circle';
      readonly owner: ShapeOwner;
      readonly groupId: ShapeId | undefined;
      readonly startShape: CircleShape;
      readonly anchor: Vector2;
    };

type MoveGesture = Extract<PlanGesture, { readonly kind: 'move' }>;
/** The two rubber-band gestures; both are steered from an anchor laid down first. */
type DrawGesture = Extract<PlanGesture, { readonly anchor: Vector2 }>;

/**
 * Sliding an elevation mark. It stays outside {@link PlanGesture}, which speaks
 * in shapes; the mark does need a draft — the terrain is rebuilt from the
 * marks, so the plan may only learn about the new position once the pointer
 * comes up.
 */
interface MarkDrag {
  readonly startMark: ElevationMark;
  readonly grabOffset: Vector2;
}

/**
 * Site editing's canvas behaviour: the CSG shapes with their handles and
 * anchors, the drawing tools and the elevation marks. The first
 * `EditorInteraction` extracted from the shell — the exemplar for the future
 * building editor's interaction.
 */
export class SiteEditInteraction implements EditorInteraction {
  private readonly context: InteractionContext;
  private gesture: PlanGesture | undefined = undefined;
  private markDrag: MarkDrag | undefined = undefined;

  constructor(context: InteractionContext) {
    this.context = context;
  }

  onPointerDown(planPoint: Vector2, modifiers: PlanModifiers): boolean {
    const tool = this.context.store.activeTool;

    switch (tool) {
      case 'select':
        this.beginSelectGesture(planPoint, modifiers);

        return true;
      case 'rectangle':
      case 'circle':
        this.beginDrawGesture(tool, planPoint, modifiers);

        return true;
      case 'elevation':
        this.beginElevationGesture(planPoint, modifiers);

        return true;
      default:
        return false;
    }
  }

  onPointerMove(planPoint: Vector2, modifiers: PlanModifiers): boolean {
    if (!isNil(this.markDrag)) {
      this.context.store.setDraftMark(this.dragMarkTo(this.markDrag, planPoint, modifiers));

      return true;
    }

    const gesture = this.gesture;

    if (isNil(gesture)) {
      return false;
    }

    this.context.store.setDraftShape(this.applyGesture(gesture, planPoint, modifiers));

    return true;
  }

  onPointerUp(planPoint: Vector2, modifiers: PlanModifiers): boolean {
    const { store } = this.context;
    const markDrag = this.markDrag;

    if (!isNil(markDrag)) {
      const movedMark = this.dragMarkTo(markDrag, planPoint, modifiers);

      this.markDrag = undefined;
      store.setDraftMark(undefined);

      // A click that only selected the mark leaves it exactly where it was;
      // writing the same position back would rebuild the terrain for nothing.
      if (
        this.context.hasPointerMoved() &&
        !isEqual(movedMark.position, markDrag.startMark.position)
      ) {
        store.moveElevationMark(movedMark.id, movedMark.position);
      }

      return true;
    }

    const gesture = this.gesture;

    if (isNil(gesture)) {
      return false;
    }

    this.gesture = undefined;
    store.setDraftShape(undefined);

    if (!this.context.hasPointerMoved()) {
      return true;
    }

    const shape = this.applyGesture(gesture, planPoint, modifiers);

    store.setActiveKeyPointSnap(undefined);

    switch (gesture.kind) {
      case 'move':
      case 'resize':
      case 'rotate':
      case 'resize-radius':
      case 'anchor':
        // A plain click is a press and a release with nothing in between: writing
        // the unchanged shape back would re-run the boolean fold for nothing.
        if (!isEqual(shape, gesture.startShape)) {
          store.updateShape(gesture.owner, shape);
        }

        return true;
      case 'draw-rectangle':
      case 'draw-circle':
        this.commitDrawnShape(gesture, shape);

        return true;
      default:
        return assertNever(gesture);
    }
  }

  onPointerCancel(): void {
    this.gesture = undefined;
    this.markDrag = undefined;
    this.context.store.setDraftShape(undefined);
    this.context.store.setDraftMark(undefined);
    this.context.store.setActiveKeyPointSnap(undefined);
  }

  /** Emptiness — nothing pickable under the double click — closes the editor. */
  onDoubleClick(planPoint: Vector2, _modifiers: PlanModifiers): void {
    const { store, getViewport } = this.context;
    const viewport = getViewport();

    if (
      isNil(pickShape(store, viewport, planPoint)) &&
      isNil(pickMark(store, viewport, planPoint))
    ) {
      store.exitEditMode();
    }
  }

  onKeyDown(key: string, modifiers: PlanModifiers): boolean {
    const arrowStep = ARROW_STEPS[key];

    return isNil(arrowStep) ? false : this.nudgeSelection(arrowStep, modifiers);
  }

  onEscapeStep(): boolean {
    return false;
  }

  hasTransientInteraction(): boolean {
    return (
      !isNil(this.gesture) ||
      !isNil(this.markDrag) ||
      !isNil(this.context.store.elevationInputMarkId)
    );
  }

  cancelTransients(): void {
    this.onPointerCancel();
    this.context.store.closeElevationInput();
  }

  /**
   * What the select tool takes hold of, nearest grip first: the selected
   * shape's anchor under Shift, then its handles, then a mark, then whichever
   * shape lies under the pointer — moved by its body.
   */
  private beginSelectGesture(planPoint: Vector2, modifiers: PlanModifiers): void {
    if (
      this.beginAnchorGesture(planPoint, modifiers) ||
      this.beginHandleGesture(planPoint) ||
      this.beginMarkDrag(planPoint)
    ) {
      return;
    }

    const { store, getViewport } = this.context;
    const picked = pickShape(store, getViewport(), planPoint);

    if (isNil(picked)) {
      store.setSelection(undefined);

      return;
    }

    store.setSelection({ kind: 'shape', owner: picked.owner, shapeId: picked.shape.id });
    this.startGesture({
      kind: 'move',
      owner: picked.owner,
      startShape: picked.shape,
      grabOffset: offsetBetween(planPoint, picked.shape.center),
    });
  }

  /**
   * Shift over the anchor mark takes hold of the anchor itself (see modes.md):
   * the shape stays put while its point of reference is dragged, magnetised to
   * the shape's own corners, side middles and centre — Alt lets it go free.
   */
  private beginAnchorGesture(planPoint: Vector2, modifiers: PlanModifiers): boolean {
    const { store, getViewport } = this.context;
    const { selection } = store;
    const shape = store.selectedShape;

    if (
      !modifiers.isShiftPressed ||
      isNil(shape) ||
      isNil(selection) ||
      selection.kind !== 'shape'
    ) {
      return false;
    }

    const viewport = getViewport();
    const anchorScreen = planToScreen(viewport, anchorPlanPosition(shape));
    const pointerScreen = planToScreen(viewport, planPoint);

    if (
      Math.hypot(anchorScreen.x - pointerScreen.x, anchorScreen.y - pointerScreen.y) >
      ANCHOR_PICK_RADIUS_PX
    ) {
      return false;
    }

    this.startGesture({ kind: 'anchor', owner: selection.owner, startShape: shape });

    return true;
  }

  /** The manipulators of the current selection win over whatever lies beneath them. */
  private beginHandleGesture(planPoint: Vector2): boolean {
    const { store, getViewport } = this.context;
    const { selection } = store;
    const shape = store.selectedShape;

    if (isNil(shape) || isNil(selection) || selection.kind !== 'shape') {
      return false;
    }

    const viewport = getViewport();
    const handle = findHandleAt(
      computeShapeHandles(shape, viewport),
      planToScreen(viewport, planPoint)
    );

    if (isNil(handle)) {
      return false;
    }

    const gesture = toHandleGesture(handle, shape, selection.owner, planPoint);

    if (isNil(gesture)) {
      return false;
    }

    this.startGesture(gesture);

    return true;
  }

  private beginDrawGesture(
    tool: 'rectangle' | 'circle',
    planPoint: Vector2,
    modifiers: PlanModifiers
  ): void {
    const { store } = this.context;
    const { owner, groupId } = store.resolvedActiveGroup;
    const anchor = snapPointToGrid(store, planPoint, modifiers);

    store.setSelection(undefined);
    this.startGesture(
      tool === 'rectangle'
        ? {
            kind: 'draw-rectangle',
            owner,
            groupId,
            anchor,
            startShape: createRectangle({
              center: anchor,
              width: 0,
              length: 0,
              rotationDegrees: 0,
            }),
          }
        : {
            kind: 'draw-circle',
            owner,
            groupId,
            anchor,
            startShape: createCircle({ center: anchor, radius: 0 }),
          }
    );
  }

  /**
   * With the elevation tool in hand, a click on empty ground surveys a new point
   * and a click on a flag picks it up — the same button both places and adjusts,
   * so a mis-clicked mark needs no tool change to fix.
   */
  private beginElevationGesture(planPoint: Vector2, modifiers: PlanModifiers): void {
    if (this.beginMarkDrag(planPoint)) {
      return;
    }

    const { store } = this.context;

    store.addElevationMark(snapPointToGrid(store, planPoint, modifiers));
  }

  /** Takes hold of the mark under the pointer, if any, and selects it. */
  private beginMarkDrag(planPoint: Vector2): boolean {
    const { store, getViewport } = this.context;
    const mark = pickMark(store, getViewport(), planPoint);

    if (isNil(mark)) {
      return false;
    }

    store.setSelection({ kind: 'mark', markId: mark.id });
    store.closeElevationInput();
    // Recorded before the drag takes hold: everything until the pointer comes
    // up is one step, and an announcement no move follows simply expires.
    store.pushHistory();
    this.markDrag = { startMark: mark, grabOffset: offsetBetween(planPoint, mark.position) };
    store.setDraftMark(mark);

    return true;
  }

  private dragMarkTo(drag: MarkDrag, planPoint: Vector2, modifiers: PlanModifiers): ElevationMark {
    return {
      ...drag.startMark,
      position: snapPointToGrid(
        this.context.store,
        { x: planPoint.x + drag.grabOffset.x, y: planPoint.y + drag.grabOffset.y },
        modifiers
      ),
    };
  }

  /**
   * The plan is recorded here, before the gesture takes hold of anything: what
   * follows until the pointer comes up is one step to undo, however many moves
   * the pointer reports in between.
   */
  private startGesture(gesture: PlanGesture): void {
    this.context.store.pushHistory();
    this.gesture = gesture;
    this.context.store.setDraftShape(gesture.startShape);
  }

  private applyGesture(gesture: PlanGesture, planPoint: Vector2, modifiers: PlanModifiers): Shape {
    const { store } = this.context;

    switch (gesture.kind) {
      case 'move':
        return this.applyMove(gesture, planPoint, modifiers);
      case 'resize':
        return resizeRectangle(
          gesture.startShape,
          gesture.factors,
          snapPointToGrid(store, planPoint, modifiers)
        );
      case 'rotate':
        return rotateRectangleAroundAnchor(
          gesture.startShape,
          normalizeTurnDegrees(
            snapLength(
              gesture.startShape.rotationDegrees +
                rotationDegreesTowards(anchorPlanPosition(gesture.startShape), planPoint) -
                gesture.grabRotationDegrees,
              rotationStepDegrees(modifiers)
            )
          )
        );
      case 'anchor':
        return setAnchorPlanPosition(
          gesture.startShape,
          modifiers.isAltPressed
            ? planPoint
            : magnetizeAnchor(
                gesture.startShape,
                planPoint,
                ANCHOR_MAGNET_RADIUS_PX / this.context.getViewport().pixelsPerMeter
              )
        );
      case 'resize-radius':
        return setCircleRadius(
          gesture.startShape,
          Math.max(
            snapRadiusToGrid(store, gesture.startShape.center, planPoint, modifiers),
            MIN_SHAPE_EXTENT_METERS
          )
        );
      case 'draw-rectangle': {
        const anchor = this.resolveDrawAnchor(gesture, modifiers);

        return fitRectangleToDiagonal(
          gesture.startShape,
          anchor,
          snapPointToGrid(store, planPoint, modifiers)
        );
      }
      case 'draw-circle': {
        const anchor = this.resolveDrawAnchor(gesture, modifiers);

        return setCircleRadius(
          { ...gesture.startShape, center: anchor },
          snapRadiusToGrid(store, anchor, planPoint, modifiers)
        );
      }
      default:
        return assertNever(gesture);
    }
  }

  /**
   * Dragging a shape by its body. An object snap wins over the grid: laying a
   * corner on a neighbour's corner is a stronger statement than laying it on the
   * grid, and the two would otherwise fight over the last few centimetres.
   */
  private applyMove(gesture: MoveGesture, planPoint: Vector2, modifiers: PlanModifiers): Shape {
    const { store } = this.context;
    const draggedCenter: Vector2 = {
      x: planPoint.x + gesture.grabOffset.x,
      y: planPoint.y + gesture.grabOffset.y,
    };
    const draggedShape = moveShape(gesture.startShape, draggedCenter);
    const snap = this.resolveKeyPointSnap(
      getShapeKeyPoints(draggedShape),
      draggedShape.id,
      modifiers
    );

    store.setActiveKeyPointSnap(snap);

    return isNil(snap)
      ? moveShape(gesture.startShape, snapPointToGrid(store, draggedCenter, modifiers))
      : moveShape(gesture.startShape, {
          x: draggedCenter.x + snap.delta.x,
          y: draggedCenter.y + snap.delta.y,
        });
  }

  /**
   * Where a rubber-band gesture is pinned: the corner a rectangle grows from,
   * the centre a circle grows around. It is snapped to the grid when the pointer
   * goes down and re-examined on every move, so Shift pressed mid-drag still
   * catches the anchor on a key point of another shape.
   */
  private resolveDrawAnchor(gesture: DrawGesture, modifiers: PlanModifiers): Vector2 {
    const snap = this.resolveKeyPointSnap([gesture.anchor], gesture.startShape.id, modifiers);

    this.context.store.setActiveKeyPointSnap(snap);

    return isNil(snap) ? gesture.anchor : snap.targetPoint;
  }

  /**
   * The key point of another shape this gesture is caught by, while Shift asks
   * for one. Alt suspends it along with grid snapping, so one key still clears
   * every constraint the editor puts on a drag.
   */
  private resolveKeyPointSnap(
    ownPoints: readonly Vector2[],
    ownShapeId: ShapeId,
    modifiers: PlanModifiers
  ): KeyPointSnap | undefined {
    if (!modifiers.isShiftPressed || modifiers.isAltPressed) {
      return undefined;
    }

    const targetPoints = shapesExcept(this.context.store.allShapes, ownShapeId).flatMap(
      getShapeKeyPoints
    );

    return findKeyPointSnap(
      ownPoints,
      targetPoints,
      KEY_POINT_SNAP_RADIUS_PX / this.context.getViewport().pixelsPerMeter
    );
  }

  /**
   * A drawn shape is sized by eye, so the panel is handed the keyboard with it:
   * the drag gives the rough rectangle, and the exact width — or radius — is one
   * typed number away, with no trip to the mouse in between (R20).
   */
  private commitDrawnShape(gesture: DrawGesture, shape: Shape): void {
    if (!isLargeEnoughToKeep(shape)) {
      return;
    }

    const { store } = this.context;
    const { owner, groupId } = gesture;

    store.addShapeTerm(owner, shape, 'union', groupId);
    store.setSelection({ kind: 'shape', owner, shapeId: shape.id });
    store.requestPropertiesFocus();
  }

  private nudgeSelection(direction: Vector2, modifiers: PlanModifiers): boolean {
    const { store } = this.context;
    const shape = store.selectedShape;

    if (isNil(shape)) {
      return false;
    }

    const step =
      store.settings.gridStepMeters * (modifiers.isShiftPressed ? COARSE_NUDGE_FACTOR : 1);

    // Held arrow keys repeat; grouping them keeps a slide across the plot one step.
    store.pushHistory(`${NUDGE_HISTORY_GROUP}:${shape.id}`);
    store.updateSelectedShape(
      moveShape(shape, {
        x: shape.center.x + direction.x * step,
        y: shape.center.y + direction.y * step,
      })
    );

    return true;
  }
}

function toHandleGesture(
  handle: ShapeHandle,
  shape: Shape,
  owner: ShapeOwner,
  planPoint: Vector2
): PlanGesture | undefined {
  if (handle.kind === 'center') {
    return {
      kind: 'move',
      owner,
      startShape: shape,
      grabOffset: offsetBetween(planPoint, shape.center),
    };
  }

  if (handle.kind === 'radius') {
    return shape.kind === 'circle'
      ? { kind: 'resize-radius', owner, startShape: shape }
      : undefined;
  }

  if (shape.kind !== 'rectangle') {
    return undefined;
  }

  if (handle.kind === 'rotate') {
    return {
      kind: 'rotate',
      owner,
      startShape: shape,
      grabRotationDegrees: rotationDegreesTowards(anchorPlanPosition(shape), planPoint),
    };
  }

  const factors = rectangleHandleFactors(handle.kind);

  return isNil(factors) ? undefined : { kind: 'resize', owner, startShape: shape, factors };
}

function isLargeEnoughToKeep(shape: Shape): boolean {
  switch (shape.kind) {
    case 'rectangle':
      return shape.width >= MIN_DRAWN_EXTENT_METERS && shape.length >= MIN_DRAWN_EXTENT_METERS;
    case 'circle':
      return shape.radius >= MIN_DRAWN_EXTENT_METERS;
    default:
      return assertNever(shape);
  }
}
