import type { StructuredView } from 'webgpu-utils';
import { makeShaderDataDefinitions, makeStructuredView } from 'webgpu-utils';

import type { Sunlight } from '../domain/sun/sun-direction';
import type { WorldPoint } from '../domain/view/world-frame';
import { UNIFORM_ALIGNMENT_BYTES } from './render-constants';
import commonShaderSource from './shaders/common.wgsl?raw';
import type { ShadowProjection } from './shadow-map';

/** Light the ground keeps where the sun does not reach it. */
const AMBIENT_STRENGTH = 0.35;
const SUN_INTENSITY = 0.75;

interface SceneFrame {
  /** World → clip, as the camera sees it this frame. */
  readonly viewProjection: Float32Array;
  readonly cameraPosition: WorldPoint;
  /**
   * The sun as the domain computes it. Its `direction` points *towards* the sun
   * — a surface normal dots straight against it — which is the opposite of the
   * direction the light travels in; every consumer, the shaders included, reads
   * it that way, and the shadow map's eye is placed along it.
   */
  readonly sunlight: Sunlight;
  /** How the same sun sees the plot, for the shadow lookup. */
  readonly shadow: ShadowProjection;
}

export interface SceneUniforms {
  readonly buffer: GPUBuffer;
  write(frame: SceneFrame): void;
  dispose(): void;
}

/**
 * The one uniform buffer every layer of the 3D view binds: the camera transform
 * and the light. Its layout is read off the shader itself, so the struct in
 * `common.wgsl` stays the single description of the bytes.
 */
export function createSceneUniforms(device: GPUDevice): SceneUniforms {
  const definitions = makeShaderDataDefinitions(commonShaderSource);
  const uniformView: StructuredView = makeStructuredView(definitions.uniforms.Scene);

  const buffer = device.createBuffer({
    size:
      Math.ceil(uniformView.arrayBuffer.byteLength / UNIFORM_ALIGNMENT_BYTES) *
      UNIFORM_ALIGNMENT_BYTES,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  return {
    buffer,

    write({ viewProjection, cameraPosition, sunlight, shadow }: SceneFrame): void {
      uniformView.set({
        viewProjection,
        lightViewProjection: shadow.lightViewProjection,
        cameraPosition,
        ambientStrength: AMBIENT_STRENGTH,
        sunDirection: sunlight.direction,
        sunIntensity: SUN_INTENSITY * sunlight.intensity,
        shadowDepthRangeMeters: shadow.depthRangeMeters,
        shadowTexelWorldSizeMeters: shadow.texelWorldSizeMeters,
      });

      device.queue.writeBuffer(buffer, 0, uniformView.arrayBuffer);
    },

    dispose(): void {
      buffer.destroy();
    },
  };
}
