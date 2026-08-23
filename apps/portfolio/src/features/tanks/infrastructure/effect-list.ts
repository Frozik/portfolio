import { assert } from '@frozik/utils/assert/assert';
import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';

import type { BulletEndReason, WorldEvent } from '../domain/types';
import {
  LARGE_EXPLOSION_SIZE_WU,
  MAX_ACTIVE_EFFECTS,
  SMALL_EXPLOSION_SIZE_WU,
} from './render-constants';
import { getLargeExplosionSpriteId, getSmallExplosionSpriteId } from './sprites/sprite-ids';

export type EffectKind = 'tank-explosion' | 'base-explosion' | 'bullet-clang';

export interface EffectFrame {
  readonly spriteId: string;
  readonly sizeWu: number;
  readonly holdTicks: number;
}

export interface ActiveEffect {
  readonly kind: EffectKind;
  readonly centerXWu: number;
  readonly centerYWu: number;
  ticksElapsed: number;
}

interface EffectTimeline {
  readonly frames: readonly EffectFrame[];
  readonly frameEndTicks: readonly number[];
  readonly durationTicks: number;
}

const SMALL_FRAME_TICKS = 3;
const TANK_FRAME_TICKS = 6;
const BASE_GROWTH_FRAME_TICKS = 3;
const BASE_BLAST_FRAME_TICKS = 6;

function smallFrame(frameIndex: number, holdTicks: number): EffectFrame {
  return {
    spriteId: getSmallExplosionSpriteId(frameIndex),
    sizeWu: SMALL_EXPLOSION_SIZE_WU,
    holdTicks,
  };
}

function largeFrame(frameIndex: number, holdTicks: number): EffectFrame {
  return {
    spriteId: getLargeExplosionSpriteId(frameIndex),
    sizeWu: LARGE_EXPLOSION_SIZE_WU,
    holdTicks,
  };
}

function createTimeline(frames: readonly EffectFrame[]): EffectTimeline {
  const frameEndTicks: number[] = [];
  let elapsedTicks = 0;

  for (const frame of frames) {
    elapsedTicks += frame.holdTicks;
    frameEndTicks.push(elapsedTicks);
  }

  return { frames, frameEndTicks, durationTicks: elapsedTicks };
}

const TANK_EXPLOSION_TIMELINE = createTimeline([
  smallFrame(0, TANK_FRAME_TICKS),
  smallFrame(1, TANK_FRAME_TICKS),
  smallFrame(2, TANK_FRAME_TICKS),
  largeFrame(0, TANK_FRAME_TICKS),
  largeFrame(1, TANK_FRAME_TICKS),
  smallFrame(1, TANK_FRAME_TICKS),
]);

const BASE_EXPLOSION_TIMELINE = createTimeline([
  smallFrame(0, BASE_GROWTH_FRAME_TICKS),
  smallFrame(1, BASE_GROWTH_FRAME_TICKS),
  smallFrame(2, BASE_GROWTH_FRAME_TICKS),
  largeFrame(0, BASE_BLAST_FRAME_TICKS),
  largeFrame(1, BASE_BLAST_FRAME_TICKS),
  largeFrame(0, BASE_BLAST_FRAME_TICKS),
  smallFrame(1, BASE_BLAST_FRAME_TICKS),
  smallFrame(0, BASE_BLAST_FRAME_TICKS),
]);

const BULLET_CLANG_TIMELINE = createTimeline([
  smallFrame(0, SMALL_FRAME_TICKS),
  smallFrame(1, SMALL_FRAME_TICKS),
  smallFrame(2, SMALL_FRAME_TICKS),
]);

const TIMELINE_BY_KIND: Readonly<Record<EffectKind, EffectTimeline>> = {
  'tank-explosion': TANK_EXPLOSION_TIMELINE,
  'base-explosion': BASE_EXPLOSION_TIMELINE,
  'bullet-clang': BULLET_CLANG_TIMELINE,
};

/** `tank` is deliberately absent — a shield swallowing a bullet must not clang (§7). */
const CLANGING_BULLET_REASONS: readonly BulletEndReason[] = ['terrain', 'steel', 'border'];

export function getEffectFrame(effect: ActiveEffect): EffectFrame {
  const { frames, frameEndTicks } = TIMELINE_BY_KIND[effect.kind];
  const frameIndex = frameEndTicks.findIndex(endTick => effect.ticksElapsed < endTick);
  const frame = frames[frameIndex === -1 ? frames.length - 1 : frameIndex];

  assert(!isNil(frame), `effect timeline for ${effect.kind} is empty`);

  return frame;
}

/** Deliberately not MobX: 60 mutations/s through observables would put React on the frame path. */
export class EffectList {
  private effects: ActiveEffect[] = [];

  get items(): readonly ActiveEffect[] {
    return this.effects;
  }

  /** The world reuses its event array between ticks — read synchronously, keep no reference. */
  consume(events: readonly WorldEvent[]): void {
    for (const event of events) {
      switch (event.type) {
        case 'stage-started':
          this.clear();
          break;
        case 'enemy-destroyed':
        case 'player-destroyed':
          this.spawn('tank-explosion', event.position);
          break;
        case 'bullet-ended':
          this.spawnBulletImpact(event.reason, event.position);
          break;
        default:
          break;
      }
    }
  }

  advance(): void {
    let hasExpired = false;

    for (const effect of this.effects) {
      effect.ticksElapsed++;
      hasExpired = hasExpired || effect.ticksElapsed >= TIMELINE_BY_KIND[effect.kind].durationTicks;
    }

    if (hasExpired) {
      this.effects = this.effects.filter(
        effect => effect.ticksElapsed < TIMELINE_BY_KIND[effect.kind].durationTicks
      );
    }
  }

  clear(): void {
    this.effects = [];
  }

  /** `base-destroyed` carries no position — the eagle's death is drawn from the killing bullet. */
  private spawnBulletImpact(reason: BulletEndReason, position: Vector2): void {
    if (reason === 'eagle') {
      this.spawn('base-explosion', position);

      return;
    }

    if (CLANGING_BULLET_REASONS.includes(reason)) {
      this.spawn('bullet-clang', position);
    }
  }

  private spawn(kind: EffectKind, center: Vector2): void {
    if (this.effects.length >= MAX_ACTIVE_EFFECTS) {
      return;
    }

    this.effects.push({ kind, centerXWu: center.x, centerYWu: center.y, ticksElapsed: 0 });
  }
}
