import { ZOOM_FACTOR_MAX, ZOOM_FACTOR_MIN } from './constants';
import type { IChartViewport } from './types';
import { clampViewport, panViewport, zoomViewport } from './viewport';

export class ChartInputController {
  private isDragging = false;
  private lastMouseX = 0;

  private isTouching = false;
  private lastTouchX = 0;
  private lastPinchDistance = 0;

  private readonly handleMouseDown: (e: MouseEvent) => void;
  private readonly handleMouseMove: (e: MouseEvent) => void;
  private readonly handleMouseUp: () => void;
  private readonly handleWheel: (e: WheelEvent) => void;
  private readonly handleTouchStart: (e: TouchEvent) => void;
  private readonly handleTouchMove: (e: TouchEvent) => void;
  private readonly handleTouchEnd: (e: TouchEvent) => void;

  constructor(
    private readonly viewport: IChartViewport,
    private readonly canvas: HTMLCanvasElement,
    private readonly dataMinTime: number,
    private readonly dataMaxTime: number
  ) {
    this.handleMouseDown = (e: MouseEvent): void => {
      this.isDragging = true;
      this.lastMouseX = e.clientX;
      this.canvas.style.cursor = 'grabbing';
    };

    this.handleMouseMove = (e: MouseEvent): void => {
      if (!this.isDragging) {
        return;
      }

      const dx = e.clientX - this.lastMouseX;
      this.lastMouseX = e.clientX;

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

    this.handleMouseUp = (): void => {
      this.isDragging = false;
      this.canvas.style.cursor = 'grab';
    };

    this.handleWheel = (e: WheelEvent): void => {
      e.preventDefault();

      const rect = this.canvas.getBoundingClientRect();
      const centerNormalized = (e.clientX - rect.left) / rect.width;
      const factor = e.deltaY > 0 ? ZOOM_FACTOR_MAX : ZOOM_FACTOR_MIN;

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
    };

    this.handleTouchStart = (e: TouchEvent): void => {
      if (e.touches.length === 1) {
        this.isTouching = true;
        this.lastTouchX = e.touches[0].clientX;
      } else if (e.touches.length === 2) {
        this.isTouching = false;
        this.lastPinchDistance = this.getTouchDistance(e);
      }
    };

    this.handleTouchMove = (e: TouchEvent): void => {
      e.preventDefault();

      if (e.touches.length === 2) {
        const currentDistance = this.getTouchDistance(e);
        const scale = this.lastPinchDistance / currentDistance;
        const centerNormalized = this.getTouchCenter(e);

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

      if (!this.isTouching || e.touches.length !== 1) {
        return;
      }

      const dx = e.touches[0].clientX - this.lastTouchX;
      this.lastTouchX = e.touches[0].clientX;

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

    this.handleTouchEnd = (e: TouchEvent): void => {
      if (e.touches.length === 0) {
        this.isTouching = false;
      } else if (e.touches.length === 1) {
        this.isTouching = true;
        this.lastTouchX = e.touches[0].clientX;
      }
    };
  }

  get isInteracting(): boolean {
    return this.isDragging || this.isTouching;
  }

  attach(): void {
    this.canvas.addEventListener('mousedown', this.handleMouseDown);
    this.canvas.addEventListener('mousemove', this.handleMouseMove);
    this.canvas.addEventListener('mouseup', this.handleMouseUp);
    this.canvas.addEventListener('mouseleave', this.handleMouseUp);
    this.canvas.addEventListener('wheel', this.handleWheel, { passive: false });
    this.canvas.addEventListener('touchstart', this.handleTouchStart, { passive: true });
    this.canvas.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    this.canvas.addEventListener('touchend', this.handleTouchEnd);
    this.canvas.style.cursor = 'grab';
  }

  detach(): void {
    this.canvas.removeEventListener('mousedown', this.handleMouseDown);
    this.canvas.removeEventListener('mousemove', this.handleMouseMove);
    this.canvas.removeEventListener('mouseup', this.handleMouseUp);
    this.canvas.removeEventListener('mouseleave', this.handleMouseUp);
    this.canvas.removeEventListener('wheel', this.handleWheel);
    this.canvas.removeEventListener('touchstart', this.handleTouchStart);
    this.canvas.removeEventListener('touchmove', this.handleTouchMove);
    this.canvas.removeEventListener('touchend', this.handleTouchEnd);
  }

  private getTouchDistance(e: TouchEvent): number {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private getTouchCenter(e: TouchEvent): number {
    const rect = this.canvas.getBoundingClientRect();
    const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    return (cx - rect.left) / rect.width;
  }
}
