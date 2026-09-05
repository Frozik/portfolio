import { getBaseWallMaterial } from '../power-ups';
import { applyBaseWalls } from './base-walls';
import type { WorldState } from './world-state';

export function stepTimers(state: WorldState): void {
  for (const player of state.players) {
    if (player.shieldTicksRemaining > 0) {
      player.shieldTicksRemaining--;
    }
  }

  const { stage } = state;

  if (stage.freezeTicksRemaining > 0) {
    stage.freezeTicksRemaining--;
  }

  if (stage.shovelTicksRemaining > 0) {
    stage.shovelTicksRemaining--;
  }

  applyBaseWalls(stage, getBaseWallMaterial(stage.shovelTicksRemaining));
}
