import type { Vector2 } from '@frozik/utils/math/vector2';
import { isEqual, isNil } from 'lodash-es';

import { getShapeKeyPoints } from '../../domain/geometry/shape-key-points';
import { moveShape } from '../../domain/geometry/transform-shape';
import type { ShapeOwner, ShapeTool } from '../../domain/model/selection';
import type { Shape, ShapeId } from '../../domain/model/shapes';
import { shapesExcept } from '../../domain/model/shapes';
import type { ElevationMark } from '../../domain/model/site-plan';
import type { PlanModifiers } from '../../domain/view/plan-input';
import type { EditorInteraction, InteractionContext } from './editor-interaction';
import { offsetBetween, snapPointToGrid } from './grid-snapping';
import { pickMark, pickShape } from './plan-picking';
import { ShapeGestures } from './shape-gestures';

/** Shift multiplies the arrow-key nudge, as it does the rotation step. */
const COARSE_NUDGE_FACTOR = 10;
/** History group of the arrow-key nudge; the shape's id is appended to it. */
const NUDGE_HISTORY_GROUP = 'nudge';

const ARROW_STEPS: Readonly<Record<string, Vector2 | undefined>> = {
  ArrowUp: { x: 0, y: 1 },
  ArrowDown: { x: 0, y: -1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
};

/**
 * Sliding an elevation mark. It stays outside {@link ShapeGestures}, which
 * speaks in shapes; the mark does need a draft — the terrain is rebuilt from the
 * marks, so the plan may only learn about the new position once the pointer
 * comes up.
 */
interface MarkDrag {
  readonly startMark: ElevationMark;
  readonly grabOffset: Vector2;
}

/** What a site shape gesture must remember to commit: the composition it edits. */
interface ShapeTarget {
  readonly owner: ShapeOwner;
  /** The group a newly drawn shape joins; nothing means the composition's root. */
  readonly groupId?: ShapeId;
}

/**
 * Site editing's canvas behaviour: the CSG shapes with their handles and
 * anchors, the drawing tools and the elevation marks. The first
 * `EditorInteraction` extracted from the shell — the exemplar for the future
 * building editor's interaction.
 */
export class SiteEditInteraction implements EditorInteraction {
  private readonly context: InteractionContext;
  private readonly shapes: ShapeGestures<ShapeTarget>;
  private markDrag: MarkDrag | undefined = undefined;

  constructor(context: InteractionContext) {
    this.context = context;
    this.shapes = new ShapeGestures(context, {
      isSnapAlwaysLive: false,
      update: (shape, { owner }) => context.store.composition.updateShape(owner, shape),
      add: (shape, { owner, groupId }) => {
        context.store.composition.addShapeTerm(owner, shape, 'union', groupId);
        context.store.setSelection({ kind: 'shape', owner, shapeId: shape.id });
        // A drawn shape is sized by eye, so the panel is handed the keyboard
        // with it: the exact width is one typed number away, with no trip to
        // the mouse in between (R20).
        context.store.requestPropertiesFocus();
        context.store.finishPlacement();
      },
      snapPoints: excludedShapeId =>
        shapesExcept(context.store.composition.allShapes, excludedShapeId).flatMap(
          getShapeKeyPoints
        ),
    });
  }

  onPointerDown(planPoint: Vector2, modifiers: PlanModifiers): boolean {
    const tool = this.context.store.activeTool;

    switch (tool) {
      case 'select':
        this.beginSelectGesture(planPoint, modifiers);

        return true;
      case 'rectangle':
      case 'circle':
      case 'ellipse':
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

    return this.shapes.move(planPoint, modifiers);
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
        store.siteObjects.moveElevationMark(movedMark.id, movedMark.position);
      }

      return true;
    }

    return this.shapes.release(planPoint, modifiers);
  }

  onPointerCancel(): void {
    this.markDrag = undefined;
    this.shapes.cancel();
    this.context.store.setDraftMark(undefined);
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
      this.shapes.hasActive() ||
      !isNil(this.markDrag) ||
      !isNil(this.context.store.siteObjects.elevationInputMarkId)
    );
  }

  cancelTransients(): void {
    this.onPointerCancel();
    this.context.store.siteObjects.closeElevationInput();
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
    this.shapes.beginMove(picked.shape, { owner: picked.owner }, planPoint);
  }

  /** The anchor of the selected shape, dragged with Shift; the shape stays put. */
  private beginAnchorGesture(planPoint: Vector2, modifiers: PlanModifiers): boolean {
    const target = this.selectedShapeTarget();

    return (
      !isNil(target) &&
      this.shapes.beginAnchor(target.shape, { owner: target.owner }, planPoint, modifiers)
    );
  }

  /** The manipulators of the current selection win over whatever lies beneath them. */
  private beginHandleGesture(planPoint: Vector2): boolean {
    const target = this.selectedShapeTarget();

    return (
      !isNil(target) && this.shapes.beginHandle(target.shape, { owner: target.owner }, planPoint)
    );
  }

  /** The selected shape together with the composition it belongs to. */
  private selectedShapeTarget(): { readonly shape: Shape; readonly owner: ShapeOwner } | undefined {
    const { store } = this.context;
    const { selection } = store;
    const shape = store.composition.selectedShape;

    return isNil(shape) || selection?.kind !== 'shape'
      ? undefined
      : { shape, owner: selection.owner };
  }

  private beginDrawGesture(tool: ShapeTool, planPoint: Vector2, modifiers: PlanModifiers): void {
    const { store } = this.context;

    store.setSelection(undefined);
    this.shapes.beginDraw(tool, store.composition.resolvedActiveGroup, planPoint, modifiers);
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

    store.siteObjects.addElevationMark(snapPointToGrid(store, planPoint, modifiers));
  }

  /** Takes hold of the mark under the pointer, if any, and selects it. */
  private beginMarkDrag(planPoint: Vector2): boolean {
    const { store, getViewport } = this.context;
    const mark = pickMark(store, getViewport(), planPoint);

    if (isNil(mark)) {
      return false;
    }

    store.setSelection({ kind: 'mark', markId: mark.id });
    store.siteObjects.closeElevationInput();
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

  private nudgeSelection(direction: Vector2, modifiers: PlanModifiers): boolean {
    const { store } = this.context;
    const shape = store.composition.selectedShape;

    if (isNil(shape)) {
      return false;
    }

    const step =
      store.settings.gridStepMeters * (modifiers.isShiftPressed ? COARSE_NUDGE_FACTOR : 1);

    // Held arrow keys repeat; grouping them keeps a slide across the plot one step.
    store.pushHistory(`${NUDGE_HISTORY_GROUP}:${shape.id}`);
    store.composition.updateSelectedShape(
      moveShape(shape, {
        x: shape.center.x + direction.x * step,
        y: shape.center.y + direction.y * step,
      })
    );

    return true;
  }
}
