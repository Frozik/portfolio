import { FPS_FOLLOW_DRIFT, FPS_INTERACTION, WHEEL_ZOOM_STEP } from './constants';
import type { TaskManager } from './task-manager';
import type { IHeatmapViewport } from './types';

const MIN_DRAG_DISTANCE_PX = 2;
const PINCH_DEAD_ZONE = 1e-4;

interface IActivePointer {
  readonly id: number;
  clientX: number;
  clientY: number;
}

export interface IViewportInputControllerParams {
  readonly canvas: HTMLCanvasElement;
  readonly taskManager: TaskManager;
  readonly viewport: IHeatmapViewport;
  /**
   * Fired the moment a single-pointer drag crosses {@link MIN_DRAG_DISTANCE_PX}
   * — i.e. the user has actually started panning rather than just
   * shaking on the click. The controller uses this to pin the
   * viewport's `targetViewTimeEndMs` to the current view and drop the
   * sticky follow flag.
   */
  readonly onPanStart: () => void;
}

/**
 * Owns all pointer / wheel / pinch input handling for the heatmap
 * canvas. Accumulates gestures into pending deltas; the parent
 * {@link ViewportController} drains them once per RAF in `tick()` and
 * applies them through the viewport lerp pipeline.
 *
 * Keeping input state separate from lerp state means each side can be
 * tested in isolation and the pointer-event surface doesn't leak into
 * the animation loop.
 */
export class ViewportInputController {
  private readonly canvas: HTMLCanvasElement;
  private readonly taskManager: TaskManager;
  private readonly viewport: IHeatmapViewport;
  private readonly onPanStart: () => void;

  private pointers: IActivePointer[] = [];
  private lastPointerX = 0;
  private pendingDragDistance = 0;
  private pendingDeltaPx = 0;
  private actuallyPanning = false;
  private pinchInitialDistance: number | undefined = undefined;
  private pendingZoomFactor = 1;
  /**
   * Latest cursor position in CSS pixels relative to the canvas origin,
   * or `undefined` when the pointer is outside.
   */
  private cursorCssPosition: { x: number; y: number } | undefined = undefined;
  /**
   * When `true`, `handlePointerMove` skips cursor tracking — used while
   * a click-pinned popup (e.g. the trade-bucket popup) is open so the
   * crosshair / hover overlays don't update under a stationary cursor.
   * Pan / pinch input still flows through unchanged.
   */
  private cursorSuppressed = false;

  constructor(params: IViewportInputControllerParams) {
    this.canvas = params.canvas;
    this.taskManager = params.taskManager;
    this.viewport = params.viewport;
    this.onPanStart = params.onPanStart;

    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
    this.handlePointerLeave = this.handlePointerLeave.bind(this);
    this.handleWheel = this.handleWheel.bind(this);
  }

  attach(): void {
    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
    this.canvas.addEventListener('pointermove', this.handlePointerMove);
    this.canvas.addEventListener('pointerup', this.handlePointerUp);
    this.canvas.addEventListener('pointercancel', this.handlePointerLeave);
    this.canvas.addEventListener('pointerleave', this.handlePointerLeave);
    this.canvas.addEventListener('wheel', this.handleWheel, { passive: false });
  }

  detach(): void {
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    this.canvas.removeEventListener('pointermove', this.handlePointerMove);
    this.canvas.removeEventListener('pointerup', this.handlePointerUp);
    this.canvas.removeEventListener('pointercancel', this.handlePointerLeave);
    this.canvas.removeEventListener('pointerleave', this.handlePointerLeave);
    this.canvas.removeEventListener('wheel', this.handleWheel);
  }

  get isPanning(): boolean {
    return this.pointers.length === 1 && this.actuallyPanning;
  }

  get isZooming(): boolean {
    return this.pointers.length >= 2;
  }

  get isActuallyPanning(): boolean {
    return this.actuallyPanning;
  }

  getCursorCss(): { readonly x: number; readonly y: number } | undefined {
    return this.cursorCssPosition;
  }

  /**
   * Toggle cursor tracking. Setting to `true` immediately clears the
   * current cursor position so any in-flight crosshair render goes
   * away on the next frame; subsequent pointer moves are ignored
   * (for cursor purposes) until the flag is cleared again.
   */
  setCursorSuppressed(value: boolean): void {
    this.cursorSuppressed = value;
    if (value) {
      this.cursorCssPosition = undefined;
    }
  }

  /** Read & reset the accumulated pan delta in CSS pixels. */
  consumePendingDeltaPx(): number {
    const value = this.pendingDeltaPx;
    this.pendingDeltaPx = 0;
    return value;
  }

  /** Read & reset the accumulated wheel/pinch zoom factor. */
  consumePendingZoomFactor(): number {
    const value = this.pendingZoomFactor;
    this.pendingZoomFactor = 1;
    return value;
  }

