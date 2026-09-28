/**
 * Tracks the device-pixel size shared by the stacked canvases of a chart.
 *
 * `measure()` reads the CSS box of the first canvas once per frame; every
 * consumer then reuses the cached numbers instead of re-reading
 * `clientWidth`/`clientHeight`, which would force an extra layout flush.
 * Width changes are reported to the owner so it can react (the chart springs
 * its time axis).
 */
export class CanvasSizeTracker {
  private canvasWidth = 0;
  private canvasHeight = 0;

  constructor(
    private readonly canvases: readonly [HTMLCanvasElement, ...HTMLCanvasElement[]],
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
    const [measuredCanvas] = this.canvases;
    const newWidth = Math.floor(measuredCanvas.clientWidth * dpr);
    const previousWidth = this.canvasWidth;

    this.canvasWidth = newWidth;
    this.canvasHeight = Math.floor(measuredCanvas.clientHeight * dpr);

    if (previousWidth > 0 && newWidth !== previousWidth) {
      this.onWidthChange(newWidth, previousWidth);
    }
  }

  /**
   * Sync the backing store of every canvas to the size measured earlier this
   * frame, all in one frame so the layers never disagree. Returns true if
   * they were resized, which also clears them.
   */
  syncBackingStore(): boolean {
    const [measuredCanvas] = this.canvases;
    if (measuredCanvas.width === this.canvasWidth && measuredCanvas.height === this.canvasHeight) {
      return false;
    }

    for (const canvas of this.canvases) {
      canvas.width = this.canvasWidth;
      canvas.height = this.canvasHeight;
    }
    return true;
  }
}
