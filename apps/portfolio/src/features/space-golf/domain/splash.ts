import { assertNever } from '@frozik/utils/assert/assertNever';
import type { Vector2 } from '@frozik/utils/math/vector2';
import { clamp, isNil } from 'lodash-es';

import type { FaceKind } from './level';
import type { Touch } from './step';

export const SPLASH_SECONDS = 1;
/** Slower than this the ball is rolling or lying on the face, not landing on it. */
const MIN_SPLASH_SPEED_METERS_PER_SECOND = 0.8;
/** A landing this hard splashes with all it has; a softer one with a share of it. */
const FULL_SPLASH_SPEED_METERS_PER_SECOND = 6;
const SEED_GRID_PER_METER = 1000;
const SEED_ROW_FACTOR = 7919;

/** What the drops are of: the island's own face, or the elastic or viscous surface on it. */
export type SplashMaterial = 'island' | 'bounce' | 'sticky';

/** A few drops thrown up where the ball landed on an island's face. */
export interface Splash {
  readonly point: Vector2;
  readonly normal: Vector2;
  readonly material: SplashMaterial;
  /** How hard the landing was, 0 to 1. */
  readonly strength: number;
  /** Where the drops of this splash fly: the same landing always throws the same drops. */
  readonly seed: number;
  readonly elapsedSeconds: number;
}

/** The splashes a step later: the old ones aged and the spent dropped, one new for each landing on an island's face. */
export function splashesAfter(
  splashes: readonly Splash[],
  touches: readonly Touch[],
  dt: number
): readonly Splash[] {
  const aged = splashes
    .map(splash => ({ ...splash, elapsedSeconds: splash.elapsedSeconds + dt }))
    .filter(splash => splash.elapsedSeconds < SPLASH_SECONDS);
  const raised = touches.flatMap(touch => {
    const splash = splashOf(touch);
    return isNil(splash) ? [] : [splash];
  });
  return splashes.length === 0 && raised.length === 0 ? splashes : [...aged, ...raised];
}

function splashOf(touch: Touch): Splash | undefined {
  const material = materialOf(touch.kind);
  if (isNil(material) || touch.at !== 'face' || touch.speed < MIN_SPLASH_SPEED_METERS_PER_SECOND) {
    return undefined;
  }
  return {
    point: touch.point,
    normal: touch.normal,
    material,
    strength: clamp(touch.speed / FULL_SPLASH_SPEED_METERS_PER_SECOND, 0, 1),
    seed:
      Math.round(touch.point.x * SEED_GRID_PER_METER) * SEED_ROW_FACTOR +
      Math.round(touch.point.y * SEED_GRID_PER_METER),
    elapsedSeconds: 0,
  };
}

function materialOf(kind: FaceKind): SplashMaterial | undefined {
  switch (kind) {
    case 'floor':
    case 'deflector':
      return 'island';
    case 'bounce':
    case 'sticky':
      return kind;
    case 'cup':
    case 'floater':
    case 'rod':
      return undefined;
    default:
      return assertNever(kind);
  }
}
