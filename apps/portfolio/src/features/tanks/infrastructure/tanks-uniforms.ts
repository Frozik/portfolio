import type { FrameState } from '@frozik/utils/webgpu/renderLayer';
import type { StructuredView } from 'webgpu-utils';
import { makeShaderDataDefinitions, makeStructuredView } from 'webgpu-utils';

import commonShaderSource from './shaders/common.wgsl?raw';
import type { ITanksWorldView } from './tanks-world-view';
import { computeViewTransform } from './view-transform';

/** Clip space spans -1..1, so a canvas maps onto two clip units per axis. */
const CLIP_SPACE_SPAN = 2;

export interface TanksUniforms {
  readonly buffer: GPUBuffer;
  write(state: FrameState): void;
  dispose(): void;
}

export function createTanksUniforms(device: GPUDevice, view: ITanksWorldView): TanksUniforms {
  const definitions = makeShaderDataDefinitions(commonShaderSource);
  const uniformView: StructuredView = makeStructuredView(definitions.uniforms.U);

  const buffer = device.createBuffer({
    size: uniformView.arrayBuffer.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  return {
    buffer,
    write(state: FrameState): void {
      const { geometry } = view.terrain;
      const transform = computeViewTransform(
        state.canvasWidth,
        state.canvasHeight,
        geometry.widthWu,
        geometry.heightWu
      );

      uniformView.set({
        worldScale: [
          (CLIP_SPACE_SPAN * transform.scale) / state.canvasWidth,
          (-CLIP_SPACE_SPAN * transform.scale) / state.canvasHeight,
        ],
        worldOffset: [
          (CLIP_SPACE_SPAN * transform.originX) / state.canvasWidth - 1,
          1 - (CLIP_SPACE_SPAN * transform.originY) / state.canvasHeight,
        ],
        tick: view.ticksSinceStageStart,
      });

      device.queue.writeBuffer(buffer, 0, uniformView.arrayBuffer);
    },
    dispose(): void {
      buffer.destroy();
    },
  };
}
