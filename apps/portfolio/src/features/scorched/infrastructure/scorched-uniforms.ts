import type { Vector2 } from '@frozik/utils/math/vector2';
import type { FrameState } from '@frozik/utils/webgpu/renderLayer';
import type { StructuredView } from 'webgpu-utils';
import { makeShaderDataDefinitions, makeStructuredView } from 'webgpu-utils';

import { FIELD_HEIGHT_WU, FIELD_WIDTH_WU } from '../domain/constants';
import { MAX_SHAKE_AMPLITUDE_WU } from './render-constants';
import commonShaderSource from './shaders/common.wgsl?raw';
import { computeViewTransform } from './view-transform';

/** Clip space spans -1..1, so a canvas maps onto two clip units per axis. */
const CLIP_SPACE_SPAN = 2;

export interface ScorchedUniforms {
  readonly buffer: GPUBuffer;
  /** `cameraOffsetWu` is the §13 screen shake; it slides the world, never the simulation. */
  write(state: FrameState, cameraOffsetWu: Vector2): void;
  dispose(): void;
}

/**
 * The one uniform buffer every layer binds: the world-unit → clip-space transform for the
 * letterboxed field and the clock the sky twinkles on. World y points up, so the vertical scale
 * stays positive and the offset is measured from the field's floor.
 */
export function createScorchedUniforms(device: GPUDevice): ScorchedUniforms {
  const definitions = makeShaderDataDefinitions(commonShaderSource);
  const uniformView: StructuredView = makeStructuredView(definitions.uniforms.U);

  const buffer = device.createBuffer({
    size: uniformView.arrayBuffer.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  return {
    buffer,
    write(state: FrameState, cameraOffsetWu: Vector2): void {
      const transform = computeViewTransform(
        state.canvasWidth,
        state.canvasHeight,
        FIELD_WIDTH_WU,
        FIELD_HEIGHT_WU
      );
      const fieldBottomPx = transform.originY + FIELD_HEIGHT_WU * transform.scale;
      const scaleX = (CLIP_SPACE_SPAN * transform.scale) / state.canvasWidth;
      const scaleY = (CLIP_SPACE_SPAN * transform.scale) / state.canvasHeight;

      uniformView.set({
        worldScale: [scaleX, scaleY],
        // The shake is a world-space displacement, so it rides the same scale as everything else
        // the transform places — the field slides by whole world units, not by whole pixels.
        worldOffset: [
          (CLIP_SPACE_SPAN * transform.originX) / state.canvasWidth - 1 + cameraOffsetWu.x * scaleX,
          1 - (CLIP_SPACE_SPAN * fieldBottomPx) / state.canvasHeight + cameraOffsetWu.y * scaleY,
        ],
        fieldSize: [FIELD_WIDTH_WU, FIELD_HEIGHT_WU],
        timeSeconds: state.time,
        shakeOverscanWu: MAX_SHAKE_AMPLITUDE_WU,
      });

      device.queue.writeBuffer(buffer, 0, uniformView.arrayBuffer);
    },
    dispose(): void {
      buffer.destroy();
    },
  };
}
