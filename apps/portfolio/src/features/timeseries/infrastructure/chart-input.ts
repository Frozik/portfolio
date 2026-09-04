import { assert } from '@frozik/utils/assert/assert';
import type { FpsController } from '@frozik/utils/webgpu/fpsController';
import { computePinchScale, pointerDistance } from '@frozik/utils/webgpu/pinchScale';
import { isNil } from 'lodash-es';

import type { ViewportState } from '../application/render/viewport-state';
import {
  FPS_INTERACTION,
  PAN_INERTIA_DAMPING,
  PAN_INERTIA_MIN_VELOCITY,
  PAN_VELOCITY_SAMPLE_COUNT,
  ZOOM_FACTOR_MAX,
  ZOOM_FACTOR_MIN,
} from '../domain/constants';
import { clampViewport, panViewport, zoomViewport } from '../domain/viewport';

interface IVelocitySample {
  readonly deltaX: number;
  readonly timestamp: number;
}

interface IPointerPosition {
  readonly clientX: number;
  readonly clientY: number;
}

const MIN_VELOCITY_SAMPLES = 2;

/**
 * Pointer events on the chart canvas: one pointer pans, two pinch-zoom, the
 * wheel zooms. A released pan keeps scrolling with decaying inertia.
 */
export class ChartInputController {
  private readonly activePointers = new Map<number, IPointerPosition>();
  private readonly velocitySamples: IVelocitySample[] = [];
  private lastPinchDistance = 0;
  /** Pixels per millisecond; `0` when at rest. */
  private inertiaVelocity = 0;
  private lastInertiaTimestamp = 0;

  constructor(
    private readonly viewport: ViewportState,
    private readonly canvas: HTMLCanvasElement,
    private readonly dataMinTime: number,
    private readonly dataMaxTime: number,
    private readonly fpsController: FpsController
  ) {}

  get isInteracting(): boolean {
    return this.activePointers.size > 0;
  }

  /** One frame of pan inertia; `true` while the chart still moves. */
  applyInertia(): boolean {
    if (Math.abs(this.inertiaVelocity) < PAN_INERTIA_MIN_VELOCITY) {
      this.inertiaVelocity = 0;
      return false;
    }
    const now = performance.now();
    const deltaPixels = this.inertiaVelocity * (now - this.lastInertiaTimestamp);
    this.lastInertiaTimestamp = now;

    const { viewTimeStart, viewTimeEnd, targetTimeStart, targetTimeEnd } = this.viewport.current;
    const [nextStart, nextEnd] = this.clampedPan(deltaPixels);
    if (nextStart === viewTimeStart && nextEnd === viewTimeEnd) {
      this.inertiaVelocity = 0;
      return false;
    }
    // View and target move together so a zoom animation in flight keeps its gap.
    this.viewport.update({
      viewTimeStart: nextStart,
      viewTimeEnd: nextEnd,
      targetTimeStart: targetTimeStart + (nextStart - viewTimeStart),
      targetTimeEnd: targetTimeEnd + (nextEnd - viewTimeEnd),
    });
    this.inertiaVelocity *= PAN_INERTIA_DAMPING;
    return true;
  }

  attach(): void {
    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
    this.canvas.addEventListener('pointermove', this.handlePointerMove);
    this.canvas.addEventListener('pointerup', this.handlePointerUp);
    this.canvas.addEventListener('pointercancel', this.handlePointerCancel);
    this.canvas.addEventListener('wheel', this.handleWheel, { passive: false });
    this.canvas.style.cursor = 'grab';
  }

