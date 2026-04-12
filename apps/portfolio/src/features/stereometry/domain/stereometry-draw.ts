import { createGpuContext, createMsaaTextureManager, RenderLayerManager } from '@frozik/utils';

import { PyramidLayer } from './layers/pyramid-layer';
import { PENTAGONAL_PYRAMID } from './puzzles/pentagonal-pyramid';
import { startRenderLoop } from './render-loop';
import type { OrbitalCameraController } from './stereometry-camera-controller';
import { createOrbitalCameraController } from './stereometry-camera-controller';
import { createClickDetector } from './stereometry-click-detector';
import { MSAA_SAMPLE_COUNT } from './stereometry-constants';
import { createTopologyFromPuzzle } from './stereometry-geometry';
import { hitTest } from './stereometry-hit-testing';
import { createInitialScene, toggleLine } from './stereometry-scene';
import type { SelectionState } from './stereometry-types';
import { SELECTION_NONE } from './stereometry-types';

export function runStereometry(canvas: HTMLCanvasElement): {
  destroy: VoidFunction;
  camera: OrbitalCameraController;
} {
  let destroyed = false;
  let gpuCleanup: (() => void) | undefined;

  const topology = createTopologyFromPuzzle(PENTAGONAL_PYRAMID);
  const geometryCenter: readonly [number, number, number] = [0, 0, 0];
  const camera = createOrbitalCameraController(canvas, geometryCenter);

  let pyramidLayerRef: PyramidLayer | undefined;
  let sceneState = createInitialScene(topology);

  function performHitTest(screenX: number, screenY: number): SelectionState {
    if (destroyed || !pyramidLayerRef) {
      return SELECTION_NONE;
    }

    const canvasWidth = canvas.clientWidth;
    const canvasHeight = canvas.clientHeight;
    const devicePixelRatio = Math.max(1, window.devicePixelRatio);

    const intersectionPositions = sceneState.intersections.map(
      intersection => intersection.position
    );

    return hitTest(
      screenX,
      screenY,
      canvasWidth,
      canvasHeight,
      devicePixelRatio,
      pyramidLayerRef.getLastMvpMatrix(),
      topology,
      intersectionPositions
    );
  }

  function onCanvasClick(screenX: number, screenY: number): void {
    const selection = performHitTest(screenX, screenY);
    pyramidLayerRef?.setSelection(selection);
  }

  function onCanvasDoubleClick(screenX: number, screenY: number): void {
    const hit = performHitTest(screenX, screenY);

    if (hit.type === 'edge') {
      sceneState = toggleLine(sceneState, hit.edgeIndex, topology);
      pyramidLayerRef?.applySceneState(sceneState);
    }
  }

  const cleanupClickDetector = createClickDetector(canvas, onCanvasClick, onCanvasDoubleClick);

  void initStereometry(canvas, camera, topology).then(({ cleanup, pyramidLayer }) => {
    if (destroyed) {
      cleanup();
    } else {
      gpuCleanup = cleanup;
      pyramidLayerRef = pyramidLayer;
      pyramidLayer.applySceneState(sceneState);
    }
  });

  return {
    destroy: () => {
      destroyed = true;
      camera.destroy();
      cleanupClickDetector();
      gpuCleanup?.();
    },
    camera,
  };
}

async function initStereometry(
  canvas: HTMLCanvasElement,
  camera: ReturnType<typeof createOrbitalCameraController>,
  topology: ReturnType<typeof createTopologyFromPuzzle>
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
