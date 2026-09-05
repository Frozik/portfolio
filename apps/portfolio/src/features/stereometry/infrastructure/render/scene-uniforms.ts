import { makeShaderDataDefinitions, makeStructuredView } from 'webgpu-utils';

import type { Vec3Array } from '../../domain/topology-types';
import commonShaderSource from '../shaders/common.wgsl?raw';

export interface SceneUniformValues {
  readonly mvp: Float32Array;
  readonly viewport: readonly [number, number];
  readonly dpr: number;
  readonly cameraDistance: number;
  readonly cameraForward: Vec3Array;
  readonly cameraTarget: Vec3Array;
  readonly depthFadeRate: number;
  readonly depthFadeMin: number;
}

/** Layout of the `Uniforms` struct every stereometry shader shares, read from the WGSL itself. */
export const SCENE_UNIFORMS_DEFINITION =
  makeShaderDataDefinitions(commonShaderSource).uniforms.uniforms;

/** The uniform buffer behind `common.wgsl`'s `uniforms`, written whole once per dirty frame. */
export class SceneUniforms {
  readonly buffer: GPUBuffer;
  private readonly view = makeStructuredView(SCENE_UNIFORMS_DEFINITION);

  constructor(private readonly device: GPUDevice) {
    this.buffer = device.createBuffer({
      size: this.view.arrayBuffer.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  write(values: SceneUniformValues): void {
    this.view.set(values);
    this.device.queue.writeBuffer(this.buffer, 0, this.view.arrayBuffer);
  }

  dispose(): void {
    this.buffer.destroy();
  }
}
