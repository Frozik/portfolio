import { createGpuContext } from '@frozik/utils/webgpu/createGpuContext';
import { FpsController } from '@frozik/utils/webgpu/fpsController';
import { createMsaaTextureManager } from '@frozik/utils/webgpu/msaaTextureManager';
import { RenderLayerManager } from '@frozik/utils/webgpu/renderLayerManager';
import { startRenderLoop } from '@frozik/utils/webgpu/renderLoop';
import { runGpuApp } from '@frozik/utils/webgpu/runGpuApp';
import { FPS_IDLE, FPS_INTERACTION, FPS_RESIZE, MSAA_SAMPLE_COUNT } from '../../domain/constants';
import { preparePuzzle } from '../../domain/geometry';
import type { FigureTopology } from '../../domain/topology-types';
import type { PuzzleDefinition } from '../../domain/types';
import type { OrbitalCameraController } from '../../infrastructure/camera-controller';
import { createOrbitalCameraController } from '../../infrastructure/camera-controller';
import { createClickDetector } from '../../infrastructure/click-detector';
import { createDragToConnectController } from '../../infrastructure/drag-connector';
import { SceneLayer } from '../../infrastructure/layers/scene-layer';
import { createSceneHitTester } from '../scene-hit-tester';
import { createSceneStateController } from '../scene-state-controller';

export interface IStereometryRunParams {
  readonly canvas: HTMLCanvasElement;
  readonly puzzle: PuzzleDefinition;
  readonly onHistoryChange: (canUndo: boolean, canRedo: boolean) => void;
  readonly onFpsUpdate: (fps: number) => void;
}

export interface StereometryControls {
  destroy: VoidFunction;
  camera: OrbitalCameraController;
  undo: VoidFunction;
  redo: VoidFunction;
}

/**
 * Wires the stereometry session together: scene state, hit testing, pointer
 * controllers and the WebGPU render loop. Holds no scene state of its own —
 * it only connects the pieces and owns their teardown.
 */
export function runStereometry(params: IStereometryRunParams): StereometryControls {
  const { canvas, puzzle, onHistoryChange, onFpsUpdate } = params;

  let sceneLayerReference: SceneLayer | undefined;

  const { topology: figureTopology } = preparePuzzle(puzzle);
  const camera = createOrbitalCameraController(canvas, puzzle.camera);
  const fpsController = new FpsController(FPS_IDLE);

  const sceneState = createSceneStateController({ puzzle, figureTopology, onHistoryChange });

  const hitTester = createSceneHitTester({
    canvas,
    getTopology: sceneState.getTopology,
    getMvpMatrix: () => sceneLayerReference?.getLastMvpMatrix(),
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

  // Double-click detection for lines now lives in the drag-connector — the
  // click-detector's double-click callback is kept only for potential
  // empty-canvas gestures; today it does nothing.
  const cleanupClickDetector = createClickDetector(canvas, onCanvasClick, () => {});

  const cleanupDragConnector = createDragToConnectController(canvas, {
    performInitialHitTest: hitTester.hitTestDragStart,
    performSnapHitTest: hitTester.hitTestSnapVertex,
    hasActiveSelection: sceneState.hasSelection,
    isLineSelected: sceneState.isLineSelected,
    onDragStart: () => {
      // Don't clear selection here -- onVertexTap needs it to create parallel lines
    },
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
    init: () => initStereometry(canvas, camera, figureTopology, puzzle, fpsController, onFpsUpdate),
    onReady: ({ sceneLayer }) => {
      sceneLayerReference = sceneLayer;
      sceneState.attachRenderer(sceneLayer);
    },
    initErrorMessage: 'Failed to initialize stereometry renderer',
  });

  return {
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
    camera,
    undo: sceneState.undo,
    redo: sceneState.redo,
  };
}

async function initStereometry(
  canvas: HTMLCanvasElement,
  camera: ReturnType<typeof createOrbitalCameraController>,
  figureTopology: FigureTopology,
  puzzle: PuzzleDefinition,
  fpsController: FpsController,
  onFpsUpdate: (fps: number) => void
): Promise<{ cleanup: VoidFunction; sceneLayer: SceneLayer }> {
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
