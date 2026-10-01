import { MS_PER_SECOND } from '@frozik/utils/date/constants';
import { createGpuContext } from '@frozik/utils/webgpu/createGpuContext';
import { createDepthTextureManager } from '@frozik/utils/webgpu/depthTextureManager';
import { createMsaaTextureManager } from '@frozik/utils/webgpu/msaaTextureManager';
import type { FrameState } from '@frozik/utils/webgpu/renderLayer';
import { RenderLayerManager } from '@frozik/utils/webgpu/renderLayerManager';
import { startRenderLoop } from '@frozik/utils/webgpu/renderLoop';
import type { GpuAppSession } from '@frozik/utils/webgpu/runGpuApp';
import { runGpuApp } from '@frozik/utils/webgpu/runGpuApp';
import { createUpdateOnlyLayer } from '@frozik/utils/webgpu/updateOnlyLayer';

import { MSAA_SAMPLE_COUNT } from '../../domain/sun-constants';
import {
  diagnoseGpuFailure,
  readGpuCapabilities,
} from '../../infrastructure/gpu-capabilities-reader';
import { SUN_DEPTH_FORMAT, SunLayer } from '../../infrastructure/layers/sun-layer';
import { createSunCameraController } from '../../infrastructure/sun-camera-controller';
import { readWebGlInfo } from '../../infrastructure/webgl-info';
import type { SunStore } from '../SunStore';

export function runSun({
  canvas,
  store,
}: {
  readonly canvas: HTMLCanvasElement;
  readonly store: SunStore;
}): VoidFunction {
  // The frame clock starts from nought with every run: a test begun on an earlier one cannot go on.
  store.restart();
  store.webGlFound(readWebGlInfo());
  const camera = createSunCameraController(canvas);
  const stopGpuApp = runGpuApp({
    init: () => initSun(canvas, camera, store),
    initErrorMessage: 'Failed to initialize sun renderer',
    onInitError: error => {
      void diagnoseGpuFailure(error).then(store.gpuMissing);
    },
  });
  return () => {
    camera.destroy();
    stopGpuApp();
  };
}

async function initSun(
  canvas: HTMLCanvasElement,
  camera: ReturnType<typeof createSunCameraController>,
  store: SunStore
): Promise<GpuAppSession> {
  const context = await createGpuContext(canvas);
  store.gpuFound(readGpuCapabilities(context.adapter, context.format));
  void context.device.lost.then(lost => {
    if (lost.reason !== 'destroyed') {
      store.gpuMissing({ reason: 'device-lost', detail: lost.message });
    }
  });

  const msaaManager = createMsaaTextureManager(MSAA_SAMPLE_COUNT);
  const depthManager = createDepthTextureManager(MSAA_SAMPLE_COUNT, SUN_DEPTH_FORMAT);
  const layerManager = new RenderLayerManager([
    createUpdateOnlyLayer(state => feedBenchmark(store, state)),
    new SunLayer(context, camera, msaaManager, depthManager, () => store.triangles),
  ]);
  const stopRenderLoop = startRenderLoop({
    canvas,
    context,
    layerManager,
    onFpsUpdate: store.reportFps,
    // The display's rate is read off frames that draw nothing.
    shouldRender: () => store.triangles > 0,
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

function feedBenchmark(store: SunStore, state: FrameState): void {
  const { viewport } = store;
  if (
    viewport?.width !== state.canvasWidth ||
    viewport.height !== state.canvasHeight ||
    viewport.devicePixelRatio !== state.devicePixelRatio
  ) {
    store.resize({
      width: state.canvasWidth,
      height: state.canvasHeight,
      devicePixelRatio: state.devicePixelRatio,
    });
  }
  store.frame(state.time * MS_PER_SECOND);
}
