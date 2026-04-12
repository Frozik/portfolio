import { createGpuContext, createMsaaTextureManager, RenderLayerManager } from '@frozik/utils';

import { PyramidLayer } from './layers/pyramid-layer';
import { PENTAGONAL_PYRAMID } from './puzzles/pentagonal-pyramid';
import { startRenderLoop } from './render-loop';
import type { OrbitalCameraController } from './stereometry-camera-controller';
import { createOrbitalCameraController } from './stereometry-camera-controller';
import { createClickDetector } from './stereometry-click-detector';
import { MSAA_SAMPLE_COUNT } from './stereometry-constants';
import { createDragToConnectController } from './stereometry-drag-connector';
import { createTopologyFromPuzzle } from './stereometry-geometry';
import { hitTest, hitTestVertex } from './stereometry-hit-testing';
import type { Vec3 } from './stereometry-math';
import { subtractVec3 } from './stereometry-math';
import { addUserSegment, createInitialScene, toggleLine } from './stereometry-scene';
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
  let currentSelection: SelectionState = SELECTION_NONE;

  function performHitTest(screenX: number, screenY: number): SelectionState {
    if (destroyed || !pyramidLayerRef) {
      return SELECTION_NONE;
    }

    const canvasWidth = canvas.clientWidth;
    const canvasHeight = canvas.clientHeight;
    const devicePixelRatio = Math.max(1, window.devicePixelRatio);

    const extendedEdgeIndices = sceneState.lines.map(line => line.edgeIndex);

    return hitTest(
      screenX,
      screenY,
      canvasWidth,
      canvasHeight,
      devicePixelRatio,
      pyramidLayerRef.getLastMvpMatrix(),
      topology,
      extendedEdgeIndices,
      sceneState.userSegments
    );
  }

  function performPointHitTest(
    screenX: number,
    screenY: number
  ): readonly [number, number, number] | undefined {
    if (destroyed || !pyramidLayerRef) {
      return undefined;
    }

    const canvasWidth = canvas.clientWidth;
    const canvasHeight = canvas.clientHeight;
    const devicePixelRatio = Math.max(1, window.devicePixelRatio);

    const allPositions = sceneState.vertices.map(vertex => vertex.position);

    const vertexIndex = hitTestVertex(
      screenX,
      screenY,
      canvasWidth,
      canvasHeight,
      devicePixelRatio,
      pyramidLayerRef.getLastMvpMatrix(),
      allPositions
    );

    if (vertexIndex !== undefined) {
      return allPositions[vertexIndex];
    }

    return undefined;
  }

  function setSelection(selection: SelectionState): void {
    currentSelection = selection;
    pyramidLayerRef?.setSelection(selection);
  }

  /**
   * Returns the direction vector of the currently selected edge, line, or user segment.
   * Returns undefined if nothing is selected.
   */
  function getSelectedDirection(): Vec3 | undefined {
    switch (currentSelection.type) {
      case 'edge':
      case 'line': {
        const [vertexIndexA, vertexIndexB] = topology.edges[currentSelection.edgeIndex];
        return subtractVec3(topology.vertices[vertexIndexB], topology.vertices[vertexIndexA]);
      }
      case 'userSegment': {
        const segment = sceneState.userSegments[currentSelection.userSegmentIndex];
        return subtractVec3(segment.endPosition, segment.startPosition);
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
      sceneState = toggleLine(sceneState, hit.edgeIndex, topology);
      pyramidLayerRef?.applySceneState(sceneState);
    }
  }

  const cleanupClickDetector = createClickDetector(canvas, onCanvasClick, onCanvasDoubleClick);

  const cleanupDragConnector = createDragToConnectController(canvas, {
    performPointHitTest,
    onDragStart: () => {
      // Don't clear selection here — onVertexTap needs it to create parallel lines
    },
    onDragUpdate: preview => {
      pyramidLayerRef?.setDragPreview(preview);
    },
    onVertexTap: vertexPosition => {
      const direction = getSelectedDirection();

      if (direction !== undefined) {
        // Create a parallel line through this vertex
        const endPosition: Vec3 = [
          vertexPosition[0] + direction[0],
          vertexPosition[1] + direction[1],
          vertexPosition[2] + direction[2],
        ];
        sceneState = addUserSegment(sceneState, vertexPosition, endPosition, topology);
        pyramidLayerRef?.applySceneState(sceneState);
      }

      setSelection(SELECTION_NONE);
    },
    onDragComplete: (startPosition, endPosition) => {
      sceneState = addUserSegment(sceneState, startPosition, endPosition, topology);
      pyramidLayerRef?.applySceneState(sceneState);
      setSelection(SELECTION_NONE);
    },
  });

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
      cleanupDragConnector();
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
