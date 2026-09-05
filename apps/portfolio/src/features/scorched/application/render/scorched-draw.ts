import { createGpuContext } from '@frozik/utils/webgpu/createGpuContext';
import type { FrameState, RenderLayer } from '@frozik/utils/webgpu/renderLayer';
import { RenderLayerManager } from '@frozik/utils/webgpu/renderLayerManager';
import { startRenderLoop } from '@frozik/utils/webgpu/renderLoop';
import { isNil } from 'lodash-es';

import { TICKS_PER_SECOND } from '../../domain/constants';
import type { NapalmPool, WorldEvent } from '../../domain/types';
import type { AimGhost } from '../../infrastructure/aim-ghost';
import { createTerrainCompute } from '../../infrastructure/compute/terrain-compute';
import { TerrainOpQueue } from '../../infrastructure/compute/terrain-op-queue';
import { LaserBeamList } from '../../infrastructure/laser-beams';
import { OverlayLayer } from '../../infrastructure/layers/overlay-layer';
import { ParticleLayer } from '../../infrastructure/layers/particle-layer';
import { ProjectileLayer } from '../../infrastructure/layers/projectile-layer';
import { SkyLayer } from '../../infrastructure/layers/sky-layer';
import { TankLayer } from '../../infrastructure/layers/tank-layer';
import { TerrainComputeLayer } from '../../infrastructure/layers/terrain-compute-layer';
import { TerrainLayer } from '../../infrastructure/layers/terrain-layer';
import { createUniformUpdateLayer } from '../../infrastructure/layers/uniform-update-layer';
import { ParticlePool } from '../../infrastructure/particles/particle-pool';
import {
  createBurningPoolFlames,
  createEventParticles,
} from '../../infrastructure/particles/particle-spawn';
import { ProjectileTrails } from '../../infrastructure/projectile-trails';
import { createReducedMotionWatcher } from '../../infrastructure/reduced-motion';
import { RetreatFlightList } from '../../infrastructure/retreat-flights';
import type { ScorchedInput } from '../../infrastructure/scorched-input';
import type { ScorchedRoundRef } from '../../infrastructure/scorched-round-ref';
import { createScorchedUniforms } from '../../infrastructure/scorched-uniforms';
import { ScreenShake } from '../../infrastructure/screen-shake';
import { createShapePipeline } from '../../infrastructure/shape-pipeline';
import type { SkyPreset } from '../../infrastructure/sky-presets';
import { TerrainTextureSet } from '../../infrastructure/terrain-texture';

const SECONDS_PER_TICK = 1 / TICKS_PER_SECOND;
/** Tab-switch stalls must not be replayed: at most four ticks are caught up per frame (§4). */
const MAX_TICKS_PER_FRAME = 4;
const MAX_ACCUMULATED_SECONDS = MAX_TICKS_PER_FRAME * SECONDS_PER_TICK;
/** Half a flame lifetime: successive waves overlap into one continuous blaze. */
const FLAME_WAVE_INTERVAL_SECONDS = 0.55;
/** How long a napalm strike stays alight on screen before the fire dies down. */
const NAPALM_BLAZE_SECONDS = 2;
const NO_ELAPSED_SECONDS = 0;

/** What the renderer needs from the application layer, without importing the MobX store. */
export interface IScorchedSimulationHost {
  /** True only while a shot is in the air — the turn stands still the rest of the time (§4). */
  isTicking(): boolean;
  /** Polled once a frame; the source owns its own repeat timing. */
  readInput(): ScorchedInput;
  /** Wall-clock frame: ages the floating overlays and lets an AI wind its barrel across (§9). */
  advanceFrame(elapsedSeconds: number): readonly WorldEvent[];
  /** Applies a frame of aiming, returning the events a shot going off produced. */
  applyInput(input: ScorchedInput): readonly WorldEvent[];
  /**
   * Advances the world one tick and returns its events. The round reuses its event array between
   * ticks, so implementations must read what they need and never store the array.
   */
  tick(): readonly WorldEvent[];
}

