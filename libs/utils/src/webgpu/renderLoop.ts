import { MS_PER_SECOND } from '../date/constants';
import type { GpuContext } from './createGpuContext';
import type { FpsController } from './fpsController';
import { FpsMeter } from './fpsMeter';
import type { FrameState } from './renderLayer';
import type { RenderLayerManager } from './renderLayerManager';

/**
 * Tolerance so a frame isn't skipped when rAF fires a hair early — a 60 fps
 * target (16.67 ms) can be delivered at ~16.5 ms.
 */
const THROTTLE_TOLERANCE_MS = 2;

export interface RenderLoopOptions {
  readonly canvas: HTMLCanvasElement;
  readonly context: GpuContext;
  readonly layerManager: RenderLayerManager;
  /**
   * Optional frame-rate governor. When provided, frames are throttled to its
   * current interval (`getFrameIntervalMs`) and `tick`ed each rAF. When
   * omitted, the loop renders every animation frame.
   */
  readonly fpsController?: FpsController;
  /** Reports rolling render FPS (decays toward 0 while idle). */
  readonly onFpsUpdate?: (fps: number) => void;
  /**
   * Render-on-demand gate, called after `updateAll` and before encoding.
   * Return false to skip submitting this frame (static scene). Requires a
   * `fpsController` to be meaningful — without throttling the loop still
   * spins at display rate, just without submitting.
   */
  readonly shouldRender?: () => boolean;
  /** Fired on every resize — e.g. to raise the fps governor out of idle. */
  readonly onResize?: () => void;
}

/**
 * Single-canvas WebGPU render loop shared by the graphics / sun / stereometry
 * features. Owns canvas-size syncing (device-pixel-content-box where the
 * browser supports it, falling back to clientWidth × dpr), optional FPS
 * throttling + metering, and optional render-on-demand gating.
 *
 * Returns a teardown function that stops the loop and disconnects observers.
 */
export function startRenderLoop(options: RenderLoopOptions): VoidFunction {
  const { canvas, context, layerManager, fpsController, onFpsUpdate, shouldRender, onResize } =
    options;
  const { device, canvasContext } = context;

  let canvasWidth = 0;
  let canvasHeight = 0;
  let currentDpr = Math.max(1, window.devicePixelRatio);

  /** Fallback measurement; forces layout, so only used on observe gaps (mount, DPR change). */
  function measureCanvasSize(): void {
    currentDpr = Math.max(1, window.devicePixelRatio);
    canvasWidth = Math.floor(canvas.clientWidth * currentDpr);
    canvasHeight = Math.floor(canvas.clientHeight * currentDpr);
  }

  measureCanvasSize();

  // Canvas size comes from ResizeObserver entries instead of reading
  // clientWidth/clientHeight every frame (which forces a layout pass).
  const resizeObserver = new ResizeObserver(entries => {
    const entry = entries[entries.length - 1];
    const devicePixelSize = entry.devicePixelContentBoxSize?.[0];
    if (devicePixelSize !== undefined) {
      canvasWidth = devicePixelSize.inlineSize;
      canvasHeight = devicePixelSize.blockSize;
      currentDpr = Math.max(1, window.devicePixelRatio);
    } else {
      measureCanvasSize();
    }
    onResize?.();
  });
  try {
    resizeObserver.observe(canvas, { box: 'device-pixel-content-box' });
  } catch {
    // Safari has no device-pixel-content-box — fall back to the CSS box;
    // size is then derived via devicePixelRatio in the callback.
    resizeObserver.observe(canvas);
  }

  const fpsMeter = onFpsUpdate === undefined ? undefined : new FpsMeter({ onUpdate: onFpsUpdate });

  let animationFrameId = 0;
  let disposed = false;
  let lastFrameTime = 0;
  const startTime = performance.now();

  function frame(now: number): void {
    if (disposed) {
      return;
    }

    if (fpsController !== undefined) {
      fpsController.tick();
      const interval = fpsController.getFrameIntervalMs();
      if (now - lastFrameTime < interval - THROTTLE_TOLERANCE_MS) {
        animationFrameId = requestAnimationFrame(frame);
        return;
      }
    }
    lastFrameTime = now;

    // DPR changes without a box resize (e.g. dragging between monitors) don't
    // fire the ResizeObserver — re-measure when DPR moved.
    if (Math.max(1, window.devicePixelRatio) !== currentDpr) {
      measureCanvasSize();
      onResize?.();
    }

    if (canvasWidth === 0 || canvasHeight === 0) {
      animationFrameId = requestAnimationFrame(frame);
      return;
    }

    if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
    }

    const time = (performance.now() - startTime) / MS_PER_SECOND;
    const state: FrameState = {
      time,
      canvasWidth,
      canvasHeight,
      devicePixelRatio: currentDpr,
    };

    layerManager.updateAll(state);

    // Render-on-demand: skip encoding when nothing changed since the last frame.
    if (shouldRender !== undefined && !shouldRender()) {
      fpsMeter?.report(now, frameInterval(fpsController));
      animationFrameId = requestAnimationFrame(frame);
      return;
    }

    fpsMeter?.tick(now, frameInterval(fpsController));

    const canvasTexture = canvasContext.getCurrentTexture();
    const canvasView = canvasTexture.createView();
    const encoder = device.createCommandEncoder();

    layerManager.renderAll(encoder, canvasView, state);

    device.queue.submit([encoder.finish()]);

    animationFrameId = requestAnimationFrame(frame);
  }

  animationFrameId = requestAnimationFrame(frame);

  return () => {
    disposed = true;
    cancelAnimationFrame(animationFrameId);
    resizeObserver.disconnect();
  };
}

function frameInterval(fpsController: FpsController | undefined): number {
  return fpsController?.getFrameIntervalMs() ?? 0;
}
