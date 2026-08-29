/**
 * Tracks the device-pixel size of a chart canvas.
 *
 * `measure()` reads the CSS box once per frame; every consumer then reuses
 * the cached numbers instead of re-reading `clientWidth`/`clientHeight`,
 * which would force an extra layout flush. Width changes are reported to
 * the owner so it can react (the chart springs its time axis).
 */
export class CanvasSizeTracker {
  private canvasWidth = 0;
  private canvasHeight = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly onWidthChange: (newWidth: number, previousWidth: number) => void
  ) {
    this.measure();
  }

  get width(): number {
    return this.canvasWidth;
  }

  get height(): number {
    return this.canvasHeight;
  }

  get devicePixelRatio(): number {
    return Math.max(1, window.devicePixelRatio);
  }

  measure(): void {
    const dpr = this.devicePixelRatio;
    const newWidth = Math.floor(this.canvas.clientWidth * dpr);
    const previousWidth = this.canvasWidth;

    this.canvasWidth = newWidth;
    this.canvasHeight = Math.floor(this.canvas.clientHeight * dpr);

    if (previousWidth > 0 && newWidth !== previousWidth) {
      this.onWidthChange(newWidth, previousWidth);
    }
  }

  /**
   * Sync the backing-store pixel dimensions to the size measured earlier this
   * frame. Returns true if the backing store was resized.
   */
  syncBackingStore(): boolean {
    if (this.canvas.width !== this.canvasWidth || this.canvas.height !== this.canvasHeight) {
      this.canvas.width = this.canvasWidth;
      this.canvas.height = this.canvasHeight;
      return true;
    }

    return false;
  }
}
