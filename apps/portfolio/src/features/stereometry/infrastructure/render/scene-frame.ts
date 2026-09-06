import type { FrameState } from '@frozik/utils/webgpu/renderLayer';
import { mat4 } from 'wgpu-matrix';

import {
  computeMvpMatrix,
  computeProjectionMatrix,
  viewportAspect,
} from '../../domain/camera-projection';
import type { CameraProjection } from '../../domain/types';
import type { ScreenViewport } from '../../domain/unproject';
import type { OrbitalCameraController } from '../camera-controller';

/** What one frame is drawn with, once the camera and the viewport have been read. */
export interface SceneFrameMatrices {
  readonly mvpMatrix: Float32Array;
  readonly viewMatrix: Float32Array;
  readonly cameraDistance: number;
}

/**
 * The frame's camera state and the render-on-demand flag: a frame is drawn
 * only when the scene, the preview, the camera or the viewport changed since
 * the last one that was.
 */
export class SceneFrame {
  private dirty = true;
  private readonly projectionScratch = mat4.create() as Float32Array;
  private readonly mvpScratch = mat4.create() as Float32Array;
  private readonly lastMvpMatrix = new Float32Array(16);
  private lastViewport: ScreenViewport = { canvasWidth: 0, canvasHeight: 0, devicePixelRatio: 1 };

  /** The matrix the last drawn frame used — what screen points are unprojected through. */
  get mvpMatrix(): Float32Array {
    return this.lastMvpMatrix;
  }

  get viewport(): ScreenViewport {
    return this.lastViewport;
  }

  markDirty(): void {
    this.dirty = true;
  }

  /** Whether anything changed since the last consumed frame; resets the flag (render-on-demand). */
  consumeDirty(): boolean {
    const wasDirty = this.dirty;
    this.dirty = false;
    return wasDirty;
  }

  /** Reads the camera for this frame; nothing when the frame need not be drawn. */
  advance(
    state: FrameState,
    camera: OrbitalCameraController,
    projection: CameraProjection,
    isAnimating: boolean
  ): SceneFrameMatrices | undefined {
    const viewMatrix = camera.getViewMatrix();
    const cameraDistance = camera.getDistance();
    const mvpMatrix = computeMvpMatrix(
      computeProjectionMatrix(
        projection,
        viewportAspect(state.canvasWidth, state.canvasHeight),
        cameraDistance,
        this.projectionScratch
      ),
      viewMatrix,
      this.mvpScratch
    );

    const viewportChanged =
      state.canvasWidth !== this.lastViewport.canvasWidth ||
      state.canvasHeight !== this.lastViewport.canvasHeight ||
      state.devicePixelRatio !== this.lastViewport.devicePixelRatio;

    if (isAnimating || viewportChanged || !matricesEqual(this.lastMvpMatrix, mvpMatrix)) {
      this.dirty = true;
    }
    if (!this.dirty) {
      return undefined;
    }

    this.lastMvpMatrix.set(mvpMatrix);
    this.lastViewport = {
      canvasWidth: state.canvasWidth,
      canvasHeight: state.canvasHeight,
      devicePixelRatio: state.devicePixelRatio,
    };

    return { mvpMatrix, viewMatrix, cameraDistance };
  }
}

function matricesEqual(matrixA: Float32Array, matrixB: Float32Array): boolean {
  for (let index = 0; index < matrixA.length; index++) {
    if (matrixA[index] !== matrixB[index]) {
      return false;
    }
  }
  return true;
}
