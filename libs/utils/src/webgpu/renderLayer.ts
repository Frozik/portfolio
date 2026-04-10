import type { GpuContext } from './createGpuContext';

export interface FrameState {
  readonly time: number;
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly devicePixelRatio: number;
}

export interface RenderLayer {
  init(context: GpuContext): void;
  update(state: FrameState): void;
  render(encoder: GPUCommandEncoder, canvasView: GPUTextureView, state: FrameState): void;
  dispose(): void;
}
