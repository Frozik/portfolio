import { createGpuContext } from '@frozik/utils/webgpu/createGpuContext';
import { FpsController } from '@frozik/utils/webgpu/fpsController';
import { createMsaaTextureManager } from '@frozik/utils/webgpu/msaaTextureManager';
import { RenderLayerManager } from '@frozik/utils/webgpu/renderLayerManager';
import { startRenderLoop } from '@frozik/utils/webgpu/renderLoop';
import { runGpuApp } from '@frozik/utils/webgpu/runGpuApp';
import {
  computeMvpMatrix,
  computeProjectionMatrix,
  viewportAspect,
} from '../../domain/camera-projection';
import { FPS_IDLE, FPS_INTERACTION, FPS_RESIZE, MSAA_SAMPLE_COUNT } from '../../domain/constants';
import { preparePuzzle } from '../../domain/geometry';
import type { FigureTopology } from '../../domain/topology-types';
import type { CameraInteractionMode, PuzzleDefinition } from '../../domain/types';
import type { OrbitalCameraController } from '../../infrastructure/camera-controller';
import { createOrbitalCameraController } from '../../infrastructure/camera-controller';
import { createClickDetector } from '../../infrastructure/click-detector';
import { createDragToConnectController } from '../../infrastructure/drag-connector';
import { SceneLayer } from '../../infrastructure/layers/scene-layer';
import { createSceneHitTester } from '../scene-hit-tester';
import type { SceneHistoryState } from '../scene-state-controller';
import { createSceneStateController } from '../scene-state-controller';

export interface IStereometryRunParams {
  readonly canvas: HTMLCanvasElement;
  readonly puzzle: PuzzleDefinition;
  /** The camera asks its owner which gesture a drag means; the mode lives in the store alone. */
  readonly getInteractionMode: () => CameraInteractionMode;
  readonly onFpsUpdate: (fps: number) => void;
}

export interface StereometryControls {
  readonly destroy: VoidFunction;
  readonly history: SceneHistoryState;
  readonly undo: VoidFunction;
  readonly redo: VoidFunction;
}

/**
 * Wires the stereometry session together: scene state, hit testing, pointer
 * controllers and the WebGPU render loop. Holds no scene state of its own —
 * it only connects the pieces and owns their teardown.
 */
export function runStereometry(params: IStereometryRunParams): StereometryControls {
  const { canvas, puzzle, getInteractionMode, onFpsUpdate } = params;

  let sceneLayerReference: SceneLayer | undefined;

  const { topology: figureTopology } = preparePuzzle(puzzle);
  const camera = createOrbitalCameraController(canvas, puzzle.camera, getInteractionMode);
  const fpsController = new FpsController(FPS_IDLE);
  const projection = puzzle.camera?.projection ?? 'perspective';

  const sceneState = createSceneStateController({ puzzle, figureTopology });

  const hitTester = createSceneHitTester({
    canvas,
    getTopology: sceneState.getTopology,
    getMvpMatrix: () =>
      computeMvpMatrix(
        computeProjectionMatrix(
          projection,
          viewportAspect(canvas.clientWidth, canvas.clientHeight),
          camera.getDistance()
        ),
        camera.getViewMatrix()
      ),
  });

  function onCanvasClick(screenX: number, screenY: number): void {
    sceneState.setSelection(hitTester.hitTestSelection(screenX, screenY));
  }

  function raiseInteractionFps(): void {
    fpsController.raise(FPS_INTERACTION);
  }

  canvas.addEventListener('pointerdown', raiseInteractionFps);
  canvas.addEventListener('pointermove', raiseInteractionFps);
  canvas.addEventListener('wheel', raiseInteractionFps);

  const cleanupClickDetector = createClickDetector(canvas, onCanvasClick);

  const cleanupDragConnector = createDragToConnectController(canvas, {
    performInitialHitTest: hitTester.hitTestDragStart,
    performSnapHitTest: hitTester.hitTestSnapVertex,
    hasActiveSelection: sceneState.hasSelection,
    isLineSelected: sceneState.isLineSelected,
    onDragUpdate: preview => {
      sceneLayerReference?.setDragPreview(preview);
      sceneState.setPreviewLine(sceneLayerReference?.getPreviewLine());
    },
    onLineTap: lineId => sceneState.setSelection({ type: 'line', lineId }),
    onLineDoubleTap: sceneState.toggleLineExtension,
    onVertexTap: sceneState.createParallelLineAtVertex,
    onDragComplete: sceneState.connectVertices,
    onSecondPointer: (pointerId, clientX, clientY) => {
      camera.registerExternalPointer(pointerId, clientX, clientY);
    },
  });

  const stopGpuApp = runGpuApp({
    init: () =>
      initStereometry({ canvas, camera, figureTopology, puzzle, fpsController, onFpsUpdate }),
    onReady: ({ sceneLayer }) => {
      sceneLayerReference = sceneLayer;
      sceneState.attachRenderer(sceneLayer);
    },
    initErrorMessage: 'Failed to initialize stereometry renderer',
  });

  return {
    history: sceneState.history,
    destroy: () => {
      sceneLayerReference = undefined;
      camera.destroy();
      fpsController.dispose();
      canvas.removeEventListener('pointerdown', raiseInteractionFps);
      canvas.removeEventListener('pointermove', raiseInteractionFps);
      canvas.removeEventListener('wheel', raiseInteractionFps);
      cleanupClickDetector();
      cleanupDragConnector();
      stopGpuApp();
    },
    undo: sceneState.undo,
    redo: sceneState.redo,
  };
}

async function initStereometry({
  canvas,
  camera,
  figureTopology,
  puzzle,
  fpsController,
  onFpsUpdate,
}: {
  readonly canvas: HTMLCanvasElement;
  readonly camera: OrbitalCameraController;
  readonly figureTopology: FigureTopology;
  readonly puzzle: PuzzleDefinition;
  readonly fpsController: FpsController;
  readonly onFpsUpdate: (fps: number) => void;
}): Promise<{ readonly cleanup: VoidFunction; readonly sceneLayer: SceneLayer }> {
  const context = await createGpuContext(canvas);

  const msaaManager = createMsaaTextureManager(MSAA_SAMPLE_COUNT);
  const sceneCenter = puzzle.camera?.center ?? [0, 0, 0];
  const sceneProjection = puzzle.camera?.projection ?? 'perspective';
  const sceneLayer = new SceneLayer(
    camera,
    msaaManager,
    figureTopology,
    fpsController,
    sceneCenter,
    sceneProjection
  );

  const layerManager = new RenderLayerManager([sceneLayer]);

  layerManager.initAll(context);

  const stopRenderLoop = startRenderLoop({
    canvas,
    context,
    layerManager,
    fpsController,
    onFpsUpdate,
    shouldRender: () => sceneLayer.consumeDirty(),
    onResize: () => fpsController.raise(FPS_RESIZE),
  });

  return {
    cleanup: () => {
      stopRenderLoop();
      layerManager.dispose();
      msaaManager.dispose();
      context.device.destroy();
    },
    sceneLayer,
  };
}
