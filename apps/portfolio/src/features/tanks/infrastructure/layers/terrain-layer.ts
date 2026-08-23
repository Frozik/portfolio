import { SCENE_BACKGROUND_COLOR } from '@frozik/utils/webgpu/backgroundColor';
import type { RenderLayer } from '@frozik/utils/webgpu/renderLayer';

import { QuadBatch } from '../quad-batch';
import type { QuadPipeline } from '../quad-pipeline';
import type { TerrainInstanceCache } from '../terrain-instance-cache';

const NO_UPLOAD = -1;

/** First layer of the frame, so it also clears the letterbox. */
export class TerrainLayer implements RenderLayer {
  private readonly batch: QuadBatch;
  private uploadedBuildId = NO_UPLOAD;

  constructor(
    quadPipeline: QuadPipeline,
    private readonly cache: TerrainInstanceCache
  ) {
    this.batch = new QuadBatch(quadPipeline);
  }

  init(): void {}

  update(): void {
    this.cache.sync();

    if (this.cache.buildId === this.uploadedBuildId) {
      return;
    }

    this.uploadedBuildId = this.cache.buildId;
    this.batch.upload(this.cache.groundInstances);
  }

  render(encoder: GPUCommandEncoder, canvasView: GPUTextureView): void {
    this.batch.render(encoder, canvasView, SCENE_BACKGROUND_COLOR);
  }

  dispose(): void {
    this.batch.dispose();
  }
}
