import { createGpuContext, createMsaaTextureManager, RenderLayerManager } from '@frozik/utils';
import type { OrbitalCameraController } from './camera-controller';
import { createOrbitalCameraController } from './camera-controller';
import { createClickDetector } from './click-detector';
import { MSAA_SAMPLE_COUNT, STEREOMETRY_STYLES } from './constants';
import { createDragToConnectController } from './drag-connector';
import { EFpsLevel, FpsController } from './fps-controller';
import { preparePuzzle } from './geometry';
import { createSceneHistory } from './history';
import { hitTest, hitTestVertex } from './hit-testing';
import { SceneLayer } from './layers/scene-layer';
import type { Vec3 } from './math';
import { subtractVec3 } from './math';
import { PENTAGONAL_PYRAMID } from './puzzles/pentagonal-pyramid';
import { startRenderLoop } from './render-loop';
import { addLine, createInitialScene, removeLine, toggleLine } from './scene';
import { processSegments } from './segment-processor';
import { hexToRgb, resolveStyle } from './styles-processor';
import type {
  FigureTopology,
  LineInstanceStyle,
  ProcessedSegment,
  ResolvedElementStyle,
  SceneLine,
  SceneState,
  SelectionState,
  StyledSegment,
} from './types';
import { SELECTION_NONE } from './types';

export interface StereometryControls {
  destroy: VoidFunction;
  camera: OrbitalCameraController;
  undo: () => void;
  redo: () => void;
  subscribeHistory: (listener: (canUndo: boolean, canRedo: boolean) => void) => VoidFunction;
  subscribeFps: (listener: (fps: number) => void) => VoidFunction;
}

