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
import {
  fitBoxToDiagonal,
  MIN_SHAPE_EXTENT_METERS,
  moveShape,
  resizeBox,
  rotationDegreesTowards,
  setCircleRadius,
} from '../../domain/geometry/transform-shape';
import type { Shape, ShapeId } from '../../domain/model/shapes';
import { createEmptyShape } from '../../domain/model/shapes';
import { normalizeTurnDegrees } from '../../domain/units';
import type { KeyPointSnap } from '../../domain/view/object-snapping';
import { findKeyPointSnap, KEY_POINT_SNAP_RADIUS_PX } from '../../domain/view/object-snapping';
import type { PlanModifiers } from '../../domain/view/plan-input';
import { planToScreen } from '../../domain/view/plan-viewport';
import { rotationStepDegrees, snapLength } from '../../domain/view/snapping';
import { computeShapeHandles } from '../render/plan-draw/draw-selection';
import type { InteractionContext } from './editor-interaction';
import { offsetBetween, snapPointToGrid, snapRadiusToGrid } from './grid-snapping';
import { findHandleAt } from './plan-picking';
import type { DrawGesture, MoveGesture, ShapeGesture } from './shape-gesture-kinds';
import { isLargeEnoughToKeep, toHandleGesture } from './shape-gesture-kinds';

/** Grab radius of the anchor mark, generous around the drawn ring. */
const ANCHOR_PICK_RADIUS_PX = 12;
/** How near a shape's own special point pulls the dragged anchor in. */
const ANCHOR_MAGNET_RADIUS_PX = 10;

/**
 * Where a run of shape gestures reads its neighbours from and writes its
 * result to. One drawing surface — the site's CSG composition, a storey's
 * floor — is one sink, which is what lets both be drawn, resized, turned and
 * snapped by the very same gestures instead of by two copies of them.
 *
 * `TContext` is whatever the surface needs to know at COMMIT time and captures
 * when the gesture begins: the site names the composition and the group a new
 * shape joins, a storey needs nothing at all.
 */
export interface ShapeGestureSink<TContext> {
  /** Commits an edited shape. */
  update: (shape: Shape, context: TContext) => void;
  /** Commits a shape just drawn, and selects it. */
  add: (shape: Shape, context: TContext) => void;
  /** What a gesture may be caught by, minus the shape being edited. */
  snapPoints: (excludedShapeId: ShapeId) => readonly Vector2[];
  /**
   * Whether the object snap is live on its own. The site plan asks for Shift —
   * a plot is drawn against nothing but itself; inside a building it is always
   * live, the way OSNAP is in a CAD editor, because everything there is drawn
   * against walls that are already standing.
   */
  readonly isSnapAlwaysLive: boolean;
}

/**
 * Every gesture a rotated shape answers: drawn out with a rubber band, dragged
 * by its body, resized by an edge grip, turned by the grip past its north, and
 * — for the site's shapes — re-anchored. Extracted from the site editor so the
 * building editor's floor slabs are manipulated by the same code rather than by
 * a second implementation of the same feel.
 */
export class ShapeGestures<TContext> {
  private readonly context: InteractionContext;
  private readonly sink: ShapeGestureSink<TContext>;
  private gesture: ShapeGesture<TContext> | undefined = undefined;

  constructor(context: InteractionContext, sink: ShapeGestureSink<TContext>) {
    this.context = context;
    this.sink = sink;
  }

  hasActive(): boolean {
    return !isNil(this.gesture);
  }

  /**
   * Shift over the anchor mark takes hold of the anchor itself (see modes.md):
   * the shape stays put while its point of reference is dragged, magnetised to
   * the shape's own corners, side middles and centre — Alt lets it go free.
   */
  beginAnchor(
    shape: Shape,
    context: TContext,
    planPoint: Vector2,
    modifiers: PlanModifiers
  ): boolean {
    if (!modifiers.isShiftPressed) {
      return false;
    }

    const viewport = this.context.getViewport();
    const anchorScreen = planToScreen(viewport, anchorPlanPosition(shape));
    const pointerScreen = planToScreen(viewport, planPoint);

    if (
      Math.hypot(anchorScreen.x - pointerScreen.x, anchorScreen.y - pointerScreen.y) >
      ANCHOR_PICK_RADIUS_PX
    ) {
      return false;
    }

    this.start({ kind: 'anchor', context, startShape: shape });

    return true;
  }

  /** The manipulators of the given shape win over whatever lies beneath them. */
  beginHandle(shape: Shape, context: TContext, planPoint: Vector2): boolean {
    const viewport = this.context.getViewport();
    const handle = findHandleAt(
      computeShapeHandles(shape, viewport),
      planToScreen(viewport, planPoint)
    );
    const gesture = isNil(handle) ? undefined : toHandleGesture(handle, shape, context, planPoint);

    if (isNil(gesture)) {
      return false;
    }

    this.start(gesture);

    return true;
  }

  /** Takes hold of the shape's body. */
  beginMove(shape: Shape, context: TContext, planPoint: Vector2): void {
    this.start({
      kind: 'move',
      context,
      startShape: shape,
      grabOffset: offsetBetween(planPoint, shape.center),
    });
  }

