import { createGpuContext } from '@frozik/utils/webgpu/createGpuContext';
import { FpsController } from '@frozik/utils/webgpu/fpsController';
import { createMsaaTextureManager } from '@frozik/utils/webgpu/msaaTextureManager';
import { RenderLayerManager } from '@frozik/utils/webgpu/renderLayerManager';
import { startRenderLoop } from '@frozik/utils/webgpu/renderLoop';
import { runGpuApp } from '@frozik/utils/webgpu/runGpuApp';
import { isNil } from 'lodash-es';

import { BOARD_HEIGHT_METERS, BOARD_WIDTH_METERS } from '../../domain/constants';
import { createBoardPointerInput } from '../../infrastructure/input/board-pointer-input';
import { BoardLayer } from '../../infrastructure/layers/board-layer';
import { createGameUpdateLayer } from '../../infrastructure/layers/game-update-layer';
import { FPS_ACTIVE, FPS_IDLE, MSAA_SAMPLE_COUNT } from '../../infrastructure/render-constants';
import { fitBoard, pixelToBoard } from '../../infrastructure/render/board-viewport';
import type { SceneFrame } from '../../infrastructure/render/scene-frame';
import type { SpaceGolfStore } from '../SpaceGolfStore';

interface SpaceGolfGpuSession {
  readonly cleanup: VoidFunction;
}

/**
 * Binds the game to a canvas: the pointer feeds the store's band, the
 * render loop steps the store and draws the board. Returns as soon as the
 * input is live; the device request runs on behind it, and an unmount that
 * beats it tears the session down the moment it arrives.
 */
export function runSpaceGolf({
  canvas,
  store,
}: {
  readonly canvas: HTMLCanvasElement;
  readonly store: SpaceGolfStore;
}): VoidFunction {
  const fpsController = new FpsController(FPS_IDLE);
  let isDirty = true;

  const markDirty = (): void => {
    isDirty = true;
  };
  const consumeDirty = (): boolean => {
    const wasDirty = isDirty;
    isDirty = false;
    return wasDirty;
  };

  const getScene = (): SceneFrame | undefined => {
    const scene = store.scene;
    if (isNil(scene)) {
      return undefined;
    }
    return {
      ...scene,
      displayedStroke: store.displayedStroke,
      preview: store.preview,
      aimRing: !isNil(store.aiming),
    };
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
    onAnchor: point => {
      store.beginAim(point);
      fpsController.raise(FPS_ACTIVE);
      markDirty();
    },
    onPull: point => {
      store.updateAim(point);
      markDirty();
    },
    onRelease: () => {
      store.release();
      markDirty();
    },
    onCancel: () => {
      store.cancelAim();
      markDirty();
    },
  });

  const stopGpuApp = runGpuApp<SpaceGolfGpuSession>({
    init: async () => {
      const context = await createGpuContext(canvas);
      const { device } = context;
      try {
        const msaaManager = createMsaaTextureManager(MSAA_SAMPLE_COUNT);
        const layerManager = new RenderLayerManager([
          createGameUpdateLayer({ advance: store.advance, getScene, fpsController, markDirty }),
          new BoardLayer(msaaManager, getScene),
        ]);
        layerManager.initAll(context);
        const stopRenderLoop = startRenderLoop({
          canvas,
          context,
          layerManager,
          fpsController,
          shouldRender: consumeDirty,
          onResize: () => {
            markDirty();
            fpsController.raise(FPS_ACTIVE);
          },
        });
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
    fpsController.dispose();
    stopGpuApp();
  };
}
