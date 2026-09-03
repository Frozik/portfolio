import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';
import { MIN_PATH_POINTS } from '../../domain/model/site-object-edits';
import type { PathId } from '../../domain/model/site-plan';
import type { PlanModifiers } from '../../domain/view/plan-input';
import { planToScreen } from '../../domain/view/plan-viewport';
import { computePathPointHandles, findPathPointHandleAt } from '../render/plan-draw/draw-paths';
import type { EditorInteraction, InteractionContext } from './editor-interaction';
import { DELETE_KEYS } from './editor-interaction';
import { applyPathHandleHover, PathPointGestures } from './path-point-gestures';
import { HANDLE_HIT_RADIUS_PX } from './plan-picking';

/**
 * Path editing's canvas behaviour: the full point kit on the one opened path —
 * squares drag points, midpoint rings plant new ones, a double click removes
 * one, Delete takes the selected point (never the path out from under the
 * editor).
 */
export class PathEditInteraction implements EditorInteraction {
  private readonly context: InteractionContext;
  private readonly pathId: PathId;
  private readonly gestures: PathPointGestures;

  constructor(context: InteractionContext, pathId: PathId) {
    this.context = context;
    this.pathId = pathId;
    this.gestures = new PathPointGestures(context);
  }

  onPointerDown(planPoint: Vector2, _modifiers: PlanModifiers): boolean {
    if (this.context.store.activeTool !== 'select') {
      return false;
    }

    if (!this.gestures.begin(planPoint, { allowInsert: true })) {
      this.context.store.setSelectedPathPointIndex(undefined);
    }

    return true;
  }

  onPointerMove(planPoint: Vector2, modifiers: PlanModifiers): boolean {
    if (this.gestures.move(planPoint, modifiers)) {
      return true;
    }

    applyPathHandleHover(this.context, planPoint, { includeMidpoints: true });

    return true;
  }

  onPointerUp(planPoint: Vector2, modifiers: PlanModifiers): boolean {
    if (!this.gestures.release(planPoint, modifiers)) {
      return false;
    }

    // The grip is released: whatever the pointer rests on now is a hover.
    applyPathHandleHover(this.context, planPoint, { includeMidpoints: true });

    return true;
  }

  onPointerCancel(): void {
    this.gestures.cancel();
  }

  /** Over a square it takes the point out; over emptiness it closes the editor. */
  onDoubleClick(planPoint: Vector2, _modifiers: PlanModifiers): void {
    const { store, getViewport } = this.context;
    const path = store.selectedPath;

    if (isNil(path) || path.id !== this.pathId) {
      return;
    }

    const viewport = getViewport();
    const handle = findPathPointHandleAt(
      computePathPointHandles(path, viewport, { includeMidpoints: true }),
      planToScreen(viewport, planPoint),
      HANDLE_HIT_RADIUS_PX
    );

    if (isNil(handle)) {
      store.exitEditMode();

      return;
    }

    if (handle.kind === 'vertex' && path.points.length > MIN_PATH_POINTS) {
      // The double click's presses have already grabbed the point and announced
      // a step; removing is what the gesture turns out to have been.
      this.gestures.drop();
      store.removePathPoint(path.id, handle.index);
      // The removed point's highlight would light its successor by index.
      store.setPathHandleHighlight(undefined);
    }
  }

  onKeyDown(key: string, _modifiers: PlanModifiers): boolean {
    if (!DELETE_KEYS.has(key)) {
      return false;
    }

    const { store } = this.context;
    const pointIndex = store.selectedPathPointIndex;

    if (!isNil(pointIndex)) {
      store.pushHistory();
      store.removePathPoint(this.pathId, pointIndex);
      store.setPathHandleHighlight(undefined);
    }

    return true;
  }

  /** The edited point is the ladder level under the path's own selection. */
  onEscapeStep(): boolean {
    const { store } = this.context;

    if (isNil(store.selectedPathPointIndex)) {
      return false;
    }

    store.setSelectedPathPointIndex(undefined);

    return true;
  }

  hasTransientInteraction(): boolean {
    return this.gestures.hasActive();
  }

  cancelTransients(): void {
    this.onPointerCancel();
  }
}
