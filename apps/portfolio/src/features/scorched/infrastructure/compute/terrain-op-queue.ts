import { assertNever } from '@frozik/utils/assert/assertNever';

import {
  COLLAPSE_GRAVITY_WU_PER_TICK_SQUARED,
  COLLAPSE_SETTLE_MARGIN_TICKS,
} from '../../domain/constants';
import type { CarveShape, WorldEvent } from '../../domain/types';
import { FLOATS_PER_CARVE_OP } from '../render-constants';

/** Matches the `kind` discriminator `carve.wgsl` switches on. */
export const CARVE_OP_KIND = {
  circle: 0,
  wedge: 1,
  scorch: 2,
  deposit: 3,
} as const;

export type CarveOpKind = (typeof CARVE_OP_KIND)[keyof typeof CARVE_OP_KIND];

/** One stamp for the carve pass: a circle, a riot wedge, a napalm char or a dirt deposit. */
export interface CarveOp {
  readonly centerX: number;
  readonly centerY: number;
  readonly radiusWu: number;
  readonly kind: CarveOpKind;
}

const NO_TICKS = 0;
const NAPALM_CHAR_STRIDE_COLUMNS = 3;
const NAPALM_CHAR_RADIUS_WU = 5;

export function toCarveOpKind(shape: CarveShape): CarveOpKind {
  switch (shape) {
    case 'circle':
      return CARVE_OP_KIND.circle;
    case 'wedge':
      return CARVE_OP_KIND.wedge;
    default:
      return assertNever(shape);
  }
}

/**
 * A stamp of radius r can leave at most a column of 2r hanging in the air, and the collapse pass
 * accelerates that column at a constant gravity — so `distance = gravity · ticks² / 2` bounds how
 * long the descent can take. The margin covers the pass's per-tick rounding to whole texels.
 */
export function estimateCollapseTicks(dropWu: number): number {
  const fallTicks = Math.sqrt((2 * Math.max(0, dropWu)) / COLLAPSE_GRAVITY_WU_PER_TICK_SQUARED);

  return Math.ceil(fallTicks) + COLLAPSE_SETTLE_MARGIN_TICKS;
}

/** Packs ops into the flat layout `carve.wgsl` reads, one `CarveOp` struct per four floats. */
export function writeCarveOps(target: Float32Array, ops: readonly CarveOp[]): void {
  ops.forEach((op, index) => {
    const offset = index * FLOATS_PER_CARVE_OP;

    target[offset] = op.centerX;
    target[offset + 1] = op.centerY;
    target[offset + 2] = op.radiusWu;
    target[offset + 3] = op.kind;
  });
}

/**
 * Turns the round's terrain events into GPU work (§11.1). The domain has already resolved the
 * terrain by the time an event is emitted; this only decides what the compute passes have to
 * draw and how long the falling-sand animation must keep running.
 */
export class TerrainOpQueue {
  private ops: CarveOp[] = [];
  private collapseTicks = NO_TICKS;
  private isFullSyncRequested = false;

  consume(events: readonly WorldEvent[]): void {
    for (const event of events) {
      switch (event.type) {
        case 'terrain-carved':
          this.push({
            centerX: event.center.x,
            centerY: event.center.y,
            radiusWu: event.radiusWu,
            kind: toCarveOpKind(event.shape),
          });
          break;
        case 'terrain-deposited':
          this.push({
            centerX: event.center.x,
            centerY: event.center.y,
            radiusWu: event.radiusWu,
            kind: CARVE_OP_KIND.deposit,
          });
          break;
        case 'napalm-pooled':
          for (const pool of event.pools) {
            for (
              let offset = 0;
              offset < pool.surfaceHeights.length;
              offset += NAPALM_CHAR_STRIDE_COLUMNS
            ) {
              // Char stamps move no dirt, so they skip push() and its collapse-tick estimate.
              this.ops.push({
                centerX: pool.firstColumn + offset + 0.5,
                centerY: pool.surfaceHeights[offset],
                radiusWu: NAPALM_CHAR_RADIUS_WU,
                kind: CARVE_OP_KIND.scorch,
              });
            }
          }
          break;
        case 'dirt-poured':
        case 'dirt-settled':
          // A basin fill is no circle stamp — only a fresh texture upload can draw it.
          this.isFullSyncRequested = this.isFullSyncRequested || event.columns.length > 0;
          break;
        default:
          break;
      }
    }
  }

  /** Removes and returns at most `maxCount` ops; the rest wait for the next dispatch. */
  takeOps(maxCount: number): readonly CarveOp[] {
    const taken = this.ops.slice(0, maxCount);

    this.ops = this.ops.slice(maxCount);

    return taken;
  }

  takeCollapseTicks(): number {
    const ticks = this.collapseTicks;

    this.collapseTicks = NO_TICKS;

    return ticks;
  }

  takeFullSyncRequest(): boolean {
    const isRequested = this.isFullSyncRequested;

    this.isFullSyncRequested = false;

    return isRequested;
  }

  clear(): void {
    this.ops = [];
    this.collapseTicks = NO_TICKS;
    this.isFullSyncRequested = false;
  }

  private push(op: CarveOp): void {
    this.ops.push(op);
    this.collapseTicks = Math.max(this.collapseTicks, estimateCollapseTicks(2 * op.radiusWu));
  }
}
