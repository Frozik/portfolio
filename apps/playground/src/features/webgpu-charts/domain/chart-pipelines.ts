import chartShaderSource from './shaders/chart.wgsl?raw';
import compositeShaderSource from './shaders/composite.wgsl?raw';
import shapesShaderSource from './shaders/shapes.wgsl?raw';

export interface ChartPipelines {
  mainPipeline: GPURenderPipeline;
  sinYPipeline: GPURenderPipeline;
  compositePipeline: GPURenderPipeline;
  shapesPipeline: GPURenderPipeline;
  bindGroupLayout: GPUBindGroupLayout;
  compositeBindGroupLayout: GPUBindGroupLayout;
  shapesBindGroupLayout: GPUBindGroupLayout;
  compositeSampler: GPUSampler;
}

export function createChartPipelines(
  device: GPUDevice,
  format: GPUTextureFormat,
  offscreenFormat: GPUTextureFormat,
  msaaSampleCount: number
): ChartPipelines {
  const shaderModule = device.createShaderModule({ code: chartShaderSource });

  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' },
      },
    ],
  });

  const alphaBlend: GPUBlendState = {
    color: {
      srcFactor: 'src-alpha',
      dstFactor: 'one-minus-src-alpha',
      operation: 'add',
    },
    alpha: {
      srcFactor: 'one',
      dstFactor: 'one-minus-src-alpha',
      operation: 'add',
    },
  };

  const mainPipeline = device.createRenderPipeline({
    layout: device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout],
    }),
    vertex: { module: shaderModule, entryPoint: 'vs' },
    fragment: {
      module: shaderModule,
      entryPoint: 'fs',
      targets: [{ format, blend: alphaBlend }],
    },
    primitive: { topology: 'triangle-list' },
    multisample: { count: msaaSampleCount },
  });

  const sinYPipeline = device.createRenderPipeline({
    layout: device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout],
    }),
    vertex: { module: shaderModule, entryPoint: 'vsSinY' },
    fragment: {
      module: shaderModule,
      entryPoint: 'fsSinY',
      targets: [{ format: offscreenFormat, blend: alphaBlend }],
    },
    primitive: { topology: 'triangle-list' },
    multisample: { count: msaaSampleCount },
  });

  // Compositing pipeline -- fullscreen triangle, samples offscreen texture
  const compositeShaderModule = device.createShaderModule({ code: compositeShaderSource });

  const compositeBindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        texture: { sampleType: 'float' },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: { type: 'filtering' },
      },
      {
        binding: 2,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' },
      },
    ],
  });

  const compositePipeline = device.createRenderPipeline({
    layout: device.createPipelineLayout({
      bindGroupLayouts: [compositeBindGroupLayout],
    }),
    vertex: { module: compositeShaderModule, entryPoint: 'vsComposite' },
    fragment: {
      module: compositeShaderModule,
      entryPoint: 'fsComposite',
      targets: [{ format, blend: alphaBlend }],
    },
    primitive: { topology: 'triangle-list' },
  });

  const compositeSampler = device.createSampler({
    magFilter: 'linear',
    minFilter: 'linear',
  });

  // Shapes pipeline
  const shapesShaderModule = device.createShaderModule({ code: shapesShaderSource });

  const shapesBindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: 'read-only-storage' },
      },
    ],
  });

  const shapesPipeline = device.createRenderPipeline({
    layout: device.createPipelineLayout({
      bindGroupLayouts: [shapesBindGroupLayout],
    }),
    vertex: { module: shapesShaderModule, entryPoint: 'vsShapes' },
    fragment: {
      module: shapesShaderModule,
      entryPoint: 'fsShapes',
      targets: [
        {
          format,
          blend: {
            color: {
              srcFactor: 'one',
              dstFactor: 'one-minus-src-alpha',
              operation: 'add',
            },
            alpha: {
              srcFactor: 'one',
              dstFactor: 'one-minus-src-alpha',
              operation: 'add',
            },
          },
        },
      ],
    },
    primitive: { topology: 'triangle-list' },
  });

  return {
    mainPipeline,
    sinYPipeline,
    compositePipeline,
    shapesPipeline,
    bindGroupLayout,
    compositeBindGroupLayout,
    shapesBindGroupLayout,
    compositeSampler,
  };
}
