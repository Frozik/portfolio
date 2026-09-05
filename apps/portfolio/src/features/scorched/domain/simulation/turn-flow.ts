import { rollWind } from '../ballistics';
import { MIN_TANKS_ALIVE_TO_CONTINUE } from '../constants';
import type { TankState } from '../types';
import type { RoundState } from './round-state';

export function getActiveTank(state: RoundState): TankState | undefined {
  const playerId = state.turnOrder[state.turnIndex];

  return state.tanks.find(tank => tank.playerId === playerId && tank.isAlive);
}

function countAliveTanks(state: RoundState): number {
  return state.tanks.filter(tank => tank.isAlive).length;
}

/** Ends the round once fewer than two tanks stand; answers whether it did. */
export function endRoundIfDecided(state: RoundState): boolean {
  if (countAliveTanks(state) >= MIN_TANKS_ALIVE_TO_CONTINUE) {
    return false;
  }

  state.phase = 'ended';
  state.events.push({
    type: 'round-ended',
    survivorIds: state.tanks.filter(tank => tank.isAlive).map(tank => tank.playerId),
  });

  return true;
}

export function openTurn(state: RoundState): void {
  state.events.push({ type: 'turn-started', playerId: state.turnOrder[state.turnIndex] });
}

function advanceToNextLivingPlayer(state: RoundState): void {
  for (let step = 1; step <= state.turnOrder.length; step++) {
    const candidateIndex = (state.turnIndex + step) % state.turnOrder.length;
    const candidate = state.tanks.find(tank => tank.playerId === state.turnOrder[candidateIndex]);

    if (candidate?.isAlive === true) {
      state.turnIndex = candidateIndex;

      return;
    }
  }
}

export function finishTurn(state: RoundState): void {
  const finishedId = state.turnOrder[state.turnIndex];

  state.phase = 'settling';
  state.events.push({ type: 'turn-ended', playerId: finishedId });

  if (state.options.physics.isWindChanging) {
    state.windUnits = rollWind(state.options.physics.maxWind);
    state.events.push({ type: 'wind-changed', windUnits: state.windUnits });
  }

  if (endRoundIfDecided(state)) {
    return;
  }

  advanceToNextLivingPlayer(state);
  state.phase = 'aiming';
  openTurn(state);
}
