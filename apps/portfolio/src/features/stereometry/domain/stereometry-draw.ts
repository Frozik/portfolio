import { createGpuContext, createMsaaTextureManager, RenderLayerManager } from '@frozik/utils';

import { PyramidLayer } from './layers/pyramid-layer';
import { startRenderLoop } from './render-loop';
import { createOrbitalCameraController } from './stereometry-camera-controller';
import { MSAA_SAMPLE_COUNT } from './stereometry-constants';

export function runStereometry(canvas: HTMLCanvasElement): VoidFunction {
  let destroyed = false;
  let gpuCleanup: (() => void) | undefined;

  const camera = createOrbitalCameraController(canvas);

  void initStereometry(canvas, camera).then(cleanup => {
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

async function initStereometry(
  canvas: HTMLCanvasElement,
  camera: ReturnType<typeof createOrbitalCameraController>
): Promise<VoidFunction> {
  const context = await createGpuContext(canvas);

  const msaaManager = createMsaaTextureManager(MSAA_SAMPLE_COUNT);
  const pyramidLayer = new PyramidLayer(camera, msaaManager);

  const layerManager = new RenderLayerManager([pyramidLayer]);

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
