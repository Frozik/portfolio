import { createGpuContext } from '@frozik/utils/webgpu/createGpuContext';
import { createMsaaTextureManager } from '@frozik/utils/webgpu/msaaTextureManager';
import { RenderLayerManager } from '@frozik/utils/webgpu/renderLayerManager';
import { startRenderLoop } from '@frozik/utils/webgpu/renderLoop';

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
import { UniformUpdateLayer } from '../../infrastructure/layers/uniform-update-layer';
import chartSpecificSource from '../../infrastructure/shaders/chart.wgsl?raw';
import chartCommonSource from '../../infrastructure/shaders/common.wgsl?raw';
import { createUniformManager } from '../../infrastructure/uniform-manager';

const chartShaderSource = chartCommonSource + chartSpecificSource;

export function runCharter(canvas: HTMLCanvasElement): VoidFunction {
  let destroyed = false;
  let gpuCleanup: (() => void) | undefined;

  void initCharter(canvas).then(
    cleanup => {
      if (destroyed) {
        cleanup();
      } else {
        gpuCleanup = cleanup;
      }
    },
    (error: unknown) => {
      // biome-ignore lint/suspicious/noConsole: surfaces WebGPU charts renderer init failure
      console.error('Failed to initialize charts renderer', error);
    }
  );

  return () => {
    destroyed = true;
    gpuCleanup?.();
  };
}

async function initCharter(canvas: HTMLCanvasElement): Promise<VoidFunction> {
  const context = await createGpuContext(canvas);
  const { device } = context;

  const chartShaderModule = device.createShaderModule({
    code: chartShaderSource,
  });

  const offscreenTextureManager = createOffscreenTextureManager(
    device,
    OFFSCREEN_FORMAT,
    MSAA_SAMPLE_COUNT
  );

  const msaaManager = createMsaaTextureManager(MSAA_SAMPLE_COUNT);
  const compositeResources = createCompositeLayerResources(device);

  const uniformManager = createUniformManager(device, chartCommonSource);

  const uniformUpdateLayer = new UniformUpdateLayer(uniformManager);
  const mainPassLayer = new MainPassLayer(chartShaderModule, msaaManager, uniformManager);
  const sinYLayer = new SinYLayer(
    offscreenTextureManager,
    compositeResources.compositeBindGroupLayout,
    compositeResources.compositeSampler,
    compositeResources.compositeUniformBuffer,
    chartShaderModule,
    uniformManager
  );
  const compositeLayer = new CompositeLayer(offscreenTextureManager, compositeResources);
  const shapesLayer = new ShapesLayer(uniformManager);

  const layerManager = new RenderLayerManager([
    uniformUpdateLayer,
    mainPassLayer,
    sinYLayer,
    compositeLayer,
    shapesLayer,
  ]);

  layerManager.initAll(context);

  const stopRenderLoop = startRenderLoop({
    canvas,
    context,
    layerManager,
  });

  return () => {
    stopRenderLoop();
    layerManager.dispose();
    uniformManager.dispose();
    msaaManager.dispose();
    offscreenTextureManager.destroy();
    device.destroy();
  };
}
