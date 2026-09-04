import { createGpuContext } from '@frozik/utils/webgpu/createGpuContext';
import { createDepthTextureManager } from '@frozik/utils/webgpu/depthTextureManager';
import { createMsaaTextureManager } from '@frozik/utils/webgpu/msaaTextureManager';
import { RenderLayerManager } from '@frozik/utils/webgpu/renderLayerManager';
import { startRenderLoop } from '@frozik/utils/webgpu/renderLoop';
import type { GpuAppSession } from '@frozik/utils/webgpu/runGpuApp';
import { runGpuApp } from '@frozik/utils/webgpu/runGpuApp';

import type { InstanceBudget } from '../../domain/instance-budget';
import { INITIAL_INSTANCE_BUDGET, instanceCountOf, reportFps } from '../../domain/instance-budget';
import { MSAA_SAMPLE_COUNT } from '../../domain/sun-constants';
import { SUN_DEPTH_FORMAT, SunLayer } from '../../infrastructure/layers/sun-layer';
import { createSunCameraController } from '../../infrastructure/sun-camera-controller';

export function runSun(canvas: HTMLCanvasElement): VoidFunction {
  const camera = createSunCameraController(canvas);
  const stopGpuApp = runGpuApp({
    init: () => initSun(canvas, camera),
    initErrorMessage: 'Failed to initialize sun renderer',
  });
  return () => {
    camera.destroy();
    stopGpuApp();
  };
}

async function initSun(
  canvas: HTMLCanvasElement,
  camera: ReturnType<typeof createSunCameraController>
): Promise<GpuAppSession> {
  const context = await createGpuContext(canvas);
  const msaaManager = createMsaaTextureManager(MSAA_SAMPLE_COUNT);
  const depthManager = createDepthTextureManager(MSAA_SAMPLE_COUNT, SUN_DEPTH_FORMAT);
  let budget: InstanceBudget = INITIAL_INSTANCE_BUDGET;
  const layerManager = new RenderLayerManager([
    new SunLayer(context, camera, msaaManager, depthManager, () => instanceCountOf(budget)),
  ]);
  const stopRenderLoop = startRenderLoop({
    canvas,
    context,
    layerManager,
    onFpsUpdate: fps => {
      budget = reportFps(budget, fps);
    },
  });

  return {
    cleanup: () => {
      stopRenderLoop();
      layerManager.dispose();
      depthManager.dispose();
      msaaManager.dispose();
      context.device.destroy();
    },
  };
}
