import type { FrameState, RenderLayer } from '@frozik/utils/webgpu/renderLayer';
import { isNil } from 'lodash-es';

import type { TerrainCompute } from '../compute/terrain-compute';
import type { TerrainOpQueue } from '../compute/terrain-op-queue';
import {
  COLLAPSE_SECONDS_PER_STEP,
  MAX_CARVE_OPS_PER_DISPATCH,
  MAX_COLLAPSE_STEPS_PER_FRAME,
} from '../render-constants';
import type { ScorchedRoundRef } from '../scorched-round-ref';
import type { TerrainTextureSet } from '../terrain-texture';

const NO_VERSION = 0;
const NO_TICKS = 0;
const MAX_ACCUMULATED_SECONDS = MAX_COLLAPSE_STEPS_PER_FRAME * COLLAPSE_SECONDS_PER_STEP;

/**
 * Drives the terrain's GPU work: a fresh upload when the round underneath it changes, the
 * queued stamps, and the falling-sand animation for as many 60 Hz steps as real time allows. The
 * animation is stepped on its own clock rather than the display's, so dirt falls at the same
 * speed on a 60 Hz laptop and a 144 Hz monitor, and it only runs while something is still moving.
 */
export class TerrainComputeLayer implements RenderLayer {
  private syncedVersion = NO_VERSION;
  private pendingCollapseTicks = NO_TICKS;
  private accumulatedSeconds = 0;
  private previousTimeSeconds: number | undefined;

  constructor(
    private readonly roundRef: ScorchedRoundRef,
    private readonly textures: TerrainTextureSet,
    private readonly compute: TerrainCompute,
    private readonly opQueue: TerrainOpQueue
  ) {}

  init(): void {}

  update(state: FrameState): void {
    const previousTimeSeconds = this.previousTimeSeconds;

    this.previousTimeSeconds = state.time;

    if (isNil(previousTimeSeconds)) {
      return;
    }

    this.accumulatedSeconds = Math.min(
      this.accumulatedSeconds + (state.time - previousTimeSeconds),
      MAX_ACCUMULATED_SECONDS
    );
  }

  render(encoder: GPUCommandEncoder): void {
    this.syncFromDomainIfNeeded();

    const ops = this.opQueue.takeOps(MAX_CARVE_OPS_PER_DISPATCH);

    this.compute.encodeCarve(encoder, ops);
    this.pendingCollapseTicks += this.opQueue.takeCollapseTicks();

    const steps = Math.min(
      Math.floor(this.accumulatedSeconds / COLLAPSE_SECONDS_PER_STEP),
      this.pendingCollapseTicks
    );

    for (let step = 0; step < steps; step++) {
      this.compute.encodeCollapse(encoder);
    }

    this.pendingCollapseTicks -= steps;
    this.accumulatedSeconds -= steps * COLLAPSE_SECONDS_PER_STEP;
  }

  dispose(): void {}

  /**
   * A replaced round brings a whole new field, and a liquid dirt fill reshapes a whole basin —
   * neither can be expressed as a stamp, so both go through a fresh upload.
   */
  private syncFromDomainIfNeeded(): void {
    const isFullSyncRequested = this.opQueue.takeFullSyncRequest();

    if (this.syncedVersion === this.roundRef.version && !isFullSyncRequested) {
      return;
    }

    this.syncedVersion = this.roundRef.version;
    this.pendingCollapseTicks = NO_TICKS;
    this.textures.sync(this.roundRef.current.field);
    this.compute.resetColumnVelocities();
  }
}
