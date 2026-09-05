import { MIN_STAR_LEVEL } from '../constants';
import { getEnemyPoints, shouldAwardExtraLife } from '../scoring';
import type { EnemyTank, PlayerTank, WorldEvent } from '../types';
import { getTankCenter } from './tank-queries';
import type { WorldState } from './world-state';
import { placePlayerAtSpawn } from './world-state';

export function awardScore(state: WorldState, points: number, events: WorldEvent[]): void {
  const previousScore = state.score;
  state.score += points;

  events.push({ type: 'score-awarded', points, totalScore: state.score });

  if (shouldAwardExtraLife(previousScore, state.score, state.isExtraLifeAwarded)) {
    state.isExtraLifeAwarded = true;
    state.lives++;
    events.push({ type: 'extra-life-awarded', totalLives: state.lives });
  }
}

/**
 * Grenade kills explode like any other (`points: 0` marks them), but — like the ROM — award no
 * score, no popup and no tally entry.
 */
export function destroyEnemy(
  state: WorldState,
  enemy: EnemyTank,
  awardsPoints: boolean,
  events: WorldEvent[]
): void {
  state.stage.enemies = state.stage.enemies.filter(candidate => candidate !== enemy);

  const points = awardsPoints ? getEnemyPoints(enemy.type) : 0;

  events.push({
    type: 'enemy-destroyed',
    enemyType: enemy.type,
    position: getTankCenter(enemy),
    points,
  });

  if (awardsPoints) {
    awardScore(state, points, events);
  }
}

export function destroyPlayer(state: WorldState, player: PlayerTank, events: WorldEvent[]): void {
  events.push({
    type: 'player-destroyed',
    playerSlot: player.slot,
    position: getTankCenter(player),
  });

  state.lives--;
  player.starLevel = MIN_STAR_LEVEL;

  if (state.lives <= 0) {
    endGame(state, events);

    return;
  }

  placePlayerAtSpawn(state, player);
}

export function destroyBase(state: WorldState, events: WorldEvent[]): void {
  if (state.isBaseDestroyed) {
    return;
  }

  state.isBaseDestroyed = true;
  events.push({ type: 'base-destroyed' });
  endGame(state, events);
}

function endGame(state: WorldState, events: WorldEvent[]): void {
  if (state.status === 'game-over') {
    return;
  }

  state.status = 'game-over';
  events.push({ type: 'game-over' });
}
