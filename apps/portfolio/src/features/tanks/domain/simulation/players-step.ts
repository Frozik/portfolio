import { getMaxBulletsForStarLevel, getPlayerBulletTraits, isFireRisingEdge } from '../bullets';
import { updatePlayerMovement } from '../movement';
import type { PlayerInputs, TankRef, WorldEvent } from '../types';
import { canFire, fireBullet } from './firing';
import { createMovementContext } from './tank-queries';
import type { WorldState } from './world-state';

const IDLE_INPUTS: PlayerInputs = { direction: undefined, fire: false };

export function stepPlayers(state: WorldState, inputs: PlayerInputs, events: WorldEvent[]): void {
  for (const player of state.players) {
    if (!player.isActive) {
      continue;
    }

    const playerInputs = player.slot === 0 ? inputs : IDLE_INPUTS;
    const wasIceSliding = player.isIceSliding;

    updatePlayerMovement(player, playerInputs, createMovementContext(state, player));

    if (!wasIceSliding && player.isIceSliding) {
      events.push({ type: 'player-ice-slide-started', playerSlot: player.slot });
    }

    const owner: TankRef = { side: 'player', slot: player.slot };

    if (
      isFireRisingEdge(state.stage.isPreviousFirePressed, playerInputs.fire) &&
      canFire(state, owner, getMaxBulletsForStarLevel(player.starLevel))
    ) {
      fireBullet(state, owner, player, getPlayerBulletTraits(player.starLevel), events);
    }
  }

  state.stage.isPreviousFirePressed = inputs.fire;
}
