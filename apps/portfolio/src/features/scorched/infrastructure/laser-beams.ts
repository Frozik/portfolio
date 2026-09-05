import type { Vector2 } from '@frozik/utils/math/vector2';

import type { PlayerId, WorldEvent } from '../domain/types';
import { LASER_BEAM_FADE_SECONDS, MAX_LASER_BEAMS } from './render-constants';

export interface LaserBeam {
  readonly ownerId: PlayerId;
  readonly from: Vector2;
  readonly to: Vector2;
  /** Falls from 1 to 0 over {@link LASER_BEAM_FADE_SECONDS}; the beam is dropped at zero. */
  readonly remainingFraction: number;
}

/**
 * The laser is instant: the domain resolves the whole beam inside one call and never emits a
 * projectile. So that the shot is visible at all, the beam it reports is kept here for a few
 * frames and faded out — the only piece of the renderer that outlives the event that made it.
 */
export class LaserBeamList {
  private beams: LaserBeam[] = [];

  get current(): readonly LaserBeam[] {
    return this.beams;
  }

  consume(events: readonly WorldEvent[]): void {
    for (const event of events) {
      if (event.type === 'laser-fired') {
        this.beams.push({
          ownerId: event.ownerId,
          from: event.from,
          to: event.to,
          remainingFraction: 1,
        });
      }
    }

    this.beams = this.beams.slice(-MAX_LASER_BEAMS);
  }

  fade(elapsedSeconds: number): void {
    if (this.beams.length === 0) {
      return;
    }

    this.beams = this.beams
      .map(beam => ({
        ...beam,
        remainingFraction: beam.remainingFraction - elapsedSeconds / LASER_BEAM_FADE_SECONDS,
      }))
      .filter(beam => beam.remainingFraction > 0);
  }

  clear(): void {
    this.beams = [];
  }
}
