import { createDepthTextureManager } from '@frozik/utils/webgpu/depthTextureManager';

import { MSAA_SAMPLE_COUNT } from '../../domain/constants';
import { DEPTH_FORMAT, LINE_ENDPOINT_FORMAT } from './scene-pipelines';

const SINGLE_SAMPLE = 1;
const SAMPLED_ATTACHMENT = GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING;

export interface SceneTargetViews {
  /** MSAA depth shared by the hidden and visible colour passes. */
  readonly depth: GPUTextureView;
  /** Non-MSAA face depth the line and marker shaders sample for occlusion. */
  readonly faceDepth: GPUTextureView;
  /** Endpoint indices of the lines drawn last, read by the marker shader. */
  readonly lineEndpoint: GPUTextureView;
  readonly lineDepth: GPUTextureView;
}

/** The four canvas-sized attachments of a scene frame, recreated together on resize. */
export class SceneTargets {
  private readonly depth = createDepthTextureManager(MSAA_SAMPLE_COUNT, DEPTH_FORMAT);
  private readonly faceDepth = createDepthTextureManager(
    SINGLE_SAMPLE,
    DEPTH_FORMAT,
    SAMPLED_ATTACHMENT
  );
  private readonly lineEndpoint = createDepthTextureManager(
    SINGLE_SAMPLE,
    LINE_ENDPOINT_FORMAT,
    SAMPLED_ATTACHMENT
  );
  private readonly lineDepth = createDepthTextureManager(
    SINGLE_SAMPLE,
    DEPTH_FORMAT,
    SAMPLED_ATTACHMENT
  );

  ensure(device: GPUDevice, width: number, height: number): SceneTargetViews {
    return {
      depth: this.depth.ensureView(device, width, height),
      faceDepth: this.faceDepth.ensureView(device, width, height),
      lineEndpoint: this.lineEndpoint.ensureView(device, width, height),
      lineDepth: this.lineDepth.ensureView(device, width, height),
    };
  }

  dispose(): void {
    this.depth.dispose();
    this.faceDepth.dispose();
    this.lineEndpoint.dispose();
    this.lineDepth.dispose();
  }
}
