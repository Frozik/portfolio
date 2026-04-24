import type { FpsController } from '@frozik/utils/webgpu/fpsController';
import {
  FPS_INTERACTION,
  PAN_INERTIA_DAMPING,
  PAN_INERTIA_MIN_VELOCITY,
  PAN_VELOCITY_SAMPLE_COUNT,
  ZOOM_FACTOR_MAX,
  ZOOM_FACTOR_MIN,
} from './constants';
import type { IChartViewport } from './types';
import { clampViewport, panViewport, zoomViewport } from './viewport';

interface IVelocitySample {
  readonly dx: number;
  readonly timestamp: number;
}

/**
 * Chart viewport controller using Pointer Events for unified mouse/touch/pen handling.
 * Single-pointer drag pans the viewport, two-pointer pinch zooms, wheel zooms.
 * Pan has inertia: after releasing the pointer the chart continues scrolling with decay.
 */
export class ChartInputController {
  private readonly activePointers = new Map<number, { clientX: number; clientY: number }>();
  private lastPinchDistance = 0;

  /** Recent pointer-move deltas used to estimate release velocity. */
  private readonly velocitySamples: IVelocitySample[] = [];

  /** Current inertia velocity in pixels per millisecond (0 = no inertia). */
  private inertiaVelocity = 0;

  /** Timestamp of the last inertia tick, used to compute per-frame delta. */
  private lastInertiaTimestamp = 0;

  private readonly handlePointerDown: (event: PointerEvent) => void;
  private readonly handlePointerMove: (event: PointerEvent) => void;
  private readonly handlePointerUp: (event: PointerEvent) => void;
  private readonly handlePointerCancel: (event: PointerEvent) => void;
  private readonly handleWheel: (event: WheelEvent) => void;

  constructor(
    private readonly viewport: IChartViewport,
    private readonly canvas: HTMLCanvasElement,
    private readonly dataMinTime: number,
    private readonly dataMaxTime: number,
    private readonly fpsController: FpsController
  ) {
    this.handlePointerDown = (event: PointerEvent): void => {
      this.activePointers.set(event.pointerId, {
        clientX: event.clientX,
        clientY: event.clientY,
      });
      this.fpsController.raise(FPS_INTERACTION);

      // Stop any ongoing inertia when the user grabs the chart again
      this.inertiaVelocity = 0;
      this.velocitySamples.length = 0;

      if (this.activePointers.size === 1) {
        this.canvas.style.cursor = 'grabbing';
      } else if (this.activePointers.size === 2) {
        this.lastPinchDistance = this.getPointerDistance();
      }
    };

    this.handlePointerMove = (event: PointerEvent): void => {
      const previous = this.activePointers.get(event.pointerId);
      if (previous === undefined) {
        return;
      }

      this.activePointers.set(event.pointerId, {
        clientX: event.clientX,
        clientY: event.clientY,
      });
      this.fpsController.raise(FPS_INTERACTION);

      // Two-pointer pinch zoom
      if (this.activePointers.size === 2) {
        const currentDistance = this.getPointerDistance();
        const scale = this.lastPinchDistance / currentDistance;
        const centerNormalized = this.getPointerCenter();

        const [newStart, newEnd] = clampViewport(
          ...zoomViewport(
            this.viewport.targetTimeStart,
            this.viewport.targetTimeEnd,
            scale,
            centerNormalized
          ),
          this.dataMinTime,
          this.dataMaxTime
        );
        this.viewport.targetTimeStart = newStart;
        this.viewport.targetTimeEnd = newEnd;
        this.lastPinchDistance = currentDistance;
        return;
      }

      // Single-pointer pan
      if (this.activePointers.size !== 1) {
        return;
      }

      const dx = event.clientX - previous.clientX;

      this.recordVelocitySample(dx, event.timeStamp);

      const [newStart, newEnd] = clampViewport(
        ...panViewport(
          this.viewport.viewTimeStart,
          this.viewport.viewTimeEnd,
          dx,
          this.canvas.clientWidth
        ),
        this.dataMinTime,
        this.dataMaxTime
      );
      this.viewport.viewTimeStart = newStart;
      this.viewport.viewTimeEnd = newEnd;
      this.viewport.targetTimeStart = newStart;
      this.viewport.targetTimeEnd = newEnd;
    };

    this.handlePointerUp = (event: PointerEvent): void => {
      this.activePointers.delete(event.pointerId);

      if (this.activePointers.size === 0) {
        this.canvas.style.cursor = 'grab';
        this.startInertia();
      }
    };

    this.handlePointerCancel = (event: PointerEvent): void => {
      this.activePointers.delete(event.pointerId);

      if (this.activePointers.size === 0) {
        this.canvas.style.cursor = 'grab';
      }
    };

    this.handleWheel = (event: WheelEvent): void => {
      event.preventDefault();

      const rect = this.canvas.getBoundingClientRect();
      const centerNormalized = (event.clientX - rect.left) / rect.width;
      const factor = event.deltaY > 0 ? ZOOM_FACTOR_MAX : ZOOM_FACTOR_MIN;

      const [newStart, newEnd] = clampViewport(
        ...zoomViewport(
          this.viewport.targetTimeStart,
          this.viewport.targetTimeEnd,
          factor,
          centerNormalized
        ),
        this.dataMinTime,
        this.dataMaxTime
      );
      this.viewport.targetTimeStart = newStart;
      this.viewport.targetTimeEnd = newEnd;
      this.fpsController.raise(FPS_INTERACTION);
    };
  }

