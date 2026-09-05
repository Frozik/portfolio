import { MSAA_SAMPLE_COUNT } from '../../domain/constants';
import commonShaderSource from '../shaders/common.wgsl?raw';
import depthFacesSpecificSource from '../shaders/depth-faces.wgsl?raw';
import lineIdSpecificSource from '../shaders/line-id.wgsl?raw';
import lineSpecificSource from '../shaders/line.wgsl?raw';
import solutionFaceSpecificSource from '../shaders/solution-face.wgsl?raw';
import vertexMarkerSpecificSource from '../shaders/vertex-marker.wgsl?raw';
import {
  FACE_ATTRIBUTES,
  FACE_VERTEX_STRIDE,
  LINE_ID_ATTRIBUTES,
  MARKER_ATTRIBUTES,
  MARKER_INSTANCE_STRIDE,
  SOLUTION_FACE_ATTRIBUTES,
  SOLUTION_FACE_VERTEX_STRIDE,
  STYLED_LINE_ATTRIBUTES,
  STYLED_LINE_STRIDE,
} from './scene-instances';

const depthFacesShaderSource = commonShaderSource + depthFacesSpecificSource;
const lineShaderSource = commonShaderSource + lineSpecificSource;
const lineIdShaderSource = commonShaderSource + lineIdSpecificSource;
const solutionFaceShaderSource = commonShaderSource + solutionFaceSpecificSource;
const vertexMarkerShaderSource = commonShaderSource + vertexMarkerSpecificSource;

export const DEPTH_FORMAT: GPUTextureFormat = 'depth24plus';
/**
 * Endpoint vertex indices are small integers (marker count is well below 2048,
 * where f16 stops being exact), so 16-bit floats are lossless here and halve
 * the bandwidth of the two line-id passes compared to rg32float.
 */
export const LINE_ENDPOINT_FORMAT: GPUTextureFormat = 'rg16float';

/**
 * Depth bias for face geometry in the depth pre-pass. Pushes face depth slightly
 * further from the camera so coplanar lines are classified as "in front" rather
 * than z-fighting with the face.
 */
const FACE_DEPTH_BIAS = 2;
const FACE_DEPTH_BIAS_SLOPE_SCALE = 1.0;

/** Pipeline-overridable render mode constants matching shader `override renderMode`. */
const RENDER_MODE_ALL = 0;
const RENDER_MODE_HIDDEN_ONLY = 1;
const RENDER_MODE_VISIBLE_ONLY = 2;

const PREMULTIPLIED_ALPHA_BLEND: GPUBlendState = {
  color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
  alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
};

export interface ScenePipelines {
  /** Uniforms only: the depth pre-pass and the solution face. */
  readonly uniformBindGroupLayout: GPUBindGroupLayout;
  /** Uniforms + face depth: the line passes. */
  readonly depthBindGroupLayout: GPUBindGroupLayout;
  /** Uniforms + face depth + line-id textures: the marker passes. */
  readonly markerBindGroupLayout: GPUBindGroupLayout;
  readonly depthPrePass: GPURenderPipeline;
  readonly solutionFace: GPURenderPipeline;
  readonly hiddenLine: GPURenderPipeline;
  readonly visibleLine: GPURenderPipeline;
  readonly previewLine: GPURenderPipeline;
  readonly hiddenMarker: GPURenderPipeline;
  readonly visibleMarker: GPURenderPipeline;
  readonly previewMarker: GPURenderPipeline;
  readonly hiddenLineId: GPURenderPipeline;
  readonly visibleLineId: GPURenderPipeline;
}

