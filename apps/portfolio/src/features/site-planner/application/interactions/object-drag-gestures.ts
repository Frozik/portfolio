import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';

import { bearingDegreesTowards } from '../../domain/geometry/transform-shape';
import { normalizeTurnDegrees } from '../../domain/units';
import type { PlanModifiers } from '../../domain/view/plan-input';
import { rotationStepDegrees, snapLength } from '../../domain/view/snapping';
import type { InteractionContext } from './editor-interaction';
import { offsetBetween } from './grid-snapping';

/**
 * One object taken hold of on the plan — a sofa, a stair, a post, a fireplace,
 * a shaft, a socket, a door.
 *
 * Everything these seven have in common is the GESTURE: press, drag, release,
 * with the state as it was when the press happened so that every move
 * recomputes from that origin rather than accumulating through the snapped
 * intermediates, and one step to undo announced before anything moves.
 * Everything they do not have in common — a door slides along its wall, a sofa
 * magnetises to one, a stair turns and a shaft does not — lives in these three
 * closures, next to the object that owns the difference.
 */
export interface DraggedObject {
  /** Where the object stood when the drag began; a turn is measured about it. */
  readonly origin: Vector2;
  /** Puts the object at the dragged place. Snapping is the object's own habit. */
  readonly moveTo: (draggedPoint: Vector2, modifiers: PlanModifiers) => void;
  /** Turns it; absent for what has no facing — a post, a shaft, a slab. */
  readonly turnTo?: (rotationDegrees: number) => void;
  /**
   * The facing at the grab — the datum a turn is measured FROM. Setting the
   * rotation to the grip's absolute bearing instead once made every grabbed
   * piece jump into line with the pointer before the drag even moved.
   */
  readonly startRotationDegrees?: number;
  /** Puts it back exactly where it was — what a cancelled gesture owes. */
  readonly restore: () => void;
}

type DragKind = 'move' | 'rotate';

interface ActiveDrag {
  readonly object: DraggedObject;
  readonly kind: DragKind;
  /** From the pointer to the object's origin, so the grab point stays under it. */
  readonly grabOffset: Vector2;
  /** Where the pointer stood on the dial at the grab; turns are deltas from it. */
  readonly grabBearingDegrees: number;
}

/**
 * The press-drag-release of every placed object in the building editor. One
 * implementation for all of them: before this each kind carried its own
 * `XDrag` struct and its own four branches in the pointer lifecycle — the same
 * twenty lines seven times over, which is how a kind ends up forgetting to be
 * cancelled or to announce its undo step.
 */
export class ObjectDragGestures {
  private readonly context: InteractionContext;
  private drag: ActiveDrag | undefined = undefined;

  constructor(context: InteractionContext) {
    this.context = context;
  }

  hasActive(): boolean {
    return !isNil(this.drag);
  }

  /**
   * Takes hold of the object's body. The step is announced here, before
   * anything moves: everything until the pointer comes up is one undo, and an
   * announcement no move follows simply expires.
   */
  beginMove(object: DraggedObject, planPoint: Vector2): boolean {
    this.context.store.pushHistory();
    this.drag = {
      object,
      kind: 'move',
      grabOffset: offsetBetween(planPoint, object.origin),
      grabBearingDegrees: 0,
    };

    return true;
  }

  /** Takes hold of the turn grip; the object stays put and only its facing moves. */
  beginRotate(object: DraggedObject, planPoint: Vector2): boolean {
    if (isNil(object.turnTo)) {
      return false;
    }

    this.context.store.pushHistory();
    this.drag = {
      object,
      kind: 'rotate',
      grabOffset: { x: 0, y: 0 },
      grabBearingDegrees: bearingDegreesTowards(object.origin, planPoint),
    };

    return true;
  }

  move(planPoint: Vector2, modifiers: PlanModifiers): boolean {
    const drag = this.drag;

    if (isNil(drag)) {
      return false;
    }

    this.apply(drag, planPoint, modifiers);

    return true;
  }

  release(planPoint: Vector2, modifiers: PlanModifiers): boolean {
    const drag = this.drag;

    if (isNil(drag)) {
      return false;
    }

    this.drag = undefined;

    if (this.context.hasPointerMoved()) {
      this.apply(drag, planPoint, modifiers);
    }

    return true;
  }

  /** A cancelled gesture puts the object back; one that never moved owes nothing. */
  cancel(): void {
    const drag = this.drag;

    this.drag = undefined;

    if (!isNil(drag) && this.context.hasPointerMoved()) {
      drag.object.restore();
    }
  }

  private apply(drag: ActiveDrag, planPoint: Vector2, modifiers: PlanModifiers): void {
    if (drag.kind === 'rotate') {
      // The turn is the DELTA the pointer has swept since the grab, snapped,
      // added onto the facing the piece was grabbed with — so taking hold of
      // the grip never moves anything, wherever on the dial it happens to be.
      const sweptDegrees = normalizeTurnDegrees(
        bearingDegreesTowards(drag.object.origin, planPoint) - drag.grabBearingDegrees
      );

      drag.object.turnTo?.(
        normalizeTurnDegrees(
          (drag.object.startRotationDegrees ?? 0) +
            snapLength(sweptDegrees, rotationStepDegrees(modifiers))
        )
      );

      return;
    }

    drag.object.moveTo(
      { x: planPoint.x + drag.grabOffset.x, y: planPoint.y + drag.grabOffset.y },
      modifiers
    );
  }
}
