import { assert } from '@frozik/utils';
import { isNil } from 'lodash-es';

import sunShaderSource from './shaders/sun.wgsl?raw';
import { MSAA_SAMPLE_COUNT, UNIFORM_SIZE } from './sun-constants';

export interface SunGPUResources {
  device: GPUDevice;
  ctx: GPUCanvasContext;
  format: GPUTextureFormat;
  pipeline: GPURenderPipeline;
  bindGroup: GPUBindGroup;
  uniformBuf: GPUBuffer;
}

export async function initSunGPUResources(canvas: HTMLCanvasElement): Promise<SunGPUResources> {
  assert(!isNil(navigator.gpu), 'WebGPU is not supported');

  const adapter = await navigator.gpu.requestAdapter();
  assert(!isNil(adapter), 'WebGPU adapter not available');
  const device = await adapter.requestDevice();

  const ctx = canvas.getContext('webgpu') as GPUCanvasContext;
  const format = navigator.gpu.getPreferredCanvasFormat();
  ctx.configure({ device, format, alphaMode: 'premultiplied' });

  const uniformBuf = device.createBuffer({
    size: UNIFORM_SIZE,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const shaderModule = device.createShaderModule({ code: sunShaderSource });

  const bgl = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' },
      },
    ],
  });

  const pipeline = device.createRenderPipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [bgl] }),
    vertex: { module: shaderModule, entryPoint: 'vs' },
    fragment: {
      module: shaderModule,
      entryPoint: 'fs',
      targets: [{ format }],
    },
    primitive: { topology: 'triangle-list', cullMode: 'none' },
    depthStencil: {
      depthWriteEnabled: true,
      depthCompare: 'less',
      format: 'depth24plus',
    },
    multisample: { count: MSAA_SAMPLE_COUNT },
  });

  const bindGroup = device.createBindGroup({
    layout: bgl,
    entries: [{ binding: 0, resource: { buffer: uniformBuf } }],
  });

  return { device, ctx, format, pipeline, bindGroup, uniformBuf };
}

export function createDepthTexture(
  device: GPUDevice,
  width: number,
  height: number,
  sampleCount: number
): GPUTexture {
  return device.createTexture({
    size: [width, height],
    format: 'depth24plus',
    sampleCount,
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });
}

export function createMsaaTexture(
  device: GPUDevice,
  width: number,
  height: number,
  format: GPUTextureFormat,
  sampleCount: number
): GPUTexture {
  return device.createTexture({
    size: [width, height],
    format,
    sampleCount,
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });
}
