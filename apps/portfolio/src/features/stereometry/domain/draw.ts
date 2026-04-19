import {
  assertNever,
  createGpuContext,
  createMsaaTextureManager,
  FpsController,
  RenderLayerManager,
} from '@frozik/utils';
import { vec3 } from 'wgpu-matrix';
import type { OrbitalCameraController } from './camera-controller';
import { createOrbitalCameraController } from './camera-controller';
import { createClickDetector } from './click-detector';
import { FPS_IDLE, FPS_INTERACTION, MSAA_SAMPLE_COUNT } from './constants';
import type { InitialDragHit } from './drag-connector';
import { createDragToConnectController } from './drag-connector';
import { preparePuzzle } from './geometry';
import { createSceneHistory } from './history';
import type { AllowedHitTypes, SceneHit } from './hit-testing';
import { hitTestScene } from './hit-testing';
import { IntersectionCache } from './intersection';
import { SceneLayer } from './layers/scene-layer';
import { startRenderLoop } from './render-loop';
import { buildRepresentation } from './representation';
import { computeSolutionStatus } from './solution-check';
import {
  addLine,
  collapseExtendedLine,
  createTopologyFromPuzzle,
  extendToLine,
  removeLine,
} from './topology';
import type { FigureTopology, SceneTopology, SelectionState, Vec3Array } from './topology-types';
import { SELECTION_NONE } from './topology-types';
import type { PuzzleDefinition } from './types';

const SNAP_ALLOWED_TYPES: AllowedHitTypes = ['vertex'];

export interface StereometryControls {
  destroy: VoidFunction;
  camera: OrbitalCameraController;
  undo: () => void;
  redo: () => void;
  subscribeHistory: (listener: (canUndo: boolean, canRedo: boolean) => void) => VoidFunction;
  subscribeFps: (listener: (fps: number) => void) => VoidFunction;
}

