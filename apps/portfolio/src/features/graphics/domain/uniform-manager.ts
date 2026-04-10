import type { StructuredView } from 'webgpu-utils';
import { makeShaderDataDefinitions, makeStructuredView } from 'webgpu-utils';
import { mat4 } from 'wgpu-matrix';

import {
  BORDER_MARGIN,
  computeSinXSegmentCount,
  computeSinYSegmentCount,
  HALF,
  SIN_PEN_MAX,
  SIN_PEN_MIN,
} from './chart-constants';
import type { FrameState } from './types';

export interface UniformManager {
  readonly buffer: GPUBuffer;
  writeFromFrameState(device: GPUDevice, state: FrameState): void;
  dispose(): void;
}

export function createUniformManager(device: GPUDevice, shaderSource: string): UniformManager {
  const definitions = makeShaderDataDefinitions(shaderSource);
  const uniformView: StructuredView = makeStructuredView(definitions.uniforms.U);

  const buffer = device.createBuffer({
    size: uniformView.arrayBuffer.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  return {
    buffer,
    writeFromFrameState(gpuDevice: GPUDevice, state: FrameState): void {
      const halfWidth = state.canvasWidth * HALF;
      const halfHeight = state.canvasHeight * HALF;
      const mvp = mat4.ortho(-halfWidth, halfWidth, -halfHeight, halfHeight, -1, 1);

      const sinXCount = computeSinXSegmentCount(state.canvasWidth);
      const sinYCount = computeSinYSegmentCount(state.canvasHeight);

      uniformView.set({
        mvp,
        viewport: [state.canvasWidth, state.canvasHeight],
        time: state.time,
        sinCount: sinXCount,
        sinPenMin: SIN_PEN_MIN,
        sinPenMax: SIN_PEN_MAX,
        borderMargin: BORDER_MARGIN,
        borderOffset: sinXCount,
        sinYCount,
      });

      gpuDevice.queue.writeBuffer(buffer, 0, uniformView.arrayBuffer);
    },
    dispose(): void {
      buffer.destroy();
    },
  };
}
