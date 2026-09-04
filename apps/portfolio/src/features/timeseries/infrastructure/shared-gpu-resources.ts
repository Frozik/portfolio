import { MSAA_SAMPLE_COUNT } from '../domain/constants';
import candlestickSpecificSource from './shaders/candlestick.wgsl?raw';
import commonShaderSource from './shaders/common.wgsl?raw';
import debugLinesSource from './shaders/debug-lines.wgsl?raw';
import lineSpecificSource from './shaders/line.wgsl?raw';
import rhombusSpecificSource from './shaders/rhombus.wgsl?raw';

/** Pipelines and the bind group layout every chart of the grid shares on the one device. */
export interface ISharedGpuResources {
  readonly bindGroupLayout: GPUBindGroupLayout;
  readonly linePipeline: GPURenderPipeline;
  readonly candlestickPipeline: GPURenderPipeline;
  readonly rhombusPipeline: GPURenderPipeline;
  readonly debugPipeline: GPURenderPipeline;
}

const ALPHA_BLEND: GPUBlendState = {
  color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
  alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
};

interface ISeriesShader {
  readonly source: string;
  readonly vertexEntry: string;
  readonly fragmentEntry: string;
}

const SERIES_SHADERS = {
  line: { source: lineSpecificSource, vertexEntry: 'vs', fragmentEntry: 'fs' },
  candlestick: {
    source: candlestickSpecificSource,
    vertexEntry: 'vsCandlestick',
    fragmentEntry: 'fsCandlestick',
  },
  rhombus: { source: rhombusSpecificSource, vertexEntry: 'vsRhombus', fragmentEntry: 'fsRhombus' },
  debug: { source: debugLinesSource, vertexEntry: 'vsDebugLines', fragmentEntry: 'fsDebugLines' },
} satisfies Record<string, ISeriesShader>;

export function createSharedGpuResources(
  device: GPUDevice,
  format: GPUTextureFormat
): ISharedGpuResources {
  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.VERTEX,
        texture: { sampleType: 'unfilterable-float', viewDimension: '2d' },
      },
      { binding: 2, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
    ],
  });
  const layout = device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] });

  const createPipeline = (shader: ISeriesShader): GPURenderPipeline => {
    const module = device.createShaderModule({ code: commonShaderSource + shader.source });
    return device.createRenderPipeline({
      layout,
      vertex: { module, entryPoint: shader.vertexEntry },
      fragment: {
        module,
        entryPoint: shader.fragmentEntry,
        targets: [{ format, blend: ALPHA_BLEND }],
      },
      primitive: { topology: 'triangle-list' },
      multisample: { count: MSAA_SAMPLE_COUNT },
    });
  };

  return {
    bindGroupLayout,
    linePipeline: createPipeline(SERIES_SHADERS.line),
    candlestickPipeline: createPipeline(SERIES_SHADERS.candlestick),
    rhombusPipeline: createPipeline(SERIES_SHADERS.rhombus),
    debugPipeline: createPipeline(SERIES_SHADERS.debug),
  };
}
