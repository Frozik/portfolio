import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';
import type { PlanModifiers } from '../../domain/view/plan-input';
import { planToScreen } from '../../domain/view/plan-viewport';
import { computePolylinePointHandles, findPathPointHandleAt } from '../render/plan-draw/draw-paths';
import type { InteractionContext } from './editor-interaction';
import { offsetBetween, snapPointToGrid } from './grid-snapping';
import { HANDLE_HIT_RADIUS_PX } from './plan-picking';

/**
 * How one polyline-carrying object plugs its store actions into the shared
 * point gestures: a path and a utility trench differ only in where their
 * points live and which edits move them, so everything about grabbing,
 * dragging, planting and restoring is written once against this seam.
 */
export interface PolylinePointAdapter<T> {
  /** The selected polyline the gesture may take hold of, if any. */
  readonly selected: () => T | undefined;
  readonly positions: (target: T) => readonly Vector2[];
  readonly movePoint: (target: T, pointIndex: number, position: Vector2) => void;
  /** Plants a new point inside the segment after `segmentIndex`. */
  readonly insertPoint: (target: T, segmentIndex: number, position: Vector2) => void;
  /** Puts the whole polyline back as it stood at the grab. */
  readonly restore: (target: T) => void;
  /** Whether the polyline runs as a ring — the closing segment gets its handles too. */
  readonly isClosed?: (target: T) => boolean;
  /** Editor-mode extra: the grabbed point becomes the opened one. */
  readonly onGrabbed?: (pointIndex: number) => void;
  /**
   * Magnetism beyond the grid — a trench bend onto a matching entry, a wall's
   * dragged endpoint onto its opposite end.
   */
  readonly snapPoint?: (target: T, pointIndex: number, position: Vector2) => Vector2 | undefined;
}

/**
 * Dragging one point of a selected polyline — an existing one by its square,
 * or the one a segment's midpoint ring has just planted. The polyline as it
 * stood before the grab is kept whole: a midpoint grab has already edited it,
 * so an interrupted gesture restores the object rather than one point of it.
 */
interface PolylinePointDrag<T> {
  readonly startTarget: T;
  readonly pointIndex: number;
  readonly grabOffset: Vector2;
  /** A midpoint grab has already planted its point, so a cancel must restore even unmoved. */
  readonly wasInserted: boolean;
}

/**
 * The point-level grip on a selected polyline, shared by every place that
 * offers one: view mode moves existing points (squares only), an open editor
 * also plants new ones (midpoint rings) — one flag keeps the hit test, the
 * highlight and the drag agreeing about which handles exist right now.
 */
export class PolylinePointGestures<T> {
  private readonly context: InteractionContext;
  private readonly adapter: PolylinePointAdapter<T>;
  private drag: PolylinePointDrag<T> | undefined = undefined;

  constructor(context: InteractionContext, adapter: PolylinePointAdapter<T>) {
    this.context = context;
    this.adapter = adapter;
  }

  /**
   * Takes hold of a point of the selected polyline: a square drags the point
   * it marks, a midpoint ring plants a new point in its segment and hands it
   * to the same drag — so a bend is added by pulling the segment where it
   * should bend, the way every polyline editor does it.
   */
  begin(planPoint: Vector2, { allowInsert }: { readonly allowInsert: boolean }): boolean {
    const { store, getViewport } = this.context;
    const target = this.adapter.selected();

    if (isNil(target)) {
      return false;
    }

    const positions = this.adapter.positions(target);
    const viewport = getViewport();
    const handle = findPathPointHandleAt(
      computePolylinePointHandles(positions, viewport, {
        includeMidpoints: allowInsert,
        isClosed: this.adapter.isClosed?.(target) ?? false,
      }),
      planToScreen(viewport, planPoint),
      HANDLE_HIT_RADIUS_PX
    );

    if (isNil(handle)) {
      return false;
    }

    store.pushHistory();

    if (handle.kind === 'vertex') {
      this.drag = {
        startTarget: target,
        pointIndex: handle.index,
        grabOffset: offsetBetween(planPoint, positions[handle.index]),
        wasInserted: false,
      };
    } else {
      this.adapter.insertPoint(target, handle.index, planPoint);
      this.drag = {
        startTarget: target,
        pointIndex: handle.index + 1,
        grabOffset: { x: 0, y: 0 },
        wasInserted: true,
      };
    }

    if (allowInsert) {
      // Inside the editor the grabbed point is also the opened one.
      this.adapter.onGrabbed?.(this.drag.pointIndex);
    }

    // Whichever handle was pressed, what follows the pointer now is a point.
    store.setPathHandleHighlight({
      kind: 'vertex',
      index: this.drag.pointIndex,
      state: 'drag',
    });

    return true;
  }

  move(planPoint: Vector2, modifiers: PlanModifiers): boolean {
    const drag = this.drag;

    if (isNil(drag)) {
      return false;
    }

    this.applyDrag(drag, planPoint, modifiers);

    return true;
  }

  /** Applies the final position and lets go; the caller refreshes the hover. */
  release(planPoint: Vector2, modifiers: PlanModifiers): boolean {
    const drag = this.drag;

    if (isNil(drag)) {
      return false;
    }

    this.drag = undefined;

    if (this.context.hasPointerMoved()) {
      this.applyDrag(drag, planPoint, modifiers);
    }

    return true;
  }

  /**
   * The polyline followed the pointer as its point moved — and a midpoint grab
   * edited it the moment it began — so the whole object is put back as grabbed.
   */
  cancel(): void {
    const drag = this.drag;

    if (isNil(drag)) {
      return;
    }

    this.drag = undefined;

    if (this.context.hasPointerMoved() || drag.wasInserted) {
      this.adapter.restore(drag.startTarget);
    }
  }

  /** Lets go with no restore — a double click's removal supersedes its grab. */
  drop(): void {
    this.drag = undefined;
  }

  hasActive(): boolean {
    return !isNil(this.drag);
  }

  private applyDrag(
    drag: PolylinePointDrag<T>,
    planPoint: Vector2,
    modifiers: PlanModifiers
  ): void {
    const raw = { x: planPoint.x + drag.grabOffset.x, y: planPoint.y + drag.grabOffset.y };
    const snapped =
      this.adapter.snapPoint?.(drag.startTarget, drag.pointIndex, raw) ??
      snapPointToGrid(this.context.store, raw, modifiers);

    this.adapter.movePoint(drag.startTarget, drag.pointIndex, snapped);
  }
}

/**
 * Echoes the handle under the idle pointer back as its hover highlight, so the
 * targets that crowd a polyline — square, ring, the body itself — announce
 * which of them a press would take. The caller decides whether rings exist.
 */
export function applyPolylineHandleHover(
  context: InteractionContext,
  planPoint: Vector2,
  positions: readonly Vector2[] | undefined,
  {
    includeMidpoints,
    isClosed = false,
  }: { readonly includeMidpoints: boolean; readonly isClosed?: boolean }
): void {
  const { store, getViewport } = context;

  if (store.activeTool !== 'select' || isNil(positions)) {
    store.setPathHandleHighlight(undefined);

    return;
  }

  const viewport = getViewport();
  const handle = findPathPointHandleAt(
    computePolylinePointHandles(positions, viewport, { includeMidpoints, isClosed }),
    planToScreen(viewport, planPoint),
    HANDLE_HIT_RADIUS_PX
  );

  store.setPathHandleHighlight(
    isNil(handle) ? undefined : { kind: handle.kind, index: handle.index, state: 'hover' }
  );
}
