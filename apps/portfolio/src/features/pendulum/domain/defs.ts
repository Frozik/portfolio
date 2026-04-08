import type { EPlayerType } from './types';

export interface IGeneration {
  id: number;
  maxScore: number;

  players: { name: string; modelUrl: string; score: number }[];
}

export type TTestPlayer =
  | { type: EPlayerType.Robot; name: string; modelUrl: string }
  | { type: EPlayerType.Human };