  get isInteracting(): boolean {
    return this.activePointers.size > 0;
  }

  /**
   * Apply pan inertia decay. Must be called every frame from the chart's update loop.
   * Returns true if inertia is still active (chart should keep rendering).
   */
  applyInertia(): boolean {
    if (Math.abs(this.inertiaVelocity) < PAN_INERTIA_MIN_VELOCITY) {
      this.inertiaVelocity = 0;
      return false;
    }

    const now = performance.now();
    const deltaMs = now - this.lastInertiaTimestamp;
    this.lastInertiaTimestamp = now;

    const deltaPixels = this.inertiaVelocity * deltaMs;

    const [newStart, newEnd] = clampViewport(
      ...panViewport(
        this.viewport.viewTimeStart,
        this.viewport.viewTimeEnd,
        deltaPixels,
        this.canvas.clientWidth
      ),
      this.dataMinTime,
      this.dataMaxTime
    );

    // Stop inertia if viewport didn't change (hit data boundary)
    if (newStart === this.viewport.viewTimeStart && newEnd === this.viewport.viewTimeEnd) {
      this.inertiaVelocity = 0;
      return false;
    }

    // Shift both view and target by the same delta so zoom lerp gap is preserved
    const deltaStart = newStart - this.viewport.viewTimeStart;
    const deltaEnd = newEnd - this.viewport.viewTimeEnd;

    this.viewport.viewTimeStart = newStart;
    this.viewport.viewTimeEnd = newEnd;
    this.viewport.targetTimeStart += deltaStart;
    this.viewport.targetTimeEnd += deltaEnd;

    this.inertiaVelocity *= PAN_INERTIA_DAMPING;

    return true;
  }

  attach(): void {
    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
    this.canvas.addEventListener('pointermove', this.handlePointerMove);
    this.canvas.addEventListener('pointerup', this.handlePointerUp);
    this.canvas.addEventListener('pointercancel', this.handlePointerCancel);
    this.canvas.addEventListener('pointerleave', this.handlePointerUp);
    this.canvas.addEventListener('wheel', this.handleWheel, { passive: false });
    this.canvas.style.cursor = 'grab';
  }

  detach(): void {
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    this.canvas.removeEventListener('pointermove', this.handlePointerMove);
    this.canvas.removeEventListener('pointerup', this.handlePointerUp);
    this.canvas.removeEventListener('pointercancel', this.handlePointerCancel);
    this.canvas.removeEventListener('pointerleave', this.handlePointerUp);
    this.canvas.removeEventListener('wheel', this.handleWheel);
  }

  private recordVelocitySample(dx: number, timestamp: number): void {
    this.velocitySamples.push({ dx, timestamp });

    if (this.velocitySamples.length > PAN_VELOCITY_SAMPLE_COUNT) {
      this.velocitySamples.shift();
    }
  }

  private startInertia(): void {
    if (this.velocitySamples.length < 2) {
      this.velocitySamples.length = 0;
      return;
    }

    const first = this.velocitySamples[0];
    const last = this.velocitySamples[this.velocitySamples.length - 1];
    const totalTime = last.timestamp - first.timestamp;

    if (totalTime <= 0) {
      this.velocitySamples.length = 0;
      return;
    }

    let totalDx = 0;
    for (const sample of this.velocitySamples) {
      totalDx += sample.dx;
    }

    this.inertiaVelocity = totalDx / totalTime;
    this.lastInertiaTimestamp = performance.now();
    this.velocitySamples.length = 0;
  }

  private getPointerDistance(): number {
    const pointers = [...this.activePointers.values()];
    const dx = pointers[0].clientX - pointers[1].clientX;
    const dy = pointers[0].clientY - pointers[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private getPointerCenter(): number {
    const pointers = [...this.activePointers.values()];
    const rect = this.canvas.getBoundingClientRect();
    const cx = (pointers[0].clientX + pointers[1].clientX) / 2;
    return (cx - rect.left) / rect.width;
  }
}