export function createScenePipelines(device: GPUDevice, format: GPUTextureFormat): ScenePipelines {
  const uniformEntry: GPUBindGroupLayoutEntry = {
    binding: 0,
    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
    buffer: { type: 'uniform' },
  };
  const faceDepthEntries: readonly GPUBindGroupLayoutEntry[] = [
    {
      binding: 1,
      visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
      texture: { sampleType: 'depth' },
    },
    {
      binding: 2,
      visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
      sampler: { type: 'non-filtering' },
    },
  ];
  const lineIdEntries: readonly GPUBindGroupLayoutEntry[] = [
    {
      binding: 3,
      visibility: GPUShaderStage.FRAGMENT,
      texture: { sampleType: 'unfilterable-float' },
    },
    { binding: 4, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'depth' } },
  ];

  const uniformBindGroupLayout = device.createBindGroupLayout({ entries: [uniformEntry] });
  const depthBindGroupLayout = device.createBindGroupLayout({
    entries: [uniformEntry, ...faceDepthEntries],
  });
  const markerBindGroupLayout = device.createBindGroupLayout({
    entries: [uniformEntry, ...faceDepthEntries, ...lineIdEntries],
  });

  const uniformLayout = device.createPipelineLayout({
    bindGroupLayouts: [uniformBindGroupLayout],
  });
  const depthLayout = device.createPipelineLayout({ bindGroupLayouts: [depthBindGroupLayout] });
  const markerLayout = device.createPipelineLayout({ bindGroupLayouts: [markerBindGroupLayout] });

  const lineModule = device.createShaderModule({ code: lineShaderSource });
  const markerModule = device.createShaderModule({ code: vertexMarkerShaderSource });
  const lineIdModule = device.createShaderModule({ code: lineIdShaderSource });

  return {
    uniformBindGroupLayout,
    depthBindGroupLayout,
    markerBindGroupLayout,
    depthPrePass: createDepthPrePassPipeline(device, uniformLayout),
    solutionFace: createSolutionFacePipeline(device, format, uniformLayout),
    hiddenLine: createLinePipeline(device, format, depthLayout, lineModule, {
      renderMode: RENDER_MODE_HIDDEN_ONLY,
      depthTest: true,
    }),
    visibleLine: createLinePipeline(device, format, depthLayout, lineModule, {
      renderMode: RENDER_MODE_VISIBLE_ONLY,
      depthTest: true,
    }),
    previewLine: createLinePipeline(device, format, depthLayout, lineModule, {
      renderMode: RENDER_MODE_ALL,
      depthTest: false,
    }),
    hiddenMarker: createMarkerPipeline(device, format, markerLayout, markerModule, {
      renderMode: RENDER_MODE_HIDDEN_ONLY,
      lineOcclusion: true,
    }),
    visibleMarker: createMarkerPipeline(device, format, markerLayout, markerModule, {
      renderMode: RENDER_MODE_VISIBLE_ONLY,
      lineOcclusion: true,
    }),
    previewMarker: createMarkerPipeline(device, format, markerLayout, markerModule, {
      renderMode: RENDER_MODE_ALL,
      lineOcclusion: false,
    }),
    hiddenLineId: createLineIdPipeline(device, depthLayout, lineIdModule, RENDER_MODE_HIDDEN_ONLY),
    visibleLineId: createLineIdPipeline(
      device,
      depthLayout,
      lineIdModule,
      RENDER_MODE_VISIBLE_ONLY
    ),
  };
}

function createLinePipeline(
  device: GPUDevice,
  format: GPUTextureFormat,
  layout: GPUPipelineLayout,
  module: GPUShaderModule,
  { renderMode, depthTest }: { readonly renderMode: number; readonly depthTest: boolean }
): GPURenderPipeline {
  return device.createRenderPipeline({
    layout,
    vertex: {
      module,
      entryPoint: 'vs',
      buffers: [
        {
          arrayStride: STYLED_LINE_STRIDE,
          stepMode: 'instance',
          attributes: [...STYLED_LINE_ATTRIBUTES],
        },
      ],
    },
    fragment: {
      module,
      entryPoint: 'fs',
      constants: { renderMode },
      targets: [{ format, blend: PREMULTIPLIED_ALPHA_BLEND }],
    },
    primitive: { topology: 'triangle-list' },
    depthStencil: depthTest
      ? { depthWriteEnabled: true, depthCompare: 'less-equal', format: DEPTH_FORMAT }
      : { depthWriteEnabled: false, depthCompare: 'always', format: DEPTH_FORMAT },
    multisample: { count: MSAA_SAMPLE_COUNT },
  });
}