  /** Starts the rubber band of one of the drawing tools. */
  beginDraw(
    kind: Shape['kind'],
    context: TContext,
    planPoint: Vector2,
    modifiers: PlanModifiers
  ): void {
    const anchor = snapPointToGrid(this.context.store, planPoint, modifiers);
    const startShape = createEmptyShape(kind, anchor);

    this.start(
      startShape.kind === 'circle'
        ? { kind: 'draw-circle', context, anchor, startShape }
        : { kind: 'draw-box', context, anchor, startShape }
    );
  }

  move(planPoint: Vector2, modifiers: PlanModifiers): boolean {
    const gesture = this.gesture;

    if (isNil(gesture)) {
      return false;
    }

    this.context.store.tooling.setDraftShape(this.apply(gesture, planPoint, modifiers));

    return true;
  }

  release(planPoint: Vector2, modifiers: PlanModifiers): boolean {
    const gesture = this.gesture;

    if (isNil(gesture)) {
      return false;
    }

    const { store } = this.context;

    this.gesture = undefined;
    store.tooling.setDraftShape(undefined);

    if (!this.context.hasPointerMoved()) {
      return true;
    }

    const shape = this.apply(gesture, planPoint, modifiers);

    store.tooling.setActiveKeyPointSnap(undefined);

    switch (gesture.kind) {
      case 'move':
      case 'resize':
      case 'rotate':
      case 'resize-radius':
      case 'anchor':
        // A plain click is a press and a release with nothing in between: writing
        // the unchanged shape back would re-run the boolean fold for nothing.
        if (!isEqual(shape, gesture.startShape)) {
          this.sink.update(shape, gesture.context);
        }

        return true;
      case 'draw-box':
      case 'draw-circle':
        if (isLargeEnoughToKeep(shape)) {
          this.sink.add(shape, gesture.context);
        }

        return true;
      default:
        return assertNever(gesture);
    }
  }

  cancel(): void {
    this.gesture = undefined;
    this.context.store.tooling.setDraftShape(undefined);
    this.context.store.tooling.setActiveKeyPointSnap(undefined);
  }

  /**
   * The plan is recorded here, before the gesture takes hold of anything: what
   * follows until the pointer comes up is one step to undo, however many moves
   * the pointer reports in between.
   */
  private start(gesture: ShapeGesture<TContext>): void {
    this.context.store.pushHistory();
    this.gesture = gesture;
    this.context.store.tooling.setDraftShape(gesture.startShape);
  }

  private apply(
    gesture: ShapeGesture<TContext>,
    planPoint: Vector2,
    modifiers: PlanModifiers
  ): Shape {
    const { store } = this.context;

    switch (gesture.kind) {
      case 'move':
        return this.applyMove(gesture, planPoint, modifiers);
      case 'resize':
        return resizeBox(
          gesture.startShape,
          gesture.factors,
          this.resolveCornerPoint(gesture.startShape.id, planPoint, modifiers)
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
      case 'draw-box':
        return fitBoxToDiagonal(
          gesture.startShape,
          this.resolveDrawAnchor(gesture, modifiers),
          this.resolveCornerPoint(gesture.startShape.id, planPoint, modifiers)
        );
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
  private applyMove(
    gesture: MoveGesture<TContext>,
    planPoint: Vector2,
    modifiers: PlanModifiers
  ): Shape {
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

    store.tooling.setActiveKeyPointSnap(snap);

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
   * goes down and re-examined on every move, so a modifier pressed mid-drag
   * still catches the anchor on a key point of another shape.
   */
  private resolveDrawAnchor(gesture: DrawGesture<TContext>, modifiers: PlanModifiers): Vector2 {
    const snap = this.resolveKeyPointSnap([gesture.anchor], gesture.startShape.id, modifiers);

    this.context.store.tooling.setActiveKeyPointSnap(snap);

    return isNil(snap) ? gesture.anchor : snap.targetPoint;
  }

  /**
   * The corner a resize or a rubber band is dragged to: on a key point in
   * reach, on the grid otherwise. It is what lets an edge be laid exactly on
   * the wall it should meet rather than near it.
   */
  private resolveCornerPoint(
    ownShapeId: ShapeId,
    planPoint: Vector2,
    modifiers: PlanModifiers
  ): Vector2 {
    const snap = this.resolveKeyPointSnap([planPoint], ownShapeId, modifiers);

    this.context.store.tooling.setActiveKeyPointSnap(snap);

    return isNil(snap)
      ? snapPointToGrid(this.context.store, planPoint, modifiers)
      : snap.targetPoint;
  }

  /**
   * The key point this gesture is caught by. Alt suspends it along with grid
   * snapping, so one key still clears every constraint the editor puts on a
   * drag; whether Shift is needed to ask for it at all is the sink's habit.
   */
  private resolveKeyPointSnap(
    ownPoints: readonly Vector2[],
    ownShapeId: ShapeId,
    modifiers: PlanModifiers
  ): KeyPointSnap | undefined {
    if (modifiers.isAltPressed || !(this.sink.isSnapAlwaysLive || modifiers.isShiftPressed)) {
      return undefined;
    }

    return findKeyPointSnap(
      ownPoints,
      this.sink.snapPoints(ownShapeId),
      KEY_POINT_SNAP_RADIUS_PX / this.context.getViewport().pixelsPerMeter
    );
  }
}
