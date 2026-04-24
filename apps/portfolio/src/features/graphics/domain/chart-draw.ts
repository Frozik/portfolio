import { createGpuContext } from '@frozik/utils/webgpu/createGpuContext';
import { createMsaaTextureManager } from '@frozik/utils/webgpu/msaaTextureManager';
import { RenderLayerManager } from '@frozik/utils/webgpu/renderLayerManager';

import { MSAA_SAMPLE_COUNT, OFFSCREEN_FORMAT } from './chart-constants';
import { createOffscreenTextureManager } from './chart-textures';
import { CompositeLayer, createCompositeLayerResources } from './layers/composite-layer';
import { MainPassLayer } from './layers/main-pass-layer';
import { ShapesLayer } from './layers/shapes-layer';
import { SinYLayer } from './layers/sin-y-layer';
import { startRenderLoop } from './render-loop';
import chartSpecificSource from './shaders/chart.wgsl?raw';
import chartCommonSource from './shaders/common.wgsl?raw';

const chartShaderSource = chartCommonSource + chartSpecificSource;

export function runCharter(canvas: HTMLCanvasElement): VoidFunction {
  let destroyed = false;
  let gpuCleanup: (() => void) | undefined;

  void initCharter(canvas).then(cleanup => {
    if (destroyed) {
      cleanup();
    } else {
      gpuCleanup = cleanup;
    }
  });

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

  const mainPassLayer = new MainPassLayer(chartShaderModule, msaaManager);
  const sinYLayer = new SinYLayer(
    offscreenTextureManager,
    compositeResources.compositeBindGroupLayout,
    compositeResources.compositeSampler,
    compositeResources.compositeUniformBuffer,
    chartShaderModule
  );
  const compositeLayer = new CompositeLayer(offscreenTextureManager, compositeResources);
  const shapesLayer = new ShapesLayer();

  const layerManager = new RenderLayerManager([
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
    msaaManager.dispose();
    offscreenTextureManager.destroy();
    device.destroy();
  };
}