function createDepthPrePassPipeline(
  device: GPUDevice,
  layout: GPUPipelineLayout
): GPURenderPipeline {
  const module = device.createShaderModule({ code: depthFacesShaderSource });

  return device.createRenderPipeline({
    layout,
    vertex: {
      module,
      entryPoint: 'vs',
      buffers: [{ arrayStride: FACE_VERTEX_STRIDE, attributes: [...FACE_ATTRIBUTES] }],
    },
    primitive: { topology: 'triangle-list', cullMode: 'none' },
    depthStencil: {
      depthWriteEnabled: true,
      depthCompare: 'less',
      format: DEPTH_FORMAT,
      depthBias: FACE_DEPTH_BIAS,
      depthBiasSlopeScale: FACE_DEPTH_BIAS_SLOPE_SCALE,
    },
  });
}

function createSolutionFacePipeline(
  device: GPUDevice,
  format: GPUTextureFormat,
  layout: GPUPipelineLayout
): GPURenderPipeline {
  const module = device.createShaderModule({ code: solutionFaceShaderSource });

  return device.createRenderPipeline({
    layout,
    vertex: {
      module,
      entryPoint: 'vs',
      buffers: [
        { arrayStride: SOLUTION_FACE_VERTEX_STRIDE, attributes: [...SOLUTION_FACE_ATTRIBUTES] },
      ],
    },
    fragment: {
      module,
      entryPoint: 'fs',
      targets: [{ format, blend: PREMULTIPLIED_ALPHA_BLEND }],
    },
    primitive: { topology: 'triangle-list', cullMode: 'none' },
    depthStencil: { depthWriteEnabled: false, depthCompare: 'always', format: DEPTH_FORMAT },
    multisample: { count: MSAA_SAMPLE_COUNT },
  });
}

function createMarkerPipeline(
  device: GPUDevice,
  format: GPUTextureFormat,
  layout: GPUPipelineLayout,
  module: GPUShaderModule,
  { renderMode, lineOcclusion }: { readonly renderMode: number; readonly lineOcclusion: boolean }
): GPURenderPipeline {
  return device.createRenderPipeline({
    layout,
    vertex: {
      module,
      entryPoint: 'vs',
      buffers: [
        {
          arrayStride: MARKER_INSTANCE_STRIDE,
          stepMode: 'instance',
          attributes: [...MARKER_ATTRIBUTES],
        },
      ],
    },
    fragment: {
      module,
      entryPoint: 'fs',
      constants: { renderMode, enableLineOcclusion: lineOcclusion ? 1 : 0 },
      targets: [{ format, blend: PREMULTIPLIED_ALPHA_BLEND }],
    },
    primitive: { topology: 'triangle-list' },
    depthStencil: { depthWriteEnabled: false, depthCompare: 'always', format: DEPTH_FORMAT },
    multisample: { count: MSAA_SAMPLE_COUNT },
  });
}

function createLineIdPipeline(
  device: GPUDevice,
  layout: GPUPipelineLayout,
  module: GPUShaderModule,
  renderMode: number
): GPURenderPipeline {
  return device.createRenderPipeline({
    layout,
    vertex: {
      module,
      entryPoint: 'vs',
      buffers: [
        {
          arrayStride: STYLED_LINE_STRIDE,
          stepMode: 'instance',
          attributes: [...LINE_ID_ATTRIBUTES],
        },
      ],
    },
    fragment: {
      module,
      entryPoint: 'fs',
      constants: { renderMode },
      targets: [{ format: LINE_ENDPOINT_FORMAT }],
    },
    primitive: { topology: 'triangle-list' },
    depthStencil: { depthWriteEnabled: true, depthCompare: 'less', format: DEPTH_FORMAT },
  });
}
