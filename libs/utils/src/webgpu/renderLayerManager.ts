import type { GpuContext } from './createGpuContext';
import type { FrameState, RenderLayer } from './renderLayer';

export class RenderLayerManager {
  constructor(private readonly layers: readonly RenderLayer[]) {}

  initAll(context: GpuContext): void {
    for (const layer of this.layers) {
      layer.init(context);
    }
  }

  updateAll(state: FrameState): void {
    for (const layer of this.layers) {
      layer.update(state);
    }
  }

  renderAll(encoder: GPUCommandEncoder, canvasView: GPUTextureView, state: FrameState): void {
    for (const layer of this.layers) {
      layer.render(encoder, canvasView, state);
    }
  }

  dispose(): void {
    for (const layer of this.layers) {
      layer.dispose();
    }
  }
}
