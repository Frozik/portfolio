import { createGpuContext } from '@frozik/utils/webgpu/createGpuContext';
import { createMsaaTextureManager } from '@frozik/utils/webgpu/msaaTextureManager';
import { RenderLayerManager } from '@frozik/utils/webgpu/renderLayerManager';
import { startRenderLoop } from '@frozik/utils/webgpu/renderLoop';
import { runGpuApp } from '@frozik/utils/webgpu/runGpuApp';
import { isNil } from 'lodash-es';

import { BOARD_HEIGHT_METERS, BOARD_WIDTH_METERS } from '../../domain/constants';
import { createBoardPointerInput } from '../../infrastructure/input/board-pointer-input';
import { BoardLayer } from '../../infrastructure/layers/board-layer';
import { createGameUpdateLayer } from '../../infrastructure/layers/game-update-layer';
import { MSAA_SAMPLE_COUNT } from '../../infrastructure/render-constants';
import { fitBoard, pixelToBoard } from '../../infrastructure/render/board-viewport';
import type { SceneFrame } from '../../infrastructure/render/scene-frame';
import type { SpaceGolfStore } from '../SpaceGolfStore';

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
    const preview = store.preview;
    // The ring goes with the dots: a slack band shows neither, so the
    // player sees at a glance that letting go now plays no stroke.
    return { ...scene, preview, aimRing: !isNil(preview) };
  };

  const stopPointerInput = createBoardPointerInput(canvas, {
    toBoard: (cssX, cssY) =>
      pixelToBoard(
        fitBoard(
          { width: canvas.clientWidth, height: canvas.clientHeight },
          { width: BOARD_WIDTH_METERS, height: BOARD_HEIGHT_METERS }
        ),
        { x: cssX, y: cssY }
      ),
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
