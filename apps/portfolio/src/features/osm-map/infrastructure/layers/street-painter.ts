import type { MapFrame } from './map-frame';

/** What every painter of the street pass shares: the device, the target format and the pass's uniforms and placements. */
export interface StreetPassResources {
  readonly device: GPUDevice;
  readonly format: GPUTextureFormat;
  readonly depthFormat: GPUTextureFormat;
  readonly uniformBuffer: GPUBuffer;
  /** One `Placement` per street tile of the frame, indexed as the frame lists them. */
  readonly placementBuffer: GPUBuffer;
}

/** One kind of thing drawn in the street pass: it reads the frame, then draws into the pass the layer opened. */
export interface StreetPainter {
  /** Takes what it needs from the frame; says whether it has anything to draw. */
  update(frame: MapFrame): boolean;
  draw(pass: GPURenderPassEncoder): void;
  dispose(): void;
}

export const UNIFORM_BINDING: GPUBindGroupLayoutEntry = {
  binding: 0,
  visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
  buffer: { type: 'uniform' },
};

export const PLACEMENTS_BINDING: GPUBindGroupLayoutEntry = {
  binding: 1,
  visibility: GPUShaderStage.VERTEX,
  buffer: { type: 'read-only-storage' },
};

export function createStreetPipeline(
  resources: StreetPassResources,
  bindGroupLayout: GPUBindGroupLayout,
  shaderSource: string,
  vertexBuffers: readonly GPUVertexBufferLayout[]
): GPURenderPipeline {
  const shaderModule = resources.device.createShaderModule({ code: shaderSource });
  return resources.device.createRenderPipeline({
    layout: resources.device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
    vertex: { module: shaderModule, entryPoint: 'vs', buffers: [...vertexBuffers] },
    fragment: { module: shaderModule, entryPoint: 'fs', targets: [{ format: resources.format }] },
    primitive: { topology: 'triangle-list', cullMode: 'none' },
    depthStencil: {
      format: resources.depthFormat,
      depthWriteEnabled: true,
      depthCompare: 'less',
    },
  });
}
