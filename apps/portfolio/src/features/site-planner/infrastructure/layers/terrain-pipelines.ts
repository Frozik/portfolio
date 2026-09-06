import { DEPTH_FORMAT, MSAA_SAMPLE_COUNT } from '../render-constants';
import { SHADOW_FORMAT } from '../shadow-map';
import { OUTLINE_VERTEX_STRIDE } from './terrain-geometry';

export interface TerrainPipelines {
  readonly gridPipeline: GPURenderPipeline;
  readonly outlinePipeline: GPURenderPipeline;
  readonly shadowPipeline: GPURenderPipeline;
}

/** The three ways the ground is drawn: lit, as its accent outline, and into the shadow map. */
export function createTerrainPipelines(
  device: GPUDevice,
  shaderModule: GPUShaderModule,
  format: GPUTextureFormat,
  bindGroupLayouts: { readonly terrain: GPUBindGroupLayout; readonly shadow: GPUBindGroupLayout }
): TerrainPipelines {
  // The camera passes read the shadow map through group 1; the shadow pass
  // writes it, and so must be built without it — a texture cannot be an
  // attachment and a bound resource of the same pass.
  const pipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [bindGroupLayouts.terrain, bindGroupLayouts.shadow],
  });
  const shadowPipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [bindGroupLayouts.terrain],
  });

  const shadowPipeline = device.createRenderPipeline({
    layout: shadowPipelineLayout,
    vertex: { module: shaderModule, entryPoint: 'vsTerrainShadow' },
    primitive: { topology: 'triangle-list', cullMode: 'none' },
    depthStencil: { format: SHADOW_FORMAT, depthWriteEnabled: true, depthCompare: 'less' },
  });

  const gridPipeline = device.createRenderPipeline({
    layout: pipelineLayout,
    vertex: { module: shaderModule, entryPoint: 'vsTerrain' },
    fragment: { module: shaderModule, entryPoint: 'fsTerrain', targets: [{ format }] },
    // The terrain is a single sheet, so it has to hold up when the camera
    // drops below the horizon and looks at its underside.
    primitive: { topology: 'triangle-list', cullMode: 'none' },
    depthStencil: { format: DEPTH_FORMAT, depthWriteEnabled: true, depthCompare: 'less' },
    multisample: { count: MSAA_SAMPLE_COUNT },
  });

  const outlinePipeline = device.createRenderPipeline({
    layout: pipelineLayout,
    vertex: {
      module: shaderModule,
      entryPoint: 'vsBoundaryOutline',
      buffers: [
        {
          arrayStride: OUTLINE_VERTEX_STRIDE,
          attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }],
        },
      ],
    },
    fragment: { module: shaderModule, entryPoint: 'fsBoundaryOutline', targets: [{ format }] },
    primitive: { topology: 'line-list' },
    // The line rides just over the ground and must not shadow what stands on
    // it, so it tests against the terrain without writing its own depth.
    depthStencil: {
      format: DEPTH_FORMAT,
      depthWriteEnabled: false,
      depthCompare: 'less-equal',
    },
    multisample: { count: MSAA_SAMPLE_COUNT },
  });

  return { gridPipeline, outlinePipeline, shadowPipeline };
}