export interface IScorchedRenderOptions {
  readonly canvas: HTMLCanvasElement;
  readonly roundRef: ScorchedRoundRef;
  readonly host: IScorchedSimulationHost;
  readonly skyPreset: SkyPreset;
  readonly aimGhost: AimGhost;
  /** Everything the world emitted this frame, for the side-effects the shell owns (audio). */
  readonly onEvents?: (events: readonly WorldEvent[]) => void;
  /** Dev-only FPS readout; omitted on hosted builds so no meter is created at all. */
  readonly onFpsUpdate?: (fps: number) => void;
}

interface SimulationDriverParams {
  readonly host: IScorchedSimulationHost;
  readonly roundRef: ScorchedRoundRef;
  readonly opQueue: TerrainOpQueue;
  readonly particles: ParticlePool;
  readonly beams: LaserBeamList;
  readonly retreats: RetreatFlightList;
  readonly shake: ScreenShake;
  readonly onEvents?: (events: readonly WorldEvent[]) => void;
}

/**
 * Fixed-timestep driver: rendering runs at whatever rate the display offers, the simulation
 * advances in whole 1/60 s ticks and only while a shell is flying. Aiming is polled every frame
 * instead — an aiming turn produces no ticks at all. Runs first in the layer list so the drawing
 * layers read a freshly stepped world; it never draws anything itself.
 *
 * It is also the single funnel every world event passes through: the terrain stamps, the cosmetic
 * particles, the laser beams, the retreat helicopters, the screen shake and the audio all read the
 * same array, once.
 */
class SimulationDriver implements RenderLayer {
  private accumulatedSeconds = 0;
  private flameWaveSeconds = 0;
  private blazeRemainingSeconds = 0;
  private blazingPools: readonly NapalmPool[] = [];
  private previousTimeSeconds: number | undefined;
  private frameTimeSeconds = 0;
  private syncedRoundVersion: number;

  constructor(private readonly params: SimulationDriverParams) {
    this.syncedRoundVersion = params.roundRef.version;
  }

  init(): void {}

  update(state: FrameState): void {
    const previousTimeSeconds = this.previousTimeSeconds;
    const elapsedSeconds = isNil(previousTimeSeconds)
      ? NO_ELAPSED_SECONDS
      : state.time - previousTimeSeconds;

    this.frameTimeSeconds = state.time;
    this.previousTimeSeconds = state.time;
    this.discardStaleEffects();
    this.route(this.params.host.advanceFrame(elapsedSeconds));
    this.route(this.params.host.applyInput(this.params.host.readInput()));
    this.keepNapalmBurning(elapsedSeconds);

    if (isNil(previousTimeSeconds) || !this.params.host.isTicking()) {
      this.accumulatedSeconds = 0;

      return;
    }

    this.accumulatedSeconds = Math.min(
      this.accumulatedSeconds + elapsedSeconds,
      MAX_ACCUMULATED_SECONDS
    );

    // [§13 "Feel"] Hit-stop withholds ticks rather than dropping them: the accumulator keeps
    // filling to its cap, so the shell resumes from exactly where the impact froze it.
    while (
      this.accumulatedSeconds >= SECONDS_PER_TICK &&
      this.params.host.isTicking() &&
      !this.params.shake.isHitStopped
    ) {
      this.route(this.params.host.tick());
      this.accumulatedSeconds -= SECONDS_PER_TICK;
    }
  }

  render(): void {}

  dispose(): void {}

  /** The strike stays alight with overlapping flame waves, then dies down on schedule. */
  private keepNapalmBurning(elapsedSeconds: number): void {
    if (this.blazeRemainingSeconds <= 0) {
      return;
    }

    this.blazeRemainingSeconds -= elapsedSeconds;
    this.flameWaveSeconds += elapsedSeconds;

    if (this.blazeRemainingSeconds <= 0) {
      this.blazingPools = [];

      return;
    }

    if (this.flameWaveSeconds < FLAME_WAVE_INTERVAL_SECONDS) {
      return;
    }

    this.flameWaveSeconds = 0;
    this.params.particles.spawn(createBurningPoolFlames(this.blazingPools));
  }

