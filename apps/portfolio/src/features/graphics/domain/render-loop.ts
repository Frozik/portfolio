import type { RenderLayerManager } from '@frozik/utils';

import { MS_PER_SECOND } from './chart-constants';
import type { FrameState, GpuContext } from './types';

export interface RenderLoopOptions {
  readonly canvas: HTMLCanvasElement;
  readonly context: GpuContext;
  readonly layerManager: RenderLayerManager;
}

export function startRenderLoop(options: RenderLoopOptions): VoidFunction {
  const { canvas, context, layerManager } = options;
  const { device, canvasContext } = context;

  let canvasWidth = 0;
  let canvasHeight = 0;
  let currentDpr = Math.max(1, window.devicePixelRatio);

  function updateCanvasSize(): void {
    currentDpr = Math.max(1, window.devicePixelRatio);
    const width = Math.floor(canvas.clientWidth * currentDpr);
    const height = Math.floor(canvas.clientHeight * currentDpr);

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    canvasWidth = width;
    canvasHeight = height;
  }

  updateCanvasSize();

  const resizeObserver = new ResizeObserver(() => {
    updateCanvasSize();
  });
  resizeObserver.observe(canvas);

  let animationFrameId = 0;
  let disposed = false;
  const startTime = performance.now();

  function frame(): void {
    if (disposed) {
      return;
    }

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
