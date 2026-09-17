import type { Vector2 } from '@frozik/utils/math/vector2';

import { BONUS_RADIUS_METERS } from '../../domain/constants';
import type { MeshWriter } from './mesh-writer';
import { PALETTE } from './palette';

/** The ring is this share of the disc's radius wide. */
const RING_SHARE = 0.14;
/** The logo: a ball and the dots of its flight ahead, bending over and down — foresight. */
const ARC_DOTS = 5;
const ARC_HALF_SPAN_SHARE = 0.56;
const ARC_BASE_SHARE = -0.34;
const ARC_RISE_SHARE = 2.7;
const LOGO_BALL_RADIUS_SHARE = 0.17;
const FIRST_DOT_RADIUS_SHARE = 0.12;
const LAST_DOT_RADIUS_SHARE = 0.05;
/** The disc breathes a little, so it is told from the floaters at a glance. */
const PULSE_SHARE = 0.06;
const PULSE_RADIANS_PER_SECOND = 3;

/**
 * The foresight bonus: a dark disc in a cyan ring with its logo inside — a
 * white ball at the lower left and its dots arcing over to the right, each
 * smaller than the last.
 */
export function writeBonus(writer: MeshWriter, at: Vector2, timeSeconds: number): void {
  const radius =
    BONUS_RADIUS_METERS * (1 + PULSE_SHARE * Math.sin(timeSeconds * PULSE_RADIANS_PER_SECOND));
  writer.circle(at, radius, PALETTE.bonusFill);
  writer.ring(at, radius * (1 - RING_SHARE), radius, PALETTE.bonusRing);
  for (let index = 0; index <= ARC_DOTS; index += 1) {
    const share = index / ARC_DOTS;
    const point: Vector2 = {
      x: at.x + radius * ARC_HALF_SPAN_SHARE * (2 * share - 1),
      y: at.y + radius * (ARC_BASE_SHARE + ARC_RISE_SHARE * share * (1 - share)),
    };
    const dotShare =
      index === 0
        ? LOGO_BALL_RADIUS_SHARE
        : FIRST_DOT_RADIUS_SHARE +
          ((LAST_DOT_RADIUS_SHARE - FIRST_DOT_RADIUS_SHARE) * (index - 1)) / (ARC_DOTS - 1);
    writer.circle(point, radius * dotShare, index === 0 ? PALETTE.ball : PALETTE.bonusRing);
  }
}
