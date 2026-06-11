import { MS_PER_SECOND } from '@frozik/utils/date/constants';
import type { GpuContext } from '@frozik/utils/webgpu/createGpuContext';
import type { FpsController } from '@frozik/utils/webgpu/fpsController';
import type { FrameState } from '@frozik/utils/webgpu/renderLayer';
import type { RenderLayerManager } from '@frozik/utils/webgpu/renderLayerManager';

import { FPS_RESIZE } from './constants';

/**
 * Tolerance in ms to avoid skipping a frame when rAF fires slightly early.
 * Without this, a 60 fps target (16.67 ms interval) might skip frames
 * when rAF delivers at ~16.5 ms.
 */
const THROTTLE_TOLERANCE_MS = 2;

/** Minimum time window used to compute a stable rolling FPS average */
const MIN_FPS_WINDOW_MS = 1000;

/** How often the FPS value is recalculated and reported */
const FPS_UPDATE_INTERVAL_MS = 250;

export interface RenderLoopOptions {
  readonly canvas: HTMLCanvasElement;
  readonly context: GpuContext;
  readonly layerManager: RenderLayerManager;
  readonly fpsController: FpsController;
  readonly onFpsUpdate?: (fps: number) => void;
  /**
   * Called after layer updates, before encoding. Return false to skip
   * encoding/submitting the frame (render-on-demand for static scenes).
   */
  readonly shouldRender?: () => boolean;
}

export function startRenderLoop(options: RenderLoopOptions): VoidFunction {
  const { canvas, context, layerManager, fpsController, onFpsUpdate, shouldRender } = options;
  const { device, canvasContext } = context;

  let canvasWidth = 0;
  let canvasHeight = 0;
  let currentDpr = Math.max(1, window.devicePixelRatio);

  /** Fallback measurement; forces layout, so it only runs on observe gaps (initial mount, DPR change) */
  function measureCanvasSize(): void {
    currentDpr = Math.max(1, window.devicePixelRatio);
    canvasWidth = Math.floor(canvas.clientWidth * currentDpr);
    canvasHeight = Math.floor(canvas.clientHeight * currentDpr);
  }

  measureCanvasSize();

  // Canvas size comes from ResizeObserver entries instead of reading
  // clientWidth/clientHeight every frame (which forces a layout pass)
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
    fpsController.raise(FPS_RESIZE);
  });
  try {
    resizeObserver.observe(canvas, { box: 'device-pixel-content-box' });
  } catch {
    // Safari does not support device-pixel-content-box observation — fall back
    // to the CSS box; size is then derived via devicePixelRatio in the callback
    resizeObserver.observe(canvas);
  }

  let animationFrameId = 0;
  let disposed = false;
  let lastFrameTime = 0;
  const startTime = performance.now();

  const renderFrameTimes: number[] = [];
  let lastFpsUpdate = 0;

  /** Trims old samples and reports the rolling FPS; also called on skipped frames so the value decays to 0 */
  function reportFps(now: number): void {
    if (now - lastFpsUpdate < FPS_UPDATE_INTERVAL_MS) {
      return;
    }
    lastFpsUpdate = now;

    const fpsWindowMs = Math.max(MIN_FPS_WINDOW_MS, fpsController.getFrameIntervalMs() * 3);
    const cutoff = now - fpsWindowMs;
    while (renderFrameTimes.length > 0 && renderFrameTimes[0] < cutoff) {
      renderFrameTimes.shift();
    }

    const elapsed =
      renderFrameTimes.length > 1
        ? renderFrameTimes[renderFrameTimes.length - 1] - renderFrameTimes[0]
        : 0;
    const fps =
      elapsed > 0 ? Math.round(((renderFrameTimes.length - 1) / elapsed) * MS_PER_SECOND) : 0;
    onFpsUpdate?.(fps);
  }

  function trackRenderFps(now: number): void {
    renderFrameTimes.push(now);
    reportFps(now);
  }

  function frame(now: number): void {
    if (disposed) {
      return;
    }

    fpsController.tick();

    const interval = fpsController.getFrameIntervalMs();
    if (now - lastFrameTime < interval - THROTTLE_TOLERANCE_MS) {
      animationFrameId = requestAnimationFrame(frame);
      return;
    }

    lastFrameTime = now;

    // DPR changes without a box resize (e.g. moving the window between
    // monitors) don't fire the ResizeObserver — re-measure when DPR moved
    if (Math.max(1, window.devicePixelRatio) !== currentDpr) {
      measureCanvasSize();
      fpsController.raise(FPS_RESIZE);
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

    // Render-on-demand: skip encoding when nothing changed since the last frame
    if (shouldRender !== undefined && !shouldRender()) {
      reportFps(now);
      animationFrameId = requestAnimationFrame(frame);
      return;
    }

    trackRenderFps(now);

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
