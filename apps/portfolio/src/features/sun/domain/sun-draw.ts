import { createGpuContext } from '@frozik/utils/webgpu/createGpuContext';
import { createMsaaTextureManager } from '@frozik/utils/webgpu/msaaTextureManager';
import { RenderLayerManager } from '@frozik/utils/webgpu/renderLayerManager';

import { SunLayer } from './layers/sun-layer';
import { startRenderLoop } from './render-loop';
import { createOrbitalCameraController } from './sun-camera-controller';
import { MSAA_SAMPLE_COUNT } from './sun-constants';

export function runSun(canvas: HTMLCanvasElement): VoidFunction {
  let destroyed = false;
  let gpuCleanup: (() => void) | undefined;

  const camera = createOrbitalCameraController(canvas);

  void initSun(canvas, camera).then(cleanup => {
    if (destroyed) {
      cleanup();
    } else {
      gpuCleanup = cleanup;
    }
  });

  return () => {
    destroyed = true;
    camera.destroy();
    gpuCleanup?.();
  };
}

async function initSun(
  canvas: HTMLCanvasElement,
  camera: ReturnType<typeof createOrbitalCameraController>
): Promise<VoidFunction> {
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

  return () => {
    stopRenderLoop();
    layerManager.dispose();
    msaaManager.dispose();
    context.device.destroy();
  };
}