export function runStereometry(canvas: HTMLCanvasElement): StereometryControls {
  let destroyed = false;
  let gpuCleanup: (() => void) | undefined;

  const { topology } = preparePuzzle(PENTAGONAL_PYRAMID);
  const camera = createOrbitalCameraController(canvas, PENTAGONAL_PYRAMID.camera);
  const fpsController = new FpsController();

  let sceneLayerReference: SceneLayer | undefined;
  let sceneState = createInitialScene(topology);
  let currentSelection: SelectionState = SELECTION_NONE;
  let currentPreviewLine: SceneLine | undefined;

  const history = createSceneHistory();
  const historyListeners = new Set<(canUndo: boolean, canRedo: boolean) => void>();
  const fpsListeners = new Set<(fps: number) => void>();

  function notifyHistoryListeners(): void {
    for (const listener of historyListeners) {
      listener(history.canUndo(), history.canRedo());
    }
  }

  /** Applies processed segments to the scene layer */
  function applyToSceneLayer(state: SceneState): void {
    const allSegments = processSegments(
      topology,
      state.lines,
      currentSelection,
      currentPreviewLine
    );

    const styledSegments = allSegments.map(segment => toStyledSegment(segment));

    sceneLayerReference?.applySceneState(state, styledSegments, currentSelection);
  }

  /** Applies a new scene state, saving the previous one to history. */
  function applySceneChange(newState: SceneState): void {
    history.push(sceneState);
    sceneState = newState;
    applyToSceneLayer(sceneState);
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

  function performHitTest(screenX: number, screenY: number): SelectionState {
    const context = getHitTestContext();
    if (context === undefined) {
      return SELECTION_NONE;
    }

    return hitTest(
      screenX,
      screenY,
      context.canvasWidth,
      context.canvasHeight,
      context.devicePixelRatio,
      context.mvpMatrix,
      topology.edges,
      topology.vertices,
      sceneState.lines
    );
  }

  function performPointHitTest(
    screenX: number,
    screenY: number
  ): readonly [number, number, number] | undefined {
    const context = getHitTestContext();
    if (context === undefined) {
      return undefined;
    }

    const allPositions = sceneState.vertices.map(vertex => vertex.position);

    const vertexIndex = hitTestVertex(
      screenX,
      screenY,
      context.canvasWidth,
      context.canvasHeight,
      context.devicePixelRatio,
      context.mvpMatrix,
      allPositions
    );

    if (vertexIndex !== undefined) {
      return allPositions[vertexIndex];
    }

    return undefined;
  }

  function setSelection(selection: SelectionState): void {
    currentSelection = selection;
    // Re-apply scene state to rebuild StyledSegments with updated selection
    applyToSceneLayer(sceneState);
  }

  /**
   * Returns the direction vector of the currently selected edge or line.
   * Returns undefined if nothing is selected.
   */
  function getSelectedDirection(): Vec3 | undefined {
    switch (currentSelection.type) {
      case 'edge': {
        const [vertexIndexA, vertexIndexB] = topology.edges[currentSelection.edgeIndex];
        return subtractVec3(topology.vertices[vertexIndexB], topology.vertices[vertexIndexA]);
      }
      case 'line': {
        const line = sceneState.lines[currentSelection.lineIndex];
        return subtractVec3(line.pointB, line.pointA);
      }
      case 'none':
        return undefined;
    }
  }

  function onCanvasClick(screenX: number, screenY: number): void {
    const selection = performHitTest(screenX, screenY);
    setSelection(selection);
  }

  function onCanvasDoubleClick(screenX: number, screenY: number): void {
    const hit = performHitTest(screenX, screenY);

    if (hit.type === 'edge') {
      currentSelection = SELECTION_NONE;
      applySceneChange(toggleLine(sceneState, hit.edgeIndex, topology));
    } else if (hit.type === 'line') {
      currentSelection = SELECTION_NONE;
      applySceneChange(removeLine(sceneState, hit.lineIndex, topology));
    }
  }

  function raiseInteractionFps(): void {
    fpsController.raise(EFpsLevel.Interaction);
  }

  canvas.addEventListener('pointerdown', raiseInteractionFps);
  canvas.addEventListener('pointermove', raiseInteractionFps);
  canvas.addEventListener('wheel', raiseInteractionFps);

  const cleanupClickDetector = createClickDetector(canvas, onCanvasClick, onCanvasDoubleClick);

  const cleanupDragConnector = createDragToConnectController(canvas, {
    performPointHitTest,
    onDragStart: () => {
      // Don't clear selection here — onVertexTap needs it to create parallel lines
    },
    onDragUpdate: preview => {
      sceneLayerReference?.setDragPreview(preview);
      currentPreviewLine = sceneLayerReference?.getPreviewLine();
      applyToSceneLayer(sceneState);
    },
    onVertexTap: vertexPosition => {
      const direction = getSelectedDirection();

      if (direction !== undefined) {
        const endPosition: Vec3 = [
          vertexPosition[0] + direction[0],
          vertexPosition[1] + direction[1],
          vertexPosition[2] + direction[2],
        ];
        applySceneChange(addLine(sceneState, vertexPosition, endPosition, topology));
      }

      setSelection(SELECTION_NONE);
    },
    onDragComplete: (startPosition, endPosition) => {
      applySceneChange(addLine(sceneState, startPosition, endPosition, topology));
      setSelection(SELECTION_NONE);
    },
  });

  const onFpsUpdate = (fps: number): void => {
    for (const listener of fpsListeners) {
      listener(fps);
    }
  };

  void initStereometry(canvas, camera, topology, fpsController, onFpsUpdate).then(
    ({ cleanup, sceneLayer }) => {
      if (destroyed) {
        cleanup();
      } else {
        gpuCleanup = cleanup;
        sceneLayerReference = sceneLayer;
        applyToSceneLayer(sceneState);
      }
    }
  );

  function restoreState(state: SceneState | undefined): void {
    if (state === undefined) {
      return;
    }
    sceneState = state;
    applyToSceneLayer(sceneState);
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
    undo: () => restoreState(history.undo(sceneState)),
    redo: () => restoreState(history.redo(sceneState)),
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
  topology: FigureTopology,
  fpsController: FpsController,
  onFpsUpdate: (fps: number) => void
): Promise<{ cleanup: VoidFunction; sceneLayer: SceneLayer }> {
  const context = await createGpuContext(canvas);

  const msaaManager = createMsaaTextureManager(MSAA_SAMPLE_COUNT);
  const sceneCenter = PENTAGONAL_PYRAMID.camera?.center ?? [0, 0, 0];
  const sceneProjection = PENTAGONAL_PYRAMID.camera?.projection ?? 'perspective';
  const sceneLayer = new SceneLayer(
    camera,
    msaaManager,
    topology,
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

/**
 * Converts a resolved element style to a GPU-ready LineInstanceStyle.
 */
function resolvedToInstanceStyle(resolved: ResolvedElementStyle): LineInstanceStyle {
  const [red, green, blue] = hexToRgb(resolved.color);
  return {
    width: resolved.width,
    color: [red, green, blue],
    alpha: resolved.alpha,
    lineType: resolved.line.type === 'dashed' ? 1 : 0,
    dash: resolved.line.type === 'dashed' ? resolved.line.dash : 0,
    gap: resolved.line.type === 'dashed' ? resolved.line.gap : 0,
  };
}

/**
 * Converts a ProcessedSegment to a StyledSegment by resolving visible and hidden styles
 * from the segment's modifiers (already includes 'selected' if applicable).
 */
function toStyledSegment(segment: ProcessedSegment): StyledSegment {
  const visibleResolved = resolveStyle(STEREOMETRY_STYLES, 'line', segment.modifiers);
  const hiddenResolved = resolveStyle(STEREOMETRY_STYLES, 'line', ['hidden', ...segment.modifiers]);

  return {
    startPosition: segment.startPosition,
    endPosition: segment.endPosition,
    visibleStyle: resolvedToInstanceStyle(visibleResolved),
    hiddenStyle: resolvedToInstanceStyle(hiddenResolved),
    sourceLineIndex: segment.sourceLineIndex,
    isTopologyEdge: segment.modifiers.includes('segment'),
  };
}
