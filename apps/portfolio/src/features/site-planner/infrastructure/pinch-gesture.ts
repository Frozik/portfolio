import type { Vector2 } from '@frozik/utils/math/vector2';
import { computePinchScale, pointerDistance } from '@frozik/utils/webgpu/pinchScale';
import { isNil } from 'lodash-es';

import type { PlanViewport } from '../domain/view/plan-viewport';
import { panByPixels, zoomAroundPoint } from '../domain/view/plan-viewport';

/** Two fingers are the camera; one is whatever tool is in hand. */
const PINCH_POINTER_COUNT = 2;

/**
 * The two-finger camera: where every pointer on the canvas is, in client
 * pixels, and — while two of them pinch — how far apart they were last frame.
 */
export class PinchGesture {
  private readonly activePointers = new Map<number, Vector2>();
  /** Separation of the pinching pair as of the last frame; nothing while none pinch. */
  private distancePx: number | undefined = undefined;

  isPinching(): boolean {
    return !isNil(this.distancePx);
  }

  /** Records a pointer going down; true when it is the second finger and the pinch begins. */
  trackPointerDown(event: PointerEvent): boolean {
    this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (this.activePointers.size !== PINCH_POINTER_COUNT) {
      return false;
    }

    this.distancePx = this.measureDistance();

    return true;
  }

  /** Records a pointer moving; while pinching, the pair's centre before the move. */
  trackPointerMove(event: PointerEvent): Vector2 | undefined {
    const isTracked = this.activePointers.has(event.pointerId);
    const previousCenter = isTracked && this.isPinching() ? this.measureCenter() : undefined;

    if (isTracked) {
      this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }

    return previousCenter;
  }

  /** A pinch survives only as long as both of its fingers are down. */
  forgetPointer(event: PointerEvent): void {
    this.activePointers.delete(event.pointerId);

    if (this.activePointers.size < PINCH_POINTER_COUNT) {
      this.distancePx = undefined;
    }
  }

  forgetAll(): void {
    this.activePointers.clear();
    this.distancePx = undefined;
  }

  /** The viewport after this frame's pinch: zoomed about the pair, then panned with it. */
  apply(
    viewport: PlanViewport,
    previousCenter: Vector2,
    toCanvasPoint: (clientPoint: Vector2) => Vector2
  ): PlanViewport {
    const distancePx = this.measureDistance();
    // `computePinchScale` is written for a camera distance, which fingers moving
    // apart make shorter; a zoom moves the other way, so its factor is inverted.
    const cameraScale = computePinchScale(this.distancePx ?? distancePx, distancePx);
    const center = this.measureCenter();

    let next = viewport;

    if (!isNil(cameraScale) && cameraScale > 0) {
      this.distancePx = distancePx;
      next = zoomAroundPoint(next, toCanvasPoint(previousCenter), 1 / cameraScale);
    }

    return panByPixels(next, { x: center.x - previousCenter.x, y: center.y - previousCenter.y });
  }

  /** The pinching pair: the two pointers that were on the canvas first. */
  private readPair(): readonly Vector2[] {
    return [...this.activePointers.values()].slice(0, PINCH_POINTER_COUNT);
  }

  private measureCenter(): Vector2 {
    const [first, second] = this.readPair();

    return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
  }

  private measureDistance(): number {
    const [first, second] = this.readPair();

    return pointerDistance(first.x, first.y, second.x, second.y);
  }
}