  /** A new round is a new field: last round's smoke and beams have nothing to hang on. */
  private discardStaleEffects(): void {
    if (this.syncedRoundVersion === this.params.roundRef.version) {
      return;
    }

    this.syncedRoundVersion = this.params.roundRef.version;
    this.blazingPools = [];
    this.blazeRemainingSeconds = 0;
    this.params.particles.clear();
    this.params.beams.clear();
    this.params.retreats.clear();
    this.params.shake.clear();
  }

  private route(events: readonly WorldEvent[]): void {
    if (events.length === 0) {
      return;
    }

    for (const event of events) {
      if (event.type === 'napalm-pooled') {
        this.blazingPools = event.pools;
        this.blazeRemainingSeconds = NAPALM_BLAZE_SECONDS;
        this.flameWaveSeconds = 0;
      }
    }

    this.params.opQueue.consume(events);
    this.params.beams.consume(events);
    this.params.retreats.consume(events);
    this.params.shake.consume(events, this.frameTimeSeconds);
    this.params.particles.spawn(createEventParticles(events));
    this.params.onEvents?.(events);
  }
}

/**
 * Sync wrapper over the async GPU bring-up (§11): returns the teardown immediately, and discards
 * the renderer if the caller tore down while the device was still coming up.
 */
export function runScorched(options: IScorchedRenderOptions): VoidFunction {
  let destroyed = false;
  let gpuCleanup: VoidFunction | undefined;

  void initScorched(options).then(
    cleanup => {
      if (destroyed) {
        cleanup();
      } else {
        gpuCleanup = cleanup;
      }
    },
    (error: unknown) => {
      // oxlint-disable-next-line no-console -- surfaces WebGPU scorched renderer init failure
      console.error('Failed to initialize scorched renderer', error);
    }
  );

  return () => {
    destroyed = true;
    gpuCleanup?.();
  };
}

async function initScorched(options: IScorchedRenderOptions): Promise<VoidFunction> {
  const { canvas, roundRef, host, skyPreset, aimGhost, onEvents, onFpsUpdate } = options;
  const context = await createGpuContext(canvas);
  const { device } = context;

  // Nothing after this point returns the teardown to the caller, so a shader that fails to
  // compile would otherwise leave the adapter holding a live device for the page's lifetime.
  try {
    const uniforms = createScorchedUniforms(device);
    const shapePipeline = createShapePipeline({
      device,
      format: context.format,
      uniformBuffer: uniforms.buffer,
    });
    const textures = new TerrainTextureSet(device);
    const compute = createTerrainCompute(device, textures);
    const opQueue = new TerrainOpQueue();
    const trails = new ProjectileTrails();
    const particles = new ParticlePool(device);
    const beams = new LaserBeamList();
    const retreats = new RetreatFlightList();
    const reducedMotion = createReducedMotionWatcher();
    const shake = new ScreenShake(reducedMotion);

    // Draw order is the scene from back to front: sky, the dirt the compute passes just settled,
    // the tanks standing on it, the shells crossing in front, and the cosmetic layers on top.
    const layerManager = new RenderLayerManager([
      new SimulationDriver({
        host,
        roundRef,
        opQueue,
        particles,
        beams,
        retreats,
        shake,
        onEvents,
      }),
      createUniformUpdateLayer(uniforms, shake),
      new TerrainComputeLayer(roundRef, textures, compute, opQueue),
      new SkyLayer(uniforms.buffer, skyPreset),
      new TerrainLayer(uniforms.buffer, textures),
      new TankLayer(shapePipeline, roundRef),
      new ProjectileLayer(shapePipeline, roundRef, trails),
      new ParticleLayer(uniforms.buffer, particles),
      new OverlayLayer(shapePipeline, roundRef, aimGhost, beams, retreats),
    ]);

    layerManager.initAll(context);

    const stopRenderLoop = startRenderLoop({ canvas, context, layerManager, onFpsUpdate });

    return () => {
      stopRenderLoop();
      layerManager.dispose();
      reducedMotion.dispose();
      particles.dispose();
      compute.dispose();
      textures.dispose();
      uniforms.dispose();
      device.destroy();
    };
  } catch (error) {
    device.destroy();

    throw error;
  }
}
