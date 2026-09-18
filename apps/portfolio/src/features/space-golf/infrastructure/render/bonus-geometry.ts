import type { Vector2 } from '@frozik/utils/math/vector2';

import { assertNever } from '@frozik/utils/assert/assertNever';

import type { BonusKind } from '../../domain/bonus';
import { BONUS_RADIUS_METERS } from '../../domain/constants';
import type { MeshWriter, Rgba } from './mesh-writer';
import { PALETTE } from './palette';

/** The ring is this share of the disc's radius wide. */
const RING_SHARE = 0.14;
/** The foresight's logo: a ball and the dots of its flight ahead, bending over and down. */
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

/** The grip's logo: a splat of gum, drops flung out round it, and the white ball stuck in its middle. */
const SPLAT_RADIUS_SHARE = 0.46;
const SPLAT_DROPS = 6;
const FAR_DROP = { awayShare: 0.62, radiusShare: 0.17 };
const NEAR_DROP = { awayShare: 0.5, radiusShare: 0.12 };
const STUCK_BALL_RADIUS_SHARE = 0.27;
const QUARTER_TURN = Math.PI / 2;
const FULL_TURN = Math.PI * 2;

/** The bonus where it floats: a dark disc in a bright ring, breathing, with the logo of its kind inside. */
export function writeBonus(
  writer: MeshWriter,
  bonus: { readonly at: Vector2; readonly kind: BonusKind },
  timeSeconds: number
): void {
  const radius =
    BONUS_RADIUS_METERS * (1 + PULSE_SHARE * Math.sin(timeSeconds * PULSE_RADIANS_PER_SECOND));
  switch (bonus.kind) {
    case 'foresight':
      writeDisc(writer, bonus.at, radius, PALETTE.bonusFill, PALETTE.bonusRing);
      writeForesightLogo(writer, bonus.at, radius);
      return;
    case 'grip':
      writeDisc(writer, bonus.at, radius, PALETTE.gripFill, PALETTE.gripRing);
      writeGripLogo(writer, bonus.at, radius);
      return;
    default:
      assertNever(bonus.kind);
  }
}

function writeDisc(writer: MeshWriter, at: Vector2, radius: number, fill: Rgba, ring: Rgba): void {
  writer.circle(at, radius, fill);
  writer.ring(at, radius * (1 - RING_SHARE), radius, ring);
}

/** A white ball at the lower left and its dots arcing over to the right, each smaller than the last. */
function writeForesightLogo(writer: MeshWriter, at: Vector2, radius: number): void {
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

/** Far and near drops take turns round the splat, so it reads as flung, not as a cog. */
function writeGripLogo(writer: MeshWriter, at: Vector2, radius: number): void {
  writer.circle(at, radius * SPLAT_RADIUS_SHARE, PALETTE.gripRing);
  for (let index = 0; index < SPLAT_DROPS; index += 1) {
    const drop = index % 2 === 0 ? FAR_DROP : NEAR_DROP;
    const angle = QUARTER_TURN + (FULL_TURN * index) / SPLAT_DROPS;
    writer.circle(
      {
        x: at.x + Math.cos(angle) * radius * drop.awayShare,
        y: at.y + Math.sin(angle) * radius * drop.awayShare,
      },
      radius * drop.radiusShare,
      PALETTE.gripRing
    );
  }
  writer.circle(at, radius * STUCK_BALL_RADIUS_SHARE, PALETTE.ball);
}