export function runStereometry(
  canvas: HTMLCanvasElement,
  puzzle: PuzzleDefinition
): StereometryControls {
  let destroyed = false;
  let gpuCleanup: (() => void) | undefined;

  const { topology: figureTopology } = preparePuzzle(puzzle);
  const camera = createOrbitalCameraController(canvas, puzzle.camera);
  const fpsController = new FpsController(FPS_IDLE);

  const intersectionCache = new IntersectionCache();

  let sceneLayerReference: SceneLayer | undefined;
  let sceneTopology = createTopologyFromPuzzle(figureTopology, puzzle.input, intersectionCache);
  let currentSelection: SelectionState = SELECTION_NONE;
  let currentPreviewLine: { readonly pointA: Vec3Array; readonly pointB: Vec3Array } | undefined;

  const history = createSceneHistory();
  const historyListeners = new Set<(canUndo: boolean, canRedo: boolean) => void>();
  const fpsListeners = new Set<(fps: number) => void>();

  function notifyHistoryListeners(): void {
    for (const listener of historyListeners) {
      listener(history.canUndo(), history.canRedo());
    }
  }

  /** Applies the representation to the scene layer */
  function applyToSceneLayer(topology: SceneTopology): void {
    const solutionStatus = computeSolutionStatus(puzzle.expected, topology);
    const representation = buildRepresentation(
      figureTopology,
      topology.lines,
      topology.vertices,
      currentSelection,
      currentPreviewLine,
      solutionStatus
    );

    sceneLayerReference?.applySceneState(representation);
  }

  /** Applies a new topology state, saving the previous one to history. */
  function applyTopologyChange(newTopology: SceneTopology): void {
    history.push(sceneTopology);
    sceneTopology = newTopology;
    applyToSceneLayer(sceneTopology);
    notifyHistoryListeners();
  }

  interface HitTestContext {
    readonly canvasWidth: number;
    readonly canvasHeight: number;
    readonly devicePixelRatio: number;
    readonly mvpMatrix: Float32Array;
  }

  function getHitTestContext(): HitTestContext | undefined {
    if (destroyed || !sceneLayerReference) {
      return undefined;
    }

    return {
      canvasWidth: canvas.clientWidth,
      canvasHeight: canvas.clientHeight,
      devicePixelRatio: Math.max(1, window.devicePixelRatio),
      mvpMatrix: sceneLayerReference.getLastMvpMatrix(),
    };
  }

  function performSceneHitTest(
    screenX: number,
    screenY: number,
    allowedTypes?: AllowedHitTypes
  ): SceneHit | undefined {
    const context = getHitTestContext();
    if (context === undefined) {
      return undefined;
    }

    return hitTestScene(
      screenX,
      screenY,
      context.canvasWidth,
      context.canvasHeight,
      context.devicePixelRatio,
      context.mvpMatrix,
      sceneTopology.lines,
      sceneTopology.vertices.map(vertex => vertex.position),
      allowedTypes
    );
  }

  function performHitTest(screenX: number, screenY: number): SelectionState {
    const hit = performSceneHitTest(screenX, screenY);
    if (hit?.type === 'line') {
      return { type: 'line', lineId: hit.lineId };
    }
    return SELECTION_NONE;
  }

  function performInitialHitTest(screenX: number, screenY: number): InitialDragHit | undefined {
    const hit = performSceneHitTest(screenX, screenY);
    if (hit === undefined) {
      return undefined;
    }
    if (hit.type === 'vertex') {
      return { kind: 'vertex', position: hit.position };
    }
    const sourceLine = sceneTopology.lines.find(candidate => candidate.lineId === hit.lineId);
    if (sourceLine === undefined) {
      return undefined;
    }
    const direction = vec3.sub(sourceLine.pointB, sourceLine.pointA);
    return {
      kind: 'line',
      lineId: hit.lineId,
      direction: [direction[0], direction[1], direction[2]],
      planeAnchor: sourceLine.pointA,
    };
  }

  /** Vertex-only hit test used during drag-to-connect — lines are ignored. */
  function performSnapHitTest(screenX: number, screenY: number): Vec3Array | undefined {
    const hit = performSceneHitTest(screenX, screenY, SNAP_ALLOWED_TYPES);
    return hit?.type === 'vertex' ? hit.position : undefined;
  }

  function setSelection(selection: SelectionState): void {
    currentSelection = selection;
    // Re-apply to rebuild StyledSegments with updated selection
    applyToSceneLayer(sceneTopology);
  }

  /**
   * Returns the direction vector of the currently selected line.
   * Returns undefined if nothing is selected.
   */
  function getSelectedDirection(): Vec3Array | undefined {
    switch (currentSelection.type) {
      case 'line': {
        const selectedLineId = currentSelection.lineId;
        const line = sceneTopology.lines.find(candidate => candidate.lineId === selectedLineId);
        if (line === undefined) {
          return undefined;
        }
        return vec3.sub(line.pointB, line.pointA);
      }
      case 'none':
        return undefined;
      default:
        assertNever(currentSelection);
    }
  }

  function onCanvasClick(screenX: number, screenY: number): void {
    const selection = performHitTest(screenX, screenY);
    setSelection(selection);
  }

  function handleLineDoubleTap(lineId: number): void {
    const line = sceneTopology.lines.find(candidate => candidate.lineId === lineId);
    if (line === undefined) {
      return;
    }

    currentSelection = SELECTION_NONE;

    switch (line.kind) {
      case 'edge':
      case 'segment':
        applyTopologyChange(extendToLine(sceneTopology, lineId, figureTopology, intersectionCache));
        break;
      case 'edge-extended':
      case 'segment-extended':
        applyTopologyChange(
          collapseExtendedLine(sceneTopology, lineId, figureTopology, intersectionCache)
        );
        break;
      case 'line':
        applyTopologyChange(removeLine(sceneTopology, lineId, figureTopology, intersectionCache));
        break;
      default:
        assertNever(line.kind);
    }
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
    performInitialHitTest,
    performSnapHitTest,
    hasActiveSelection: () => currentSelection.type !== 'none',
    isLineSelected: lineId =>
      currentSelection.type === 'line' && currentSelection.lineId === lineId,
    onDragStart: () => {
      // Don't clear selection here -- onVertexTap needs it to create parallel lines
    },
    onDragUpdate: preview => {
      sceneLayerReference?.setDragPreview(preview);
      currentPreviewLine = sceneLayerReference?.getPreviewLine();
      applyToSceneLayer(sceneTopology);
    },
    onLineTap: lineId => setSelection({ type: 'line', lineId }),
    onLineDoubleTap: handleLineDoubleTap,
    onVertexTap: vertexPosition => {
      const direction = getSelectedDirection();

      if (direction !== undefined) {
        const endPosition: Vec3Array = [
          vertexPosition[0] + direction[0],
          vertexPosition[1] + direction[1],
          vertexPosition[2] + direction[2],
        ];
        applyTopologyChange(
          addLine(sceneTopology, vertexPosition, endPosition, figureTopology, intersectionCache)
        );
      }

      setSelection(SELECTION_NONE);
    },
    onDragComplete: (startPosition, endPosition) => {
      applyTopologyChange(
        addLine(sceneTopology, startPosition, endPosition, figureTopology, intersectionCache)
      );
      setSelection(SELECTION_NONE);
    },
    onSecondPointer: (pointerId, clientX, clientY) => {
      camera.registerExternalPointer(pointerId, clientX, clientY);
    },
  });

  const onFpsUpdate = (fps: number): void => {
    for (const listener of fpsListeners) {
      listener(fps);
    }
  };

  void initStereometry(canvas, camera, figureTopology, puzzle, fpsController, onFpsUpdate).then(
    ({ cleanup, sceneLayer }) => {
      if (destroyed) {
        cleanup();
      } else {
        gpuCleanup = cleanup;
        sceneLayerReference = sceneLayer;
        applyToSceneLayer(sceneTopology);
      }
    }
  );

  function restoreState(state: SceneTopology | undefined): void {
    if (state === undefined) {
      return;
    }
    sceneTopology = state;
    applyToSceneLayer(sceneTopology);
    setSelection(SELECTION_NONE);
    notifyHistoryListeners();
  }

  return {
    destroy: () => {
      destroyed = true;
      camera.destroy();
      fpsController.dispose();
      canvas.removeEventListener('pointerdown', raiseInteractionFps);
      canvas.removeEventListener('pointermove', raiseInteractionFps);
      canvas.removeEventListener('wheel', raiseInteractionFps);
      cleanupClickDetector();
      cleanupDragConnector();
      historyListeners.clear();
      fpsListeners.clear();
      gpuCleanup?.();
    },
    camera,
    undo: () => restoreState(history.undo(sceneTopology)),
    redo: () => restoreState(history.redo(sceneTopology)),
    subscribeHistory: listener => {
      historyListeners.add(listener);
      listener(history.canUndo(), history.canRedo());
      return () => historyListeners.delete(listener);
    },
    subscribeFps: listener => {
      fpsListeners.add(listener);
      return () => fpsListeners.delete(listener);
    },
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
