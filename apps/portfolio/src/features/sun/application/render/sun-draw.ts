import { createGpuContext } from '@frozik/utils/webgpu/createGpuContext';
import { createMsaaTextureManager } from '@frozik/utils/webgpu/msaaTextureManager';
import { RenderLayerManager } from '@frozik/utils/webgpu/renderLayerManager';
import { startRenderLoop } from '@frozik/utils/webgpu/renderLoop';
import type { GpuAppSession } from '@frozik/utils/webgpu/runGpuApp';
import { runGpuApp } from '@frozik/utils/webgpu/runGpuApp';
import { MSAA_SAMPLE_COUNT } from '../../domain/sun-constants';
import { SunLayer } from '../../infrastructure/layers/sun-layer';
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
  const sunLayer = new SunLayer(camera, msaaManager);

  const layerManager = new RenderLayerManager([sunLayer]);

  layerManager.initAll(context);

  const stopRenderLoop = startRenderLoop({
    canvas,
    context,
    layerManager,
  });

  return {
    cleanup: () => {
      stopRenderLoop();
      layerManager.dispose();
      msaaManager.dispose();
      context.device.destroy();
    },
  };
}
