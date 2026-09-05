import type { ScenePipelines } from './scene-pipelines';
import type { SceneTargetViews } from './scene-targets';

export interface SceneBindGroups {
  /** Uniforms + face depth: the line passes. */
  readonly line: GPUBindGroup;
  /** Uniforms + face depth + line-id textures: the marker passes. */
  readonly marker: GPUBindGroup;
}

/** Bind groups reference the target views, so a resize builds a fresh pair. */
export function createSceneBindGroups(
  device: GPUDevice,
  pipelines: ScenePipelines,
  uniformBuffer: GPUBuffer,
  depthSampler: GPUSampler,
  views: SceneTargetViews
): SceneBindGroups {
  return {
    line: device.createBindGroup({
      layout: pipelines.depthBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: uniformBuffer } },
        { binding: 1, resource: views.faceDepth },
        { binding: 2, resource: depthSampler },
      ],
    }),
    marker: device.createBindGroup({
      layout: pipelines.markerBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: uniformBuffer } },
        { binding: 1, resource: views.faceDepth },
        { binding: 2, resource: depthSampler },
        { binding: 3, resource: views.lineEndpoint },
        { binding: 4, resource: views.lineDepth },
      ],
    }),
  };
}

export function isSameViews(
  previous: SceneTargetViews | undefined,
  next: SceneTargetViews
): boolean {
  return (
    previous !== undefined &&
    previous.depth === next.depth &&
    previous.faceDepth === next.faceDepth &&
    previous.lineEndpoint === next.lineEndpoint &&
    previous.lineDepth === next.lineDepth
  );
}
