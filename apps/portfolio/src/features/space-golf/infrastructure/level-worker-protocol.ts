import type { Level } from '../domain/level';

export interface LevelRequest {
  readonly seed: number;
}

export type LevelResponse =
  | { readonly seed: number; readonly level: Level }
  | { readonly seed: number; readonly error: string };
