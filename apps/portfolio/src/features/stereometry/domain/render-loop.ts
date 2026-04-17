import type { FpsController, FrameState, GpuContext, RenderLayerManager } from '@frozik/utils';
import { MS_PER_SECOND } from '@frozik/utils';

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
}

export function startRenderLoop(options: RenderLoopOptions): VoidFunction {
  const { canvas, context, layerManager, fpsController, onFpsUpdate } = options;
  const { device, canvasContext } = context;

  let canvasWidth = 0;
  let canvasHeight = 0;
  let currentDpr = Math.max(1, window.devicePixelRatio);

  function updateCanvasSize(): boolean {
    currentDpr = Math.max(1, window.devicePixelRatio);
    const width = Math.floor(canvas.clientWidth * currentDpr);
    const height = Math.floor(canvas.clientHeight * currentDpr);

    const changed = canvas.width !== width || canvas.height !== height;

    if (changed) {
      canvas.width = width;
      canvas.height = height;
    }

    canvasWidth = width;
    canvasHeight = height;

    return changed;
  }

  updateCanvasSize();

  const resizeObserver = new ResizeObserver(() => {
    updateCanvasSize();
    fpsController.raise(FPS_RESIZE);
  });
  resizeObserver.observe(canvas);

  let animationFrameId = 0;
  let disposed = false;
  let lastFrameTime = 0;
  const startTime = performance.now();

  const renderFrameTimes: number[] = [];
  let lastFpsUpdate = 0;

  function trackRenderFps(now: number): void {
    const fpsWindowMs = Math.max(MIN_FPS_WINDOW_MS, fpsController.getFrameIntervalMs() * 3);

    renderFrameTimes.push(now);

    const cutoff = now - fpsWindowMs;
    while (renderFrameTimes.length > 0 && renderFrameTimes[0] < cutoff) {
      renderFrameTimes.shift();
    }

    if (now - lastFpsUpdate >= FPS_UPDATE_INTERVAL_MS) {
      lastFpsUpdate = now;
      const elapsed =
        renderFrameTimes.length > 1
          ? renderFrameTimes[renderFrameTimes.length - 1] - renderFrameTimes[0]
          : 0;
      const fps =
        elapsed > 0 ? Math.round(((renderFrameTimes.length - 1) / elapsed) * MS_PER_SECOND) : 0;
      onFpsUpdate?.(fps);
    }
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

    trackRenderFps(now);

    updateCanvasSize();

    if (canvasWidth === 0 || canvasHeight === 0) {
      animationFrameId = requestAnimationFrame(frame);
      return;
    }

    const time = (performance.now() - startTime) / MS_PER_SECOND;

    const state: FrameState = {
      time,
      canvasWidth,
      canvasHeight,
      devicePixelRatio: currentDpr,
    };

    layerManager.updateAll(state);

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
