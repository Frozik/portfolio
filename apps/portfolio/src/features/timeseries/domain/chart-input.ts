import { ZOOM_FACTOR_MAX, ZOOM_FACTOR_MIN } from './constants';
import type { FpsController } from './fps-controller';
import { EFpsLevel } from './fps-controller';
import type { IChartViewport } from './types';
import { clampViewport, panViewport, zoomViewport } from './viewport';

/**
 * Chart viewport controller using Pointer Events for unified mouse/touch/pen handling.
 * Single-pointer drag pans the viewport, two-pointer pinch zooms, wheel zooms.
 */
export class ChartInputController {
  private readonly activePointers = new Map<number, { clientX: number; clientY: number }>();
  private lastPinchDistance = 0;

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
      this.fpsController.raise(EFpsLevel.Interaction);

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
      this.fpsController.raise(EFpsLevel.Interaction);

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
      this.fpsController.raise(EFpsLevel.Interaction);
    };
  }

  get isInteracting(): boolean {
    return this.activePointers.size > 0;
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
