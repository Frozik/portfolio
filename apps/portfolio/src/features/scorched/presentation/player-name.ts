import type { PlayerId } from '../domain/types';
import { scorchedT } from './translations';

const FIRST_PLAYER_NUMBER = 1;

/** A blank name field falls back to the numbered default rather than rendering an empty chip. */
export function getPlayerDisplayName(player: {
  readonly id: PlayerId;
  readonly name: string;
}): string {
  const trimmed = player.name.trim();

  return trimmed === '' ? scorchedT.roster.defaultName(player.id + FIRST_PLAYER_NUMBER) : trimmed;
}
