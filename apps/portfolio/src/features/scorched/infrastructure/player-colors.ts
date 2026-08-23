import type { PlayerId } from '../domain/types';

export interface PlayerColor {
  /** CSS value for the HUD chrome. */
  readonly hex: string;
  /** The same colour as GPU channels in 0..1, for the tank and shell instances. */
  readonly red: number;
  readonly green: number;
  readonly blue: number;
}

const HEX_RADIX = 16;
const MAX_CHANNEL_VALUE = 255;
const CHANNEL_HEX_LENGTH = 2;

function toPlayerColor(hex: string): PlayerColor {
  const readChannel = (channelIndex: number): number => {
    const start = 1 + channelIndex * CHANNEL_HEX_LENGTH;

    return (
      Number.parseInt(hex.slice(start, start + CHANNEL_HEX_LENGTH), HEX_RADIX) / MAX_CHANNEL_VALUE
    );
  };

  return { hex, red: readChannel(0), green: readChannel(1), blue: readChannel(2) };
}

/**
 * [MANUAL-structural] Every player is colour-coded across their name, tank and shells. The hues
 * are ours: ten that stay apart from each other and readable against both sky and dirt.
 */
export const PLAYER_COLORS: readonly PlayerColor[] = [
  '#ef4444',
  '#f59e0b',
  '#a3e635',
  '#34d399',
  '#22d3ee',
  '#60a5fa',
  '#a78bfa',
  '#f472b6',
  '#fb923c',
  '#e2e8f0',
].map(toPlayerColor);

export function getPlayerColor(playerId: PlayerId): PlayerColor {
  return PLAYER_COLORS[playerId % PLAYER_COLORS.length];
}
