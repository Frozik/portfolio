import { assert } from '@frozik/utils/assert/assert';

import { hexToLinearRgb } from '../../domain/color-utils';
import { GRID_LINE_COLOR, MSAA_SAMPLE_COUNT } from '../../domain/constants';
import type { IGridRect } from '../../domain/grid-lines';

const GRID_UNIFORMS_BYTES = 16;
const GRID_RECT_BYTES = 16;
const GRID_RECT_FLOATS = GRID_RECT_BYTES / Float32Array.BYTES_PER_ELEMENT;
export const GRID_VERTEX_COUNT_PER_INSTANCE = 6;

export interface IGridLayerResources {
  readonly uniformsBuffer: GPUBuffer;
  readonly rectsBuffer: GPUBuffer;
}

export function createGridResources(device: GPUDevice, maxRects: number): IGridLayerResources {
  return {
    uniformsBuffer: device.createBuffer({
      size: GRID_UNIFORMS_BYTES,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      label: 'grid.uniforms',
    }),
    rectsBuffer: device.createBuffer({
      size: GRID_RECT_BYTES * Math.max(maxRects, 1),
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      label: 'grid.rects',
    }),
  };
}

export function createGridBindGroupLayout(device: GPUDevice): GPUBindGroupLayout {
  return device.createBindGroupLayout({
    label: 'grid.bindGroupLayout',
    entries: [
      { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
      { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
    ],
  });
}

export function createGridBindGroup(
  device: GPUDevice,
  layout: GPUBindGroupLayout,
  resources: IGridLayerResources
): GPUBindGroup {
  return device.createBindGroup({
    label: 'grid.bindGroup',
    layout,
    entries: [
      { binding: 0, resource: { buffer: resources.uniformsBuffer } },
      { binding: 1, resource: { buffer: resources.rectsBuffer } },
    ],
  });
}

export function getGridPipelineDescriptor(params: {
  readonly device: GPUDevice;
  readonly module: GPUShaderModule;
  readonly layout: GPUBindGroupLayout;
  readonly format: GPUTextureFormat;
}): GPURenderPipelineDescriptor {
  const { device, module, layout, format } = params;
  const color = hexToLinearRgb(GRID_LINE_COLOR);
  return {
    label: 'grid.pipeline',
    layout: device.createPipelineLayout({ bindGroupLayouts: [layout] }),
    vertex: { module, entryPoint: 'vsGrid' },
    fragment: {
      module,
      entryPoint: 'fsGrid',
      constants: { COLOR_R: color.r, COLOR_G: color.g, COLOR_B: color.b },
      targets: [{ format }],
    },
    primitive: { topology: 'triangle-list' },
    multisample: { count: MSAA_SAMPLE_COUNT },
  };
}

export function writeGridUniforms(
  device: GPUDevice,
  buffer: GPUBuffer,
  canvasWidth: number,
  canvasHeight: number
): void {
  device.queue.writeBuffer(buffer, 0, new Float32Array([canvasWidth, canvasHeight, 0, 0]));
}

/** Packs rectangles already converted to device pixels; returns the instance count. */
export function writeGridRects(
  device: GPUDevice,
  buffer: GPUBuffer,
  rects: readonly IGridRect[]
): number {
  assert(buffer.size >= GRID_RECT_BYTES * rects.length, 'grid: rects buffer too small');
  if (rects.length === 0) {
    return 0;
  }
  const floats = new Float32Array(rects.length * GRID_RECT_FLOATS);
  rects.forEach((rect, index) => {
    const base = index * GRID_RECT_FLOATS;
    floats[base] = rect.left;
    floats[base + 1] = rect.top;
    floats[base + 2] = rect.width;
    floats[base + 3] = rect.height;
  });
  device.queue.writeBuffer(buffer, 0, floats);
  return rects.length;
}
