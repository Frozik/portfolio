import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';

import { chargeOf, stretchOf } from './band-charge';
import type { MeshWriter } from './mesh-writer';
import { PALETTE, withAlpha } from './palette';
import type { DrawnBand } from './scene-frame';

const PREVIEW_DOT_RADIUS_METERS = 0.03;
/** The dots of the softest stroke keep this share of the strongest one's light. */
const SOFTEST_DOT_ALPHA_SHARE = 0.6;

/**
 * The dots of the pending stroke, the brighter the harder the band is
 * pulled; grey while the ball still moves.
 */
export function writePreviewDots(
  writer: MeshWriter,
  dots: readonly Vector2[],
  aim: { readonly band: DrawnBand | undefined; readonly pending: boolean }
): void {
  const charge = isNil(aim.band) ? 1 : chargeOf(stretchOf(aim.band));
  const color = aim.pending ? PALETTE.dotPending : PALETTE.dot;
  const lit = withAlpha(
    color,
    color[3] * (SOFTEST_DOT_ALPHA_SHARE + (1 - SOFTEST_DOT_ALPHA_SHARE) * charge)
  );
  for (const dot of dots) {
    writer.circle(dot, PREVIEW_DOT_RADIUS_METERS, lit);
  }
}
