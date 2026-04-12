import { createGpuContext, createMsaaTextureManager, RenderLayerManager } from '@frozik/utils';

import { PyramidLayer } from './layers/pyramid-layer';
import { startRenderLoop } from './render-loop';
import { createOrbitalCameraController } from './stereometry-camera-controller';
import { createClickDetector } from './stereometry-click-detector';
import { MSAA_SAMPLE_COUNT } from './stereometry-constants';
import { createPyramidTopology } from './stereometry-geometry';
import { hitTest } from './stereometry-hit-testing';
import type { SelectionState } from './stereometry-types';
import { SELECTION_NONE } from './stereometry-types';

export function runStereometry(canvas: HTMLCanvasElement): VoidFunction {
  let destroyed = false;
  let gpuCleanup: (() => void) | undefined;

  const camera = createOrbitalCameraController(canvas);
  const topology = createPyramidTopology();

  let pyramidLayerRef: PyramidLayer | undefined;
  const extendedEdges = new Set<number>();

  function performHitTest(screenX: number, screenY: number): SelectionState {
    if (destroyed || !pyramidLayerRef) {
      return SELECTION_NONE;
    }

    const canvasWidth = canvas.clientWidth;
    const canvasHeight = canvas.clientHeight;
    const devicePixelRatio = Math.max(1, window.devicePixelRatio);

    return hitTest(
      screenX,
      screenY,
      canvasWidth,
      canvasHeight,
      devicePixelRatio,
      pyramidLayerRef.getLastMvpMatrix(),
      topology
    );
  }

  function onCanvasClick(screenX: number, screenY: number): void {
    const selection = performHitTest(screenX, screenY);
    pyramidLayerRef?.setSelection(selection);
  }

  function onCanvasDoubleClick(screenX: number, screenY: number): void {
    const hit = performHitTest(screenX, screenY);

    if (hit.type === 'edge') {
      if (extendedEdges.has(hit.edgeIndex)) {
        extendedEdges.delete(hit.edgeIndex);
      } else {
        extendedEdges.add(hit.edgeIndex);
      }
      pyramidLayerRef?.setExtendedLines(extendedEdges);
    }
  }

  const cleanupClickDetector = createClickDetector(canvas, onCanvasClick, onCanvasDoubleClick);

  void initStereometry(canvas, camera, topology).then(({ cleanup, pyramidLayer }) => {
    if (destroyed) {
      cleanup();
    } else {
      gpuCleanup = cleanup;
      pyramidLayerRef = pyramidLayer;
    }
  });

  return () => {
    destroyed = true;
    camera.destroy();
    cleanupClickDetector();
    gpuCleanup?.();
  };
}

async function initStereometry(
  canvas: HTMLCanvasElement,
  camera: ReturnType<typeof createOrbitalCameraController>,
  topology: ReturnType<typeof createPyramidTopology>
): Promise<{ cleanup: VoidFunction; pyramidLayer: PyramidLayer }> {
  const context = await createGpuContext(canvas);

  const msaaManager = createMsaaTextureManager(MSAA_SAMPLE_COUNT);
  const pyramidLayer = new PyramidLayer(camera, msaaManager, topology);

  const layerManager = new RenderLayerManager([pyramidLayer]);

  layerManager.initAll(context);

  const stopRenderLoop = startRenderLoop({
    canvas,
    context,
    layerManager,
  });

  return {
    cleanup: () => {
      stopRenderLoop();
      layerManager.dispose();
      msaaManager.dispose();
      context.device.destroy();
    },
    pyramidLayer,
  };
}
