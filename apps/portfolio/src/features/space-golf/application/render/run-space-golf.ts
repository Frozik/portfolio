import { createGpuContext } from '@frozik/utils/webgpu/createGpuContext';
import { createMsaaTextureManager } from '@frozik/utils/webgpu/msaaTextureManager';
import { RenderLayerManager } from '@frozik/utils/webgpu/renderLayerManager';
import { startRenderLoop } from '@frozik/utils/webgpu/renderLoop';
import { runGpuApp } from '@frozik/utils/webgpu/runGpuApp';
import { isNil } from 'lodash-es';

import { createBoardPointerInput } from '../../infrastructure/input/board-pointer-input';
import { BoardLayer } from '../../infrastructure/layers/board-layer';
import { createGameUpdateLayer } from '../../infrastructure/layers/game-update-layer';
import { MSAA_SAMPLE_COUNT } from '../../infrastructure/render-constants';
import { viewportOf } from '../../infrastructure/render/board-viewport';
import type { SceneFrame } from '../../infrastructure/render/scene-frame';
import { VIEW_PIXELS_PER_METER } from '../camera';
import type { SpaceGolfStore } from '../SpaceGolfStore';
import { bandToBoard, toBand } from './band-points';

interface SpaceGolfGpuSession {
  readonly cleanup: VoidFunction;
}

/**
 * Binds the game to a canvas: the pointer feeds the store's band, the
 * render loop steps the store and draws the board on every animation frame
 * — the dust never stands still. Returns as soon as the input is live; the
 * device request runs on behind it, and an unmount that beats it tears the
 * session down the moment it arrives.
 */
export function runSpaceGolf({
  canvas,
  store,
}: {
  readonly canvas: HTMLCanvasElement;
  readonly store: SpaceGolfStore;
}): VoidFunction {
  const getScene = (): SceneFrame | undefined => {
    const scene = store.scene;
    if (isNil(scene)) {
      return undefined;
    }
    store.view.resize({ width: canvas.clientWidth, height: canvas.clientHeight });
    const preview = store.preview;
    // The canvas is sized in device pixels and the one scale is in CSS pixels.
    const pixelRatio = canvas.clientWidth > 0 ? canvas.width / canvas.clientWidth : 1;
    const viewport = viewportOf(
      scene.view.center,
      VIEW_PIXELS_PER_METER * scene.view.zoom * pixelRatio,
      canvas
    );
    const { aiming } = store;
    const band = isNil(aiming)
      ? undefined
      : {
          anchor: bandToBoard(viewport, aiming.anchor, pixelRatio),
          pull: bandToBoard(viewport, aiming.pull, pixelRatio),
          meterOnBoard: 1 / scene.view.zoom,
        };
    // The ring goes with the dots: a slack band shows neither, so the
    // player sees at a glance that letting go now plays no stroke.
    return {
      ...scene,
      preview,
      band,
      aimRing: !isNil(preview),
      viewport,
      visible: store.view.visible,
    };
  };

  const stopPointerInput = createBoardPointerInput(canvas, {
    toBand,
    onPan: store.view.pan,
    onZoom: store.view.zoomBy,
    onAttach: store.view.centerOnBall,
    onAnchor: store.beginAim,
    onPull: store.updateAim,
    onRelease: store.release,
    onCancel: store.cancelAim,
  });

  const stopGpuApp = runGpuApp<SpaceGolfGpuSession>({
    init: async () => {
      const context = await createGpuContext(canvas);
      const { device } = context;
      try {
        const msaaManager = createMsaaTextureManager(MSAA_SAMPLE_COUNT);
        const layerManager = new RenderLayerManager([
          createGameUpdateLayer(store.advance),
          new BoardLayer(msaaManager, getScene),
        ]);
        layerManager.initAll(context);
        const stopRenderLoop = startRenderLoop({ canvas, context, layerManager });
        return {
          cleanup: () => {
            stopRenderLoop();
            layerManager.dispose();
            msaaManager.dispose();
            device.destroy();
          },
        };
      } catch (error) {
        device.destroy();
        throw error;
      }
    },
    initErrorMessage: 'Failed to initialize Space Golf',
  });

  return () => {
    stopPointerInput();
    stopGpuApp();
  };
}
