import type { GpuContext } from '@frozik/utils/webgpu/createGpuContext';
import type { FrameState, RenderLayer } from '@frozik/utils/webgpu/renderLayer';
import type { UniformManager } from '../uniform-manager';

export class UniformUpdateLayer implements RenderLayer {
  private device!: GPUDevice;

  constructor(private readonly uniformManager: UniformManager) {}

  init(context: GpuContext): void {
    this.device = context.device;
  }

  update(state: FrameState): void {
    this.uniformManager.writeFromFrameState(this.device, state);
  }

  render(): void {}

  dispose(): void {}
}
