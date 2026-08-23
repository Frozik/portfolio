import { ENEMY_POINTS_BY_TYPE, EXTRA_LIFE_SCORE_THRESHOLD } from './constants';
import type { EnemyType } from './types';

export function getEnemyPoints(enemyType: EnemyType): number {
  return ENEMY_POINTS_BY_TYPE[enemyType];
}

/** The 20 000-point bonus life is granted once per game, on the crossing tick. */
export function shouldAwardExtraLife(
  previousScore: number,
  nextScore: number,
  isAlreadyAwarded: boolean
): boolean {
  return (
    !isAlreadyAwarded &&
    previousScore < EXTRA_LIFE_SCORE_THRESHOLD &&
    nextScore >= EXTRA_LIFE_SCORE_THRESHOLD
  );
}
