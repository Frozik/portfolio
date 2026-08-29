import type { Vector2 } from '@frozik/utils/math/vector2';
import { POWER_UP_PICKUP_POINTS } from '../domain/constants';

import type { WorldEvent } from '../domain/types';
import {
  MAX_ACTIVE_SCORE_POPUPS,
  SCORE_POPUP_KILL_TICKS,
  SCORE_POPUP_PICKUP_TICKS,
} from './render-constants';

/** A floating point value drawn in tiny numerals over the spot that earned it (§11.5). */
export interface ScorePopup {
  readonly digits: readonly number[];
  readonly centerXWu: number;
  readonly centerYWu: number;
  readonly durationTicks: number;
  ticksElapsed: number;
}

const DECIMAL_RADIX = 10;

/** Splits a score into the numerals to draw, most significant first. */
export function toScoreDigits(points: number): readonly number[] {
  const digits: number[] = [];
  let remaining = Math.max(Math.trunc(points), 0);

  do {
    digits.unshift(remaining % DECIMAL_RADIX);
    remaining = Math.floor(remaining / DECIMAL_RADIX);
  } while (remaining > 0);

  return digits;
}

/**
 * Not MobX for the same reason as `EffectList`. Grenade kills arrive as
 * `enemy-destroyed` with `points: 0` (they explode but award nothing — §11.5),
 * so zero-point kills are skipped here.
 */
export class ScorePopupList {
  private popups: ScorePopup[] = [];

  get items(): readonly ScorePopup[] {
    return this.popups;
  }

  /** Reads one tick's events; the world reuses its array, so nothing here outlives the call. */
  consume(events: readonly WorldEvent[]): void {
    for (const event of events) {
      switch (event.type) {
        case 'stage-started':
          this.clear();
          break;
        case 'enemy-destroyed':
          if (event.points > 0) {
            this.spawn(event.points, event.position, SCORE_POPUP_KILL_TICKS);
          }
          break;
        case 'power-up-taken':
          this.spawn(POWER_UP_PICKUP_POINTS, event.position, SCORE_POPUP_PICKUP_TICKS);
          break;
        default:
          break;
      }
    }
  }

  advance(): void {
    let hasExpired = false;

    for (const popup of this.popups) {
      popup.ticksElapsed++;
      hasExpired = hasExpired || popup.ticksElapsed >= popup.durationTicks;
    }

    if (hasExpired) {
      this.popups = this.popups.filter(popup => popup.ticksElapsed < popup.durationTicks);
    }
  }

  clear(): void {
    this.popups = [];
  }

  private spawn(points: number, center: Vector2, durationTicks: number): void {
    if (this.popups.length >= MAX_ACTIVE_SCORE_POPUPS) {
      return;
    }

    this.popups.push({
      digits: toScoreDigits(points),
      centerXWu: center.x,
      centerYWu: center.y,
      durationTicks,
      ticksElapsed: 0,
    });
  }
}
