import { createGpuContext } from '@frozik/utils/webgpu/createGpuContext';
import { RenderLayerManager } from '@frozik/utils/webgpu/renderLayerManager';
import { startRenderLoop } from '@frozik/utils/webgpu/renderLoop';
import type { GpuAppSession } from '@frozik/utils/webgpu/runGpuApp';
import { runGpuApp } from '@frozik/utils/webgpu/runGpuApp';
import { createUpdateOnlyLayer } from '@frozik/utils/webgpu/updateOnlyLayer';

import { EffectList } from '../../infrastructure/effect-list';
import { ForestLayer } from '../../infrastructure/layers/forest-layer';
import { SpriteLayer } from '../../infrastructure/layers/sprite-layer';
import { SpriteOverlayLayer } from '../../infrastructure/layers/sprite-overlay-layer';
import { TerrainLayer } from '../../infrastructure/layers/terrain-layer';
import { createUniformUpdateLayer } from '../../infrastructure/layers/uniform-update-layer';
import { createQuadPipeline } from '../../infrastructure/quad-pipeline';
import { ScorePopupList } from '../../infrastructure/score-popup-list';
import { createSpriteAtlas } from '../../infrastructure/sprite-atlas';
import { createSpriteCatalog } from '../../infrastructure/sprites/sprite-catalog';
import { createTanksUniforms } from '../../infrastructure/tanks-uniforms';
import type { TanksWorldRef } from '../../infrastructure/tanks-world-ref';
import { TerrainInstanceCache } from '../../infrastructure/terrain-instance-cache';
import { createFixedStepSimulation } from '../fixed-step-simulation';
import type { ITanksSimulationHost } from '../tanks-session';

export interface ITanksRenderOptions {
  readonly canvas: HTMLCanvasElement;
  readonly worldRef: TanksWorldRef;
  readonly host: ITanksSimulationHost;
  readonly onFpsUpdate?: (fps: number) => void;
  readonly onInitError: (error: unknown) => void;
}

export function runTanks(options: ITanksRenderOptions): VoidFunction {
  return runGpuApp({
    init: () => initTanks(options),
    initErrorMessage: 'Failed to initialize tanks renderer',
    onInitError: options.onInitError,
  });
}

/** Runs first in the layer list so the other layers read a freshly stepped world. */
function createSimulationLayer(
  worldRef: TanksWorldRef,
  effects: EffectList,
  scorePopups: ScorePopupList,
  host: ITanksSimulationHost
) {
  const simulation = createFixedStepSimulation({
    isRunning: () => host.isSimulating() || host.areEffectsRunning(),
    step: () => {
      if (host.isSimulating()) {
        const inputs = host.readInputs();
        const events = worldRef.current.tick(inputs);

        effects.consume(events);
        scorePopups.consume(events);
        host.onTick(inputs, events);
      }

      effects.advance();
      scorePopups.advance();
    },
  });

  return createUpdateOnlyLayer(state => simulation.advance(state.time));
}

async function initTanks(options: ITanksRenderOptions): Promise<GpuAppSession> {
  const { canvas, worldRef, host, onFpsUpdate } = options;
  const context = await createGpuContext(canvas);
  const { device } = context;

  // A failed shader compile would otherwise leave the adapter holding a live device forever.
  try {
    const atlas = createSpriteAtlas(device, createSpriteCatalog());
    const uniforms = createTanksUniforms(device, worldRef);
    const quadPipeline = createQuadPipeline({
      device,
      format: context.format,
      uniformBuffer: uniforms.buffer,
      atlasTextureView: atlas.textureView,
    });
    const terrainCache = new TerrainInstanceCache(worldRef, atlas);
    const effects = new EffectList();
    const scorePopups = new ScorePopupList();

    // Draw order is the concealment model: ground, bodies, canopy, indicators.
    const layerManager = new RenderLayerManager([
      createSimulationLayer(worldRef, effects, scorePopups, host),
      createUniformUpdateLayer(uniforms),
      new TerrainLayer(quadPipeline, terrainCache),
      new SpriteLayer(quadPipeline, atlas, worldRef, effects),
      new ForestLayer(quadPipeline, terrainCache),
      new SpriteOverlayLayer(quadPipeline, atlas, worldRef, scorePopups),
    ]);

    layerManager.initAll(context);

    const stopRenderLoop = startRenderLoop({ canvas, context, layerManager, onFpsUpdate });

    return {
      cleanup: () => {
        stopRenderLoop();
        layerManager.dispose();
        uniforms.dispose();
        atlas.dispose();
        device.destroy();
      },
    };
  } catch (error) {
    device.destroy();

    throw error;
  }
}
