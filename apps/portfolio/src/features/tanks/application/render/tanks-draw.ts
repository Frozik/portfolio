import { createGpuContext } from '@frozik/utils/webgpu/createGpuContext';
import type { FrameState, RenderLayer } from '@frozik/utils/webgpu/renderLayer';
import { RenderLayerManager } from '@frozik/utils/webgpu/renderLayerManager';
import { startRenderLoop } from '@frozik/utils/webgpu/renderLoop';
import { isNil } from 'lodash-es';

import { TICKS_PER_SECOND } from '../../domain/constants';
import type { PlayerInputs, WorldEvent } from '../../domain/types';
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

const SECONDS_PER_TICK = 1 / TICKS_PER_SECOND;
/** Tab-switch stalls must not be replayed (§5). */
const MAX_TICKS_PER_FRAME = 4;
const MAX_ACCUMULATED_SECONDS = MAX_TICKS_PER_FRAME * SECONDS_PER_TICK;

export interface ITanksSimulationHost {
  isSimulating(): boolean;
  /** A pause freezes effects too; the stage-clear interlude lets the last explosion play out. */
  areEffectsRunning(): boolean;
  readInputs(): PlayerInputs;
  /** The world reuses its event array between ticks — read synchronously, never store the array. */
  onTick(inputs: PlayerInputs, events: readonly WorldEvent[]): void;
}

export interface ITanksRenderOptions {
  readonly canvas: HTMLCanvasElement;
  readonly worldRef: TanksWorldRef;
  readonly host: ITanksSimulationHost;
  readonly onFpsUpdate?: (fps: number) => void;
}

/** Runs first in the layer list so the other layers read a freshly stepped world. */
class SimulationDriver implements RenderLayer {
  private accumulatedSeconds = 0;
  private previousTimeSeconds: number | undefined;

  constructor(
    private readonly worldRef: TanksWorldRef,
    private readonly effects: EffectList,
    private readonly scorePopups: ScorePopupList,
    private readonly host: ITanksSimulationHost
  ) {}

  init(): void {}

  update(state: FrameState): void {
    const previousTimeSeconds = this.previousTimeSeconds;
    this.previousTimeSeconds = state.time;

    const isSimulating = this.host.isSimulating();
    const isAnimating = isSimulating || this.host.areEffectsRunning();

    if (isNil(previousTimeSeconds) || !isAnimating) {
      this.accumulatedSeconds = 0;

      return;
    }

    this.accumulatedSeconds = Math.min(
      this.accumulatedSeconds + (state.time - previousTimeSeconds),
      MAX_ACCUMULATED_SECONDS
    );

    while (this.accumulatedSeconds >= SECONDS_PER_TICK) {
      if (isSimulating) {
        const inputs = this.host.readInputs();
        const events = this.worldRef.current.tick(inputs);

        this.effects.consume(events);
        this.scorePopups.consume(events);
        this.host.onTick(inputs, events);
      }

      this.effects.advance();
      this.scorePopups.advance();

      this.accumulatedSeconds -= SECONDS_PER_TICK;
    }
  }

  render(): void {}

  dispose(): void {}
}

/** Discards the renderer if the caller tore down while the device was still coming up. */
export function runTanks(options: ITanksRenderOptions): VoidFunction {
  let destroyed = false;
  let gpuCleanup: VoidFunction | undefined;

  void initTanks(options).then(
    cleanup => {
      if (destroyed) {
        cleanup();
      } else {
        gpuCleanup = cleanup;
      }
    },
    (error: unknown) => {
      // biome-ignore lint/suspicious/noConsole: surfaces WebGPU tanks renderer init failure
      console.error('Failed to initialize tanks renderer', error);
    }
  );

  return () => {
    destroyed = true;
    gpuCleanup?.();
  };
}

async function initTanks(options: ITanksRenderOptions): Promise<VoidFunction> {
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

    // Draw order is the concealment model (§11.3): ground, bodies, canopy, indicators.
    const layerManager = new RenderLayerManager([
      new SimulationDriver(worldRef, effects, scorePopups, host),
      createUniformUpdateLayer(uniforms),
      new TerrainLayer(quadPipeline, terrainCache),
      new SpriteLayer(quadPipeline, atlas, worldRef, effects),
      new ForestLayer(quadPipeline, terrainCache),
      new SpriteOverlayLayer(quadPipeline, atlas, worldRef, scorePopups),
    ]);

    layerManager.initAll(context);

    const stopRenderLoop = startRenderLoop({ canvas, context, layerManager, onFpsUpdate });

    return () => {
      stopRenderLoop();
      layerManager.dispose();
      uniforms.dispose();
      atlas.dispose();
      device.destroy();
    };
  } catch (error) {
    device.destroy();

    throw error;
  }
}
