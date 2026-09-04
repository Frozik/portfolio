import { createGpuContext } from '@frozik/utils/webgpu/createGpuContext';
import { createMsaaTextureManager } from '@frozik/utils/webgpu/msaaTextureManager';
import { RenderLayerManager } from '@frozik/utils/webgpu/renderLayerManager';
import { startRenderLoop } from '@frozik/utils/webgpu/renderLoop';
import type { GpuAppSession } from '@frozik/utils/webgpu/runGpuApp';
import { runGpuApp } from '@frozik/utils/webgpu/runGpuApp';
import { createUpdateOnlyLayer } from '@frozik/utils/webgpu/updateOnlyLayer';

import { MSAA_SAMPLE_COUNT } from '../../domain/chart-constants';
import { OFFSCREEN_FORMAT } from '../../infrastructure/chart-gpu-constants';
import { createOffscreenTextureManager } from '../../infrastructure/chart-textures';
import {
  CompositeLayer,
  createCompositeLayerResources,
} from '../../infrastructure/layers/composite-layer';
import { MainPassLayer } from '../../infrastructure/layers/main-pass-layer';
import { ShapesLayer } from '../../infrastructure/layers/shapes-layer';
import { SinYLayer } from '../../infrastructure/layers/sin-y-layer';
import chartSpecificSource from '../../infrastructure/shaders/chart.wgsl?raw';
import chartCommonSource from '../../infrastructure/shaders/common.wgsl?raw';
import { createUniformManager } from '../../infrastructure/uniform-manager';

const chartShaderSource = chartCommonSource + chartSpecificSource;

export function runCharter(canvas: HTMLCanvasElement): VoidFunction {
  return runGpuApp({
    init: () => initCharter(canvas),
    initErrorMessage: 'Failed to initialize charts renderer',
  });
}

async function initCharter(canvas: HTMLCanvasElement): Promise<GpuAppSession> {
  const context = await createGpuContext(canvas);
  const { device } = context;

  const chartShaderModule = device.createShaderModule({ code: chartShaderSource });
  const uniformManager = createUniformManager(device, chartCommonSource);
  const msaaManager = createMsaaTextureManager(MSAA_SAMPLE_COUNT);
  const compositeResources = createCompositeLayerResources(device);
  const offscreenTextureManager = createOffscreenTextureManager(device, {
    format: OFFSCREEN_FORMAT,
    sampleCount: MSAA_SAMPLE_COUNT,
    compositeBindGroupLayout: compositeResources.bindGroupLayout,
    compositeSampler: compositeResources.sampler,
    compositeUniformBuffer: compositeResources.uniformBuffer,
  });

  const layerManager = new RenderLayerManager([
    createUpdateOnlyLayer(uniformManager.writeFromFrameState),
    new MainPassLayer(context, chartShaderModule, msaaManager, uniformManager),
    new SinYLayer(context, offscreenTextureManager, chartShaderModule, uniformManager),
    new CompositeLayer(context, offscreenTextureManager, compositeResources),
    new ShapesLayer(context, uniformManager),
  ]);
  const stopRenderLoop = startRenderLoop({ canvas, context, layerManager });

  return {
    cleanup: () => {
      stopRenderLoop();
      layerManager.dispose();
      offscreenTextureManager.dispose();
      compositeResources.dispose();
      uniformManager.dispose();
      msaaManager.dispose();
      device.destroy();
    },
  };
}
