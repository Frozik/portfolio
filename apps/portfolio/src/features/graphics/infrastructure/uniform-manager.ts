import type { FrameState } from '@frozik/utils/webgpu/renderLayer';
import type { StructuredView } from 'webgpu-utils';
import { makeShaderDataDefinitions, makeStructuredView } from 'webgpu-utils';
import { mat4 } from 'wgpu-matrix';

import {
  BORDER_MARGIN,
  computeSinXSegmentCount,
  computeSinYSegmentCount,
  SIN_PEN_MAX,
  SIN_PEN_MIN,
} from '../domain/chart-constants';

export interface UniformManager {
  readonly buffer: GPUBuffer;
  writeFromFrameState(state: FrameState): void;
  dispose(): void;
}

/** The `U` uniform block shared by every chart pass; its layout comes from the shader source. */
export function createUniformManager(device: GPUDevice, shaderSource: string): UniformManager {
  const definitions = makeShaderDataDefinitions(shaderSource);
  const uniformView: StructuredView = makeStructuredView(definitions.uniforms.U);
  const buffer = device.createBuffer({
    size: uniformView.arrayBuffer.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  return {
    buffer,
    writeFromFrameState(state: FrameState): void {
      const halfWidth = state.canvasWidth / 2;
      const halfHeight = state.canvasHeight / 2;
      const sinXCount = computeSinXSegmentCount(state.canvasWidth);

      uniformView.set({
        mvp: mat4.ortho(-halfWidth, halfWidth, -halfHeight, halfHeight, -1, 1),
        viewport: [state.canvasWidth, state.canvasHeight],
        time: state.time,
        sinCount: sinXCount,
        sinPenMin: SIN_PEN_MIN,
        sinPenMax: SIN_PEN_MAX,
        borderMargin: BORDER_MARGIN,
        borderOffset: sinXCount,
        sinYCount: computeSinYSegmentCount(state.canvasHeight),
      });
      device.queue.writeBuffer(buffer, 0, uniformView.arrayBuffer);
    },
    dispose(): void {
      buffer.destroy();
    },
  };
}