  detach(): void {
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    this.canvas.removeEventListener('pointermove', this.handlePointerMove);
    this.canvas.removeEventListener('pointerup', this.handlePointerUp);
    this.canvas.removeEventListener('pointercancel', this.handlePointerCancel);
    this.canvas.removeEventListener('wheel', this.handleWheel);
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    // Captured so a drag that leaves the canvas keeps panning instead of aborting.
    this.canvas.setPointerCapture(event.pointerId);
    this.activePointers.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
    this.fpsController.raise(FPS_INTERACTION);
    this.inertiaVelocity = 0;
    this.velocitySamples.length = 0;

    if (this.activePointers.size === 1) {
      this.canvas.style.cursor = 'grabbing';
    } else if (this.activePointers.size === 2) {
      this.lastPinchDistance = this.getPointerDistance();
    }
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    const previous = this.activePointers.get(event.pointerId);
    if (isNil(previous)) {
      return;
    }
    this.activePointers.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
    this.fpsController.raise(FPS_INTERACTION);

    if (this.activePointers.size === 2) {
      this.pinch();
      return;
    }
    if (this.activePointers.size !== 1) {
      return;
    }
    const deltaX = event.clientX - previous.clientX;
    this.recordVelocitySample(deltaX, event.timeStamp);
    const [nextStart, nextEnd] = this.clampedPan(deltaX);
    this.viewport.update({
      viewTimeStart: nextStart,
      viewTimeEnd: nextEnd,
      targetTimeStart: nextStart,
      targetTimeEnd: nextEnd,
    });
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    if (this.canvas.hasPointerCapture(event.pointerId)) {
      this.canvas.releasePointerCapture(event.pointerId);
    }
    this.activePointers.delete(event.pointerId);
    if (this.activePointers.size === 0) {
      this.canvas.style.cursor = 'grab';
      this.startInertia();
    }
  };

  private readonly handlePointerCancel = (event: PointerEvent): void => {
    this.activePointers.delete(event.pointerId);
    if (this.activePointers.size === 0) {
      this.canvas.style.cursor = 'grab';
    }
  };

  private readonly handleWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const centerNormalized = (event.clientX - rect.left) / rect.width;
    this.zoomTarget(event.deltaY > 0 ? ZOOM_FACTOR_MAX : ZOOM_FACTOR_MIN, centerNormalized);
    this.fpsController.raise(FPS_INTERACTION);
  };

  private pinch(): void {
    const currentDistance = this.getPointerDistance();
    const scale = computePinchScale(this.lastPinchDistance, currentDistance);
    if (isNil(scale)) {
      return;
    }
    this.zoomTarget(scale, this.getPointerCenterNormalized());
    this.lastPinchDistance = currentDistance;
  }

  private zoomTarget(factor: number, centerNormalized: number): void {
    const { targetTimeStart, targetTimeEnd } = this.viewport.current;
    const [nextStart, nextEnd] = clampViewport(
      ...zoomViewport(targetTimeStart, targetTimeEnd, factor, centerNormalized),
      this.dataMinTime,
      this.dataMaxTime
    );
    this.viewport.update({ targetTimeStart: nextStart, targetTimeEnd: nextEnd });
  }

  private clampedPan(deltaPixels: number): readonly [number, number] {
    const { viewTimeStart, viewTimeEnd } = this.viewport.current;
    return clampViewport(
      ...panViewport(viewTimeStart, viewTimeEnd, deltaPixels, this.canvas.clientWidth),
      this.dataMinTime,
      this.dataMaxTime
    );
  }

  private recordVelocitySample(deltaX: number, timestamp: number): void {
    this.velocitySamples.push({ deltaX, timestamp });
    if (this.velocitySamples.length > PAN_VELOCITY_SAMPLE_COUNT) {
      this.velocitySamples.shift();
    }
  }

  private startInertia(): void {
    const first = this.velocitySamples[0];
    const last = this.velocitySamples[this.velocitySamples.length - 1];
    const samples = this.velocitySamples.splice(0);
    if (samples.length < MIN_VELOCITY_SAMPLES || isNil(first) || isNil(last)) {
      return;
    }
    const totalTime = last.timestamp - first.timestamp;
    if (totalTime <= 0) {
      return;
    }
    const totalDeltaX = samples.reduce((sum, sample) => sum + sample.deltaX, 0);
    this.inertiaVelocity = totalDeltaX / totalTime;
    this.lastInertiaTimestamp = performance.now();
  }

  private getTwoPointers(): readonly [IPointerPosition, IPointerPosition] {
    const [first, second] = this.activePointers.values();
    assert(!isNil(first) && !isNil(second), 'pinch needs two active pointers');
    return [first, second];
  }

  private getPointerDistance(): number {
    const [first, second] = this.getTwoPointers();
    return pointerDistance(first.clientX, first.clientY, second.clientX, second.clientY);
  }

  private getPointerCenterNormalized(): number {
    const [first, second] = this.getTwoPointers();
    const rect = this.canvas.getBoundingClientRect();
    return ((first.clientX + second.clientX) / 2 - rect.left) / rect.width;
  }
}
