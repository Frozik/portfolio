import { isNil } from 'lodash-es';
import { assert } from '../assert/assert';

export interface GpuContext {
  readonly device: GPUDevice;
  readonly canvasContext: GPUCanvasContext;
  readonly format: GPUTextureFormat;
}

export async function createGpuContext(canvas: HTMLCanvasElement): Promise<GpuContext> {
  assert(!isNil(navigator.gpu), 'WebGPU is not supported');

  const adapter = await navigator.gpu.requestAdapter();
  assert(!isNil(adapter), 'WebGPU adapter not available');

  const device = await adapter.requestDevice();

  const canvasContext = canvas.getContext('webgpu');
  assert(!isNil(canvasContext), 'Failed to get WebGPU canvas context');
  const format = navigator.gpu.getPreferredCanvasFormat();

  canvasContext.configure({
    device,
    format,
    alphaMode: 'premultiplied',
  });

  return { device, canvasContext, format };
}