  private handlePointerDown(event: PointerEvent): void {
    if (this.pointers.length >= 2) {
      return;
    }
    this.pointers.push({
      id: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
    });
    this.canvas.setPointerCapture(event.pointerId);

    if (this.pointers.length === 1) {
      this.lastPointerX = event.clientX;
      this.pendingDragDistance = 0;
      this.pendingDeltaPx = 0;
      this.actuallyPanning = false;
    } else {
      // Second pointer: transition into pinch; cancel any pending pan inertia.
      this.actuallyPanning = false;
      this.pendingDeltaPx = 0;
      this.viewport.panVelocityMsPerFrame = 0;
      this.pinchInitialDistance = this.distanceBetweenPointers();
    }
  }

  private handlePointerMove(event: PointerEvent): void {
    // Crosshair tracking is mouse/pen-only. Touches don't get a hover
    // notion — a finger tap shouldn't paint a crosshair where it
    // landed and leave it stuck after the finger lifts. Suppression
    // by an open popup (`cursorSuppressed`) also gates the crosshair
    // off. Pan / pinch logic below still runs for touch and during
    // suppression.
    if (event.pointerType !== 'touch' && !this.cursorSuppressed) {
      const canvasRect = this.canvas.getBoundingClientRect();
      this.cursorCssPosition = {
        x: event.clientX - canvasRect.left,
        y: event.clientY - canvasRect.top,
      };
      this.taskManager.raise(FPS_INTERACTION);
    }

    const pointer = this.pointers.find(candidate => candidate.id === event.pointerId);
    if (pointer === undefined) {
      return;
    }
    pointer.clientX = event.clientX;
    pointer.clientY = event.clientY;

    if (this.pointers.length >= 2) {
      this.accumulatePinchZoom();
      return;
    }

    const deltaPx = event.clientX - this.lastPointerX;
    this.lastPointerX = event.clientX;

    this.pendingDragDistance += Math.abs(deltaPx);
    if (!this.actuallyPanning && this.pendingDragDistance >= MIN_DRAG_DISTANCE_PX) {
      this.actuallyPanning = true;
      this.onPanStart();
    }

    if (this.actuallyPanning) {
      this.pendingDeltaPx += deltaPx;
    }
  }

  private handlePointerLeave(event: PointerEvent): void {
    this.cursorCssPosition = undefined;
    this.handlePointerUp(event);
  }

  private handlePointerUp(event: PointerEvent): void {
    const beforeCount = this.pointers.length;
    this.pointers = this.pointers.filter(candidate => candidate.id !== event.pointerId);
    this.canvas.releasePointerCapture?.(event.pointerId);

    if (beforeCount >= 2 && this.pointers.length < 2) {
      this.pinchInitialDistance = undefined;
      // After pinch release, a lingering pointer shouldn't immediately
      // start panning — reset drag state so the user has to pass the
      // distance threshold again.
      this.pendingDragDistance = 0;
      if (this.pointers.length === 1) {
        this.lastPointerX = this.pointers[0].clientX;
      }
    }

    if (this.pointers.length === 0) {
      if (this.actuallyPanning) {
        this.taskManager.raise(FPS_FOLLOW_DRIFT);
      }
      this.actuallyPanning = false;
    }
  }

  private handleWheel(event: WheelEvent): void {
    event.preventDefault();
    const direction = normalizeWheelDirection(event);
    if (direction === 0) {
      return;
    }
    const factor = direction > 0 ? 1 + WHEEL_ZOOM_STEP : 1 / (1 + WHEEL_ZOOM_STEP);
    this.pendingZoomFactor *= factor;
  }

  private accumulatePinchZoom(): void {
    if (this.pointers.length < 2 || this.pinchInitialDistance === undefined) {
      return;
    }
    const currentDistance = this.distanceBetweenPointers();
    if (currentDistance === 0 || this.pinchInitialDistance === 0) {
      return;
    }
    const ratio = this.pinchInitialDistance / currentDistance;
    if (Math.abs(ratio - 1) < PINCH_DEAD_ZONE) {
      return;
    }
    this.pendingZoomFactor *= ratio;
    this.pinchInitialDistance = currentDistance;
  }

  private distanceBetweenPointers(): number {
    if (this.pointers.length < 2) {
      return 0;
    }
    const dx = this.pointers[0].clientX - this.pointers[1].clientX;
    const dy = this.pointers[0].clientY - this.pointers[1].clientY;
    return Math.hypot(dx, dy);
  }
}

function normalizeWheelDirection(event: WheelEvent): number {
  if (event.deltaY === 0) {
    return 0;
  }
  return Math.sign(event.deltaY);
}
