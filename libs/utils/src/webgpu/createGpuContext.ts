import { isNil } from 'lodash-es';
import { assert } from '../assert/assert';

export interface GpuContext {
  /** What the device was made from: its `info`, `features` and `limits` say what the card could do beyond what was asked for. */
  readonly adapter: GPUAdapter;
  readonly device: GPUDevice;
  readonly canvasContext: GPUCanvasContext;
  readonly format: GPUTextureFormat;
}

export interface GpuContextOptions {
  /**
   * Limits to raise above WebGPU's defaults, chosen against what the adapter
   * supports (a request beyond the adapter's own limit is a validation error).
   */
  readonly requiredLimits?: (adapterLimits: GPUSupportedLimits) => Record<string, number>;
}

export async function createGpuContext(
  canvas: HTMLCanvasElement,
  options: GpuContextOptions = {}
): Promise<GpuContext> {
  assert(!isNil(navigator.gpu), 'WebGPU is not supported');

  const adapter = await navigator.gpu.requestAdapter();
  assert(!isNil(adapter), 'WebGPU adapter not available');

  const device = await adapter.requestDevice({
    requiredLimits: options.requiredLimits?.(adapter.limits),
  });

  const canvasContext = canvas.getContext('webgpu');
  assert(!isNil(canvasContext), 'Failed to get WebGPU canvas context');
  const format = navigator.gpu.getPreferredCanvasFormat();

  canvasContext.configure({
    device,
    format,
    alphaMode: 'premultiplied',
  });

  return { adapter, device, canvasContext, format };
}
