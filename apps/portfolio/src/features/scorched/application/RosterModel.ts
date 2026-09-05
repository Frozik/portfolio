import { makeAutoObservable } from 'mobx';

import { MIN_PLAYER_COUNT } from '../domain/constants';
import type { PlayerController, PlayerId, PlayerSetup } from '../domain/types';
import { toPlayerId } from '../domain/types';
import type { ScorchedSetupOptions } from './scorched-setup';
import { DEFAULT_SETUP_OPTIONS } from './scorched-setup';

const FIRST_PLAYER_NUMBER = 1;

function createDefaultRoster(): readonly PlayerSetup[] {
  return Array.from({ length: MIN_PLAYER_COUNT }, (_unused, index) => ({
    id: toPlayerId(index),
    name: `${index + FIRST_PLAYER_NUMBER}`,
    controller:
      index === 0
        ? { kind: 'human' as const }
        : { kind: 'ai' as const, personality: 'spoiler' as const },
  }));
}

/** The line-up and the options the roster screen edits; a match is created from a copy of it. */
export class RosterModel {
  players: readonly PlayerSetup[] = createDefaultRoster();
  setup: ScorchedSetupOptions = DEFAULT_SETUP_OPTIONS;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  setSize(playerCount: number): void {
    this.players = Array.from(
      { length: playerCount },
      (_unused, index) =>
        this.players[index] ?? {
          id: toPlayerId(index),
          name: `${index + FIRST_PLAYER_NUMBER}`,
          controller: { kind: 'ai' as const, personality: 'shooter' as const },
        }
    );
  }

  setName(playerId: PlayerId, name: string): void {
    this.players = this.players.map(player =>
      player.id === playerId ? { ...player, name } : player
    );
  }

  setController(playerId: PlayerId, controller: PlayerController): void {
    this.players = this.players.map(player =>
      player.id === playerId ? { ...player, controller } : player
    );
  }

  setOptions(setup: ScorchedSetupOptions): void {
    this.setup = setup;
  }
}
