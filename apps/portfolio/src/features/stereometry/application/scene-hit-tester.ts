import { vec3 } from 'wgpu-matrix';

import type { AllowedHitTypes, SceneHit } from '../domain/hit-testing';
import { hitTestScene } from '../domain/hit-testing';
import type { SceneTopology, SelectionState, Vec3Array } from '../domain/topology-types';
import { SELECTION_NONE } from '../domain/topology-types';
import type { InitialDragHit } from '../infrastructure/drag-connector';

const SNAP_ALLOWED_TYPES: AllowedHitTypes = ['vertex'];

export interface ISceneHitTesterParams {
  readonly canvas: HTMLCanvasElement;
  /**
   * Current model-view-projection matrix, or `undefined` while no renderer is
   * attached — every hit test then misses instead of picking against a stale camera.
   */
  readonly getMvpMatrix: () => Float32Array | undefined;
  readonly getTopology: () => SceneTopology;
}

/** Screen-space picking against the live scene topology, in the terms each gesture needs. */
export interface SceneHitTester {
  /** Line under the cursor as a selection, or `SELECTION_NONE`. */
  hitTestSelection(screenX: number, screenY: number): SelectionState;
  /** Pointer-down pick that decides whether a drag starts from a vertex or a line. */
  hitTestDragStart(screenX: number, screenY: number): InitialDragHit | undefined;
  /** Vertex-only hit test used during drag-to-connect — lines are ignored. */
  hitTestSnapVertex(screenX: number, screenY: number): Vec3Array | undefined;
}

export function createSceneHitTester(params: ISceneHitTesterParams): SceneHitTester {
  const { canvas, getMvpMatrix, getTopology } = params;

  function hitTest(
    screenX: number,
    screenY: number,
    allowedTypes?: AllowedHitTypes
  ): SceneHit | undefined {
    const mvpMatrix = getMvpMatrix();
    if (mvpMatrix === undefined) {
      return undefined;
    }

    const topology = getTopology();

    return hitTestScene(
      screenX,
      screenY,
      canvas.clientWidth,
      canvas.clientHeight,
      Math.max(1, window.devicePixelRatio),
      mvpMatrix,
      topology.lines,
      topology.vertices.map(vertex => vertex.position),
      allowedTypes
    );
  }

  function hitTestSelection(screenX: number, screenY: number): SelectionState {
    const hit = hitTest(screenX, screenY);
    if (hit?.type === 'line') {
      return { type: 'line', lineId: hit.lineId };
    }
    return SELECTION_NONE;
  }

  function hitTestDragStart(screenX: number, screenY: number): InitialDragHit | undefined {
    const hit = hitTest(screenX, screenY);
    if (hit === undefined) {
      return undefined;
    }
    if (hit.type === 'vertex') {
      return { kind: 'vertex', position: hit.position };
    }

    const sourceLine = getTopology().lines.find(candidate => candidate.lineId === hit.lineId);
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

  function hitTestSnapVertex(screenX: number, screenY: number): Vec3Array | undefined {
    const hit = hitTest(screenX, screenY, SNAP_ALLOWED_TYPES);
    return hit?.type === 'vertex' ? hit.position : undefined;
  }

  return { hitTestSelection, hitTestDragStart, hitTestSnapVertex };
}
