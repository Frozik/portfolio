import type { FpsController } from '@frozik/utils/webgpu/fpsController';
import type { RenderLayer } from '@frozik/utils/webgpu/renderLayer';
import { createUpdateOnlyLayer } from '@frozik/utils/webgpu/updateOnlyLayer';
import { mat4 } from 'wgpu-matrix';

import type { Sunlight } from '../../domain/sun/sun-direction';
import type { OrbitCamera } from '../orbit-camera';
import { FPS_ANIMATION } from '../render-constants';
import type { SceneUniforms } from '../scene-uniforms';
import type { ShadowProjection } from '../shadow-map';

const MATRIX_FLOATS = 16;
/** A canvas reported at zero height must not turn the aspect ratio into infinity. */
const MIN_CANVAS_HEIGHT = 1;

/**
 * Drives the camera and the shared uniform buffer, and tells the session when
 * the view actually moved. Drawing nothing itself, it runs before every layer
 * that reads those uniforms.
 *
 * The camera is polled every frame — momentum and the eased zoom carry on after
 * the pointer is gone — but the buffer is written, and a frame requested, only
 * when the resulting transform or the light differs from what is already on the
 * GPU. That is what keeps a still scene from being re-encoded sixty times a
 * second.
 */
export function createSceneUpdateLayer({
  camera,
  uniforms,
  fpsController,
  getSunlight,
  getShadowProjection,
  markDirty,
}: {
  readonly camera: OrbitCamera;
  readonly uniforms: SceneUniforms;
  readonly fpsController: FpsController;
  readonly getSunlight: () => Sunlight;
  readonly getShadowProjection: () => ShadowProjection;
  readonly markDirty: VoidFunction;
}): RenderLayer {
  const viewProjectionScratch = mat4.create();
  const lastViewProjection = new Float32Array(MATRIX_FLOATS);
  let lastSunlight: Sunlight | undefined;
  let lastShadow: ShadowProjection | undefined;

  return createUpdateOnlyLayer(state => {
    if (camera.tick()) {
      fpsController.raise(FPS_ANIMATION);
    }

    const aspect = state.canvasWidth / Math.max(MIN_CANVAS_HEIGHT, state.canvasHeight);
    const viewProjection = mat4.multiply(
      camera.getProjectionMatrix(aspect),
      camera.getViewMatrix(),
      viewProjectionScratch
    );
    const sunlight = getSunlight();
    const shadow = getShadowProjection();

    // The light and its shadow box are replaced whole whenever either changes,
    // so their identity is what says whether anything moved.
    if (
      sunlight === lastSunlight &&
      shadow === lastShadow &&
      matricesEqual(lastViewProjection, viewProjection)
    ) {
      return;
    }

    lastViewProjection.set(viewProjection);
    lastSunlight = sunlight;
    lastShadow = shadow;

    uniforms.write({
      viewProjection,
      cameraPosition: camera.getEyePosition(),
      sunlight,
      shadow,
    });
    markDirty();
  });
}

function matricesEqual(left: Float32Array, right: Float32Array): boolean {
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }

  return true;
}
